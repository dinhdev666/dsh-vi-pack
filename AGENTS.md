# AGENTS.md

Working notes for coding agents (and humans) changing this repository. Read this file before editing
anything, then read [`GUIDE.md`](GUIDE.md) for translation rules.

## What this repository is

A Vietnamese (`vi`) locale pack for the **DeepSeek Harness (DSH)** Web GUI. The repository holds
five different kinds of files, and each has a different edit policy:

1. **`extract/` — generated, read-only.** Locale dictionaries pulled out of an installed DSH build
   (`app.asar`) plus derived artifacts (`manifest.json`, `dicts-v2.json`, `summary-v2.txt`,
   `extract/en/*.json`, `meta.json`, `host-text.json`). Never hand-edit; regenerate with the scripts
   in `tools/`.
   The `extract/reference/` subfolder is different: it holds read-only dumps of the upstream client
   bundles for maintainers (see its own `README.md`). No script generates or reads it.
2. **`vi-packs/` — hand-written translation output.** One JSON file per namespace, mirroring
   `extract/en/<ns>.json` key for key. This is where namespace translation work happens.
3. **`vi-meta/` — hand-written overlay text.** `packages-*.json` maps an installed package's name
   to its Vietnamese `title` and `description`, mirroring `extract/meta.json` (the English source
   snapshot); `host-text.json` maps the English wording of Host copy — approval prompts, refusals —
   to its Vietnamese wording, mirroring `extract/host-text.json`. A locale namespace cannot carry
   either family: package titles, descriptions and approval reasons are Host data built from the
   packages' own locale files, so the bundle ships the translations and resolves them through the
   documented `locale.resolveText` entry point.
4. **`plugin/` — the shippable DSH bundle.** `client.js` is **generated** from `vi-packs/` and
   `vi-meta/` by `tools/build-client.mjs`; the rest (`package.json`, `cordis.patch.yml`, `index.js`,
   `locale/*.json`, `icon.svg`) is hand-maintained but rarely changes.
5. **`package.json` (repository root) — the install face of a plain Git URL.** A Git install packages
   the repository root, so this manifest declares `dsh.bundle` (pointing at
   `plugin/cordis.patch.yml`) and re-exports the bundle files under `plugin/`. `plugin/package.json`
   remains the install face of the subdirectory spec
   (`<repository-url>#path:/plugin`), which downloads this folder alone;
   `node tools/validate-manifest.mjs` keeps the two in sync.

Current baseline: **63 namespaces, 2,901 keys**, plus **218 package titles and 31 descriptions**
(216 and 31 distinct English strings — two pairs of packages share one English title, and the
overlay keys translations by that English string) and **3 Host reason texts**. Treat any deviation
from these numbers as a signal to investigate, not to "fix" by editing counts in prose.

## Documentation language policy

This is a settled decision — do not ask again.

| File | Language |
|---|---|
| `README.md` | **Vietnamese** |
| `AGENTS.md` | English |
| `CONTRIBUTING.md` | English |
| `GUIDE.md` | English (the glossary table stays bilingual by design) |
| `plugin/README.md` | English |
| Code comments, commit messages, task notes | English |
| User-facing UI copy in `vi-packs/` | Vietnamese |

When you add a new top-level document, follow the same split: user-facing overview in Vietnamese,
maintainer-facing material in English. Do not rewrite existing documents into the other language
unless explicitly asked.

## Golden rules

- **Never hand-edit `plugin/client.js`.** It is generated. Edit `vi-packs/*.json`,
  `vi-meta/packages-*.json` or `vi-meta/host-text.json`, then run `node tools/build-client.mjs`.
- **Two manifests, one bundle.** The repository-root `package.json` and `plugin/package.json` describe
  the same package: keep their name, version, description, and `dsh.client` identical, and the root
  one pointing into `plugin/`. Each manifest needs a module entry at its own root (`main`, or an
  `index.js` beside the manifest): the Loader resolves the bundle module the CommonJS way, so a
  manifest with only `exports` installs and then fails to activate. `node tools/validate-manifest.mjs`
  checks exactly that.
- **Never edit `extract/`.** It is a snapshot of the upstream DSH locale data. If it looks wrong,
  re-run the extraction scripts.
- **Same keys, same order, same placeholders.** No added, removed, renamed, or reordered keys;
  `{name}`, `{count}`, `{{x}}` keep identical spelling and braces; no CJK characters; `…` stays `…`.
- **`vi-meta/` keys are package names, not UI keys.** Keep `extract/meta.json` order inside each
  part file, never rename a package, and give two packages that share an English title the same
  Vietnamese wording — the browser overlay looks translations up by the English string.
- **`vi-meta/host-text.json` keys are English templates.** One key per Host string, `{name}`
  placeholders unchanged; a key that no longer exists upstream is stale and the validator rejects
  it.
- **Keep technical tokens verbatim** and follow the glossary in `GUIDE.md`. Terminology is settled
  repo-wide: change a term only by sweeping every pack, not one file.
- **JSON hygiene:** UTF-8, 2-space indentation, exactly one trailing newline, no trailing spaces.
- **No tooling churn.** Do not reformat unrelated packs, do not add dependencies, do not rename
  scripts or restructure `tools/` as a side effect of another task. Shared code that two scripts
  need belongs in `tools/lib/`, not copied into each of them.

## Commands

Run these from the repository root. Each script resolves the repository root from its own location,
so an absolute script path also works from any working directory. The shared helpers the scripts
build on live in `tools/lib/` (see `tools/lib/README.md`).

```bash
node tools/validate-vi.mjs                    # strict check: parity, placeholders, CJK, whitespace
node tools/validate-vi.mjs <ns> [...]         # scope to specific namespaces
node tools/validate-meta.mjs                  # strict check: package titles/descriptions coverage
node tools/validate-meta.mjs --partial        # same checks, missing entries reported, not failed
node tools/validate-manifest.mjs              # strict check: the two bundle manifests describe one bundle
node tools/audit-vi.mjs                       # soft check: leftover English, glossary drift, spacing
node tools/build-client.mjs                   # regenerate plugin/client.js from vi-packs/ + vi-meta/
node tools/test-client.mjs                    # smoke-test the bundle against a stubbed locale service
node tools/extract-dicts.mjs                  # re-extract locales from the installed DSH build
node tools/extract-meta.mjs                   # re-extract package titles/descriptions into extract/meta.json
node tools/extract-host-text.mjs              # re-extract Host reason texts into extract/host-text.json
node tools/prepare-dataset.mjs                # rebuild extract/en/*.json + manifest.json
```

`extract-dicts.mjs` reads JSON straight out of `app.asar`, and `extract-meta.mjs` and
`extract-host-text.mjs` read the same archive with a plain-`node` reader, so all three need the
installed build: they find the default Windows/macOS install themselves; set `DSH_APP_ASAR` to the
installed `app.asar` when DSH lives somewhere else. The dictionary script must run under an
asar-aware runtime (the Electron-as-node interpreter shipped with the DSH runtime); the metadata
and Host-text scripts run under plain `node`.

## Working recipes

**Change or fix a translation.** Edit the value in `vi-packs/<ns>.json` only, keeping position and
placeholders intact → `node tools/validate-vi.mjs <ns>` → `node tools/audit-vi.mjs <ns>` →
`node tools/build-client.mjs` → `node tools/test-client.mjs`.

**Translate new or changed upstream strings.** Run `extract-dicts.mjs` then `prepare-dataset.mjs`,
diff `extract/en/` against the previous state, add the missing keys in the same order as the source,
translate, then validate → build → test. Update the key/namespace counts quoted in `README.md` and
`plugin/README.md` if the baseline moved.

**Translate a package title or description.** Re-run `node tools/extract-meta.mjs`, diff
`extract/meta.json` against the previous state, add the missing package names to a
`vi-meta/packages-*.json` part file (keep the part files' ordering and the shared-English-title
rule), translate `title` and `description`, then `node tools/validate-meta.mjs` → build → test.
The overlay reaches the Plugin Manager, the built-in plugin inventory and anywhere else that renders
`locale.resolveText` output; a brand-new package still needs a DSH restart before its row appears.

**Translate Host copy (approval reasons).** Re-run `node tools/extract-host-text.mjs`, diff
`extract/host-text.json` against the previous state, add the missing English wording to
`vi-meta/host-text.json`, translate it, keep the `{name}` placeholders, then
`node tools/validate-meta.mjs` → build → test. The overlay matches the English wording first
exactly, then as a template, so a Host prompt that interpolates values keeps them.

**Touch the plugin manifest.** `package.json` (repository root), `plugin/package.json`, and
`plugin/cordis.patch.yml` define how DSH loads the bundle (`dsh.bundle.patch` inserts the `dsh-vi-pack`
entry; `dsh.client` declares the web bundle and its `locale` dependency). Changing them changes
install behavior — verify by installing the bundle into a DSH profile and reloading the GUI. A
manifest without a module entry (`main`, or `index.js` at its root) installs but fails to activate:
`failed to import: ... /index.js`.

## Definition of done

A change is complete only when all of the following hold:

1. `node tools/validate-vi.mjs` prints `OK` (zero errors).
2. `node tools/validate-meta.mjs` prints `OK` (every shipped package title/description and every
   Host reason template covered).
3. `node tools/validate-manifest.mjs` prints `OK` (both bundle manifests describe one bundle).
4. `node tools/build-client.mjs` succeeds; `plugin/client.js` matches the current `vi-packs/` and
   `vi-meta/`.
5. `node tools/test-client.mjs` prints `OK`.
6. `node tools/audit-vi.mjs` raises no *new* findings versus the previous state; fix what your change
   introduced, leave pre-existing findings alone unless asked.
7. Any prose that quotes counts, paths, or commands still matches reality.

## Pitfalls

- **Keep paths portable.** Every script in `tools/` resolves the repository root through
  `tools/lib/repo.mjs` (from its own file location), so the checkout can live anywhere and the tools
  run from any working directory; do not reintroduce hard-coded roots. The one external path is the
  installed DSH build read by `extract-dicts.mjs`: `tools/lib/asar.mjs` auto-detects the default
  Windows/macOS install and accepts `DSH_APP_ASAR` (path to the installed `app.asar`) otherwise.
- **`node_modules` is absent** and the project has no dependencies; the tools use only `node:`
  builtins. Keep it that way unless the user approves an extra dependency. `tools/lib/asar.mjs`
  carries its own small `app.asar` reader for exactly that reason.
- **Package and Host text is matched by its English wording, not by package name or key.**
  `build-client.mjs` turns both `vi-meta/` families into English → Vietnamese maps, so an upstream
  wording change silently disables the translation until `extract-meta.mjs` (or
  `extract-host-text.mjs`) is re-run and the entry updated. `validate-meta.mjs` is what catches it;
  never key the maps by anything else.
- **Do not "improve" short labels for length.** The validator warns on long translations; a
  natural shorter wording beats a literal one, but meaning must not drift.
- **Warnings are not errors** (key order, line counts, Markdown markers, length). Read them, fix the
  ones your change caused, and do not silence them by editing the validators.
- **Do not reintroduce duplicated helpers.** A script that needs the repo root, JSON I/O, placeholder
  parsing, `vi-meta` discovery, or `app.asar` access imports it from `tools/lib/`; copying the block
  into a second script is what this layout exists to prevent.

## License

MIT — see [`LICENSE`](LICENSE). Copyright (c) 2026 Phạm Văn Định. Contributions are accepted under
the same terms.
