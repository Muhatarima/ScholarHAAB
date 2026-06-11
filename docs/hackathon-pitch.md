# ScholarHAAB BuildFest Demo Pitch

Track: Education (EdTech)  
Category: AI-Powered Personalized Learning Systems  
Target length: 2:45-3:00 minutes

## One-Sentence Positioning

ScholarHAAB is a database-grounded AI tutor for exam students that turns real past papers, mark schemes, OCR, RAG, and learning analytics into personalized practice for Bangladesh and other emerging markets.

## 3-Minute Video Pitch Format

### 0:00-0:30 — Problem: The Vibe

**What to show:** Bangladesh classroom, student studying with paper/photo, crowded coaching context, exam anxiety.

**Script:**

> In Bangladesh, millions of students prepare for board and international exams under the same pressure: crowded classrooms, expensive private tutors, and one-size-fits-all study advice. A student may know they are weak in physics or chemistry, but they do not know exactly which question pattern, mark-scheme keyword, or topic gap is hurting their score. Globally, this is the same problem across emerging markets: learning support is not personalized, not always affordable, and not available when the student actually needs it.

**Key message:** This problem matters because exam success is still tied to access, not ability.

### 0:30-1:00 — Solution

**What to show:** ScholarHAAB landing/dashboard/solver quick cuts.

**Script:**

> ScholarHAAB solves this by becoming a personalized AI exam tutor. Students can ask a doubt in chat, upload a question image, generate a mock test from real past papers, and compare their answer against real mark schemes. The difference is that assessment is database-first: questions and solutions come from actual past-paper content, while AI explains, validates, and adapts the learning path. So it does not feel like a generic chatbot. It feels like a tutor that understands the exam.

**Key message:** Real exam data plus AI tutoring, not generic AI text.

### 1:00-2:00 — Demo / Concept Flow

**What to show:** Three fast product flows.

**Script:**

> Let me show the flow. First, in Solver, the student types a question or uploads a photo. OCR extracts the text, the system retrieves relevant academic context, and the LLM explains the answer step by step in a clean chat interface.
>
> Second, in Mock Test mode, the student chooses subject, topic, and number of questions. The system queries the database for real past-paper questions on that topic. The student answers one question at a time, just like an exam. After submission, the answer is checked against the actual mark scheme, showing correct or incorrect, matched points, missing points, and the mark-scheme solution.
>
> Third, in Exam Mode, students can browse real past-paper questions and reveal the mark scheme when they are ready. This helps them practice exam logic instead of passively reading notes.

**Key message:** Input -> database/RAG/AI -> exam-aligned output.

### 2:00-2:30 — AI Approach

**What to show:** Architecture diagram: OCR, Supabase documents, pgvector, Gemini/Groq, progress analytics.

**Script:**

> Technically, ScholarHAAB uses Supabase with indexed academic documents and pgvector. For open-ended solving, it uses RAG retrieval with vector search and keyword fallback. For exam and mock test flows, it uses direct metadata filters so real questions and mark schemes remain the source of truth. Gemini is the primary model and Groq is the fallback, with retries and timeouts for reliability. The personalization layer uses profile data, conversations, mock attempts, weak topics, and skipped topics to adapt what the student should practice next.

**Key message:** This is real AI thinking: retrieval, source truth, failover, and personalization.

### 2:30-3:00 — Impact & Next Step

**What to show:** KPI slide, Bangladesh -> emerging markets map, next milestones.

**Script:**

> The impact goal is simple: improve topic accuracy by 20 to 35 percent through repeated mark-scheme practice, reduce dropout from difficult topics, and make high-quality exam guidance accessible beyond expensive tutoring. We are building for Bangladesh first, with Bangla localization, low-bandwidth mode, teacher dashboards, and micro-credentials next. ScholarHAAB can scale because the engine is modular: add a curriculum, add question data, add language support, and the same personalized learning system can serve students across emerging markets.

**Key message:** We can build and scale this into a world-class EdTech AI system.

## Shorter 2.3-Minute Pitch Version

> In Bangladesh and across emerging markets, exam success often depends on access to private tutors. Students sit in crowded classrooms, use generic notes, and still do not know exactly which topic, question pattern, or mark-scheme keyword is costing them marks.
>
> ScholarHAAB is an AI-powered personalized exam tutor built to fix that. A student can type a doubt, upload a photo of a question, practice real past-paper questions, and get feedback against real mark schemes. The key difference is that assessment is database-first: questions and solutions come from actual past-paper content. AI is used to explain, validate equivalent answers, and personalize the next step.
>
> Here is the flow. In Solver, the student chats like ChatGPT or uploads an image. OCR reads the question, RAG retrieves relevant academic context, and Gemini or Groq explains the answer step by step. In Mock Test mode, the student selects subject, topic, and number of questions. The system pulls real questions from the database, shows them one by one, then checks the answer against the stored mark scheme. In Exam Mode, students browse real questions and reveal the mark scheme only when they are ready.
>
> Under the hood, ScholarHAAB uses Next.js, Supabase, pgvector, direct database filters, RAG retrieval, Gemini primary, Groq fallback, Tesseract OCR, and learning analytics. The personalization engine tracks profile, topic attempts, weak areas, skipped topics, and mock performance.
>
> Our impact target is a 20 to 35 percent improvement in topic accuracy after repeated practice, better retention on difficult chapters, and affordable personalized tutoring for students who cannot access premium coaching. We start with Bangladesh, then scale to other exam-heavy markets with Bangla localization, low-bandwidth mode, teacher dashboards, and modular curriculum packs. ScholarHAAB is not just a chatbot. It is exam intelligence infrastructure for personalized learning.

## Demo Shot List

1. Landing page and brand: 3 seconds.
2. Login/dashboard: 5 seconds.
3. Solver text question: 15 seconds.
4. Solver image upload: 10 seconds.
5. Mock Test: choose subject/topic/count: 10 seconds.
6. Mock Test: answer and mark-scheme feedback: 20 seconds.
7. Exam Mode: real question list and mark scheme reveal: 15 seconds.
8. Architecture slide: 15 seconds.
9. Impact and roadmap slide: 15 seconds.

## Evaluator Checklist Mapping

- Clear problem and user: Bangladesh exam students, global emerging markets.
- AI-native approach: OCR, RAG, LLM failover, metadata retrieval, analytics.
- Basic system flow: input -> OCR/RAG/DB -> LLM/validation -> output.
- Initial demo: deployed web app.
- Bangla/localization consideration: planned Bangla mode and rural-first low-bandwidth design.
- Defined impact: accuracy improvement, dropout reduction, certification, teacher reach.

