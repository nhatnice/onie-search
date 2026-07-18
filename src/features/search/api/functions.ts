import { createServerFn } from '@tanstack/react-start';

import { searchExa } from './services/search-service';

export const $searchExa = createServerFn({ method: 'GET' })
  .validator((query: string) => query)
  .handler(async ({ data: query }) => {
    // eslint-disable-next-line no-console
    console.log(`[Server Search] Khởi chạy tìm kiếm với từ khóa: "${query}"`);
    const results = await searchExa(query);
    // eslint-disable-next-line no-console
    console.log('[Server Search] Dữ liệu trả về từ Exa API:', JSON.stringify(results, null, 2));
    return results;
  });
