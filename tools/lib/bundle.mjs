// Shared description of the shippable bundle: the directory that holds the generated client half
// and the hand-maintained bundle files, plus the two manifests that describe it.
import { readJson, repoPath } from './repo.mjs'

// The bundle directory inside the repository; the generated client half is written here.
export const BUNDLE_DIR = 'plugin'

// The manifest at the repository root: the install face of a plain Git URL, because a Git install
// packages the repository root. Its exports and its bundle patch point into the bundle directory.
export const ROOT_MANIFEST = 'package.json'

// The manifest inside the bundle directory: the install face of a subdirectory spec
// (`<repository-url>#path:/plugin`), which packages this folder alone.
export const BUNDLE_MANIFEST = `${BUNDLE_DIR}/package.json`

// The root manifest, read from the repository.
export const readRootManifest = () => readJson(repoPath(ROOT_MANIFEST))

// The bundle-directory manifest, read from the repository.
export const readBundleManifest = () => readJson(repoPath(BUNDLE_MANIFEST))
