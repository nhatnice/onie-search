import { chromium, type Browser, type BrowserContext } from 'playwright-core';

import { buildBrowserlessEndpoint } from './config';

let browser: Browser | undefined;
let launchPromise: Promise<Browser> | undefined;

export function getBrowser(): Promise<Browser> {
  if (browser) return Promise.resolve(browser);
  if (!launchPromise) {
    launchPromise = chromium.connectOverCDP(buildBrowserlessEndpoint()).then((b) => {
      browser = b;
      launchPromise = undefined;
      return b;
    });
  }
  return launchPromise;
}

export async function withBrowserContext<T>(
  fn: (context: BrowserContext) => Promise<T>,
): Promise<T> {
  const b = await getBrowser();
  const context = await b.newContext();
  try {
    return await fn(context);
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => undefined);
    browser = undefined;
  }
}
