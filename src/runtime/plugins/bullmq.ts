// Tạm thời comment out các import không dùng để tránh eslint unused vars khi tạm tắt workers
// import { setupEventListeners } from '@/events/listeners';
// import { startWorkers } from '@/redis';
import { closeQueues, stopWorkers } from '@/redis';

export default function (nitroApp: {
  hooks: { hook: (name: string, cb: () => Promise<void>) => void };
}): void {
  // Tạm tắt background workers & crawl event listeners theo yêu cầu
  console.warn('[BullMQ] Background workers & crawl event listeners are temporarily disabled');

  // // Setup event listeners (enqueue BullMQ jobs from domain events)
  // setupEventListeners();

  // // Start BullMQ workers (consume jobs)
  // startWorkers();

  // Graceful Shutdown Hook
  nitroApp.hooks.hook('close', async () => {
    await stopWorkers();
    await closeQueues();
  });
}
