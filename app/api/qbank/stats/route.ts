import fs from 'node:fs/promises'
import path from 'node:path'
import { getQbankCompletionSummary } from '@/lib/server/qbank-completion'
import { createRequestId, logError } from '@/lib/server/logger'
import { getQbankPaperPairStats } from '@/lib/server/qbank-paper-pairs'
import { requireAuth } from '@/lib/auth/requireAuth'

type SeedRow = {
  record_type: 'qbank_topic' | 'qbank_question'
  board?: string
  level?: string
  subject?: string
  link_quality?: 'exact' | 'hierarchical' | 'unlinked' | 'unknown'
  answer_ready?: boolean
}

type PaperRow = {
  board?: string
  level?: string
  subject?: string
}

function countBy<T extends string>(values: T[]) {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1
    return acc
  }, {})
}

async function readJsonl<T>(filePath: string) {
  const raw = await fs.readFile(filePath, 'utf8')
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T)
}

export async function GET(req: Request) {
  const { error: authError } = await requireAuth(req)
  if (authError) return authError

  const requestId = createRequestId()

  try {
    const dataDir = path.join(process.cwd(), 'data')
    const files = await fs.readdir(dataDir)

    const seedFiles = files.filter((file) => /^qbank_seed.*\.jsonl$/i.test(file)).sort()
    const paperFiles = files.filter((file) => /^qbank_paper.*\.jsonl$/i.test(file)).sort()
    const sourceFiles = files.filter((file) => /^qbank_source.*\.jsonl$/i.test(file)).sort()

    const [seedRows, paperRows] = await Promise.all([
      Promise.all(seedFiles.map((file) => readJsonl<SeedRow>(path.join(dataDir, file)))).then((rows) =>
        rows.flat()
      ),
      Promise.all(paperFiles.map((file) => readJsonl<PaperRow>(path.join(dataDir, file)))).then((rows) =>
        rows.flat()
      ),
    ])

    const pairStats = getQbankPaperPairStats()
    const topicRows = seedRows.filter((row) => row.record_type === 'qbank_topic')
    const questionRows = seedRows.filter((row) => row.record_type === 'qbank_question')

    return Response.json(
      {
        files: {
          seedFiles,
          paperFiles,
          sourceFiles,
        },
        counts: {
          topics: topicRows.length,
          questions: questionRows.length,
          papers: paperRows.length,
          exactAnswers: questionRows.filter((row) => row.link_quality === 'exact').length,
          partialAnswers: questionRows.filter((row) => row.link_quality === 'hierarchical').length,
          questionOnly: questionRows.filter((row) => row.link_quality === 'unlinked').length,
          answerReady: questionRows.filter((row) => row.answer_ready).length,
        },
        paperPairs: pairStats,
        completion: getQbankCompletionSummary(),
        breakdown: {
          seedBoards: countBy(
            seedRows.map((row) => row.board || 'Unknown').filter(Boolean) as string[]
          ),
          seedSubjects: countBy(
            seedRows.map((row) => row.subject || 'Unknown').filter(Boolean) as string[]
          ),
          paperBoards: countBy(
            paperRows.map((row) => row.board || 'Unknown').filter(Boolean) as string[]
          ),
          paperSubjects: countBy(
            paperRows.map((row) => row.subject || 'Unknown').filter(Boolean) as string[]
          ),
        },
      },
      {
        headers: { 'x-request-id': requestId },
      }
    )
  } catch (error) {
    logError('qbank_stats_failed', error, {
      request_id: requestId,
      route: '/api/qbank/stats',
    })
    return Response.json(
      { error: 'Something went wrong' },
      { status: 500, headers: { 'x-request-id': requestId } }
    )
  }
}
