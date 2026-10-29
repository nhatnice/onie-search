import { useState } from 'react';

import type { SectionContentItem, SearchResponseData } from '../../api/services/search-service';
import type { VoteState } from './AnalysisSectionItem';
import type { DrawerData } from './SourceDetailDialog';

function getVoteInitialState(key: string): VoteState {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return { score: Math.abs(hash % 25) + 10, userVote: null };
}

function calculateVoteChange(current: VoteState, voteType: 'up' | 'down'): VoteState {
  let newScore = current.score;
  let newVote: 'up' | 'down' | null = null;

  if (voteType === 'up') {
    if (current.userVote === 'up') {
      newScore -= 1;
    } else {
      newScore += current.userVote === 'down' ? 2 : 1;
      newVote = 'up';
    }
  } else {
    if (current.userVote === 'down') {
      newScore += 1;
    } else {
      newScore -= current.userVote === 'up' ? 2 : 1;
      newVote = 'down';
    }
  }
  return { score: newScore, userVote: newVote };
}

export function useResultsState(results: SearchResponseData | null) {
  const [activeTabs, setActiveTabs] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<DrawerData | null>(null);
  const [votes, setVotes] = useState<Record<string, VoteState>>({});
  const [sourceOrder, setSourceOrder] = useState<Record<string, number[]>>({});

  const handleTabChange = (sectionKey: string, index: number) => {
    setActiveTabs((prev) => ({ ...prev, [sectionKey]: index }));
    setSourceOrder((prev) => {
      const order = prev[sectionKey];
      if (!order) return prev;
      return { ...prev, [sectionKey]: [index, ...order.filter((i) => i !== index)] };
    });
  };

  const handleOpenDrawer = (contentItem: SectionContentItem) => {
    const matched = results?.results?.find(
      (r) => r.id === contentItem.source.id || r.url === contentItem.source.url,
    );
    setDrawerData({
      author: contentItem.source.author,
      favicon: contentItem.source.favicon || '',
      title: matched?.title || contentItem.source.author || 'Nguồn gốc',
      url: contentItem.source.url || '',
      content: contentItem.content,
      fullText: matched?.text || contentItem.content,
    });
    setDrawerOpen(true);
  };

  const handleVote = (key: string, voteType: 'up' | 'down') => {
    setVotes((prev) => ({
      ...prev,
      [key]: calculateVoteChange(prev[key] || getVoteInitialState(key), voteType),
    }));
  };

  return {
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
  };
}
