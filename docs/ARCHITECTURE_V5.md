# ScholarHAAB V5 Architecture

## Product Shape

ScholarHAAB is one platform with two products:

1. `ScholarHAAB Abroad`
   For Bangladeshi students planning to study abroad with scholarships.

2. `ScholarHAAB QBank`
   For O Level and A Level students who need past-paper solving and guided tutoring.

These products share auth, billing, usage limits, chat infrastructure, feedback, and analytics.
They do not share the same knowledge engine.

## Product Goals

### ScholarHAAB Abroad

The product should help a student:

- understand profile strength
- find realistic scholarships
- compare countries and budget reality
- review SOP, LOR, CV, transcript, and application materials
- understand documents, tests, and visa-related next steps
- get a weekly action plan, not only a chat answer

### ScholarHAAB QBank

The product should help a student:

- solve previous-year questions accurately
- choose between `Direct` and `Tutor` mode
- understand topics through multiple explanation styles
- get checked on whether they truly understood the concept
- find important topics by chapter, year, subject, board, and paper
- spot repeated question patterns and exam trends

## Current Repo Reality

The current codebase already has:

- a branded landing page
- an auth page UI
- a workspace chooser plus separate `Abroad` and `QBank` routes
- product-specific chat API routes
- a configurable provider layer with Gemini-first routing
- a prompt layer
- Supabase client wiring

The current codebase does not yet have:

- real auth enforcement
- usage-limit enforcement
- subscriptions
- RAG
- vector search
- citations
- document upload processing
- scholarship matching
- document review
- QBank paper indexing
- tutor-mode state handling

So the project is a strong shell, but not yet an MVP brain.

## V5 Core Rule

Build `safe and useful` before `smart and impressive`.

That means:

- no user-generated answers auto-added into RAG
- no hard-coded scholarship facts in prompts
- no exact admission probability percentages in MVP
- no high-stakes answer without source and freshness tracking

## System Architecture

### Frontend

Use one Next.js app with separate product workspaces:

- `/` marketing and product selection
- `/auth`
- `/dashboard`
- `/abroad`
- `/qbank`
- `/pricing`
- `/settings`

The current `/chat` route should eventually become product-specific chat workspaces, not a single mixed assistant.

### Shared Platform Layer

Shared across both products:

- Supabase Auth
- profile and tier management
- usage limits
- chat history
- feedback
- file upload storage
- billing
- analytics

### Intelligence Layer

#### Abroad Engine

Main components:

- `profile-parser`
- `scholarship-matcher`
- `verified-retriever`
- `document-reviewer`
- `roadmap-planner`
- `country-cost-guide`

#### QBank Engine

Main components:

- `paper-index`
- `question-retriever`
- `direct-solver`
- `tutor-orchestrator`
- `topic-map`
- `repeat-pattern-analyzer`

## Data Layer

### Abroad Data Tiers

Keep scholarship and study-abroad data in three tiers:

1. `official_live`
   Official university, government, embassy, and scholarship-provider records.
   Safe for live factual answers.

2. `verified_guidance`
   Strong secondary guidance and structured internal notes.
   Safe for advisory support, not for legal claims.

3. `training_proxy`
   YouTube, Hugging Face, web discovery, social discovery, and synthetic behavior data.
   Use for tone, intent patterns, and weak supervision only.

### QBank Data Tiers

Keep academic content in separate layers:

1. `paper_index`
   Board, subject, year, paper, chapter, topic, marks, and question metadata.

2. `question_content`
   Parsed question text and solution references.

3. `tutor_examples`
   Direct-mode solutions and tutor-mode teaching conversations.

## Recommended Database Shape

### Shared Tables

- `profiles`
- `subscriptions`
- `user_daily_usage`
- `chat_sessions`
- `chat_messages`
- `feedback`
- `uploaded_files`

### Abroad Tables

- `abroad_source_records`
- `abroad_chunks_official`
- `abroad_chunks_guidance`
- `scholarship_catalog`
- `document_review_cases`
- `roadmap_templates`

### QBank Tables

- `qbank_papers`
- `qbank_questions`
- `qbank_chunks`
- `qbank_topic_map`
- `qbank_tutor_cases`

## API Shape

### Shared

- `POST /api/auth/*`
- `POST /api/feedback`
- `GET /api/me`
- `GET /api/usage`

### Abroad

- `POST /api/abroad/chat`
- `POST /api/abroad/profile-evaluate`
- `POST /api/abroad/document-review`
- `POST /api/abroad/roadmap`
- `POST /api/abroad/upload`

### QBank

- `POST /api/qbank/chat`
- `POST /api/qbank/solve`
- `POST /api/qbank/topic-search`
- `POST /api/qbank/check-understanding`

Do not keep both products behind a single generic chat route long term.

## Prompt Strategy

Use separate system prompts:

- `abroad_consultant`
- `abroad_document_reviewer`
- `qbank_direct`
- `qbank_tutor`

Prompts should define behavior only.
Facts must come from retrieval or structured data.

## Safety Rules

### Abroad

- factual scholarship, visa, and funding claims must come from retrieval
- answers must show sources or cite the official basis internally
- if freshness is unknown, the assistant should say it must be verified
- document review should be strict, but should not promise acceptance

### QBank

- if the model is unsure, it should say so and reason carefully
- board, paper, and year metadata should come from indexed data
- tutor mode should ask short check questions before moving on
- the assistant should not invent past-paper references

## Monetization

Recommended launch tiers:

- `trial`: 12 questions per day for 7 days
- `pro`: 30 questions per day
- `premium`: 50 questions per day

These limits are reasonable for early API-cost control.

Do not optimize pricing before the product becomes trustworthy.

## MVP Definition

### MVP 1: Abroad

Launch-ready if it can do these well:

- profile-based scholarship matching
- source-backed scholarship answers
- document review for SOP and LOR
- next-step roadmap for the student

### MVP 2: QBank

Launch-ready if it can do these well:

- direct-mode solving
- tutor-mode guided solving
- topic importance by chapter and year
- paper and subject retrieval with accuracy

## Build Order

1. shared auth, usage, and product routing
2. Abroad MVP
3. QBank MVP
4. billing and trial gating
5. deeper evaluator features
6. analytics and feedback loops

## What Not To Build First

Do not start with:

- fancy probability scoring
- full multi-LLM fallback
- auto-learning from user chats
- too many countries at once
- too many school boards at once

Start with the smallest trustworthy slice.

## First Real Build Slice

The next slice should be:

1. split the app into `Abroad` and `QBank`
2. replace the mixed chat route with product-specific routes
3. add real auth/session checks
4. add usage-limit enforcement
5. wire the prompt system by product and mode

That gives the current UI a real platform backbone.
