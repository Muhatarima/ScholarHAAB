const REQUIRED_SERVER = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'GEMINI_API_KEY',
  'CRON_SECRET',
  'NEXT_PUBLIC_SUPABASE_URL',
] as const

const REQUIRED_PUBLIC = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'NEXT_PUBLIC_URL',
] as const

function isMissing(key: string) {
  return !process.env[key]?.trim()
}

export function validateEnv() {
  const missing: string[] = []

  if (typeof window === 'undefined') {
    for (const key of REQUIRED_SERVER) {
      if (isMissing(key)) {
        missing.push(key)
      }
    }
  }

  for (const key of REQUIRED_PUBLIC) {
    if (isMissing(key)) {
      missing.push(key)
    }
  }

  if (missing.length === 0) {
    return
  }

  throw new Error(
    '\n\n' +
      '+--------------------------------------+\n' +
      '|  MISSING REQUIRED ENV VARS           |\n' +
      '+--------------------------------------+\n' +
      missing.map((key) => `|  x ${key.padEnd(34)}|`).join('\n') +
      '\n+--------------------------------------+\n' +
      '|  Add these to .env.local             |\n' +
      '+--------------------------------------+\n'
  )
}
