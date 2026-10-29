# OVE — AI-Powered Search & Analytical Engine

> Search everything. Own your universe.

OVE is a next-generation AI-powered search portal and content discovery engine built with **React 19**, **TanStack Start**, **Nitro**, and Meta's **StyleX**. It pairs semantic web search with real-time AI synthesis, dynamic chart visualizations, automated web crawling, and background queue workers.

---

## 📸 Demo Preview

### Home Search

![OVE Home Search](docs/demo-home.png)

### Synthesized Search Results & Analysis

![OVE Search Results](docs/demo-results.png)

---

## 🚀 Key Features

- **Intelligent Search Synthesis**: Aggregates web data with Exa API and generates deep, structured analysis using LLMs (via Vercel AI SDK).
- **Interactive Visualizations**: Embedded SVG charts (Bar, Line, Pie) rendered dynamically based on AI analytical insights.
- **Source Verification & Credibility**: Computes source credibility scores and provides granular citations for full transparency.
- **High-Performance SSR & Streaming**: Server-Side Rendering and streaming with TanStack Start running on the Nitro server runtime.
- **Zero-Runtime Styling**: Compiled CSS using Meta's StyleX for optimal performance and atomic styling.
- **Robust Background Processing**: Distributed background queue workers powered by BullMQ and Redis for page crawling, feed discovery (RSS, Atom, JSON, Sitemaps), and social account updates.

---

## 🛠 Tech Stack

| Domain                 | Technologies                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Framework & SSR**    | [TanStack Start](https://tanstack.com/start), [TanStack Router](https://tanstack.com/router), [Nitro](https://nitro.unjs.io/)                                                                          |
| **Frontend UI**        | [React 19](https://react.dev/), [StyleX](https://stylexjs.com/), [Lucide React](https://lucide.dev/), [Zustand](https://github.com/pmndrs/zustand)                                                     |
| **Toolchain & Linter** | [Vite+](https://vitejs.dev/), [Oxlint](https://oxc.rs/docs/guide/usage/linter.html), [Oxfmt](https://oxc.rs/), [TypeScript](https://www.typescriptlang.org/)                                           |
| **AI & Search**        | [Vercel AI SDK](https://sdk.vercel.ai/docs), [Exa Search API](https://exa.ai/)                                                                                                                         |
| **Database & ORM**     | [PostgreSQL](https://www.postgresql.org/), [Drizzle ORM](https://orm.drizzle.team/), `drizzle-kit`                                                                                                     |
| **Queues & Workers**   | [BullMQ](https://bullmq.io/), [Redis](https://redis.io/) (`ioredis`)                                                                                                                                   |
| **Scraping & Parsing** | [Playwright Core](https://playwright.dev/), [Mozilla Readability](https://github.com/mozilla/readability), [Turndown](https://github.com/mixmark-io/turndown), [JSDOM](https://github.com/jsdom/jsdom) |
| **Object Storage**     | Cloudflare R2 / AWS S3 (`@aws-sdk/client-s3`)                                                                                                                                                          |

---

## 📏 Code Quality & Anti-God Standards

This codebase enforces strict linting with **Oxlint** and formatting with **Oxfmt** under `vite-plus` to ensure maintainability and eliminate "god objects":

- **File Length Limit**: Max 300 lines per file (`eslint/max-lines: error`).
- **Function Length Limit**: Max 80 lines per function (`eslint/max-lines-per-function: error`).
- **Single Responsibility**: Max 1 class per file (`eslint/max-classes-per-file: error`), no extraneous static-only classes (`unicorn/no-static-only-class: error`).
- **Functional Paradigm**: Prefer functional React components (`react/prefer-function-component: error`).

Run the automated checks anytime:

```bash
pnpm check      # Runs oxlint and type check
pnpm lint       # Runs oxlint rules
pnpm fmt:check  # Verifies formatting with oxfmt
```

---

## ⚙️ Setup & Installation

### 1. Prerequisites

- **Node.js**: v22.x or v24.x
- **Package Manager**: `pnpm` (v10 or v11)
- **PostgreSQL**: v15+ (with `pgvector` or relevant extensions if enabled)
- **Redis**: v6+ (required for BullMQ background queues)

### 2. Clone Repository & Submodules

```bash
git clone --recurse-submodules git@github.com:nhatnice/onie-search.git
cd onie-search
```

### 3. Environment Configuration

Copy the sample environment file and populate your credentials:

```bash
cp .env.example .env
```

Key environment variables:

```dotenv
# Database & Cache
DATABASE_URL=postgresql://user:password@localhost:5432/portal
REDIS_URL=redis://localhost:6379

# Search & AI
EXA_API_KEY=your_exa_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1 # or https://openrouter.ai/api/v1
OPENAI_MODEL=gpt-4o-mini

# Object Storage (Cloudflare R2 / S3)
R2_ACCOUNT_ID=your_account_id
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET=your_bucket_name
R2_PUBLIC_URL=https://r2.yourdomain.com
```

### 4. Install Dependencies

```bash
pnpm install
```

### 5. Database Setup & Migrations

```bash
# Push schema or run migration scripts
pnpm db:push
pnpm db:migrate

# (Optional) Seed initial data
pnpm db:seed
```

### 6. Start Development Server

```bash
pnpm dev
```

The application will be running at [http://localhost:3000](http://localhost:3000).

---

## 📦 Available Scripts

| Command           | Description                                               |
| ----------------- | --------------------------------------------------------- |
| `pnpm dev`        | Starts the Vite+ / Nitro development server               |
| `pnpm build`      | Compiles the client bundle, SSR build, and Nitro server   |
| `pnpm start`      | Runs the production build (`.output/server/index.mjs`)    |
| `pnpm typecheck`  | Runs TypeScript compilation verification (`tsc --noEmit`) |
| `pnpm lint`       | Audits the codebase with Oxlint                           |
| `pnpm lint:fix`   | Automatically fixes autofixable Oxlint issues             |
| `pnpm fmt`        | Formats all code using Oxfmt                              |
| `pnpm fmt:check`  | Checks code formatting conformity                         |
| `pnpm check`      | Runs full static analysis checks (typecheck + oxlint)     |
| `pnpm db:push`    | Pushes Drizzle ORM schema directly to database            |
| `pnpm db:migrate` | Runs migration scripts                                    |
| `pnpm db:seed`    | Seeds database with initial feeds & data                  |

---

## 🔄 Nitro Background Tasks & Workers

Nitro tasks can be manually triggered via HTTP endpoints during development:

```bash
# Dispatch social cookie check task
curl -X POST http://localhost:3000/_nitro/tasks/dispatch-cookies

# Dispatch feed discovery worker task
curl -X POST http://localhost:3000/_nitro/tasks/dispatch-feeds
```

Background queues operate continuously when Redis is connected and worker processes are dispatched.

---

## 📄 License

Private & proprietary.
