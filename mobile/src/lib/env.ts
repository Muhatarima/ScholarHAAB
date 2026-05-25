function requireEnv(key: string) {
  const value = process.env[key]?.trim()
  if (!value) {
    throw new Error(`Missing required mobile env var: ${key}`)
  }
  return value
}

export const mobileEnv = {
  supabaseUrl: requireEnv('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: requireEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY'),
  apiBaseUrl: requireEnv('EXPO_PUBLIC_API_BASE_URL').replace(/\/+$/, ''),
}
