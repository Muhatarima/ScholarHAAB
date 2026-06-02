import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const ROOT = process.cwd()
const REPORT_PATH = path.join(ROOT, 'test-results', 'academic_torture_report.json')

function runAcademicGate() {
  return new Promise<void>((resolve, reject) => {
    const child =
      process.platform === 'win32'
        ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm.cmd run test:academic-torture'], {
            cwd: ROOT,
            stdio: 'inherit',
            shell: false,
          })
        : spawn('npm', ['run', 'test:academic-torture'], {
            cwd: ROOT,
            stdio: 'inherit',
            shell: false,
          })
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Academic torture gate failed with exit code ${code}`))
    })
  })
}

function readLatestReport() {
  if (!fs.existsSync(REPORT_PATH)) {
    return null
  }
  return JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8')) as {
    gates?: {
      mathAccuracy?: number
      numericalPhysicsAccuracy?: number
      passed?: boolean
    }
    mismatchCount?: number
  }
}

async function main() {
  await runAcademicGate()
  const report = readLatestReport()
  if (!report?.gates) {
    throw new Error('Academic torture report was not generated.')
  }

  console.log(
    JSON.stringify(
      {
        mathAccuracy: report.gates.mathAccuracy,
        numericalPhysicsAccuracy: report.gates.numericalPhysicsAccuracy,
        mismatchCount: report.mismatchCount ?? 0,
        ready: Boolean(report.gates.passed),
      },
      null,
      2
    )
  )

  if (!report.gates.passed) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
