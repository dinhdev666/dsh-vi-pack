// Validate Vietnamese packs against the English source dictionaries.
// Usage: node tools/validate-vi.mjs [namespace ...]
import fs from 'node:fs'
import { loadManifest, readJson, repoPath } from './lib/repo.mjs'
import { CJK_VI, placeholderKey, stripPlaceholders } from './lib/text.mjs'

const manifest = loadManifest()
const byNs = new Map(manifest.map((m) => [m.ns, m]))

const args = process.argv.slice(2).map((a) => a.replace(/\.json$/, ''))
const targets = args.length ? args.map((ns) => byNs.get(ns) || { ns, file: ns + '.json' }) : manifest

// Technical tokens and loanwords that may legitimately stay identical to English.
const ALLOWED_WORDS = new Set([
  'ok', 'json', 'html', 'markdown', 'pdf', 'csv', 'yaml', 'toml', 'mcp', 'cli', 'api',
  'url', 'uri', 'uuid', 'ssh', 'sftp', 'pty', 'git', 'diff', 'tab', 'enter', 'esc',
  'escape', 'ctrl', 'shift', 'alt', 'mod', 'command', 'cmd', 'backspace', 'space',
  'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'deepseek', 'dsh', 'cordis', 'ptc',
  'plugin', 'agent', 'shell', 'token', 'workspace', 'web', 'ui', 'id', 'http', 'https',
  'ws', 'css', 'js', 'ts', 'tsx', 'jsx', 'node', 'npm', 'pnpm', 'react', 'vs', 'code',
  'python', 'bash', 'zsh', 'powershell', 'pwsh', 'x', 'k', 'm', 'gb', 'mb', 'kb', 'ms',
  's', 'px', 'h', 'vi', 'en', 'zh', 'aa', 'ai', 'tts', 'stt', 'asr', 'mime', 'utf',
  'base64', 'svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'docx', 'xlsx', 'pptx', 'mp3',
  'wav', 'opus', 'pdf', 'rtl', 'ltr', 'app', 'pro', 'max', 'plus', 'auto', 'none',
  'terminal', 'hugging', 'face', 'hf', 'mirror', 'exp', 'openai', 'anthropic', 'ollama',
  'lmstudio', 'vllm', 'sglang', 'groq', 'mistral', 'qwen', 'llama', 'gemini', 'azure',
  'google', 'bing', 'deepl', 'yandex', 'chat', 'completions', 'responses', 'messages',
  'gateway', 'example', 'v', 'api', 'endpoint', 'harness', 'utc', 'grep', 'glob',
])
const IDENTICAL_KEY_ALLOW = [/badge\.label$/, /\.title$/, /^common\.json\.label$/]

// A value made only of allowed tokens, numbers, units, and punctuation needs no translation.
const isTokenOnly = (value) => {
  if (/^https?:\/\/\S+$/i.test(value.trim())) return true
  // Identifiers, slugs, and path-like literals (e.g. "dsh-plugin-whale-pet", "v{version}" is covered by words).
  if (/^[\w.@/-]+$/.test(value.trim()) && /[./_@-]/.test(value)) return true
  const bare = stripPlaceholders(value).replace(/\[\^?[^\]]*\]/g, ' ')
  if (bare.trim() === '') return true
  const words = bare.match(/[A-Za-z]+/g) || []
  return words.every((w) => ALLOWED_WORDS.has(w.toLowerCase()))
}
// Values with no letters outside placeholders (e.g. "{percent}%") need no translation either.
const hasNoLetters = (value) => !/[A-Za-zÀ-ỹ]/.test(stripPlaceholders(value, ''))


const errors = []
const warnings = []
const stats = { files: 0, keys: 0 }

for (const target of targets) {
  const ns = target.ns
  const file = target.file || ns + '.json'
  const enPath = repoPath('extract/en', file)
  const viPath = repoPath('vi-packs', file)
  if (!fs.existsSync(enPath)) {
    errors.push(`${ns}: no English source ${file}`)
    continue
  }
  const en = readJson(enPath)
  if (!fs.existsSync(viPath)) {
    errors.push(`${ns}: missing vi-packs/${file}`)
    continue
  }
  let vi
  try {
    vi = readJson(viPath)
  } catch (e) {
    errors.push(`${ns}: invalid JSON (${e.message})`)
    continue
  }
  stats.files++
  const enKeys = Object.keys(en)
  const viKeys = Object.keys(vi)
  stats.keys += enKeys.length
  if (enKeys.length !== viKeys.length) errors.push(`${ns}: key count en=${enKeys.length} vi=${viKeys.length}`)
  for (const key of enKeys) if (!(key in vi)) errors.push(`${ns}: missing key ${key}`)
  for (const key of viKeys) if (!(key in en)) errors.push(`${ns}: extra key ${key}`)

  const ordered = viKeys.filter((k) => enKeys.includes(k))
  const enOrder = enKeys.filter((k) => viKeys.includes(k))
  if (ordered.join('\u0000') !== enOrder.join('\u0000')) warnings.push(`${ns}: key order differs from source`)

  for (const key of enKeys) {
    if (!(key in vi)) continue
    const src = en[key]
    const dst = vi[key]
    if (typeof dst !== 'string') {
      errors.push(`${ns}/${key}: value is not a string`)
      continue
    }
    if (dst.trim() === '' && src.trim() !== '') errors.push(`${ns}/${key}: empty translation`)
    const srcPadded = src !== src.trim()
    const dstPadded = dst !== dst.trim()
    if (dstPadded && !srcPadded && !hasNoLetters(dst)) {
      errors.push(`${ns}/${key}: leading/trailing whitespace`)
    }
    if (srcPadded && !dstPadded && !hasNoLetters(src)) {
      warnings.push(`${ns}/${key}: source pads this concatenation fragment, translation does not`)
    }
    if (CJK_VI.test(dst)) errors.push(`${ns}/${key}: contains CJK characters`)
    const a = placeholderKey(src)
    const b = placeholderKey(dst)
    if (a !== b) errors.push(`${ns}/${key}: placeholders en=[${a}] vi=[${b}]`)
    if (/\{\{|\}\}/.test(dst) && !/\{\{|\}\}/.test(src)) warnings.push(`${ns}/${key}: stray double braces`)
    if (dst === src) {
      const allowed =
        isTokenOnly(src) ||
        hasNoLetters(src) ||
        src.trim() === '' ||
        (ns === 'open-in-app' && /^app\./.test(key)) ||
        IDENTICAL_KEY_ALLOW.some((re) => re.test(key))
      if (!allowed) errors.push(`${ns}/${key}: identical to English ("${src}")`)
    }
    const srcNl = (src.match(/\n/g) || []).length
    const dstNl = (dst.match(/\n/g) || []).length
    if (srcNl !== dstNl) warnings.push(`${ns}/${key}: line-break count en=${srcNl} vi=${dstNl}`)
    for (const marker of ['### ', '> ', '- ']) {
      const sc = src.split(marker).length - 1
      const dc = dst.split(marker).length - 1
      if (sc !== dc) warnings.push(`${ns}/${key}: marker "${marker.trim()}" count en=${sc} vi=${dc}`)
    }
    if (src.length > 0 && src.length < 40 && dst.length > src.length * 1.8) {
      warnings.push(`${ns}/${key}: long translation (${src.length} -> ${dst.length})`)
    }
  }
}

console.log(`checked ${stats.files} file(s), ${stats.keys} keys`)
if (errors.length) {
  console.log(`\nERRORS (${errors.length}):`)
  for (const e of errors.slice(0, 200)) console.log('  ' + e)
  if (errors.length > 200) console.log(`  … ${errors.length - 200} more`)
}
if (warnings.length) {
  console.log(`\nWARNINGS (${warnings.length}):`)
  for (const w of warnings.slice(0, 80)) console.log('  ' + w)
  if (warnings.length > 80) console.log(`  … ${warnings.length - 80} more`)
}
console.log(errors.length ? '\nFAIL' : '\nOK')
process.exit(errors.length ? 1 : 0)
