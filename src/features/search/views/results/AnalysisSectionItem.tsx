import { Button, Markdown, ToggleButton } from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';
import {
  CalendarIcon,
  ExternalLinkIcon,
  MessageCircleQuestionMarkIcon,
  ShieldCheckIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserIcon,
} from 'lucide-react';

import type { AnalysisSection, SectionContentItem } from '../../api/services/search-service';
import { HiddenSourcesDropdown } from './HiddenSourcesDropdown';
import { randomPastDate, randomReliability, resolveFavicon } from './markdown-helpers';
import { SearchChart } from './SearchChart';
import { analysisStyles } from './styles/analysis.styles';

export interface VoteState {
  score: number;
  userVote: 'up' | 'down' | null;
}

interface SourceToggleGroupProps {
  contents: SectionContentItem[];
  order: number[];
  activeIdx: number;
  sectionKey: string;
  onTabChange: (sectionKey: string, index: number) => void;
}

function SourceToggleGroup({
  contents,
  order,
  activeIdx,
  sectionKey,
  onTabChange,
}: SourceToggleGroupProps) {
  const visible = order.slice(0, 3);
  const hidden = order.slice(3);

  return (
    <div {...stylex.props(analysisStyles.sourceToggleGroupWrapper)}>
      {visible.map((idx) => {
        const item = contents[idx];
        const isActive = idx === activeIdx;
        const faviconUrl = item.source.favicon || resolveFavicon(item.source.url);
        return (
          <button
            key={item.source.url + '-' + idx}
            type="button"
            onClick={() => onTabChange(sectionKey, idx)}
            {...stylex.props(
              analysisStyles.sourceToggleButton,
              isActive && analysisStyles.sourceToggleButtonActive,
            )}
          >
            <img
              src={faviconUrl}
              alt=""
              {...stylex.props(analysisStyles.sourceToggleFavicon)}
              onError={(e) => {
                e.currentTarget.src = 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
              }}
            />
            <span>{item.source.author || new URL(item.source.url).hostname}</span>
          </button>
        );
      })}
      <HiddenSourcesDropdown
        hidden={hidden}
        contents={contents}
        sectionKey={sectionKey}
        onTabChange={onTabChange}
      />
    </div>
  );
}

function SourceMetaInfo({ source }: { source: SectionContentItem['source'] }) {
  return (
    <div {...stylex.props(analysisStyles.sourceMeta)}>
      {source.publishedDate && (
        <>
          <CalendarIcon size={12} />
          <span>Xuất bản: {new Date(source.publishedDate).toLocaleDateString()}</span>
          <span>&bull;</span>
        </>
      )}
      {source.url && (
        <>
          <UserIcon size={12} />
          <span>Tác giả: {source.author}</span>
        </>
      )}
    </div>
  );
}

function FollowUpQuestionsList({
  questions,
  onSearch,
}: {
  questions: string[];
  onSearch: (q: string) => void;
}) {
  return (
    <div {...stylex.props(analysisStyles.followUpContainer)}>
      <span {...stylex.props(analysisStyles.followUpTitle)}>Câu hỏi gợi ý</span>
      <div {...stylex.props(analysisStyles.followUpList)}>
        {questions.map((q) => (
          <Button
            key={q}
            variant="secondary"
            label={q}
            icon={<MessageCircleQuestionMarkIcon size={16} />}
            onClick={() => onSearch(q)}
            xstyle={analysisStyles.followUpButton}
          />
        ))}
      </div>
    </div>
  );
}

function CardFooter({
  vote,
  voteKey,
  onVote,
  onOpenDrawer,
  content,
}: {
  vote: VoteState;
  voteKey: string;
  onVote: (key: string, voteType: 'up' | 'down') => void;
  onOpenDrawer: (content: SectionContentItem) => void;
  content: SectionContentItem;
}) {
  return (
    <div {...stylex.props(analysisStyles.sectionFooter)}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        <ToggleButton
          label="Hữu ích"
          icon={<ThumbsUpIcon size={14} />}
          pressedIcon={<ThumbsUpIcon size={14} style={{ color: '#0066cc' }} />}
          isPressed={vote.userVote === 'up'}
          onPressedChange={() => onVote(voteKey, 'up')}
        />
        <ToggleButton
          label="Không hữu ích"
          icon={<ThumbsDownIcon size={14} />}
          pressedIcon={<ThumbsDownIcon size={14} style={{ color: '#ff3b30' }} />}
          isPressed={vote.userVote === 'down'}
          onPressedChange={() => onVote(voteKey, 'down')}
          isIconOnly
        />
      </div>

      <button
        type="button"
        onClick={() => onOpenDrawer(content)}
        {...stylex.props(analysisStyles.viewOriginalButton)}
      >
        <ExternalLinkIcon size={14} />
        Xem nội dung gốc
      </button>
    </div>
  );
}

interface AnalysisSectionItemProps {
  section: AnalysisSection;
  sectionIdx: number;
  activeIdx: number;
  vote: VoteState;
  sourceOrder: number[];
  onTabChange: (sectionKey: string, index: number) => void;
  onOpenDrawer: (contentItem: SectionContentItem) => void;
  onVote: (key: string, voteType: 'up' | 'down') => void;
  onSearchQuestion: (question: string) => void;
}

export function AnalysisSectionItem({
  section,
  sectionIdx,
  activeIdx,
  vote,
  sourceOrder,
  onTabChange,
  onOpenDrawer,
  onVote,
  onSearchQuestion,
}: AnalysisSectionItemProps) {
  const sectionKey = `${section.type}-${sectionIdx}`;
  const currentContent = section.contents[activeIdx] || section.contents[0];
  const voteKey = `${sectionKey}-${activeIdx}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {sectionIdx > 0 && <hr {...stylex.props(analysisStyles.sectionDivider)} />}

      <section style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h2 {...stylex.props(analysisStyles.sectionTitle)}>{section.title}</h2>

        <div {...stylex.props(analysisStyles.sectionInfo)}>
          <span {...stylex.props(analysisStyles.sectionInfoText)}>
            Cập nhật: {randomPastDate()} &bull; {section.contents.length} nguồn
          </span>
          <span {...stylex.props(analysisStyles.reliabilityBadge)}>
            <ShieldCheckIcon size={12} /> Độ tin cậy {randomReliability()}/5
          </span>
        </div>

        <SourceToggleGroup
          contents={section.contents}
          order={sourceOrder}
          activeIdx={activeIdx}
          sectionKey={sectionKey}
          onTabChange={onTabChange}
        />

        <div {...stylex.props(analysisStyles.activeTabPanel)}>
          <SourceMetaInfo source={currentContent.source} />

          <div {...stylex.props(analysisStyles.markdownContainer)}>
            <Markdown>{currentContent.content}</Markdown>
          </div>

          {currentContent.chart && (
            <div {...stylex.props(analysisStyles.chartContainer)}>
              <h4 {...stylex.props(analysisStyles.chartTitle)}>
                Biểu đồ trực quan ({currentContent.chart.type})
              </h4>
              <SearchChart chart={currentContent.chart} />
            </div>
          )}

          <CardFooter
            vote={vote}
            voteKey={voteKey}
            onVote={onVote}
            onOpenDrawer={onOpenDrawer}
            content={currentContent}
          />

          {section.followUpQuestions && section.followUpQuestions.length > 0 && (
            <FollowUpQuestionsList
              questions={section.followUpQuestions}
              onSearch={onSearchQuestion}
            />
          )}
        </div>
      </section>
    </div>
  );
}
