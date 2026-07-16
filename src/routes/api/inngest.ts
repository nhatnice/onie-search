import { createFileRoute } from '@tanstack/react-router';
import { serve } from 'inngest/edge';

import {
  feedDiscoveryDispatcher,
  feedDiscoveryWorker,
  inngest,
  pageCrawlFunction,
} from '@/inngest';

const handler = serve({
  client: inngest,
  functions: [pageCrawlFunction, feedDiscoveryDispatcher, feedDiscoveryWorker],
});

export const Route = createFileRoute('/api/inngest')({
  server: {
    handlers: {
      GET: async ({ request }) => handler(request),
      POST: async ({ request }) => handler(request),
      PUT: async ({ request }) => handler(request),
    },
  },
});
