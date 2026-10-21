# tools/lib — shared helpers

Small ESM modules used by every script in `tools/`. They exist so that one piece of logic lives in
exactly one place: a block that two scripts would otherwise repeat belongs here, not copy-pasted a
second time. Only `node:` builtins are used — the project has no dependencies.

| Module | Exports | Used for |
|---|---|---|
| `repo.mjs` | `BASE`, `repoPath()`, `readJson()`, `writeJson()`, `loadManifest()` | Repository root resolution, JSON I/O with the repo's hygiene rules (2-space indent, one trailing newline), and the namespace manifest. |
| `text.mjs` | `placeholders()`, `placeholderKey()`, `stripPlaceholders()`, `CJK_VI`, `CJK_META` | Placeholder extraction (`{name}`, `{{x}}`) shared by the validators, the builder, and the dataset step. The two CJK constants differ **on purpose** (`validate-vi` starts at U+3000, `validate-meta` also rejects CJK radicals from U+2E80); do not unify them. |
| `meta.mjs` | `loadMetaSource()`, `listMetaParts()`, `readMetaPart()` | The package display-text sources: `extract/meta.json` and the sorted `vi-meta/packages-*.json` part files. |
| `bundle.mjs` | `BUNDLE_DIR`, `ROOT_MANIFEST`, `BUNDLE_MANIFEST`, `readRootManifest()`, `readBundleManifest()` | The shippable bundle folder and its two manifests: the repository-root `package.json` (a plain Git URL packages it) and `plugin/package.json` (the `<url>#path:/plugin` subdirectory spec packages it). |
| `asar.mjs` | `resolveAppAsar()`, `openAsarArchive()` | Locating the installed DSH build (`DSH_APP_ASAR`, then the default Windows/macOS paths) and reading files out of its `app.asar` with a plain-`node` reader. |

Conventions:

- Nothing here runs at import time — the extraction scripts may be imported under the
  Electron-as-node runtime with no side effects, and `resolveAppAsar()` only probes the filesystem
  when it is called.
- Every module resolves paths from its own location, so the checkout can live anywhere and the tools
  run from any working directory.
- Error messages and exit codes stay in the scripts that own a command; the helpers never print.
