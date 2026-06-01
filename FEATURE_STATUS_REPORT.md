# ScholarHAAB Feature Status Report

Generated before implementation pass.

## Core Feature Checklist

| Feature | Status | Notes |
| --- | --- | --- |
| `/solver` chat input | PARTIALLY WORKING | Uses `ProductChatShell` and `/api/qbank`; needs clean structured `/api/solve` contract and profile filters. |
| Past paper search | PARTIALLY WORKING | Supabase RAG search exists; profile-aware board/level/subject filtering is not consistently applied. |
| Verified answer badge | PARTIALLY WORKING | Confidence labels exist; needs stricter source/mark-scheme gate for `VERIFIED`. |
| Mark scheme retrieval | PARTIALLY WORKING | Mark scheme text/points are returned when present in search rows; missing dedicated retrieval adapter. |
| AI reasoning fallback | WORKING | Falls back to AI reasoning with warning for no verified context. |
| Exam mode form | PARTIALLY WORKING | UI exists but plan generation is mostly local/static and not saved as exam session/plan. |
| Exam plan generation | PARTIALLY WORKING | `/api/exam-prep` exists; no dedicated `/api/exam-plan` contract for the pitch flow. |
| Skipped chapter detection | PARTIALLY WORKING | Universal understanding and topic tracking detect gaps; no dedicated learning-gaps table adapter yet. |
| Banglish/typo handling | PARTIALLY WORKING | Gemini/local understanding exists; missing deterministic reusable `normalizeQuery`/`classifyIntent` modules. |
| Dashboard data loading | PARTIALLY WORKING | Loads progress dashboard; falls back to demo weak topics for empty users. |
| Dashboard empty state | PARTIALLY WORKING | Some empty states exist; dashboard should make clear weak topics are auto-detected. |
| Progress tracking | PARTIALLY WORKING | Attempts and topic performance exist; missing simpler top-level `/api/progress` contract. |
| Auth login/register/logout | WORKING | Supabase auth and Google OAuth path exist. |
| Protected routing | WORKING | Middleware protects solver/dashboard/exam/qbank. Setup route not yet included. |
| Supabase security | PARTIALLY WORKING | RLS file exists for older tables; needs user profile, topic progress, learning gaps, exam sessions, mock attempts, academic dataset policies. |
| RAG retrieval logic | PARTIALLY WORKING | Supabase RAG active with text fallback; needs source-safe adapter for solver API. |
| Gemini fallback | WORKING | Resilient model fallback and deterministic fallback exist. |
| `/demo3` preview page | WORKING | Cinematic preview is separate from real product routes. |
| `/setup` | NOT WORKING | Route missing. |
| `/mock` | NOT WORKING | Route missing; backend generator exists under `/api/mock/generate`. |
| `/settings/profile` | NOT WORKING | Route missing. |
| `/api/solve` | NOT WORKING | Route missing. |
| `/api/exam-plan` | NOT WORKING | Route missing. |
| `/api/progress` | NOT WORKING | Top-level route missing. |
| `/api/search-papers` | NOT WORKING | Route missing. |

