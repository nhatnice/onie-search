function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optional(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function optionalNumber(name: string, fallback: number): number {
  const value = process.env[name];
  if (value === undefined) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export const env = {
  databaseUrl: required('DATABASE_URL'),
  seedFeeds: optional('SEED_FEEDS', ''),
  browserlessUrl: required('BROWSERLESS_URL'),
  browserlessToken: required('BROWSERLESS_TOKEN'),
  browserlessTimeoutMs: optional('BROWSERLESS_TIMEOUT_MS', '1800000'),
  r2AccountId: required('R2_ACCOUNT_ID'),
  r2AccessKeyId: required('R2_ACCESS_KEY_ID'),
  r2SecretAccessKey: required('R2_SECRET_ACCESS_KEY'),
  r2Bucket: required('R2_BUCKET'),
  r2PublicUrl: required('R2_PUBLIC_URL'),
  redisUrl: optional('REDIS_URL', 'redis://localhost:6379'),
  exaApiKey: optional('EXA_API_KEY', ''),
  openaiApiKey: optional('OPENAI_API_KEY', ''),
  openaiBaseUrl: optional('OPENAI_BASE_URL', ''),
  openaiModel: optional('OPENAI_MODEL', 'gpt-4o-mini'),
  uidfbAuthCode: optional('UIDFB_AUTHCODE', ''),
  phoneExtractConcurrency: optionalNumber('PHONE_EXTRACT_CONCURRENCY', 100),
  pageCrawlConcurrency: optionalNumber('PAGE_CRAWL_CONCURRENCY', 50),
  feedDiscoveryConcurrency: optionalNumber('FEED_DISCOVERY_WORKER_CONCURRENCY', 4),
  cookieRefreshConcurrency: optionalNumber('COOKIE_REFRESH_WORKER_CONCURRENCY', 4),
  postReactCrawlConcurrency: optionalNumber('POST_REACT_CRAWL_CONCURRENCY', 1),
} as const;
