import { setupEventListeners } from '@/events/listeners';
import { startWorkers, stopWorkers, closeQueues } from '@/redis';

export default function (nitroApp: {
  hooks: { hook: (name: string, cb: () => Promise<void>) => void };
}): void {
  // Setup event listeners (enqueue BullMQ jobs from domain events)
  setupEventListeners();

  // Start BullMQ workers (consume jobs)
  startWorkers();

  // Graceful Shutdown Hook
  nitroApp.hooks.hook('close', async () => {
    await stopWorkers();
    await closeQueues();
  });
}
