━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-DEPLOY CHECKLIST (run before every production deploy)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ENVIRONMENT:
□ All .env.local vars present in Vercel dashboard
□ SSLCOMMERZ_IS_LIVE=true in production environment
□ NEXT_PUBLIC_URL=https://scholarhaab.com (no trailing slash)
□ NODE_ENV=production confirmed in Vercel

DATABASE:
□ All migrations run: node scripts/migrate.js (or Supabase SQL editor)
□ pgvector extension enabled: CREATE EXTENSION IF NOT EXISTS vector;
□ HNSW indexes exist: SELECT * FROM pg_indexes WHERE indexname LIKE 'idx_%embedding%';
□ Connection pooler URL used (port 6543, not 5432)
□ RLS policies enabled on: user_profiles, transactions, credit_ledger
□ Backup enabled in Supabase Dashboard (requires Pro plan)

QA:
□ npm run qa → all 12 tests pass, average score 100
□ Math latency confirmed < 200ms (no retrieval on GENERAL_KNOWLEDGE)
□ No banned phrases in any test response

SECURITY:
□ No .env.local committed to git: git status | grep .env → empty
□ No API keys in client bundle: grep -r "GEMINI\|SERVICE_ROLE" .next/ → empty
□ Rate limiting active: test with 5 rapid requests → 5th blocked
□ Input validation active: 3001-char message → rejected

PAYMENTS:
□ SSLCommerz sandbox test completed (test card: 4111111111111111)
□ IPN webhook URL registered in SSLCommerz dashboard
□ Credit deduction tested: send message → credits_left decreases by 1

MONITORING:
□ Sentry DSN configured → test error appears in Sentry dashboard
□ UptimeRobot monitoring /api/health every 5 minutes
□ Admin dashboard loads: /admin (with your admin account)

PERFORMANCE:
□ Lighthouse mobile score > 80 (run: npx lighthouse https://scholarhaab.com)
□ /api/health returns 200 with correct DB + AI status
