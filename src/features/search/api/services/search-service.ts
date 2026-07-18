import { createOpenAI } from '@ai-sdk/openai';
import { generateObject } from 'ai';
import { Exa } from 'exa-js';
import { z } from 'zod';

import { env } from '@/lib/env';

// ---------------------------------------------------------
// TypeScript Definitions for Client and Server Communication
// ---------------------------------------------------------

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
  favicon: string;
}

export interface SectionContentItem {
  source: SourceData;
  content: string;
  chart?: ChartData;
}

export interface AnalysisSection {
  type: 'overview' | 'article' | 'critique' | 'conclusion';
  title: string;
  contents: SectionContentItem[];
  followUpQuestions: string[];
}

export interface SearchResponseData {
  results: SearchResultItem[];
  analysis?: {
    data: AnalysisSection[];
  };
}

// ---------------------------------------------------------
// Zod Schemas for Vercel AI SDK Structured Output
// ---------------------------------------------------------

const chartSchema = z.object({
  type: z.enum(['line', 'bar', 'pie']),
  data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
});

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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`AI Request timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

// ---------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------

const exa = env.exaApiKey ? new Exa(env.exaApiKey) : null;
const isAiConfigured = !!env.openaiApiKey;

const customOpenAI = isAiConfigured
  ? createOpenAI({
      apiKey: env.openaiApiKey,
      baseURL: env.openaiBaseUrl || undefined,
    })
  : null;

export async function searchExa(query: string): Promise<SearchResponseData> {
  // Step 2.2.1: Call Exa Search API
  let results: SearchResultItem[] = [];

  if (!exa) {
    console.warn(
      '[Search Service] EXA_API_KEY is not defined. Falling back to mock search results.',
    );
    results = getMockExaResults(query).results;
  } else {
    try {
      const response = await exa.search(query, {
        numResults: 10,
        type: 'instant',
        contents: {
          text: true,
        },
      });

      results = (response.results || []).map((item) => ({
        id: item.id || '',
        url: item.url || '',
        title: item.title || item.url || '',
        publishedDate: item.publishedDate || undefined,
        author: item.author || undefined,
        text: item.text || undefined,
      }));
    } catch (error) {
      console.error('[Search Service] Error calling Exa API:', error);
      results = getMockExaResults(query).results;
    }
  }

  // Step 2.2.2.2: Aggregate content with AI (or mock analysis)
  let analysis: { data: AnalysisSection[] };

  if (!isAiConfigured) {
    console.warn('[Search Service] OPENAI_API_KEY is not defined. Generating mock analysis.');
    analysis = getMockAnalysis(query, results);
  } else {
    try {
      // Filter results to only those that have non-empty text content
      const resultsWithText = results.filter((r) => r.text && r.text.trim().length > 50);

      // Limit to top 5 results to balance speed and completeness
      const targetResults = resultsWithText.slice(0, 5);

      // eslint-disable-next-line no-console
      console.log(
        `[Search Service] Found ${resultsWithText.length} results with text. Processing top ${targetResults.length} results...`,
      );

      // Initialize collections for each type
      const sectionsMap: Record<
        'overview' | 'article' | 'critique' | 'conclusion',
        {
          contents: SectionContentItem[];
          followUpQuestions: string[];
        }
      > = {
        overview: { contents: [], followUpQuestions: [] },
        article: { contents: [], followUpQuestions: [] },
        critique: { contents: [], followUpQuestions: [] },
        conclusion: { contents: [], followUpQuestions: [] },
      };

      // Call LLM for each result in parallel
      const extractionPromises = targetResults.map(async (result) => {
        try {
          const prompt = `
Bạn là một AI phân tích thông tin chuyên nghiệp. Hãy phân tích kỹ nội dung văn bản dưới đây từ một kết quả tìm kiếm (tiêu đề: "${result.title}", nguồn: ${result.url}) cho từ khóa tìm kiếm: "${query}".

Hãy trích xuất các phân đoạn nội dung nổi bật nhất của trang này, phân loại chúng vào các nhóm phù hợp:
1. "overview": Tổng quan chủ đề, giới thiệu chung hoặc giới thiệu về đối tượng/khái niệm.
2. "article": Nội dung cốt lõi, bài viết chuyên sâu, số liệu, chi tiết nổi bật.
3. "critique": Ý kiến phản biện, rủi ro, cảnh báo, nhược điểm, hoặc các góc nhìn trái chiều.
4. "conclusion": Kết luận, tóm tắt cuối bài, bài học kinh nghiệm, hoặc khuyến nghị hành động.

BẮT BUỘC TUÂN THỦ NGHIÊM NGẶT CÁC QUY TẮC SAU:
- Trường 'content' của mỗi phân đoạn PHẢI LÀ NGUYÊN VĂN (verbatim/exact text) đoạn văn bản/nội dung gốc được sao chép trực tiếp từ nội dung văn bản bên dưới. TUYỆT ĐỐI KHÔNG TỰ Ý TÓM TẮT, DỊCH LẠI HAY THAY ĐỔI CÂU CHỮ.
- LỌC BỎ NHIỄU (NOISE FILTERING): Khi trích xuất đoạn văn nguyên văn, bạn PHẢI lọc bỏ hoàn toàn các nội dung nhiễu của trang web như: menu điều hướng, thanh bên, chân trang, quảng cáo, khảo sát, các nút bấm hoặc các dòng trạng thái.
- TRÍCH XUẤT ĐÚNG PHÂN ĐOẠN: Chỉ trích xuất chính xác một hoặc một vài đoạn văn (paragraph) nguyên văn chứa nội dung thực tế trực tiếp định nghĩa, giải thích hoặc chứa thông tin cốt lõi (thường dài khoảng 2-5 câu liên tục). Tuyệt đối không sao chép toàn bộ trang web hoặc chép cả trang có chứa các dòng tiêu đề nhiễu vào trường 'content'.
- Nếu trong đoạn văn bản nguyên văn được chọn có chứa số liệu thống kê, doanh thu, tăng trưởng theo thời gian hoặc so sánh định lượng, hãy tạo biểu đồ (chart) tương ứng (kiểu: line, bar, hoặc pie) với dữ liệu được số hóa chính xác.
- Đề xuất 1-3 câu hỏi đào sâu "followUpQuestions" liên quan trực tiếp đến phân đoạn nội dung được trích xuất.

Nội dung văn bản gốc cần phân tích:
"""
${result.text}
"""
`;
          const openAIProvider = customOpenAI;
          if (!openAIProvider) {
            throw new Error('AI Provider is not configured');
          }
          const modelFn = openAIProvider as (
            modelId: string,
            settings?: { structuredOutputs?: boolean },
          ) => ReturnType<NonNullable<typeof openAIProvider>>;
          const aiPromise = generateObject({
            model: modelFn(env.openaiModel, { structuredOutputs: false }),
            schema: z.object({
              extractedSections: z.array(
                z.object({
                  type: z.enum(['overview', 'article', 'critique', 'conclusion']),
                  title: z.string(),
                  content: z.string(),
                  chart: chartSchema.optional(),
                  followUpQuestions: z.array(z.string()),
                }),
              ),
            }),
            prompt: prompt,
          });
          const aiResponse = await withTimeout(aiPromise, 15000);
          return { result, extractedSections: aiResponse.object.extractedSections };
        } catch (error) {
          console.error(`[Search Service] Error processing result "${result.title}":`, error);
          return { result, extractedSections: [] };
        }
      });

      const extractionResults = await Promise.all(extractionPromises);

      // Distribute the extracted sections into our grouped map
      for (const { result, extractedSections } of extractionResults) {
        const source: SourceData = {
          id: result.id,
          url: result.url,
          publishedDate: result.publishedDate,
          author: result.author,
          favicon: resolveFavicon(result.url),
        };

        for (const sec of extractedSections) {
          sectionsMap[sec.type].contents.push({
            source,
            content: sec.content,
            chart: sec.chart,
          });
          sectionsMap[sec.type].followUpQuestions.push(...sec.followUpQuestions);
        }
      }

      // Format to final format: AnalysisSection[]
      const data: AnalysisSection[] = [];

      // We define default titles for the types
      const defaultTitles: Record<'overview' | 'article' | 'critique' | 'conclusion', string> = {
        overview: `Tổng quan về chủ đề: ${query}`,
        article: 'Phân tích Chi tiết & Số liệu Tăng trưởng',
        critique: 'Rủi ro và Những Điểm Cần Lưu Ý',
        conclusion: 'Kết luận & Khuyến nghị Hành động',
      };

      const sectionTypes: Array<'overview' | 'article' | 'critique' | 'conclusion'> = [
        'overview',
        'article',
        'critique',
        'conclusion',
      ];

      for (const type of sectionTypes) {
        const sectionData = sectionsMap[type];
        if (sectionData.contents.length > 0) {
          // Deduplicate follow-up questions
          const uniqueQuestions = Array.from(new Set(sectionData.followUpQuestions)).slice(0, 3);

          data.push({
            type,
            title: defaultTitles[type],
            contents: sectionData.contents,
            followUpQuestions: uniqueQuestions,
          });
        }
      }

      if (data.length === 0) {
        analysis = getMockAnalysis(query, results);
      } else {
        analysis = { data };
      }
    } catch (error) {
      console.error('[Search Service] Error generating AI analysis:', error);
      analysis = getMockAnalysis(query, results);
    }
  }

  return {
    results,
    analysis,
  };
}

function getMockExaResults(query: string): SearchResponseData {
  return {
    results: Array.from({ length: 5 }).map((_, i) => ({
      id: `mock-id-${i}`,
      url: `https://example.com/mock-article-${i}`,
      title: `Bài viết giả lập về: ${query} (Phần ${i + 1})`,
      publishedDate: new Date().toISOString(),
      author: 'Tác giả Giả Lập',
      text: `Đây là nội dung văn bản giả lập được trích xuất cho từ khóa "${query}". Nội dung này giúp kiểm thử và prototype luồng dữ liệu của ứng dụng trước khi kết nối API thật. Doanh thu của phân khúc này năm 2024 đạt 100,000 USD, năm 2025 dự kiến đạt 200,000 USD nhờ lượng người dùng tăng vọt.`,
    })),
  };
}

function getMockAnalysis(query: string, results: SearchResultItem[]): { data: AnalysisSection[] } {
  return {
    data: [
      {
        type: 'overview',
        title: `Tổng quan về chủ đề: ${query}`,
        contents: [
          {
            source: {
              id: results[0]?.id || 'mock-id-0',
              url: results[0]?.url || 'https://example.com/mock-article-0',
              publishedDate: results[0]?.publishedDate,
              author: results[0]?.author,
              favicon: resolveFavicon(results[0]?.url || 'https://example.com'),
            },
            content: results[0]?.text || `Dữ liệu giả lập về tổng quan chủ đề ${query}.`,
          },
        ],
        followUpQuestions: [
          `Tác động chính của ${query} là gì?`,
          `Xu hướng này sẽ kéo dài trong bao lâu?`,
        ],
      },
      {
        type: 'article',
        title: 'Phân tích Chi tiết & Số liệu Tăng trưởng',
        contents: [
          {
            source: {
              id: results[1]?.id || 'mock-id-1',
              url: results[1]?.url || 'https://example.com/mock-article-1',
              publishedDate: results[1]?.publishedDate,
              author: results[1]?.author,
              favicon: resolveFavicon(results[1]?.url || 'https://example.com'),
            },
            content: results[1]?.text || `Chi tiết phân tích về số liệu tăng trưởng của ${query}.`,
            chart: {
              type: 'line',
              data: [
                { year: '2024', revenue: 100000 },
                { year: '2025', revenue: 200000 },
              ],
            },
          },
        ],
        followUpQuestions: [
          'Yếu tố nào thúc đẩy tăng trưởng doanh thu vượt bậc?',
          'Có biểu đồ chi tiết hơn về các phân khúc khác không?',
        ],
      },
      {
        type: 'critique',
        title: 'Rủi ro và Những Điểm Cần Lưu Ý',
        contents: [
          {
            source: {
              id: results[2]?.id || 'mock-id-2',
              url: results[2]?.url || 'https://example.com/mock-article-2',
              publishedDate: results[2]?.publishedDate,
              author: results[2]?.author,
              favicon: resolveFavicon(results[2]?.url || 'https://example.com'),
            },
            content: results[2]?.text || `Các rủi ro và cảnh báo về thị trường ${query}.`,
          },
        ],
        followUpQuestions: [
          'Biện pháp phòng ngừa rủi ro là gì?',
          'Chính sách pháp lý nào ảnh hưởng mạnh nhất?',
        ],
      },
      {
        type: 'conclusion',
        title: 'Kết luận & Khuyến nghị Hành động',
        contents: [
          {
            source: {
              id: results[3]?.id || 'mock-id-3',
              url: results[3]?.url || 'https://example.com/mock-article-3',
              publishedDate: results[3]?.publishedDate,
              author: results[3]?.author,
              favicon: resolveFavicon(results[3]?.url || 'https://example.com'),
            },
            content: results[3]?.text || `Kết luận chung về chủ đề ${query}.`,
          },
        ],
        followUpQuestions: [
          'Kế hoạch triển khai cụ thể nên bắt đầu từ đâu?',
          'Làm thế nào để đo lường thành công của chiến dịch?',
        ],
      },
    ],
  };
}
