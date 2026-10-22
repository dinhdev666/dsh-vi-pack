// Generate the browser bundle at plugin/client.js from vi-packs/*.json and vi-meta/*.json.
// Fails unless every manifest namespace has a translation with matching keys and placeholders,
// and unless every shipped package title/description has a Vietnamese translation.
import fs from 'node:fs'
import { BUNDLE_DIR } from './lib/bundle.mjs'
import { listMetaParts, loadHostTextSource, loadMetaSource, readHostTextPart, readMetaPart } from './lib/meta.mjs'
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

// Host copy that reaches the GUI as an approval reason: the browser overlay resolves it by the
// English original, so a shipped reason without a translation is a build failure.
const hostSource = loadHostTextSource().entries ?? []
const hostTranslations = readHostTextPart()
const hostText = {}
for (const entry of hostSource) {
  if (entry.computable) continue
  const translation = hostTranslations[entry.template]
  if (typeof translation !== 'string' || translation.trim() === '') {
    problems.push(`host text: no Vietnamese translation for ${JSON.stringify(entry.template)}`)
    continue
  }
  hostText[entry.template] = translation
}
for (const key of Object.keys(hostTranslations)) {
  if (!hostSource.some((entry) => entry.template === key)) {
    problems.push(`host text: ${JSON.stringify(key)} is not in extract/host-text.json`)
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

// Browser-side matcher for Host copy. Kept as a raw string so the emitted code keeps its regular
// expressions and placeholder tokens exactly as written; no template interpolation happens here.
const HOST_TEXT_CODE = String.raw`    /**
     * Build the matcher for one Host text template.
     *
     * The English original decides where a placeholder sits; the Vietnamese text may reorder them,
     * so the pattern only captures the values and the translation re-inserts them.
     */
    function hostTextPattern(template) {
      const token = /\{[A-Za-z_$][\w$]*\}/;
      let source = '^';
      let rest = template;
      for (;;) {
        const at = rest.search(token);
        if (at < 0) {
          source += escapeHostText(rest);
          break;
        }
        source += escapeHostText(rest.slice(0, at));
        const name = rest.slice(at).match(token)[0].slice(1, -1);
        const after = rest.slice(at + name.length + 2);
        source += after.length ? '(?<' + name + '>.*?)' : '(?<' + name + '>.*)';
        rest = after;
      }
      return new RegExp(source + '$', 's');
    }
    /** Escape the literal parts of a template so they match verbatim. */
    function escapeHostText(text) {
      return text.replace(/[.*+?^$(){}|[\]\\]/g, '\\$&');
    }
    /** Host templates, matched after the exact wording misses. */
    const HOST_TEXT_TEMPLATES = Object.entries(HOST_TEXT)
      .filter(([source]) => /\{[A-Za-z_$][\w$]*\}/.test(source))
      .map(([source, text]) => ({ pattern: hostTextPattern(source), text }));
    /**
     * Translate Host copy that reaches the GUI through locale.resolveText.
     *
     * Such copy is a Host-built language map with no \`vi\` key, so the overlay supplies the
     * Vietnamese wording instead of a dictionary.
     *
     * @param text - the Host language map
     * @returns the Vietnamese wording, or undefined when the pack does not cover it
     */
    function localizeHostText(text) {
      const english = text.en;
      if (Object.hasOwn(HOST_TEXT, english)) return HOST_TEXT[english];
      for (const template of HOST_TEXT_TEMPLATES) {
        const match = template.pattern.exec(english);
        if (!match) continue;
        return template.text.replace(/\{([A-Za-z_$][\w$]*)\}/g, (whole, name) => match.groups?.[name] ?? whole);
      }
      return undefined;
    }
`

const metaBody = (object) => {
  const lines = Object.keys(object).map(
    (key) => `      ${JSON.stringify(key)}: ${JSON.stringify(object[key])}`,
  )
  return lines.join(',\n')
}

const source = `window.__ModuleLoader__.load({
  id: '@dinhdev666/dsh-vi-pack',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    /** Vietnamese language-pack definition; English is the fallback for missing keys. */
    const LANGUAGE = Object.freeze({ id: 'vi', label: 'Tiếng Việt', fallback: 'en' });
    /** Vietnamese dictionaries, one object per locale namespace. */
    const DICTIONARIES = {
${body}
    };
    /** Vietnamese Host copy keyed by the English original, for approval prompts the GUI shows. */
    const HOST_TEXT = {
${metaBody(hostText)}
    };
${HOST_TEXT_CODE}    /** Vietnamese package titles keyed by the English original, for installed-plugin lists. */
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
        const host = localizeHostText(text);
        if (host !== undefined) return host;
        return resolve(text);
      };
      return () => {
        locale.resolveText = original;
      };
    }
    function apply(ctx) {
      ctx.effect(() => ctx.locale.addLanguage(LANGUAGE), 'dsh-vi-pack: language');
      for (const ns of Object.keys(DICTIONARIES)) {
        ctx.effect(() => ctx.locale.register(ns, LANGUAGE.id, DICTIONARIES[ns]), 'dsh-vi-pack: ' + ns);
      }
      ctx.effect(() => localizePackageText(ctx), 'dsh-vi-pack: package text');
    }
    exports.LANGUAGE = LANGUAGE;
    exports.DICTIONARIES = DICTIONARIES;
    exports.META_TITLES = META_TITLES;
    exports.META_DESCRIPTIONS = META_DESCRIPTIONS;
    exports.HOST_TEXT = HOST_TEXT;
    exports.inject = ['locale'];
    exports.apply = apply;
    return module.exports;
  },
});
`

fs.writeFileSync(repoPath(BUNDLE_DIR, 'client.js'), source, 'utf8')
console.log(
  `build-client: ${sections.length} namespaces, ${keyTotal} keys, ` +
    `${Object.keys(metaTitles).length} package titles, ${Object.keys(metaDescriptions).length} descriptions, ` +
    `${Object.keys(hostText).length} host texts, ` +
    `${(Buffer.byteLength(source) / 1024).toFixed(1)} KiB`,
)
