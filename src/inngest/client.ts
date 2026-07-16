import { Inngest } from 'inngest';

import { env } from '@/lib/env';

export const inngest = new Inngest({
  id: env.inngestAppId,
  eventKey: env.inngestEventKey,
  signingKey: env.inngestSigningKey,
  isDev: process.env.NODE_ENV !== 'production',
  // checkpointing: { maxRuntime: '120s' },
});
