import { defineTask } from 'nitro/task';

import { dispatchPhoneExtract } from '@/redis/workers';

export default defineTask({
  meta: {
    name: 'dispatch-phone-extract',
    description:
      'Query accounts without phone and enqueue phone-extract-worker BullMQ jobs (every 5 min, run via Nitro scheduledTasks)',
  },
  async run() {
    return (await dispatchPhoneExtract()) as { result: string };
  },
});
