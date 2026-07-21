import type { CookieRefreshAdapter } from './types';

export const tiktokAdapter: CookieRefreshAdapter = {
  platform: 'tiktok',
  refresh: () => Promise.reject(new Error('NOT_IMPLEMENTED: tiktok adapter phase 2')),
};
