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
  r2AccountId: required('R2_ACCOUNT_ID'),
  r2AccessKeyId: required('R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  r2Bucket: required('R2_BUCKET'),
  r2PublicUrl: required('R2_PUBLIC_URL'),
  inngestEventKey: optional('INNGEST_EVENT_KEY', 'test_key'),
  inngestSigningKey: optional('INNGEST_SIGNING_KEY', 'test_signing_key'),
  inngestAppId: optional('INNGEST_APP_ID', 'portal'),
  inngestEndpoint: optional('INNGEST_ENDPOINT', 'http://localhost:8288'),
} as const;
