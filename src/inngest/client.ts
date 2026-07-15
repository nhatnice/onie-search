import { Inngest } from 'inngest';

import { env } from '@/lib/env';

export const inngest = new Inngest({
  id: env.inngestAppId,
  eventKey: env.inngestEventKey,
  signingKey: env.inngestSigningKey,
  isDev: process.env.NODE_ENV !== 'production',
  // ponytail: no per-event TS generics — Inngest's send() accepts any literal string,
  // so PortalEvents typing gave false safety. Single source of truth is events.ts.
});
