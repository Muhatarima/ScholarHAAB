━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SCHOLARHAAB — COMPLETE .env.local TEMPLATE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# ── SUPABASE ─────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://[ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...           # safe for client
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # SERVER ONLY — never expose

# ── AI PROVIDERS (only GEMINI required, rest optional) ──
GEMINI_API_KEY=AIza...                         # PRIMARY — required
OPENAI_API_KEY=sk-...                          # FALLBACK — optional
GROQ_API_KEY=gsk_...                           # FALLBACK — optional

# ── PAYMENTS ─────────────────────────────────────
SSLCOMMERZ_STORE_ID=scholarhaab
SSLCOMMERZ_STORE_PASSWORD=...
SSLCOMMERZ_IS_LIVE=false                       # true in production

# ── EMAIL ────────────────────────────────────────
RESEND_API_KEY=re_...

# ── CRON SECURITY ────────────────────────────────
CRON_SECRET=generate-a-random-64-char-string-here

# ── APP ──────────────────────────────────────────
NEXT_PUBLIC_URL=https://scholarhaab.com        # no trailing slash
NEXT_PUBLIC_APP_NAME=ScholarHAAB

# ── MONITORING ───────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...                          # for source maps upload

# ── FEATURE FLAGS ────────────────────────────────
NEXT_PUBLIC_ENABLE_WHATSAPP=false
NEXT_PUBLIC_ENABLE_STUDY_GROUPS=false
NEXT_PUBLIC_ENABLE_PUBLIC_API=false

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERCEL ENVIRONMENT VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In Vercel Dashboard → Project → Settings → Environment Variables,
add ALL of the above. Mark these as Production + Preview + Development:

CRITICAL: These must be set in Vercel (not just .env.local):
  GEMINI_API_KEY          ← without this, the app is broken
  SUPABASE_SERVICE_ROLE_KEY ← without this, auth fails
  SSLCOMMERZ_STORE_ID     ← without this, payments fail
  CRON_SECRET             ← without this, anyone can trigger crons
  NEXT_PUBLIC_URL         ← must be your actual domain
