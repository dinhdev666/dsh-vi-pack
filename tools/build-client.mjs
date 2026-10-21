// Generate plugin/client.js (the browser bundle) from vi-packs/*.json and vi-meta/*.json.
// Fails unless every manifest namespace has a translation with matching keys and placeholders,
// and unless every shipped package title/description has a Vietnamese translation.
import fs from 'node:fs'
import { listMetaParts, loadMetaSource, readMetaPart } from './lib/meta.mjs'
import { loadManifest, readJson, repoPath } from './lib/repo.mjs'
import { placeholderKey } from './lib/text.mjs'

const manifest = loadManifest()
const metaSource = loadMetaSource()

const problems = []
const sections = []
let keyTotal = 0
const partial = process.argv.includes('--allow-missing')

for (const entry of manifest) {
  const en = readJson(repoPath('extract/en', entry.file))
  const viPath = repoPath('vi-packs', entry.file)
  if (!fs.existsSync(viPath)) {
    problems.push(`missing vi-packs/${entry.file}${partial ? ' (skipped)' : ''}`)
    continue
  }
  let vi
  try {
    vi = readJson(viPath)
  } catch (e) {
    problems.push(`invalid JSON in vi-packs/${entry.file}: ${e.message}`)
    continue
  }
  const enKeys = Object.keys(en)
  for (const key of enKeys) {
    if (!(key in vi)) {
      problems.push(`${entry.ns}: missing key ${key}`)
      continue
    }
    if (typeof vi[key] !== 'string' || (vi[key].trim() === '' && en[key].trim() !== '')) {
      problems.push(`${entry.ns}/${key}: empty or non-string value`)
      continue
    }
    if (placeholderKey(en[key]) !== placeholderKey(vi[key])) {
      problems.push(`${entry.ns}/${key}: placeholder mismatch`)
    }
  }
  for (const key of Object.keys(vi)) {
    if (!(key in en)) problems.push(`${entry.ns}: extra key ${key}`)
  }
  const dict = {}
  for (const key of enKeys) if (key in vi) dict[key] = vi[key]
  keyTotal += Object.keys(dict).length
  sections.push({ ns: entry.ns, dict })
}

if (partial && problems.length) console.warn(`build-client: partial build — ${problems.length} namespace(s) missing`)

// Package display text: the browser overlay resolves it by the English original, so a shipped
// package title or description without a translation is a build failure.
const metaFiles = listMetaParts()
const metaTranslations = new Map()
for (const file of metaFiles) {
  let data
  try {
    data = readMetaPart(file)
  } catch (e) {
    problems.push(`invalid JSON in vi-meta/${file}: ${e.message}`)
    continue
  }
  for (const [name, entry] of Object.entries(data)) {
    if (metaTranslations.has(name)) problems.push(`vi-meta: ${name} translated twice (again in ${file})`)
    else metaTranslations.set(name, entry)
  }
}
const metaTitles = {}
const metaDescriptions = {}
for (const pkg of metaSource.packages ?? []) {
  const translation = metaTranslations.get(pkg.name) ?? {}
  if (pkg.title) {
    if (typeof translation.title !== 'string' || translation.title.trim() === '') {
      problems.push(`${pkg.name}: no Vietnamese title in vi-meta/`)
    } else if (metaTitles[pkg.title.en] !== undefined && metaTitles[pkg.title.en] !== translation.title) {
      problems.push(`${pkg.name}: title ${JSON.stringify(pkg.title.en)} has two translations`)
    } else {
      metaTitles[pkg.title.en] = translation.title
    }
  }
  if (pkg.description) {
    if (typeof translation.description !== 'string' || translation.description.trim() === '') {
      problems.push(`${pkg.name}: no Vietnamese description in vi-meta/`)
    } else if (
      metaDescriptions[pkg.description.en] !== undefined &&
      metaDescriptions[pkg.description.en] !== translation.description
    ) {
      problems.push(`${pkg.name}: description shares text with another package but not its translation`)
    } else {
      metaDescriptions[pkg.description.en] = translation.description
    }
  }
}

const allProblems = partial ? problems.filter((p) => !p.startsWith('missing ')) : problems
if (allProblems.length) {
  console.error(`build-client: ${allProblems.length} problem(s)`)
  for (const p of allProblems.slice(0, 60)) console.error('  ' + p)
  process.exit(1)
}

const body = sections
  .map(({ ns, dict }) => {
    const lines = Object.keys(dict).map((key) => `        ${JSON.stringify(key)}: ${JSON.stringify(dict[key])}`)
    return `      // ${ns} (${Object.keys(dict).length} keys)\n      ${JSON.stringify(ns)}: {\n${lines.join(',\n')}\n      }`
  })
  .join(',\n')

const metaBody = (object) => {
  const lines = Object.keys(object).map(
    (key) => `      ${JSON.stringify(key)}: ${JSON.stringify(object[key])}`,
  )
  return lines.join(',\n')
}

const source = `window.__ModuleLoader__.load({
  id: '@local/dsh-locale-vi',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    /** Vietnamese language-pack definition; English is the fallback for missing keys. */
    const LANGUAGE = Object.freeze({ id: 'vi', label: 'Tiếng Việt', fallback: 'en' });
    /** Vietnamese dictionaries, one object per locale namespace. */
    const DICTIONARIES = {
${body}
    };
    /** Vietnamese package titles keyed by the English original, for installed-plugin lists. */
    const META_TITLES = {
${metaBody(metaTitles)}
    };
    /** Vietnamese package descriptions keyed by the English original. */
    const META_DESCRIPTIONS = {
${metaBody(metaDescriptions)}
    };
    /**
     * Supply the missing \`vi\` key for installed-package display text.
     *
     * Package titles and descriptions are Host data built from each package's own locale files,
     * so a language pack cannot reach them through a namespace. The documented entry point for
     * that text is \`locale.resolveText\`; this wrapper extends it while the pack is loaded and
     * restores it on dispose. Maps that already carry \`vi\`, and every other language, pass through.
     */
    function localizePackageText(ctx) {
      const locale = ctx.locale;
      const original = locale.resolveText;
      if (typeof original !== 'function' || typeof locale.getLocale !== 'function') return () => {};
      const resolve = (text) => original.call(locale, text);
      locale.resolveText = function (text) {
        if (text === null || typeof text !== 'object' || typeof text.en !== 'string') return resolve(text);
        if (typeof text.vi === 'string' || locale.getLocale().active !== LANGUAGE.id) return resolve(text);
        if (Object.hasOwn(META_TITLES, text.en)) return META_TITLES[text.en];
        if (Object.hasOwn(META_DESCRIPTIONS, text.en)) return META_DESCRIPTIONS[text.en];
        return resolve(text);
      };
      return () => {
        locale.resolveText = original;
      };
    }
    function apply(ctx) {
      ctx.effect(() => ctx.locale.addLanguage(LANGUAGE), 'locale-vi: language');
      for (const ns of Object.keys(DICTIONARIES)) {
        ctx.effect(() => ctx.locale.register(ns, LANGUAGE.id, DICTIONARIES[ns]), 'locale-vi: ' + ns);
      }
      ctx.effect(() => localizePackageText(ctx), 'locale-vi: package text');
    }
    exports.LANGUAGE = LANGUAGE;
    exports.DICTIONARIES = DICTIONARIES;
    exports.META_TITLES = META_TITLES;
    exports.META_DESCRIPTIONS = META_DESCRIPTIONS;
    exports.inject = ['locale'];
    exports.apply = apply;
    return module.exports;
  },
});
`

fs.writeFileSync(repoPath('plugin/client.js'), source, 'utf8')
console.log(
  `build-client: ${sections.length} namespaces, ${keyTotal} keys, ` +
    `${Object.keys(metaTitles).length} package titles, ${Object.keys(metaDescriptions).length} descriptions, ` +
    `${(Buffer.byteLength(source) / 1024).toFixed(1)} KiB`,
)
