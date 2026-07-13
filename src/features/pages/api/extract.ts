import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';

import { attrOf, textOf } from '@/crawl';
import { stripNullBytes } from '@/lib/sanitize';

import { extractJsonLd, faviconOf, thumbnailOf } from './extract-helpers';
import type { ExtractedPage } from './types';

const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

const stringCleaners = [stripNullBytes];

function cleanExtractedPage(p: ExtractedPage): ExtractedPage {
  const clean = (s: string | undefined) =>
    stringCleaners.reduce<string | undefined>((acc, fn) => fn(acc), s);
  return {
    title: clean(p.title),
    description: clean(p.description),
    thumbnail: clean(p.thumbnail),
    favicon: clean(p.favicon),
    jsonLd: p.jsonLd,
    rawMarkdown: clean(p.rawMarkdown),
    cleanMarkdown: clean(p.cleanMarkdown),
    cleanHtml: clean(p.cleanHtml),
    rawHtml: clean(p.rawHtml)!,
    language: clean(p.language),
    author: clean(p.author),
    publishedAt: clean(p.publishedAt),
    modifiedAt: clean(p.modifiedAt),
  };
}

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
  let cleanMarkdown: string | undefined;
  let rawMarkdown: string | undefined;
  try {
    const reader = new Readability(document);
    const article = reader.parse();
    if (article) {
      cleanHtml = article.content ?? undefined;
      if (article.content) cleanMarkdown = turndown.turndown(article.content);
    }
  } catch {}
  try {
    rawMarkdown = turndown.turndown(html);
  } catch {}

  return cleanExtractedPage({
    title,
    description,
    thumbnail,
    favicon,
    jsonLd,
    rawMarkdown,
    cleanMarkdown,
    cleanHtml,
    rawHtml: html,
    language,
    author,
    publishedAt,
    modifiedAt,
  });
}
