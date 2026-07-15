# HTML SCRAPE

Scrape nội dung HTML từ url.

## Requirements

### 1. Adapter Browserless thay cho Playwright

- Triển khai thêm browserless để lấy nội dung từ restapi thay vì playwright như hiện tại. (Document: https://docs.browserless.io/open-api/chromium-content)

### 2. Page contents schema update

- Bỏ các cột clean_markdown, raw_markdown, raw_html, clean_html.
- Thêm cột:

```
page_contents {
  id: text PK,
  kind: enum,              // ← field phân biệt: 'page' | 'media' | 'file'
  mime_type: text,         // 'text/html' | 'text/markdown' | 'audio/mpeg' | 'video/mp4' | 'image/jpeg'
  blob_url: text,          // R2 URL (raw html, media — lớn) — null nếu content
  blob_size: integer,      // bytes
  blob_hash: text,         // SHA-256 (for dedup)
  created_at: timestamp,
  updated_at: timestamp,
  deleted_at: timestamp,
  UNIQUE (page_id, kind, mime_type)
}
```

### 3. Object Storage Infra

- Tạo object storage abstraction.
- Adapter R2.
- Hàm upload (Có check dedup), trường hợp duplicate thì return path có sẵn.
- Note luôn vào AGENTS.md - Cần phân liên quan để xử lý, upload file và lưu vị trí vào DB thì lưu relative-path và build URL runtime nha.

### 4. Event Driven Infra

- Setup infra cho event driven.
- Lưu event log vào Postgres event table.

### 2. Event-driven

- Consume event khi pages mới được tạo.
- Lấy nội dung raw html. Upload lên Object Storage, Và lưu vào page-contents với kind là page.
- Emit event khi tạo page-contents mới. Lưu event này vào event log.
- Refactor (Các phần emit event cũ (chưa có lưu vào event log) lưu event log).
