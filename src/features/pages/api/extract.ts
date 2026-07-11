import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

import { attrOf, textOf } from '@/crawl';

import { extractJsonLd, faviconOf, thumbnailOf } from './extract-helpers';
import type { ExtractedPage } from './types';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

/** Parse a HTML document and extract page metadata + content. */
export function extractPage(document: Document, html: string, baseUrl: string): ExtractedPage {
  const title =
    textOf(document, 'title') ?? attrOf(document, 'meta[property="og:title"]', 'content');
  const description =
    attrOf(document, 'meta[name="description"]', 'content') ??
    attrOf(document, 'meta[property="og:description"]', 'content');
  const thumbnail = thumbnailOf(document, html, baseUrl);
  const favicon = faviconOf(document, baseUrl);
  const jsonLd = extractJsonLd(document);
  const language =
    document.documentElement.lang ||
    attrOf(document, 'meta[http-equiv="content-language"]', 'content');
  const author =
    attrOf(document, 'meta[name="author"]', 'content') ??
    attrOf(document, 'meta[property="article:author"]', 'content');
  const publishedAt =
    attrOf(document, 'meta[property="article:published_time"]', 'content') ??
    attrOf(document, 'meta[name="pubdate"]', 'content');
  const modifiedAt =
    attrOf(document, 'meta[property="article:modified_time"]', 'content') ??
    attrOf(document, 'meta[http-equiv="last-modified"]', 'content');

  let cleanHtml: string | undefined;
  let rawMarkdown: string | undefined;
  try {
    const reader = new Readability(document);
    const article = reader.parse();
    if (article) {
      cleanHtml = article.content ?? undefined;
      if (article.content) rawMarkdown = turndown.turndown(article.content);
    }
  } catch {
    // ponytail: malformed DOM — fall back to full-page markdown
  }
  if (!rawMarkdown) {
    try {
      rawMarkdown = turndown.turndown(html);
    } catch {
      // ponytail: turndown failed on malformed HTML — skip markdown
    }
  }

  return {
    title,
    description,
    thumbnail,
    favicon,
    jsonLd,
    rawMarkdown,
    cleanHtml,
    rawHtml: html,
    language,
    author,
    publishedAt,
    modifiedAt,
  };
}
