// Validate vi-meta/*.json (Host-provided display text) against extract/meta.json and
// extract/host-text.json.
//
// Strict shape: every shipped package's title is translated, every English description is
// translated, and every Host reason template carries a Vietnamese counterpart with the same
// placeholders. `--partial` reports the coverage without failing, so a batch can check its own file
// while the other batches are still being written.
import { listMetaParts, loadHostTextSource, loadMetaSource, readHostTextPart, readMetaPart } from './lib/meta.mjs'
import { CJK_META } from './lib/text.mjs'

const PARTIAL = process.argv.includes('--partial')

const problems = []
const warnings = []
const problem = (message) => problems.push(message)
const warn = (message) => warnings.push(message)

const source = loadMetaSource()
const packages = source.packages ?? []
const byName = new Map(packages.map((pkg) => [pkg.name, pkg]))

const parts = listMetaParts()
if (parts.length === 0) problem('no vi-meta/packages-*.json translation files found')

const ALLOWED_UNTRANSLATED_TITLES = new Set(['DSH', 'OK'])
const translations = new Map()

for (const file of parts) {
  let data
  try {
    data = readMetaPart(file)
  } catch (e) {
    problem(`${file}: invalid JSON: ${e.message}`)
    continue
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    problem(`${file}: top level must be an object keyed by package name`)
    continue
  }
  for (const [name, entry] of Object.entries(data)) {
    if (translations.has(name)) {
      problem(`${name}: translated more than once (also in ${translations.get(name).file})`)
      continue
    }
    const pkg = byName.get(name)
    if (!pkg) {
      problem(`${file}: ${name} is not in extract/meta.json (stale translation or wrong name)`)
      continue
    }
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      problem(`${name}: entry must be an object`)
      continue
    }
    for (const key of Object.keys(entry)) {
      if (key !== 'title' && key !== 'description') problem(`${name}: unknown field ${key}`)
    }
    translations.set(name, { file, entry, pkg })
    if (typeof entry.title !== 'string' || entry.title.trim() === '') {
      if (pkg.title && !PARTIAL) problem(`${name}: missing title`)
    } else {
      checkText(name, 'title', entry.title)
      if (entry.title === pkg.title.en && !ALLOWED_UNTRANSLATED_TITLES.has(entry.title)) {
        warn(`${name}: title is still the English text ${JSON.stringify(entry.title)}`)
      }
      if (entry.title.length > 60) warn(`${name}: long title (${entry.title.length} chars)`)
    }
    if (entry.description !== undefined) {
      if (typeof entry.description !== 'string' || entry.description.trim() === '') {
        if (!PARTIAL) problem(`${name}: description must be a non-empty string`)
      } else {
        checkText(name, 'description', entry.description)
        if (entry.description.length > 240) warn(`${name}: long description (${entry.description.length} chars)`)
      }
    } else if (pkg.description && !PARTIAL) {
      problem(`${name}: missing description`)
    }
  }
}

function checkText(name, field, value) {
  const where = `${name}: ${field}`
  if (value !== value.trim()) problem(`${where}: leading or trailing whitespace`)
  if (/\s{2,}/.test(value)) problem(`${where}: repeated whitespace`)
  if (CJK_META.test(value)) problem(`${where}: contains CJK characters`)
  if (/[{}]/.test(value)) problem(`${where}: must not contain placeholders`)
  if (/[A-Za-z]\.[A-Za-z]/.test(value)) warn(`${where}: possible English abbreviation`)
}

const missing = packages.filter((pkg) => pkg.title && !translations.get(pkg.name)?.entry.title)
const missingDescriptions = packages.filter(
  (pkg) => pkg.description && !translations.get(pkg.name)?.entry.description,
)
if (!PARTIAL) {
  for (const pkg of missing) problem(`${pkg.name}: no title translation`)
  for (const pkg of missingDescriptions) problem(`${pkg.name}: no description translation`)
}

// The browser overlay keys Vietnamese text by the English original, so two packages that share
// one English string must share its translation too.
function checkSharedText(role) {
  const byEnglish = new Map()
  for (const { entry, pkg } of translations.values()) {
    const en = pkg[role]?.en
    const vi = entry[role]
    if (typeof en !== 'string' || typeof vi !== 'string') continue
    const known = byEnglish.get(en)
    if (known === undefined) byEnglish.set(en, vi)
    else if (known !== vi) {
      problem(
        `${role} ${JSON.stringify(en)} has two translations (${JSON.stringify(known)} / ${JSON.stringify(vi)}); ` +
          'give both packages the same wording',
      )
    }
  }
}
checkSharedText('title')
checkSharedText('description')

// Host copy that reaches the GUI as a reason (approval prompts) is keyed by the English template,
// so a source template without a translation is a gap and a translation without a source template
// is stale.
const hostSource = loadHostTextSource().entries ?? []
const hostPart = readHostTextPart()
const hostMissing = []
const placeholderNames = (text) =>
  [...text.matchAll(/\{([A-Za-z_$][\w$]*)\}/g)].map((match) => match[1]).sort()

for (const entry of hostSource) {
  if (entry.computable) {
    warn(`${entry.pkg}: ${JSON.stringify(entry.template)} has a computed interpolation and cannot be translated`)
    continue
  }
  const vi = hostPart[entry.template]
  if (typeof vi !== 'string' || vi.trim() === '') {
    hostMissing.push(entry.template)
    if (!PARTIAL) problem(`host text: no Vietnamese translation for ${JSON.stringify(entry.template)}`)
    continue
  }
  const where = `host text ${JSON.stringify(entry.template)}`
  if (vi !== vi.trim()) problem(`${where}: leading or trailing whitespace`)
  if (/\s{2,}/.test(vi)) problem(`${where}: repeated whitespace`)
  if (CJK_META.test(vi)) problem(`${where}: contains CJK characters`)
  const expected = placeholderNames(entry.template)
  const actual = placeholderNames(vi)
  if (expected.join('\u0000') !== actual.join('\u0000')) {
    problem(`${where}: placeholders differ (${expected.join(', ') || 'none'} vs ${actual.join(', ') || 'none'})`)
  }
}
for (const key of Object.keys(hostPart)) {
  if (!hostSource.some((entry) => entry.template === key)) {
    problem(`host text: ${JSON.stringify(key)} is not in extract/host-text.json (stale translation)`)
  }
}

for (const warning of warnings) console.warn('warn  ' + warning)
if (problems.length) {
  console.error(`validate-meta: ${problems.length} problem(s)`)
  for (const message of problems.slice(0, 80)) console.error('  ' + message)
  process.exit(1)
}
const titleCount = packages.filter((pkg) => pkg.title && translations.get(pkg.name)?.entry.title).length
const descriptionCount = packages.filter(
  (pkg) => pkg.description && translations.get(pkg.name)?.entry.description,
).length
const covered = translations.size
console.log(
  `validate-meta: OK (${covered}/${packages.length} packages, ${titleCount} titles, ` +
    `${descriptionCount} descriptions, ${hostSource.length - hostMissing.length}/${hostSource.length} host texts` +
    `${warnings.length ? `, ${warnings.length} warning(s)` : ''})`,
)
if (PARTIAL) {
  console.log(
    `partial: ${missing.length} title(s), ${missingDescriptions.length} description(s) and ` +
      `${hostMissing.length} host text(s) still pending`,
  )
}
