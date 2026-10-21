// Build per-namespace English source files plus validation facts from dicts-v2.json.
import fs from 'node:fs'
import { readJson, repoPath, writeJson } from './lib/repo.mjs'
import { placeholderKey } from './lib/text.mjs'

const dicts = readJson(repoPath('extract/dicts-v2.json'))

const byNs = new Map()
for (const entry of dicts) {
  if (!byNs.has(entry.ns)) byNs.set(entry.ns, { ns: entry.ns, pkg: entry.pkg, en: undefined, zh: undefined })
  const slot = byNs.get(entry.ns)
  slot[entry.locale] = entry.dict
}

const enDir = repoPath('extract/en')
fs.mkdirSync(enDir, { recursive: true })

const issues = []
const manifest = []
for (const [ns, slot] of [...byNs].sort((a, b) => a[0].localeCompare(b[0]))) {
  const fileNs = ns.replace(/[^A-Za-z0-9._-]/g, '_')
  if (!slot.en) {
    issues.push(`${ns}: missing en dictionary`)
    continue
  }
  if (!slot.zh) issues.push(`${ns}: missing zh dictionary`)
  const enKeys = Object.keys(slot.en)
  const zhKeys = slot.zh ? Object.keys(slot.zh) : []
  if (slot.zh && enKeys.length !== zhKeys.length) issues.push(`${ns}: key count en=${enKeys.length} zh=${zhKeys.length}`)
  if (slot.zh) {
    const missingInZh = enKeys.filter((k) => !(k in slot.zh))
    const extraInZh = zhKeys.filter((k) => !(k in slot.en))
    if (missingInZh.length) issues.push(`${ns}: keys missing zh: ${missingInZh.slice(0, 8).join(', ')}`)
    if (extraInZh.length) issues.push(`${ns}: keys only in zh: ${extraInZh.slice(0, 8).join(', ')}`)
    for (const k of enKeys) {
      if (!(k in slot.zh)) continue
      const a = placeholderKey(slot.en[k])
      const b = placeholderKey(slot.zh[k])
      if (a !== b) issues.push(`${ns}/${k}: placeholder mismatch en=[${a}] zh=[${b}]`)
    }
  }
  writeJson(repoPath('extract/en', fileNs + '.json'), slot.en)
  const lengths = enKeys.map((k) => slot.en[k].length)
  manifest.push({
    ns,
    pkg: slot.pkg,
    file: fileNs + '.json',
    keys: enKeys.length,
    maxLength: Math.max(...lengths),
    longestKey: enKeys[lengths.indexOf(Math.max(...lengths))],
    multiLineKeys: enKeys.filter((k) => slot.en[k].includes('\n')).length,
    placeholderKeys: enKeys.filter((k) => placeholderKey(slot.en[k]).length > 0).length,
  })
}

writeJson(repoPath('extract/manifest.json'), manifest)
fs.writeFileSync(repoPath('extract/validation.txt'), issues.join('\n') || 'no issues', 'utf8')
const totalKeys = manifest.reduce((sum, m) => sum + m.keys, 0)
console.log('namespaces=' + manifest.length + ' keys=' + totalKeys + ' issues=' + issues.length)
