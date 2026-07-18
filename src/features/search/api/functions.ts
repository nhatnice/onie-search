import { createServerFn } from '@tanstack/react-start';

import { searchExa } from './services/search-service';

export const $searchExa = createServerFn({ method: 'GET' })
  .validator((data: { query: string; isDemo?: boolean }) => data)
  .handler(async ({ data }) => {
    // eslint-disable-next-line no-console
    console.log(
      `[Server Search] Khởi chạy tìm kiếm với từ khóa: "${data.query}" (isDemo: ${!!data.isDemo})`,
    );
    const results = await searchExa(data.query, data.isDemo);
    // eslint-disable-next-line no-console
    console.log('[Server Search] Dữ liệu trả về từ Exa API:', JSON.stringify(results, null, 2));
    return results;
  });
