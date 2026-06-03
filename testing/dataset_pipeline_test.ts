import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()

const requiredPaths = [
  'dataset/README.md',
  'dataset/raw/cambridge/o-level/.gitkeep',
  'dataset/raw/cambridge/a-level/.gitkeep',
  'dataset/raw/edexcel/o-level/.gitkeep',
  'dataset/raw/edexcel/a-level/.gitkeep',
  'scripts/discover_sources.ts',
  'scripts/download_papers.ts',
  'scripts/build_manifest.ts',
  'scripts/audit_coverage.ts',
  'scripts/extract_pdf_text.ts',
  'scripts/tag_topics.ts',
  'scripts/embed_dataset.ts',
  'scripts/extract_patterns.ts',
  'supabase/migrations/20260603_academic_dataset_pipeline.sql',
]

const migration = fs.readFileSync(path.join(root, 'supabase/migrations/20260603_academic_dataset_pipeline.sql'), 'utf8')
const migrationMustContain = [
  'CREATE TABLE IF NOT EXISTS academic_sources',
  'CREATE TABLE IF NOT EXISTS papers',
  'CREATE TABLE IF NOT EXISTS questions',
  'CREATE TABLE IF NOT EXISTS mark_schemes',
  'CREATE TABLE IF NOT EXISTS question_chunks',
  'CREATE TABLE IF NOT EXISTS paper_patterns',
  'CREATE TABLE IF NOT EXISTS mark_scheme_patterns',
  'CREATE POLICY "Public read questions"',
  'CREATE POLICY "Users read own student progress"',
  'CREATE POLICY "Users read own exam plans"',
]

const failures: string[] = []
for (const requiredPath of requiredPaths) {
  if (!fs.existsSync(path.join(root, requiredPath))) failures.push(`Missing ${requiredPath}`)
}
for (const needle of migrationMustContain) {
  if (!migration.includes(needle)) failures.push(`Migration missing: ${needle}`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(JSON.stringify({
  status: 'ok',
  checkedFiles: requiredPaths.length,
  checkedMigrationRules: migrationMustContain.length,
}, null, 2))
