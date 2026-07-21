import type { DbOrTx } from '@/db';

import { findCookieRefreshAdapter } from '../adapters/registry';
import { getCookieById, markCookieDead, updateCookie } from '../queries';
import type { Cookie } from '../schema';

export interface RefreshCookieResult {
  cookieId: string;
  status: 'refreshed' | 'dead';
}

export async function refreshCookie(
  db: DbOrTx,
  cookie: Cookie,
  platformId: string,
): Promise<RefreshCookieResult> {
  const adapter = findCookieRefreshAdapter(platformId);
  try {
    const newCookie = await adapter.refresh(cookie.cookie);
    await updateCookie(db, cookie.id, {
      cookie: newCookie,
      lastRefreshedAt: new Date(),
    });
    return { cookieId: cookie.id, status: 'refreshed' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markCookieDead(db, cookie.id, message);
    return { cookieId: cookie.id, status: 'dead' };
  }
}

export async function refreshCookieById(
  db: DbOrTx,
  cookieId: string,
  platformId: string,
): Promise<RefreshCookieResult | null> {
  const cookie = await getCookieById(db, cookieId);
  if (!cookie) return null;
  if (cookie.status === 'dead') return { cookieId: cookie.id, status: 'dead' };
  return refreshCookie(db, cookie, platformId);
}
