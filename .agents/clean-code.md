# Nguyên tắc cốt lõi (Clean Code)

## DRY — Don't Repeat Yourself

- **KHÔNG** copy-paste logic. Nếu 2 nơi có cùng hành vi → trích ra 1 hàm / 1 module.
- Nếu phát hiện mình đang viết lại đoạn đã có ở file khác → DỪNG, tìm lại, reuse.
- Hằng số, magic string, regex, config → đưa vào 1 chỗ duy nhất (thường là `lib/`).

## Single Responsibility (SRP)

- 1 file = 1 trách nhiệm. 1 hàm = 1 việc.
- **NGHIÊM CẤM** gộp nghiệp vụ không liên quan vào cùng 1 file.
- Nếu file bắt đầu dài quá ~200 dòng → xem xét tách. Không phải luật cứng, nhưng là tín hiệu cảnh báo.

## Separation of Concerns

- **API layer** (`features/*/api/`): chỉ nhận request, validate (zod), gọi service, trả response. Không chứa logic nghiệp vụ.
- **Service / Domain layer** (`features/*/` hoặc `lib/`): chứa logic nghiệp vụ thuần, không biết về HTTP.
- **Data layer** (`lib/db/`, `features/*/api/schema.ts`): chỉ lo CRUD + query, không chứa rule nghiệp vụ.
- **Crawl layer** (`lib/crawl/`): adapter + extractor + queue tách bạch. Worker chỉ orchestrate.
- UI (`routes/`, `features/*/components`): không gọi DB trực tiếp, luôn qua API/service.

## YAGNI + KISS

- Chỉ viết cái đang cần. Không "để sau này dùng" → sinh dead code.
- Giải pháp đơn giản nhất thắng. Không over-engineer, không abstract过早.
- Không thêm dependency nếu stdlib / lib đã có làm được.

## Boy Scout Rule

- Khi sửa file, để lại file sạch hơn lúc vào. Sửa typo, gỡ dead code, đổi tên rõ hơn nếu thấy.

---

# Hàm (Functions)

- Ngắn. Lý tưởng ≤ 30 dòng. Quá 50 dòng → review lại có tách được không.
- ≤ 3 tham số. Qua 3 → gom thành object (đặc biệt khi có nhiều optional).
- Không flag boolean làm tham số phân nhánh (`fetch(url, true)`). Tách thành 2 hàm hoặc dùng options object.
- No side-effect ẩn: hàm tên `get*` không được mutate state / ghi DB / gọi API ngoài.
- Pure function khi có thể. Side-effect cô đặc ở layer ngoài (handler, worker).
- Early return / guard clause. Tránh nesting sâu > 2 cấp.

---

# Types & Validation

- Dùng TypeScript nghiêm ngặt. Không `any` (dùng `unknown` + narrow). Không `as` trừ khi thực sự cần + comment lý do.
- Zod schema là source of truth cho input từ HTTP. Infer type từ schema (`z.infer<typeof schema>`), không khai báo type trùng lặp.
- DTO (response) tách khỏi entity DB qua `extract.ts` — không trả thẳng row DB ra API.
- Không export type mà không ai dùng. Không tạo union type "cho đầy".

---

# Error handling

- Không `try/catch` rồi nuốt error (`catch {}`). Ít nhất log + rethrow hoặc xử lý có ý nghĩa.
- Error nghiệp vụ → throw class Error cụ thể (hoặc code lỗi rõ), không throw string.
- Ở API layer: catch ở top-level, trả response chuẩn (status + message), không leak stack ra production.
- Async: luôn handle rejection. Không `Promise` floating.

---

# React / UI

- Component nhỏ, ≤ ~150 dòng. UI phức tạp → tách sub-component.
- State dùng zustand store (`lib/counter-store.ts` pattern) hoặc local. Không prop drilling quá 2 cấp.
- Side-effect trong `useEffect` phải có cleanup + dependency đúng. Không `useEffect` với `[]` mà gọi API không cancel.
- Styling theo `@stylexjs/stylex` + theme `@astryxdesign`. Không inline style trừ dynamic value.
- Không logic nghiệp vụ trong component. Component chỉ render + gọi service/API.

---

# DB / Drizzle

- Schema ở `features/*/api/schema.ts` hoặc `lib/db/`. Không định nghĩa schema rải rác.
- Query ở `queries.ts`. Không viết raw SQL rải rác trong handler.
- Transaction khi cần atomic. Không quên.
- Migration qua `pnpm db:generate` + `pnpm db:migrate`. Không sửa migration đã chạy.

---

# Trước khi commit code

1. `pnpm typecheck` — phải pass.
2. `pnpm lint` — phải pass. `pnpm lint:fix` nếu có fixable.
3. `pnpm fmt:check` — phải pass. `pnpm fmt` để format.
4. Không commit `console.log` / debug code. Log dùng logger có cấu trúc, không `console.log` rải rác.
5. Không commit file sinh ra (`routeTree.gen.ts`, `.output/`, `dist/`).
6. Dead code = xóa. Commented-out code = xóa (git đã lưu lịch sử).

---

# Review checklist (tự check trước khi trả kết quả)

- [ ] Có đoạn nào lặp logic đã có ở file/module khác không?
- [ ] File này có > 1 trách nhiệm không? Có nghiệp vụ không liên quan lẫn vào không?
- [ ] Tên biến/hàm/file có tự giải thích không? Có `data/temp/x/handle` không?
- [ ] Hàm nào quá dài / nesting sâu / > 3 tham số?
- [ ] Có `any` / `as` không cần thiết không?
- [ ] Có side-effect ẩn trong hàm `get*` không?
- [ ] Có `console.log` / dead code / commented code không?
- [ ] Layer phụ thuộc có ngược không? (`lib` import `features`? `api` import `routes`?)
- [ ] Type có trùng lặp với zod schema không (nên infer)?
- [ ] `typecheck` + `lint` + `fmt:check` pass chưa?

> Nếu bất kỳ ô nào fail → FIX TRƯỚC khi trả kết quả. Không "để sau".
