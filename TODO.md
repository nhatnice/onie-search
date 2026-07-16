# CRAWL

Cronjob mỗi giờ quét `pages` status=pending → push BullMQ (Redis) → worker PlaywrightCrawler extract (Readability + Turndown) → lưu `pages` / `page_metadata` / `page_contents` / `page_links`. Seed URLs qua task `db:seed`.

# EMBEDDING

Embed nội dung web đã crawl.

- Chunking & embedding (Theo từ section nội dung trong markdown). Mục tiêu: Để sau này khi search thì sẽ chỉ cần lấy đúng section nội dung liên quan.
- ParadeDB BM25 index (defer đến khi có data per ParadeDB docs).

- [x] Đổi schema public -> crawler
- [x] Event driven -> Khi có url mới được tạo -> push vào queue.
- [x] Event driven -> Khi có page mới được crawl -> push vào queue để adapter get url
- [x] List các chỗ đang dùng bull mq hiện tại -> Chuyển các phần cần thiết qua Event driven Inngest
- [ ] GetDB, setup lại các chỗ input db vào hàm. Đang boilerplate.
- [x] Tại sao route inngest lại define trong nitro (src/runtime/routes/inngest.ts) mà không phải routes/ native của tanstack start?
- [ ] Setup Turbo để run inngest dev sau đó -> dev
