import fs from 'node:fs';
import path from 'node:path';

import { type BrowserContext, type Page } from 'playwright-core';

import { getBrowser } from '@/browser';
import type { DbOrTx } from '@/db';

import { parseCookieHeader } from '../../adapters/_shared';
import {
  insertPostReactsBulk,
  loadScraperAccountByCookieId,
  markCookieDead,
  saveJobCursor,
  upsertReactorAccount,
  type ScraperAccount,
} from '../../queries';
import { RobinRotator } from '../rotation';
import type { PostReactCrawlAdapter, ReactCrawlInput, ReactCrawlResult } from './types';

const PLATFORM_ID = 'facebook';
const FB_COOKIE_DOMAIN = '.facebook.com';
const FB_HOME = 'https://www.facebook.com/';
const SESSION_DEAD_RE = /\/(login|checkpoint|cookie)(\/|\.|$|\?)/i;

const REACT_LIMIT = Number(process.env['REACT_LIMIT'] ?? '200');
const ROTATE_EVERY_N = Number(process.env['ROTATE_EVERY_N'] ?? '1000');
const MAX_ROTATIONS_PER_POST = Number(process.env['MAX_ROTATIONS_PER_POST'] ?? '100');

// ponytail: reaction-export.js is a third-party FB private exporter (see src/features/social/runtime/facebook-internal/README.md).
// process.cwd() works in both dev (project root) and Docker (WORKDIR /app with src/ copied).
const REACTION_SCRIPT_PATH = path.resolve(
  process.cwd(),
  'src/features/social/runtime/facebook-internal/reaction-export.js',
);
const reactionScriptContent = fs.readFileSync(REACTION_SCRIPT_PATH, 'utf-8');

// ─── fb post id from url ─────────────────────────────────────────────────────

function extractFbPostId(url: string): string {
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

function toFeedbackTargetID(postId: string): string {
  return Buffer.from('feedback:' + postId, 'utf-8').toString('base64');
}

// ─── session helpers ─────────────────────────────────────────────────────────

function isSessionDeadMessage(msg: string): boolean {
  return /FB_SESSION_DEAD|FB_DTSG_PARSE_FAIL|FB_SPA_NOT_READY|FB_RATE_LIMITED|checkpoint|\/login(\/|\.|$|\?)/i.test(
    msg,
  );
}

async function openValidatedContext(account: ScraperAccount): Promise<BrowserContext> {
  const browser = await getBrowser();
  const context = await browser.newContext();
  await context.addCookies(parseCookieHeader(account.cookie.cookie, FB_COOKIE_DOMAIN));
  const probe = await context.newPage();
  try {
    await probe.addInitScript({ content: reactionScriptContent });
    await probe.goto(FB_HOME, { waitUntil: 'domcontentloaded', timeout: 60_000 });
    if (SESSION_DEAD_RE.test(probe.url())) {
      await context.close().catch(() => undefined);
      throw new Error(`account #${account.account.id} session dead on launch`);
    }
  } finally {
    await probe.close().catch(() => undefined);
  }
  return context;
}

// ─── reaction exporter wrapper (third-party, opaque) ─────────────────────────

type Reactor = {
  uid: string;
  name: string;
  profileUrl: string;
  ['User Id']: string;
  ['Username']: string;
  ['Profile URL']: string;
  ['Avatar URL']: string;
  ['Reaction Type']: string;
  ['Friendship Status']: string;
  ['Subscribe Status']: string;
  ['Mutual Friends Number']: number;
};

type ReactProgress = {
  page: number;
  total: number;
  hasNext: boolean;
  cursor: string | null;
  pageReactors?: Reactor[];
};

let progressHandler: ((p: ReactProgress) => void) | null = null;
let progressSinkExposed = false;
let abortSinkExposed = false;
let currentAbort: AbortController | null = null;

function resetReactionScriptState(): void {
  progressHandler = null;
  progressSinkExposed = false;
  abortSinkExposed = false;
  currentAbort = null;
}

async function injectReactionScript(page: Page): Promise<void> {
  await page.addInitScript({ content: reactionScriptContent });
}

async function ensureProgressSink(page: Page): Promise<void> {
  if (progressSinkExposed) return;
  await page.exposeFunction('__reactProgressSink', (p: ReactProgress) => {
    if (progressHandler) progressHandler(p);
  });
  progressSinkExposed = true;
}

async function ensureAbortSink(page: Page): Promise<void> {
  if (abortSinkExposed) return;
  await page.exposeFunction('__reactAbort', () => {
    if (currentAbort) currentAbort.abort();
  });
  abortSinkExposed = true;
}

async function abortCurrentReactFetch(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = globalThis as unknown as Record<string, unknown>;
    const ac = w['__reactAC'] as AbortController | undefined;
    ac?.abort();
  });
}

interface FetchReactionsOptions {
  onProgress?: (p: ReactProgress) => void;
  limit?: number;
  startCursor?: string | null;
}

async function fetchReactionsInPage(
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
      // ponytail: skip downloadCSV in reaction-export.js — interference với page.evaluate return
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

// ─── step functions (orchestration helpers) ──────────────────────────────────

async function persistReactorBatch(
  db: DbOrTx,
  platformId: string,
  reactors: Reactor[],
  postId: string,
): Promise<number> {
  if (reactors.length === 0) return 0;
  const rows: { id: string; accountId: string; postId: string }[] = [];
  for (const r of reactors) {
    const uid = r['User Id'] || r.uid;
    if (!uid) continue;
    const accountId = await upsertReactorAccount(db, {
      platformUserId: uid,
      platformId,
    });
    rows.push({ id: crypto.randomUUID(), accountId, postId });
  }
  if (rows.length > 0) await insertPostReactsBulk(db, rows);
  return rows.length;
}

interface FetchOutcome {
  needsRotate: boolean;
  pendingRotation: ScraperAccount | null;
  sessionDead: boolean;
  reactFailed: boolean;
  reactors: number;
  finalCursor: string | null;
}

async function fetchAndPersist(
  db: DbOrTx,
  page: Page,
  platformId: string,
  jobId: string,
  postId: string,
  feedbackTargetId: string,
  startCursor: string | null,
  rotator: RobinRotator,
  onProgress: ((count: number) => void) | undefined,
): Promise<FetchOutcome> {
  let needsRotate = false;
  let sessionDead = false;
  let reactFailed = false;
  let pendingRotation: ScraperAccount | null = null;
  let cursor: string | null = startCursor;
  let inserted = 0;

  try {
    await fetchReactionsInPage(page, feedbackTargetId, {
      limit: REACT_LIMIT,
      startCursor,
      onProgress: async (p) => {
        if (p.cursor !== undefined && p.cursor !== null) {
          cursor = p.cursor;
          await saveJobCursor(db, jobId, p.cursor);
        }
        if (p.pageReactors?.length) {
          const n = await persistReactorBatch(db, platformId, p.pageReactors, postId);
          inserted += n;
          rotator.record(n);
          onProgress?.(inserted);
        }
        const decision = await rotator.decide();
        if (decision.shouldRotate && decision.nextAccount) {
          needsRotate = true;
          pendingRotation = decision.nextAccount;
          await abortCurrentReactFetch(page).catch(() => undefined);
        }
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (isSessionDeadMessage(msg)) sessionDead = true;
    else if (!(e instanceof Error && e.name === 'AbortError')) {
      reactFailed = true;
      console.error(`[fb-react] fetch fail: ${msg}`);
    }
  }
  return {
    needsRotate,
    pendingRotation,
    sessionDead,
    reactFailed,
    reactors: inserted,
    finalCursor: cursor,
  };
}

// ─── main entry point ────────────────────────────────────────────────────────

export async function crawlFbReacts(input: ReactCrawlInput): Promise<ReactCrawlResult> {
  const { db, jobId, postId, postUrl, startCursor, cookieId, onProgress } = input;

  const initialAccount = await loadScraperAccountByCookieId(db, cookieId);
  if (!initialAccount) throw new Error(`cookie ${cookieId} not found`);

  const rotator = new RobinRotator(db, PLATFORM_ID, { rotateEveryN: ROTATE_EVERY_N });
  await rotator.bind(initialAccount);

  const fbPostId = extractFbPostId(postUrl);
  const feedbackTargetId = toFeedbackTargetID(fbPostId);
  console.warn(`[fb-react] post ${postId} → fbPostId=${fbPostId}`);

  let context: BrowserContext | null = null;
  let currentAccount: ScraperAccount = initialAccount;
  let rotations = 0;
  let totalReactors = 0;
  let lastCursor: string | null = startCursor;

  try {
    context = await openValidatedContext(currentAccount);

    // ponytail: loop is serial on purpose — each iteration holds 1 context for the current
    // account; rotation swaps context. Parallelizing would multiply cookie-isolated contexts
    // (and browserless sessions) without a win at concurrency=1.
    for (;;) {
      const page = await context.newPage();
      try {
        await injectReactionScript(page);
        const opened = Date.now();
        await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });
        console.warn(`[fb-react] post ${postId} opened in ${Date.now() - opened}ms`);

        const result = await fetchAndPersist(
          db,
          page,
          PLATFORM_ID,
          jobId,
          postId,
          feedbackTargetId,
          lastCursor,
          rotator,
          onProgress,
        );
        totalReactors += result.reactors;
        lastCursor = result.finalCursor;

        if (!result.needsRotate && !result.sessionDead && !result.reactFailed) {
          return { reactors: totalReactors, finalCursor: lastCursor };
        }
        if (result.sessionDead) {
          await markCookieDead(db, currentAccount.cookie.id, 'session dead mid-crawl');
        }
        if (rotations >= MAX_ROTATIONS_PER_POST) {
          if (result.sessionDead || result.reactFailed) {
            throw new Error(`quá nhiều rotations (${rotations}) trên post ${postId}`);
          }
          console.warn(`[fb-react] đạt max rotations/post (${rotations}) — done anyway`);
          return { reactors: totalReactors, finalCursor: lastCursor };
        }
        if (!result.pendingRotation) {
          if (result.sessionDead) {
            throw new Error(`session dead + hết account active cho platform ${PLATFORM_ID}`);
          }
          if (result.reactFailed) {
            throw new Error('react failed + hết account active');
          }
          console.warn('[fb-react] threshold reached nhưng không có account khác — done');
          return { reactors: totalReactors, finalCursor: lastCursor };
        }
        await context.close().catch(() => undefined);
        rotations++;
        currentAccount = result.pendingRotation;
        await rotator.applySwap(currentAccount);
        context = await openValidatedContext(currentAccount);
      } finally {
        await page.close().catch(() => undefined);
      }
    }
  } finally {
    resetReactionScriptState();
    if (context) await context.close().catch(() => undefined);
  }
}

// ─── adapter registration ────────────────────────────────────────────────────

export const facebookReactAdapter: PostReactCrawlAdapter = {
  platform: PLATFORM_ID,
  crawlReacts: crawlFbReacts,
};
