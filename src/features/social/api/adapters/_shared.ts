import { parse, serialize } from 'cookie';
import { type BrowserContext, type Cookie as PlaywrightCookie } from 'playwright-core';

import { withBrowserContext } from '@/browser';

export function parseCookieHeader(header: string, domain: string): PlaywrightCookie[] {
  const parsed = parse(header);
  return Object.entries(parsed)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([name, value]) => ({
      name,
      value,
      domain,
      path: '/',
      expires: -1,
      httpOnly: false,
      secure: true,
      sameSite: 'None' as const,
    }));
}

export function serializeCookies(cookies: PlaywrightCookie[]): string {
  return cookies.map((c) => serialize(c.name, c.value)).join('; ');
}

export interface RefreshViaBrowserOptions {
  cookieHeader: string;
  domain: string;
  url: string;
  isLoggedInCheck: (context: BrowserContext) => Promise<boolean>;
  timeoutMs?: number;
  settleMs?: number;
}

export async function refreshViaBrowser(opts: RefreshViaBrowserOptions): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const settleMs = opts.settleMs ?? 2_000;
  return withBrowserContext(async (context) => {
    const playwrightCookies = parseCookieHeader(opts.cookieHeader, opts.domain);
    if (playwrightCookies.length === 0) {
      throw new Error('No cookies parsed from header');
    }
    await context.addCookies(playwrightCookies);

    const page = await context.newPage();
    try {
      page.setDefaultTimeout(timeoutMs);
      await page.goto(opts.url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await page.reload({ waitUntil: 'networkidle', timeout: timeoutMs }).catch(() => undefined);
      await page.waitForTimeout(settleMs);

      const stillLoggedIn = await opts.isLoggedInCheck(context);
      if (!stillLoggedIn) {
        throw new Error('Session expired: login wall detected');
      }

      const fresh = await context.cookies(opts.url);
      if (fresh.length === 0) {
        throw new Error('No cookies returned by browser after refresh');
      }
      return serializeCookies(fresh);
    } finally {
      await page.close().catch(() => undefined);
    }
  });
}
