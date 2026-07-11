# Đặt tên (Naming)

## Quy ước chung

- **File**: `kebab-case.ts` / `kebab-case.tsx`.
- **Variable / function**: `camelCase`. Hằng số `UPPER_SNAKE_CASE`.
- **Type / Interface / Class / Component**: `PascalCase`.
- **Private / internal**: prefix `_` nếu cần phân biệt (dùng tiết kiệm).

## Tên phải tự giải thích

- Đặt tên mô tả **mục đích**, không mô tả kiểu dữ liệu.
  - Sai: `data`, `obj`, `temp`, `x`, `handleClick`, `process`, `doStuff`, `info`, `result`.
  - Đúng: `crawledPage`, `extractQueue`, `savePageContent`, `enqueueUrl`.
- Không viết tắt trừ khi là thuật ngữ phổ biến (`url`, `db`, `id`, `html`, `ts`).
- Boolean prefix `is/has/can/should`: `isCrawled`, `hasContent`, `shouldRetry`.
- Hàm trả về giá trị → danh từ (`getPageContent`); hàm thực hiện hành động → động từ (`savePage`, `enqueueUrl`).

## Không đặt tên "tùm lum"

- Đồng nhất thuật ngữ trong toàn repo: đã chọn `crawl` thì không lẫn `scrape`, đã `page` thì không lẫn `document`.
- Xem các file xung quanh trước khi đặt tên mới để giữ consistency.
