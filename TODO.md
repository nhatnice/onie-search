# CRAWL

Cronjob mỗi giờ quét `pages` status=pending → push BullMQ (Redis) → worker PlaywrightCrawler extract (Readability + Turndown) → lưu `pages` / `page_metadata` / `page_contents` / `page_links`. Seed URLs qua task `db:seed`.

# EMBEDDING

Embed nội dung web đã crawl.

- Chunking & embedding (Theo từ section nội dung trong markdown). Mục tiêu: Để sau này khi search thì sẽ chỉ cần lấy đúng section nội dung liên quan.
- ParadeDB BM25 index (defer đến khi có data per ParadeDB docs).
