# LLM Provider Setup

## Goal

Keep Gemini 2.0 Flash as the cheap default today, but make provider switching mostly a config change later.

## Current Design

The app uses a provider router in [`lib/ai-service.ts`](C:/Users/User/scholorhaab/lib/ai-service.ts).

Supported providers:

- `gemini`
- `openai`
- `openai_compatible`

Provider order is controlled by environment variables, not hard-coded deep into the app.

## Recommended Default

For the lowest-cost setup right now:

- primary provider: `gemini`
- model: `gemini-2.0-flash`
- concise output budgets by product/mode

## Environment Variables

Use these in `.env.local` when needed:

```env
AI_PROVIDER_ORDER=gemini,openai,openai_compatible
AI_DEFAULT_MAX_TOKENS=480

GEMINI_MODEL=gemini-2.0-flash
GEMINI_API_KEY=your_key

OPENAI_MODEL=gpt-5-nano
OPENAI_API_KEY=your_key

OPENAI_COMPAT_BASE_URL=https://api.groq.com/openai/v1
OPENAI_COMPAT_MODEL=llama-3.1-8b-instant
OPENAI_COMPAT_API_KEY=your_key
```

## Cheapest Switching Plan

If Google changes pricing or shuts down Gemini 2.0 Flash:

1. keep the app code the same
2. change `AI_PROVIDER_ORDER`
3. add the backup provider key
4. set the backup model name

Example:

```env
AI_PROVIDER_ORDER=openai,gemini,openai_compatible
OPENAI_MODEL=gpt-5-nano
```

That is enough for a provider swap because the routing already lives in one place.

## Cost Rules

The app is already designed to reduce cost by:

- keeping answers concise by default
- using small output budgets by product and mode
- avoiding long default completions
- keeping provider logic centralized

Do not increase token budgets globally unless quality truly requires it.

## Fallback Behavior

- normal text chat already falls through the configured provider order
- multipart chat now does too
- if Gemini fails on a file-backed request, backup text providers can still answer from the extracted text and prompt when available
- image-only or PDF-only requests still work best on Gemini because the backup providers do not receive the raw inline file parts
