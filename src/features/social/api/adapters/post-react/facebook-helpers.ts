import fs from 'node:fs';
import path from 'node:path';

import { type BrowserContext, type Page } from 'playwright-core';

import { getBrowser } from '@/browser';

import { parseCookieHeader } from '../../adapters/_shared';
import { type ScraperAccount } from '../../queries';
import type { Reactor, ReactProgress } from './types';

export const PLATFORM_ID = 'facebook';
export const FB_COOKIE_DOMAIN = '.facebook.com';
export const FB_HOME = 'https://www.facebook.com/';
export const SESSION_DEAD_RE = /\/(login|checkpoint|cookie)(\/|\.|$|\?)/i;

export const REACT_LIMIT = Number(process.env['REACT_LIMIT'] ?? '200');
export const ROTATE_EVERY_N = Number(process.env['ROTATE_EVERY_N'] ?? '1000');
export const MAX_ROTATIONS_PER_POST = Number(process.env['MAX_ROTATIONS_PER_POST'] ?? '100');

const REACTION_SCRIPT_PATH = path.resolve(
  process.cwd(),
  'src/features/social/runtime/facebook-internal/reaction-export.js',
);
export const reactionScriptContent = fs.readFileSync(REACTION_SCRIPT_PATH, 'utf-8');

export function extractFbPostId(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Invalid FB post URL: ${url}`);
  }
  const params = parsed.searchParams;
  const storyFbid = params.get('story_fbid');
  if (storyFbid && /^\d+$/.test(storyFbid)) return storyFbid;
  const fbid = params.get('fbid');
  if (fbid && /^\d+$/.test(fbid)) return fbid;
  for (let i = parsed.pathname.split('/').filter(Boolean).length - 1; i >= 0; i--) {
    const seg = parsed.pathname.split('/').filter(Boolean)[i];
    if (seg && /^\d{10,}$/.test(seg)) return seg;
  }
  throw new Error(`Cannot extract FB postId from URL: ${url}`);
}

export function toFeedbackTargetID(postId: string): string {
  return Buffer.from('feedback:' + postId, 'utf-8').toString('base64');
}

export function isSessionDeadMessage(msg: string): boolean {
  return SESSION_DEAD_RE.test(msg) || /checkpoint|login/i.test(msg);
}

export async function openValidatedContext(account: ScraperAccount): Promise<BrowserContext> {
  const browser = await getBrowser();
  const cookies = parseCookieHeader(account.cookie.cookie, FB_COOKIE_DOMAIN);
  const context = await browser.newContext();
  await context.addCookies(cookies);
  return context;
}

let progressHandler: ((p: ReactProgress) => void) | null = null;
let currentAbort: AbortController | null = null;

export function resetReactionScriptState(): void {
  progressHandler = null;
  currentAbort = null;
}

export async function injectReactionScript(page: Page): Promise<void> {
  await page.addInitScript({ content: reactionScriptContent });
}

export async function ensureProgressSink(page: Page): Promise<void> {
  await page.exposeFunction('__reactProgressSink', (progress: ReactProgress) => {
    progressHandler?.(progress);
  });
}

export async function ensureAbortSink(page: Page): Promise<void> {
  await page.exposeFunction('__reactAbortSink', () => {
    currentAbort?.abort();
  });
}

export async function abortCurrentReactFetch(page: Page): Promise<void> {
  currentAbort?.abort();
  await page.evaluate(() => {
    const w = globalThis as unknown as Record<string, unknown>;
    const ac = w['__reactAC'] as AbortController | undefined;
    ac?.abort();
  });
}

export interface FetchReactionsOptions {
  onProgress?: (p: ReactProgress) => void;
  limit?: number;
  startCursor?: string | null;
}

export async function fetchReactionsInPage(
  page: Page,
  input: string,
  opts: FetchReactionsOptions = {},
): Promise<Reactor[]> {
  await ensureAbortSink(page);
  if (opts.onProgress) {
    await ensureProgressSink(page);
    progressHandler = opts.onProgress;
  }
  currentAbort = new AbortController();
  const reactors = await page.evaluate(
    async ({
      arg,
      limit,
      startCursor,
    }: {
      arg: string;
      limit: number;
      startCursor: string | null;
    }) => {
      const w = globalThis as unknown as Record<string, unknown>;
      const exportFn = w['exportFBReactions'] as
        | ((u: string, o?: unknown) => Promise<unknown>)
        | undefined;
      if (!exportFn) {
        throw new Error('exportFBReactions chưa load — injectReactionScript trước');
      }
      const AC = w['AbortController'] as typeof AbortController;
      const ac = new AC();
      w['__reactAC'] = ac;
      const o: {
        onProgress?: (p: ReactProgress) => void;
        limit?: number;
        skipDownload?: boolean;
        startCursor?: string | null;
        signal?: AbortSignal;
      } = {};
      if (w['__reactProgressSink']) {
        o.onProgress = w['__reactProgressSink'] as (p: ReactProgress) => void;
      }
      if (limit && limit > 0) o.limit = limit;
      o.skipDownload = true;
      if (startCursor) o.startCursor = startCursor;
      o.signal = ac.signal;
      return await exportFn(arg, o);
    },
    { arg: input, limit: opts.limit ?? 0, startCursor: opts.startCursor ?? null },
  );
  currentAbort = null;
  return (reactors ?? []) as Reactor[];
}
