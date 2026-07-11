import process from 'node:process';

import { definePlugin as defineNitroPlugin } from 'nitro';

import { ensurePageCrawlWorker, shutdownPageCrawlWorker } from '@/features/pages/api/worker';

async function cleanup() {
  await shutdownPageCrawlWorker();
  process.exit(0);
}

export default defineNitroPlugin((nitro) => {
  ensurePageCrawlWorker();
  nitro.hooks.hook('close', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
});
