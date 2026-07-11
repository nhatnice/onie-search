# Quy ước Auth (Xác thực)

## Kiến trúc Auth

- Cấu hình Better Auth nằm ở `src/lib/auth/auth.ts`.
- Các tiện ích auth được tập trung ở `src/lib/auth/*`.
- Trong component, ưu tiên dùng các auth hook dùng chung (`useAuth`, `useAuthSuspense`) từ `src/lib/auth/hooks.ts`. Các hook này tái sử dụng cùng dữ liệu auth với route loader.
- Với route loader dưới `_auth`, ưu tiên dùng user từ loader context thay vì gọi lại auth nhiều lần.

## Bảo vệ Route (Route Guards)

- Layout của route được bảo vệ là `src/routes/_auth/route.tsx`.
  - Nó ép buộc auth trong `beforeLoad` bằng `ensureQueryData(authQueryOptions())`.
  - Nó trả về `{ user }`, giá trị này có sẵn cho mọi route loader con thông qua router context.
- Layout của route chỉ dành cho khách (guest-only) là `src/routes/_guest/route.tsx`.
  - Nó chuyển hướng người dùng đã xác thực ra khỏi các route login/signup.

## Server Functions và Mutations

- Server function có thể được gọi từ cả code server lẫn client.
  - Gọi từ server: thực thi trực tiếp trên server.
  - Gọi từ client: được xử lý như RPC và thực thi qua HTTP API request.
- Hãy coi server function được bảo vệ như các API route được bảo vệ, ở góc độ bảo mật.
- Nếu một server function yêu cầu auth, luôn áp dụng `authMiddleware` từ `src/lib/auth/middleware.ts`. Điều này áp dụng ngay cả khi được gọi từ route đã bảo vệ auth (`routes/_auth/**`).
- `beforeLoad` ở cấp route bảo vệ việc điều hướng/render route, nhưng không thay thế việc phân quyền cho server function.
- Khi yêu cầu auth, user context do middleware cung cấp là nguồn sự thật (source of truth).
