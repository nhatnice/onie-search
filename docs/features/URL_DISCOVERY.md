# URL DISCOVERY

Bot khám phá và thu thập các URL trên internet.

## Requirements

### 1. Database (DB)

- **Tạo table `feeds**`: Lưu thông tin các nguồn để khám phá URLs (hỗ trợ `rss`, `sitemap`, `atom`, `json feed`).
- **Chuyển đổi Schema**: Thay đổi tên schema hiện tại sang tên `crawler`.
- **Trạng thái lưu trữ**: Lưu các URL mới phát hiện vào DB với trạng thái mặc định là `pending`.
- **Quét các URLs mới trong feed**: Cron (5 phút) quét các row có thời gian quét cách đây 1 tiếng trước / null. Push vào queue chờ xử lý.
- **Worker xử lý**: Poll queue ra và push vào các adapter tương ứng để xử lý.

### 2. Adapters dành riêng cho URL Discovery

Nhiệm vụ của các adapter là thu thập (**Retrieve**) và trả về danh sách các URL cùng các child-feed (sitemap con,...) để hệ thống insert ngược lại vào table `feeds`.

> **Lưu ý:** Mục tiêu của adapter ở bước này chỉ là thu thập trước, **chưa thực hiện insert** vào DB.

- **2.1. Adapter Sitemap Discovery:**
- Khám phá và thu thập các URL bên trong tập tin Sitemap XML.
- Phân tích (Parse) và trích xuất các child sitemap.

- **2.2. Adapter RSS Discovery:**
- Khám phá và thu thập các URL bên trong các nguồn RSS XML.

- **2.3. Adapter Atom Discovery:**
- Khám phá và thu thập các URL bên trong các nguồn Atom XML.

- **2.4. Adapter JSON Feed:**
- Khám phá và thu thập các URL bên trong định dạng JSON feed.

- **2.5. Adapter DB Discovery:**
- Phân tích và trích xuất các định dạng feed (URL, sitemap, rss, atom,...) từ mã nguồn `raw_html` của các page đã lưu.

### 3. Filtering (Bộ lọc)

- Sau khi dữ liệu được thu thập bởi các adapter, tiến hành lọc qua **Robots.txt** và bộ lọc **Noindex**.
- _Yêu cầu triển khai:_ Tạo hàm Mock, comment `// TODO:` để hoàn thiện trong tương lai.

### 4. Normalize URLs (Chuẩn hóa URL)

Thực hiện loại bỏ các tham số tracking và chuyển đổi _Relative URL_ $\rightarrow$ _Absolute URL_ trước khi lưu vào DB.

#### 4.1. Chuẩn hóa cú pháp theo RFC 3986

| Quy tắc | Ví dụ |
| ------- | ----- |

| **Percent-encoding uppercase**<br>

<br>_(Chuyển ký tự mã hóa phần trăm thành chữ hoa)_ | `foo%2a` $\rightarrow$ `foo%2A` |
| **Scheme + host lowercase**<br>

<br>_(Chuyển scheme và host thành chữ thường)_ | `HTTP://Example.COM` $\rightarrow$ `http://example.com` |
| **Decode unreserved char**<br>

<br>_(Giải mã các ký tự không cần mã hóa)_ | `%7Efoo` $\rightarrow$ `~foo` |
| **Remove dot-segments**<br>

<br>_(Loại bỏ phân đoạn chấm theo RFC 3986 §5.2.4)_ | `foo/./bar/../qux` $\rightarrow$ `foo/qux` |
| **Empty path $\rightarrow$ `/**`<br>

<br>_(Đường dẫn trống mặc định thành `/`)_ | `http://example.com` $\rightarrow$ `http://example.com/` |
| **Remove default port**<br>

<br>_(Loại bỏ cổng mặc định của scheme)_ | Bỏ `:80` (đối với HTTP) hoặc `:443` (đối với HTTPS) |
| **Remove trailing dot from host**<br>

<br>_(Loại bỏ dấu chấm cuối cùng của Hostname)_ | `http://example.com./` $\rightarrow$ `http://example.com/` |
| **Normalize IP address**<br>

<br>_(Chuẩn hóa rút gọn địa chỉ IP nếu có)_ | `http://192.168.01.001/` $\rightarrow$ `http://192.168.1.1/` |
| **Remove empty query question mark**<br>

<br>_(Loại bỏ dấu `?` nếu tham số query trống)_ | `http://example.com/?` $\rightarrow$ `http://example.com/` |
| **Remove empty fragment hash**<br>

<br>_(Loại bỏ dấu `#` nếu fragment trống)_ | `http://example.com/#` $\rightarrow$ `http://example.com/` |
| **Sort query parameters**<br>

<br>_(Sắp xếp tham số query theo bảng chữ cái nếu không trùng tên)_ | `?b=2&a=1` $\rightarrow$ `?a=1&b=2` |

**Các quy tắc bổ sung:**

- **Thêm trailing `/` cho non-empty path:** `example.com/foo` $\rightarrow$ `example.com/foo/` _(Chỉ áp dụng nếu an toàn hoặc có server redirect xác nhận tương đương)_.
- **Bỏ directory index:** `a/index.html` $\rightarrow$ `a/`
- **Bỏ tiền tố www:** Loại bỏ `www.` khỏi hostname.
- **Loại bỏ tham số tracking dư thừa** _(Quan trọng nhất)_.

#### 4.2. Tracking Parameter Filtering (Lọc tham số theo dõi)

| Nền tảng / Danh mục                    | Các tham số cần lọc (Filtering Parameters)                                   |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| **Google Analytics (Universal & GA4)** | `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `_gl` |
| **Google Ads & DoubleClick**           | `gclid`, `gclsrc`, `dclid`, `wbraid`, `gbraid`                               |
| **Facebook / Meta**                    | `fbclid`, `fb_action_ids`, `fb_action_types`, `fb_source`                    |
| **Các mạng quảng cáo khác**            | `ttclid` (TikTok), `msclkid` (Bing), `twclid` (X/Twitter), `yclid` (Yandex)  |
| **Email Marketing**                    | `mc_cid`, `mc_eid` (Mailchimp), `_hsenc`, `_hsmi` (HubSpot)                  |
| **Referrer & Nguồn dẫn (Generic)**     | `ref`, `ref_src`, `source`, `origin`, `originalReferrer`                     |
| **Quản lý Phiên (Session IDs)**        | `sessionid`, `sid`, `phpsessid`, `aspsessionid`, `jsessionid`                |

#### 4.3. Relative $\rightarrow$ Absolute URL Resolution

Crawler phải chuyển đổi (resolve) mọi liên kết tương đối (URI Reference) thành URL tuyệt đối trước khi đẩy vào Frontier. Theo tiêu chuẩn _RFC 3986 §5.2_, Base URI bắt buộc phải là một Absolute URI (phải chứa scheme).

Thuật toán gồm **5 bước logic** áp dụng theo thứ tự ưu tiên từ trên xuống:

1. **Pre-parsing & Scheme Check (§5.2.1):** \* Nếu liên kết tương đối có định nghĩa `scheme` riêng (Ví dụ: `https://...`) $\rightarrow$ Dùng luôn liên kết này làm URL tuyệt đối (chỉ cần chuẩn hóa thêm) và dừng thuật toán.

- Nếu không có `scheme`, kế thừa `scheme` của Base URI và chuyển xuống Bước 2.

2. **Authority Check (§5.2.2):** \* Nếu liên kết tương đối có `authority` (Ví dụ: `//example.com/path`) $\rightarrow$ Kế thừa scheme của Base URI, thay thế toàn bộ authority, path, query của liên kết mới vào. Tiến thẳng đến Bước 5 (Recompose).
3. **Path Type Check (§5.2.2):**

- Nếu đường dẫn bắt đầu bằng `/` (Ví dụ: `/categories`) $\rightarrow$ Đây là _Absolute Path_. Nó sẽ thay thế toàn bộ path của Base URI.
- Nếu đường dẫn trống (empty path) $\rightarrow$ Kế thừa toàn bộ path của Base URI. Nếu có `query` mới thì dùng query mới, ngược lại kế thừa luôn query của Base URI.

4. **Path Merge & Clean (§5.2.3 & §5.2.4):** * Nếu là *Relative Path\* thực sự (Ví dụ: `../images/logo.png` hoặc `items/1`):

- **Merge:** Gộp path của liên kết tương đối vào sau segment cuối cùng của Base path (loại bỏ phần tên file cũ của Base nếu có).
- **Remove Dot Segments:** Áp dụng thuật toán loại bỏ các ký tự điều hướng phân đoạn chấm (`/.`, `/..`) để làm sạch đường dẫn.

5. **Recompose (§5.3):** \* Gom tất cả các thành phần đã xác định ở các bước trên (`Scheme` + `Authority` + `Path` + `Query` + `Fragment`) để dựng lại thành một URL tuyệt đối hoàn chỉnh.

#### 4.4. Xử lý các trường hợp ngoại lệ (Edge Cases)

Để tránh lỗi phân tích cú pháp hoặc rơi vào bẫy URL (spider traps), cần đặc biệt lưu ý:

- **Thẻ `<base href="...">` thay đổi Base URI:**
- Mọi liên kết tương đối phía sau sẽ resolve dựa trên URL của thẻ `<base>` này thay vì URL của trang hiện tại.
- _Quy tắc:_ Chỉ áp dụng thẻ `<base>` hợp lệ **đầu tiên** tìm thấy. Nếu có nhiều thẻ, bỏ qua các thẻ phía sau. Nếu thẻ `<base>` nằm trong `<body>`, nó chỉ có hiệu lực với các liên kết nằm sau nó trong cấu trúc DOM.

- **Protocol-Relative URL (`//`):**
- Ví dụ: `//cdn.example.com/img.jpg`
- _Quy tắc:_ Kế thừa chính xác `scheme` (HTTP hoặc HTTPS) của trang hiện tại (hoặc của thẻ `<base>` nếu có) $\rightarrow$ `https://cdn.example.com/img.jpg`.

- **Khuyến nghị Canonical URL của Google:**
- Google khuyến nghị sử dụng URL tuyệt đối trong thẻ `rel="canonical"` (Ví dụ: `https://example.com/page` thay vì `/page`).
- _Quy tắc:_ Khi thu thập thẻ canonical phải xử lý nghiêm ngặt; nếu trang gốc bị crawl nhầm ở môi trường staging/test, canonical tuyệt đối sẽ giúp sửa sai luồng index.

- **Ký tự nhiễu (Whitespace & Newlines):**
- Ví dụ: `href="   /path/to/page.html \n  "`
- _Quy tắc:_ Phải tiến hành `.trim()` loại bỏ toàn bộ khoảng trắng, tab (`\t`), và ký tự xuống dòng (`\n`, `\r`) ở đầu và cuối chuỗi URL trước khi thực hiện các bước Resolve.

- **Các liên kết phi cấu trúc (Non-routable Schemes):**
- Ví dụ: `javascript:...`, `mailto:...`, `tel:...`, `sms:...`, `data:image/...` (Base64).
- _Quy tắc:_ Nhận diện qua tiền tố và **loại bỏ ngay lập tức**, tuyệt đối không đưa vào URL Frontier để tránh crash bộ resolve hoặc tạo request lỗi.

### 5. Database insert

- Lưu lại URLs vào table pages. Nhớ check exist tránh duplicate.
- Lưu lại các feeds / rss / sitemap / atom / ... mới phát hiện vào table feeds. Nhớ check exist tránh duplicate.
- Cập nhật lại thời gian vừa quét vào table feeds.
