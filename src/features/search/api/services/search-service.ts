import { createOpenAI } from '@ai-sdk/openai';
import { default as Exa } from 'exa-js';

import { env } from '@/lib/env';

import { getMockAnalysis, getMockExaResults } from './mock-search';
import { checkQueryClarity, generateAiAnalysis } from './search-ai';

export interface SearchResultItem {
  id: string;
  url: string;
  title: string;
  publishedDate?: string;
  author?: string;
  text?: string;
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie';
  data: Array<Record<string, string | number>>;
}

export interface SourceData {
  id: string;
  url: string;
  publishedDate?: string;
  author?: string;
  favicon?: string;
}

export interface SectionContentItem {
  source: SourceData;
  title?: string;
  content: string;
  chart?: ChartData;
}

export interface AnalysisSection {
  type: 'overview' | 'article' | 'critique' | 'conclusion';
  title: string;
  contents: SectionContentItem[];
  followUpQuestions?: string[];
}

export interface ClarityResult {
  isClear: boolean;
  options?: string[];
  clarifiedGoal?: string;
  searchKeywords?: string[];
}

export interface SearchResponseData {
  results?: SearchResultItem[];
  analysis?: {
    data: AnalysisSection[];
  };
  clarity?: ClarityResult;
}

export function resolveFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

const exa = env.exaApiKey ? new Exa(env.exaApiKey) : null;
const customOpenAI = env.openaiApiKey
  ? createOpenAI({
      apiKey: env.openaiApiKey,
      baseURL: env.openaiBaseUrl || undefined,
    })
  : null;

async function fetchExaSearchResults(
  searchKeywords: string[],
  query: string,
): Promise<SearchResultItem[]> {
  if (!exa) {
    console.warn(
      '[Search Service] EXA_API_KEY is not defined. Falling back to mock search results.',
    );
    return getMockExaResults(query).results || [];
  }

  try {
    const searchPromises = searchKeywords.map(async (kw) => {
      try {
        const response = await exa.search(kw, {
          numResults: 6,
          type: 'instant',
          contents: { text: true },
        });
        return response.results || [];
      } catch (err) {
        console.error(`[Search Service] Lỗi Exa search cho từ khóa "${kw}":`, err);
        return [];
      }
    });

    const searchResponses = await Promise.all(searchPromises);
    const allResults: SearchResultItem[] = [];
    const seenUrls = new Set<string>();

    for (const resList of searchResponses) {
      for (const item of resList) {
        const url = item.url || '';
        if (url && !seenUrls.has(url)) {
          seenUrls.add(url);
          allResults.push({
            id: item.id || '',
            url,
            title: item.title || item.url || '',
            publishedDate: item.publishedDate || undefined,
            author: item.author || undefined,
            text: item.text || undefined,
          });
        }
      }
    }
    return allResults.slice(0, 10);
  } catch (error) {
    console.error('[Search Service] Error calling Exa API:', error);
    return getMockExaResults(query).results || [];
  }
}

export async function searchExa(query: string, _isDemo = false): Promise<SearchResponseData> {
  let clarityResult: ClarityResult = {
    isClear: true,
    clarifiedGoal: query,
    searchKeywords: [query],
  };

  if (customOpenAI) {
    clarityResult = await checkQueryClarity(query, customOpenAI);
  }

  if (!clarityResult.options || clarityResult.options.length === 0) {
    clarityResult.options = [
      `${query} — Phân tích chi tiết và xu hướng mới nhất`,
      `${query} — Tác động và rủi ro cần lưu ý`,
    ];
  }

  const clarifiedGoal = clarityResult.clarifiedGoal || query;
  const searchKeywords = clarityResult.searchKeywords || [query];
  const results = await fetchExaSearchResults(searchKeywords, query);

  const analysis = customOpenAI
    ? await generateAiAnalysis(query, clarifiedGoal, results, customOpenAI)
    : getMockAnalysis(query, results);

  return { results, analysis, clarity: clarityResult };
}
