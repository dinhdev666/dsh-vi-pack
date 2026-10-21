// Smoke-test the generated plugin/client.js against a stub of the Client locale service.
import fs from 'node:fs'
import vm from 'node:vm'
import { BUNDLE_DIR } from './lib/bundle.mjs'
import { loadManifest, readJson, repoPath } from './lib/repo.mjs'

const source = fs.readFileSync(repoPath(BUNDLE_DIR, 'client.js'), 'utf8')
const manifest = loadManifest()
const expectedKeys = new Map(
  manifest.map((m) => [
    m.ns,
    Object.keys(readJson(repoPath('extract/en', m.file))).length,
  ]),
)

const registered = []
const failed = []
const assert = (condition, message) => {
  if (condition) console.log('  ok  ' + message)
  else {
    failed.push(message)
    console.log('  ERR ' + message)
  }
}

// Minimal Client locale service: language catalog with an English built-in, namespaced dicts, effects.
const catalog = new Map([['en', { id: 'en', label: 'English', fallback: undefined }]])
const dicts = new Map()
const effects = []
let active = 'en'
const locale = {
  getLocale() {
    return { active, locales: [...catalog.values()], revision: 0 }
  },
  resolveText(text) {
    if (typeof text === 'string') return text
    // Same fallback walk as the real service: vi first, then the English original.
    return text[active] ?? text.en
  },
  addLanguage(language) {
    if (!/^[A-Za-z]{2,8}$/.test(language.id)) throw new Error(`bad id ${language.id}`)
    if (typeof language.label !== 'string' || language.label.trim() === '') throw new Error('empty label')
    if (!catalog.has(language.fallback)) throw new Error(`fallback ${language.fallback} not registered`)
    if (catalog.has(language.id)) throw new Error(`duplicate language ${language.id}`)
    catalog.set(language.id, language)
    if (active === 'en') active = language.id
    return () => catalog.delete(language.id)
  },
  register(ns, id, dict) {
    if (!/^[A-Za-z]{2,8}$/.test(id)) throw new Error(`bad locale ${id}`)
    if (!dicts.has(ns)) dicts.set(ns, new Map())
    const byLocale = dicts.get(ns)
    if (byLocale.has(id)) throw new Error(`duplicate ${ns}/${id}`)
    byLocale.set(id, dict)
    registered.push(ns)
    return () => byLocale.delete(id)
  },
}

const ctx = {
  locale,
  effect(fn, label) {
    const dispose = fn()
    effects.push({ label, dispose })
    return dispose
  },
}

let loaded
const sandbox = {
  window: {
    __ModuleLoader__: {
      load(definition) {
        if (loaded) throw new Error('more than one load() call')
        loaded = definition
      },
    },
  },
}
vm.runInNewContext(source, sandbox, { filename: 'client.js' })

console.log('module registration')
assert(loaded !== undefined, 'client.js calls __ModuleLoader__.load once')
assert(loaded.id === '@local/dsh-locale-vi', `bundle id is ${loaded.id}`)
assert(typeof loaded.factory === 'function', 'factory is a function')

const exports = loaded.factory((request) => {
  throw new Error(`unexpected require(${JSON.stringify(request)})`)
})

console.log('module face')
assert(Array.isArray(exports.inject) && exports.inject.includes('locale'), 'inject includes locale')
assert(typeof exports.apply === 'function', 'apply is a function')
assert(exports.LANGUAGE?.id === 'vi', 'language id is vi')
assert(exports.LANGUAGE?.label === 'Tiếng Việt', 'language label is Tiếng Việt')
assert(exports.LANGUAGE?.fallback === 'en', 'language fallback is en')

const built = Object.keys(exports.DICTIONARIES)
const expectedTotal = built.reduce((sum, ns) => sum + Object.keys(exports.DICTIONARIES[ns]).length, 0)

exports.apply(ctx)

console.log('registration effects')
assert(catalog.has('vi'), 'locale service received the vi language')
assert(catalog.get('vi').fallback === 'en', 'vi falls back to en')
assert(active === 'vi', 'vi becomes the active locale in the stub')
assert(registered.length === built.length, `registered ${registered.length}/${built.length} namespaces`)
assert(new Set(registered).size === registered.length, 'no namespace registered twice')
assert(effects.length === built.length + 2, `created ${effects.length} effects`)

console.log('package text')
const metaTitles = exports.META_TITLES
const metaDescriptions = exports.META_DESCRIPTIONS
assert(metaTitles !== null && typeof metaTitles === 'object', 'META_TITLES is an object')
assert(Object.keys(metaTitles).length > 0, `${Object.keys(metaTitles).length} package titles`)
assert(Object.keys(metaDescriptions).length > 0, `${Object.keys(metaDescriptions).length} descriptions`)
assert(
  Object.values(metaTitles).every((value) => typeof value === 'string' && value.trim() !== ''),
  'every title is a non-empty string',
)
const firstTitle = Object.keys(metaTitles)[0]
assert(locale.resolveText({ en: firstTitle, zh: '中文' }) === metaTitles[firstTitle], `title ${firstTitle} resolves to Vietnamese`)
const firstDescription = Object.keys(metaDescriptions)[0]
assert(
  locale.resolveText({ en: firstDescription, zh: '中文' }) === metaDescriptions[firstDescription],
  'description resolves to Vietnamese',
)
assert(locale.resolveText({ en: 'An unknown package title' }) === 'An unknown package title', 'unknown map text passes through')
assert(locale.resolveText('plain string') === 'plain string', 'plain strings stay verbatim')
assert(locale.resolveText({ en: firstTitle, vi: 'Bản dịch sẵn' }) === 'Bản dịch sẵn', 'a shipped vi key wins over the overlay')
active = 'en'
assert(locale.resolveText({ en: firstTitle }) === firstTitle, 'English locale ignores the overlay')
active = 'vi'

let keyTotal = 0
const badNamespaces = []
for (const ns of registered) {
  const dict = dicts.get(ns).get('vi')
  const expected = expectedKeys.get(ns)
  keyTotal += Object.keys(dict).length
  if (expected !== undefined && Object.keys(dict).length !== expected) {
    badNamespaces.push(`${ns}: ${Object.keys(dict).length}/${expected}`)
  }
}
assert(badNamespaces.length === 0, `namespace key counts: ${badNamespaces.join(', ') || 'all match'}`)
assert(keyTotal === expectedTotal, `total keys ${keyTotal}`)
assert(Object.values(exports.DICTIONARIES).every((d) => Object.values(d).every((v) => typeof v === 'string')), 'all values are strings')

console.log('disposal')
for (const effect of effects) effect.dispose()
assert(!catalog.has('vi'), 'language removed after disposal')
assert(locale.resolveText({ en: firstTitle }) === firstTitle, 'package text overlay removed after disposal')
assert(dicts.size === registered.length, 'namespace maps retained, locale entries removed')

console.log(failed.length ? `\nFAIL (${failed.length})` : '\nOK')
process.exit(failed.length ? 1 : 0)
