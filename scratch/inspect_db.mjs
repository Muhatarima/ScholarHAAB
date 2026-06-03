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
  // Get distinct boards
  const { data: boards } = await supabase.rpc('match_questions', {
    query_embedding: Array(768).fill(0),
    match_threshold: -1,
    match_count: 1
  }).select('board') // wait, match_questions might not work with 0 vector, let's query questions directly.
  
  // To avoid fetching too much, let's query questions table with select
  // We can fetch fields in batches or query distinct using JS since we can select multiple fields for a sample of, say, 2000 rows, or do a group by.
  // Wait, Supabase client allows select. We can do pagination or use postgres queries.
  // But wait, can we run SQL queries using RPC or inspect questions directly?
  // Let's write a simple script that selects 'board, level, subject, year, resource_type' and aggregates them in JS! We can do pagination to get, say, 5000 rows or use supabase's select with limits.
  // Wait! Let's do multiple queries for counts of unique combinations.
  
  console.log('Querying database overview...')
  
  // Let's get distinct boards, levels, subjects, resource_types, years.
  // Since questions might have many rows, let's do a few simple queries.
  
  // Let's count by board:
  const boardsList = ['Cambridge', 'Edexcel', 'General']
  for (const b of boardsList) {
    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('board', b)
    console.log(`Board [${b}]: ${count} rows`)
  }

  // Let's count by level:
  const levelsList = ['O Level', 'A Level', 'General']
  for (const l of levelsList) {
    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('level', l)
    console.log(`Level [${l}]: ${count} rows`)
  }

  // Let's count by resource_type:
  const resourceTypes = [
    'examiner_report', 'question_paper', 'confidential_instructions',
    'mark_scheme', 'other', 'concept', 'ms', 'qp', 'sy', 'textbook',
    'concept_guide', 'unified_concept'
  ]
  for (const rt of resourceTypes) {
    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('resource_type', rt)
    if (count > 0) {
      console.log(`Resource [${rt}]: ${count} rows`)
    }
  }

  // Let's count by subject:
  const subjectsList = [
    'Physics', 'Chemistry', 'Biology', 'Mathematics', 'Economics',
    'Accounting', 'Business', 'ICT', 'Computer Science', 'English'
  ]
  for (const s of subjectsList) {
    const { count } = await supabase.from('questions').select('*', { count: 'exact', head: true }).eq('subject', s)
    if (count > 0) {
      console.log(`Subject [${s}]: ${count} rows`)
    }
  }
}

run()
