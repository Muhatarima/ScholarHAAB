# ScholarHAAB Figma Design Spec

This spec is written so the project can be recreated quickly in Figma for demo, handoff, or investor-style storytelling. The visual direction should feel premium, exam-serious, and fast, not like a generic AI chatbot.

## Product Positioning

ScholarHAAB is an AI-powered personalized learning system for Bangladesh-first exam preparation. It combines real past-paper questions, official mark-scheme answers, RAG retrieval, image upload, adaptive difficulty, and learning analytics in one cloud-native product.

Primary users:

- Secondary and higher-secondary students preparing for Cambridge, IGCSE, O Level, AS/A Level, and local board-style exams.
- Tutors and teachers who need question generation, mock tests, and weakness tracking.
- Rural or low-bandwidth learners who need structured help without depending on expensive coaching.

## Design Principles

- Database first: screens should emphasize real questions, mark schemes, and verified sources.
- No AI noise: avoid labels like confidence score, retrieved evidence, partial match, or observation.
- Chat when useful, exam mode when serious: the solver feels like ChatGPT; mock tests feel like a real exam.
- Bangladesh first, globally scalable: include Bangla/localization affordances without making the product feel local-only.
- Fast cognitive scanning: students should instantly know what to answer, where feedback appears, and what to do next.

## Design Tokens

Canvas:

- App background: `#02020C`
- Deep violet surface: `#10071F`
- Elevated surface: `#151023`
- Divider: `#2A1846`
- Input border: `#3A2360`

Brand:

- Primary violet: `#9B4DFF`
- Primary gradient start: `#7434D8`
- Primary gradient end: `#B65CFF`
- Logo violet: `#C084FC`
- Focus ring: `#A78BFA`

Text:

- Primary text: `#F5F1FF`
- Secondary text: `#C8C0DF`
- Muted text: `#8F86A8`
- Inverse text: `#FFFFFF`

Status:

- Correct: `#86EFAC`
- Correct surface: `#062019`
- Incorrect: `#FCA5A5`
- Warning/mark scheme: `#FACC15`
- Info: `#7DD3FC`

Typography:

- Interface font: Inter, Geist, or Satoshi.
- Logo accent: letter-spaced serif for `SCHOLAR`, bold geometric sans for `HAAB`.
- H1 desktop: 72 px / 1.0 line height.
- H1 mobile: 44 px / 1.05 line height.
- Section heading: 28-36 px.
- Body: 16-18 px / 1.6 line height.
- Compact UI: 14-15 px.

Spacing:

- Base grid: 8 px.
- Desktop content max width: 1180 px.
- Chat content max width: 1080 px.
- Sidebar width: 300 px desktop.
- Border radius: 8 px for cards and panels, 999 px for pills only.

## Figma Frames

Create these frames:

1. `00 Cover / Brand Promise`
   - Size: 1440 x 900.
   - Full dark background with subtle star field.
   - Logo top-left.
   - H1: `ScholarHAAB`
   - Subhead: `Real past papers. Real mark schemes. Personalized AI learning.`
   - Three proof chips: `RAG + LLM`, `Database-first mock tests`, `Bangla-ready`.

2. `01 Solver / Chat Interface`
   - Size: 1440 x 900.
   - Left sidebar with logo, `New chat +`, recent sessions.
   - Top nav: Direct, Tutor, Credits, Exam Mode, Solver, Dashboard, Mock Test, Question Generator, Profile.
   - Main thread with alternating user and assistant messages.
   - Composer fixed at bottom with upload icon, placeholder `Type a question or upload an image...`, and send button.
   - Assistant response includes clean answer, formula rendering, and one source card only when a real source exists.

3. `02 Mock Test / Database First`
   - Size: 1440 x 900.
   - Inputs: Subject, Topic, Number of questions.
   - Primary action: `Generate Mock Test`.
   - Question viewer with progress `Question 3 of 10`.
   - Answer textarea and `Submit Answer`.
   - Feedback panel after submit: `Correct`, `Mark scheme`, `Step-by-step solution`.
   - Copy must make clear: questions and solutions come from stored past-paper chunks.

4. `03 Exam Mode / Past Paper Priorities`
   - Size: 1440 x 900.
   - Filters: Subject, Board, Topic.
   - Results list of real past-paper questions.
   - Mark scheme expandable drawer.
   - No confidence badges, no retrieved-evidence language, no AI analysis labels.

5. `04 Adaptive Mode / Personalization`
   - Size: 1440 x 900.
   - Student profile panel: target exam, weak topics, recent score.
   - Adaptive queue: easy, medium, hard progression.
   - Mastery graph by topic.
   - Recommendation text: `Next: electricity calculations, 4-mark structured answers`.

6. `05 Dashboard / Learning Analytics`
   - Size: 1440 x 900.
   - KPI row: accuracy, weak topics fixed, mock-test score trend, study streak.
   - Topic heatmap.
   - Recent attempts table.
   - Teacher/copilot panel for future classroom deployment.

7. `06 Mobile Solver`
   - Size: 390 x 844.
   - Bottom composer, collapsible nav, readable chat bubbles.
   - Demonstrate low-bandwidth layout: minimal images, text-first, cached responses.

8. `07 Pitch Flow / System Architecture`
   - Size: 1440 x 900.
   - Diagram: Input -> OCR/Text -> Query Router -> Supabase documents/pgvector -> LLM validator/explainer -> Student output -> analytics.
   - Place this frame in the video deck as the technical explanation scene.

## Core Components

### App Shell

- Sidebar appears on desktop and collapses behind a menu button on mobile.
- Top nav is sticky with transparent dark blur.
- Active nav pill uses violet border and subtle fill.

### Chat Message

- User bubble: right aligned, violet gradient, max width 720 px.
- Assistant block: left aligned, no heavy card around long answers.
- Formula blocks render with KaTeX and should never show raw `\ce{}` unless chemistry syntax is intentionally supported.

### Composer

- Height: 76 px desktop, 64 px mobile.
- Upload button uses a paperclip icon.
- Send button uses an arrow icon inside a violet circle.
- Drag-and-drop state uses violet focus ring.

### Question Card

- Contains source metadata, question text, marks, answer input, and submit action.
- Uses official-looking hierarchy: question number, marks, prompt, answer area.
- Mark scheme appears only after submission or when explicitly opened.

### Feedback

- Correct state: green outline pill plus concise explanation.
- Incorrect state: red outline pill plus mark-scheme correction.
- Never use confidence percentage as a student-facing trust signal.

### Source Card

- Only displayed when a real source record exists.
- Label: `Verified source`.
- Metadata: board, subject, year, paper, file name.
- Avoid `Retrieved evidence` and `Based on S1`.

## Prototype Flow

Connect the frames in this order:

1. Cover -> Solver.
2. Solver send button -> Assistant response state.
3. Solver nav `Mock Test` -> Mock Test.
4. Mock Test `Generate Mock Test` -> Question viewer.
5. Question viewer `Submit Answer` -> Feedback state.
6. Mock Test nav `Dashboard` -> Dashboard.
7. Dashboard `Adaptive practice` -> Adaptive Mode.
8. Adaptive Mode `Architecture` hotspot -> Pitch Flow.

## Demo Copy

Use this copy in the clickable prototype:

- Solver user prompt: `Cambridge IGCSE Physics: explain why current decreases when resistance increases`
- Assistant answer start: `Current decreases when resistance increases because resistance opposes the flow of charge.`
- Mock test setup: `Physics / Electricity / 5 questions`
- Feedback title: `Correct - 3 of 4 marking points matched`
- Mark scheme title: `Official mark scheme`
- Dashboard insight: `Your weakest topic is electricity calculations. Next practice set: medium, 4-mark structured answers.`

## Accessibility And Localization

- Minimum body contrast ratio target: 4.5:1.
- Do not depend on color alone for correct/incorrect; pair color with text and icon.
- Keep all controls reachable by keyboard.
- Support English and Bangla labels in the same component width.
- For low-bandwidth mode, hide decorative star density and prioritize text, cached past-paper chunks, and compact formulas.

## Figma Export Checklist

- Export cover frame as `scholarhaab-cover.png`.
- Export solver, mock test, and dashboard frames for pitch deck screenshots.
- Create component variants for chat message, feedback state, source card, and question card.
- Name layers semantically for developer handoff.
- Keep tokens in a `Local variables` collection named `ScholarHAAB Brand`.
