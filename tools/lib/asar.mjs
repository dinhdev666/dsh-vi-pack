// Shared app.asar access for the extraction scripts: auto-detection of the installed build and a
// plain node:fs archive reader. Runs under plain node; extracts nothing at import time.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// The installed app.asar, or undefined when DSH_APP_ASAR and the default install paths all miss.
export function resolveAppAsar() {
  if (process.env.DSH_APP_ASAR) return path.resolve(process.env.DSH_APP_ASAR)
  const defaults =
    process.platform === 'win32'
      ? [
          path.join(
            process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'),
            'Programs',
            'DeepSeek Harness',
            'resources',
            'app.asar',
          ),
          path.join(
            process.env.ProgramFiles || 'C:\\Program Files',
            'DeepSeek Harness',
            'resources',
            'app.asar',
          ),
        ]
      : process.platform === 'darwin'
        ? ['/Applications/DeepSeek Harness.app/Contents/Resources/app.asar']
        : []
  return defaults.find((candidate) => fs.existsSync(candidate))
}

// Open an .asar archive and return nodes by archive-relative path. The directory header sits at
// the front of the archive; file payloads follow under the recorded data offset.
export function openAsarArchive(archivePath) {
  const fd = fs.openSync(archivePath, 'r')
  const head = Buffer.alloc(16)
  fs.readSync(fd, head, 0, 16, 0)
  const headerSize = head.readUInt32LE(4)
  // Current builds start the JSON header at 16 and keep its length at 12; older ones at 8.
  let jsonStart = 12
  let jsonLength = head.readUInt32LE(8)
  if (head.toString('utf8', jsonStart, jsonStart + 1) !== '{') {
    jsonStart = 16
    jsonLength = head.readUInt32LE(12)
  }
  const raw = Buffer.alloc(jsonLength)
  fs.readSync(fd, raw, 0, jsonLength, jsonStart)
  const header = JSON.parse(raw.toString('utf8'))
  const baseOffset = 8 + headerSize

  // The archive node for one archive-relative path, or undefined when it does not exist.
  const nodeAt = (relPath) => {
    let node = header
    for (const part of relPath.split('/')) {
      node = node?.files?.[part]
      if (!node) return undefined
    }
    return node
  }

  // Read one packed file by archive-relative path, or undefined when it is absent.
  const readFile = (relPath) => {
    const node = nodeAt(relPath)
    if (!node || node.files) return undefined
    if (node.unpacked) {
      try {
        return fs.readFileSync(path.join(archivePath + '.unpacked', relPath), 'utf8')
      } catch {
        return undefined
      }
    }
    const size = Number(node.size)
    const buffer = Buffer.alloc(size)
    fs.readSync(fd, buffer, 0, size, baseOffset + Number(node.offset))
    return buffer.toString('utf8')
  }

  return { nodeAt, readFile }
}
