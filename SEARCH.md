Plan giúp anh thêm trang search (ô search) và trang kết quả (Kết quả search). Đảm bảo code clean, đúng theo rules codebase. Đảm bảo sau này thay đổi
UI library thì đổi nhanh không cần đổi từng trang, DRY (Note luôn vào AGENTS.md phần này nha). Nội dung Plan viết bằng Tiếng Việt nha. Với các chức năng sau:

1. Trang search:

- Logo phía trên, khung search phía dưới. Dưới khung search có 3 chỗ chọn để search nhanh (Dùng cho demo theo từng case, tạm mock trước case 1,2,3 nha). Khi
  nhấn vào thì nó qua trang kết quả search.
- Kế bên khung search có ô search (Nhấn vào thì thực hiện search và qua trang kết quả).

2. Trang kết quả search (Nhận nội dung keywords user nhập ở trước đó, sau đó thực hiện search):
   2.1 Đối với các keywords mock (Case 1,2,3) thì hardcode luôn (prototype demo). Tạm show trang HELLO + CASE là được (implement sau).
   2.2 Các trường hợp còn lại thì thực hiện search theo logic:
   2.2.1 Dùng keywords user đã nhập, và thực hiện gọi API để search, lấy nội dung trước bằng:

```
const result = await exa.search(
  "Thị trường kim cương Việt Nam hôm nay",
  {
    numResults: 10,
    type: "instant",
    contents: {
      text: true
    }
  }
);
```

2.2.2 Sau khi có kết quả. Thực hiện loop qua từng kết quả và thực hiện:
2.2.2.1 Set var kết quả tìm kiếm (Để xíu list phía dưới cùng gồm title, description, url)
2.2.2.2 Tổng hợp thông tin nội dung (Từng section (đoạn văn) trong .text field) bằng AI (AISDK). Và build result object:

- Overview: Thông tin tổng quan mà các trang đã viết (Nếu có).
- Section nội dung: Các section nội dung cốt lõi, unique, nội bật của riêng từng trang nói về chủ đề mà user đang search.
  - Các section gồm nội dung text.
  - Và các biểu đồ (nếu có). Việc thu thập dữ liệu & quyết định biểu đồ sẽ do AI thu thập và generate.
  - Mỗi section sẽ có danh sách các câu hỏi (Do AI generate): Mục tiêu để user hỏi sâu hơn về chủ đề của section này.
- Phản biện, lưu ý: Các section nội dung phản biện.
- Kết luận: Thông tin kết luận mà các trang đã viết.

Format:

```
{
    data: [
        {
            type: "overview",
            title: "Nội dung chính của section này (AI GEN NHA)",
            contents: [
                {
                    source: {
                        id: exa.results.id,
                        url: exa.results.url,
                        publishedDate: exa.results.publishedDate,
                        author: exa.results.author,
                        favicon: "https://author.com/favicon.png", //Resolve favicon từ author
                    },
                    publishedDate: exa.results.publishedDate,
                    content: "Nội dung section đã trích xuất",
                    chart: {
                        type: "line",
                        data: [
                            {
                                year: 2025,
                                revenue: 100000,
                            },
                            {
                                year: 2026,
                                revenue: 200000,
                            }
                        ]
                    }
                },
                {
                    id: exa.results.id,
                    content: "Nội dung section đã trích xuất",
                },
                ...
            ],
            followUpQuestions: ["Vì sao doanh thu tăng mạnh?", "Có ý nghĩa gì?"...]
        },
        {
            type: "article",
            title: "Nội dung chính của section này (AI GEN NHA)",
            contents: [
                {
                    id: exa.results.id,
                    content: "Nội dung section đã trích xuất",
                },
                {
                    id: exa.results.id,
                    content: "Nội dung section đã trích xuất",
                },
                ...
            ],
            followUpQuestions: ["Vì sao doanh thu tăng mạnh?", "Có ý nghĩa gì?"...]
        }
    ]
}
```
