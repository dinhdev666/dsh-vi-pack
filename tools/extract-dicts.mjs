// Extract zh/en locale dictionaries from installed dsh client bundles.
// Runs under the Electron-as-node interpreter so app.asar paths are readable.
// The DSH install is auto-detected; set DSH_APP_ASAR to the installed app.asar when it lives
// elsewhere (portable install, custom drive, non-standard app bundle).
import fs from 'node:fs'
import path from 'node:path'
import { repoPath } from './lib/repo.mjs'
import { resolveAppAsar } from './lib/asar.mjs'

const OUT = repoPath('extract')
const appAsar = resolveAppAsar()
if (!appAsar || !fs.existsSync(appAsar)) {
  console.error('Could not find the installed DeepSeek Harness app.asar.')
  console.error('Set DSH_APP_ASAR to its path, for example on macOS:')
  console.error(
    '  DSH_APP_ASAR="/Applications/DeepSeek Harness.app/Contents/Resources/app.asar" node tools/extract-dicts.mjs',
  )
  process.exit(1)
}
const ROOT = path.join(appAsar, 'dsh', 'node_modules', '@deepseek-ai')

const report = []

function isIdentStart(c) {
  return /[A-Za-z_$]/.test(c)
}
function isIdentChar(c) {
  return /[A-Za-z0-9_$]/.test(c)
}

class Parser {
  constructor(text, decls, callIndex) {
    this.text = text
    this.decls = decls
    this.callIndex = callIndex
    this.pos = 0
  }
  fail(msg) {
    throw new Error(msg + ' at ' + this.pos)
  }
  skip() {
    const t = this.text
    for (;;) {
      const c = t[this.pos]
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
        this.pos++
        continue
      }
      if (c === '/' && t[this.pos + 1] === '/') {
        const nl = t.indexOf('\n', this.pos)
        this.pos = nl < 0 ? t.length : nl + 1
        continue
      }
      if (c === '/' && t[this.pos + 1] === '*') {
        const end = t.indexOf('*/', this.pos + 2)
        this.pos = end < 0 ? t.length : end + 2
        continue
      }
      return
    }
  }
  /** Parse one expression value starting at this.pos. */
  value() {
    this.skip()
    let left = this.postfix(this.primary())
    this.skip()
    while (this.text[this.pos] === '+') {
      this.pos++
      const right = this.postfix(this.primary())
      if (typeof left !== 'string' || typeof right !== 'string') {
        this.fail('non-string concat')
      }
      left = left + right
      this.skip()
    }
    return left
  }
  /** Apply simple postfix method calls such as `.join(sep)` on a parsed value. */
  postfix(value) {
    const t = this.text
    for (;;) {
      this.skip()
      if (t[this.pos] !== '.') return value
      const m = /^\.([A-Za-z_$][\w$]*)\s*\(/.exec(t.slice(this.pos, this.pos + 80))
      if (!m) return value
      const method = m[1]
      this.pos += m[0].length - 1 // now at '('
      this.pos++
      const args = []
      for (;;) {
        this.skip()
        if (t[this.pos] === ')') {
          this.pos++
          break
        }
        args.push(this.value())
        this.skip()
        if (t[this.pos] === ',') {
          this.pos++
          continue
        }
        if (t[this.pos] === ')') {
          this.pos++
          break
        }
        this.fail('expected , or ) in ' + method)
      }
      if (method === 'join' && Array.isArray(value)) value = value.join(args[0] ?? ',')
      else if (method === 'trim' && typeof value === 'string') value = value.trim()
      else if (method === 'concat' && typeof value === 'string') value = value + args.join('')
      else if (method === 'replaceAll' && typeof value === 'string') value = value.split(String(args[0])).join(String(args[1]))
      else if (method === 'toUpperCase' && typeof value === 'string') value = value.toUpperCase()
      else if (method === 'toLowerCase' && typeof value === 'string') value = value.toLowerCase()
      else this.fail('unsupported method ' + method)
    }
  }
  primary() {
    this.skip()
    const t = this.text
    const c = t[this.pos]
    if (c === '{') return this.object()
    if (c === '[') return this.array()
    if (c === '"' || c === "'") return this.string()
    if (c === '`') return this.template()
    if (c === '(') {
      this.pos++
      const v = this.value()
      this.skip()
      if (t[this.pos] !== ')') this.fail('expected )')
      this.pos++
      return v
    }
    if (c === '-' || /[0-9]/.test(c || '')) {
      const m = /^-?[0-9]+(?:\.[0-9]+)?(?:e[+-]?[0-9]+)?/.exec(t.slice(this.pos))
      if (m) {
        this.pos += m[0].length
        return Number(m[0])
      }
    }
    if (c === '!' || t.startsWith('void ', this.pos)) {
      this.fail('unsupported expression')
    }
    if (isIdentStart(c || '')) {
      const start = this.pos
      while (isIdentChar(t[this.pos] || '')) this.pos++
      const id = t.slice(start, this.pos)
      if (id === 'true') return true
      if (id === 'false') return false
      if (id === 'null') return null
      if (id === 'undefined') return undefined
      return this.resolve(id)
    }
    this.fail('unexpected char ' + JSON.stringify(c))
  }
  resolve(id) {
    const candidates = this.decls.filter((d) => d.id === id && d.start < this.callIndex)
    candidates.sort((a, b) => b.start - a.start)
    const attempts = []
    for (const decl of candidates) {
      const p = new Parser(this.text, this.decls, decl.start)
      p.pos = decl.valueStart
      try {
        const v = p.value()
        return v
      } catch (e) {
        attempts.push(e.message)
      }
    }
    this.fail('unresolved identifier ' + id + (attempts.length ? ' (' + attempts.slice(0, 2).join(' | ') + ')' : ''))
  }
  string() {
    const t = this.text
    const quote = t[this.pos]
    this.pos++
    let out = ''
    for (;;) {
      const c = t[this.pos]
      if (c === undefined) this.fail('unterminated string')
      this.pos++
      if (c === quote) return out
      if (c === '\\') {
        const e = t[this.pos]
        this.pos++
        if (e === 'n') out += '\n'
        else if (e === 't') out += '\t'
        else if (e === 'r') out += '\r'
        else if (e === 'b') out += '\b'
        else if (e === 'f') out += '\f'
        else if (e === 'v') out += '\v'
        else if (e === '0') out += '\0'
        else if (e === 'u') {
          if (t[this.pos] === '{') {
            const end = t.indexOf('}', this.pos)
            out += String.fromCodePoint(parseInt(t.slice(this.pos + 1, end), 16))
            this.pos = end + 1
          } else {
            out += String.fromCharCode(parseInt(t.slice(this.pos, this.pos + 4), 16))
            this.pos += 4
          }
        } else if (e === '\n') {
          // line continuation
        } else out += e
        continue
      }
      out += c
    }
  }
  template() {
    const t = this.text
    this.pos++
    let out = ''
    for (;;) {
      const c = t[this.pos]
      if (c === undefined) this.fail('unterminated template')
      if (c === '`') {
        this.pos++
        return out
      }
      if (c === '\\') {
        this.pos++
        out += t[this.pos]
        this.pos++
        continue
      }
      if (c === '$' && t[this.pos + 1] === '{') {
        this.pos += 2
        const v = this.value()
        if (v === undefined) this.fail('template expression unresolved')
        out += String(v)
        this.skip()
        if (t[this.pos] !== '}') this.fail('expected } in template')
        this.pos++
        continue
      }
      out += c
      this.pos++
    }
  }
  object() {
    const t = this.text
    this.pos++ // {
    const obj = {}
    for (;;) {
      this.skip()
      if (t[this.pos] === '}') {
        this.pos++
        return obj
      }
      if (t.startsWith('...', this.pos)) {
        this.pos += 3
        const v = this.value()
        if (!v || typeof v !== 'object' || Array.isArray(v)) this.fail('bad spread')
        Object.assign(obj, v)
      } else if (t[this.pos] === '[') {
        // computed key
        this.pos++
        const k = this.value()
        this.skip()
        if (t[this.pos] !== ']') this.fail('expected ]')
        this.pos++
        this.skip()
        if (t[this.pos] !== ':') this.fail('expected : after computed key')
        this.pos++
        obj[String(k)] = this.value()
      } else {
        let key
        if (t[this.pos] === '"' || t[this.pos] === "'") key = this.string()
        else if (/[0-9]/.test(t[this.pos] || '')) {
          const start = this.pos
          while (/[0-9.]/.test(t[this.pos] || '')) this.pos++
          key = t.slice(start, this.pos)
        } else {
          const start = this.pos
          while (isIdentChar(t[this.pos] || '')) this.pos++
          key = t.slice(start, this.pos)
          if (!key) this.fail('expected key')
        }
        this.skip()
        if (t[this.pos] === ':') {
          this.pos++
          obj[key] = this.value()
        } else {
          // shorthand
          obj[key] = this.resolve(key)
        }
      }
      this.skip()
      if (t[this.pos] === ',') {
        this.pos++
        continue
      }
      if (t[this.pos] === '}') {
        this.pos++
        return obj
      }
      this.fail('expected , or }')
    }
  }
  array() {
    const t = this.text
    this.pos++
    const arr = []
    for (;;) {
      this.skip()
      if (t[this.pos] === ']') {
        this.pos++
        return arr
      }
      if (t.startsWith('...', this.pos)) {
        this.pos += 3
        const v = this.value()
        if (!Array.isArray(v)) this.fail('bad array spread')
        arr.push(...v)
      } else {
        arr.push(this.value())
      }
      this.skip()
      if (t[this.pos] === ',') {
        this.pos++
        continue
      }
      if (t[this.pos] === ']') {
        this.pos++
        return arr
      }
      this.fail('expected , or ]')
    }
  }
}

/** Balanced-region reader for a call's argument list starting after '(' */
function readArgs(text, openParen) {
  let depth = 0
  let inStr = null
  let esc = false
  const parts = []
  let start = openParen + 1
  for (let i = openParen + 1; i < text.length; i++) {
    const c = text[i]
    if (inStr) {
      if (esc) {
        esc = false
        continue
      }
      if (c === '\\') {
        esc = true
        continue
      }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c
      continue
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++
      continue
    }
    if (c === ')' || c === ']' || c === '}') {
      if (depth === 0 && c === ')') {
        parts.push({ start, end: i })
        return { args: parts }
      }
      depth--
      continue
    }
    if (c === ',' && depth === 0) {
      parts.push({ start, end: i })
      start = i + 1
    }
  }
  return null
}

function collectDecls(text) {
  const decls = []
  const re = /(?:^|[;{}\n])\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/g
  let m
  while ((m = re.exec(text))) {
    decls.push({ id: m[1], start: m.index, valueStart: m.index + m[0].length })
  }
  return decls
}

const dicts = []
const pkgs = fs.readdirSync(ROOT)

for (const pkg of pkgs) {
  const file = path.join(ROOT, pkg, 'lib', 'client.js')
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    continue
  }
  const decls = collectDecls(text)
  const sites = []
  const needle = 'locale.register('
  let at = text.indexOf(needle)
  while (at >= 0) {
    sites.push(at)
    at = text.indexOf(needle, at + 1)
  }
  if (!sites.length) {
    report.push(`${pkg}: NO locale.register site`)
    continue
  }
  for (const site of sites) {
    const openParen = site + needle.length - 1
    const parsed = readArgs(text, openParen)
    if (!parsed) {
      report.push(`${pkg}: unterminated register call at ${site}`)
      continue
    }
    const { args } = parsed
    const parse = (range) => {
      const p = new Parser(text, decls, site)
      p.pos = range.start
      return p.value()
    }
    const tryNs = () => {
      try {
        return parse(args[0])
      } catch {
        return undefined
      }
    }
    // Form A: (NS, { zh, en })   Form B: (NS, locale, dict)
    let ns
    let entries // [locale, dict][]
    let err = ''
    try {
      if (args.length >= 3) {
        ns = tryNs()
        const locale = parse(args[1])
        const dict = parse(args[2])
        entries = [[locale, dict]]
      } else {
        ns = tryNs()
        const second = text.slice(args[1].start, args[1].end).trim()
        if (second.startsWith('{')) {
          const p = new Parser(text, decls, site)
          p.pos = args[1].start
          p.skip()
          const obj = p.object()
          entries = Object.entries(obj).map(([loc, dict]) => [loc, dict])
        } else {
          // identifier holding a map of locale -> dict, or loop variable
          const obj = parse(args[1])
          if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
            entries = Object.entries(obj)
          } else {
            throw new Error('loop form: ' + second)
          }
        }
      }
      if (typeof ns !== 'string') throw new Error('ns not a string: ' + JSON.stringify(ns))
    } catch (e) {
      err = e.message
    }
    if (err) {
      // Loop form: dictionaries declared as [[locale, dict], ...] before the call
      const loopRe = /const\s+([A-Za-z_$][\w$]*)\s*=\s*\[\s*\[\s*["']/g
      let lm
      const recovered = []
      while ((lm = loopRe.exec(text))) {
        if (lm.index > site) break
        try {
          // re-read whole array from its '[' (we are at the inner one) -> step back to outer
          const outer = lm.index + lm[0].indexOf('[')
          const p2 = new Parser(text, decls, site)
          p2.pos = outer
          p2.skip()
          const arr = p2.array()
          if (Array.isArray(arr) && arr.every((e) => Array.isArray(e) && typeof e[0] === 'string')) {
            recovered.push({ name: lm[1], arr, ns })
          }
        } catch (e2) {
          /* ignore */
        }
      }
      if (recovered.length) {
        const chosen = recovered[recovered.length - 1]
        let ns2 = chosen.ns
        if (typeof ns2 !== 'string') {
          const loc = /const\s+LOCALE_NS\s*=\s*["']([^"']+)["']/.exec(text)
          ns2 = loc ? loc[1] : undefined
        }
        if (typeof ns2 === 'string') {
          for (const [loc, dict] of chosen.arr) {
            if (loc === 'en' || loc === 'zh') dicts.push({ pkg, ns: ns2, locale: loc, dict })
          }
          report.push(`${pkg}/${ns2}: recovered loop dictionaries (${chosen.name})`)
          continue
        }
      }
      report.push(`${pkg}@${site}: ${err}`)
      continue
    }
    for (const [locale, dict] of entries) {
      if (typeof locale !== 'string') {
        report.push(`${pkg}/${ns}@${site}: non-string locale ${JSON.stringify(locale)}`)
        continue
      }
      if (!dict || typeof dict !== 'object' || Array.isArray(dict)) {
        report.push(`${pkg}/${ns}@${site}: dictionary is not an object for ${locale}`)
        continue
      }
      dicts.push({ pkg, ns, locale, dict })
    }
  }
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(repoPath('extract/dicts-v2.json'), JSON.stringify(dicts, null, 1), 'utf8')
const byNs = new Map()
for (const d of dicts) {
  const k = d.ns + '|' + d.locale
  byNs.set(k, (byNs.get(k) || 0) + Object.keys(d.dict).length)
}
const summary = []
summary.push('entries=' + dicts.length)
let enTotal = 0
for (const d of dicts) if (d.locale === 'en') enTotal += Object.keys(d.dict).length
summary.push('EN KEYS=' + enTotal)
summary.push('namespaces=' + new Set(dicts.map((d) => d.ns)).size)
for (const [k, v] of [...byNs].sort()) summary.push(k + ' = ' + v)
summary.push('--- report ---')
summary.push(...report)
fs.writeFileSync(repoPath('extract/summary-v2.txt'), summary.join('\n'), 'utf8')
console.log('entries=' + dicts.length + ' enKeys=' + enTotal)
