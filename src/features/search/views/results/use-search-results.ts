import { useEffect, useState } from 'react';

import { $searchExa } from '../../api/functions';
import type { SearchResponseData } from '../../api/services/search-service';

function resolveSearchQuery(q?: string | null, caseNum?: string | null): string {
  if (caseNum) {
    const mockQueries: Record<string, string> = {
      '1': 'Thị trường kim cương',
      '2': 'Giá vàng biến động',
      '3': 'Dự báo công nghệ AI',
    };
    return mockQueries[caseNum] || 'Tìm kiếm';
  }
  return q || '';
}

export function useSearchResults(q?: string | null, caseNum?: string | null) {
  const [results, setResults] = useState<SearchResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let isMounted = true;
    const searchQuery = resolveSearchQuery(q, caseNum);

    if (!searchQuery.trim()) {
      setResults(null);
      setLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setLoading(true);
    setError(null);

    const fetchData = async () => {
      try {
        const data = await $searchExa({
          data: { query: searchQuery, isDemo: !!caseNum },
        });
        if (isMounted) setResults(data);
      } catch (err) {
        console.error('[ResultsView] Error fetching search data:', err);
        if (isMounted) setError(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchData();
    return () => {
      isMounted = false;
    };
  }, [q, caseNum]);

  return { results, loading, error };
}
