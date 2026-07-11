export interface CrawlResponse {
  url: string;
  statusCode: number;
  contentType: string;
  body: Buffer | string;
  headers?: Record<string, string>;
  durationMs: number;
}
