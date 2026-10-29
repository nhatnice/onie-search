import * as stylex from '@stylexjs/stylex';
import { useLoaderData, useNavigate } from '@tanstack/react-router';
import { type FormEvent, useEffect, useState } from 'react';

import { AnalysisSectionList } from './results/AnalysisSectionList';
import { GoogleResultsList } from './results/GoogleResultsList';
import { LoadingSkeleton } from './results/LoadingSkeleton';
import { ResultsHeader } from './results/ResultsHeader';
import { SourceDetailDialog } from './results/SourceDetailDialog';
import { layoutStyles } from './results/styles/layout.styles';
import { useResultsState } from './results/use-results-state';
import { useSearchResults } from './results/use-search-results';

export function ResultsView() {
  const navigate = useNavigate();
  const { caseNum, q } = useLoaderData({ from: '/search' });
  const { results, loading, error } = useSearchResults(q, caseNum);
  const [newQuery, setNewQuery] = useState(q || '');

  const {
    activeTabs,
    drawerOpen,
    drawerData,
    votes,
    sourceOrder,
    setDrawerOpen,
    handleTabChange,
    handleOpenDrawer,
    handleVote,
    getVoteInitialState,
  } = useResultsState(results);

  useEffect(() => {
    setNewQuery(q || '');
  }, [q]);

  useEffect(() => {
    if (!drawerOpen) return;
    const timer = setTimeout(() => {
      document
        .getElementById('highlight-target')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 300);
    return () => clearTimeout(timer);
  }, [drawerOpen, drawerData]);

  const handleNewSearch = (e: FormEvent) => {
    e.preventDefault();
    if (newQuery.trim()) void navigate({ to: '/search', search: { q: newQuery.trim() } });
  };

  return (
    <main
      style={{ minHeight: '100vh', backgroundColor: '#f5f5f7' }}
      {...stylex.props(layoutStyles.page)}
    >
      <ResultsHeader query={newQuery} onQueryChange={setNewQuery} onSubmit={handleNewSearch} />
      <div {...stylex.props(layoutStyles.contentWrapper)}>
        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <div {...stylex.props(layoutStyles.errorContainer)}>
            Có lỗi xảy ra khi tải kết quả tìm kiếm. Vui lòng thử lại sau.
          </div>
        ) : (
          <div {...stylex.props(layoutStyles.mainContent)}>
            {caseNum && (
              <div {...stylex.props(layoutStyles.infoAlert)}>
                <div>
                  Đang xem Demo <strong>Case #{caseNum}</strong>: &ldquo;{q}&rdquo;. Sử dụng dữ liệu
                  giả lập trực quan hóa cao cấp (Apple & Reddit Style).
                </div>
              </div>
            )}
            <AnalysisSectionList
              sections={results?.analysis?.data}
              activeTabs={activeTabs}
              sourceOrder={sourceOrder}
              votes={votes}
              getVoteInitialState={getVoteInitialState}
              onTabChange={handleTabChange}
              onOpenDrawer={handleOpenDrawer}
              onVote={handleVote}
              onSearchQuestion={(question) =>
                void navigate({ to: '/search', search: { q: question.trim() } })
              }
            />
            <GoogleResultsList results={results?.results} />
          </div>
        )}
      </div>
      <SourceDetailDialog isOpen={drawerOpen} onOpenChange={setDrawerOpen} data={drawerData} />
    </main>
  );
}
