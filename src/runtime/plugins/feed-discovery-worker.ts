import process from 'node:process';

import { definePlugin as defineNitroPlugin } from 'nitro';

import {
  ensureFeedDiscoveryWorker,
  shutdownFeedDiscoveryWorker,
} from '@/features/feed-sources/api/worker';

async function cleanup() {
  await shutdownFeedDiscoveryWorker();
  process.exit(0);
}

export default defineNitroPlugin((nitro) => {
  ensureFeedDiscoveryWorker();
  nitro.hooks.hook('close', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
});
