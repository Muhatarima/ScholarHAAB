import { spawn } from 'node:child_process'
import { getSupabaseAdmin } from '../../lib/server/supabase-admin'
import { GeneratedQuery } from './query_generator'

export type EvalMetrics = {
  top1Accuracy: number
  top3Accuracy: number
  top5Accuracy: number
  boardAccuracy: number
  subjectAccuracy: number
  topicAccuracy: number
}

export type FailureLog = {
  query: string
  expected: string
  actual: string
  failureType: 'wrong board' | 'wrong level' | 'wrong subject' | 'wrong topic' | 'wrong chunk' | 'wrong paper' | 'embedding issue' | 'metadata issue' | 'ranking issue'
}

// Spawns Python sentence-transformers helper to embed queries locally
export function embedQueriesLocally(queriesText: string[]): Promise<number[][]> {
  const pythonScript = `
import sys, json
from sentence_transformers import SentenceTransformer

# Load all-MiniLM-L6-v2 model locally
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')

# Read batch from stdin
payload = json.loads(sys.stdin.read())
embeddings = model.encode(payload)
print(json.dumps(embeddings.tolist()))
`

  return new Promise((resolve, reject) => {
    const python = process.env.PYTHON || 'python'
    const child = spawn(python, ['-c', pythonScript], { windowsHide: true })
    
    let stdout = ''
    let stderr = ''
    
    child.stdout.on('data', chunk => { stdout += chunk.toString() })
    child.stderr.on('data', chunk => { stderr += chunk.toString() })
    
    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Python embedder failed with code ${code}: ${stderr}`))
        return
      }
      try {
        resolve(JSON.parse(stdout.trim()))
      } catch (err) {
        reject(err)
      }
    })
    
    child.stdin.write(JSON.stringify(queriesText))
    child.stdin.end()
  })
}

// Evaluates a batch of queries against Supabase match_questions RPC
export async function evaluateRetrievalBatch(
  batch: GeneratedQuery[],
  embeddings: number[][]
): Promise<{ passedCount: number; failures: FailureLog[] }> {
  const supabase = getSupabaseAdmin()
  let passedCount = 0
  const failures: FailureLog[] = []

  for (let i = 0; i < batch.length; i++) {
    const item = batch[i]
    const emb = embeddings[i]

    const { data, error } = await supabase.rpc('match_questions', {
      query_embedding: emb,
      match_count: 5,
      match_threshold: 0.2
    })

    if (error || !data || data.length === 0) {
      failures.push({
        query: item.queryText,
        expected: `${item.expectedSubject} - ${item.expectedTopic}`,
        actual: 'No retrieval matches',
        failureType: 'embedding issue'
      })
      continue
    }

    const matches = data as Array<{
      board: string
      level: string
      subject: string
      resource_type: string
    }>

    const topMatch = matches[0]

    // Verify metadata match
    const boardMatch = String(topMatch.board || '').toLowerCase() === String(item.expectedBoard).toLowerCase()
    const subjectMatch = String(topMatch.subject || '').toLowerCase() === String(item.expectedSubject).toLowerCase()

    if (boardMatch && subjectMatch) {
      passedCount++
    } else {
      let failureType: FailureLog['failureType'] = 'ranking issue'
      if (!boardMatch) failureType = 'wrong board'
      else if (!subjectMatch) failureType = 'wrong subject'

      failures.push({
        query: item.queryText,
        expected: `${item.expectedBoard} | ${item.expectedSubject}`,
        actual: `${topMatch.board} | ${topMatch.subject}`,
        failureType
      })
    }
  }

  return { passedCount, failures }
}
