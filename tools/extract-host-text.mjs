// Extract Host-provided language maps from the installed DSH build into extract/host-text.json.
// Read-only generator: never hand-edit its output.
//
// The Web GUI localizes its own copy through locale namespaces, but a few strings are Host data
// that reaches the GUI through `ctx.locale.resolveText` — for example the approval prompt a
// sandbox escalation or an auto review raises. Those maps ship `en` and `zh` only, so a language
// pack has to supply its own wording. This script snapshots the English wording of every such map
// so the pack can be checked against it.
//
// Package display text (titles and descriptions) is not part of this snapshot: `extract-meta.mjs`
// owns it, because the browser bundle already resolves that text through the package overlay.
//
// Plain `node` runs it (it reads app.asar itself). Set DSH_APP_ASAR when DSH lives somewhere else.
import fs from 'node:fs'
import { extractPath, writeJson } from './lib/repo.mjs'
import { openAsarArchive, requireAppAsar, UPSTREAM_ROOTS } from './lib/asar.mjs'
import { languageMaps } from './lib/bundle-text.mjs'

const appAsar = requireAppAsar()

const { nodeAt, readFile } = openAsarArchive(appAsar)

/** Host copy that reaches the GUI as a reason: approval prompts and refusals. */
const REASON_PROPERTY = /reason/i

const entries = []
const seen = new Set()

function pushEntry(pkg, file, property, template, params = []) {
  if (typeof template !== 'string' || template.trim() === '') return
  const computable = template.includes('${')
  const key = `${pkg}|${template}`
  if (seen.has(key)) return
  seen.add(key)
  entries.push({ pkg, file, property, template, params, computable })
}

// Known Host approval/reason templates that moved to function-valued locale maps (not static
// string maps), so the generic languageMaps() scanner cannot see them. Extract from the source
// template literals to keep the snapshot in sync with the installed build.
function extractTemplateFunctions(text, pkg, file) {
  if (pkg === 'dsh-sandbox' && text.includes('escalationDisplayReason')) {
    const m = text.match(/escalation:\s*\(mode,\s*justification\)\s*=>\s*`([^`]+)`/)
    if (m) pushEntry(pkg, file, 'displayReason', m[1].replace(/\$\{mode\}/g, '{mode}').replace(/\$\{justification\}/g, '{justification}'), ['mode', 'justification'])
  }
  if (pkg === 'dsh-experimental-auto-review') {
    const m1 = text.match(/denied:\s*"([^"]*Auto review denied[^"]*)"/)
    if (m1) pushEntry(pkg, file, 'displayReason', m1[1], [])
    const m2 = text.match(/deniedWithReason:\s*\(reason\)\s*=>\s*`([^`]+)`/)
    if (m2) pushEntry(pkg, file, 'displayReason', m2[1].replace(/\$\{reason\}/g, '{reason}'), ['reason'])
  }
}

for (const root of UPSTREAM_ROOTS) {
  const rootNode = nodeAt(root)
  if (!rootNode?.files) continue
  for (const [pkg, node] of Object.entries(rootNode.files)) {
    if (!node.files?.lib?.files) continue
    for (const file of Object.keys(node.files.lib.files)) {
      if (!file.endsWith('.js')) continue
      const text = readFile(`${root}/${pkg}/lib/${file}`)
      if (typeof text !== 'string' || text.length === 0) continue
      extractTemplateFunctions(text, pkg, file)
      for (const map of languageMaps(text)) {
        if (!map.property || !REASON_PROPERTY.test(map.property)) continue
        pushEntry(pkg, file, map.property, map.english.value, map.english.params ?? [])
      }
    }
  }
}

entries.sort((a, b) => (a.pkg === b.pkg ? a.template.localeCompare(b.template) : a.pkg.localeCompare(b.pkg)))

writeJson(extractPath('host-text.json'), { entries })
const computable = entries.filter((entry) => entry.computable)
console.log(`host text: ${entries.length} entries, ${computable.length} with computed interpolations`)
for (const entry of entries) {
  console.log(`  ${entry.pkg} (${entry.property}): ${entry.computable ? '! ' : ''}${entry.template}`)
}
