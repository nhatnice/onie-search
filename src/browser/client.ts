import { chromium, type Browser, type BrowserContext } from 'playwright-core';

import { buildBrowserlessEndpoint } from './config';

let browser: Browser | undefined;
let launchPromise: Promise<Browser> | undefined;

function resetBrowser(): void {
  browser = undefined;
  launchPromise = undefined;
}

export function getBrowser(): Promise<Browser> {
  if (browser) return Promise.resolve(browser);
  if (!launchPromise) {
    launchPromise = chromium.connectOverCDP(buildBrowserlessEndpoint()).then((b) => {
      b.on('disconnected', () => resetBrowser());
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
  return runWithContext(fn, false);
}

async function runWithContext<T>(
  fn: (context: BrowserContext) => Promise<T>,
  isRetry: boolean,
): Promise<T> {
  const b = await getBrowser();
  const context = await b.newContext();
  try {
    return await fn(context);
  } catch (err) {
    if (isRetry || !isConnectionError(err)) throw err;
    await context.close().catch(() => undefined);
    resetBrowser();
    return runWithContext(fn, true);
  } finally {
    await context.close().catch(() => undefined);
  }
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close().catch(() => undefined);
    resetBrowser();
  }
}

export function isConnectionError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Target closed|Connection closed|WebSocket|disconnected|Browser has been closed/i.test(
    msg,
  );
}
