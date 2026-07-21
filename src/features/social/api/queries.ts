import { and, asc, eq, isNull, lt, or } from 'drizzle-orm';

import type { DbOrTx } from '@/db';

import {
  accounts,
  cookies,
  type Account,
  type Cookie,
  type NewAccount,
  type NewCookie,
} from './schema';

const ONE_HOUR_MS = 60 * 60 * 1000;

function cookieNotDeleted() {
  return isNull(cookies.deletedAt);
}

function accountNotDeleted() {
  return isNull(accounts.deletedAt);
}

export async function insertAccount(db: DbOrTx, input: NewAccount): Promise<void> {
  await db.insert(accounts).values(input).onConflictDoNothing();
}

export async function getAccount(db: DbOrTx, id: string): Promise<Account | null> {
  const rows = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), accountNotDeleted()))
    .limit(1);
  return rows[0] ?? null;
}

export async function insertCookie(db: DbOrTx, input: NewCookie): Promise<void> {
  await db.insert(cookies).values(input).onConflictDoNothing();
}

export interface CookieWithPlatform extends Cookie {
  platformId: string;
}

export async function getCookieById(db: DbOrTx, id: string): Promise<Cookie | null> {
  const rows = await db
    .select()
    .from(cookies)
    .where(and(eq(cookies.id, id), cookieNotDeleted()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCookieByIdWithPlatform(
  db: DbOrTx,
  id: string,
): Promise<CookieWithPlatform | null> {
  const rows = await db
    .select({
      id: cookies.id,
      accountId: cookies.accountId,
      cookie: cookies.cookie,
      status: cookies.status,
      error: cookies.error,
      lastRefreshedAt: cookies.lastRefreshedAt,
      createdAt: cookies.createdAt,
      updatedAt: cookies.updatedAt,
      deletedAt: cookies.deletedAt,
      platformId: accounts.platformId,
    })
    .from(cookies)
    .innerJoin(accounts, eq(cookies.accountId, accounts.id))
    .where(and(eq(cookies.id, id), cookieNotDeleted(), accountNotDeleted()))
    .limit(1);
  return rows[0] ?? null;
}

export async function getCookiesToRefresh(
  db: DbOrTx,
  limit: number,
  now: Date = new Date(),
): Promise<CookieWithPlatform[]> {
  const threshold = new Date(now.getTime() - ONE_HOUR_MS);
  return db
    .select({
      id: cookies.id,
      accountId: cookies.accountId,
      cookie: cookies.cookie,
      status: cookies.status,
      error: cookies.error,
      lastRefreshedAt: cookies.lastRefreshedAt,
      createdAt: cookies.createdAt,
      updatedAt: cookies.updatedAt,
      deletedAt: cookies.deletedAt,
      platformId: accounts.platformId,
    })
    .from(cookies)
    .innerJoin(accounts, eq(cookies.accountId, accounts.id))
    .where(
      and(
        eq(cookies.status, 'active'),
        cookieNotDeleted(),
        accountNotDeleted(),
        or(isNull(cookies.lastRefreshedAt), lt(cookies.lastRefreshedAt, threshold)),
      ),
    )
    .orderBy(asc(cookies.lastRefreshedAt), asc(cookies.updatedAt))
    .limit(limit);
}

export async function touchCookie(db: DbOrTx, id: string): Promise<void> {
  await db.update(cookies).set({ updatedAt: new Date() }).where(eq(cookies.id, id));
}

export async function updateCookie(
  db: DbOrTx,
  id: string,
  patch: { cookie: string; lastRefreshedAt: Date },
): Promise<void> {
  const now = new Date();
  await db
    .update(cookies)
    .set({
      cookie: patch.cookie,
      lastRefreshedAt: patch.lastRefreshedAt,
      status: 'active',
      error: null,
      updatedAt: now,
    })
    .where(eq(cookies.id, id));
}

export async function markCookieDead(db: DbOrTx, id: string, error: string): Promise<void> {
  await db
    .update(cookies)
    .set({ status: 'dead', error, updatedAt: new Date() })
    .where(eq(cookies.id, id));
}
