import { safeUrl } from './html-utils';

/** Extract <a href> links and classify internal vs outbound by hostname. */
export function extractAnchorLinks(
  document: Document,
  baseUrl: string,
): Array<{ url: string; type: 'internal' | 'outbound'; source: 'anchor' }> {
  const baseHost = new URL(baseUrl).hostname;
  const seen = new Set<string>();
  const links: Array<{ url: string; type: 'internal' | 'outbound'; source: 'anchor' }> = [];

  for (const a of Array.from(document.querySelectorAll('a[href]'))) {
    const raw = a.getAttribute('href')?.trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:'))
      continue;
    const resolved = safeUrl(raw, baseUrl);
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    try {
      const host = new URL(resolved).hostname;
      links.push({
        url: resolved,
        type: host === baseHost ? 'internal' : 'outbound',
        source: 'anchor',
      });
    } catch {
      // ponytail: skip URLs we can't parse
    }
  }
  return links;
}

/** Discover sitemap URLs from <link rel="sitemap"> in the document head. */
export function extractSitemapHints(document: Document, baseUrl: string): string[] {
  const urls: string[] = [];
  for (const link of Array.from(document.querySelectorAll('link[rel="sitemap"]'))) {
    const href = link.getAttribute('href')?.trim();
    if (!href) continue;
    const resolved = safeUrl(href, baseUrl);
    if (resolved) urls.push(resolved);
  }
  return urls;
}
