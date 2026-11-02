// Shared access to the display text a language pack overlays on Host-provided strings: the English
// snapshot and the hand-written Vietnamese translations.
//
// Two families sit side by side because both are resolved by the English wording, not by a locale
// key: package titles/descriptions (`vi-meta/packages-*.json`) and Host copy that reaches the GUI as
// an approval reason (`vi-meta/host-text.json`).
import fs from 'node:fs'
import { extractPath, metaPath, readJson, repoPath } from './repo.mjs'

// English package titles/descriptions extracted from the installed build; do not hand-edit it.
export const loadMetaSource = () => readJson(extractPath('meta.json'))

// English Host copy extracted from the installed build; do not hand-edit it.
export const loadHostTextSource = () => readJson(extractPath('host-text.json'))

// Hand-written package text lives in packages-<batch>.json files only.
const PART_NAME = /^packages-[a-z0-9-]+\.json$/

// The hand-written Host copy overlay, keyed by the English template.
export const HOST_TEXT_FILE = 'host-text.json'

// Sorted names of the vi-meta part files; empty when the directory has not been created yet.
export const listMetaParts = () => {
  const dir = metaPath()
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => PART_NAME.test(file)).sort() : []
}

// Parse one vi-meta part file by name.
export const readMetaPart = (file) => readJson(metaPath(file))

// The Host copy overlay, or an empty object when it has not been written yet.
export const readHostTextPart = () => {
  const file = metaPath(HOST_TEXT_FILE)
  return fs.existsSync(file) ? readJson(file) : {}
}
