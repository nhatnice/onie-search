import type React from 'react';

// ---------------------------------------------------------
// Helper: Resolve Domain Favicon
// ---------------------------------------------------------
export function resolveFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

// ---------------------------------------------------------
// Helpers: Demo Dates & Reliability
// ---------------------------------------------------------
export function randomPastDate(): string {
  const now = Date.now();
  const offset = Math.floor(Math.random() * 365 * 24 * 60 * 60 * 1000);
  return new Date(now - offset).toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function randomReliability(): number {
  return Math.floor(Math.random() * 2) + 4; // 4 or 5
}

// ---------------------------------------------------------
// Helper: Text Highlighter
// ---------------------------------------------------------
export function stripMarkdown(str: string): string {
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

export function findWordSequenceIndex(
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

function matchAnchoredSnippet(
  fullText: string,
  words: string[],
  snippetLen: number,
): string | null {
  const startMatch = findWordSequenceIndex(fullText, words.slice(0, 5));
  if (!startMatch) return null;

  const endMatch = findWordSequenceIndex(
    fullText,
    words.slice(-5),
    startMatch.index + startMatch.length,
  );
  const matchEnd = endMatch
    ? endMatch.index + endMatch.length
    : Math.min(startMatch.index + snippetLen, fullText.length);

  const before = fullText.substring(0, startMatch.index);
  const matched = fullText.substring(startMatch.index, matchEnd);
  const after = fullText.substring(matchEnd);
  return `${before}<mark id="highlight-target" class="highlighted">${matched}</mark>${after}`;
}

export function getHighlightedMarkdown(fullText: string, searchSnippet: string): string {
  if (!fullText) return '';
  if (!searchSnippet) return fullText;

  const cleanSnippet = stripMarkdown(searchSnippet).trim();
  const words = cleanSnippet
    .split(/[^\p{L}\p{N}]+/u)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);

  if (words.length === 0) return fullText;

  if (words.length <= 8) {
    const match = findWordSequenceIndex(fullText, words);
    if (match) {
      const before = fullText.substring(0, match.index);
      const matchedText = fullText.substring(match.index, match.index + match.length);
      const after = fullText.substring(match.index + match.length);
      return `${before}<mark id="highlight-target" class="highlighted">${matchedText}</mark>${after}`;
    }
  } else {
    const anchored = matchAnchoredSnippet(fullText, words, cleanSnippet.length);
    if (anchored) return anchored;
  }

  const startShort = cleanSnippet.substring(0, 40).trim();
  const startIdx = fullText.indexOf(startShort);
  if (startIdx !== -1) {
    const endPos = Math.min(startIdx + cleanSnippet.length, fullText.length);
    const before = fullText.substring(0, startIdx);
    const matchText = fullText.substring(startIdx, endPos);
    const after = fullText.substring(endPos);
    return `${before}<mark id="highlight-target" class="highlighted">${matchText}</mark>${after}`;
  }

  return fullText;
}

export const highlightPlugin = {
  pattern: /<mark id="highlight-target" class="highlighted">([\s\S]*?)<\/mark>/g,
  render: (match: RegExpMatchArray, key: string): React.JSX.Element => (
    <mark key={key} id="highlight-target" className="highlighted">
      {match[1]}
    </mark>
  ),
};

export function getComposedQuery(originalQuery: string, newSelectionOrInput: string): string {
  const orig = originalQuery.trim();
  let next = newSelectionOrInput.trim().replace(/^(Về\s+)?chủ\s+đề:\s*/i, '');

  if (!orig) return next;
  if (!next) return orig;
  if (next.toLowerCase().includes(orig.toLowerCase())) return next;
  if (orig.toLowerCase().includes(next.toLowerCase())) return orig;
  return `${orig} ${next}`;
}
