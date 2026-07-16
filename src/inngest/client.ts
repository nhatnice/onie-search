import { Inngest } from 'inngest';

// ponytail: SDK tự đọc INNGEST_EVENT_KEY / INNGEST_SIGNING_KEY / INNGEST_BASE_URL từ env
export const inngest = new Inngest({
  id: 'portal',
  isDev: process.env.NODE_ENV !== 'production',
});
