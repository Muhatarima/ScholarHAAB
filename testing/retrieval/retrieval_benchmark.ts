import fs from 'node:fs'
import path from 'node:path'
import { generateTestQueries } from './query_generator'
import { embedQueriesLocally, evaluateRetrievalBatch, FailureLog } from './retrieval_evaluator'

export async function runRetrievalBenchmark(queryCount = 5000) {
  console.log(`Generating ${queryCount} test queries...`)
  const queries = generateTestQueries(queryCount)
  
  const batchSize = 250
  let passedTotal = 0
  const allFailures: FailureLog[] = []
  
  console.log(`Starting evaluation in batches of ${batchSize}...`)
  for (let i = 0; i < queries.length; i += batchSize) {
    const chunk = queries.slice(i, i + batchSize)
    const texts = chunk.map(q => q.queryText)
    
    try {
      const embeddings = await embedQueriesLocally(texts)
      const { passedCount, failures } = await evaluateRetrievalBatch(chunk, embeddings)
      passedTotal += passedCount
      allFailures.push(...failures)
      console.log(`Processed ${Math.min(i + batchSize, queries.length)} / ${queries.length}. Batch accuracy: ${Math.round((passedCount / chunk.length) * 100)}%`)
    } catch (error) {
      console.error(`Error processing batch starting at index ${i}:`, error)
    }
  }

  const accuracy = queries.length ? Math.round((passedTotal / queries.length) * 10000) / 100 : 0
  
  const report = {
    generatedAt: new Date().toISOString(),
    totalQueries: queries.length,
    passedQueries: passedTotal,
    accuracy,
    failuresCount: allFailures.length,
    failures: allFailures.slice(0, 100) // Keep sample of failures
  }

  const resultDir = path.resolve(process.cwd(), 'test-results')
  if (!fs.existsSync(resultDir)) {
    fs.mkdirSync(resultDir, { recursive: true })
  }

  fs.writeFileSync(
    path.join(resultDir, 'retrieval_benchmark_report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  )

  console.log(`Retrieval Benchmark complete. Accuracy: ${accuracy}%`)
  return report
}
