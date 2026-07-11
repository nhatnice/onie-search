import { createHash } from 'node:crypto';

/**
 * Normalize a URL into a stable key for dedup.
 *
 * @example
 * normalizeUrl('https://example.com/path/?q=1#section') => 'example.com/path'
 * normalizeUrl('https://EXAMPLE.com/')                  => 'example.com/'
 * normalizeUrl('https://example.com:443/')              => 'example.com/'
 * normalizeUrl('https://example.com:8080/')             => 'example.com:8080/'
 *
 * @returns Format: "subdomain.domain.tld[:port]/path" — no protocol, no query, no fragment, no trailing slash (root is "/").
 */
export function normalizeUrl(rawUrl: string): string {
  const u = new URL(rawUrl);
  const host = isDefaultPort(u.protocol, u.port) ? u.hostname : `${u.hostname}:${u.port}`;
  const path = u.pathname.replace(/\/+$/, '') || '/';
  return `${host}${path}`;
}

/** Stable SHA-1 hash of the normalized URL — used as page primary key. */
export function pageId(rawUrl: string): string {
  return createHash('sha1').update(normalizeUrl(rawUrl)).digest('hex');
}

function isDefaultPort(protocol: string, port: string): boolean {
  if (!port) return true;
  if (protocol === 'https:' && port === '443') return true;
  if (protocol === 'http:' && port === '80') return true;
  return false;
}
