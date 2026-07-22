import type { JobsOptions, Queue } from 'bullmq';

interface CappedDispatchInput<T> {
  queue: Queue;
  limit: number;
  logPrefix: string;
  jobName: string;
  jobOptions: JobsOptions;
  buildJobs: (capacity: number) => Promise<Array<{ data: T; jobId?: string }>>;
}

export async function dispatchCapped<T>(
  input: CappedDispatchInput<T>,
): Promise<{ result: string }> {
  const counts = await input.queue.getJobCounts('wait', 'active');
  const pending = counts.wait + counts.active;
  if (pending >= input.limit) {
    console.warn(`[${input.logPrefix}] skip — ${pending} pending (limit ${input.limit})`);
    return { result: `Queue full (${pending}/${input.limit})` };
  }
  const jobs = await input.buildJobs(input.limit - pending);
  if (jobs.length === 0) return { result: 'Nothing to dispatch' };

  const bullJobs = jobs.map((j) => ({
    name: input.jobName,
    data: j.data,
    opts: { ...input.jobOptions, jobId: j.jobId },
  }));
  try {
    await input.queue.addBulk(bullJobs);
  } catch (err) {
    console.error(`[${input.logPrefix}] enqueue failed`, err);
  }
  console.warn(`[${input.logPrefix}] dispatched ${jobs.length}`);
  return { result: `Dispatched ${jobs.length}` };
}
