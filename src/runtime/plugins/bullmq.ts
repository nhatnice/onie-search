import { setupEventListeners } from '@/events/listeners';
import { startWorkers, setupRepeatableJobs, stopWorkers, closeQueues } from '@/redis';

export default function (nitroApp: {
  hooks: { hook: (name: string, cb: () => Promise<void>) => void };
}): void {
  // 1. Setup event listeners
  setupEventListeners();

  // 2. Start Workers
  startWorkers();

  // 3. Schedule Repeatable (Cron) Jobs
  setupRepeatableJobs().catch((err) => {
    console.error('[BullMQ Plugin] Failed to setup repeatable jobs:', err);
  });

  // 4. Graceful Shutdown Hook
  nitroApp.hooks.hook('close', async () => {
    await stopWorkers();
    await closeQueues();
  });
}
