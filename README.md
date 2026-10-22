# DSH Tiếng Việt

Gói ngôn ngữ tiếng Việt cho giao diện web **DeepSeek Harness (DSH)**: thêm `Tiếng Việt (vi)` vào
**Settings → General → Language** và dịch giao diện bằng bộ từ điển phủ toàn bộ namespace locale
mà Harness phát hành.

- **63 namespace, 2.901 khóa** trên 53 gói client của DSH.
- **218 tiêu đề và 31 mô tả gói** đã dịch cho danh sách plugin: **Plugin Manager** (kể cả mục
  *More* của các gói chưa cài) và **Settings → Plugins → Built-in plugins**. Phần chữ này do Host
  dựng từ `locale/en.json` của từng gói nên không nằm trong namespace nào; gói ngôn ngữ bổ sung bản
  dịch trong `vi-meta/` và phủ lên `ctx.locale.resolveText`.
- **3 lời nhắc phê duyệt** (nâng quyền sandbox và Auto review từ chối lệnh gọi) cũng đã dịch: đây
  là chữ do Host gửi kèm yêu cầu phê duyệt dưới dạng `en`/`zh`, nên bản dịch nằm trong
  `vi-meta/host-text.json` và được phủ qua cùng entry point đó.
- **Fallback `en`**: khóa nào chưa dịch sẽ hiển thị tiếng Anh, giao diện không bao giờ lộ khóa thô.
- **Plugin DSH chuẩn**: `@dinhdev666/dsh-vi-pack`, nửa browser đăng ký ngôn ngữ qua `ctx.locale.addLanguage`,
  từng namespace qua `ctx.locale.register(ns, 'vi', dict)`, và tên/mô tả gói qua lớp phủ
  `ctx.locale.resolveText`; nửa host là no-op.

## Cấu trúc dự án

| Đường dẫn | Nội dung |
|---|---|
| `extract/` | Dữ liệu trích xuất từ DSH chỉ dùng cho pipeline: `en/<namespace>.json` (nguồn chuẩn), `manifest.json`, `meta.json` (tên/mô tả gói), `host-text.json` (lời nhắc phê duyệt), `dicts-v2.json`, `summary-v2.txt`, `validation.txt` |
| `extract/reference/` | Bản dump bundle gốc của DSH để tham chiếu khi bảo trì (`README.md` của thư mục này giải thích nguồn gốc); không sinh tự động, không script nào đọc |
| `vi-packs/` | **Bản dịch tiếng Việt** — 63 tệp JSON cùng tên, cùng thứ tự khóa với `extract/en/` |
| `vi-meta/` | **Bản dịch phần chữ Host không đi qua namespace** — `packages-*.json` (tên/mô tả gói, khóa theo tên gói, đối chiếu `extract/meta.json`) và `host-text.json` (lời nhắc phê duyệt, khóa theo câu tiếng Anh, đối chiếu `extract/host-text.json`) |
| `plugin/` | Plugin đóng gói để cài vào DSH: `client.js` (sinh tự động), `index.js` (host no-op), `cordis.patch.yml`, `locale/*.json`, `icon.svg` |
| `package.json` | Manifest cài đặt ở **gọc repository** — mặt cài đặt của địa chỉ Git thuần: khai báo `dsh.bundle` trỏ vào `plugin/cordis.patch.yml` và `exports` trỏ vào `plugin/`; giữ đồng bộ tên, version, mô tả với `plugin/package.json` |
| `tools/` | Toàn bộ pipeline: trích xuất, dựng dataset, build, kiểm tra, audit, test |
| `tools/lib/` | Helper dùng chung của `tools/`: gốc repo và đọc/ghi JSON (`repo.mjs`), regex placeholder & CJK (`text.mjs`), dữ liệu `vi-meta` (`meta.mjs`), đọc `app.asar` (`asar.mjs`), thư mục bundle và hai manifest (`bundle.mjs`) |
| `GUIDE.md` | Quy tắc dịch, định dạng, glossary thuật ngữ thống nhất |
| `AGENTS.md` | Quy ước cho agent lập trình làm việc trong repo này |
| `CONTRIBUTING.md` | Hướng dẫn đóng góp |
| `LICENSE` | Giấy phép MIT |

## Cài đặt

### Qua Plugin Manager (khuyên dùng)

Trong giao diện web DSH, mở **Plugins → Add plugin** và dán địa chỉ repository:

```
https://github.com/dinhdev666/dsh-vi-pack
```

DSH chạy `pnpm add` với địa chỉ đó, nên **`package.json` ở gọc repository** chính là thứ được đọc:
nó khai báo `dsh.bundle` (trỏ vào `plugin/cordis.patch.yml`) và `exports` (trỏ vào `plugin/`), nên
DSH cài được đúng một bundle, tự thêm vào danh sách bundle của profile và kích hoạt nó. Sau khi cài,
tải lại trang (Cmd/Ctrl+R), mở **Settings → General → Language** và chọn **Tiếng Việt**.

Muốn nâng cấp sau khi có bản mới: gỡ bundle trong Plugin Manager rồi cài lại.

> Cài bằng địa chỉ repository thuần sẽ tải **cả repository** (kèm `extract/`, `vi-packs/`, `tools/`).
> Nếu chỉ muốn phần cài gọn, dùng spec trỏ thẳng vào thư mục bundle:
> `https://github.com/dinhdev666/dsh-vi-pack#path:/plugin` — thư mục `plugin/` có manifest riêng
> (`plugin/package.json`) nên cài được như một bundle độc lập.

### Cài thủ công vào profile (khi clone sẵn repo)

Plugin được nạp như một bundle local của DSH profile (ví dụ profile `desktop` tại
`~/.dsh/profiles/desktop`, trên Windows là `%USERPROFILE%\.dsh\profiles\desktop`).

1. Khai báo dependency trỏ tới thư mục plugin trong `package.json` của profile. Dùng đường dẫn
   tương đối (tính từ thư mục profile) để cấu hình chạy được trên cả macOS và Windows:

   ```json
   "dependencies": {
     "@dinhdev666/dsh-vi-pack": "link:../../../dev/dsh-vi-pack/plugin"
   }
   ```

   Ví dụ trên ứng với repo clone tại `~/dev/dsh-vi-pack`; chỉnh lại cho khớp vị trí thật của bạn.
   Trên Windows, nếu repo và profile nằm ở hai ổ đĩa khác nhau thì buộc phải dùng đường dẫn tuyệt
   đối (ví dụ `link:<đường-dẫn-tuyệt-đối-tới-repo>/plugin`).

2. Thêm bundle vào danh sách profile:

   ```json
   "dsh": {
     "profile": {
       "bundles": [
         "@dinhdev666/dsh-vi-pack"
       ]
     }
   }
   ```

3. Khởi động lại DSH, mở **Settings → General → Language** và chọn **Tiếng Việt**.
   Muốn cố định ngôn ngữ, đặt trong `cordis.patch.yml` của profile:

   ```yaml
   - id: locale
     name: "@deepseek-ai/dsh-client-locale"
     config:
       preference: vi
   ```

## Quy trình phát triển

```
DSH đã cài (app.asar)
  ├─ tools/extract-dicts.mjs ──► extract/dicts-v2.json, extract/summary-v2.txt
  │    └─ tools/prepare-dataset.mjs ──► extract/en/*.json, extract/manifest.json
  │         └─ [dịch tay] ──► vi-packs/*.json                                   ┐
  ├─ tools/extract-meta.mjs ──► extract/meta.json                               │
  │    └─ [dịch tay] ──► vi-meta/packages-*.json                                ┤
  └─ tools/extract-host-text.mjs ──► extract/host-text.json                     │
       └─ [dịch tay] ──► vi-meta/host-text.json                                 ┤
                                                                                └─ tools/build-client.mjs ──► plugin/client.js
                                                                                 └─ tools/validate-*.mjs / audit-vi.mjs / test-client.mjs
```

Chỉ cần chạy lại các bước trích xuất khi DSH cập nhật từ điển gốc:

```bash
node tools/extract-dicts.mjs      # đọc locale từ bundle DSH đã cài (cần Electron-as-node để mở app.asar)
node tools/prepare-dataset.mjs    # tách extract/en/*.json + manifest.json
node tools/extract-meta.mjs       # đọc tên/mô tả gói vào extract/meta.json (chạy bằng node thường)
node tools/extract-host-text.mjs  # đọc lời nhắc phê duyệt vào extract/host-text.json (node thường)
```

Các lệnh dùng hằng ngày (chạy từ thư mục gốc repo):

```bash
node tools/validate-vi.mjs                       # toàn bộ 63 namespace
node tools/validate-vi.mjs chat conversation     # chỉ định namespace
node tools/validate-meta.mjs                     # toàn bộ 218 tiêu đề, 31 mô tả gói, 3 lời nhắc phê duyệt
node tools/validate-meta.mjs --partial           # báo phần còn thiếu, không tính là lỗi
node tools/audit-vi.mjs                          # soát tiếng Anh sót, glossary, khoảng trắng
node tools/build-client.mjs                      # sinh lại plugin/client.js
node tools/test-client.mjs                       # smoke test bundle với locale service giả lập
```

`build-client.mjs` từ chối build khi thiếu namespace, thiếu/thừa khóa, giá trị rỗng, placeholder lệch
so với bản tiếng Anh, hoặc khi một gói đang có trong DSH chưa có tên/mô tả tiếng Việt.
`test-client.mjs` nạp `plugin/client.js` trong `node:vm`, kiểm tra số namespace, số khóa từng
namespace, ngôn ngữ dự phòng, lớp phủ tên/mô tả gói và việc dọn dẹp effect.

## Chất lượng bản dịch

- `validate-vi.mjs` — lỗi cứng: key parity, placeholder, ký tự CJK, khoảng trắng thừa, giá trị
  trùng tiếng Anh; cảnh báo: thứ tự khóa, số dòng, marker Markdown, độ dài.
- `validate-meta.mjs` — lỗi cứng: gói trong DSH chưa có tên/mô tả, khóa lạ hoặc trùng, ký tự CJK,
  hai gói dùng chung một chuỗi tiếng Anh nhưng dịch khác nhau, và lời nhắc phê duyệt thiếu bản dịch,
  sai placeholder hoặc không còn trong bản trích xuất.
- `audit-vi.mjs` — soát mềm: cụm tiếng Anh còn sót, lệch glossary, lỗi khoảng trắng, chuỗi ASCII
  không dấu đáng ngờ.
- Quy tắc chi tiết và glossary nằm trong [GUIDE.md](GUIDE.md).

Trạng thái hiện tại: 63/63 namespace dịch đủ 2.901 khóa; 218/218 tiêu đề, 31/31 mô tả gói và 3/3 lời
nhắc phê duyệt đã dịch; `validate-vi`, `validate-meta`, `test-client` và `build-client` đều qua.

## Ghi chú

- Không sửa tay `plugin/client.js` — tệp này sinh từ `vi-packs/*.json` và `vi-meta/packages-*.json`
  qua `build-client.mjs`.
- Tên và mô tả gói được tra theo **đúng chuỗi tiếng Anh** mà Host trả về, không theo tên gói: khi DSH
  đổi câu chữ gốc, chạy lại `extract-meta.mjs` rồi cập nhật `vi-meta/` (validator sẽ báo gói thiếu).
- Bundle client chỉ nạp một lần khi mở trang, nên sau mỗi lần build lại hãy tải lại GUI (Ctrl/Cmd+R)
  để thấy bản dịch mới.
- `tools/*.mjs` tự suy ra gốc repo từ vị trí script (qua `tools/lib/repo.mjs`) nên clone ở đâu cũng
  chạy được và chạy được từ mọi thư mục; helper dùng chung nằm ở `tools/lib/`, các script chỉ giữ
  logic riêng. Riêng `extract-dicts.mjs` và `extract-meta.mjs` cần bản DSH đã cài: hai script tự dò
  bản cài mặc định trên Windows/macOS (code trong `tools/lib/asar.mjs`), nếu DSH nằm chỗ khác thì đặt
  biến môi trường `DSH_APP_ASAR` trỏ tới `app.asar`.
- Tên sản phẩm, thuật ngữ kỹ thuật (`JSON`, `Markdown`, `MCP`, tổ hợp phím, tên model…) được giữ
  nguyên tiếng Anh theo quy ước trong `GUIDE.md`.
- Id row mà bundle chèn vào cây Loader là `dsh-vi-pack` (trước là `locale-vi`); Plugin Manager hiện
  id này trong mục **Thành phần**, và đây là địa chỉ duy nhất để tắt/bật riêng row đó trong
  `cordis.patch.yml` của profile. Nếu bạn đã từng ghi tay `- id: locale-vi` vào profile patch, hãy
  xoá hoặc đổi sang `dsh-vi-pack` — bộ ghép patch của DSH bỏ qua id không khớp và chỉ cảnh báo.

## Phạm vi: những chỗ vẫn là tiếng Anh

Bản dịch phủ toàn bộ chuỗi đi qua hệ thống ngôn ngữ của DSH. Một vài chỗ nằm ngoài hệ thống đó nên
vẫn hiển thị tiếng Anh, kể cả khi chọn tiếng Việt — bản `zh` của DSH cũng vậy:

- Nội dung `SKILL.md` và mô tả kỹ năng do từng gói/gói kỹ năng tự cung cấp: đây là nội dung của
  plugin, không phải chuỗi giao diện.
- Tên và mô tả của plugin bên thứ ba trong chợ plugin: do chỉ mục bên ngoài cung cấp (chỉ hiện tiếng
  Việt nếu chính chỉ mục đó có bản dịch `vi`).
- Màn hình khởi động của shell (`Loading plugins…`, `Failed to load plugins`) vẽ trước khi ngôn ngữ
  được nạp.
- Tên gói, đường dẫn, mã lệnh và tên model luôn giữ nguyên.

## Giấy phép

Phát hành theo [MIT License](LICENSE) © 2026 **Phạm Văn Định**.

[![](https://img.shields.io/badge/powered_by-dsh-4D6BFE?style=flat-square&logo=deepseek&logoColor=white)](https://github.com/deepseek-ai/deepseek-harness)