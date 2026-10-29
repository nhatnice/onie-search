import * as stylex from '@stylexjs/stylex';

import type { AnalysisSection, SectionContentItem } from '../../api/services/search-service';
import { AnalysisSectionItem, type VoteState } from './AnalysisSectionItem';
import { analysisStyles } from './styles/analysis.styles';
import { layoutStyles } from './styles/layout.styles';

interface AnalysisSectionListProps {
  sections: AnalysisSection[] | undefined;
  activeTabs: Record<string, number>;
  sourceOrder: Record<string, number[]>;
  votes: Record<string, VoteState>;
  getVoteInitialState: (key: string) => VoteState;
  onTabChange: (sectionKey: string, index: number) => void;
  onOpenDrawer: (contentItem: SectionContentItem) => void;
  onVote: (key: string, voteType: 'up' | 'down') => void;
  onSearchQuestion: (question: string) => void;
}

export function AnalysisSectionList({
  sections,
  activeTabs,
  sourceOrder,
  votes,
  getVoteInitialState,
  onTabChange,
  onOpenDrawer,
  onVote,
  onSearchQuestion,
}: AnalysisSectionListProps) {
  if (!sections || sections.length === 0) {
    return <div {...stylex.props(layoutStyles.noResults)}>Không tìm thấy phân tích của AI.</div>;
  }

  return (
    <div {...stylex.props(analysisStyles.aiAnalysisSingleCard)}>
      {sections.map((section, sectionIdx) => {
        const sectionKey = `${section.type}-${sectionIdx}`;
        const activeIdx = activeTabs[sectionKey] || 0;
        const voteKey = `${sectionKey}-${activeIdx}`;
        const currentVote = votes[voteKey] || getVoteInitialState(voteKey);
        const order = sourceOrder[sectionKey] ?? section.contents.map((_, i) => i);

        return (
          <AnalysisSectionItem
            key={sectionKey}
            section={section}
            sectionIdx={sectionIdx}
            activeIdx={activeIdx}
            vote={currentVote}
            sourceOrder={order}
            onTabChange={onTabChange}
            onOpenDrawer={onOpenDrawer}
            onVote={onVote}
            onSearchQuestion={onSearchQuestion}
          />
        );
      })}
    </div>
  );
}
