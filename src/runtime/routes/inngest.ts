import { serve } from 'inngest/nitro';

import {
  feedDiscoveryDispatcher,
  feedDiscoveryWorker,
  inngest,
  pageCrawlFunction,
} from '@/inngest';

export default serve({
  client: inngest,
  functions: [pageCrawlFunction, feedDiscoveryDispatcher, feedDiscoveryWorker],
});
