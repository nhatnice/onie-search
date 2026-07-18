import {
  Markdown,
  Dialog,
  Layout,
  LayoutContent,
  TextInput,
  Button,
  ToggleButton,
} from '@astryxdesign/core';
import * as stylex from '@stylexjs/stylex';
import { useLoaderData, useNavigate } from '@tanstack/react-router';
import {
  ArrowRightIcon,
  CalendarIcon,
  ExternalLinkIcon,
  SearchIcon,
  MessageCircleQuestionMarkIcon,
  ShieldCheckIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  UserIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import { $searchExa } from '../api/functions';
import type {
  SearchResponseData,
  ChartData,
  SectionContentItem,
} from '../api/services/search-service';

// ---------------------------------------------------------
// Helper: Resolve Domain Favicon
// ---------------------------------------------------------
function resolveFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

// ---------------------------------------------------------
// Helpers
// ---------------------------------------------------------
function randomPastDate(): string {
  const now = Date.now();
  const offset = Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000);
  return new Date(now - offset).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function randomReliability(): number {
  return Math.floor(Math.random() * 2) + 4; // 4 or 5
}

// ---------------------------------------------------------
// StyleX Animations
// ---------------------------------------------------------
const pulse = stylex.keyframes({
  '0%': { opacity: 0.6 },
  '50%': { opacity: 1 },
  '100%': { opacity: 0.6 },
});

const spin = stylex.keyframes({
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
});

// ---------------------------------------------------------
// StyleX Configuration
// ---------------------------------------------------------
const styles = stylex.create({
  page: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f7',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    paddingBottom: '4rem',
  },
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    backdropFilter: 'blur(20px)',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#d2d2d7',
    gap: '1.5rem',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  logoMini: {
    width: '36px',
    height: '36px',
    borderRadius: '8px',
    objectFit: 'cover',
  },
  logoTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#1d1d1f',
    letterSpacing: '-0.02em',
    margin: 0,
  },
  searchForm: {
    width: '100%',
    maxWidth: '800px',
    justifySelf: 'center',
    display: 'flex',
    gap: '0.5rem',
    alignItems: 'center',
  },
  searchBarWrapper: {
    flex: 1,
    position: 'relative',
  },
  searchBarInput: {
    width: '100%',
  },
  searchIconButton: {
    padding: '0.5rem',
  },

  contentWrapper: {
    display: 'flex',
    flexDirection: 'row',
    gap: '2rem',
    width: '100%',
    maxWidth: '1060px',
    margin: '2rem auto 0 auto',
    padding: '0 1.5rem',
    boxSizing: 'border-box',
  },
  infoAlert: {
    padding: '1rem 1.25rem',
    backgroundColor: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d2d2d7',
    borderRadius: '12px',
    fontSize: '0.875rem',
    lineHeight: '1.5',
    color: '#1d1d1f',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.02)',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    flex: 1,
    maxWidth: '800px',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    width: '260px',
    flexShrink: 0,
  },
  aiSectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    padding: '1.75rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  sectionTitle: {
    fontSize: '1.375rem',
    fontWeight: '700',
    color: '#1d1d1f',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  sourceTabContainer: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#f3f4f6',
    paddingBottom: '0.25rem',
  },
  activeTabPanel: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    minHeight: '120px',
  },
  sourceMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: '#86868b',
  },
  markdownContainer: {
    color: '#1d1d1f',
    lineHeight: '1.6',
    fontSize: '0.9375rem',
  },
  chartContainer: {
    backgroundColor: '#fbfbfd',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: '12px',
    padding: '1.25rem',
    marginTop: '0.75rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#86868b',
    marginBottom: '0.75rem',
    alignSelf: 'flex-start',
    letterSpacing: '0.02em',
  },
  sectionFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '0.5rem',
    marginTop: '0.25rem',
  },

  viewOriginalButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#0066cc',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    transition: 'background-color 150ms',
    ':hover': {
      backgroundColor: '#f0f6ff',
      textDecoration: 'underline',
    },
  },

  googleResultsContainer: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    padding: '1.75rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  googleTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#1d1d1f',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#f3f4f6',
    paddingBottom: '0.75rem',
    margin: 0,
  },
  googleList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  googleItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  googleItemHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.75rem',
    color: '#86868b',
  },
  googleItemFavicon: {
    width: '16px',
    height: '16px',
    borderRadius: '2px',
  },
  googleItemTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#0066cc',
    textDecoration: 'none',
    ':hover': {
      textDecoration: 'underline',
    },
  },
  googleItemSnippet: {
    fontSize: '0.875rem',
    color: '#424245',
    lineHeight: '1.5',
    margin: 0,
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  drawerLayoutContent: {
    overflowY: 'auto',
    maxHeight: 'calc(100vh - 76px)',
  },
  noResults: {
    textAlign: 'center',
    padding: '4rem 2rem',
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    color: '#86868b',
    fontSize: '1rem',
  },
  drawerCloseButton: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f7',
    color: '#86868b',
    transition: 'background-color 150ms',
    ':hover': {
      backgroundColor: '#e8e8ed',
    },
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2rem',
    width: '100%',
    padding: '2rem 0',
  },
  spinnerWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3rem 0',
    gap: '1rem',
  },
  spinnerText: {
    fontSize: '0.9375rem',
    color: '#86868b',
    fontWeight: '500',
  },
  skeletonCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    padding: '1.75rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.25rem',
  },
  skeletonTitle: {
    width: '30%',
    height: '24px',
    backgroundColor: '#e5e5e7',
    borderRadius: '6px',
    animationName: pulse,
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
  skeletonTabs: {
    display: 'flex',
    gap: '0.75rem',
  },
  skeletonTab: {
    width: '100px',
    height: '32px',
    backgroundColor: '#f5f5f7',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
  },
  skeletonTextLine: {
    height: '16px',
    backgroundColor: '#f5f5f7',
    borderRadius: '4px',
    animationName: pulse,
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
  skeletonTextLineShort: {
    width: '60%',
    height: '16px',
    backgroundColor: '#f5f5f7',
    borderRadius: '4px',
    animationName: pulse,
    animationDuration: '1.5s',
    animationIterationCount: 'infinite',
  },
  spinner: {
    animationName: spin,
    animationDuration: '1s',
    animationIterationCount: 'infinite',
    animationTimingFunction: 'linear',
    width: '48px',
    height: '48px',
  },
  errorContainer: {
    padding: '2rem',
    backgroundColor: '#fdf2f2',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#fde8e8',
    borderRadius: '12px',
    color: '#f05252',
    fontSize: '0.9375rem',
    textAlign: 'center',
  },
  aiAnalysisSingleCard: {
    backgroundColor: '#ffffff',
    borderRadius: '16px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    padding: '2rem',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2.5rem',
  },
  sectionDivider: {
    border: 'none',
    borderTopWidth: '1px',
    borderTopStyle: 'solid',
    borderTopColor: '#e5e7eb',
    margin: '0.75rem 0',
  },
  sourceToggleButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    borderRadius: '9999px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d2d2d7',
    backgroundColor: '#ffffff',
    color: '#1d1d1f',
    fontSize: '0.8125rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 150ms ease',
    ':hover': {
      backgroundColor: '#f5f5f7',
      borderColor: '#86868b',
    },
  },
  sourceToggleButtonActive: {
    backgroundColor: '#e8f2ff',
    borderColor: '#0066cc',
    color: '#0066cc',
    fontWeight: '600',
    boxShadow: '0 2px 8px rgba(0, 102, 204, 0.1)',
  },
  sourceToggleFavicon: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    objectFit: 'cover',
  },

  sectionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  sectionInfoText: {
    fontSize: '0.8125rem',
    color: '#86868b',
  },
  reliabilityBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.125rem 0.5rem',
    borderRadius: '9999px',
    backgroundColor: '#e8f5e9',
    color: '#2e7d32',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  sourceToggleGroupWrapper: {
    position: 'relative',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    width: '100%',
    maxWidth: '100%',
    margin: '0.5rem 0',
  },
  sourceMoreButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '9999px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#d2d2d7',
    backgroundColor: '#ffffff',
    color: '#86868b',
    fontSize: '0.8125rem',
    fontWeight: '500',
    cursor: 'pointer',
    position: 'relative',
  },
  sourcePopover: {
    display: 'none',
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: '0.25rem',
    padding: '0.5rem',
    backgroundColor: '#ffffff',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: '#e5e7eb',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    zIndex: 50,
    minWidth: '200px',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  sourcePopoverButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'transparent',
    color: '#1d1d1f',
    fontSize: '0.8125rem',
    fontWeight: '500',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    ':hover': {
      backgroundColor: '#f5f5f7',
    },
  },
  followUpContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
  },
  followUpList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  followUpButton: {
    whiteSpace: 'normal',
    height: 'auto',
    minHeight: '32px',
    justifyContent: 'flex-start',
    wordBreak: 'break-word',
    width: '100%',
  },
  followUpTitle: {
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: '#86868b',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },

  exploreButton: {
    justifyContent: 'flex-start',
    width: '100%',
    whiteSpace: 'normal',
    height: 'auto',
    minHeight: '32px',
    wordBreak: 'break-word',
  },
  clarityForm: {
    display: 'flex',
    gap: '0.75rem',
    width: '100%',
    alignItems: 'center',
  },
  segmentTitle: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: '#1d1d1f',
    margin: '0.25rem 0 0.5rem 0',
    lineHeight: '1.4',
    letterSpacing: '-0.01em',
  },
});

// ---------------------------------------------------------
// Helper: Text Highlighter
// ---------------------------------------------------------
function stripMarkdown(str: string): string {
  if (!str) return '';
  return str
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1');
}

function findWordSequenceIndex(
  text: string,
  words: string[],
  fromIndex = 0,
): { index: number; length: number } | null {
  if (words.length === 0) return null;
  const escapedWords = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const patternStr = escapedWords.join('.{0,40}?');
  try {
    const regex = new RegExp(patternStr, 'iu');
    const subText = text.substring(fromIndex);
    const match = regex.exec(subText);
    if (match) {
      return {
        index: fromIndex + match.index,
        length: match[0].length,
      };
    }
  } catch {
    // Fallback if regex fails
  }
  return null;
}

function getHighlightedMarkdown(fullText: string, searchSnippet: string): string {
  if (!fullText) return '';
  if (!searchSnippet) return fullText;

  const cleanSnippet = stripMarkdown(searchSnippet).trim();

  // Extract unicode words from the clean snippet
  const words = cleanSnippet
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  if (words.length === 0) return fullText;

  // For short snippets, search the entire sequence
  if (words.length <= 8) {
    const match = findWordSequenceIndex(fullText, words);
    if (match) {
      const before = fullText.substring(0, match.index);
      const matchedText = fullText.substring(match.index, match.index + match.length);
      const after = fullText.substring(match.index + match.length);
      return `${before}<mark id="highlight-target" class="highlighted">${matchedText}</mark>${after}`;
    }
  } else {
    // For longer snippets, search using start and end anchors
    const startWords = words.slice(0, 5);
    const endWords = words.slice(-5);

    const startMatch = findWordSequenceIndex(fullText, startWords);
    if (startMatch) {
      const endMatch = findWordSequenceIndex(
        fullText,
        endWords,
        startMatch.index + startMatch.length,
      );
      if (endMatch) {
        const matchEnd = endMatch.index + endMatch.length;
        const before = fullText.substring(0, startMatch.index);
        const matchedText = fullText.substring(startMatch.index, matchEnd);
        const after = fullText.substring(matchEnd);
        return `${before}<mark id="highlight-target" class="highlighted">${matchedText}</mark>${after}`;
      } else {
        const snippetLength = cleanSnippet.length;
        const matchEnd = Math.min(startMatch.index + snippetLength, fullText.length);
        const before = fullText.substring(0, startMatch.index);
        const matchedText = fullText.substring(startMatch.index, matchEnd);
        const after = fullText.substring(matchEnd);
        return `${before}<mark id="highlight-target" class="highlighted">${matchedText}</mark>${after}`;
      }
    }
  }

  // Fallback: search for first 40 chars literally
  const startShort = cleanSnippet.substring(0, 40).trim();
  const startIdx = fullText.indexOf(startShort);
  if (startIdx !== -1) {
    const endPos = Math.min(startIdx + cleanSnippet.length, fullText.length);
    const matchText = fullText.substring(startIdx, endPos);
    const before = fullText.substring(0, startIdx);
    const after = fullText.substring(endPos);
    return `${before}<mark id="highlight-target" class="highlighted">${matchText}</mark>${after}`;
  }

  return fullText;
}

const highlightPlugin = {
  pattern: /<mark id="highlight-target" class="highlighted">([\s\S]*?)<\/mark>/g,
  render: (match: RegExpMatchArray, key: string) => (
    <mark key={key} id="highlight-target" className="highlighted">
      {match[1]}
    </mark>
  ),
};

// ---------------------------------------------------------
// Component: Custom SVG Charts
// ---------------------------------------------------------
function cleanAndParseFloat(val: any): number {
  if (typeof val === 'number') return val;
  if (typeof val !== 'string') return 0;
  const cleaned = val.replace(/[^\d.,-]/g, '').replace(/,/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function SearchChart({ chart }: { chart: ChartData }) {
  const { type, data } = chart;
  if (!data || data.length === 0) return null;

  const sample = data[0];
  const keys = Object.keys(sample);
  let valueKey = '';
  let labelKey = '';

  for (const key of keys) {
    const val = sample[key];
    const parsed = cleanAndParseFloat(val);
    if (typeof val === 'number' || (typeof val === 'string' && !isNaN(parsed) && parsed !== 0)) {
      valueKey = key;
    } else {
      labelKey = key;
    }
  }

  if (!valueKey) valueKey = keys[1] || keys[0];
  if (!labelKey) labelKey = keys[0];

  const values = data.map((d) => cleanAndParseFloat(d[valueKey]));
  const labels = data.map((d) => String(d[labelKey] || ''));
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);

  const width = 500;
  const height = 200;
  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  if (type === 'bar') {
    const barWidth = (chartWidth / data.length) * 0.6;
    const barGap = (chartWidth / data.length) * 0.4;
    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', maxHeight: '220px' }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const val = Math.round(minVal + (maxVal - minVal) * ratio);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="3 3"
              />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#86868b">
                {val.toLocaleString()}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const val = Number(d[valueKey] || 0);
          const ratio = (val - minVal) / (maxVal - minVal);
          const barHeight = chartHeight * ratio;
          const x = paddingLeft + i * (barWidth + barGap) + barGap / 2;
          const y = paddingTop + chartHeight - barHeight;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barWidth} height={barHeight} fill="#0066cc" rx="4" />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill="#1d1d1f"
              >
                {val.toLocaleString()}
              </text>
              <text
                x={x + barWidth / 2}
                y={paddingTop + chartHeight + 16}
                textAnchor="middle"
                fontSize="10"
                fill="#86868b"
              >
                {labels[i]}
              </text>
            </g>
          );
        })}
      </svg>
    );
  }

  if (type === 'line') {
    const points = data.map((d, i) => {
      const val = Number(d[valueKey] || 0);
      const ratio = (val - minVal) / (maxVal - minVal);
      const x = paddingLeft + (i / (data.length - 1 || 1)) * chartWidth;
      const y = paddingTop + chartHeight - chartHeight * ratio;
      return { x, y, val, label: labels[i] };
    });

    const pathD = points.reduce((acc, p, i) => {
      return acc + (i === 0 ? `M ${p.x} ${p.y}` : ` L ${p.x} ${p.y}`);
    }, '');

    return (
      <svg
        viewBox={`0 0 ${width} ${height}`}
        style={{ width: '100%', height: 'auto', maxHeight: '220px' }}
      >
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const y = paddingTop + chartHeight * (1 - ratio);
          const val = Math.round(minVal + (maxVal - minVal) * ratio);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="#e5e7eb"
                strokeDasharray="3 3"
              />
              <text x={paddingLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#86868b">
                {val.toLocaleString()}
              </text>
            </g>
          );
        })}
        <path
          d={pathD}
          fill="none"
          stroke="#0066cc"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="5" fill="#0066cc" stroke="#ffffff" strokeWidth="2" />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="#1d1d1f"
            >
              {p.val.toLocaleString()}
            </text>
            <text
              x={p.x}
              y={paddingTop + chartHeight + 16}
              textAnchor="middle"
              fontSize="10"
              fill="#86868b"
              style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {p.label}
            </text>
          </g>
        ))}
      </svg>
    );
  }

  // Pie chart fallback
  const total = values.reduce((sum, val) => sum + val, 0);
  let startAngle = 0;
  const radius = 55;
  const cx = width / 2;
  const cy = height / 2 - 10;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 'auto', maxHeight: '220px' }}
    >
      {data.map((d, i) => {
        const val = Number(d[valueKey] || 0);
        const percentage = (val / (total || 1)) * 100;
        const angle = (val / (total || 1)) * 360;

        const x1 = cx + radius * Math.cos(((startAngle - 90) * Math.PI) / 180);
        const y1 = cy + radius * Math.sin(((startAngle - 90) * Math.PI) / 180);

        startAngle += angle;

        const x2 = cx + radius * Math.cos(((startAngle - 90) * Math.PI) / 180);
        const y2 = cy + radius * Math.sin(((startAngle - 90) * Math.PI) / 180);

        const largeArcFlag = angle > 180 ? 1 : 0;
        const pathData = `
          M ${cx} ${cy}
          L ${x1} ${y1}
          A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}
          Z
        `;

        const colors = ['#0066cc', '#34c759', '#ff9500', '#ff3b30', '#af52de'];
        const color = colors[i % colors.length];

        const labelAngle = startAngle - angle / 2 - 90;
        const lx = cx + (radius + 24) * Math.cos((labelAngle * Math.PI) / 180);
        const ly = cy + (radius + 12) * Math.sin((labelAngle * Math.PI) / 180);

        return (
          <g key={i}>
            <path d={pathData} fill={color} stroke="#ffffff" strokeWidth="2" />
            <text x={lx} y={ly} textAnchor="middle" fontSize="9" fontWeight="600" fill="#1d1d1f">
              {labels[i]} ({Math.round(percentage)}%)
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function getComposedQuery(originalQuery: string, newSelectionOrInput: string): string {
  const orig = originalQuery.trim();
  let next = newSelectionOrInput.trim();

  // Strip prefix "Về chủ đề:" or similar if present
  next = next.replace(/^(Về\s+)?chủ\s+đề:\s*/i, '');

  if (!orig) return next;
  if (!next) return orig;

  if (next.toLowerCase().includes(orig.toLowerCase())) {
    return next;
  }
  if (orig.toLowerCase().includes(next.toLowerCase())) {
    return orig;
  }

  return `${orig} ${next}`;
}

// ---------------------------------------------------------
// Main View Component
// ---------------------------------------------------------
export function ResultsView() {
  const navigate = useNavigate();

  // Load query and case details from router
  const { caseNum, q } = useLoaderData({ from: '/search' });

  const [newQuery, setNewQuery] = useState(q || '');
  const [customQuery, setCustomQuery] = useState('');
  const [results, setResults] = useState<SearchResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);

  const [activeTabs, setActiveTabs] = useState<Record<string, number>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerData, setDrawerData] = useState<{
    author?: string;
    favicon: string;
    title: string;
    url: string;
    content: string;
    fullText: string;
  } | null>(null);

  const [votes, setVotes] = useState<
    Record<string, { score: number; userVote: 'up' | 'down' | null }>
  >({});

  const [sourceOrder, setSourceOrder] = useState<Record<string, number[]>>({});

  // Get vote state dynamically (stable hash score based on key for demo)
  const getVoteState = (key: string) => {
    if (!votes[key]) {
      let hash = 0;
      for (let i = 0; i < key.length; i++) {
        hash = key.charCodeAt(i) + ((hash << 5) - hash);
      }
      const score = Math.abs(hash % 25) + 10;
      return { score, userVote: null };
    }
    return votes[key];
  };

  // Asynchronously fetch search results whenever the query parameters change
  useEffect(() => {
    let isMounted = true;
    setNewQuery(q || '');
    setCustomQuery('');

    const fetchData = async () => {
      let searchQuery = q || '';
      if (caseNum) {
        const mockQueries: Record<string, string> = {
          '1': 'Thị trường kim cương',
          '2': 'Giá vàng biến động',
          '3': 'Dự báo công nghệ AI',
        };
        searchQuery = mockQueries[caseNum] || 'Tìm kiếm';
      }

      if (!searchQuery.trim()) {
        if (isMounted) {
          setResults(null);
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setLoading(true);
        setError(null);
      }

      try {
        const data = await $searchExa({ data: { query: searchQuery, isDemo: !!caseNum } });
        if (isMounted) {
          setResults(data);
        }
      } catch (err) {
        console.error('[ResultsView] Error fetching search data:', err);
        if (isMounted) {
          setError(err);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, [q, caseNum]);

  // Scroll to highlight target automatically when the drawer is opened
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (drawerOpen) {
      timer = setTimeout(() => {
        const target = document.getElementById('highlight-target');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 300);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [drawerOpen, drawerData]);

  const handleBack = (e: React.MouseEvent) => {
    e.preventDefault();
    void navigate({ to: '/' });
  };

  const handleNewSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (newQuery.trim()) {
      void navigate({
        to: '/search',
        search: { q: newQuery.trim() },
      });
    }
  };

  const handleSearchQuestion = (question: string) => {
    void navigate({
      to: '/search',
      search: { q: question.trim() },
    });
  };

  const handleTabChange = (sectionType: string, index: number) => {
    setActiveTabs((prev) => ({
      ...prev,
      [sectionType]: index,
    }));
    setSourceOrder((prev) => {
      const order = prev[sectionType];
      if (!order) return prev;
      const filtered = order.filter((i) => i !== index);
      return { ...prev, [sectionType]: [index, ...filtered] };
    });
  };

  const handleOpenDrawer = (contentItem: SectionContentItem) => {
    const matched = results?.results?.find(
      (r) => r.id === contentItem.source.id || r.url === contentItem.source.url,
    );
    setDrawerData({
      author: contentItem.source.author,
      favicon: contentItem.source.favicon,
      title: matched?.title || contentItem.source.author || 'Nguồn gốc',
      url: contentItem.source.url,
      content: contentItem.content,
      fullText: matched?.text || contentItem.content,
    });
    setDrawerOpen(true);
  };

  const handleVote = (key: string, voteType: 'up' | 'down') => {
    setVotes((prev) => {
      const current = prev[key] || getVoteState(key);
      let newScore = current.score;
      let newVote: 'up' | 'down' | null = null;

      if (voteType === 'up') {
        if (current.userVote === 'up') {
          newScore -= 1;
          newVote = null;
        } else if (current.userVote === 'down') {
          newScore += 2;
          newVote = 'up';
        } else {
          newScore += 1;
          newVote = 'up';
        }
      } else {
        if (current.userVote === 'down') {
          newScore += 1;
          newVote = null;
        } else if (current.userVote === 'up') {
          newScore -= 2;
          newVote = 'down';
        } else {
          newScore -= 1;
          newVote = 'down';
        }
      }

      return {
        ...prev,
        [key]: { score: newScore, userVote: newVote },
      };
    });
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#f5f5f7',
      }}
      {...stylex.props(styles.page)}
    >
      {/* Sticky Apple-like Top Bar */}
      <header {...stylex.props(styles.header)}>
        <a href="/" onClick={handleBack} {...stylex.props(styles.headerLeft)}>
          <img
            src="/logo.svg"
            alt="OVE Logo"
            width={36}
            height={36}
            style={{ maxHeight: '36px', width: 'auto', objectFit: 'contain' }}
            {...stylex.props(styles.logoMini)}
          />
          <h1 {...stylex.props(styles.logoTitle)}>OVE</h1>
        </a>

        <form onSubmit={handleNewSearch} {...stylex.props(styles.searchForm)}>
          <div {...stylex.props(styles.searchBarWrapper)}>
            <TextInput
              type="text"
              label="Tìm kiếm"
              isLabelHidden={true}
              value={newQuery}
              onChange={(val) => setNewQuery(val)}
              placeholder="Nhập từ khóa tìm kiếm..."
              xstyle={styles.searchBarInput}
            />
          </div>
          <Button
            icon={<SearchIcon size={16} />}
            variant="primary"
            type="submit"
            xstyle={styles.searchIconButton}
            label={'Tìm'}
          />
        </form>
      </header>

      <div {...stylex.props(styles.contentWrapper)}>
        {loading ? (
          <div {...stylex.props(styles.loadingContainer)}>
            <div {...stylex.props(styles.spinnerWrapper)}>
              <img src="/logo.svg" alt="Đang tải..." {...stylex.props(styles.spinner)} />
              <div {...stylex.props(styles.spinnerText)}>Đang tìm kiếm...</div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} {...stylex.props(styles.skeletonCard)}>
                <div {...stylex.props(styles.skeletonTitle)} />
                <div {...stylex.props(styles.skeletonTabs)}>
                  <div {...stylex.props(styles.skeletonTab)} />
                  <div {...stylex.props(styles.skeletonTab)} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  <div {...stylex.props(styles.skeletonTextLine)} />
                  <div {...stylex.props(styles.skeletonTextLine)} />
                  <div {...stylex.props(styles.skeletonTextLineShort)} />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div {...stylex.props(styles.errorContainer)}>
            Có lỗi xảy ra khi tải kết quả tìm kiếm. Vui lòng thử lại sau.
          </div>
        ) : (
          <>
            <div {...stylex.props(styles.mainContent)}>
              {/* Notice of Search query / Case demonstration */}
              {caseNum && (
                <div {...stylex.props(styles.infoAlert)}>
                  <div>
                    Đang xem Demo <strong>Case #{caseNum}</strong>: &ldquo;{q}&rdquo;. Sử dụng dữ
                    liệu giả lập trực quan hóa cao cấp (Apple & Reddit Style).
                  </div>
                </div>
              )}

              {/* SECTION 1: AI analysis layout */}
              {results &&
              results.analysis &&
              results.analysis.data &&
              results.analysis.data.length > 0 ? (
                <div {...stylex.props(styles.aiAnalysisSingleCard)}>
                  {results.analysis.data.map((section, sectionIdx) => {
                    const sectionKey = `${section.type}-${sectionIdx}`;
                    const activeIdx = activeTabs[sectionKey] || 0;
                    const currentContent = section.contents[activeIdx] || section.contents[0];
                    const voteKey = `${sectionKey}-${activeIdx}`;
                    const currentVote = getVoteState(voteKey);

                    return (
                      <div
                        key={sectionKey}
                        style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                      >
                        {sectionIdx > 0 && <hr {...stylex.props(styles.sectionDivider)} />}

                        <section
                          style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}
                        >
                          <h2 {...stylex.props(styles.sectionTitle)}>{section.title}</h2>

                          <div {...stylex.props(styles.sectionInfo)}>
                            <span {...stylex.props(styles.sectionInfoText)}>
                              Cập nhật: {randomPastDate()} &bull; {section.contents.length} nguồn
                            </span>
                            <span {...stylex.props(styles.reliabilityBadge)}>
                              <ShieldCheckIcon size={12} /> Độ tin cậy {randomReliability()}/5
                            </span>
                          </div>

                          {/* Toggle Button Group for Sources */}
                          {(() => {
                            const order =
                              sourceOrder[sectionKey] ?? section.contents.map((_, i) => i);
                            const visible = order.slice(0, 3);
                            const hidden = order.slice(3);
                            return (
                              <div {...stylex.props(styles.sourceToggleGroupWrapper)}>
                                {visible.map((idx) => {
                                  const item = section.contents[idx];
                                  const isActive = idx === activeIdx;
                                  const faviconUrl =
                                    item.source.favicon || resolveFavicon(item.source.url);
                                  return (
                                    <button
                                      key={item.source.url + '-' + idx}
                                      type="button"
                                      onClick={() => handleTabChange(sectionKey, idx)}
                                      {...stylex.props(
                                        styles.sourceToggleButton,
                                        isActive && styles.sourceToggleButtonActive,
                                      )}
                                    >
                                      <img
                                        src={faviconUrl}
                                        alt=""
                                        {...stylex.props(styles.sourceToggleFavicon)}
                                        onError={(e) => {
                                          e.currentTarget.src =
                                            'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                                        }}
                                      />
                                      <span>
                                        {item.source.author || new URL(item.source.url).hostname}
                                      </span>
                                    </button>
                                  );
                                })}
                                {hidden.length > 0 && (
                                  <div style={{ position: 'relative' }}>
                                    <button
                                      type="button"
                                      {...stylex.props(styles.sourceMoreButton)}
                                      onMouseEnter={(e) => {
                                        const popover = e.currentTarget
                                          .nextElementSibling as HTMLElement;
                                        if (popover) popover.style.display = 'flex';
                                      }}
                                      onMouseLeave={(e) => {
                                        const popover = e.currentTarget
                                          .nextElementSibling as HTMLElement;
                                        if (popover) popover.style.display = 'none';
                                      }}
                                    >
                                      +{hidden.length}
                                    </button>
                                    <div
                                      {...stylex.props(styles.sourcePopover)}
                                      onMouseEnter={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'flex';
                                      }}
                                      onMouseLeave={(e) => {
                                        (e.currentTarget as HTMLElement).style.display = 'none';
                                      }}
                                    >
                                      {hidden.map((idx) => {
                                        const item = section.contents[idx];
                                        const faviconUrl =
                                          item.source.favicon || resolveFavicon(item.source.url);
                                        return (
                                          <button
                                            key={item.source.url + '-' + idx}
                                            type="button"
                                            onClick={() => handleTabChange(sectionKey, idx)}
                                            {...stylex.props(styles.sourcePopoverButton)}
                                          >
                                            <img
                                              src={faviconUrl}
                                              alt=""
                                              style={{
                                                width: '16px',
                                                height: '16px',
                                                borderRadius: '50%',
                                                objectFit: 'cover',
                                              }}
                                              onError={(e) => {
                                                e.currentTarget.src =
                                                  'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                                              }}
                                            />
                                            <span>
                                              {item.source.author ||
                                                new URL(item.source.url).hostname}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {/* Active tab content panel */}
                          <div {...stylex.props(styles.activeTabPanel)}>
                            {/* Meta information of source */}
                            <div {...stylex.props(styles.sourceMeta)}>
                              {currentContent.source.publishedDate && (
                                <>
                                  <CalendarIcon size={12} />
                                  <span>
                                    Xuất bản:{' '}
                                    {new Date(
                                      currentContent.source.publishedDate,
                                    ).toLocaleDateString()}
                                  </span>
                                  <span>&bull;</span>
                                </>
                              )}
                              {currentContent.source.url && (
                                <>
                                  <UserIcon size={12} />
                                  <span>Tác giả: {currentContent.source.author}</span>
                                </>
                              )}
                            </div>

                            {/* Unique content title */}
                            {/* {currentContent.title && currentContent.title !== section.title && (
                            <h3 {...stylex.props(styles.segmentTitle)}>{currentContent.title}</h3>
                          )} */}

                            {/* Markdown extracted content text */}
                            <div {...stylex.props(styles.markdownContainer)}>
                              <Markdown>{currentContent.content}</Markdown>
                            </div>

                            {/* Custom Dynamic Chart Rendering */}
                            {currentContent.chart && (
                              <div {...stylex.props(styles.chartContainer)}>
                                <h4 {...stylex.props(styles.chartTitle)}>
                                  Biểu đồ trực quan ({currentContent.chart.type})
                                </h4>
                                <SearchChart chart={currentContent.chart} />
                              </div>
                            )}

                            {/* Card Footer Interaction Bar */}
                            <div {...stylex.props(styles.sectionFooter)}>
                              <div
                                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                              >
                                <ToggleButton
                                  label="Hữu ích"
                                  icon={<ThumbsUpIcon size={14} />}
                                  pressedIcon={
                                    <ThumbsUpIcon size={14} style={{ color: '#0066cc' }} />
                                  }
                                  isPressed={currentVote.userVote === 'up'}
                                  onPressedChange={() => handleVote(voteKey, 'up')}
                                />
                                <ToggleButton
                                  label="Không hữu ích"
                                  icon={<ThumbsDownIcon size={14} />}
                                  pressedIcon={
                                    <ThumbsDownIcon size={14} style={{ color: '#ff3b30' }} />
                                  }
                                  isPressed={currentVote.userVote === 'down'}
                                  onPressedChange={() => handleVote(voteKey, 'down')}
                                  isIconOnly
                                />
                              </div>

                              {/* View source detail trigger button */}
                              <button
                                type="button"
                                onClick={() => handleOpenDrawer(currentContent)}
                                {...stylex.props(styles.viewOriginalButton)}
                              >
                                <ExternalLinkIcon size={14} />
                                Xem nội dung gốc
                              </button>
                            </div>

                            {/* Suggestion / Follow Up Questions List */}
                            {section.followUpQuestions && section.followUpQuestions.length > 0 && (
                              <div {...stylex.props(styles.followUpContainer)}>
                                <span {...stylex.props(styles.followUpTitle)}>Câu hỏi gợi ý</span>
                                <div {...stylex.props(styles.followUpList)}>
                                  {section.followUpQuestions.map((question, qIdx) => (
                                    <Button
                                      key={qIdx}
                                      variant="secondary"
                                      label={question}
                                      icon={<MessageCircleQuestionMarkIcon size={16} />}
                                      onClick={() => handleSearchQuestion(question)}
                                      xstyle={styles.followUpButton}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </section>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div {...stylex.props(styles.noResults)}>Không tìm thấy phân tích của AI.</div>
              )}

              {/* SECTION 2: Standard search list layout (Google style) */}
              {results && results.results && results.results.length > 0 ? (
                <section {...stylex.props(styles.googleResultsContainer)}>
                  <h3 {...stylex.props(styles.googleTitle)}>Kết quả tìm kiếm liên quan</h3>
                  <div {...stylex.props(styles.googleList)}>
                    {results.results.map((item) => {
                      const displayAuthor = item.author || new URL(item.url).hostname;
                      const faviconUrl = resolveFavicon(item.url);

                      return (
                        <article key={item.id} {...stylex.props(styles.googleItem)}>
                          <div {...stylex.props(styles.googleItemHeader)}>
                            <img
                              src={faviconUrl}
                              alt=""
                              {...stylex.props(styles.googleItemFavicon)}
                              onError={(e) => {
                                e.currentTarget.src =
                                  'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                              }}
                            />
                            <span>{displayAuthor}</span>
                            {item.publishedDate && (
                              <span>
                                &bull; {new Date(item.publishedDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            {...stylex.props(styles.googleItemTitle)}
                          >
                            {item.title || item.url}
                          </a>
                          {item.text && (
                            <p {...stylex.props(styles.googleItemSnippet)}>
                              {item.text.length > 250
                                ? item.text.substring(0, 250) + '...'
                                : item.text}
                            </p>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : (
                <div {...stylex.props(styles.noResults)}>
                  Không có kết quả tìm kiếm tiêu chuẩn liên quan.
                </div>
              )}
            </div>

            {results?.clarity?.isClear &&
              results?.clarity?.options &&
              results.clarity.options.length > 0 && (
                <div {...stylex.props(styles.sidebar)}>
                  <div {...stylex.props(styles.aiSectionCard)}>
                    <span {...stylex.props(styles.followUpTitle)}>Khám phá thêm</span>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        width: '100%',
                      }}
                    >
                      {results.clarity.options.map((option, idx) => (
                        <Button
                          key={idx}
                          variant="secondary"
                          label={option}
                          endContent={<ArrowRightIcon size={16} />}
                          onClick={() => {
                            const composed = getComposedQuery(q || '', option);
                            void navigate({ to: '/search', search: { q: composed } });
                          }}
                          xstyle={styles.exploreButton}
                        />
                      ))}
                    </div>
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (customQuery.trim()) {
                          const composed = getComposedQuery(q || '', customQuery);
                          void navigate({ to: '/search', search: { q: composed } });
                        }
                      }}
                      {...stylex.props(styles.clarityForm)}
                    >
                      <div style={{ flex: 1 }}>
                        <TextInput
                          type="text"
                          value={customQuery}
                          onChange={(val) => setCustomQuery(val)}
                          label="Tìm kiếm"
                          isLabelHidden={true}
                          placeholder="Nhập nội dung muốn tìm hiểu thêm..."
                          xstyle={styles.searchBarInput}
                        />
                      </div>
                      <Button
                        icon={<SearchIcon size={16} />}
                        variant="primary"
                        type="submit"
                        xstyle={styles.searchIconButton}
                        label={'Tìm'}
                      />
                    </form>
                  </div>
                </div>
              )}
          </>
        )}
      </div>

      {/* Drawer: Dialog on the right side showing original text with highlights */}
      <Dialog
        isOpen={drawerOpen}
        onOpenChange={setDrawerOpen}
        position={{ right: 0, top: 0, bottom: 0 }}
        width={540}
        maxHeight="100vh"
        padding={0}
      >
        <Layout
          header={
            <div
              style={{
                padding: '1.25rem 1.5rem',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ maxWidth: '85%' }}>
                <h2
                  style={{
                    fontSize: '1.125rem',
                    fontWeight: '700',
                    color: '#1d1d1f',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {drawerData?.title || 'Nội dung gốc'}
                </h2>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '6px',
                    fontSize: '0.8125rem',
                    color: '#86868b',
                  }}
                >
                  <img
                    src={drawerData?.favicon}
                    alt=""
                    style={{ width: '16px', height: '16px', borderRadius: '2px' }}
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://www.google.com/s2/favicons?domain=example.com&sz=64';
                    }}
                  />
                  <a
                    href={drawerData?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      color: '#0066cc',
                      textDecoration: 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {drawerData?.author ||
                      (drawerData?.url ? new URL(drawerData.url).hostname : '')}
                    <ExternalLinkIcon size={12} />
                  </a>
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                {...stylex.props(styles.drawerCloseButton)}
              >
                <XIcon size={16} />
              </button>
            </div>
          }
          content={
            <LayoutContent xstyle={styles.drawerLayoutContent}>
              <div
                style={{
                  padding: '1.75rem',
                  color: '#333333',
                  fontSize: '0.9375rem',
                  lineHeight: '1.7',
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {drawerData && (
                  <Markdown inlinePlugins={[highlightPlugin]}>
                    {getHighlightedMarkdown(drawerData.fullText, drawerData.content)}
                  </Markdown>
                )}
              </div>
            </LayoutContent>
          }
        />
      </Dialog>
    </main>
  );
}
