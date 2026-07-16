# CRAWL

Cronjob mỗi giờ quét `pages` status=pending → push BullMQ (Redis) → worker PlaywrightCrawler extract (Readability + Turndown) → lưu `pages` / `page_metadata` / `page_contents` / `page_links`. Seed URLs qua task `db:seed`.

# EMBEDDING

Embed nội dung web đã crawl.

- Chunking & embedding (Theo từ section nội dung trong markdown). Mục tiêu: Để sau này khi search thì sẽ chỉ cần lấy đúng section nội dung liên quan.
- ParadeDB BM25 index (defer đến khi có data per ParadeDB docs).

- [ ] Đổi schema public -> crawler
- [ ] Event driven -> Khi có url mới được tạo -> push vào queue.
- [ ] Event driven -> Khi có page mới được crawl -> push vào queue để adapter get url
- [ ] List các chỗ đang dùng bull mq hiện tại -> Chuyển các phần cần thiết qua Event driven Inngest
- [ ] GetDB, setup lại các chỗ input db vào hàm. Đang boilerplate.
