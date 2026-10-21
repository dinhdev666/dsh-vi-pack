// Extract package display metadata (title / description) from the installed DeepSeek Harness
// build into extract/meta.json. Read-only generator: never hand-edit its output.
//
// Unlike extract-dicts.mjs, this script parses app.asar itself, because it walks every shipped
// package's locale files instead of reading a mounted archive path. Plain `node` runs it.
// Set DSH_APP_ASAR to the installed app.asar when DSH lives somewhere else.
import fs from 'node:fs'
import { repoPath, writeJson } from './lib/repo.mjs'
import { openAsarArchive, resolveAppAsar } from './lib/asar.mjs'

const OUT = repoPath('extract')
const appAsar = resolveAppAsar()
if (!appAsar || !fs.existsSync(appAsar)) {
  console.error('Could not find the installed DeepSeek Harness app.asar.')
  console.error('Set DSH_APP_ASAR to its path when DSH lives somewhere else.')
  process.exit(1)
}

const { nodeAt, readFile } = openAsarArchive(appAsar)

/** Read one package directory's display metadata, or undefined when it carries none. */
function readMeta(dir) {
  const manifest = JSON.parse(readFile(`${dir}/package.json`) ?? 'null')
  if (!manifest || typeof manifest.name !== 'string') return undefined
  const en = JSON.parse(readFile(`${dir}/locale/en.json`) ?? '{}')
  if (!en.meta || typeof en.meta !== 'object') return undefined
  const zh = JSON.parse(readFile(`${dir}/locale/zh.json`) ?? '{}')
  const entry = { name: manifest.name }
  if (typeof en.meta.title === 'string') {
    entry.title = { en: en.meta.title }
    if (typeof zh.meta?.title === 'string') entry.title.zh = zh.meta.title
  }
  if (typeof en.meta.description === 'string') {
    entry.description = { en: en.meta.description }
    if (typeof zh.meta?.description === 'string') entry.description.zh = zh.meta.description
  }
  if (typeof en.meta.icon === 'string') entry.icon = true
  return entry.title || entry.description ? entry : undefined
}

/** Package directories DSH ships: the main tree and the generated dsh tree. */
const ROOTS = ['node_modules/@deepseek-ai', 'dsh/node_modules/@deepseek-ai']

const packages = []
const seen = new Set()

/** Record one package directory and the demo packages its skills templates ship. */
function collect(dir) {
  const entry = readMeta(dir)
  if (entry && !seen.has(entry.name)) {
    seen.add(entry.name)
    packages.push(entry)
  }
  const skills = nodeAt(`${dir}/skills`)
  for (const skill of Object.keys(skills?.files ?? {})) {
    const templates = nodeAt(`${dir}/skills/${skill}/templates`)
    for (const template of Object.keys(templates?.files ?? {})) collect(`${dir}/skills/${skill}/templates/${template}`)
  }
  const templates = nodeAt(`${dir}/templates`)
  for (const template of Object.keys(templates?.files ?? {})) collect(`${dir}/templates/${template}`)
}

for (const root of ROOTS) {
  const rootNode = nodeAt(root)
  if (!rootNode?.files) {
    console.error(`${root}: not found in app.asar`)
    process.exit(1)
  }
  for (const name of Object.keys(rootNode.files).sort()) {
    if (rootNode.files[name].files) collect(`${root}/${name}`)
  }
}

packages.sort((a, b) => a.name.localeCompare(b.name))

const version = JSON.parse(readFile('package.json') ?? '{}').version
fs.mkdirSync(OUT, { recursive: true })
writeJson(repoPath('extract/meta.json'), { appVersion: version ?? null, packages })

console.log(
  `packages=${packages.length} titles=${packages.filter((p) => p.title).length} ` +
    `descriptions=${packages.filter((p) => p.description).length} ` +
    `zhTitles=${packages.filter((p) => p.title?.zh).length}`,
)
