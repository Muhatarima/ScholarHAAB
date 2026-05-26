import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const nextDir = path.join(root, '.next')

const excludedRoots = [
  'data',
  'chromadb',
  'scholarhaaab-intelligence',
  'scripts',
  'reports',
  'eval',
  'output',
  'extracted',
]

function normalize(value) {
  return value.replace(/\\/g, '/')
}

function isExcluded(traceDir, tracedFile) {
  const absolute = path.resolve(traceDir, tracedFile)
  const relativeToRoot = normalize(path.relative(root, absolute))

  return excludedRoots.some((folder) => (
    relativeToRoot === folder || relativeToRoot.startsWith(`${folder}/`)
  ))
}

async function findTraceFiles(dir) {
  const matches = []
  let entries = []

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return matches
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)

    if (entry.isDirectory()) {
      matches.push(...await findTraceFiles(fullPath))
    } else if (entry.name.endsWith('.nft.json')) {
      matches.push(fullPath)
    }
  }

  return matches
}

let traceCount = 0
let removedCount = 0

for (const traceFile of await findTraceFiles(nextDir)) {
  const traceDir = path.dirname(traceFile)
  const raw = await readFile(traceFile, 'utf8')
  const trace = JSON.parse(raw)
  const originalFiles = Array.isArray(trace.files) ? trace.files : []
  const keptFiles = originalFiles.filter((file) => !isExcluded(traceDir, file))
  const removed = originalFiles.length - keptFiles.length

  traceCount += 1
  removedCount += removed

  if (removed > 0) {
    trace.files = keptFiles
    await writeFile(traceFile, `${JSON.stringify(trace, null, 2)}\n`)
  }
}

console.log(
  `Trace scrub complete: scanned ${traceCount} traces, removed ${removedCount} deploy-excluded files.`
)
