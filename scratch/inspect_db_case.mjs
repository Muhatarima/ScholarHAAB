import { createClient } from '@supabase/supabase-js'
import path from 'path'
import fs from 'fs'

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      const parts = trimmed.split('=')
      const key = parts[0].trim()
      const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '')
      process.env[key] = value
    }
  })
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

async function run() {
  console.log('Querying database case-insensitive overview...')

  // Fetch unique boards, levels, resource_types, subjects, years
  // Let's do a select limit 1000 and collect all unique values
  let uniqueBoards = new Set()
  let uniqueLevels = new Set()
  let uniqueSubjects = new Set()
  let uniqueResourceTypes = new Set()
  let uniqueYears = new Set()

  const { data, error } = await supabase
    .from('questions')
    .select('board, level, subject, resource_type, year')
    .limit(10000)

  if (error) {
    console.error('Error fetching questions:', error)
    return
  }

  for (const row of data) {
    if (row.board) uniqueBoards.add(row.board)
    if (row.level) uniqueLevels.add(row.level)
    if (row.subject) uniqueSubjects.add(row.subject)
    if (row.resource_type) uniqueResourceTypes.add(row.resource_type)
    if (row.year) uniqueYears.add(row.year)
  }

  console.log('Unique boards seen in first 10k:', Array.from(uniqueBoards))
  console.log('Unique levels seen in first 10k:', Array.from(uniqueLevels))
  console.log('Unique subjects seen in first 10k:', Array.from(uniqueSubjects))
  console.log('Unique resource types seen in first 10k:', Array.from(uniqueResourceTypes))
  console.log('Unique years seen in first 10k:', Array.from(uniqueYears))
}

run()
