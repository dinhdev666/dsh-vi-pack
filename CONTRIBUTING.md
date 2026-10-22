# Contributing

Thanks for helping improve the Vietnamese language pack for DeepSeek Harness. Contributions of every
size are welcome: fixing one awkward string, translating a new namespace, or improving the tooling.

## Before you start

- Read [`GUIDE.md`](GUIDE.md) — it holds the translation rules, style guide, and the terminology
  glossary that all packs must follow.
- Read [`AGENTS.md`](AGENTS.md) — it explains which files are generated, which are hand-written, and
  the documentation language policy.
- You need **Node.js 20+** to run the tools. There are no dependencies to install: the scripts use
  only `node:` builtins, so `node tools/validate-vi.mjs` works in a fresh checkout.
- Re-extracting upstream strings additionally needs a local DSH installation, because the
  `tools/extract-*.mjs` scripts read their data directly out of the DSH `app.asar`.

## The five kinds of files

| Path | Policy |
|---|---|
| `extract/` | Generated snapshot of upstream DSH locale data. Do not edit. (`extract/reference/` holds read-only dumps of the upstream client bundles for maintainers — see its own `README.md`.) |
| `vi-packs/` | The translation output. **This is where namespace translation contributions go.** |
| `vi-meta/` | Overlay text for the plugin list and the approval card: package titles/descriptions (keyed by package name) and Host approval prompts (keyed by their English wording). Hand-written. |
| `plugin/` | The installable bundle. `client.js` is generated; other files are hand-maintained. |
| `package.json` | The bundle manifest at the repository root, used when someone installs the plain Git URL. Keep it identical in name, version, and description to `plugin/package.json`. |

## Translating or fixing strings

1. Open the English source for the namespace, e.g. `extract/en/chat.json`.
2. Open the Vietnamese pack, e.g. `vi-packs/chat.json`, and change **only the values**. Keys, key
   order, placeholders, and JSON formatting stay exactly as they are.
3. Validate the namespaces you touched:

   ```bash
   node tools/validate-vi.mjs chat
   ```

   Errors must be fixed. Warnings (key order, line counts, length) are advisory — fix the ones your
   change introduced.
4. Run the quality audit and read the findings for your namespace:

   ```bash
   node tools/audit-vi.mjs chat
   ```

5. Regenerate the bundle and smoke-test it:

   ```bash
   node tools/build-client.mjs
   node tools/test-client.mjs
   ```

Both must succeed before you send a change. `build-client.mjs` refuses to build when a namespace is
missing, a key is missing or extra, a value is empty, or placeholders differ from English.

## Translating package titles and descriptions

The plugin list (Plugin Manager, and Settings → Plugins → Built-in plugins) shows a title and
description that come from each package's own locale files, so they are not part of any namespace.
They live in `vi-meta/packages-*.json`, mirroring `extract/meta.json`:

1. Find the package in `extract/meta.json` (English `title`/`description`) and in the matching
   `vi-meta/packages-*.json` entry. The Chinese title in the snapshot states what the package does;
   a kebab English title such as `ui-chat` is an internal id, so translate its meaning.
2. Fill `title` (short noun phrase, no trailing period) and, when the package has one, `description`
   (one sentence, product copy). Keep package keys, order, and JSON formatting unchanged.
3. Validate, regenerate, and test:

   ```bash
   node tools/validate-meta.mjs
   node tools/build-client.mjs
   node tools/test-client.mjs
   ```

`validate-meta.mjs` fails when a shipped package has no translation, when an entry names a package
that no longer exists, and when two packages that share one English title carry different Vietnamese
text — the browser overlay keys translations by the English wording. `--partial` reports coverage
without failing, which is useful while translating a batch.

### Translating approval prompts (Host copy)

The approval card shows a reason the Host builds and sends with the permission request — a sandbox
escalation ("Allow this operation with danger-full-access permissions: …") or an auto-review denial
("Auto review denied this call: …"). Those arrive as `en`/`zh` maps with no locale key, so they live
in `vi-meta/host-text.json`, keyed by the English wording and mirrored against
`extract/host-text.json`:

1. Re-run `node tools/extract-host-text.mjs` to refresh `extract/host-text.json` from the installed
   build, and diff it before adding entries.
2. One key per English wording, `{mode}`, `{justification}`, `{reason}` placeholders unchanged; the
   translated frame may reorder them, but the placeholder names must match.
3. Permission modes and reviewer reasons are kept verbatim — translate the frame, not the value.

`validate-meta.mjs` and `build-client.mjs` run the same coverage checks on this file as on the
package lists, and `test-client.mjs` exercises the matcher (exact wording, then template).

### Non-negotiables

- Placeholders keep identical spelling and braces: `{name}`, `{count}`, `{{x}}`. Move them where
  Vietnamese word order needs them; never translate or re-format them.
- No CJK characters, no leftover English outside the allowed technical tokens, `…` stays `…`.
- Keep technical tokens verbatim: keyboard keys, `JSON`, `Markdown`, `MCP`, `API`, `URL`, file
  extensions, product and model names, anything in backticks.
- Sentence case for labels (`Cài đặt`, not `Cài Đặt`); no trailing period on buttons, labels, menu
  items, and titles.
- Use the glossary from `GUIDE.md` consistently. If a better term exists, propose it in the change
  description — do not introduce a one-off variant in a single file.
- Preserve Markdown structure in long help texts: `###` headings, `>` quotes, `-` lists, blank lines.

## Adding a namespace

Namespaces come from the upstream dictionary extraction, not from this repository. When DSH ships a
new namespace:

```bash
node tools/extract-dicts.mjs      # re-read locale data from the installed DSH build
node tools/prepare-dataset.mjs    # rebuild extract/en/*.json + extract/manifest.json
```

Then create `vi-packs/<file>.json` with the same keys in the same order, translate, and run the full
check:

```bash
node tools/validate-vi.mjs
node tools/build-client.mjs
node tools/test-client.mjs
```

If the namespace or key count changed, update the numbers quoted in `README.md` and
`plugin/README.md` in the same change.

## Tooling changes

`tools/` is plain ESM with no dependencies. Keep it that way unless a dependency is clearly
justified and discussed first.

- `extract-dicts.mjs` — parse locale dictionaries out of the installed DSH client bundles.
- `extract-meta.mjs` — read package titles/descriptions from the same `app.asar` into `extract/meta.json`
  (it also reads the official on-demand catalog, whose bundles are not installed yet but do appear in
  the Plugin Manager).
- `extract-host-text.mjs` — read the approval prompts the Host localizes into `extract/host-text.json`.
- `prepare-dataset.mjs` — split `dicts-v2.json` into per-namespace English sources plus the manifest.
- `build-client.mjs` — generate `plugin/client.js` from `vi-packs/` and `vi-meta/`.
- `validate-vi.mjs` — strict structural validation of the dictionaries.
- `validate-meta.mjs` — strict coverage validation of the package titles/descriptions.
- `audit-vi.mjs` — advisory quality audit.
- `test-client.mjs` — load the generated bundle in `node:vm` against a stub locale service.

`tools/lib/` holds what more than one script needs, so nothing is copy-pasted between them:
`repo.mjs` (repository root, JSON I/O, the manifest), `text.mjs` (placeholder helpers, the CJK
ranges), `meta.mjs` (`vi-meta` part files, `extract/meta.json`, `extract/host-text.json`), `bundle-text.mjs` (reading
language maps out of minified bundles), and `asar.mjs` (installed-build
detection, the `app.asar` reader). If two scripts start repeating a block, move it there. See
`tools/lib/README.md`.

The scripts resolve the repository root from their own location (through `tools/lib/repo.mjs`), so
they run from any working directory and the checkout can live anywhere. `extract-dicts.mjs` and
`extract-meta.mjs` and `extract-host-text.mjs` are the only tools that read outside the repository: they
auto-detect the default
Windows/macOS DSH install and take `DSH_APP_ASAR` (path to the installed `app.asar`) when DSH lives
elsewhere. Do not commit machine-specific paths.

## Documentation

Documentation follows a fixed split: user-facing `README.md` is Vietnamese; `AGENTS.md`,
`CONTRIBUTING.md`, `GUIDE.md`, and `plugin/README.md` are English. When you change behavior, counts,
paths, or commands, update the affected prose in the same change.

## Sending a change

- Keep the change focused: one namespace family or one concern per change. Avoid reformatting
  untouched files, since that obscures the actual translation diff.
- In the description, name the namespaces touched and paste the tail of the validator output
  (`OK` or the remaining warnings).
- Call out anything you had to interpret: ambiguous English source, a string that must stay English,
  or a term you would like to change repo-wide.
- Never edit `plugin/client.js` by hand. If the diff contains hand edits to it, regenerate the file
  instead.

### Review checklist

- [ ] `node tools/validate-vi.mjs` reports `OK`.
- [ ] `node tools/validate-meta.mjs` reports `OK` when package text changed.
- [ ] `node tools/build-client.mjs` and `node tools/test-client.mjs` succeed.
- [ ] No new findings from `node tools/audit-vi.mjs`.
- [ ] Glossary terms match `GUIDE.md`; no new terminology variants.
- [ ] Placeholders, Markdown markers, line breaks, and key order unchanged.
- [ ] Quoted counts and commands in the docs still match the repository.

## Respectful collaboration

Assume good intent, critique the wording rather than the author, and keep discussions on the content
of the pack. Vietnamese has regional variation; pick the neutral phrasing the glossary prescribes,
and if a better neutral option exists, raise it as a proposal instead of unilaterally switching a
term.

## License

The project is MIT licensed (see [`LICENSE`](LICENSE)). By contributing you agree that your
contribution is released under the same license, and that the copyright notice is retained.
