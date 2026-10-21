// Shared access to package display text: the English source snapshot and the vi-meta part files.
import fs from 'node:fs'
import { readJson, repoPath } from './repo.mjs'

// English package titles/descriptions extracted from the installed build; do not hand-edit it.
export const loadMetaSource = () => readJson(repoPath('extract', 'meta.json'))

// Hand-written package text lives in packages-<batch>.json files only.
const PART_NAME = /^packages-[a-z0-9-]+\.json$/

// Sorted names of the vi-meta part files; empty when the directory has not been created yet.
export const listMetaParts = () => {
  const dir = repoPath('vi-meta')
  return fs.existsSync(dir) ? fs.readdirSync(dir).filter((file) => PART_NAME.test(file)).sort() : []
}

// Parse one vi-meta part file by name.
export const readMetaPart = (file) => readJson(repoPath('vi-meta', file))
