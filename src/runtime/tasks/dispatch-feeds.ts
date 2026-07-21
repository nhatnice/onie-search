import { defineTask } from 'nitro/task';

import { dispatchFeeds } from '@/redis';

export default defineTask({
  meta: {
    name: 'dispatch-feeds',
    description:
      'Query due feeds and emit FEED_DISCOVERY_REQUESTED events (enqueue to feed-discovery-worker BullMQ queue)',
  },
  async run() {
    return (await dispatchFeeds()) as { result: string };
  },
});
