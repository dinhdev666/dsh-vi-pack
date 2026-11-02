// Consistency audit: group every namespace value by its English source and report
// English strings that received more than one distinct Vietnamese rendering.
// Catches drift such as "Truy cập đầy đủ" vs "Toàn quyền truy cập" for "Full access".
import fs from 'node:fs'
import { loadManifest, readJson, repoPath } from './lib/repo.mjs'

const only = process.argv.slice(2).map((a) => a.replace(/\.json$/, ''))
const targets = only.length
  ? loadManifest().filter((m) => only.includes(m.ns))
  : loadManifest()

// Flatten a nested object into { dotted.key: string }.
const flatten = (obj, prefix = '', out = {}) => {
  if (typeof obj === 'string') { out[prefix] = obj; return out }
  if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
    for (const k of Object.keys(obj)) flatten(obj[k], prefix ? prefix + '.' + k : k, out)
  } else if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, prefix + '[' + i + ']', out))
  }
  return out
}

const byEn = new Map()
for (const entry of targets) {
  const en = readJson(repoPath('extract/en', entry.file))
  const viPath = repoPath('vi-packs', entry.file)
  if (!fs.existsSync(viPath)) continue
  const vi = readJson(viPath)
  const enFlat = flatten(en)
  const viFlat = flatten(vi)
  for (const key of Object.keys(enFlat)) {
    const english = enFlat[key]
    const vietnamese = viFlat[key]
    if (typeof english !== 'string' || typeof vietnamese !== 'string') continue
    if (!byEn.has(english)) byEn.set(english, [])
    byEn.get(english).push({ ns: entry.ns, key, vi: vietnamese })
  }
}

const groups = []
for (const [english, entries] of byEn) {
  const distinct = new Set(entries.map((e) => e.vi))
  if (distinct.size > 1) groups.push({ english, entries, distinct })
}

console.log(`audited ${targets.length} namespace(s), ${byEn.size} distinct English strings`)
console.log(`INCONSISTENT GROUPS (${groups.length}):`)
for (const g of groups) {
  console.log(`\n=== EN: ${JSON.stringify(g.english)}`)
  for (const e of g.entries) {
    console.log(`   ${e.ns} :: ${e.key} => ${JSON.stringify(e.vi)}`)
  }
}
