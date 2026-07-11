# Workflow

## Lệnh

- `pnpm build`: Chỉ dùng cho vấn đề build/bundler hoặc kiểm tra output production
- `pnpm`: Bao gồm cả lint có nhận biết kiểu (type-aware) và kiểm tra kiểu. Không cần chạy `tsc --noEmit`
- `pnpm dev` chạy vô thời hạn ở chế độ watch
- `pnpm db` dùng cho lệnh Drizzle Kit (ví dụ `pnpm db generate` để tạo migration)

Không cần build sau mỗi thay đổi. Nếu lint pass; coi như thay đổi hoạt động.

## Kiểm thử (Testing)

Vitest chưa được thiết lập. Tạm thời ưu tiên kiểm tra bằng lint.

## Định dạng (Formatting)

Oxformat được cấu hình để định dạng code nhất quán bằng `pnpm format`. Nó tự động chạy khi commit qua pre-commit hook của Vite+, nên không cần định dạng thủ công.
