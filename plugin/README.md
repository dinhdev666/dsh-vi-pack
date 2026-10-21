# Tiếng Việt language pack for DeepSeek Harness

Adds `Tiếng Việt (vi)` to **Settings → General → Language** and translates the Web GUI with a
Vietnamese dictionary for all 63 locale namespaces shipped by the Harness (2,901 keys), plus 216
package titles and 29 package descriptions shown in the plugin lists.

- Client bundle: `client.js` registers `vi` through `ctx.locale.addLanguage`, then registers one
  dictionary per namespace with `ctx.locale.register(ns, 'vi', dict)`, then wraps
  `ctx.locale.resolveText` so installed-package titles and descriptions resolve to Vietnamese while
  `vi` is active. The dictionaries never reach that text: the Host builds it from each package's own
  `locale/en.json`, so the bundle ships the translations and matches them by their English wording.
- Fallback: `en`. Any key or package text the pack does not cover resolves to English, so the UI never
  shows a raw key.
- Host half: `index.js` is intentionally empty; the browser half owns all behavior.

## Layout

| Path | Purpose |
|---|---|
| `package.json` | Bundle manifest (`dsh.bundle.patch`, `dsh.client`); also the install face of a subdirectory spec (`<repository-url>#path:/plugin`) |
| `cordis.patch.yml` | Loader patch inserting the `dsh-vi-pack` entry |
| `index.js` | Host half (no-op) |
| `client.js` | Generated browser bundle: every Vietnamese dictionary plus the package-text overlay |
| `locale/en.json`, `locale/vi.json` | Display title/description used by the plugin list |
| `icon.svg` | Original icon artwork |

## Install

The bundle has two install faces, and DSH reads the one the install target selects:

| Target | Manifest | Notes |
|---|---|---|
| `https://github.com/dinhdev666/dsh-vi-pack` | repository-root `package.json` | Installs the whole repository; the root manifest declares `dsh.bundle` pointing at `plugin/cordis.patch.yml` and exports the files of this folder |
| `https://github.com/dinhdev666/dsh-vi-pack#path:/plugin` | `plugin/package.json` | Installs this folder alone, so the download stays small |

Both manifests describe the same package, so their name, version, description, and `dsh.client` must
stay in sync; `node tools/validate-manifest.mjs` fails when they drift.

Each manifest also needs a module entry at its own root — `main`, or an `index.js` beside the
manifest. The Loader resolves the bundle module the CommonJS way (package root, then `index.js`),
so a root manifest that only declares `exports` installs but fails to activate with
`failed to import: ... /index.js`.

## Regenerating

`client.js` is generated from the translation sources; do not hand-edit it.

```
node tools/validate-meta.mjs       # package title/description coverage in vi-meta/packages-*.json
node tools/validate-vi.mjs         # validates key parity, placeholders, CJK, formatting
node tools/validate-manifest.mjs   # root package.json and plugin/package.json still describe one bundle
node tools/build-client.mjs        # reads vi-packs/*.json and vi-meta/*.json, writes plugin/client.js
node tools/test-client.mjs         # stubs the Client locale service and exercises the bundle
```

Translation rules and the glossary live in `GUIDE.md`.
