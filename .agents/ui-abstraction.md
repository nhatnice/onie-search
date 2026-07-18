# UI Abstraction & DRY Guideline

Tài liệu này hướng dẫn cách tổ chức và trừu tượng hóa (abstract) các thành phần giao diện (UI Components) để đảm bảo việc thay đổi thư viện UI/styling trong tương lai (ví dụ: chuyển đổi giữa StyleX, Tailwind CSS, Radix UI, v.v.) được thực hiện dễ dàng, nhanh chóng mà không cần sửa đổi mã nguồn ở các trang/views.

## Nguyên tắc cốt lõi

1. **Không sử dụng thư viện UI/Styling trực tiếp trong Views/Routes:**
   - Các file view (ví dụ: `SearchView.tsx`, `ResultsView.tsx`) hoặc file route (`routes/*.tsx`) **không được phép** chứa mã CSS thô hoặc sử dụng trực tiếp các thành phần phụ thuộc chặt chẽ vào một thư viện style cụ thể nếu chúng đại diện cho các primitive UI (Input, Button, Card, v.v.).
   - Mọi view chỉ được phép sử dụng các component UI đã được trừu tượng hóa thông qua thư mục `components/` của feature hoặc thư mục global `src/components/ui/`.

2. **Giao tiếp qua Prop Interfaces rõ ràng:**
   - Các component UI trừu tượng cần thừa kế các thuộc tính React standard HTML (ví dụ: `InputHTMLAttributes`, `ButtonHTMLAttributes`) để đảm bảo tính tương thích và dễ thay thế.
   - Tránh rò rỉ (leak) các kiểu dữ liệu đặc thù của thư viện styling ra ngoài API của component.

3. **Cấu trúc thư mục:**
   ```
   src/features/search/
   ├── components/            # Chứa các component UI được abstract
   │   ├── SearchInput.tsx    # Bọc logic input & styling (ví dụ StyleX)
   │   ├── SearchButton.tsx   # Bọc logic button & styling
   │   └── ...
   ├── views/                 # Chỉ chứa logic và cấu trúc bố cục trang
   │   ├── SearchView.tsx     # Sử dụng SearchInput và SearchButton
   │   └── ResultsView.tsx
   ```

## Ví dụ cụ thể

### ❌ Cách viết sai (Tạo sự phụ thuộc chặt chẽ)

Trong view sử dụng StyleX trực tiếp để style các input/button thô:

```tsx
// SearchView.tsx - SAI
import * as stylex from '@stylexjs/stylex';

const styles = stylex.create({
  input: { border: '1px solid #ccc', borderRadius: '4px' },
});

export function SearchView() {
  return <input {...stylex.props(styles.input)} placeholder="Tìm..." />;
}
```

_Vấn đề:_ Khi đổi sang Tailwind CSS, bạn sẽ phải sửa đổi trực tiếp file `SearchView.tsx` để đổi từ StyleX sang class names. Nếu dự án có hàng chục trang tìm kiếm, việc này sẽ rất tốn công sức.

### Cách viết đúng (UI Abstraction)

1. Định nghĩa component UI trừu tượng trong `features/search/components/SearchInput.tsx`:

```tsx
import * as stylex from '@stylexjs/stylex';
import type { InputHTMLAttributes } from 'react';

const styles = stylex.create({
  input: { border: '1px solid #ccc', borderRadius: '4px' },
});

export function SearchInput({ ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} {...stylex.props(styles.input)} />;
}
```

2. Sử dụng component đã được abstract trong view:

```tsx
// SearchView.tsx - ĐÚNG
import { SearchInput } from '../components/SearchInput';

export function SearchView() {
  return <SearchInput placeholder="Tìm..." />;
}
```

_Lợi ích:_ Khi cần đổi từ StyleX sang Tailwind CSS hoặc thư viện UI khác, bạn chỉ cần sửa đổi file `SearchInput.tsx` để thay đổi cách style, hoàn toàn không cần chạm vào `SearchView.tsx` hay bất kỳ view nào khác.
