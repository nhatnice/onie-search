import Redis from 'ioredis';

import { env } from '@/lib/env';

export function createRedisClient(): Redis {
  return new Redis(env.redisUrl, {
    maxRetriesPerRequest: null,
  });
}
