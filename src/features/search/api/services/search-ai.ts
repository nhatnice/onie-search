import { generateObject } from 'ai';
import { z } from 'zod';

import { env } from '@/lib/env';

import { getMockAnalysis } from './mock-search';
import type {
  AnalysisSection,
  ClarityResult,
  SearchResultItem,
  SectionContentItem,
  SourceData,
} from './search-service';

function resolveFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Timeout: Quá thời gian xử lý (${timeoutMs}ms)`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
}

export type OpenAIProvider = (
  modelId: string,
  settings?: { structuredOutputs?: boolean },
) => unknown;

export async function checkQueryClarity(
  query: string,
  openAIProvider?: OpenAIProvider | null,
): Promise<ClarityResult> {
  if (!openAIProvider) {
    return { isClear: true, clarifiedGoal: query, searchKeywords: [query] };
  }

  try {
    const prompt = `Bạn là một trợ lý AI phân tích ý đồ tìm kiếm chuyên nghiệp.
Phân tích query "${query}" xem đã đủ rõ ràng để tìm kiếm trực tiếp chưa.
Trả về JSON: { isClear: boolean, options: string[], clarifiedGoal?: string, searchKeywords?: string[] }`;

    const response = await generateObject({
      model: openAIProvider(env.openaiModel, { structuredOutputs: false }) as never,
      schema: z.object({
        isClear: z.boolean(),
        options: z.array(z.string()),
        clarifiedGoal: z.string().optional(),
        searchKeywords: z.array(z.string()).optional(),
      }),
      prompt,
    });
    return response.object;
  } catch (error) {
    console.error('[Search Service] Error checking query clarity:', error);
    return { isClear: true, clarifiedGoal: query, searchKeywords: [query] };
  }
}

interface ExtractedItem {
  type: 'overview' | 'article' | 'critique' | 'conclusion';
  title: string;
  content: string;
  hasNumericData: boolean;
  followUpQuestions: string[];
}

export async function extractSectionsFromResult(
  result: SearchResultItem,
  clarifiedGoal: string,
  openAIProvider: OpenAIProvider,
): Promise<{ result: SearchResultItem; extractedSections: ExtractedItem[] }> {
  try {
    const prompt = `Phân tích nội dung từ trang "${result.title}" (${result.url}) cho mục tiêu: "${clarifiedGoal}".
Trích xuất các đoạn văn bản nổi bật nhất theo 4 nhóm: "overview", "article", "critique", "conclusion".
Trường 'content' PHẢI là nguyên văn nội dung bài viết.
Nội dung văn bản:
"""
${result.text}
"""`;

    const aiPromise = generateObject({
      model: openAIProvider(env.openaiModel, { structuredOutputs: false }) as never,
      schema: z.object({
        extractedSections: z.array(
          z.object({
            type: z.enum(['overview', 'article', 'critique', 'conclusion']),
            title: z.string(),
            content: z.string(),
            hasNumericData: z.boolean(),
            followUpQuestions: z.array(z.string()),
          }),
        ),
      }),
      prompt,
    });

    const aiResponse = await withTimeout(aiPromise, 15000);
    return { result, extractedSections: aiResponse.object.extractedSections };
  } catch (error) {
    console.error(`[Search Service] Error processing result "${result.title}":`, error);
    return { result, extractedSections: [] };
  }
}

export function buildAnalysisData(
  query: string,
  extractionResults: { result: SearchResultItem; extractedSections: ExtractedItem[] }[],
): AnalysisSection[] {
  const sectionsMap: Record<
    'overview' | 'critique' | 'conclusion',
    { contents: SectionContentItem[]; followUpQuestions: string[] }
  > = {
    overview: { contents: [], followUpQuestions: [] },
    critique: { contents: [], followUpQuestions: [] },
    conclusion: { contents: [], followUpQuestions: [] },
  };
  const articleSections: AnalysisSection[] = [];

  for (const { result, extractedSections } of extractionResults) {
    const source: SourceData = {
      id: result.id,
      url: result.url,
      publishedDate: result.publishedDate,
      author: result.author,
      favicon: resolveFavicon(result.url),
    };

    for (const sec of extractedSections) {
      if (sec.type === 'article') {
        articleSections.push({
          type: 'article',
          title: sec.title || 'Phân tích Chi tiết',
          contents: [{ source, title: sec.title, content: sec.content }],
          followUpQuestions: sec.followUpQuestions.slice(0, 3),
        });
      } else {
        sectionsMap[sec.type].contents.push({ source, title: sec.title, content: sec.content });
        sectionsMap[sec.type].followUpQuestions.push(...sec.followUpQuestions);
      }
    }
  }

  const data: AnalysisSection[] = [];
  const defaultTitles: Record<string, string> = {
    overview: query,
    critique: 'Rủi ro và Những Điểm Cần Lưu Ý',
    conclusion: 'Kết luận & Khuyến nghị Hành động',
  };

  for (const type of ['overview', 'critique', 'conclusion'] as const) {
    const group = sectionsMap[type];
    if (group.contents.length > 0) {
      data.push({
        type,
        title: defaultTitles[type],
        contents: group.contents,
        followUpQuestions: Array.from(new Set(group.followUpQuestions)).slice(0, 3),
      });
    }
    if (type === 'overview') data.push(...articleSections);
  }

  return data;
}

export async function generateAiAnalysis(
  query: string,
  clarifiedGoal: string,
  results: SearchResultItem[],
  openAIProvider?: OpenAIProvider | null,
): Promise<{ data: AnalysisSection[] }> {
  try {
    if (!openAIProvider) return getMockAnalysis(query, results);
    const resultsWithText = results.filter((r) => r.text && r.text.trim().length > 50).slice(0, 5);
    const extractionPromises = resultsWithText.map((res) =>
      extractSectionsFromResult(res, clarifiedGoal, openAIProvider),
    );
    const extractionResults = await Promise.all(extractionPromises);
    const data = buildAnalysisData(query, extractionResults);

    if (data.length === 0) return getMockAnalysis(query, results);
    return { data };
  } catch (error) {
    console.error('[Search Service] Error generating AI analysis:', error);
    return getMockAnalysis(query, results);
  }
}
