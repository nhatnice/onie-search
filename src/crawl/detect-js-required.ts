import { Buffer } from 'node:buffer';

import { isProbablyReaderable } from '@mozilla/readability';

import type { CrawlResponse } from './types';

const MOUNT_POINT_SELECTOR = '#root, #app, #__next, #__nuxt, #root-router';

/**
 * Detect whether a fetched HTML response requires a real browser to extract
 * content from — either because it's a JS-rendered SPA shell, or because it's
 * been blocked by an anti-bot system that a browser might bypass.
 *
 * Signals (short-circuit OR):
 *   - antiBotBlocked: 403/429 + short body (Cloudflare/Akamai signature)
 *   - emptyMountPoint: #root/#app/#__next/#__nuxt empty (SPA convention)
 *   - notReaderable: isProbablyReaderable() === false (Mozilla Firefox Reader View)
 *   - noScriptOnly: <noscript> dominates body ("Please enable JavaScript")
 *
 * Sources: mozilla/readability (isProbablyReaderable), Crawl4AI content inspection,
 * SPA framework conventions (React/Vue/Next/Nuxt mount points).
 */
export function requiresJsRender(response: CrawlResponse, document: Document): boolean {
  return (
    antiBotBlocked(response) || //
    emptyMountPoint(document) ||
    notReaderable(document) ||
    noScriptOnly(document)
  );
}

// HTTP 403/429 with short body is the standard anti-bot block signature.
// Source: Crawl4AI Anti-Bot (https://docs.crawl4ai.com/advanced/anti-bot-and-fallback/)
//         "HTTP 403/429 with short or empty response bodies"
function antiBotBlocked(response: CrawlResponse): boolean {
  if (response.statusCode !== 403 && response.statusCode !== 429) return false;
  const bytes =
    typeof response.body === 'string' ? Buffer.byteLength(response.body) : response.body.length;
  return bytes < 1024;
}

// React/Vue/Next/Nuxt/Remix convention: SPA boots into an empty mount point.
// `:empty` CSS pseudo matches elements with no children (text or element).
function emptyMountPoint(document: Document): boolean {
  return Boolean(document.querySelector(MOUNT_POINT_SELECTOR));
}

// Mozilla Firefox Reader View uses isProbablyReaderable as a fast pre-check.
// If it returns false, the page has too little content to extract — likely a
// shell that only fills in after JS runs.
// Source: https://github.com/mozilla/readability#isprobablyreaderabledocument-options
function notReaderable(document: Document): boolean {
  try {
    return !isProbablyReaderable(document);
  } catch {
    return false;
  }
}

// Page whose body is essentially just "<noscript>Please enable JavaScript</noscript>".
// Cheap heuristic: check if noscript text dominates body text.
function noScriptOnly(document: Document): boolean {
  const bodyText = document.body?.textContent?.trim() ?? '';
  if (bodyText.length < 200) return false;
  const noscriptText = Array.from(document.querySelectorAll('noscript'))
    .map((n) => n.textContent ?? '')
    .join(' ')
    .trim();
  if (noscriptText.length === 0) return false;
  return noscriptText.length / bodyText.length > 0.5;
}
