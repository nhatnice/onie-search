# Báo cáo Tổng hợp: Cơ chế Hoạt động của Search Engine Bot

Tài liệu kỹ thuật toàn diện về kiến trúc hệ thống, crawl, indexing, ranking, và các chi tiết engineering của Googlebot, Bingbot, Applebot, Bravebot.

---

# PHẦN I — KIẾN TRÚC HỆ THỐNG VÀ QUY TRÌNH THU THẬP DỮ LIỆU (CRAWL)

## 1. URL Discovery và Quản lý Crawl Queue

Googlebot là crawler dùng chung cho hai loại: **Googlebot Smartphone** (mô phỏng thiết bị di động) và **Googlebot Desktop** (mô phỏng máy tính để bàn). Cả hai tuân thủ cùng một product token trong `robots.txt`, nên không thể chặn chọn lọc từng loại qua robots.txt [^1][^2].

Cơ chế phát hiện URL mới:

- **Link harvesting**: Googlebot thu thập mọi link (`href`, `src`) trên mỗi trang đã crawl, rồi follow các link đó sang trang khác — trừ khi bị chặn bởi `nofollow` [^2].
- **Sitemaps**: Webmaster submit sitemap XML qua Search Console để báo URL mới.
- **Referrer logs**: Khi người dùng click link từ "site bí mật" sang site khác, URL có thể xuất hiện trong referrer tag và bị site kia lưu trữ, công khai [^1].
- **URL submission API**: Submit thủ công qua Search Console.

Quản lý crawl queue: Google duy trì một hàng đợi URL khổng lồ, sắp xếp theo **crawl budget** — thuật ngữ nội bộ của team Crawling & Indexing để chỉ số lượng URL Google sẽ crawl trên một site trong khoảng thời gian nhất định [^2].

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

# PHẦN II — QUÁ TRÌNH XỬ LÝ VÀ LẬP CHỈ MỤC (PARSING & INDEXING)

## 4. Parsing HTML/CSS và Boilerplate Removal

Sau khi fetch, Google parse HTML để trích xuất:

- **Main content** (nội dung chính) vs **boilerplate** (header, footer, nav, sidebar, copyright).
- Thuật toán boilerplate removal dựa trên tín hiệu: mật độ text, vị trí DOM block, tỷ lệ link-to-text, lặp lại across pages (template detection).
- CSS được parse để hiểu layout (visible/hidden content, `display:none` bị de-weight).
- Structured data (JSON-LD, Microdata, RDFa) được trích xuất thành entity graph.

## 5. Canonicalization

Khi nhiều URL có nội dung trùng lặp, Google chọn một **canonical URL** làm gốc. Tín hiệu xếp hạng:

| Tín hiệu                                         | Trọng số                  |
| ------------------------------------------------ | ------------------------- |
| `rel="canonical"` link tag                       | Mạnh nhất (explicit hint) |
| Redirect 301                                     | Mạnh                      |
| Internal link consistency                        | Trung bình                |
| Sitemap declaration                              | Trung bình                |
| URL structure (https, ngắn, không parameter rác) | Yếu                       |
| Duplicate content detection (hash nội dung)      | Tự động                   |

Google có thể **bỏ qua** canonical do webmaster khai báo nếu tín hiệu khác mâu thuẫn (ví dụ: canonical trỏ về trang khác hoàn toàn nội dung) [^1]. Hệ thống **deduplication** ở tầng SERP cũng loại bỏ trùng lặp giữa các kết quả, kể cả featured snippet không lặp lại listing thường [^3].

## 6. Inverted Index — Kiến trúc Lưu trữ

**Inverted index** là cấu trúc dữ liệu trung tâm của search engine: ánh xạ từ **term → danh sách document** (postings list), ngược với forward index (document → list term) [^4].

Hai biến thể:

- **Record-level inverted index**: mỗi term → list document ID chứa term đó.
- **Word-level inverted index (full inverted index)**: thêm **position** của term trong document — hỗ trợ phrase query, proximity search. Tốn nhiều bộ nhớ và xử lý hơn [^4].

```
Forward Index:          Inverted Index:
Doc1 → [apple, pie]     apple → [Doc1, Doc3]
Doc2 → [banana]         pie   → [Doc1]
Doc3 → [apple, tart]    banana→ [Doc2]
                        tart  → [Doc3]
```

**Nén và phân tán**:

- Postings list nén bằng kỹ thuật **delta encoding** + **variable-length integer encoding** (PForDelta, Varint-GB) — lưu chênh lệch docID thay vì ID tuyệt đối.
- Bitmap compression và inverted list compression được nhận thức là cùng giải quyết một bài toán [^4].
- Google phân tán index qua **sharding** theo docID range, replicate qua nhiều datacenter. Mỗi shard chứa một partition của inverted index, phục vụ query song song.

---

# PHẦN III — THUẬT TOÁN VÀ CÔNG NGHỆ CỐT LÕI

## 7. AI/ML trong Semantic Search

Google áp dụng chuỗi mô hình AI để hiểu ngữ nghĩa query và nội dung:

| Mô hình             | Năm   | Kiến trúc                          | Vai trò                                                                                                                                      |
| ------------------- | ----- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **RankBrain**       | 2015  | ML trên word vectors               | Hiểu query chưa từng thấy, map sang entity/concept tương tự. Dự đoán top result đúng 80% (vs 70% của engineer). Chạy trên **TPU ASIC** [^5]. |
| **Neural matching** | ~2018 | Deep neural net                    | Hiểu representation của concept trong query và page, match chúng với nhau [^3].                                                              |
| **BERT**            | 2019  | Transformer encoder, bidirectional | Hiểu cách kết hợp từ tạo ra nghĩa và intent khác nhau (đặc biệt stop word như "to", "without"). Áp dụng cho mọi query [^3].                  |
| **MUM**             | 2021  | T5 text-to-text, multimodal        | **1000x mạnh hơn BERT**, train trên 75 ngôn ngữ, hiểu text + image (sẽ mở rộng video/audio). Transfer knowledge cross-language [^6].         |
| **Passage ranking** | 2021  | AI trên passage                    | Hiểu relevance ở cấp **đoạn văn** riêng trong trang, không chỉ cả trang [^3].                                                                |

**Vector Search / Embedding**: Google biểu diễn query và document thành vector trong không gian ngữ nghĩa, tính similarity (cosine) để retrieve. Inverted index truyền thống (lexical) kết hợp với vector retrieval (dense) thành **hybrid retrieval**.

## 8. Đánh giá Chất lượng và Uy tín

**E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness)**: khuôn khổ đánh giá trong Search Quality Rater Guidelines, dùng human rater để train và validate hệ thống [^6].

**SpamBrain**: hệ thống AI phát hiện spam, liên tục update để bắt theo dõi chiến thuật spam mới [^3]. Kết hợp với **spam policies** và **removal-based demotion** (copyright, defamation, CSAM, doxxing) [^3].

**Link Graph Analysis**: PageRank — core ranking system từ ngày đầu, tính "link equity" qua graph web. Đã evolve nhiều từ paper gốc 1998 [^3]. Hệ thống **Penguin** (2012, tích hợp vào core 2016) chống link spam [^3].

**Helpful Content System** (2022) → evolve vào **core ranking** (3/2024): đảm bảo content "people-first" xếp cao hơn content tạo chủ yếu để manipulate SEO [^3].

---

# PHẦN IV — CƠ CHẾ XẾP HẠNG (RANKING)

## 9. Mối liên hệ Indexing ↔ Ranking

Indexing và Ranking là hai pipeline tách biệt nhưng liên tục:

```
┌─────────┐   ┌──────────┐   ┌────────────┐   ┌─────────┐   ┌────────┐
│  Crawl  │──▶│  Parse   │──▶│  Indexing  │──▶│ Retrieve│──▶│  Rank  │
│ (bot)   │   │ (HTML/JS)│   │ (inverted  │   │ (query  │   │ (hundreds│
│         │   │          │   │  index +    │   │  → docs)│   │  signals)│
└─────────┘   └──────────┘   │  vectors)  │   └─────────┘   └────────┘
                              └────────────┘         ▲
                                     │                │
                                     └─── updated continuously ───┘
```

- **Indexing** lưu trữ representation của document (inverted index + embedding vector + metadata).
- **Ranking** chạy **per query**: retrieve candidate docs từ index, rồi chấm điểm bằng hàng trăm signal.
- Index được cập nhật liên tục khi crawl lại → re-index → signal mới (link, freshness, user data) phản ánh vào ranking gần real-time.

## 10. Kết hợp Hàng trăm Tín hiệu

Google công bố ~200 ranking factor (không đầy đủ). Các hệ thống ranking chính [^3]:

| Hệ thống                               | Tín hiệu / Vai trò                                               |
| -------------------------------------- | ---------------------------------------------------------------- |
| **PageRank**                           | Link equity, link graph analysis                                 |
| **BERT / Neural matching / RankBrain** | Ngữ nghĩa query, intent                                          |
| **Freshness systems**                  | Query deserves freshness                                         |
| **Helpful content (core)**             | People-first content, chất lượng                                 |
| **Passage ranking**                    | Relevance cấp đoạn văn                                           |
| **Reviews system**                     | Chất lượng review, insight, expertise                            |
| **Site diversity system**              | Tối đa 2 listing/site trong top results                          |
| **Exact match domain**                 | De-weight domain khớp exact query                                |
| **Deduplication**                      | Loại trùng lặp                                                   |
| **Original content systems**           | Ưu tiên nguồn gốc, original reporting                            |
| **SpamBrain + spam detection**         | Phát hiện và demote spam                                         |
| **Removal-based demotion**             | Copyright, CSAM, doxxing                                         |
| **Core Web Vitals / Page experience**  | LCP, INP, CLS, mobile-friendly, HTTPS, no intrusive interstitial |
| **MUM**                                | Multimodal, cross-language (chưa dùng cho general ranking) [^3]  |

**Latency**: Toàn bộ pipeline (retrieve + rank hàng trăm signal) hoàn thành trong **phần trăm giây** nhờ:

- Inverted index cho O(1) lookup term → doc list.
- Vector retrieval dùng **ANN (Approximate Nearest Neighbor)** — HNSW, ScaNN.
- Ranking model chạy trên **TPU** [^5].
- Sharding + parallel scoring across datacenter.
- Pre-computed signal (PageRank, content quality) lưu kèm doc trong index, chỉ query-time signal (freshness, personalization, location) tính lúc query.

---

# PHẦN V — DEEP-DIVE 8 CHỦ ĐỀ KỸ THUẬT CHI TIẾT

## 11. URL Normalization — Loại bỏ Tracking Params & Relative→Absolute

### 11.1. Chuẩn RFC 3986 — Tầng chuẩn hóa cú pháp

Mọi crawler production (Googlebot, Bingbot, Applebot, Bravebot) áp dụng **URI Normalization** theo RFC 3986 §6 trước khi đưa URL vào crawl frontier, mục đích: tránh crawl trùng resource, gộp tín hiệu ranking [^7].

**Nhóm 1 — Semantic-preserving (luôn áp dụng, giữ nguyên nghĩa)**:

| Quy tắc                               | Ví dụ                                        |
| ------------------------------------- | -------------------------------------------- |
| Percent-encoding uppercase            | `foo%2a` → `foo%2A`                          |
| Scheme + host lowercase               | `HTTP://Example.COM` → `http://example.com`  |
| Decode unreserved char                | `%7Efoo` → `~foo`                            |
| Remove dot-segments (RFC 3986 §5.2.4) | `foo/./bar/../qux` → `foo/qux`               |
| Empty path → `/`                      | `http://example.com` → `http://example.com/` |
| Remove default port                   | `:80` → bỏ                                   |

**Nhóm 2 — Thường semantic-preserving (cẩn thận)**:

- Thêm trailing `/` cho non-empty path: `example.com/foo` → `example.com/foo/` (chỉ an toàn nếu server redirect xác nhận tương đương).

**Nhóm 3 — Thay đổi semantics (chỉ áp dụng khi có tín hiệu phụ)** [^7]:

- Bỏ directory index: `a/index.html` → `a/`
- Bỏ fragment: `bar.html#section1` → `bar.html` (Google **vẫn giữ** fragment cho AJAX SPA — không bỏ)
- IP → domain: `208.77.188.166` → `example.com` (chỉ khi reverse DNS xác nhận)
- Bỏ `www.` (Google tự chọn www vs non-www, có thể override)
- Sort query parameters theo alphabet
- **Bỏ tham số tracking dư thừa** — phần quan trọng nhất

### 11.2. Tracking Parameter Filtering (Cụ thể Googlebot)

Google áp dụng **URL parameter handling** qua Search Console, trong đó webmaster liệt kê parameter Google nên **bỏ qua** khi crawl. Ngoài ra Google **tự động nhận diện** nhiều tracking param phổ biến mà không cần khai báo — kết quả của supervised learning trên tập URL crawl lịch sử [^1][^12]:

- `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` (Google Analytics)
- `gclid`, `gclsrc` (Google Ads click ID)
- `fbclid` (Facebook), `msclkid` (Bing Ads), `mc_cid`, `mc_eid` (Mailchimp)
- `sessionid`, `sid`, `phpsessid` (session ID)
- `ref`, `ref_src`, `source` (referrer tracking)

Tham số bị bỏ qua khi crawl thì cũng bị bỏ qua khi **consolidate duplicate** (gộp tín hiệu ranking). Đây là lý do `?gclid=ABCD` và URL gốc được gộp làm một [^12].

### 11.3. Relative → Absolute URL Resolution

Crawler phải resolve mọi link tương đối thành URL tuyệt đối trước khi push vào frontier. Theo RFC 3986 §5, thuật toán **5 bước**:

1. **Reference Resolution**: nếu URI gốc (base) thiếu scheme → parse lỗi, bỏ qua.
2. **Merge**: gộp path reference vào base path theo cấu trúc segment cuối.
3. **Remove Dot Segments** (RFC 3986 §5.2.4) — `/a/b/../c` → `/a/c`.
4. **Path合併**: nếu reference có authority (host) → thay toàn bộ.
5. **Recompose**: ghép lại scheme + authority + path + query + fragment.

Ví dụ:

- Base: `https://example.com/a/b/c`
- Reference: `../d/e.html`
- → `https://example.com/a/d/e.html`

**Edge cases**:

- `<base href="...">` trong `<head>` thay đổi toàn bộ resolution base cho mọi link sau đó.
- `//cdn.example.com/img.jpg` (protocol-relative) → resolve theo scheme của page → `https://cdn.example.com/img.jpg`.
- Google khuyến nghị dùng **absolute path** trong `rel="canonical"` (`https://www.example.com/...` thay vì `/...`) để tránh vấn đề khi test site bị crawl nhầm [^12].

---

## 12. Các Tín hiệu: Importance, Freshness, Trust, Cost, PageRank

Google không dùng metric đơn lẻ mà là **composite score** từ hàng trăm tín hiệu, gộp bởi ML model. Từng thành phần có nguồn gốc tính toán rõ ràng.

### 12.1. Importance (Độ quan trọng)

| Tín hiệu                 | Nguồn                 | Cách tính                                                                                                                                                  |
| ------------------------ | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **PageRank gốc**         | Link graph toàn web   | Markov chain trên graph web, giải eigenvector của Google Matrix (damping factor d ≈ 0.85). Công thức: `PR(p) = (1-d)/N + d × Σ PR(q)/L(q)` với q → p [^8]. |
| **Reasonable Surfer**    | Patent US2007/0288457 | Mở rộng PageRank: link từ anchor text trong body paragraph có weight cao hơn link trong footer/sidebar.                                                    |
| **Topical PageRank**     | Patent US2008/0120283 | PageRank trong **subgraph** theo topic — page có link từ cụm trang cùng chủ đề được boost cho query thuộc topic đó.                                        |
| **Page-level authority** | ML aggregate          | Train trên E-E-A-T raters, kết hợp backlink profile, brand mention, Wikipedia/Wikidata entity.                                                             |
| **Site-level authority** | Site-wide signal      | Domain age, HTTPS, registered business, brand search volume.                                                                                               |

### 12.2. Freshness (Độ tươi)

Hai metric chính (theo định nghĩa cổ điển của Cho & Garcia-Molina [^9]):

- **Freshness F(t)**: binary — local copy có khớp live page hay không.
  ```
  F_p(t) = 1 nếu p bằng local copy tại thời điểm t, 0 nếu khác.
  ```
- **Age A(t)**: số giây local copy đã outdated kể từ lần sửa cuối.
  ```
  A_p(t) = 0 nếu p không modified tại t, ngược lại = t − modification_time(p)
  ```

**Hai re-visit policy kinh điển** [^9]:

1. **Uniform**: re-visit tất cả page cùng tần suất — Cho & Garcia-Molina chứng minh **tốt hơn proportional** cho average freshness vì proportional over-invest vào trang thay đổi nhanh (mà vẫn stale ngay sau crawl).
2. **Proportional**: re-visit tỷ lệ với change rate — tốn resource mà freshness vẫn thấp.

**Google thực tế dùng hybrid**:

- **Query deserves freshness (QDF)**: query có pattern trending (Google Trends spike, news burst) → boost doc có timestamp gần, ưu tiên re-crawl [^3].
- **Change rate estimator**: model dự đoán tốc độ thay đổi URL từ lịch sử crawl + signal ngoài (sitemap `lastmod`, RSS feed update time, structured data `dateModified`).
- **Optimal policy** (theo Cho 2003): access frequency tăng **sub-linearly** với change rate, và **bỏ qua** page thay đổi quá thường xuyên (news ticker) — vì freshness cửa sổ quá hẹp [^9].

### 12.3. Trust / Quality (Độ tin cậy)

**E-E-A-T framework** (Experience, Expertise, Authoritativeness, Trustworthiness) — Google dùng để train Quality Rater, sau đó extract signal tự động [^3]:

- **Experience**: tác giả có dấu hiệu first-hand (ảnh gốc, video tự quay, review chi tiết từ trải nghiệm).
- **Expertise**: author có credential (author schema, About page, publication history trong domain).
- **Authoritativeness**: brand được nhắc bởi authoritative source (Wikipedia, gov/edu, major news), backlink từ site cùng ngành.
- **Trustworthiness**: HTTPS, About/Contact/Privacy policy rõ ràng, không có Safe Browsing warning, không có DMCA strike.

**SpamBrain** (AI spam detector) chấm **spam score** [^3]: cloaking, doorway pages, keyword stuffing, hidden text, link spam (PBN, purchased links), hacked content, auto-generated content không giá trị.

### 12.4. Crawl Cost (Chi phí truy xuất)

| Thành phần                 | Đo lường                                                       |
| -------------------------- | -------------------------------------------------------------- |
| **Fetch time**             | Latency từ crawl request → response hoàn chỉnh                 |
| **Page weight**            | Total bytes (compressed) của HTML + CSS + JS + image resources |
| **Render cost**            | WRS CPU time để execute JS, paint, layout                      |
| **Robots.txt fetch**       | Mỗi host cần 1+ fetch riêng cho robots.txt (có cache 24h)      |
| **HSTS / HTTPS handshake** | TLS handshake cost                                             |
| **Redirect chain**         | Mỗi hop = thêm 1 round-trip                                    |

**Google đặt soft cap** [^1]:

- File > 2MB bị truncate (HTML, JS)
- File > 64MB bị bỏ qua (PDF)
- Page quá nặng (LCP > 4s) bị Page Experience demotion

Crawl demand tỷ lệ nghịch với cost — page rẻ crawl được re-crawl thường hơn.

### 12.5. PageRank (Chi tiết công thức)

PageRank hiện đại không còn random surfer thuần mà kết hợp nhiều yếu tố:

```
PR(p) = (1-d)/N + d × Σ w(q→p) × PR(q) / L(q)
```

Trong đó:

- `d` = damping factor ≈ 0.85 (xác suất user tiếp tục click link)
- `N` = tổng số page trong graph
- `L(q)` = tổng link outbound từ q
- `w(q→p)` = trọng số link (anchor text relevance, position, v.v.)

**Tính toán distributed**:

- Google Matrix có hàng tỷ node — không fit RAM một máy.
- Tính bằng **MapReduce** trên cluster (paper MapReduce của Google dùng PageRank làm ví dụ kinh điển).
- Power iteration: khởi tạo rank đều, lặp đến khi hội tụ (Δ < ε).
- Personalized PageRank: vector khởi tạo không đều mà bias theo topic/site.

PageRank hiện tại **chỉ là một trong nhiều signal**, không còn dominant như 2000-2010. Một page backlink kém nhưng content xuất sắc vẫn có thể rank top vì BERT/MUM/Neural matching match ngữ nghĩa tốt hơn [^3].

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

## 16. Link Discovery — CHỈ `<a href>`, Không phải mọi tag

### 16.1. ĐÚNG: Google CHỈ reliably parse `<a href>` cho URL discovery

Theo tài liệu chính thức Google Search Central [^14]:

> "Generally, Google can only crawl your link if it's an `<a>` HTML element (also known as _anchor element_) with an `href` attribute. Most links in other formats won't be parsed and extracted by Google's crawlers."

**Google CÓ thể parse (recommended)**:

```html
<a href="https://example.com">
  <a href="/products/category/shoes">
    <a href="./products/category/shoes">
      <a href="/products/category/shoes" onclick="javascript:goTo('shoes')">
        <a href="/products/category/shoes" class="pretty"></a></a></a></a
></a>
```

Links được insert động bằng JS cũng crawlable, **miễn là** dùng HTML markup trên.

**Google KHÔNG reliably parse (not recommended, nhưng có thể cố gắng)**:

```html
<a routerLink="products/category">
  <!-- Angular — thiếu href -->
  <span href="https://example.com">
    <!-- span, không phải a -->
    <a onclick="goto('https://example.com')">
      <!-- thiếu href -->
      <a href="javascript:goTo('products')">
        <!-- javascript: URI, không phải HTTP -->
        <a href="javascript:window.location.href='/products'"></a></a></a></span
></a>
```

### 16.2. Phân biệt URL Discovery vs Resource Fetch

| Mục đích                                  | Element                                                                                    | Google xử lý                                                      |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| **URL discovery** (tìm page mới để crawl) | `<a href>`                                                                                 | Reliably parse, push vào crawl frontier [^14]                     |
| **Resource fetch** (lấy asset để render)  | `<img src>`, `<script src>`, `<link href>`, `<iframe src>`, `<source srcset>`, CSS `url()` | Fetch riêng từng resource, KHÔNG push vào crawl frontier như page |
| **Structured data URL**                   | JSON-LD `url`, `@id`                                                                       | Dùng cho entity graph, có thể trigger crawl                       |
| **Sitemap URL**                           | `<loc>` trong sitemap.xml                                                                  | Push vào crawl frontier                                           |
| **Redirect target**                       | HTTP 301/302 Location header                                                               | Push vào crawl frontier                                           |
| **`<meta http-equiv="refresh">`**         | `content` attribute                                                                        | Follow redirect                                                   |

### 16.3. Tại sao Google chỉ dùng `<a href>` cho discovery

- **Tin cậy**: `<a href>` là chuẩn HTML cho navigation. Các pattern khác (`onclick`, `routerLink`) có thể là UI state change, không phải navigation thật.
- **Tránh spider trap**: `javascript:` URI có thể gây side-effect, không phải navigation.
- **History API**: Google khuyến nghị SPA dùng **History API** (`pushState`) thay vì fragment (`#/page`) để Googlebot parse URL được [^13].

**SPA sai (Google không parse được)**:

```html
<a href="#/products">Our products</a> <a href="#/services">Our services</a>
```

**SPA đúng (Google parse được)**:

```html
<a href="/products">Our products</a>
<a href="/services">Our services</a>
<script>
  function goToPage(event) {
    event.preventDefault();
    const hrefUrl = event.target.getAttribute('href');
    document.getElementById('placeholder').innerHTML = load(hrefUrl.slice(1));
    window.history.pushState({}, window.title, hrefUrl);
  }
  document.querySelectorAll('a').forEach((link) => link.addEventListener('click', goToPage));
</script>
```

### 16.4. Anchor text — Tín hiệu ranking quan trọng

Google dùng **anchor text** (text visible giữa `<a>` và `</a>`) làm tín hiệu về nội dung page đích [^14]:

- Anchor text mô tả, ngắn gọn, relevant → tốt.
- "Click here", "Read more" → kém (không cho context).
- Image link: dùng `alt` attribute làm anchor text.
- Empty anchor + `title` attribute: Google fallback dùng `title`.
- Keyword stuffing trong anchor text = **spam policy violation**.

---

## 17. Inverted Index — Chi tiết Kiến trúc

### 17.1. Cấu trúc Term Dictionary + Postings

```
┌─────────────────────────────────────────────────────────────┐
│  Term Dictionary (sorted, in-memory)                         │
│  ┌──────────┬──────────┬──────────────┐                       │
│  │ Term     │ DocFreq  │ PostingsPtr  │                       │
│  ├──────────┼──────────┼──────────────┤                       │
│  │ apple    │ 1,000,000│ → ptr        │                       │
│  │ banana   │   500,000│ → ptr        │                       │
│  │ zygote   │        10│ → ptr        │                       │
│  └──────────┴──────────┴──────────────┘                       │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  Postings List (on-disk, compressed)                         │
│  apple → [docID, tf, [pos1,pos2,...], score]:              │
│          [d1, 5, [2,8,15,16,20], 0.85]                      │
│          [d2, 1, [100], 0.42]                                │
│          [d7, 3, [5,6,7], 0.71]                              │
│          ... 1,000,000 entries                               │
└─────────────────────────────────────────────────────────────┘
```

### 17.2. Hai biến thể Inverted Index [^4]

- **Record-level inverted index** (inverted file index): mỗi term → list document ID chứa term đó. Nhẹ, đủ cho boolean query.
- **Word-level inverted index** (full inverted index): thêm **position** của term trong document — hỗ trợ phrase query, proximity search. Tốn nhiều bộ nhớ và xử lý hơn, nhưng là chuẩn cho search engine production.

### 17.3. Compression Techniques

**Delta encoding** (lưu docID gap thay vì absolute):

```
Thô:        [1000, 1005, 1010, 2000, 2003]
Delta:      [1000, 5, 5, 990, 3]
```

**Variable-byte encoding** (Varint) / PForDelta / Simple9:

- Số nhỏ dùng ít byte hơn.
- PForDelta (Patched Frame of Reference Delta): batch processing, decode SIMD.
- Compression ratio điển hình: **5-10× so với uncompressed**.

**Bitmap compression** (WAH, EWAH, Roaring Bitmaps):

- Dùng khi postings list dense (term xuất hiện trong nhiều doc liên tiếp).
- Roaring Bitmaps (Lemire et al.) phổ biến nhất hiện nay — chia thành block 65536, dùng array/container/bitmap tuỳ mật độ.

**Skip pointers**: con trỏ nhảy có khoảng cách √n trong postings list, tăng tốc intersection query (`termA AND termB`).

### 17.4. Distributed Architecture

Google chia index thành **shards**:

```
┌──────────────────────────────────────────────────────────┐
│  Query: "machine learning tutorial"               │
│                                                   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│  │ Shard 0  │  │ Shard 1  │  │ Shard 2  │  ...    │
│  │ docID    │  │ docID    │  │ docID    │         │
│  │ 0-10M    │  │ 10M-20M  │  │ 20M-30M  │         │
│  └──────────┘  └──────────┘  └──────────┘         │
│       │              │              │              │
│       └──────────────┴──────────────┘              │
│                      ↓                              │
│              Query Broker (merge)                  │
│                      ↓                              │
│              Top-K candidates → Ranker             │
└──────────────────────────────────────────────────────────┘
```

**Two-level index**:

- **L0 (real-time/streaming)**: index mới thêm vào, vài giây latency, lưu RAM.
- **L1 (batch)**: index rebuild định kỳ (hàng giờ), tối ưu compression.
- Query fan out tới cả L0 + L1, merge hits.

**Document partitioning** vs **term partitioning**:

- Google: document partitioning (shard = range docID) — query cần hit tất cả shard.
- Term partitioning: shard = subset of terms — query chỉ hit shard chứa term. Ít dùng vì skew term frequency.

### 17.5. Phục vụ truy vấn

1. **Tokenize query** → list of terms.
2. **Lookup term dictionary** → lấy postings pointer.
3. **Read postings** (parallel across shards) → intersect/union theo operator (AND, OR, phrase).
4. **Score bằng BM25/TF-IDF** trên từng candidate.
5. **Top-K (K=1000)** candidates → pass sang ranker (deep learning).
6. **Final top-10** trả về user, latency < 300ms.

### 17.6. Phrase Query

- **Biword index**: index cặp từ liên tiếp → hỗ trợ phrase query nhanh nhưng index lớn.
- **Positional index**: mỗi posting lưu vị trí term trong document. Phrase query = intersect postings + check pos consecutive.
- Google dùng **positional index** + **skip pointers** cho phrase matching trong sub-second [^4].

---

## 18. Canonicalization — Chi tiết Pipeline (theo Google chính thức)

### 18.1. Tín hiệu Canonical — Thứ tự ưu tiên CHÍNH THỨC từ Google [^12]

Google công bố thứ tự **từ mạnh nhất đến yếu nhất**:

| Thứ tự | Tín hiệu                                                    | Loại     | Trọng số                                               |
| ------ | ----------------------------------------------------------- | -------- | ------------------------------------------------------ |
| 1      | **Redirects** (301/308)                                     | Explicit | **Mạnh nhất** — target redirect trở thành canonical    |
| 2      | **`rel="canonical"` link annotations** (HTML + HTTP header) | Explicit | **Mạnh** — URL chỉ định trở thành canonical            |
| 3      | **Sitemap inclusion**                                       | Explicit | **Yếu** — URL trong sitemap được suggest làm canonical |
| 4      | **HTTPS preferred over HTTP**                               | Implicit | Mặc định (trừ khi có conflicting signal)               |
| 5      | **`hreflang` cluster**                                      | Implicit | URL trong hreflang cluster được prefer                 |

**Lưu ý quan trọng**: Các tín hiệu **stack** — dùng 2+ phương pháp cùng lúc tăng khả năng Google chọn canonical đúng [^12]. Nhưng **KHÔNG mix different URLs** cho cùng page (ví dụ: sitemap chỉ URL A, rel=canonical chỉ URL B → Google confused).

### 18.2. Pipeline xử lý

```
┌─────────────────────────────────────────────────────┐
│  Step 1: URL extraction & normalization              │
│  → Chuẩn hoá URL theo RFC 3986 + Google rules        │
│  → Bỏ tracking params (utm, gclid, fbclid)          │
│  → Resolve relative → absolute                      │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Step 2: Fetch & parse                               │
│  → WRS render → extract rel=canonical                │
│  → Extract HTTP Link header canonical                 │
│  → Hash content (SimHash, 64-bit)                    │
│  → Extract structured data canonical                 │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Step 3: Group duplicates                             │
│  → Cùng canonical URL → cluster                      │
│  → Cùng content hash (≥ 95% similarity) → cluster    │
│  → Host + path family (e.g. /a, /a?v=1) → cluster   │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Step 4: Choose canonical                             │
│  Priority (theo Google official):                    │
│  1. Redirect target (mạnh nhất)                      │
│  2. rel=canonical nếu self-referential & valid       │
│  3. URL trong sitemap                                │
│  4. HTTPS over HTTP                                  │
│  5. URL trong hreflang cluster                       │
│  6. URL được internal link nhiều nhất                 │
│  7. URL có PageRank cao nhất                         │
│  8. URL ngắn nhất (tiebreaker)                       │
│  → Có thể OVERRIDE rel=canonical nếu inconsistent    │
└─────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────┐
│  Step 5: Index & consolidate signals                 │
│  → Chỉ index canonical URL                           │
│  → Forward link equity từ non-canonical → canonical  │
│  → Chỉ canonical mới hiện trong SERP                 │
└─────────────────────────────────────────────────────┘
```

### 18.3. Các phương pháp chỉ định canonical [^12]

**Phương pháp 1 — `rel="canonical"` link element (HTML)**:

```html
<head>
  <link rel="canonical" href="https://example.com/dresses/green-dresses" />
</head>
```

- Khuyến nghị thêm **self-referential canonical** trên chính canonical page.
- Dùng **absolute path** (`https://www.example.com/...`), không dùng relative (`/...`).
- Chỉ chấp nhận nếu nằm trong `<head>` section hợp lệ.
- Theo RFC 6596.

**Phương pháp 2 — `rel="canonical"` HTTP header**:

```http
HTTP/1.1 200 OK
Link: <https://www.example.com/downloads/white-paper.pdf>; rel="canonical"
```

- Dùng cho non-HTML (PDF, DOCX).
- Không tăng page size.

**Phương pháp 3 — Sitemap inclusion**:

- Liệt kê canonical URL trong sitemap.
- Google tự xác định duplicate dựa trên content similarity.
- **Yếu hơn** rel=canonical nhưng đơn giản cho site lớn.

**Phương pháp 4 — Redirects**:

- 301/308 permanent redirect → target trở thành canonical.
- Dùng khi deprecated duplicate page.

### 18.4. Tín hiệu phụ (Google tự áp dụng) [^12]

**HTTPS preferred over HTTP**:

- Mặc định Google chọn HTTPS làm canonical.
- **Trừ khi** HTTPS có vấn đề: invalid SSL, insecure dependencies (non-image), redirect về HTTP, rel=canonical trỏ về HTTP.
- HSTS không override được preference mạnh cho HTTP khi có bad TLS.

**`hreflang` cluster preferred**:

- URL trong hreflang cluster (reciprocal annotation) được prefer làm canonical.
- Ví dụ: `de-de` và `de-ch` point to each other → prefer làm canonical hơn `de-at` không trong cluster.

### 18.5. Best practices & Anti-patterns [^12]

**NÊN**:

- Self-referential canonical trên canonical page.
- Link nội bộ đến canonical URL (không phải duplicate).
- Dùng absolute path trong rel=canonical.
- Kết hợp nhiều phương pháp (redirect + rel=canonical + sitemap).

**KHÔNG NÊN**:

- **Đừng dùng robots.txt cho canonicalization** — Google vẫn index URL disallowed (không có content).
- **Đừng dùng URL removal tool cho canonicalization** — ẩn tất cả version.
- **Đừng mix different URLs** cho cùng page qua different methods.
- **Đừng dùng URL fragment** làm canonical — Google không support fragment.
- **Đừng dùng `noindex` cho canonicalization** — block page entirely, dùng rel=canonical thay.
- **Đừng chỉ định canonical khác nhau** qua HTML vs JavaScript — gây conflict.

### 18.6. JavaScript & Canonical [^13]

Google **có thể** inject rel=canonical qua JS, nhưng khuyến nghị:

- Tốt nhất: chỉ định canonical trong **HTML source**, đảm bảo JS **không thay đổi** canonical link element.
- Nếu không thể set trong HTML: để trống, set bằng JS — đảm bảo chỉ có **một** rel=canonical tag.
- **Multiple hoặc conflicting** rel=canonical tags → kết quả bất ngờ.

### 18.7. URL Inspection Tool — Xác minh Canonical

Search Console → URL Inspection cho biết:

- **User-declared canonical**: tag/header do bạn khai báo.
- **Google-selected canonical**: URL Google thực sự chọn để index.

Nếu hai cái khác nhau → Google bỏ qua khai báo của bạn vì lý do gì đó (broken canonical, canonical đến 404, noindex target, conflicting signals, etc.).

---

# PHẦN VI — CRAWL FRONTIER — CÁCH URL ĐƯỢC SẮP XẾP & ƯU TIÊN CRAWL

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

# TỔNG KẾT TOÀN BỘ

Search engine hiện đại là pipeline ba tầng — **Crawl → Index → Rank** — trong đó mỗi tầng được tối ưu hóa độc lập nhưng liên tục đồng bộ. Googlebot dùng evergreen Chromium WRS để render JS, crawl budget được điều chỉnh động theo server health + PageRank + freshness. Frontier sắp xếp URL theo composite score qua 3 tầng (priority heap + per-host queue + politeness scheduler). Indexing dựa trên inverted index nén (delta encoding, Roaring Bitmaps) phân tán qua shard, kết hợp vector embedding cho semantic retrieval. Ranking kết hợp hàng trăm signal qua ML model (RankBrain, BERT, MUM, neural matching, passage ranking) chạy trên TPU để trả kết quả trong mili-giây. E-E-A-T, SpamBrain, PageRank và helpful content system đảm bảo chất lượng và uy tín. Canonicalization là pipeline 5 bước với thứ tự ưu tiên chính thức: Redirect > rel=canonical > Sitemap > HTTPS > hreflang. MUM mở ra hướng multimodal, cross-language cho thế hệ search tiếp theo.

---

## Sources

[^1]: Google Search Central — "What Is Googlebot" — https://developers.google.com/search/docs/crawling-indexing/googlebot

[^2]: Wikipedia — "Googlebot" — https://en.wikipedia.org/wiki/Googlebot

[^3]: Google Search Central — "A guide to Google Search ranking systems" — https://developers.google.com/search/docs/appearance/ranking-systems-guide

[^4]: Wikipedia — "Inverted index" — https://en.wikipedia.org/wiki/Inverted_index

[^5]: Wikipedia — "RankBrain" — https://en.wikipedia.org/wiki/RankBrain

[^6]: Google Blog — "MUM: A new AI milestone for understanding information" (Pandu Nayak, 2021) — https://blog.google/products-and-platforms/products/search/introducing-mum/

[^7]: Wikipedia — "URI normalization" (RFC 3986) — https://en.wikipedia.org/wiki/URI_normalization

[^8]: Wikipedia — "PageRank" — https://en.wikipedia.org/wiki/PageRank

[^9]: Wikipedia — "Web crawler" (Selection policy, Re-visit policy, Politeness policy, Parallelization policy, Cho & Garcia-Molina freshness/age formulas, Mercator adaptive politeness, OPIC algorithm, Baeza-Yates experiments) — https://en.wikipedia.org/wiki/Web_crawler

[^10]: Heydon & Marc Najork — "Mercator: A Scalable, Extensible Web Crawler" (World Wide Web Conference, 1999) — referenced in [^9]

[^11]: Wikipedia — "Inverted index" — https://en.wikipedia.org/wiki/Inverted_index

[^12]: Google Search Central — "How to specify a canonical URL with rel="canonical" and other methods" — https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls

[^13]: Google Search Central — "Understand the JavaScript SEO basics" — https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics

[^14]: Google Search Central — "Link best practices for Google" — https://developers.google.com/search/docs/crawling-indexing/links-crawlable

[^15]: Wikipedia — "Crawl frontier" (Olston & Najork, 2010, Foundations and Trends in Information Retrieval) — https://en.wikipedia.org/wiki/Crawl_frontier
