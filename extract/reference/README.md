# extract/reference/

Bản sao tham chiếu (chỉ đọc) của các bundle web client upstream của DeepSeek Harness, được trích ra từ `app.asar` của bản dựng DSH đã cài và giữ lại **chỉ cho maintainer**. Không có phần nào trong pipeline đọc chúng.

- **Không được `tools/` tạo lại.** `extract-dicts.mjs` và `extract-meta.mjs` đọc trực tiếp `app.asar` và chỉ ghi output của chính chúng; không script nào sinh, kiểm tra hay diff thư mục này. Để làm mới, hãy sao chép lại các đường dẫn trong archive dưới đây từ `app.asar` mới hơn.
- **Không chỉnh sửa.** Coi mỗi tệp là snapshot đóng băng của bundle upstream tại phiên bản tham chiếu **DSH 0.2.2-rc.1** (theo bản dựng đã cài dùng để đối chiếu; trường `version` trong các bản dump `package.json` phản ánh phiên bản gói upstream tương ứng).
- Các bản sao `.txt` trùng nội dung (`locale-client.txt` có dòng header `SIZE=…`, `module-loader.txt` là bản cắt ngắn của `client-modules-client.js`) đã bị xoá trong lần tái tổ chức tạo thư mục này; bảng dưới chỉ liệt kê các bản còn lại.

## Nội dung

Đường dẫn upstream tính từ gốc `app.asar`.

| Tệp | Đường dẫn upstream (dưới `dsh/node_modules/@deepseek-ai/`) | Byte | Mô tả |
|---|---|---:|---|
| `locale-client.js` | `dsh-client-locale/lib/client.js` | 62951 | Bundle trình duyệt của plugin locale (`@deepseek-ai/dsh-client-locale`): đăng ký `window.__ModuleLoader__.load` cung cấp dịch vụ locale, từ điển tích hợp và UI chọn ngôn ngữ cho web GUI — điểm mà gói `vi` cắm vào. |
| `client-modules-client.js` | `dsh-client-modules/lib/client.js` | 46292 | Nửa phía trình duyệt của hệ thống client-module plugin: phân tích `window.__DSH_BOOT__`, duyệt đồ thị boot và nạp bundle plugin theo kiểu lazy. |
| `client-modules-host.js` | `dsh-client-modules/lib/index.js` | 42376 | Nửa phía Host của cùng gói: quét khai báo `dsh.client` đã bật, dựng đồ thị boot và phục vụ bundle plugin qua `/plugins`. |
| `client-modules-README.md` | `dsh-client-modules/README.md` | 17324 | Tài liệu tham chiếu upstream của gói (phần tiếng Anh) mô tả hệ thống client-module. |
| `chat-package.json` | `dsh-client-ui-chat/package.json` | 3768 | `package.json` của `@deepseek-ai/dsh-client-ui-chat` (gói client chat/hội thoại): exports, dependencies. |
| `locale-package.json` | `dsh-client-locale/package.json` | 2008 | `package.json` của `@deepseek-ai/dsh-client-locale` (plugin locale): điểm vào và dependencies. |

## Nguồn gốc

Sao chép từ `app.asar` đã cài (bản cài mặc định Windows/macOS, hoặc đường dẫn do `DSH_APP_ASAR` chỉ định).

Các tệp là snapshot, **không phải** chế độ xem trực tiếp: sau khi DSH cập nhật, hãy sao chép lại các đường dẫn archive ở trên trước khi tin dùng chúng. (Ghi chú lịch sử: bộ dump trước đó được đối chiếu với DSH 0.2.1-rc.2; khi làm mới từ bản dựng mới, cập nhật phiên bản tham chiếu và kiểm chứng byte-for-byte.)
