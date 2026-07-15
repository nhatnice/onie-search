export const PAGE_CREATED = 'page.created' as const;
export const PAGE_CONTENT_CREATED = 'page-content.created' as const;

export const PAGE_CRAWL_FUNCTION_ID = 'page-crawl' as const;

export interface PageCreatedData {
  pageId: string;
  url: string;
}

export interface PageContentCreatedData {
  pageId: string;
  contentId: string;
  kind: 'page' | 'media' | 'file';
}
