import IORedis from 'ioredis';

import { env } from '@/lib/env';

let connection: IORedis | undefined;

/** Shared IORedis connection for all BullMQ queues/workers in this process. */
export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    await connection.quit();
    connection = undefined;
  }
}
