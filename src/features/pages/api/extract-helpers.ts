import { attrOf, safeUrl } from '@/crawl';

export function thumbnailOf(document: Document, html: string, baseUrl: string): string | undefined {
  const og = attrOf(document, 'meta[property="og:image"]', 'content');
  if (og) return safeUrl(og, baseUrl);
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match) return safeUrl(match[1], baseUrl);
  return undefined;
}

export function faviconOf(document: Document, baseUrl: string): string | undefined {
  const candidates = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
  ];
  for (const sel of candidates) {
    const href = attrOf(document, sel, 'href');
    if (href) {
      const resolved = safeUrl(href, baseUrl);
      if (resolved) return resolved;
    }
  }
  return safeUrl('/favicon.ico', baseUrl);
}

export function extractJsonLd(document: Document): unknown[] {
  const result: unknown[] = [];
  for (const script of Array.from(
    document.querySelectorAll('script[type="application/ld+json"]'),
  )) {
    const text = script.textContent?.trim();
    if (!text) continue;
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) result.push(...parsed);
      else result.push(parsed);
    } catch {
      // ponytail: skip malformed JSON-LD
    }
  }
  return result;
}
