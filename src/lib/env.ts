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
  seedFeeds: optional('SEED_FEEDS', ''),
  pageCrawlConcurrency: Number(optional('PAGE_CRAWL_CONCURRENCY', '50')),
  feedDiscoveryWorkerConcurrency: Number(optional('FEED_DISCOVERY_WORKER_CONCURRENCY', '4')),
  browserlessUrl: optional('BROWSERLESS_URL'),
  browserlessToken: optional('BROWSERLESS_TOKEN'),
  browserlessTimeoutMs: optional('BROWSERLESS_TIMEOUT_MS', '30000'),
  r2AccountId: optional('R2_ACCOUNT_ID'),
  r2AccessKeyId: optional('R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: optional('R2_SECRET_ACCESS_KEY'),
  r2Bucket: optional('R2_BUCKET'),
  r2PublicUrl: optional('R2_PUBLIC_URL'),
  inngestEventKey: optional('INNGEST_EVENT_KEY', 'test_key'),
  inngestSigningKey: optional('INNGEST_SIGNING_KEY', 'test_signing_key'),
  inngestAppId: optional('INNGEST_APP_ID', 'portal'),
  inngestEndpoint: optional('INNGEST_ENDPOINT', 'http://localhost:8288'),
} as const;
