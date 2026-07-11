<!-- dựa trên https://github.com/TanStack/tanstack.com/blob/main/.claude/typescript.md -->

# Quy ước TypeScript

## Tránh ép kiểu (Type Casting)

Không bao giờ ép kiểu trừ khi thực sự cần thiết. Bao gồm:

- Tham số generic tường minh (ví dụ `<Type>`)
- Type assertion dùng `as`
- Type assertion dùng `satisfies`

## Ưu tiên tự động suy luận kiểu (Type Inference)

Suy luận kiểu bằng cách đi ngược lên chuỗi logic:

1. **Schema validation** là nguồn sự thật (ví dụ Zod)
2. **Suy luận kiểu** từ kiểu trả về của hàm, response API
3. **Sửa tại nguồn** (schema, định nghĩa API, chữ ký hàm) thay vì ép kiểu tại nơi sử dụng

```typescript
// Sai
const result = api.getData() as MyType;
const value = getValue<MyType>();

// Đúng
const result = api.getData(); // Kiểu được suy luận từ kiểu trả về
const value = getValue(); // Kiểu được suy luận từ phần triển khai
```

## Đặt tên tham số kiểu Generic

Tất cả tham số kiểu generic phải có tiền tố `T`.

```typescript
// Sai
function withCapability<Args extends unknown[], R>(
  handler: (user: AuthUser, ...args: Args) => R,
) { ... }

// Đúng
function withCapability<TArgs extends unknown[], TReturn>(
  handler: (user: AuthUser, ...args: TArgs) => TReturn,
) { ... }
```

Tên phổ biến: `T`, `TArgs`, `TReturn`, `TData`, `TError`, `TKey`, `TValue`
