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
| `package.json` | Bundle manifest (`dsh.bundle.patch`, `dsh.client`) |
| `cordis.patch.yml` | Loader patch inserting the `locale-vi` entry |
| `index.js` | Host half (no-op) |
| `client.js` | Generated browser bundle: every Vietnamese dictionary plus the package-text overlay |
| `locale/en.json`, `locale/vi.json` | Display title/description used by the plugin list |
| `icon.svg` | Original icon artwork |

## Regenerating

`client.js` is generated from the translation sources; do not hand-edit it.

```
node tools/validate-meta.mjs       # package title/description coverage in vi-meta/packages-*.json
node tools/validate-vi.mjs         # validates key parity, placeholders, CJK, formatting
node tools/build-client.mjs        # reads vi-packs/*.json and vi-meta/*.json, writes plugin/client.js
node tools/test-client.mjs         # stubs the Client locale service and exercises the bundle
```

Translation rules and the glossary live in `GUIDE.md`.
