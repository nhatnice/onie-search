import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'portal',
  isDev: process.env.NODE_ENV !== 'production',
});
