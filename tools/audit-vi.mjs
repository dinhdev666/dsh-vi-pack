// Quality audit over translated packs: leftover English, glossary drift, spacing artifacts.
import fs from 'node:fs'
import { loadManifest, readJson, repoPath } from './lib/repo.mjs'
import { stripPlaceholders } from './lib/text.mjs'

const manifest = loadManifest()
const only = process.argv.slice(2).map((a) => a.replace(/\.json$/, ''))
const targets = only.length ? manifest.filter((m) => only.includes(m.ns)) : manifest

const ENGLISH_WORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'for', 'and', 'with', 'from', 'this', 'that', 'these',
  'those', 'is', 'are', 'was', 'were', 'on', 'in', 'at', 'by', 'you', 'your', 'will',
  'be', 'or', 'not', 'no', 'if', 'when', 'then', 'than', 'as', 'it', 'its', 'can',
  'cannot', 'may', 'should', 'must', 'have', 'has', 'do', 'does', 'use', 'using',
  'into', 'out', 'up', 'down', 'here', 'there', 'which', 'while', 'after', 'before',
  'only', 'also', 'all', 'any', 'each', 'other', 'more', 'most', 'some', 'such', 'but',
  'how', 'what', 'where', 'who', 'why', 'click', 'select', 'enter', 'press',
])
const GLOSSARY_TERMS = [
  ['session', 'phiên'], ['workspace', 'không gian làm việc'], ['setting', 'cài đặt'],
  ['message', 'tin nhắn'], ['model', 'mô hình'], ['tool', 'công cụ'], ['file', 'tệp'],
  ['folder', 'thư mục'], ['permission', 'quyền'], ['approval', 'phê duyệt'],
]
// Product/protocol phrases that legitimately keep these English words.
const KEEP_PHRASES = [
  /Anthropic Messages/gi, /Messages API/gi, /DeepSeek Messages/gi, /\/messages\b/gi,
  /File Explorer/gi, /Coding Tools/gi, /pnpm-workspace\.yaml/gi,
  /workspace-write/gi, /read-only/gi, /full-access/gi,
]
const DIACRITIC = /[ăâđêôơưàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/i
const stripKeep = (value) => KEEP_PHRASES.reduce((acc, re) => acc.replace(re, ' '), value)

const findings = { english: [], glossary: [], spacing: [], ascii: [] }
let checked = 0

for (const entry of targets) {
  const viPath = repoPath('vi-packs', entry.file)
  if (!fs.existsSync(viPath)) continue
  const en = readJson(repoPath('extract/en', entry.file))
  const vi = readJson(viPath)
  for (const [key, value] of Object.entries(vi)) {
    if (typeof value !== 'string') continue
    checked++
    const source = en[key] ?? ''
    const probe = stripKeep(stripPlaceholders(value))
    // Whole words (Unicode letters + combining marks); only pure-ASCII words can be English leftovers.
    const asciiWords = (probe.toLowerCase().match(/[\p{L}\p{M}]+/gu) || []).filter((w) => /^[a-z][a-z'-]*$/.test(w))
    const englishRun = asciiWords.filter((w) => ENGLISH_WORDS.has(w))
    if (englishRun.length >= 2) {
      findings.english.push(`${entry.ns}/${key}: ${englishRun.join(' ')} :: ${value.slice(0, 110)}`)
    }
    for (const [term, expected] of GLOSSARY_TERMS) {
      const match = probe.match(new RegExp(`\\b${term}s?\\b`))
      if (match && !new RegExp(expected, 'i').test(value) && match[0] === match[0].toLowerCase()) {
        findings.glossary.push(`${entry.ns}/${key}: "${match[0]}" :: ${value.slice(0, 110)}`)
      }
    }
    if (/ {2,}/.test(value.replace(/\s*\n\s*/g, '\n')) && source.includes('  ')) {
      findings.spacing.push(`${entry.ns}/${key}: double space :: ${value.slice(0, 90)}`)
    }
    if (/ [.,;:!?]/.test(value) && !/ [.,;:!?]/.test(source)) {
      findings.spacing.push(`${entry.ns}/${key}: space before punctuation :: ${value.slice(0, 90)}`)
    }
    if (value.length > 12 && !DIACRITIC.test(value) && /[a-zA-Z]{3,}/.test(value) && !/^https?:/.test(value)) {
      findings.ascii.push(`${entry.ns}/${key} :: ${value.slice(0, 110)}`)
    }
  }
}

console.log(`audited ${checked} values`)
for (const [name, list] of Object.entries(findings)) {
  console.log(`\n${name.toUpperCase()} (${list.length}):`)
  for (const line of list.slice(0, 40)) console.log('  ' + line)
  if (list.length > 40) console.log(`  … ${list.length - 40} more`)
}
