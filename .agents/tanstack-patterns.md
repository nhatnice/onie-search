<!-- dựa trên https://github.com/TanStack/tanstack.com/blob/main/.claude/tanstack-patterns.md -->

# TanStack Patterns

## Quy ước Route Group

- Các route được bảo vệ nằm dưới `src/routes/_auth/**`, được ép buộc bởi `beforeLoad` trong layout `_auth` (`src/routes/_auth/route.tsx`).
- Các route chỉ dành cho khách nằm dưới `src/routes/_guest/**`, được ép buộc bởi `beforeLoad` trong layout `_guest` (`src/routes/_guest/route.tsx`).
- Hành vi bảo vệ route và quy tắc middleware liên quan đến auth được tài liệu hóa trong `.agents/auth.md`.

## Lấy dữ liệu (Data Fetching)

Route loader là isomorphic; chúng chạy trên cả server lẫn client. Chúng không thể truy cập trực tiếp các API chỉ dành cho server.

```typescript
// Sai: truy cập trực tiếp server API
loader: async () => {
  const todos = await fs.readFile('todos.json');
  return { todos };
};
```

```typescript
// Đúng (tối thiểu/hợp lệ): gọi server function từ loader
loader: async () => {
  const todos = await $getTodos({ data: {} });
  return { todos };
};
```

Thay vì gọi trực tiếp server function trong loader, ưu tiên bọc trong TanStack Query để cache tốt hơn và tái sử dụng được.

```typescript
loader: async ({ context }) => {
  // Tốt nhất/Ưu tiên: Với server function dùng để đọc/lấy dữ liệu, bọc trong TanStack Query
  const todos = await context.queryClient.ensureQueryData(todosQueryOptions());
  return { todos };
};

// lib/todos/queries.ts
export const todosQueryOptions = () =>
  queryOptions({
    queryKey: ['todos'],
    queryFn: ({ signal }) => $getTodos({ signal }), // TanStack Query gọi server function
  });
```

## Environment Shaking

TanStack Start loại bỏ mọi code không được tham chiếu bởi handler `createServerFn` khỏi build client.

- Code chỉ dành cho server (database, fs) tự động bị loại khỏi bundle client
- Chỉ code bên trong handler `createServerFn` mới đi vào bundle server
- Code nằm ngoài handler sẽ được đưa vào cả hai bundle

## Import Server Function

Server function được bọc trong `createServerFn` có thể được import tĩnh. Không bao giờ dùng dynamic import cho code chỉ dành cho server trong component. Tiền tố tên server function bằng `$` (ví dụ `$getUser`) để dễ nhận diện.

```typescript
// Sai: dynamic import gây vấn đề cho bundler
const rolesQuery = useQuery({
  queryFn: async () => {
    const { $listRoles } = await import('#/utils/roles.server');
    return $listRoles({ data: {} });
  },
});

// Đúng: import tĩnh
import { $listRoles } from '#/utils/roles.server';

const rolesQuery = useQuery({
  queryFn: async () => $listRoles({ data: {} }),
});
```

## Quy tắc Import chỉ dành cho Server

1. Wrapper `createServerFn` có thể được import tĩnh ở bất kỳ đâu
2. Code chỉ dành cho server (database client, fs) chỉ được phép import:
   - Bên trong handler `createServerFn`
   - Trong file `functions.ts`

## Pattern riêng cho Auth

- Xem `.agents/auth.md` để biết cách dùng auth middleware, bảo vệ route, và pattern session/cookie.
