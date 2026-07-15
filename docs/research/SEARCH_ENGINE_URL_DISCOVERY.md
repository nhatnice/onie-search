# Search Engine URL Discovery

Tài liệu trích từ `SEARCH_ENGINE_BOT.md` — tập trung vào cơ chế **phát hiện URL**: link harvesting, URL normalization, link extraction rules.

> Mục lục:
>
> - [1. URL Discovery và Quản lý Crawl Queue](#1-url-discovery-và-quản-lý-crawl-queue)
> - [11. URL Normalization — Loại bỏ Tracking Params & Relative→Absolute](#11-url-normalization--loại-bỏ-tracking-params--relativeabsolute)
> - [16. Link Discovery — CHỈ `<a href>`, Không phải mọi tag](#16-link-discovery--chỉ-a-href-không-phải-mọi-tag)

---

## 1. URL Discovery và Quản lý Crawl Queue

Googlebot là crawler dùng chung cho hai loại: **Googlebot Smartphone** (mô phỏng thiết bị di động) và **Googlebot Desktop** (mô phỏng máy tính để bàn). Cả hai tuân thủ cùng một product token trong `robots.txt`, nên không thể chặn chọn lọc từng loại qua robots.txt [^1][^2].

Cơ chế phát hiện URL mới:

- **Link harvesting**: Googlebot thu thập mọi link (`href`, `src`) trên mỗi trang đã crawl, rồi follow các link đó sang trang khác — trừ khi bị chặn bởi `nofollow` [^2].
- **Sitemaps**: Webmaster submit sitemap XML qua Search Console để báo URL mới.
- **Referrer logs**: Khi người dùng click link từ "site bí mật" sang site khác, URL có thể xuất hiện trong referrer tag và bị site kia lưu trữ, công khai [^1].
- **URL submission API**: Submit thủ công qua Search Console.

Quản lý crawl queue: Google duy trì một hàng đợi URL khổng lồ, sắp xếp theo **crawl budget** — thuật ngữ nội bộ của team Crawling & Indexing để chỉ số lượng URL Google sẽ crawl trên một site trong khoảng thời gian nhất định [^2].

---

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

> Phần còn lại (kiến trúc crawl, crawl budget, Mercator, frontier, indexing, ranking, canonicalization) nằm trong `SEARCH_ENGINE_BOT.md`. Sources đầy đủ (chú thích [^1]–[^15]) cũng ở cuối file đó.
