import { defineTask } from 'nitro/task';

import { dispatchPostReactCrawl } from '@/redis/workers';

export default defineTask({
  meta: {
    name: 'dispatch-post-reacts',
    description:
      'Query posts without crawl job and addBulk to post-react-crawl BullMQ queue (hourly, run via Nitro scheduledTasks)',
  },
  async run() {
    return (await dispatchPostReactCrawl()) as { result: string };
  },
});
