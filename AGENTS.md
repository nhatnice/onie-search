# Agent Guidelines

## Các điều cần lưu ý (Essentials)

- **Công nghệ sử dụng (Stack):** TypeScript + React (TanStack Start), cùng với Drizzle ORM, astryxdesign.
- Sử dụng `lucide-react` cho các icon giao diện (dùng hậu tố `Icon`, ví dụ: `import { Loader2Icon } from "lucide-react"`); đối với icon thương hiệu thì sử dụng `@icons-pack/react-simple-icons` (ví dụ: `SiGithub`).
- **Code tự document itself.** Tên biến/hàm/field phải tự giải thích. Comment chỉ khi cần giải thích WHY (lý do, trade-off, nguồn research) — KHÔNG giải thích WHAT (code đã nói rồi). Không viết JSDoc/`ponytail:` cho code hiển nhiên.

## Hướng dẫn theo từng chủ đề (Topic-specific Guidelines)

- [Clean Code](.agents/clean-code.md) - Nguyên tắc cốt lõi (DRY, SRP, SoC, YAGNI, Boy Scout), hàm, types & validation, error handling, React/UI, DB/Drizzle, trước khi commit, review checklist.
- [Naming](.agents/naming.md) - Quy ước đặt tên file, biến, hàm, type, component; tên tự giải thích; đồng nhất thuật ngữ.
- [TanStack patterns](.agents/tanstack-patterns.md) - Routing (định tuyến), data fetching (lấy dữ liệu), loaders, server functions, environment shaking.
- [Auth patterns](.agents/auth.md) - Route guards (bảo vệ định tuyến), middleware, các tiện ích xác thực (auth utilities).
- [TypeScript conventions](.agents/typescript.md) - Quy tắc ép kiểu (casting rules), ưu tiên tự động suy luận kiểu (type inference).
- [Workflow](.agents/workflow.md) - Các lệnh trong quy trình làm việc (workflow commands), phương pháp xác thực (validation approach).

## Cấu trúc file & module

### Tổ chức thư mục (bắt buộc tuân thủ)

Project dùng **feature-based structure**: mỗi feature tự trị, gói đủ API + UI + hooks + views. Routes chỉ lo routing config. Layout lấy cảm hứng từ feature-driven architecture (Next.js app router, Vite+ monorepo pattern).

```
src/
├── routes/                # TanStack Router file-based routing — CHỈ route definition (export const Route)
│   ├── __root.tsx         # Root layout — wrap toàn app
│   ├── _guest/            # Route group công khai (login, signup, ...) — không cần đăng nhập
│   │   ├── _layout.tsx  # Pathless layout wrap các _guest routes
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   ├── forgot-password.tsx
│   │   ├── reset-password.tsx
│   │   └── verify-email.tsx
│   ├── _auth/          # Route group cần đăng nhập
│   │   ├── _layout.tsx # Pathless layout wrap các _auth routes (sidebar, header)
│   │   ├── index.tsx         # / (dashboard)
│   │   ├── settings.tsx         # /settings
│   │   └── bookmarks/
│   │       ├── index.tsx         # /bookmarks
│   │       └── $bookmarkId.tsx    # /bookmarks/:bookmarkId
│   └── api/**/$.tsx     # Server routes
│
├── features/              # Feature modules — mỗi feature tự trị (KHÔNG import feature khác)
│   └── feature-1/         # Feature 1
│       ├── api/           # Server-side
│       │   ├── functions.ts   # createServerFn wrappers (client-safe RPC bridge)
│       │   ├── mutations.ts   # Mutations
│       │   ├── queries.ts     # DB queries (pure — không side-effect, không emit event)
│       │   ├── services/      # Application services — orchestrate queries + side-effects (Inngest emit, R2 upload, ...)
│       │   └── index.ts       # API barrel
│       ├── components/    # UI components render-only (auth-layout)
│       ├── schemas/       # zod schemas (client-safe)
│       ├── constants/
│       ├── utils/
│       ├── hooks/
│       ├── views/         # Page-level (login-view, signup-view, ...)
│       └── index.ts       # Feature root barrel
│
├── constants/             # Global constants
├── components/            # Global components
├── hooks/                 # Global Hooks
├── types/                 # Global types
├── lib/                   # Global utils, helper, client.
│
├── db/                    # Database infrastructure (top-level)
│   ├── schema.ts          # Drizzle schema (pgTable, pgEnum, columns, references) — re-export từ features/*/api/schema.ts
│   ├── client.ts          # drizzle client init (postgres + drizzle)
│   ├── errors.ts          # Postgres SQLSTATE helpers (isUniqueConstraintViolation, ...)
│   └── index.ts           # Barrel — re-export schema + errors + db client
│
├── redis/                 # Redis infrastructure (top-level) — BullMQ connection, cache, pub/sub
│   ├── client.ts          # IORedis singleton + getRedisConnection()
│   └── index.ts
│
├── crawl/                 # Crawl infrastructure (top-level) — HTTP fetcher + content parser
│   ├── adapters/          # CrawlerAdapter implementations (playwright, browserless-content, ...)
│   ├── extractors/        # Content extractors (html, sitemap, ...)
│   ├── types.ts
│   └── index.ts
│
├── storage/               # Object Storage infrastructure (top-level) — R2 (S3-compatible)
│   ├── adapter.ts         # ObjectStorage interface + UploadResult
│   ├── r2.ts              # R2 adapter (@aws-sdk/client-s3)
│   ├── client.ts          # S3Client singleton (R2 endpoint)
│   ├── dedup.ts           # uploadWithDedup() — SHA-256 check, return existing path nếu trùng
│   └── index.ts
│
├── inngest/               # Inngest event-driven infrastructure (top-level)
│   ├── client.ts          # Inngest singleton + PortalEvents type
│   ├── functions/         # inngest.createFunction handlers (page-crawl, ...)
│   └── index.ts
│
├── runtime/               # Nitro runtime code (top-level) — server-side glue
│   ├── plugins/           # Nitro plugins (worker bootstrap, lifecycle hooks)
│   ├── tasks/             # Nitro tasks (cron + manual: db:migrate, crawl:enqueue, ...)
│   └── middleware/        # Server middleware (auth, rate limit, logging — tương lai)
│
├── styles/                # Global CSS, theme tokens
├── router.tsx             # Router instance setup
└── routeTree.gen.ts       # AUTO-GENERATED — KHÔNG edit tay
```

### Phân lớp top-level (infrastructure vs utilities vs features)

Top-level chia 3 nhóm, **một chiều** từ dưới lên:

| Lớp                | Thư mục                               | Vai trò                                                                | Phụ thuộc              |
| ------------------ | ------------------------------------- | ---------------------------------------------------------------------- | ---------------------- |
| **Infrastructure** | `db/`, `redis/`, `crawl/`, `runtime/` | Driver, client, server-side glue. Biết về protocol/service cụ thể.     | `lib/` (pure utils)    |
| **Features**       | `features/*`                          | Business logic + data + UI. Orchestrate infrastructure.                | `lib/`, infrastructure |
| **Routing**        | `routes/`                             | UI shell + route guards.                                               | `features/*`, `lib/`   |
| **Utilities**      | `lib/`                                | Pure functions, helpers. Không side-effect, không biết infrastructure. | —                      |

**Quy tắc vàng**: Infrastructure KHÔNG import features/routes. Features KHÔNG import routes. Lib KHÔNG import bất kỳ thứ gì ở trên.

### Service layer (trong features)

Mỗi feature có 2 tầng trong `api/`:

| Tầng         | Vai trò                                                                                                                                                                                 | Side-effect |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| `queries.ts` | DB read/write (pure) — insert, update, select. Trả về data, không emit event, không gọi R2/Inngest.                                                                                     | KHÔNG       |
| `services/`  | Orchestrate queries + side-effects (Inngest emit, R2 upload, multi-step workflows). Caller (worker, task, Inngest function) gọi service, không gọi query trực tiếp khi cần side-effect. | CÓ          |

Quy tắc:

- `queries.ts` nhận `db: DbOrTx` qua param (testable, transaction-composable).
- Service nhận `db: DbOrTx` qua param, gọi queries, rồi emit event / upload R2 **sau khi DB commit**.
- Event emit trong service là fire-and-forget (`void inngest.send(...).catch(log)`) — DB write đã commit, Inngest outage không abort.
- Cross-feature: feature A cần ghi vào table của feature B → gọi service của B, KHÔNG import queries/schema của B trực tiếp. VD: `pages` cần insert feeds → gọi `insertFeedLinks` từ `feed-sources/api/services/feed-service`.

### Object Storage

- `src/storage/` — R2 (S3-compatible) abstraction. `ObjectStorage` interface + R2 adapter (`@aws-sdk/client-s3`).
- Upload có dedup: SHA-256 hash check against `page_contents.blob_hash` qua `uploadWithDedup()`. Duplicate → return existing `blobPath` (không re-upload).
- **Lưu relative-path trong DB** (`page_contents.blob_path` — vd `pages/<id>/page/text.html`), **build full URL runtime** qua `R2_PUBLIC_URL` env. Không lưu full URL (env-agnostic, dễ migrate bucket/domain).
- Env: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`.

### Inngest

- `src/inngest/` — event-driven infra. `Inngest` client + step functions.
- Serve endpoint: `src/runtime/routes/inngest.ts` — Nitro route mount tại `/api/inngest` qua `inngest/nitro` adapter.
- Local dev: `pnpm inngest:dev` chạy Inngest dev server trỏ về `http://localhost:3000/api/inngest`.
- Inngest tự lưu event log — KHÔNG cần table events riêng.

### Export

- Mỗi module có 1 mục đích rõ ràng, export tối thiểu cần thiết.
- Prefer named export. Default export chỉ cho UI component.
- Barrel `index.ts` chỉ khi thực sự gom nhiều module; không tạo barrel rỗng.

### Design Patterns (tham khảo thực tế)

#### Strategy lookup table — khi có nhiều `if (X.matches(input)) return X`

**Anti-pattern:** Factory/selectors với nhiều nhánh `if` lặp, mỗi nhánh gọi `matches()` rồi return strategy.

```ts
// ❌ DRY violation — 6 cặp if/return, thêm strategy = sửa 2 hàm
export function findPageExtractor(ct: string): PageExtractor {
  if (sitemapExtractor.matches(ct)) return sitemapExtractor;
  if (htmlExtractor.matches(ct)) return htmlExtractor;
  return htmlExtractor;
}
export function findFeedExtractor(ct: string): FeedExtractor {
  if (rssExtractor.matches(ct)) return rssExtractor;
  if (atomExtractor.matches(ct)) return atomExtractor;
  // ...
  return sitemapExtractor;
}
```

**Pattern:** Mỗi strategy implement cùng interface (method `matches()`). Khai báo order matching trong array. Generic `firstMatch()` duyệt array, trả strategy đầu tiên match. Caller giữ fallback tường minh.

```ts
// ✅ DRY — thêm strategy = push 1 dòng vào array, không sửa logic
const pageExtractors: readonly PageExtractor[] = [sitemapExtractor, htmlExtractor];
const feedExtractors: readonly FeedExtractor[] = [
  rssExtractor,
  atomExtractor,
  jsonFeedExtractor,
  sitemapExtractor,
];

function firstMatch<T extends { matches: (input: string) => boolean }>(
  candidates: readonly T[],
  input: string,
): T | undefined {
  return candidates.find((e) => e.matches(input));
}

export function findPageExtractor(ct: string): PageExtractor {
  return firstMatch(pageExtractors, ct) ?? htmlExtractor;
}
export function findFeedExtractor(ct: string): FeedExtractor {
  return firstMatch(feedExtractors, ct) ?? sitemapExtractor;
}
```

**Dùng khi:** Factory pattern với selection dựa trên predicate (content-type, file extension, format...), ≤ 5 strategies. **KHÔNG dùng khi:** 1-2 strategy (if/else trực tiếp đơn giản hơn — YAGNI), selection cần context phức tạp (không chỉ 1 predicate), strategy có side-effect/order-dependent phức tạp (tường minh dễ debug hơn).

**Case thực tế:** `src/crawl/extractors/factory.ts` — 5 extractors (sitemap, html, rss, atom, json-feed) route theo content-type, 2 factory functions (page + feed).

#### Extract step functions — khi 1 hàm gộp nhiều trách nhiệm (SRP violation)

**Triệu chứng:** Hàm dài > 40 dòng, gộp 3+ trách nhiệm (fetch + transform + persist + log), khó test từng bước độc lập. Thường thấy ở worker/job handler.

**Anti-pattern:** 1 hàm làm hết — orchestration (try/catch, status tracking) + business logic (canonicalize, filter) + I/O (DB insert) + observability (log timing) lẫn vào nhau.

```ts
// ❌ SRP violation — processJob gộp 4 trách nhiệm, 52 dòng, khó test từng bước
async function processJob(job: Job) {
  const { feedId, url } = job.data;
  await markFeedScanning(db, feedId);
  try {
    const response = await crawler.crawl(url);                    // fetch
    const result = findFeedExtractor(response.contentType).extractFeed(response);  // extract
    const canonicalPages = result.links.map(canonicalizeUrl).filter(passFilter);  // transform
    const canonicalFeeds = result.feeds.map(...).filter(...);
    const [pagesAdded, feedsAdded] = await Promise.all([          // persist
      insertDiscoveredPages(db, canonicalPages),
      insertFeeds(db, canonicalFeeds),
    ]);
    await markFeedScanned(db, feedId);
    return { feedId, pagesAdded, feedsAdded };
  } catch (err) {
    await markFeedFailed(db, feedId);
    throw err;
  }
}
```

**Pattern:** Tách thành các step function, mỗi hàm 1 trách nhiệm. Orchestration hàm chỉ lo flow (try/catch + status), delegate logic cho step functions.

```ts
// ✅ SRP — 3 hàm, mỗi hàm 1 việc, test được độc lập
async function fetchAndExtract(url: string): Promise<ExtractedFeeds> {
  const response = await crawler.crawl(url);
  const result = findFeedExtractor(response.contentType).extractFeed(response);
  return {
    links: result.links.map(canonicalizeUrl).filter(passFilter),
    feeds: result.feeds.map(...).filter(...),
  };
}

async function persist(db: Db, feedId: string, extracted: ExtractedFeeds): Promise<Result> {
  const [pagesAdded, feedsAdded] = await Promise.all([
    insertDiscoveredPages(db, extracted.links),
    insertFeeds(db, extracted.feeds),
  ]);
  await markFeedScanned(db, feedId);
  return { pagesAdded, feedsAdded };
}

async function processJob(job: Job): Promise<JobResult> {
  const { feedId, url } = job.data;
  const db = getDefaultDb();
  await markFeedScanning(db, feedId);
  try {
    const extracted = await fetchAndExtract(url);
    const result = await persist(db, feedId, extracted);
    return { feedId, ...result };
  } catch (err) {
    await markFeedFailed(db, feedId);
    throw err;
  }
}
```

**Quy tắc:** Hàm = 1 trách nhiệm. Nếu hàm làm 3+ việc (fetch + transform + persist), tách thành step functions. Orchestration hàm chỉ lo flow control (try/catch, status), không lo business logic.

**KHÔNG split file** khi logic tuần tự, file < 150 dòng, mỗi step function test được độc lập. Split file = overkill, làm code khó follow hơn. SRP fix ở mức hàm, không phải mức file.

**Dùng khi:** Hàm > 40 dòng + gộp 3+ trách nhiệm + khó test từng bước. **KHÔNG dùng khi:** Hàm < 30 dòng hoặc chỉ 1-2 trách nhiệm (YAGNI — extract thừa).

**Case thực tế:** `src/features/feed-sources/api/worker.ts` — `processJob` 52 dòng gộp fetch+extract+canonicalize+filter+persist → tách thành `fetchAndExtract()` + `persist()` + `processJob()` (orchestration).

#### Layer placement — đặt module đúng tầng kiến trúc

**Vấn đề:** Module có side-effect (HTTP I/O, DB, cache) nằm sai tầng — đặt trong `lib/` (pure utilities, không side-effect). Hoặc folder name quá generic (`filter/`, `utils/`, `helpers/`) không nói lên concern + layer.

**Triệu chứng:** `lib/filter/robots.ts` — `robots.txt` check cần HTTP fetch + per-host cache (side-effect), nhưng nằm trong `lib/` (utilities layer yêu cầu pure, không biết infrastructure).

**Nguyên tắc:** Phân lớp top-level một chiều (xem bảng "Phân lớp top-level" ở trên). Mỗi tầng có vai trò + dependency rule:

- `lib/` — pure functions, không side-effect, không import infrastructure
- `crawl/`, `db/`, `redis/` — infrastructure, biết protocol/service cụ thể, CÓ side-effect
- `features/*` — orchestrate infrastructure, không import feature khác

**Anti-pattern:**

```
src/lib/filter/robots.ts     # ❌ HTTP fetch + cache trong lib/ (pure layer)
src/lib/filter/noindex.ts    # ❌ crawl policy trong lib/ (generic folder)
```

**Pattern:** Move về đúng layer + đặt tên tường minh (concern + layer):

```
src/crawl/policies/robots.ts   # ✅ crawl policy, infrastructure layer
src/crawl/policies/noindex.ts   # ✅ crawl policy, infrastructure layer
```

**Quy tắc:**

1. **Side-effect quyết định layer.** HTTP/DB/Redis I/O → infrastructure (`crawl/`, `db/`, `redis/`). Pure logic → `lib/`.
2. **Folder name = concern + layer.** `lib/filter/` mơ hồ (filter gì? layer nào?). `crawl/policies/` rõ ngay (crawl policy, infrastructure).
3. **KHÔNG dùng generic names** (`filter/`, `utils/`, `helpers/`, `common/`) — mix concerns khi scale, khó tìm code.
4. **Barrel export** từ layer root (`crawl/index.ts`) — consumer import 1 chỗ, không cần biết file nội bộ.

**Dùng khi:** Module có side-effect nhưng nằm trong pure layer, HOẶC folder name không nói lên concern. **KHÔNG dùng khi:** Module đã đúng layer + tên rõ ràng (don't fix what works).

**Case thực tế:** `src/lib/filter/{robots,noindex}.ts` → `src/crawl/policies/{robots,noindex}.ts`. `robots.txt` check = HTTP fetch (side-effect) → infrastructure, không thuộc `lib/` (pure). `policies/` tường minh hơn `filter/` (crawl policy check, không generic filter).

### Quy tắc Research (bắt buộc)

**Trước khi setup/config/thêm feature cho bất kỳ framework/library nào, PHẢI đọc docs chính thức trước.**

1. **Đọc docs chính thức** — TanStack Start, Nitro, Drizzle, BullMQ, Vite+. Không dựa vào memory. Không copy-paste config cũ.
2. **Kiểm tra version hiện tại** — docs có thể khác giữa versions. Dùng Context7 MCP để fetch docs mới nhất.
3. **Understand config structure** — biết cái gì là plugin vs top-level option, thứ tự plugin matters không.
4. **KHÔNG dùng `@ts-expect-error`** để che giấu lỗi type — nếu cần, nghĩa là config sai hoặc thiếu type definitions.
5. **Khi lỗi xảy ra**: tìm root cause, KHÔNG workaround. Workaround = technical debt + lỗi lặp lại.
6. **Verify end-to-end** sau khi setup — chạy command thực tế, không chỉ `typecheck` pass rồi cho là xong.

### Nitro Integration (vite.config.ts)

Nitro được tích hợp qua `nitro()` plugin từ `nitro/vite`, **KHÔNG** phải top-level object.

```ts
// ✅ ĐÚNG
import { nitro } from 'nitro/vite';

plugins: [tanstackStart(), nitro({ ...options }), viteReact()]

// ❌ SAI — nitro: là top-level object, không được Vite nhận diện như plugin
nitro: { ... }
```

Quy tắc:

- `nitro()` **phải** nằm trong `plugins` array, sau `tanstackStart()`.
- Config (`experimental`, `database`, `scheduledTasks`, `rollupConfig`, `tasks`, `plugins`) truyền vào `nitro()` làm argument.
- Tasks ở `src/runtime/tasks/` — **KHÔNG** nằm trong Nitro default scan path (`tasks/` ở root). Phải register thủ công bằng absolute path:

  ```ts
  import { dirname, resolve } from 'node:path';
  import { fileURLToPath } from 'node:url';
  const __dirname = dirname(fileURLToPath(import.meta.url));

  nitro({
    tasks: {
      'db:migrate': { handler: resolve(__dirname, 'src/runtime/tasks/db-migrate.ts') },
      ...
    },
    plugins: [resolve(__dirname, 'src/runtime/plugins/page-crawl-worker.ts')],
  })
  ```

- **KHÔNG** dùng `@ts-expect-error` cho `nitro` property — nếu cần, nghĩa là config sai.

### Chạy Tasks (CLI vs HTTP)

Vite+ KHÔNG init `NitroDevApp` → `nitro task run` CLI KHÔNG hoạt động (fail với "Missing info file: nitro.dev.json").

Có 2 cách chạy tasks:

1. **CLI scripts** (qua `pnpm db:migrate` etc.) — dùng `tsx`:

   ```json
   "db:migrate": "node --env-file-if-exists=.env --import tsx scripts/db-migrate.ts"
   ```
   - Không cần dev server chạy.
   - Scripts ở `scripts/` folder, gọi logic từ `@/features/*/api/`.
   - Phù hợp: migration, seed, one-shot scripts.

2. **HTTP endpoint** (qua `POST /_nitro/tasks/:name`) — qua dev server:
   ```bash
   # Terminal 1
   pnpm dev
   # Terminal 2
   curl -X POST http://localhost:3000/_nitro/tasks/db:seed
   ```
   - Cần `pnpm dev` chạy song song.
   - Tasks phải được register trong `nitro({ tasks: {...} })`.
   - Phù hợp: webhook từ external service, scheduled tasks qua cron job gọi HTTP.

Scheduled tasks (cron) trong `nitro({ scheduledTasks: {...} })` chỉ chạy khi Nitro standalone dev server (`nitro dev`), KHÔNG chạy trong Vite+ dev. Để schedule thực sự, dùng external cron + HTTP endpoint.

<!-- intent-skills:start -->

## Skill Loading

Before editing files for a substantial task:

- Run `pnpm dlx @tanstack/intent@latest list` from the workspace root to see available local skills.
- If a listed skill matches the task, run `pnpm dlx @tanstack/intent@latest load <package>#<skill>` before changing files.
- Use the loaded `SKILL.md` guidance while making the change.
- Monorepos: when working across packages, run the skill check from the workspace root and prefer the local skill for the package being changed.
- Multiple matches: prefer the most specific local skill for the package or concern you are changing; load additional skills only when the task spans multiple packages or concerns.
<!-- intent-skills:end -->

<!-- gitnexus:start -->

# GitNexus — Code Intelligence

This project is indexed by GitNexus as **portal** (228 symbols, 452 relationships, 15 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "main"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource                                | Use for                                  |
| --------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/portal/context`        | Codebase overview, check index freshness |
| `gitnexus://repo/portal/clusters`       | All functional areas                     |
| `gitnexus://repo/portal/processes`      | All execution flows                      |
| `gitnexus://repo/portal/process/{name}` | Step-by-step execution trace             |

## CLI

| Task                                         | Read this skill file                                        |
| -------------------------------------------- | ----------------------------------------------------------- |
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md`       |
| Blast radius / "What breaks if I change X?"  | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?"             | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md`       |
| Rename / extract / split / refactor          | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md`     |
| Tools, resources, schema reference           | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md`           |
| Index, status, clean, wiki CLI commands      | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md`             |

<!-- gitnexus:end -->

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
