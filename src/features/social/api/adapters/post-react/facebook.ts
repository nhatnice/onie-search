import { type BrowserContext, type Page } from 'playwright-core';

import type { DbOrTx } from '@/db';

import {
  insertPostReactsBulk,
  loadScraperAccountByCookieId,
  markCookieDead,
  saveJobCursor,
  upsertReactorAccount,
  type ScraperAccount,
} from '../../queries';
import { RobinRotator } from '../rotation';
import {
  abortCurrentReactFetch,
  extractFbPostId,
  fetchReactionsInPage,
  injectReactionScript,
  isSessionDeadMessage,
  MAX_ROTATIONS_PER_POST,
  openValidatedContext,
  PLATFORM_ID,
  REACT_LIMIT,
  resetReactionScriptState,
  ROTATE_EVERY_N,
  toFeedbackTargetID,
} from './facebook-helpers';
import type { PostReactCrawlAdapter, ReactCrawlInput, ReactCrawlResult, Reactor } from './types';

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
    const accountId = await upsertReactorAccount(db, { platformUserId: uid, platformId });
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

interface CrawlContextState {
  context: BrowserContext;
  currentAccount: ScraperAccount;
  rotations: number;
  totalReactors: number;
  lastCursor: string | null;
}

async function executeCrawlPageIteration(
  input: ReactCrawlInput,
  feedbackTargetId: string,
  rotator: RobinRotator,
  state: CrawlContextState,
): Promise<{ done: boolean; result?: ReactCrawlResult }> {
  const { db, jobId, postId, postUrl, onProgress } = input;
  const page = await state.context.newPage();

  try {
    await injectReactionScript(page);
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 });

    const outcome = await fetchAndPersist(
      db,
      page,
      PLATFORM_ID,
      jobId,
      postId,
      feedbackTargetId,
      state.lastCursor,
      rotator,
      onProgress,
    );
    state.totalReactors += outcome.reactors;
    state.lastCursor = outcome.finalCursor;

    if (!outcome.needsRotate && !outcome.sessionDead && !outcome.reactFailed) {
      return {
        done: true,
        result: { reactors: state.totalReactors, finalCursor: state.lastCursor },
      };
    }
    if (outcome.sessionDead) {
      await markCookieDead(db, state.currentAccount.cookie.id, 'session dead mid-crawl');
    }
    if (state.rotations >= MAX_ROTATIONS_PER_POST) {
      if (outcome.sessionDead || outcome.reactFailed) {
        throw new Error(`quá nhiều rotations (${state.rotations}) trên post ${postId}`);
      }
      return {
        done: true,
        result: { reactors: state.totalReactors, finalCursor: state.lastCursor },
      };
    }
    if (!outcome.pendingRotation) {
      if (outcome.sessionDead)
        throw new Error(`session dead + hết account active cho platform ${PLATFORM_ID}`);
      if (outcome.reactFailed) throw new Error('react failed + hết account active');
      return {
        done: true,
        result: { reactors: state.totalReactors, finalCursor: state.lastCursor },
      };
    }

    await state.context.close().catch(() => undefined);
    state.rotations++;
    state.currentAccount = outcome.pendingRotation;
    await rotator.applySwap(state.currentAccount);
    state.context = await openValidatedContext(state.currentAccount);
    return { done: false };
  } finally {
    await page.close().catch(() => undefined);
  }
}

export async function crawlFbReacts(input: ReactCrawlInput): Promise<ReactCrawlResult> {
  const { db, postUrl, startCursor, cookieId } = input;
  const initialAccount = await loadScraperAccountByCookieId(db, cookieId);
  if (!initialAccount) throw new Error(`cookie ${cookieId} not found`);

  const rotator = new RobinRotator(db, PLATFORM_ID, { rotateEveryN: ROTATE_EVERY_N });
  await rotator.bind(initialAccount);

  const fbPostId = extractFbPostId(postUrl);
  const feedbackTargetId = toFeedbackTargetID(fbPostId);
  const state: CrawlContextState = {
    context: await openValidatedContext(initialAccount),
    currentAccount: initialAccount,
    rotations: 0,
    totalReactors: 0,
    lastCursor: startCursor,
  };

  try {
    for (;;) {
      const step = await executeCrawlPageIteration(input, feedbackTargetId, rotator, state);
      if (step.done && step.result) return step.result;
    }
  } finally {
    resetReactionScriptState();
    await state.context.close().catch(() => undefined);
  }
}

export const facebookReactAdapter: PostReactCrawlAdapter = {
  platform: PLATFORM_ID,
  crawlReacts: crawlFbReacts,
};
