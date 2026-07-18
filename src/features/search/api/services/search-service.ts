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
  title?: string;
  content: string;
  chart?: ChartData;
}

export interface AnalysisSection {
  type: 'overview' | 'article' | 'critique' | 'conclusion';
  title: string;
  contents: SectionContentItem[];
  followUpQuestions: string[];
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

export async function checkQueryClarity(
  query: string,
  isAiConfigured: boolean,
  customOpenAI: any,
): Promise<ClarityResult> {
  if (!isAiConfigured || !customOpenAI) {
    return {
      isClear: true,
      clarifiedGoal: query,
      searchKeywords: [query],
    };
  }

  try {
    const prompt = `
Bạn là một trợ lý AI phân tích ý đồ tìm kiếm chuyên nghiệp.
Hãy phân tích truy vấn (query) tìm kiếm sau của người dùng: "${query}"

Nhiệm vụ của bạn là đánh giá xem truy vấn này đã đủ rõ ràng, cụ thể để thực hiện tìm kiếm trực tiếp trên công cụ tìm kiếm và mang lại kết quả chất lượng chưa.

Quy tắc phân loại:
1. ĐỦ RÕ RÀNG (isClear = true):
   - Truy vấn có chủ thể rõ ràng kèm theo ngữ cảnh cụ thể (ví dụ: địa điểm, thời gian, khía cạnh phân tích).
   - Ví dụ: "giá vàng SJC hôm nay tại Hà Nội", "thị trường kim cương nhân tạo Việt Nam 2025", "dự báo phát triển AI toàn cầu".
   - Bạn cần trả về:
     - clarifiedGoal: Mô tả rõ ràng mục tiêu tìm kiếm của người dùng (Goal) bằng tiếng Việt.
     - searchKeywords: Danh sách 1-3 từ khóa/câu tìm kiếm được tối ưu hóa để gửi đến công cụ tìm kiếm (Semantic Search).

2. CHƯA ĐỦ RÕ RÀNG (isClear = false):
   - Truy vấn quá ngắn, chỉ là danh từ chung chung, mơ hồ, không có ngữ cảnh rõ ràng.
   - Ví dụ: "vàng", "kim cương", "AI", "thời tiết".
   - Bạn cần trả về:
     - options: 2 lựa chọn (chủ đề con cụ thể hơn) để gợi ý cho người dùng làm rõ ý muốn tìm kiếm của họ. Mỗi lựa chọn phải là một câu truy vấn tìm kiếm chi tiết, hoàn chỉnh và có ý nghĩa (Ví dụ: "Thị trường kim cương nhân tạo Việt Nam năm 2025", "Cách tự kiểm định kim cương thật giả"). TUYỆT ĐỐI KHÔNG chứa tiền tố "Về chủ đề:" hoặc "Chủ đề:".

Trả về kết quả theo định dạng JSON.
`;
    const modelFn = customOpenAI as (
      modelId: string,
      settings?: { structuredOutputs?: boolean },
    ) => any;

    const response = await generateObject({
      model: modelFn(env.openaiModel, { structuredOutputs: false }),
      schema: z.object({
        isClear: z.boolean(),
        options: z.array(z.string()).optional(),
        clarifiedGoal: z.string().optional(),
        searchKeywords: z.array(z.string()).optional(),
      }),
      prompt,
    });
    return response.object;
  } catch (error) {
    console.error('[Search Service] Lỗi khi kiểm tra độ rõ ràng của query:', error);
    return {
      isClear: true,
      clarifiedGoal: query,
      searchKeywords: [query],
    };
  }
}

export async function generateChartForSection(
  content: string,
  goal: string,
  isAiConfigured: boolean,
  customOpenAI: any,
): Promise<ChartData | undefined> {
  if (!isAiConfigured || !customOpenAI) {
    return undefined;
  }

  try {
    const prompt = `
Bạn là một chuyên gia phân tích dữ liệu và trực quan hóa số liệu.
Hãy phân tích đoạn văn bản dưới đây để trích xuất và tổng hợp dữ liệu số liệu thống kê thành cấu trúc dữ liệu JSON để vẽ biểu đồ (chart).
Mục tiêu tìm kiếm là: "${goal}"

Đoạn văn bản:
"""
${content}
"""

Nhiệm vụ của bạn:
1. Xác định các số liệu định lượng, thống kê, tăng trưởng theo thời gian hoặc so sánh các danh mục có trong đoạn văn bản trên.
2. Chọn loại biểu đồ phù hợp nhất:
   - "line": Thích hợp cho dữ liệu có xu hướng thay đổi theo thời gian (ví dụ: các năm, các tháng).
   - "bar": Thích hợp cho so sánh giữa các danh mục, đối tượng hoặc nhóm.
   - "pie": Thích hợp cho tỷ lệ phần trăm phân chia của một tổng thể.
3. Chuyển đổi dữ liệu số liệu thành một mảng các đối tượng JSON, trong đó mỗi đối tượng là một điểm dữ liệu (chứa nhãn/trục X và giá trị/trục Y).
   - Hãy sử dụng tên thuộc tính trực quan bằng tiếng Việt hoặc tiếng Anh rõ ràng đại diện cho nhãn và giá trị.

Lưu ý quan trọng:
- Nếu đoạn văn không chứa số liệu rõ ràng có thể biểu diễn trên biểu đồ, hoặc thông tin quá rời rạc không đủ cấu thành tối thiểu 2 điểm dữ liệu, hãy trả về hasValidChart = false.
`;

    const modelFn = customOpenAI as (
      modelId: string,
      settings?: { structuredOutputs?: boolean },
    ) => any;

    const response = await generateObject({
      model: modelFn(env.openaiModel, { structuredOutputs: false }),
      schema: z.object({
        hasValidChart: z.boolean(),
        chart: chartSchema.optional(),
      }),
      prompt,
    });

    if (response.object.hasValidChart && response.object.chart) {
      // eslint-disable-next-line no-console
      console.log(
        `[Search Service] Biểu đồ đã parse thành công cho đoạn văn: "${content.substring(0, 60)}...":`,
        JSON.stringify(response.object.chart, null, 2),
      );
      return response.object.chart;
    } else {
      // eslint-disable-next-line no-console
      console.log(
        `[Search Service] Không phát hiện biểu đồ hợp lệ cho đoạn văn: "${content.substring(0, 60)}..."`,
      );
    }
  } catch (error) {
    console.error('[Search Service] Error generating chart for section:', error);
  }
  return undefined;
}

export async function searchExa(query: string, isDemo = false): Promise<SearchResponseData> {
  // Step 1: Verify Query Clarity (unless isDemo is true)
  let clarityResult: ClarityResult = {
    isClear: true,
    clarifiedGoal: query,
    searchKeywords: [query],
  };

  if (!isDemo && isAiConfigured) {
    clarityResult = await checkQueryClarity(query, isAiConfigured, customOpenAI);
    if (!clarityResult.isClear) {
      return {
        clarity: clarityResult,
        results: [],
      };
    }
  }

  const clarifiedGoal = clarityResult.clarifiedGoal || query;
  const searchKeywords = clarityResult.searchKeywords || [query];

  // Step 2: Call Exa Search API for all search keywords in parallel
  let results: SearchResultItem[] = [];

  if (!exa) {
    console.warn(
      '[Search Service] EXA_API_KEY is not defined. Falling back to mock search results.',
    );
    results = getMockExaResults(query).results || [];
  } else {
    try {
      const searchPromises = searchKeywords.map(async (kw) => {
        try {
          const response = await exa.search(kw, {
            numResults: 6,
            type: 'instant',
            contents: {
              text: true,
            },
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
              url: item.url || '',
              title: item.title || item.url || '',
              publishedDate: item.publishedDate || undefined,
              author: item.author || undefined,
              text: item.text || undefined,
            });
          }
        }
      }

      results = allResults.slice(0, 10);
    } catch (error) {
      console.error('[Search Service] Error calling Exa API:', error);
      results = getMockExaResults(query).results || [];
    }
  }

  // Step 3: Aggregate content with AI (or mock analysis)
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
Bạn là một AI phân tích thông tin chuyên nghiệp. Hãy phân tích kỹ nội dung văn bản dưới đây từ một kết quả tìm kiếm (tiêu đề: "${result.title}", nguồn: ${result.url}) cho mục tiêu tìm kiếm (Goal): "${clarifiedGoal}".

Hãy trích xuất các phân đoạn nội dung nổi bật nhất của trang này, phân loại chúng vào các nhóm phù hợp:
1. "overview": Tổng quan chủ đề, giới thiệu chung liên quan đến Goal.
2. "article": Các nội dung unique, nổi bật, đặc biệt, mang tính làm rõ, phân tích sâu, cung cấp thông tin chi tiết liên quan trực tiếp đến câu hỏi tìm kiếm của người dùng.
3. "critique": Ý kiến phản biện, rủi ro, cảnh báo, nhược điểm, hoặc các góc nhìn trái chiều.
4. "conclusion": Kết luận, tóm tắt cuối bài, bài học kinh nghiệm, hoặc khuyến nghị hành động.

BẮT BUỘC TUÂN THỦ NGHIÊM NGẶC CÁC QUY TẮC LỌC VÀ TRÍCH XUẤT SAU:
- CHỈ TRÍCH XUẤT NỘI DUNG LIÊN QUAN TRỰC TIẾP: Chỉ lấy các phần thông tin giải quyết trực tiếp mục tiêu tìm kiếm "${clarifiedGoal}".
- LỌC BỎ NỘI DUNG SƠ SÀI: Không lấy các đoạn văn quá ngắn (dưới 3 câu hoặc dưới 40 từ), không đủ ý, mơ hồ, hoặc mang tính chất quảng cáo chung chung. Phân đoạn được trích xuất phải rõ ràng, có chiều sâu, cung cấp thông tin thực sự hữu ích.
- NGUYÊN VĂN (VERBATIM): Trường 'content' của mỗi phân đoạn PHẢI LÀ NGUYÊN VĂN đoạn văn bản/nội dung gốc được sao chép trực tiếp từ nội dung văn bản bên dưới. TUYỆT ĐỐI KHÔNG TỰ Ý TÓM TẮT, DỊCH LẠI HAY THAY ĐỔI CÂU CHỮ.
- LỌC BỎ NHIỄU (NOISE FILTERING): Khi trích xuất đoạn văn nguyên văn, bạn PHẢI lọc bỏ hoàn toàn các nội dung nhiễu của trang web như: menu điều hướng, thanh bên, chân trang, quảng cáo, khảo sát, các nút bấm hoặc các dòng trạng thái.
- GẮN CỜ DỮ LIỆU SỐ (hasNumericData): Gán 'hasNumericData' thành true nếu trong đoạn văn bản nguyên văn được chọn có chứa số liệu thống kê, doanh thu, tăng trưởng theo thời gian hoặc so sánh định lượng rõ ràng có thể trực quan hóa bằng biểu đồ. Ngược lại gán false.
- Đề xuất 1-3 câu hỏi đào sâu "followUpQuestions" liên quan trực tiếp đến phân đoạn nội dung được trích xuất.
- Tiêu đề (title) của mỗi phân đoạn phải do AI tự tạo ra một cách ngắn gọn, súc tích, dựa trên chính nội dung của phân đoạn đó để làm rõ chủ đề chi tiết được đề cập (Ví dụ: "Biến động cung cầu vàng SJC", "Thị trường kim cương nhân tạo 2025").

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
                  hasNumericData: z.boolean(),
                  followUpQuestions: z.array(z.string()),
                }),
              ),
            }),
            prompt: prompt,
          });
          const aiResponse = await withTimeout(aiPromise, 15000);

          // For each extracted section, generate a chart if hasNumericData is true
          const sectionsWithCharts = await Promise.all(
            aiResponse.object.extractedSections.map(async (sec) => {
              // Chart generation is temporarily disabled
              const chart: ChartData | undefined = undefined;
              return {
                source: {
                  id: result.id,
                  url: result.url,
                  publishedDate: result.publishedDate,
                  author: result.author,
                  favicon: resolveFavicon(result.url),
                },
                type: sec.type,
                title: sec.title,
                content: sec.content,
                chart,
                followUpQuestions: sec.followUpQuestions,
              };
            }),
          );

          return { result, extractedSections: sectionsWithCharts };
        } catch (error) {
          console.error(`[Search Service] Error processing result "${result.title}":`, error);
          return { result, extractedSections: [] };
        }
      });

      const extractionResults = await Promise.all(extractionPromises);

      // Distribute the extracted sections into our grouped map
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
              contents: [
                {
                  source,
                  title: sec.title,
                  content: sec.content,
                  chart: sec.chart,
                },
              ],
              followUpQuestions: sec.followUpQuestions.slice(0, 3),
            });
          } else {
            sectionsMap[sec.type].contents.push({
              source,
              title: sec.title,
              content: sec.content,
              chart: sec.chart,
            });
            sectionsMap[sec.type].followUpQuestions.push(...sec.followUpQuestions);
          }
        }
      }

      // Format to final format: AnalysisSection[]
      const data: AnalysisSection[] = [];

      // We define default titles for the types
      const defaultTitles: Record<'overview' | 'article' | 'critique' | 'conclusion', string> = {
        overview: query,
        article: 'Phân tích Chi tiết',
        critique: 'Rủi ro và Những Điểm Cần Lưu Ý',
        conclusion: 'Kết luận & Khuyến nghị Hành động',
      };

      // 1. Overview
      const overviewData = sectionsMap['overview'];
      if (overviewData.contents.length > 0) {
        data.push({
          type: 'overview',
          title: defaultTitles['overview'],
          contents: overviewData.contents,
          followUpQuestions: Array.from(new Set(overviewData.followUpQuestions)).slice(0, 3),
        });
      }

      // 2. Article sections (N sections, NOT grouped)
      data.push(...articleSections);

      // 3. Critique
      const critiqueData = sectionsMap['critique'];
      if (critiqueData.contents.length > 0) {
        data.push({
          type: 'critique',
          title: defaultTitles['critique'],
          contents: critiqueData.contents,
          followUpQuestions: Array.from(new Set(critiqueData.followUpQuestions)).slice(0, 3),
        });
      }

      // 4. Conclusion
      const conclusionData = sectionsMap['conclusion'];
      if (conclusionData.contents.length > 0) {
        data.push({
          type: 'conclusion',
          title: defaultTitles['conclusion'],
          contents: conclusionData.contents,
          followUpQuestions: Array.from(new Set(conclusionData.followUpQuestions)).slice(0, 3),
        });
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
    clarity: clarityResult,
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
        title: query,
        contents: [
          {
            source: {
              id: results[0]?.id || 'mock-id-0',
              url: results[0]?.url || 'https://example.com/mock-article-0',
              publishedDate: results[0]?.publishedDate,
              author: results[0]?.author,
              favicon: resolveFavicon(results[0]?.url || 'https://example.com'),
            },
            title: `Tổng quan về bối cảnh thị trường ${query}`,
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
        title: 'Phân tích Chi tiết: Biểu đồ và Số liệu Tăng trưởng',
        contents: [
          {
            source: {
              id: results[1]?.id || 'mock-id-1',
              url: results[1]?.url || 'https://example.com/mock-article-1',
              publishedDate: results[1]?.publishedDate,
              author: results[1]?.author,
              favicon: resolveFavicon(results[1]?.url || 'https://example.com'),
            },
            title: `Báo cáo số liệu tăng trưởng và doanh thu dự kiến`,
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
        type: 'article',
        title: 'Phân tích Chi tiết: Xu hướng Trải nghiệm Khách hàng',
        contents: [
          {
            source: {
              id: results[2]?.id || 'mock-id-2',
              url: results[2]?.url || 'https://example.com/mock-article-2',
              publishedDate: results[2]?.publishedDate,
              author: results[2]?.author,
              favicon: resolveFavicon(results[2]?.url || 'https://example.com'),
            },
            title: 'Khảo sát hành vi người tiêu dùng năm 2025',
            content: `Phân tích sâu cho thấy người tiêu dùng ngày càng chú trọng tới tính minh bạch nguồn gốc và chất lượng dịch vụ chăm sóc hậu mãi đối với ${query}...`,
          },
        ],
        followUpQuestions: [
          'Người tiêu dùng ưu tiên yếu tố nào nhất?',
          'Chỉ số hài lòng khách hàng thay đổi ra sao?',
        ],
      },
      {
        type: 'critique',
        title: 'Rủi ro và Những Điểm Cần Lưu Ý',
        contents: [
          {
            source: {
              id: results[3]?.id || 'mock-id-3',
              url: results[3]?.url || 'https://example.com/mock-article-3',
              publishedDate: results[3]?.publishedDate,
              author: results[3]?.author,
              favicon: resolveFavicon(results[3]?.url || 'https://example.com'),
            },
            title: `Đánh giá rủi ro pháp lý và cạnh tranh thị trường`,
            content: results[3]?.text || `Các rủi ro và cảnh báo về thị trường ${query}.`,
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
            title: `Tóm tắt kết luận và bài học kinh nghiệm`,
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
