import { type BrowserContext } from 'playwright-core';

import { refreshViaBrowser } from './_shared';
import type { CookieRefreshAdapter } from './types';

const FB_HOME = 'https://www.facebook.com/';
const FB_COOKIE_DOMAIN = '.facebook.com';

async function isFacebookLoggedIn(context: BrowserContext): Promise<boolean> {
  const pages = context.pages();
  const page = pages[0];
  if (!page) return false;
  const url = page.url();
  if (/\/login|checkpoint\//.test(url)) return false;
  const cookies = await context.cookies(FB_HOME);
  const names = new Set(cookies.map((c: { name: string }) => c.name));
  return names.has('c_user') && names.has('xs');
}

export const facebookAdapter: CookieRefreshAdapter = {
  platform: 'facebook',
  async refresh(cookieHeader: string): Promise<string> {
    return refreshViaBrowser({
      cookieHeader,
      domain: FB_COOKIE_DOMAIN,
      url: FB_HOME,
      isLoggedInCheck: isFacebookLoggedIn,
    });
  },
};
