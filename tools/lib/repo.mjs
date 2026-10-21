// Shared repository root and JSON file helpers for the scripts in tools/.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// Repository root, resolved from this module so the checkout can live anywhere and the tools
// run from any working directory.
export const BASE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

// Absolute path of a repository-relative path.
export const repoPath = (...parts) => path.join(BASE, ...parts)

// Read and parse a UTF-8 JSON file; a parse failure surfaces its original message.
export const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'))

// Write a value as a UTF-8 JSON file: 2-space indentation and exactly one trailing newline.
export const writeJson = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8')

// The namespace manifest that extract-dicts.mjs / prepare-dataset.mjs maintain under extract/.
export const loadManifest = () => readJson(repoPath('extract', 'manifest.json'))
