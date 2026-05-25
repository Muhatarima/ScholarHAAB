# ScholarHAAB Codex Prompts Extract

Source file: `C:\Users\User\Downloads\ScholarHAAB_Codex_Prompts.docx`

This is a cleaned, searchable extraction of the DOCX prompt pack. The pack is focused on backend optimization for ScholarHAAB: token cost control, caching, limits, file handling, and security.

## Document Header

- Title: `ScholarHAAB Codex Prompts — Backend Optimization`
- Theme: `Token Cost · Quality · Caching · Limits · Security`
- Instruction: copy one prompt at a time into Codex and test before moving to the next

## Prompt Index

| Prompt | What it builds | Intended files |
| --- | --- | --- |
| 1 | Token-optimized AI service with smart routing | `lib/ai-service.ts` |
| 2 | Tier-aware token limits enforcer | `lib/usage.ts` |
| 3 | Smart answer cache | `lib/cache.ts` + SQL |
| 4 | Optimized system prompts | `lib/prompts.ts` |
| 5 | Main chat API route wiring | `app/api/chat/route.ts` |
| 6 | File input handler for image/PDF/DOC | `app/api/chat/route.ts` update |
| 7 | Usage tracking and SQL schema | SQL files / Supabase |
| 8 | Security hardening | `lib/security.ts` + `middleware.ts` |

## Project Context Stated In The DOCX

- ScholarHAAB is described as a `Next.js 14 TypeScript` app
- Data/backend: `Supabase`
- Primary AI: `Gemini 2.0 Flash`
- Payments: `SSLCommerz`
- Frontend stack: `Next.js App Router` + `Tailwind CSS`

## Prompt 1 — Token-Optimized AI Service

Goal in the document:

- Build `lib/ai-service.ts`
- Export a single main function:
  - `generateResponse(prompt, systemPrompt, maxOutputTokens): Promise<string>`
- Provider order:
  - primary: Gemini 2.0 Flash
  - fallback: GPT-4o mini
  - emergency: Groq Llama 3
- Temperature:
  - `0.3`
- Log:
  - provider used
  - estimated input token count
- Throw:
  - `Error('All AI providers failed')` if every provider fails

## Prompt 2 — Tier-Aware Token Limits

Goal in the document:

- Build `lib/usage.ts`
- Define tier limits for:
  - `trial`
  - `pro`
  - `premium`
  - `expired`
- Use:
  - `profiles`
  - `subscriptions`
  - `user_daily_usage`
- Required functions:
  - `getUserTier`
  - `getDailyUsage`
  - `getLimit`
  - `checkLimit`
  - `incrementUsage`
  - `estimateTokens`
- Enforce:
  - daily question caps
  - daily token budgets
  - tier-aware output token limits

## Prompt 3 — Smart Answer Cache

Goal in the document:

- Create SQL for `cached_answers`
- Build `lib/cache.ts`
- Required features:
  - question normalization
  - hash-based cache key
  - skip caching for personal/profile-specific questions
  - TTL by product/content
  - cache hit / miss logging
- Intended benefit:
  - repeated questions should cost zero model tokens

## Prompt 4 — Optimized System Prompts

Goal in the document:

- Replace `lib/prompts.ts`
- Export:
  - `PromptMode = 'direct' | 'tutor'`
  - `getSystemPrompt(product, mode)`
- Two major prompt families:
  - scholarship
  - qbank
- Required behavior:
  - concise output
  - direct answer first
  - `VERIFIED / INFERRED / CHECK YOURSELF` framing for scholarship answers
  - strong Direct vs Tutor Mode split for QBank
- Scholarship prompt embeds a small verified scholarship knowledge base directly in the system prompt

## Prompt 5 — Main Chat API Route

Goal in the document:

- Replace `app/api/chat/route.ts`
- One route should do, in order:
  1. input validation
  2. daily limit check
  3. cache lookup
  4. tier-based output token limit selection
  5. prompt creation
  6. AI call
  7. cache write
  8. usage write
  9. response return
- Includes:
  - message sanitization
  - `message.length` cap
  - simple `product` / `mode` routing
  - generic error handling

## Prompt 6 — File Input Handler

Goal in the document:

- Extend `app/api/chat/route.ts` to accept:
  - `fileBase64`
  - `fileType`
  - `fileName`
- Supported file classes:
  - image
  - PDF
  - DOC/DOCX
- Expected handling:
  - images and PDFs go directly to Gemini multipart input
  - DOC/DOCX is text-extracted with `mammoth`
- Add:
  - 8 MB file size cap
  - supported MIME whitelist
  - skip cache when file is attached

## Prompt 7 — Usage Tracking & SQL

Goal in the document:

- Create SQL schema for:
  - `user_daily_usage`
  - `profiles`
  - `subscriptions`
  - `chat_history`
- Add:
  - RLS policies
  - signup trigger that auto-creates a profile
- Use date-based daily resets instead of a cron reset job

## Prompt 8 — Security Hardening

Goal in the document:

- Create `lib/security.ts`
- Add:
  - HTML/script sanitization
  - auth validation via Supabase JWT
  - simple in-memory rate limiting by user/action/minute
- Update API route to:
  - require auth
  - enforce rate limits
  - sanitize message before processing
- Add `middleware.ts` to attach security headers on `/api/*`

## Execution Order In The DOCX

The document recommends this sequence:

1. SQL schema
2. `lib/usage.ts`
3. `lib/cache.ts`
4. `lib/prompts.ts`
5. `lib/ai-service.ts`
6. `app/api/chat/route.ts`
7. `lib/security.ts` + middleware
8. file input updates

## Key Observation

This prompt pack is a **backend simplification and optimization playbook**, not a full product spec. It is much narrower than the larger ScholarHAAB architecture prompt packs. It focuses on:

- cheaper inference
- cleaner request flow
- repeat-question caching
- subscription/usage enforcement
- lightweight file ingestion
- basic security hardening
