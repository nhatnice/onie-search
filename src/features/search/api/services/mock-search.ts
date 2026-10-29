import type {
  AnalysisSection,
  ChartData,
  SearchResponseData,
  SearchResultItem,
} from './search-service';

function resolveFavicon(url: string): string {
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${parsed.hostname}&sz=64`;
  } catch {
    return 'https://www.google.com/s2/favicons?domain=example.com&sz=64';
  }
}

export function getMockExaResults(query: string): SearchResponseData {
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

function makeMockSection(
  type: AnalysisSection['type'],
  title: string,
  result: SearchResultItem | undefined,
  fallbackId: string,
  content: string,
  followUpQuestions: string[],
  chart?: ChartData,
): AnalysisSection {
  const url = result?.url || `https://example.com/${fallbackId}`;
  return {
    type,
    title,
    contents: [
      {
        source: {
          id: result?.id || fallbackId,
          url,
          publishedDate: result?.publishedDate,
          author: result?.author,
          favicon: resolveFavicon(url),
        },
        title,
        content: result?.text || content,
        chart,
      },
    ],
    followUpQuestions,
  };
}

export function getMockAnalysis(
  query: string,
  results: SearchResultItem[],
): { data: AnalysisSection[] } {
  return {
    data: [
      makeMockSection(
        'overview',
        query,
        results[0],
        'mock-id-0',
        `Dữ liệu giả lập về tổng quan chủ đề ${query}.`,
        [`Tác động chính của ${query} là gì?`, `Xu hướng này sẽ kéo dài trong bao lâu?`],
      ),
      makeMockSection(
        'article',
        'Phân tích Chi tiết: Biểu đồ và Số liệu Tăng trưởng',
        results[1],
        'mock-id-1',
        `Chi tiết phân tích về số liệu tăng trưởng của ${query}.`,
        [
          'Yếu tố nào thúc đẩy tăng trưởng doanh thu vượt bậc?',
          'Có biểu đồ chi tiết hơn về các phân khúc khác không?',
        ],
        {
          type: 'line',
          data: [
            { year: '2024', revenue: 100000 },
            { year: '2025', revenue: 200000 },
          ],
        },
      ),
      makeMockSection(
        'article',
        'Phân tích Chi tiết: Xu hướng Trải nghiệm Khách hàng',
        results[2],
        'mock-id-2',
        `Phân tích sâu cho thấy người tiêu dùng ngày càng chú trọng tới tính minh bạch nguồn gốc đối với ${query}...`,
        ['Người tiêu dùng ưu tiên yếu tố nào nhất?', 'Chỉ số hài lòng khách hàng thay đổi ra sao?'],
      ),
      makeMockSection(
        'critique',
        'Rủi ro và Những Điểm Cần Lưu Ý',
        results[3],
        'mock-id-3',
        `Các rủi ro và cảnh báo về thị trường ${query}.`,
        ['Biện pháp phòng ngừa rủi ro là gì?', 'Chính sách pháp lý nào ảnh hưởng mạnh nhất?'],
      ),
      makeMockSection(
        'conclusion',
        'Kết luận & Khuyến nghị Hành động',
        results[3],
        'mock-id-3',
        `Kết luận chung về chủ đề ${query}.`,
        [
          'Kế hoạch triển khai cụ thể nên bắt đầu từ đâu?',
          'Làm thế nào để đo lường thành công của chiến dịch?',
        ],
      ),
    ],
  };
}
