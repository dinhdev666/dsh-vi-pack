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
import { repoPath, writeJson } from './lib/repo.mjs'
import { openAsarArchive, resolveAppAsar } from './lib/asar.mjs'
import { languageMaps } from './lib/bundle-text.mjs'

const appAsar = resolveAppAsar()
if (!appAsar || !fs.existsSync(appAsar)) {
  console.error('Could not find the installed DeepSeek Harness app.asar.')
  console.error('Set DSH_APP_ASAR to its path when DSH lives somewhere else.')
  process.exit(1)
}

const { nodeAt, readFile } = openAsarArchive(appAsar)

/** Package directories DSH ships: the main tree and the generated dsh tree. */
const ROOTS = ['node_modules/@deepseek-ai', 'dsh/node_modules/@deepseek-ai']

/** Host copy that reaches the GUI as a reason: approval prompts and refusals. */
const REASON_PROPERTY = /reason/i

const entries = []
const seen = new Set()

for (const root of ROOTS) {
  const rootNode = nodeAt(root)
  if (!rootNode?.files) continue
  for (const [pkg, node] of Object.entries(rootNode.files)) {
    if (!node.files?.lib?.files) continue
    for (const file of Object.keys(node.files.lib.files)) {
      if (!file.endsWith('.js')) continue
      const text = readFile(`${root}/${pkg}/lib/${file}`)
      if (typeof text !== 'string' || text.length === 0) continue
      for (const map of languageMaps(text)) {
        if (!map.property || !REASON_PROPERTY.test(map.property)) continue
        const template = map.english.value
        if (typeof template !== 'string' || template.trim() === '') continue
        // A computed interpolation stays in the template as `${…}`: it is not translatable, so it is
        // reported as untranslatable instead of shipping a wrong translation.
        const computable = template.includes('${')
        const key = `${pkg}|${template}`
        if (seen.has(key)) continue
        seen.add(key)
        entries.push({
          pkg,
          file,
          property: map.property,
          template,
          params: map.english.params ?? [],
          computable,
        })
      }
    }
  }
}

entries.sort((a, b) => (a.pkg === b.pkg ? a.template.localeCompare(b.template) : a.pkg.localeCompare(b.pkg)))

writeJson(repoPath('extract', 'host-text.json'), { entries })
const computable = entries.filter((entry) => entry.computable)
console.log(`host text: ${entries.length} entries, ${computable.length} with computed interpolations`)
for (const entry of entries) {
  console.log(`  ${entry.pkg} (${entry.property}): ${entry.computable ? '! ' : ''}${entry.template}`)
}
