// Check that the two bundle manifests still describe the same bundle. The repository-root manifest
// is the install face of a plain Git URL (a Git install packages the repository root), and the
// bundle-directory manifest is the install face of a subdirectory spec
// (`<repository-url>#path:/plugin`). DSH loads whichever manifest the install target selects, so a
// drift between them installs a different bundle than the one the repository documents.
import fs from 'node:fs'
import path from 'node:path'
import { BUNDLE_DIR, BUNDLE_MANIFEST, ROOT_MANIFEST, readBundleManifest, readRootManifest } from './lib/bundle.mjs'
import { repoPath } from './lib/repo.mjs'

const problems = []
const root = readRootManifest()
const bundle = readBundleManifest()

// Identity fields the two manifests must agree on; `name` decides the dependency name an install
// records and must match the module name the bundle patch inserts.
for (const field of ['name', 'version', 'description', 'type']) {
  if (root[field] !== bundle[field]) {
    problems.push(`${field}: ${ROOT_MANIFEST} ${JSON.stringify(root[field])} vs ${BUNDLE_MANIFEST} ${JSON.stringify(bundle[field])}`)
  }
}

// Every resource the loader or the client module system resolves through `exports` must exist
// relative to the manifest that declares it. The Loader's module resolution also falls back to a
// package-root entry the CJS way (`main`, else `index.js`), so both manifests need one.
const ENTRY_EXTENSIONS = ['js', 'mjs', 'cjs']
const bundleEntry = (manifest, dir) => {
  const declared = typeof manifest.main === 'string' ? manifest.main : undefined
  if (declared !== undefined) {
    return fs.existsSync(path.resolve(dir, declared)) ? declared : undefined
  }
  return ENTRY_EXTENSIONS.map((extension) => `index.${extension}`).find((entry) => fs.existsSync(path.resolve(dir, entry)))
}
const checked = [
  ['root', root, repoPath()],
  ['bundle', bundle, repoPath(BUNDLE_DIR)],
]
for (const [label, manifest, dir] of checked) {
  const dsh = manifest.dsh
  const bundlePatch = typeof dsh === 'object' && dsh !== null ? dsh.bundle : undefined
  const patch = bundlePatch?.patch
  if (typeof patch !== 'string') problems.push(`${label} manifest: dsh.bundle.patch is not a string`)
  else if (!fs.existsSync(path.resolve(dir, patch))) problems.push(`${label} manifest: ${patch} does not exist`)
  for (const [subpath, target] of Object.entries(manifest.exports ?? {})) {
    if (subpath === './package.json') continue
    if (typeof target !== 'string') {
      problems.push(`${label} manifest: exports["${subpath}"] is not a string`)
      continue
    }
    if (target.includes('*')) continue
    if (!fs.existsSync(path.resolve(dir, target))) problems.push(`${label} manifest: ${target} (exports "${subpath}") does not exist`)
  }
  if (bundleEntry(manifest, dir) === undefined) problems.push(`${label} manifest: no module entry (set main or keep index.js at the manifest directory)`)
}

// The bundle patch inserts the row the loader resolves; its module name is the manifest name.
const patchText = fs.readFileSync(repoPath(BUNDLE_DIR, 'cordis.patch.yml'), 'utf8')
if (!patchText.includes(`name: '${bundle.name}'`)) {
  problems.push(`${BUNDLE_DIR}/cordis.patch.yml does not insert a row named ${JSON.stringify(bundle.name)}`)
}
if (!patchText.includes('locale-vi')) {
  problems.push(`${BUNDLE_DIR}/cordis.patch.yml does not insert the locale-vi entry`)
}

// The locale exports must cover the display metadata the plugin list reads, in English and Vietnamese.
for (const language of ['en', 'vi']) {
  if (!fs.existsSync(repoPath(BUNDLE_DIR, 'locale', `${language}.json`))) {
    problems.push(`${BUNDLE_DIR}/locale/${language}.json is missing`)
  }
}

if (problems.length) {
  console.error(`validate-manifest: ${problems.length} problem(s)`)
  for (const problem of problems) console.error('  ' + problem)
  process.exit(1)
}
console.log(`validate-manifest: OK (${root.name}@${root.version}, ${BUNDLE_DIR}/ bundle directory)`)
