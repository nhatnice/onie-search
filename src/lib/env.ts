function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),
  seedUrls: optional('SEED_URLS', ''),
  browserlessUrl: required('BROWSERLESS_URL'),
  browserlessToken: required('BROWSERLESS_TOKEN'),
  browserlessTimeoutMs: optional('BROWSERLESS_TIMEOUT_MS', '1800000'),
} as const;
