import { InngestCommHandler } from 'inngest';
import {
  defineEventHandler,
  getMethod,
  getQuery,
  getRequestHeader,
  readBody,
  type H3Event,
} from 'nitro/h3';

import {
  feedDiscoveryDispatcher,
  feedDiscoveryWorker,
  inngest,
  pageCrawlFunction,
} from '@/inngest';

const inngestHandler = new InngestCommHandler({
  frameworkName: 'nitro',
  client: inngest,
  functions: [pageCrawlFunction, feedDiscoveryDispatcher, feedDiscoveryWorker],
  handler: (event: H3Event) => ({
    body: () => readBody(event),
    headers: (key) => getRequestHeader(event, key) ?? undefined,
    method: () => getMethod(event),
    url: () => new URL(event.url.toString()),
    queryString: (key) => getQuery(event)[key] ?? undefined,
    transformResponse: ({ body, status, headers }) => {
      const h = new Headers();
      for (const [name, value] of Object.entries(headers ?? {})) {
        if (value !== undefined && value !== null) h.set(name, String(value));
      }
      return new Response(body, { status, headers: h });
    },
  }),
}).createHandler();

export default defineEventHandler((event) => inngestHandler(event));
