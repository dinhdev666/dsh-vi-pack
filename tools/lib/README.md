# tools/lib — helper dùng chung

Các module ESM nhỏ được mọi script trong `tools/` sử dụng. Mục đích là mỗi đoạn logic chỉ nằm ở **một** nơi duy nhất: phần mà hai script cùng cần sẽ đặt ở đây, thay vì sao chép lặp lại. Chỉ dùng `node:` builtins — dự án không có dependency.

| Module | Export | Công dụng |
|---|---|---|
| `repo.mjs` | `BASE`, `repoPath()`, `readJson()`, `writeJson()`, `loadManifest()`, `EXTRACT_DIR`, `extractPath()`, `PACKS_DIR`, `packsPath()`, `META_DIR`, `metaPath()` | Xác định gốc kho, đọc/ghi JSON theo quy tắc hygiene của repo (thụt lề 2 khoảng trắng, đúng 1 dòng trống cuối), manifest namespace, và helper thư mục `extract/`, `vi-packs/`, `vi-meta/`. |
| `text.mjs` | `placeholders()`, `placeholderKey()`, `stripPlaceholders()`, `CJK_VI`, `CJK_META` | Trích xuất placeholder (`{name}`, `{{x}}`) dùng chung cho validator, builder và bước dựng dataset. Hai hằng CJK **khác nhau có chủ đích** (`validate-vi` bắt đầu ở U+3000, `validate-meta` còn chặn CJK radicals từ U+2E80); không hợp nhất chúng. |
| `meta.mjs` | `loadMetaSource()`, `loadHostTextSource()`, `listMetaParts()`, `readMetaPart()`, `readHostTextPart()`, `HOST_TEXT_FILE` | Nguồn lớp phủ: `extract/meta.json` + các tệp phần `vi-meta/packages-*.json` (đã sắp xếp), và `extract/host-text.json` + `vi-meta/host-text.json`. |
| `bundle-text.mjs` | `tokenize()`, `matchBrackets()`, `readBinding()`, `languageMaps()`, `MAX_LANGUAGES` | Đọc language map nằm trong bundle JavaScript của bản dựng DSH đã cài (văn bản hiển thị gói, lý do phê duyệt): tokenizer chịu được mã đã minify, bộ khớp ngoặc, và bộ đọc binding `const NAME = …`. |
| `bundle.mjs` | `BUNDLE_DIR`, `ROOT_MANIFEST`, `BUNDLE_MANIFEST`, `readRootManifest()`, `readBundleManifest()` | Thư mục bundle phát hành và hai manifest: `package.json` ở gốc kho (cài qua URL Git thuần) và `plugin/package.json` (cài qua spec thư mục con `<url>#path:/plugin`). |
| `asar.mjs` | `resolveAppAsar()`, `requireAppAsar()`, `UPSTREAM_ROOTS`, `openAsarArchive()` | Định vị bản dựng DSH đã cài (`DSH_APP_ASAR`, rồi đường dẫn mặc định Windows/macOS), kiểm tra thoát khi thiếu, các gốc `node_modules/@deepseek-ai` / `dsh/node_modules/@deepseek-ai` mà script trích xuất duyệt, và đọc tệp từ `app.asar` bằng `node` thuần. |

Quy ước:

- Không chạy tác dụng phụ khi import — script trích xuất có thể được import dưới runtime Electron-as-node; `resolveAppAsar()` chỉ dò filesystem khi được gọi.
- Mọi module tự xác định đường dẫn từ vị trí của chính nó, nên checkout có thể ở bất kỳ đâu và công cụ chạy từ mọi thư mục làm việc.
- Thông báo lỗi và mã thoát thuộc về script sở hữu lệnh; helper không in ra.
