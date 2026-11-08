# Gói ngôn ngữ Tiếng Việt cho DeepSeek Harness

Thêm `Tiếng Việt (vi)` vào **Settings → General → Language** và Việt hoá Web GUI bằng từ điển Tiếng Việt cho tất cả 74 namespace locale mà Harness phát hành (3.843 khóa), cùng 264 tiêu đề và 75 mô tả gói hiển thị trong danh sách plugin, và 3 lời nhắc phê duyệt mà Host gửi kèm yêu cầu quyền.

- **Gói client:** `client.js` đăng ký `vi` qua `ctx.locale.addLanguage`, sau đó đăng ký một từ điển cho mỗi namespace bằng `ctx.locale.register(ns, 'vi', dict)`, rồi bọc `ctx.locale.resolveText` để tiêu đề/mô tả gói đã cài và lời nhắc phê duyệt của Host được hiển thị bằng Tiếng Việt khi `vi` đang hoạt động. Các từ điển locale không bao phủ phần văn bản này: Host dựng nó từ `locale/en.json` của từng gói (hoặc từ yêu cầu quyền), nên gói ngôn ngữ mang bản dịch theo và khớp dựa trên văn bản tiếng Anh gốc. Lời nhắc phê duyệt có nội suy giá trị (chế độ quyền sandbox, lý do, v.v.) được khớp theo khuôn mẫu để giữ nguyên giá trị động trong khi dịch phần khung.
- **Dự phòng:** `en`. Mọi khóa hoặc văn bản gói chưa được gói ngôn ngữ bao phủ sẽ giải thành tiếng Anh, nên giao diện không bao giờ hiển thị khóa thô.
- **Phần Host:** `index.js` cố ý để trống; toàn bộ hành vi nằm ở phía trình duyệt.

## Bố cục

| Đường dẫn | Mục đích |
|---|---|
| `package.json` | Manifest gói (`dsh.bundle.patch`, `dsh.client`); cũng là giao diện cài đặt của spec thư mục con (`<repository-url>#path:/plugin`) |
| `cordis.patch.yml` | Bản vá loader chèn mục `dsh-vi-pack` |
| `index.js` | Phần Host (không làm gì) |
| `client.js` | Gói trình duyệt được sinh ra: mọi từ điển Tiếng Việt cùng lớp phủ văn bản gói và văn bản Host |
| `locale/en.json`, `locale/vi.json` | Tiêu đề/mô tả hiển thị trong danh sách plugin |
| `icon.svg` | Biểu tượng gốc của gói |

## Cài đặt

Gói có hai giao diện cài đặt, và DSH đọc giao diện mà đích cài đặt chọn:

| Đích | Manifest | Ghi chú |
|---|---|---|
| `https://github.com/dinhdev666/dsh-vi-pack` | `package.json` ở gốc kho | Cài toàn bộ kho; manifest gốc khai báo `dsh.bundle` trỏ tới `plugin/cordis.patch.yml` và xuất các tệp của thư mục này |
| `https://github.com/dinhdev666/dsh-vi-pack#path:/plugin` | `plugin/package.json` | Chỉ cài thư mục này, nên lượt tải nhỏ hơn |

Cả hai manifest mô tả cùng một gói: tên, phiên bản, mô tả và `dsh.client` phải đồng bộ; `node tools/validate-manifest.mjs` sẽ thất bại khi chúng lệch.

Mỗi manifest cũng cần một điểm vào module ở gốc của nó (`main`, hoặc `index.js` bên cạnh manifest). Loader giải quyết module gói theo cách CommonJS (gốc gói, rồi `index.js`), nên manifest gốc chỉ có `exports` sẽ cài được nhưng kích hoạt thất bại với `failed to import: ... /index.js`.

## Tạo lại

`client.js` được sinh ra từ các nguồn bản dịch; **không chỉnh tay**.

```bash
node tools/validate-meta.mjs       # độ phủ tiêu đề/mô tả gói và văn bản Host trong vi-meta/
node tools/validate-vi.mjs         # kiểm tra khớp khóa, placeholder, CJK, định dạng
node tools/validate-manifest.mjs   # package.json ở gốc và plugin/package.json vẫn mô tả một gói
node tools/build-client.mjs        # đọc vi-packs/*.json và vi-meta/*.json, ghi plugin/client.js
node tools/test-client.mjs         # giả lập dịch vụ locale của Client và chạy gói
```

Quy tắc bản dịch và bảng thuật ngữ nằm trong [`GUIDE.md`](../GUIDE.md).
