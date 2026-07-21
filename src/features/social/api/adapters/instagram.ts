import type { CookieRefreshAdapter } from './types';

export const instagramAdapter: CookieRefreshAdapter = {
  platform: 'instagram',
  refresh: () => Promise.reject(new Error('NOT_IMPLEMENTED: instagram adapter phase 2')),
};
