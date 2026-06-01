# ScholarHAAB Feature Status Report

Generated before this implementation pass from the current codebase.

## Core Feature Checklist

| Feature | Status | Notes |
| --- | --- | --- |
| `/solver` chat input | WORKING | Uses `ProductChatShell`; text requests go through `/api/solve`, attachments through `/api/qbank/chat`. |
| Past paper search | PARTIALLY WORKING | Supabase RAG exists and `/api/search-papers` exists, but `/api/search-papers` was not using the saved study profile as a default filter. |
| Verified answer badge | WORKING | `/api/solve` gates `verified` through similarity, real source metadata, and mark scheme presence. |
| Mark scheme retrieval | WORKING | `retrieveMarkSchemeFromResult` returns mark scheme text/points/source from retrieved rows. |
| AI reasoning fallback | WORKING | `calculateConfidence` returns `ai_reasoning` with a clear warning when exact/verified source is missing. |
| Exam mode form | PARTIALLY WORKING | Functional form and API existed, but UI did not prefill level/board/subjects from profile and target grade was missing. |
| Exam plan generation | WORKING | `/api/exam-plan` analyzes past papers, returns structured plan, and saves exam sessions/plans when tables are available. |
| Skipped chapter detection | PARTIALLY WORKING | Intent detection and learning-gap table writes existed, but skipped chapters did not also raise `student_topic_progress.weak_score`. |
| Banglish/typo handling | PARTIALLY WORKING | Deterministic normalization exists; needed extra `bujhi na` support and profile-aware search flow. |
| Dashboard data loading | PARTIALLY WORKING | Dashboard UI loads legacy `/api/progress/dashboard`; missing pitch-level `/api/dashboard` endpoint and new learning-gap/auto-progress merge. |
| Dashboard empty state | WORKING | Empty states tell new users weak topics are detected automatically. |
| Progress tracking | PARTIALLY WORKING | `/api/solve` updates auto topic progress; skipped gap tracking needed to update weak-topic signal too. |
| Auth login/register/logout | WORKING | Supabase auth pages/actions exist; app shell logout signs out and redirects. |
| Protected routing | WORKING | Middleware protects `/solver`, `/dashboard`, `/exam-mode`, `/mock`, `/settings`, `/setup`, `/qbank`, etc. |
| Supabase security | WORKING | RLS SQL exists for user profiles, topic progress, learning gaps, exam sessions/plans, mock attempts, and public-read academic datasets. |
| RAG retrieval logic | WORKING | `searchSimilarQuestions` uses Supabase vector/text fallback and strict confidence adapter in `/api/solve`. |
| Gemini fallback | WORKING | Solver uses deterministic fallback plus resilient Gemini call for non-fast-path answers. |
| `/demo3` preview page | WORKING | Preview page exists separately from real product flows. |
| `/setup` | WORKING | Stable study profile only: level, board, stage, subjects, language, explanation style. |
| `/settings/profile` | WORKING | Reuses stable profile form; does not edit weak topics, skipped topics, or exam dates. |
| `/api/solve` | WORKING | Validates input, classifies intent, retrieves verified data, falls back safely, and tracks progress. |
| `/api/exam-plan` | WORKING | Validates input, analyzes papers, generates/saves structured plan. |
| `/api/progress` | WORKING | Requires auth and returns dashboard data; POST updates topic progress. |
| `/api/search-papers` | PARTIALLY WORKING | Needs profile filter defaults and out-of-profile warning. |
| `/api/dashboard` | NOT WORKING | Route missing; needed for pitch contract and dashboard data merge. |

## Fix Targets For This Pass

- Add `/api/dashboard` to return stable profile, auto topic progress, learning gaps, recent exam sessions/plans, and today focus.
- Make `/dashboard` consume `/api/dashboard` and show skipped chapters from `student_learning_gaps`.
- Make profile GET/PUT include/update stable setup fields from `user_profiles`.
- Make setup safe in demo/dev auth bypass without attempting invalid UUID writes.
- Make skipped chapter detection also increase weak-topic signal.
- Make Exam Mode prefill from user profile and include target grade.
- Make `/api/search-papers` use profile board/level/subjects by default.
