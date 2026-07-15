# Search Engine Crawl

Tài liệu trích từ `SEARCH_ENGINE_BOT.md` — tập trung vào cơ chế **crawl**: budget, rào cản kỹ thuật, Mercator, frontier, robots.txt, soft 404.

> Mục lục:
>
> - [2. Thuật toán Tối ưu hóa Crawl Budget](#2-thuật-toán-tối-ưu-hóa-crawl-budget)
> - [3. Xử lý Rào cản Kỹ thuật](#3-xử-lý-rào-cản-kỹ-thuật)
> - [13. Mercator Crawler — Kiến trúc Tham chiếu](#13-mercator-crawler--kiến-trúc-tham-chiếu)
> - [14. Robots.txt và X-Robots-Tag — Cách Xử lý](#14-robotstxt-và-x-robots-tag--cách-xử-lý)
> - [15. Soft 404 — Nhận diện Trang 404 Giả Mạo 200 OK](#15-soft-404--nhận-diện-trang-404-giả-mạo-200-ok)
> - [19–26. Crawl Frontier — Cách URL Được Sắp Xếp & Ưu Tiên Crawl](#1926-crawl-frontier--cách-url-được-sắp-xếp--ưu-tiên-crawl)

---

## 2. Thuật toán Tối ưu hóa Crawl Budget

Crawl budget không phải một con số cố định mà là hàm của nhiều biến số:

| Yếu tố                          | Mô tả kỹ thuật                                                                                                                                                               |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Host load / Server response** | Googlebot không truy cập site quá ~1 lần vài giây trung bình. Nếu server chậm/timeout, crawl rate tự giảm. Webmaster có thể yêu cầu giảm crawl rate qua Search Console [^1]. |
| **Crawl rate limit**            | Giới hạn số kết nối đồng thời + độ trễ giữa các request, điều chỉnh theo sức chịu đựng của host.                                                                             |
| **Crawl demand**                | Độ "đáng crawl" của URL — phụ thuộc PageRank, độ tươi (freshness), và lịch sử thay đổi nội dung.                                                                             |
| **Content Freshness**           | Trang thay đổi thường xuyên được crawl lại thường xuyên hơn. Hệ thống "query deserves freshness" ưu tiên nội dung mới cho query nhạy cảm thời gian (tin tức, sự kiện) [^3].  |
| **PageRank**                    | Trang có PageRank cao (nhiều backlink chất lượng) được ưu tiên crawl và re-crawl. PageRank vẫn là một core ranking system từ khi Google ra mắt [^3].                         |

**Crawl budget = min(crawl rate limit, crawl demand)**. Với site nhỏ (< vài nghìn URL), crawl budget hiếm khi là vấn đề. Với site lớn (triệu URL), cấu trúc nội bộ và robots.txt quyết định URL nào được tiêu thụ budget [^2].

---

## 3. Xử lý Rào cản Kỹ thuật

### 3.1. JavaScript Rendering — WRS (Web Rendering Service)

- Từ tháng 5/2019, Googlebot dùng **evergreen WRS** — tự động cập nhật lên phiên bản Chromium stable mới nhất, hỗ trợ đầy đủ ES6+ [^2].
- Quy trình render hai giai đoạn (two-wave crawling) [^13]:
  1. **Wave 1**: Crawl HTML tĩnh, parse nội dung, link, structured data.
  2. **Wave 2**: Đưa URL vào hàng đợi render, WRS chạy Chromium headless, execute JS, fetch resource (CSS/JS) riêng từng file, rồi parse lại DOM đã render [^1].
- Mỗi resource (CSS, JS) được fetch riêng và chịu cùng giới hạn kích thước file.
- **Dynamic Rendering** (workaround, không phải giải pháp dài hạn): server phát hiện bot và trả HTML pre-rendered, trả JS cho user thật. Google khuyến nghị SSR/SSG thay vì dynamic rendering [^1].

### 3.2. Giới hạn kích thước file

- Googlebot crawl tối đa **2MB** đầu của file loại được hỗ trợ, **64MB** cho PDF. Vượt cutoff, Googlebot dừng fetch và chỉ gửi phần đã download cho indexing [^1].

### 3.3. Robots.txt & Meta Tags

- `robots.txt`: kiểm soát **crawl** (có được fetch không), không kiểm soát **index**.
- `noindex` meta tag / `X-Robots-Tag`: kiểm soát **index**, không ngăn crawl.
- Password protection: chặn cả crawler lẫn user [^1].

### 3.4. Mobile-first indexing

Google hoàn tất chuyển đổi mobile-first indexing cho toàn bộ web vào cuối 2023 — phần lớn crawl request dùng Googlebot Smartphone, thiểu số dùng Desktop [^1][^2].

---

## 13. Mercator Crawler — Kiến trúc Tham chiếu

Mercator (1999) là web crawler tham chiếu được thiết kế bởi **Allan Heydon và Marc Najork** tại DEC/Compaq Systems Research Center [^9][^10]. Dù hơn 25 năm tuổi, kiến trúc Mercator vẫn là nền tảng cho mọi production crawler hiện đại.

### 13.1. Các thành phần chính

```
┌─────────────────────────────────────────────────────────┐
│                    Mercator Architecture                │
│                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────┐    │
│  │ Frontier │ →  │  URL Stream  │ →  │  Per-host    │    │
│  │  (heap)  │    │   Servers    │    │  Queues      │    │
│  └──────────┘    └──────────────┘    └──────────────┘    │
│       ↑                                       │         │
│       │ extract URLs            dispatch next │         │
│       │                                       ↓         │
│  ┌──────────────┐                    ┌──────────────┐   │
│  │  Downloader  │ ←────────────────── │   Workers    │   │
│  │ (HTML parse) │                    │  (fetches)   │   │
│  └──────────────┘                    └──────────────┘   │
│         │                                              │
│         ↓                                              │
│  ┌──────────────┐                                      │
│  │  Repository  │  (persistent storage)                 │
│  └──────────────┘                                      │
└─────────────────────────────────────────────────────────┘
```

**URL Frontier**: cấu trúc dữ liệu kiểu heap + multiple queues, có 2 tiêu chí sắp xếp đồng thời:

1. **Priority** (PageRank, freshness, importance) — heap theo score.
2. **Politeness** (per-host queue) — tránh hammer một host.

Mercator giải quyết xung đột này bằng **URL Stream Servers**: mỗi URL được hash theo host, đẩy vào queue riêng của host đó. Khi worker rảnh → lấy URL từ head queue của host chưa vượt ngưỡng politeness.

**Per-host politeness policy** (đặc trưng Mercator): nếu fetch trang từ host H mất `t` giây, crawler chờ `10×t` giây trước khi fetch trang tiếp theo từ H [^9]. Đây là **adaptive politeness** — host nhanh được crawl nhanh, host chậm được throttle.

### 13.2. URL Filtering (Deduplication)

Mercator dùng **Bloom filter** + **content hash** (SHA-1 của nội dung) để:

- Loại URL đã thấy (Bloom filter, 1% false positive chấp nhận được).
- Loại document trùng nội dung (cùng SHA-1 dù URL khác — mirror site).

### 13.3. Workers và I/O Optimization

- **Asynchronous I/O**: sử dụng `select()`/`poll()` để quản lý hàng nghìn socket đồng thời mà không tốn thread.
- **Connection caching**: keep-alive connection pool theo host, tránh TCP/TLS handshake lặp lại.
- **Document fingerprinting**: trước khi lưu repository, hash nội dung để phát hiện near-duplicate (khoảng cách Jaccard, Shingling).

### 13.4. So sánh Mercator với Googlebot hiện đại

| Thành phần | Mercator (1999)       | Googlebot (2024+)                                     |
| ---------- | --------------------- | ----------------------------------------------------- |
| Frontier   | Heap + per-host queue | Tương tự + Priority theo ML score                     |
| Politeness | `10×t` adaptive       | ~1 request vài giây, adaptive theo server health [^1] |
| Render     | HTML only (không JS)  | WRS Chromium headless, 2-wave crawl [^13]             |
| Dedup      | Bloom filter + SHA-1  | Bloom + SimHash/Perceptual hash cho ảnh               |
| PageRank   | Tính offline          | Personalized PageRank theo topic, real-time update    |
| Storage    | Local filesystem      | Distributed: GFS/Borg, sharded index                  |

---

## 14. Robots.txt và X-Robots-Tag — Cách Xử lý

### 14.1. Robots.txt — Quy trình xử lý

```
┌──────────────────────────────────────────────────────┐
│  1. Cần fetch robots.txt cho host mới?                │
│     ├─ YES: HTTP GET /robots.txt                     │
│     │   ├─ 200 OK: parse, cache 24h (Google)         │
│     │   ├─ 404: cho phép tất cả                      │
│     │   ├─ 5xx: thử lại sau, mặc định allow          │
│     │   └─ 2xx (redirect): follow tới tối đa 5 hop  │
│     └─ NO: dùng cache (TTL 24h, có thể refresh sớm) │
│                                                      │
│  2. Match URL với rules:                              │
│     ├─ Group: User-agent: * (default)                │
│     │   hoặc User-agent: Googlebot (specific)        │
│     ├─ Chọn rule cụ thể nhất (longest match)         │
│     └─ Áp dụng Allow/Deny                             │
│                                                      │
│  3. Caching policy:                                   │
│     ├─ Googlebot: max 24h cache                      │
│     └─ Có thể refresh sớm nếu max file size > 500KB │
└──────────────────────────────────────────────────────┘
```

**Cú pháp**:

```
User-agent: *
Disallow: /private/
Allow: /public/

User-agent: Googlebot
Disallow: /no-google/
Crawl-delay: 10
Sitemap: https://example.com/sitemap.xml
```

**Lưu ý kỹ thuật**:

- Case-sensitive cho path matching.
- Wildcard `*` hỗ trợ cuối pattern: `/private/*` match mọi thứ trong `/private/`.
- End-of-URL anchor `$`: `/page$` chỉ match chính xác `/page`, không match `/page.html`.
- `Disallow: /` = chặn toàn bộ host.
- Empty `Disallow:` = cho phép tất cả.

**Google-specific** [^1]:

- `Crawl-delay`: Google **không chính thức hỗ trợ** (Bing có). Dùng Search Console để throttle.
- Sitemap directive: Google đọc nếu có.
- Host directive: Google bỏ qua.

### 14.2. X-Robots-Tag và Meta Robots

`X-Robots-Tag` là HTTP header, còn `meta name="robots"` là HTML tag. Cả hai có cùng giá trị:

```
X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, max-snippet:150, max-image-preview:large
```

```html
<meta name="robots" content="noindex, follow" />
```

**Phân biệt crawl vs index** — đây là điểm quan trọng nhất:

- **Robots.txt Disallow** = cấm **crawl** (Googlebot không fetch). Nhưng nếu URL nằm ngoài (trỏ từ trang khác), Google vẫn có thể **index** URL đó (chỉ không có nội dung) [^1].
- **X-Robots-Tag: noindex** = cấm **index** (sau khi crawl). Googlebot vẫn crawl để thấy tag, sau đó gỡ khỏi index.
- **Kết hợp** Disallow + noindex = Googlebot không thấy noindex → URL có thể vẫn index với snippet rỗng. Google khuyến nghị **KHÔNG dùng robots.txt cho canonicalization** [^12].

**Bảng giá trị phổ biến**:

| Tag                       | Crawl | Index    | Follow links      | Show snippet | Archive (cache) |
| ------------------------- | ----- | -------- | ----------------- | ------------ | --------------- |
| `index, follow` (default) | ✓     | ✓        | ✓                 | ✓            | ✓               |
| `noindex`                 | ✓     | ✗        | (mặc định follow) | ✗            | ✗               |
| `nofollow`                | ✓     | ✓        | ✗                 | ✓            | ✓               |
| `noarchive`               | ✓     | ✓        | ✓                 | ✓            | ✗ (no cache)    |
| `nosnippet`               | ✓     | ✓        | ✓                 | ✗            | ✓               |
| `noimageindex`            | ✓     | ✓        | ✓                 | ✓            | ✓               |
| `unavailable_after`       | ✓     | tới date | ✓                 | ✓            | ✗ từ date       |

**Lưu ý quan trọng với JavaScript**: Khi Google gặp `noindex`, nó **có thể skip rendering và JS execution** — nghĩa là dùng JS để _xóa_ `noindex` tag có thể không hoạt động như mong đợi. Nếu muốn page được index, **không đặt `noindex` trong HTML gốc** [^13].

---

## 15. Soft 404 — Nhận diện Trang 404 Giả Mạo 200 OK

### 15.1. Vấn đề

Nhiều site trả về HTTP 200 nhưng nội dung báo "page not found", hoặc redirect mềm về homepage. Google gọi đây là **soft 404** — gây lãng phí crawl budget và làm index chứa URL "ma". Đặc biệt phổ biến trong **client-side rendered SPA** nơi routing không thể trả HTTP status code thật [^13].

### 15.2. Cách Google nhận diện

Google dùng **ML classifier** train trên hàng triệu cặp (URL, content) đã biết:

**Tín hiệu cứng** (rule-based):

1. **Page size bất thường**: trang 200 OK nhưng nhỏ hơn ngưỡng (ví dụ < 1KB) trong khi các trang cùng template > 50KB.
2. **Similarity với known 404**: content hash gần giống trang 404 thật của site.
3. **Phrases đặc trưng**: regex match "not found", "404", "page does not exist", "không tìm thấy", "页面不存在".
4. **Title pattern**: title chứa "404", "not found", "page missing".
5. **Internal link count cực thấp**: trang 200 nhưng có 0 internal inlink (orphan).
6. **Meta robots/noindex trên trang thực**: trang nói "không tồn tại" nhưng không có noindex — Google nghi ngờ.

**Tín hiệu mềm** (ML):

- Hành vi user: bounce rate cao, time-on-page thấp → có thể soft 404.
- So sánh URL pattern: `/product/123` trả "không tìm thấy" nhưng `/product/456` có nội dung → URL `123` có khả năng soft 404.
- Cluster analysis: nếu nhiều URL cùng template cho cùng nội dung "không tìm thấy" → soft 404 hàng loạt.

**Hành động của Google**:

- Loại khỏi index (treated as 404).
- Báo trong Search Console → **Page Indexing** report phân loại "Soft 404".
- Giảm crawl rate cho site có nhiều soft 404 (vì cho thấy chất lượng kém).

### 15.3. Fix cho SPA (Google khuyến nghị chính thức) [^13]

**Cách 1 — JS redirect đến 404 page thật**:

```javascript
fetch(`/api/products/${productId}`)
  .then((response) => response.json())
  .then((product) => {
    if (product.exists) {
      showProductDetails(product);
    } else {
      window.location.href = '/not-found'; // server trả 404 cho /not-found
    }
  });
```

**Cách 2 — Thêm noindex meta tag qua JS**:

```javascript
fetch(`/api/products/${productId}`)
  .then((response) => response.json())
  .then((product) => {
    if (product.exists) {
      showProductDetails(product);
    } else {
      const metaRobots = document.createElement('meta');
      metaRobots.name = 'robots';
      metaRobots.content = 'noindex';
      document.head.appendChild(metaRobots);
    }
  });
```

**Best practice chung**:

- Trả HTTP 404 thật cho URL không tồn tại.
- Hoặc 410 (Gone) cho URL xóa vĩnh viễn.
- Soft 404 → redirect 301 về relevant page (category, homepage) hoặc trả 404.

---

## 19–26. Crawl Frontier — Cách URL Được Sắp Xếp & Ưu Tiên Crawl

## 19. Hai Tính Chất Cốt Lõi Frontier Phải Thỏa Mãn Đồng Thời

Crawl frontier là **cấu trúc dữ liệu trung tâm** của mọi crawler production — chứa danh sách URL chờ fetch, hỗ trợ các thao tác: thêm URL mới, chọn URL tiếp theo để crawl. Về bản chất, nó là một **priority queue** [^15]. Thiết kế frontier quyết định **bot crawl cái gì trước, cái gì sau, bao lâu sau** — tức là quyết định freshness, completeness, và politeness của toàn hệ thống.

Thiết kế frontier phải cân bằng **2 tiêu chí mâu thuẫn** [^9][^10]:

1. **Priority** — URL quan trọng hơn phải được crawl trước (PageRank cao, fresh, demand cao).
2. **Politeness** — Không hammer một host với quá nhiều request liên tiếp (rate limit per host).

Nếu chỉ sort theo priority → một host có nhiều URL quan trọng sẽ bị fetch liên tục, server quá tải.
Nếu chỉ sort theo politeness → URL quan trọng phải đợi URL rác khác cùng host xong trước.

Mercator giải quyết bằng **kiến trúc 2 tầng**: priority heap bên ngoài, per-host queue bên trong. Mỗi tầng giải quyết một bài toán.

## 20. Kiến trúc Frontier 2 Tầng (Mercator / Googlebot pattern)

```
┌──────────────────────────────────────────────────────────────┐
│                    CRAWL FRONTIER                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  TẦNG 1: Priority Heap (theo score)                   │  │
│  │  ┌──────────┬──────────┬──────────┐                    │  │
│  │  │ Score 95 │ Score 87 │ Score 72 │ ...                │  │
│  │  │ URL_A    │ URL_B    │ URL_C    │                    │  │
│  │  └──────────┴──────────┴──────────┘                    │  │
│  │  → Đảm bảo URL quan trọng được ưu tiên                 │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  TẦNG 2: Per-Host Queues (theo host hash)              │  │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐            │  │
│  │  │ host1  │ │ host2  │ │ host3  │ │ host4  │           │  │
│  │  │ [u1,u5]│ │ [u2]   │ │ [u3,u7]│ │ [u4,u6]│           │  │
│  │  └────────┘ └────────┘ └────────┘ └────────┘            │  │
│  │  → Mỗi host có 1 queue riêng, giữ thứ tự priority       │  │
│  │  → Worker pop từ head queue của host "đến lượt"         │  │
│  └────────────────────────────────────────────────────────┘  │
│                          ↓                                   │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  TẦNG 3: Politeness Scheduler                          │  │
│  │  Quyết định host nào được phép fetch tiếp              │  │
│  │  - Mercator: chờ 10×t giây sau khi fetch host đó      │  │
│  │  - Google: ~1 request/giây trung bình, adaptive       │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**Cách hoạt động** [^9][^10][^15]:

1. **URL mới** được extract từ page đã crawl → tính priority score → hash theo host → push vào queue tương ứng của host đó.
2. Mỗi queue con duy trì **internal heap theo priority** — URL quan trọng nhất của host đó ở head.
3. **Politeness scheduler** (URL Stream Server trong Mercator) chọn một host "đến lượt" (đã hết thời gian chờ) → lấy URL ở head queue của host đó → dispatch cho worker.
4. Worker fetch → trả response → URL biến mất khỏi frontier, link mới được extract lại push vào.

Điều này đảm bảo:

- **URL quan trọng** ở bất kỳ host nào cũng được ưu tiên trong host đó.
- **Không host nào** bị fetch quá nhiều request liên tiếp.
- **Không URL rác** nào "nhảy" lên đầu frontier chỉ vì cùng host với URL hot.

## 21. Các Yếu Tố Tính Priority Score

Score của một URL trong frontier được tính từ **composite score** của nhiều tín hiệu. Google không công bố công thức chính xác, nhưng dựa trên patent, paper học thuật, và behavior quan sát được:

### 21.1. Các Signal Quyết Định Priority

| Signal                             | Mô tả                                                        | Nguồn dữ liệu                                         | Trọng số (ước lượng)  |
| ---------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------- | --------------------- |
| **PageRank**                       | URL nằm trên page có PageRank cao → URL được crawl sớm hơn   | Link graph offline                                    | Rất cao               |
| **Click-through demand**           | URL được user click nhiều từ SERP                            | Click logs (Chrome, Search Console)                   | Rất cao               |
| **Query-deserves-freshness (QDF)** | URL liên quan đến query trending                             | Google Trends, news graph                             | Cao (khi triggered)   |
| **Change rate**                    | URL thay đổi thường xuyên → re-crawl thường hơn              | Lịch sử crawl + signal ngoài (RSS, sitemap `lastmod`) | Cao                   |
| **Estimated crawl cost**           | URL rẻ crawl (HTML nhỏ, server nhanh) được ưu tiên           | Latency lịch sử, page weight                          | Trung bình            |
| **Host crawl budget**              | Site lớn được phân bổ budget riêng                           | Cấu hình nội bộ                                       | Trung bình            |
| **Link discovery source**          | URL từ sitemap > URL từ homepage > URL từ page obscure       | Sitemap, internal link graph                          | Trung bình            |
| **Depth in site**                  | URL ở gần root hơn → crawl sớm hơn                           | URL path depth                                        | Yếu (so với PageRank) |
| **Canonical / dedup status**       | URL là canonical (chưa cluster) → priority cao hơn duplicate | Index cluster data                                    | Trung bình            |
| **Robots / noindex conflict**      | URL disallowed hoặc noindex → priority giảm mạnh             | Robots.txt cache, indexed flags                       | Cao (giảm)            |
| **Site authority**                 | Domain uy tín cao → URL được ưu tiên hơn site mới            | Site-level signal                                     | Trung bình            |
| **Spam score**                     | URL có spam score cao (SpamBrain) → crawl thấp hơn hoặc skip | SpamBrain classifier                                  | Cao (giảm)            |

### 21.2. Công thức Score (dạng tổng quát)

```
priority(url) = w1·PageRank_score
             + w2·Freshness_score
             + w3·Demand_score
             + w4·Inverse_cost_score
             − w5·Spam_score
             + w6·Site_authority_score
             + w7·QDF_bonus (nếu trigger)
             − w8·Robots_penalty
```

Trong đó:

- `w1..w8` là trọng số học bằng ML từ historical crawl efficiency (reward signal = URL crawled → indexed → retained → ranked high sau 30 ngày).
- Score được **tính offline** và cache, cập nhật theo batch hoặc real-time.
- Mỗi lần URL được fetch, score được **cập nhật lại** dựa trên kết quả (page size thật, HTTP status, response time).

### 21.3. PageRank Có Phải Yếu Tố Quan Trọng Nhất?

Theo nghiên cứu của **Junghoo Cho et al.** tại Stanford (2001) — first study on crawl scheduling policies [^9]:

> "If the crawler wants to download pages with high Pagerank early during the crawling process, then the partial Pagerank strategy is the better, followed by breadth-first and backlink-count."

**Marc Najork & Janet Wiener** thực nghiệm trên 328M pages:

- **Breadth-first crawl** capture pages với PageRank cao early trong quá trình crawl.
- Giải thích: "the most important pages have many links to them from numerous hosts, and those links will be found early, regardless of on which host or page the crawl originates."

Tuy nhiên nghiên cứu chỉ trên **một single domain** (180K pages stanford.edu). Trong thực tế production với toàn bộ web, Google dùng **composite score** (PageRank + nhiều signal khác), không chỉ PageRank thuần.

### 21.4. OPIC — On-line Page Importance Computation

Một thuật toán thay thế PageRank cho crawl scheduling, do **Abiteboul et al.** đề xuất [^9]:

- Mỗi page được gán initial "cash" pool.
- Khi crawl page P, cash được phân phối đều cho tất cả page P link tới.
- Crawler ưu tiên page có nhiều cash nhất.
- Tương tự PageRank computation nhưng chỉ **1 bước** (one-step), nhanh hơn nhiều.

**Boldi et al.** test trên 40M pages (.it) và 100M pages (WebBase):

- Breadth-first và omniscient visit tích lũy PageRank rất nhanh nhưng cho **progressive approximation rất kém** (PageRank estimate ở partial crawl sai nhiều so với ground truth).
- OPIC và length-of-per-site-queue strategies tốt hơn BFS.

## 22. Các Thuật Toán Scheduling Khác

### 22.1. Re-visit Policy (Cập nhật Priority theo thời gian)

Với page đã crawl rồi, score tăng lại theo thời gian — đến lúc cần re-crawl. Cho & Garcia-Molina (2003) chứng minh **uniform policy** thường tốt hơn **proportional policy** cho average freshness [^9]:

| Policy                 | Mô tả                                                                               | Kết quả                                                      |
| ---------------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Uniform**            | Re-visit tất cả page cùng tần suất                                                  | Tốt cho average freshness                                    |
| **Proportional**       | Re-visit tỷ lệ với change rate                                                      | Tệ — over-invest vào page thay đổi nhanh, freshness vẫn thấp |
| **Optimal (Cho 2003)** | Frequency tăng **sub-linearly** với change rate, **bỏ qua** page thay đổi quá nhanh | Tốt nhất trong cả hai metric                                 |

### 22.2. Focused Crawling (Cho vertical search)

Crawler tối ưu cho vertical search (academic, news, product) — chỉ crawl page relevant với query [^9]:

- **Pinkerton (1994)** — first web crawler, dùng **anchor text** làm heuristic predictor.
- **Diligenti et al.** — dùng **complete content** của page đã visit để infer relevance.
- **Dong et al.** — semantic focused crawler với SVM update ontology.

### 22.3. Path-Ascending Crawling

Cho seed URL `http://llama.org/hamster/monkey/page.html`, path-ascending crawler thử crawl [^9]:

- `/hamster/monkey/`
- `/hamster/`
- `/`

→ Tìm được isolated resources không có inbound link.

### 22.4. Baeza-Yates et al. (2005) — Length of Per-Site Queue

Test trên .gr và .cl domains (3M pages mỗi cái):

- **OPIC** và **length-of-per-site-queue** strategies **tốt hơn BFS** đáng kể.
- **Previous crawl** (khi có sẵn) là nguồn tín hiệu rất tốt để guide crawl hiện tại.

### 22.5. Daneshpajouh et al. — Community-Based Seed Selection

- Crawl pages với PageRank cao từ **different communities** (Leiden algorithm cluster).
- Tìm good seeds nhanh hơn random seeds.
- Dùng khi bắt đầu fresh crawl trên một site mới.

## 23. Distributed Frontier (Cluster Scale)

Khi crawler chạy trên **hàng nghìn node** (Googlebot), frontier phải distributed:

```
┌─────────────────────────────────────────────────────┐
│              Distributed Frontier                    │
│                                                      │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐          │
│  │ Node A   │   │ Node B   │   │ Node C   │          │
│  │ (host    │   │ (host    │   │ (host    │          │
│  │ hash %   │   │ hash %   │   │ hash %   │          │
│  │  N == 0) │   │  N == 1) │   │  N == 2) │          │
│  └──────────┘   └──────────┘   └──────────┘          │
│       ↑              ↑              ↑                │
│       │   gRPC/RPC coordination                      │
│       │              │              │                │
│  ┌──────────────────────────────────────────┐        │
│  │  Coordination Layer (ZooKeeper/Chubby)   │        │
│  │  - Host lock (chỉ 1 node fetch host X    │        │
│  │    tại 1 thời điểm)                       │        │
│  │  - Cross-host dedup (Bloom filter shared)│        │
│  └──────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

**Vấn đề chính**:

- **Cross-host dedup**: 2 node cùng extract được cùng URL từ 2 page khác nhau → push 2 lần. Bloom filter distributed giải quyết (với cost network).
- **Host assignment**: Hash host name → mod N → node phụ trách. Đảm bảo mỗi host chỉ do 1 node xử lý → tự nhiên có politeness per host.
- **Coordinator**: ZooKeeper/Chubby lock per host trong khoảng thời gian politeness window.

## 24. Quy Trình Ưu Tiên Crawl Trong Thực Tế (Google)

Dựa trên Google Search Central docs và behavior quan sát được, thứ tự ưu tiên crawl của Googlebot có thể tóm gọn:

### 24.1. URL Mới (chưa bao giờ crawl)

```
1. URL trong sitemap (đặc biệt sitemap news, sitemap lastmod mới) — ưu tiên cao nhất
2. URL từ page có PageRank cao (homepage của authoritative site)
3. URL trên trending page (QDF trigger)
4. URL gần root trong site architecture
5. URL nội bộ (cùng host) trong site đang crawl
6. URL từ page obscure (depth sâu, ít link)
```

### 24.2. URL Đã Crawl (re-crawl decision)

```
1. Page có QDF trigger (news, trending query)
2. Page có change rate cao + lần cuối fetch đã quá X giờ
3. Page có PageRank cao + lần cuối fetch đã quá Y giờ
4. Page có structured data DateModified được cập nhật
5. Page có Incoming links mới
6. Page có Click-through tăng bất thường
7. Re-crawl batch định kỳ (weekly cho hầu hết page)
```

### 24.3. URL Bị Giảm Priority

```
- Page có soft 404 → giảm
- Page có nhiều duplicate (cluster canonical đã chọn URL khác) → giảm
- Page bị noindex → crawl thấp hơn (chỉ cần thi thoảng check)
- Page có spam score cao → giảm mạnh
- Page có disallow robots.txt → không crawl (trừ khi cần verify)
- Page 5xx liên tục → backoff
```

## 25. So Sánh Các Bot

| Bot             | Frontier strategy                                             | Politeness                                    | Re-crawl                               |
| --------------- | ------------------------------------------------------------- | --------------------------------------------- | -------------------------------------- |
| **Googlebot**   | Composite score (PageRank + freshness + cost + QDF), adaptive | ~1 req/giây, adaptive theo server health [^1] | Uniform-ish với bias cho high-change   |
| **Bingbot**     | Tương tự Google, có thể ít sophisticated                      | `Crawl-delay` directive support               | Snapshot-based, ít frequent hơn Google |
| **Applebot**    | Dựa trên Apple Search Ads signal + PageRank                   | Tương tự Google                               | Ít tài liệu công khai                  |
| **Bravebot**    | Có thể dùng SimilarWeb data, ít PageRank focus                | Tương tự                                      | Privacy-focused, ít aggressive         |
| **DuckDuckBot** | Privacy-first, dùng upstream crawler data (Bing, etc.)        | Tương tự                                      | Tập trung vào upstream quality         |
| **Yandex**      | PageRank gốc + topological ranking                            | Tương tự                                      | QDF cho Russian trending               |

## 26. Tổng kết Frontier

Frontier không chỉ là "queue chờ crawl" — nó là **hệ thống ra quyết định phức tạp** với 3 tầng:

1. **Priority heap** — sắp xếp URL theo composite score (PageRank + freshness + demand + cost − spam).
2. **Per-host queue** — đảm bảo không hammer một host, mỗi host có ngân sách crawl riêng.
3. **Politeness scheduler** — quyết định host nào fetch tiếp dựa trên thời gian chờ (Mercator: 10×t; Google: adaptive).

Các yếu tố chính tính priority:

- **PageRank** (cao nhất, nhưng không phải duy nhất) — từ link graph offline.
- **Click-through demand** — từ user behavior data.
- **QDF** — trigger khi query trending.
- **Change rate** — page thay đổi nhiều → re-crawl thường hơn.
- **Cost** — page rẻ crawl được ưu tiên.
- **Spam score** — penalty mạnh.

Re-visit policy theo Cho & Garcia-Molina: **uniform tốt hơn proportional**; **optimal = sub-linear increase, bỏ qua page change quá nhanh**.

Distributed frontier cần **host-locking** (chỉ 1 node fetch host tại 1 thời điểm) và **shared Bloom filter** cho cross-host dedup.

---

> Phần còn lại (URL discovery rules, URL normalization, link discovery, indexing, ranking, canonicalization, AI/ML) nằm trong `SEARCH_ENGINE_BOT.md` và `SEARCH_ENGINE_URL_DISCOVERY.md`. Sources đầy đủ (chú thích [^1]–[^15]) cũng ở cuối file `SEARCH_ENGINE_BOT.md`.
