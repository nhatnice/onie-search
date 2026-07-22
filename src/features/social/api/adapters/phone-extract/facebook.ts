import { env } from '@/lib/env';

import type { PhoneExtractAdapter } from './types';

export const facebookPhoneAdapter: PhoneExtractAdapter = {
  platform: 'facebook',
  async getPhone(uid: string): Promise<string> {
    const authCode = env.uidfbAuthCode;
    if (!authCode) throw new Error('UIDFB_AUTHCODE not set');

    const url = new URL('https://uidfb.com/api/Users2/getTel');
    url.searchParams.set('uid', uid);

    const data = (await fetch(url, {
      headers: { accept: 'application/json', authorization: authCode },
    }).then((r) => r.json())) as {
      status?: number;
      message?: { data?: { phone?: string } } | string;
    };

    if (data?.status === 200 || data?.status === 201) {
      const msg = data.message;
      if (msg && typeof msg === 'object') {
        const phone = msg.data?.phone;
        if (phone && phone !== 'Không tìm thấy') return phone;
        return '';
      }
    }
    return '';
  },
};
