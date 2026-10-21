# Vietnamese language pack — translation guide

You are translating the DeepSeek Harness (DSH) Web GUI from English into Vietnamese.
Source of truth: `extract/en/<namespace>.json` (one JSON object per locale namespace).
Output: `vi-packs/<namespace>.json` — exactly the same keys, values translated.
Package titles and descriptions are a separate file family: `extract/meta.json` → `vi-meta/packages-*.json`
(see [Package display text](#package-display-text-vi-meta) below).

## Hard rules

1. **Same keys, same order.** Never add, remove, rename, or reorder keys.
2. **Valid JSON**, UTF-8, 2-space indentation, exactly one trailing newline.
3. **Placeholders are invariants.** `{name}`, `{count}`, `{{x}}` keep the identical
   spelling and braces. Move them to where Vietnamese word order needs them, never
   translate or reformat them (`{toolName}` stays `{toolName}`, not `{tên công cụ}`).
4. **No CJK characters** (Chinese/Japanese/Korean). The zh source is context only.
5. **Keep technical tokens verbatim**: `Mod`, `Ctrl`, `Shift`, `Alt`, `Esc`, `Tab`,
   `Enter`, `Backspace`, arrow glyphs (`↑ ↓ ← →`), `JSON`, `Markdown`, `HTML`, `PDF`,
   `CSV`, `YAML`, `MCP`, `CLI`, `API`, `URL`, `UUID`, `SSH`, `PTY`, `Git`, `diff`,
   `DeepSeek`, `DSH`, `Cordis`, `PTC`, `Skills` feature names, model/provider names,
   file extensions (`*.json`, `.md`), and anything inside backticks or quotes that is
   code. Units (`K`, `M`, `GB`, `MB`, `ms`, `s`) stay as-is.
6. **Markdown structure survives.** Long help texts contain `###` headings, `>` block
   quotes, blank lines (`\n\n`), and `-` lists. Translate the words, keep the markers,
   the line breaks, and the paragraph count.
7. **Ellipsis** `…` stays `…` (never turn it into `...`). Trailing punctuation follows
   the English entry: labels, buttons, menu items and titles have **no** trailing
   period; full sentences keep theirs.
8. **No leftover English** except the allowed tokens above. Product names are fine.
9. Do not wrap values in extra quotes, do not escape Vietnamese diacritics.

## Vietnamese style

- Natural Vietnamese UI copy: concise, neutral, no filler. Prefer the shortest phrasing
  that keeps the English meaning exactly. Short labels should not grow much longer than
  English (aim ≤ 1.4×; a shorter, natural wording beats a literal one).
- Sentence case: capitalize only the first word (and proper nouns). Never Title Case:
  `Cài đặt`, not `Cài Đặt`.
- Address the user as implied (imperative for buttons) — `Lưu`, `Hủy`, `Thử lại`.
  When a sentence needs a subject, use `bạn`; never `quý vị`.
- `aria` / accessibility keys describe an element: short noun phrase, no trailing period
  (`Toolbar diễn biến`, `Chi tiết phê duyệt`).
- Plural/quantity: Vietnamese has no plural inflection; `{count} files` → `{count} tệp`.
- Keep the same register as English: terse for chrome, explanatory for settings help.

## Glossary (use consistently)

| English | Vietnamese |
|---|---|
| Agent | agent (lowercase mid-sentence, `Agent` at sentence start) |
| Subagent | agent con |
| Workspace | không gian làm việc |
| Session | phiên |
| Skill | kỹ năng |
| Tool | công cụ |
| Tool call | lệnh gọi công cụ |
| Plugin | plugin |
| Model | mô hình |
| Provider | nhà cung cấp |
| Account | tài khoản |
| Setting(s) | cài đặt |
| Command | lệnh |
| Shortcut | phím tắt |
| Prompt | lời nhắc |
| Message | tin nhắn |
| Turn | lượt |
| Reasoning | suy luận |
| Thinking | suy nghĩ |
| Token | token |
| Context | ngữ cảnh |
| Compaction | nén ngữ cảnh |
| Approval | phê duyệt |
| Permission | quyền |
| Plan | kế hoạch |
| Goal | mục tiêu |
| Workflow | quy trình |
| Job | tác vụ |
| Schedule | lịch |
| Deliverable | sản phẩm bàn giao |
| Attachment | tệp đính kèm |
| File | tệp |
| Folder / Directory | thư mục |
| Path | đường dẫn |
| Sidebar | thanh bên |
| Panel | bảng |
| Feedback | phản hồi |
| Reference | tham chiếu |
| Trajectory | diễn biến |
| Transcript | bản ghi |
| Voice input | nhập bằng giọng nói |
| Voice recording | ghi âm giọng nói |
| Speech recognition | nhận dạng giọng nói |
| Speech transcription | chuyển giọng nói thành văn bản |
| Team | nhóm |
| Team member | thành viên nhóm |
| Shared task | tác vụ nhóm |
| Badge | huy hiệu |
| Plugin market | chợ plugin |
| Plugin manager | trình quản lý plugin |
| Secret | bí mật |
| Session inspector | trình kiểm tra phiên |
| Diff | diff |
| Usage | mức sử dụng |
| Default | mặc định |
| Enabled / Disabled | bật / tắt |
| Loading… | Đang tải… |
| Copy / Copied | Sao chép / Đã sao chép |
| Retry | Thử lại |
| Cancel | Hủy |
| Close | Đóng |
| Save | Lưu |
| Delete | Xóa |
| Edit | Chỉnh sửa |
| Search | Tìm kiếm |
| More | Thêm |
| Expand / Collapse | Mở rộng / Thu gọn |
| Truncated | Đã cắt bớt |
| Unknown | Không rõ |
| None | Không có |
| OK | OK |

Keep `OK` as `OK`, keep `JSON`, `HTML`, `1017` style tokens unchanged.

## Workflow

1. Read your assigned source files under `extract/en/`.
2. Write the matching Vietnamese file under `vi-packs/`.
3. Validate your files from the repository root (every path in this guide is relative to it):
   `node tools/validate-vi.mjs <ns1> <ns2> ...`
   Fix every reported error before reporting done.
4. Touch only your assigned files. Never edit `extract/`, other teammates' packs,
   `tools/`, `plugin/`, or the task board of other batches.

Report back: namespaces finished, key counts, validator result, and anything you had to
interpret (ambiguous copy, strings that must stay English).

## Package display text (`vi-meta/`)

Two more places show English that no locale namespace reaches: the package name and description in
**Plugins** (Plugin Manager) and in **Settings → Plugins → Built-in plugins**. That text is Host data
built from each package's own `locale/en.json`, so the pack carries it as `vi-meta/packages-*.json`
and the browser bundle resolves it through `locale.resolveText` while `vi` is the active language.

| | |
|---|---|
| Source of truth | `extract/meta.json`, regenerated with `node tools/extract-meta.mjs` from the installed build |
| Output | `vi-meta/packages-*.json`, keyed by package name, with `title` and, when the package has one, `description` |
| Check | `node tools/validate-meta.mjs` (add `--partial` while a batch is still being written) |

Rules that differ from namespaces:

1. **Keys are package names**, copied from `extract/meta.json`; keep their order inside a part file,
   never rename one, and do not add packages that are missing from the snapshot.
2. **Titles are package labels, not sentences.** A kebab English title (`ui-chat`, `timer`,
   `fs-sandbox`) is an internal id: translate the *meaning* the Chinese title states, not the words.
   Short noun phrase, 2–4 words, at most ~40 characters, no trailing period.
3. **Descriptions are one sentence of product copy** (Plugin Manager shows them under the name).
   Follow the English closing punctuation: most have none, so do not add a period.
4. **Two packages can share one English title.** The bundle keys translations by that English
   string, so both entries must carry the same Vietnamese wording; the validator rejects a split.
5. Keep technical tokens (`Bash`, `PowerShell`, `NodeJS`, `MCP`, `Git`, `Cordis`, `PTC`, `API`,
   `Typert`, `SenseVoice`, `Ralph`, `Chrome DevTools`, `Ctrl/Cmd+Shift+.`, `shell`, `terminal`,
   `plugin`, `worktree`, `preset`) and `DSH`/`DeepSeek` unchanged.

## Lead decisions after review

Terminology settled during the final polish pass, applied across every pack:

| English | Final Vietnamese | Note |
|---|---|---|
| Preset | preset | Loanword kept (e.g. "preset agent"); do not switch to "cấu hình sẵn". |
| Registry (npm) | Kho npm | Same wording in Plugin Manager and Plugin Market. |
| Mirror | Nguồn gương | e.g. "Nguồn gương Trung Quốc đại lục". |
| Repository (git) | Kho lưu trữ | |
| Commit | Bản commit | |
| Payload | Dữ liệu gửi | e.g. "JSON dữ liệu gửi". |
| Diff | Khác biệt | In "diff mã" (code diffs) the loanword stays. |
| Onboarding artwork locale | `en` | Artwork ships only for en/zh; keep `en` so the illustration resolves. |
| Speech transcription | chuyển giọng nói thành văn bản | Not "phiên âm"; matches the `voice-input` strings. |
| Team / team member / team task | nhóm / thành viên nhóm / tác vụ nhóm | Matches `agent-team.json` and the team tool titles in `conversation.json`. |
| Badge | huy hiệu | `“powered by dsh”` inside the badge text stays English. |
| Worktree | worktree | Loanword, like `terminal`. |
| Auto review (permission mode) | Tự động xem xét | Matches `permission.access.json` `auto.label`. |
| Installed-package text | `vi-meta/` | Titles/descriptions resolve by English wording, not by package name. |

Lowercase ASCII values are only acceptable for units (`s`, `m `, `h `, `ms`, `px`), product
names, URLs, and placeholder-only strings. Labels are sentence case, never all lowercase.
