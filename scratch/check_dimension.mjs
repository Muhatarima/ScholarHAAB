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
  const { data, error } = await supabase
    .from('questions')
    .select('id, embedding')
    .not('embedding', 'is', null)
    .limit(1)

  if (error) {
    console.error('Error fetching questions:', error)
    return
  }

  if (data && data.length > 0) {
    const emb = data[0].embedding
    if (typeof emb === 'string') {
      const parsed = JSON.parse(emb)
      console.log('Embedding parsed length:', parsed.length)
    } else if (Array.isArray(emb)) {
      console.log('Embedding array length:', emb.length)
    } else {
      console.log('Embedding type:', typeof emb, emb)
    }
  } else {
    console.log('No rows with non-null embeddings found')
  }
}

run()
