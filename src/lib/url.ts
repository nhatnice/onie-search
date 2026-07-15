import { createHash } from 'node:crypto';

import normalizeUrlLib from 'normalize-url';

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

  return `${host}${path}${u.search}${u.hash}`;
}

/** Stable SHA-1 hash of the normalized URL — used as page primary key. */
export function pageId(rawUrl: string): string {
  return createHash('sha1').update(normalizeUrl(rawUrl)).digest('hex');
}

/** Extract hostname from a URL string, or undefined if the URL is invalid. */
export function hostnameOf(rawUrl: string): string | undefined {
  try {
    return new URL(rawUrl).hostname;
  } catch {
    return undefined;
  }
}

function isDefaultPort(protocol: string, port: string): boolean {
  if (!port) return true;
  if (protocol === 'https:' && port === '443') return true;
  if (protocol === 'http:' && port === '80') return true;
  return false;
}

// Tracking params to strip — covers GA, Google Ads, FB, TikTok, Bing, X, Yandex,
// Mailchimp, HubSpot, referrer, session IDs (per docs/features/URL_DISCOVERY.md §4.2).
const TRACKING_PARAMS = [
  /^utm_\w+/i, // GA: utm_source, utm_medium, utm_campaign, utm_term, utm_content
  '_gl', // GA4
  'gclid',
  'gclsrc',
  'dclid',
  'wbraid',
  'gbraid', // Google Ads & DoubleClick
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_source', // Facebook/Meta
  'ttclid',
  'msclkid',
  'twclid',
  'yclid', // TikTok, Bing, X, Yandex
  'mc_cid',
  'mc_eid', // Mailchimp
  '_hsenc',
  '_hsmi', // HubSpot
  'ref',
  'ref_src',
  'source',
  'origin',
  'originalReferrer', // Referrer/generic
  'sessionid',
  'sid',
  'phpsessid',
  'aspsessionid',
  'jsessionid', // Session IDs
] as const;

const NON_ROUTABLE_PREFIXES = ['javascript:', 'mailto:', 'tel:', 'sms:', 'data:'] as const;

function isNonRoutable(href: string): boolean {
  const lower = href.trim().toLowerCase();
  return NON_ROUTABLE_PREFIXES.some((p) => lower.startsWith(p));
}

const UNRESERVED_DECODE =
  /%41|%42|%43|%44|%45|%46|%47|%48|%49|%4A|%4B|%4C|%4D|%4E|%4F|%50|%51|%52|%53|%54|%55|%56|%57|%58|%59|%5A|%61|%62|%63|%64|%65|%66|%67|%68|%69|%6A|%6B|%6C|%6D|%6E|%6F|%70|%71|%72|%73|%74|%75|%76|%77|%78|%79|%7A|%30|%31|%32|%33|%34|%35|%36|%37|%38|%39|%2D|%2E|%5F|%7E/gi;

function decodeUnreserved(s: string): string {
  return s.replace(UNRESERVED_DECODE, decodeURIComponent);
}

function uppercasePercentEncoding(s: string): string {
  return s.replace(/%[0-9a-f]{2}/g, (m) => m.toUpperCase());
}

export interface CanonicalizeOptions {
  baseUrl?: string;
}

export function canonicalizeUrl(
  rawUrl: string,
  opts: CanonicalizeOptions = {},
): string | undefined {
  const trimmed = rawUrl.trim();
  if (!trimmed || isNonRoutable(trimmed)) return undefined;
  if (!opts.baseUrl && trimmed.startsWith('//')) return undefined;
  let u: URL;
  try {
    u = opts.baseUrl ? new URL(trimmed, opts.baseUrl) : new URL(trimmed);
  } catch {
    return undefined;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return undefined;

  const normalized = normalizeUrlLib(u.href, {
    defaultProtocol: u.protocol === 'https:' ? 'https' : 'http',
    stripWWW: true,
    stripHash: false,
    removeTrailingSlash: false,
    removeQueryParameters: [...TRACKING_PARAMS],
    sortQueryParameters: true,
  });

  // normalize-url covers ~80% of RFC 3986. Supplement: percent-encoding uppercase +
  // decode unreserved chars (RFC 3986 §6.2.2.2) which normalize-url doesn't do.
  const parsed = new URL(normalized);
  const path = uppercasePercentEncoding(decodeUnreserved(parsed.pathname));
  const hash = parsed.hash && parsed.hash !== '#' ? uppercasePercentEncoding(parsed.hash) : '';
  return `${parsed.protocol}//${parsed.host}${path}${parsed.search}${hash}`;
}
