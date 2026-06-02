-- ScholarHAAB academic knowledge base and mock-attempt schema.
-- Safe to run multiple times in Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text,
  level text,
  subject text,
  topic text,
  chapter text,
  year int,
  paper_code text,
  paper_type text,
  question_number text,
  question_text text,
  marks int,
  difficulty text,
  source_pdf_url text,
  embedding vector
);

ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS chapter text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS paper_code text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS paper_type text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS question_number text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS difficulty text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS source_pdf_url text;

CREATE TABLE IF NOT EXISTS mark_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text,
  mark_points text[],
  examiner_notes text,
  source_pdf_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS mark_schemes ADD COLUMN IF NOT EXISTS examiner_notes text;
ALTER TABLE IF EXISTS mark_schemes ADD COLUMN IF NOT EXISTS source_pdf_url text;

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  level text NOT NULL,
  subject text NOT NULL,
  chapter text,
  topic text NOT NULL,
  learning_objectives text[],
  specification_ref text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formula_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text,
  subject text NOT NULL,
  topic text NOT NULL,
  formula text NOT NULL,
  meaning text,
  units text,
  common_mistakes text,
  example text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS theory_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text,
  subject text NOT NULL,
  chapter text,
  topic text NOT NULL,
  short_explanation text,
  detailed_explanation text,
  exam_keywords text[],
  misconceptions text[],
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paper_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  level text NOT NULL,
  subject text NOT NULL,
  paper_type text,
  topic text NOT NULL,
  frequency int DEFAULT 0,
  years_appeared int[] DEFAULT '{}',
  common_question_types text[],
  mark_scheme_patterns text[],
  formula_patterns text[],
  command_words text[],
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  level text,
  board text,
  subject text NOT NULL,
  topic text NOT NULL,
  attempted_count int DEFAULT 0,
  correct_count int DEFAULT 0,
  wrong_count int DEFAULT 0,
  accuracy numeric DEFAULT 0,
  weak_score numeric DEFAULT 0,
  mastery_score numeric DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_learning_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  level text,
  board text,
  subject text,
  skipped_topic text,
  skipped_chapter text,
  current_topic text,
  detected_from_message text,
  detection_count int DEFAULT 1,
  status text DEFAULT 'active',
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mock_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  level text,
  board text,
  subject text NOT NULL,
  topic text NOT NULL,
  score int DEFAULT 0,
  total_marks int DEFAULT 0,
  feedback_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_learning_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  weak_topics text[] DEFAULT '{}',
  skipped_chapters text[] DEFAULT '{}',
  misconceptions text[] DEFAULT '{}',
  repeated_mistakes jsonb DEFAULT '[]'::jsonb,
  preferred_explanation_style text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_lookup_idx ON questions (board, level, subject, topic, year);
CREATE INDEX IF NOT EXISTS mark_schemes_question_idx ON mark_schemes (question_id);
CREATE INDEX IF NOT EXISTS formula_bank_lookup_idx ON formula_bank (level, subject, topic);
CREATE INDEX IF NOT EXISTS theory_bank_lookup_idx ON theory_bank (level, subject, topic);
CREATE INDEX IF NOT EXISTS paper_patterns_lookup_idx ON paper_patterns (board, level, subject, paper_type, topic);
CREATE INDEX IF NOT EXISTS mock_attempts_user_created_idx ON mock_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS student_learning_memory_user_idx ON student_learning_memory (user_id);

ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mark_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS formula_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS theory_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS paper_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_learning_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_learning_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read questions" ON questions;
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read mark schemes" ON mark_schemes;
CREATE POLICY "Public read mark schemes" ON mark_schemes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read syllabus topics" ON syllabus_topics;
CREATE POLICY "Public read syllabus topics" ON syllabus_topics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read formula bank" ON formula_bank;
CREATE POLICY "Public read formula bank" ON formula_bank FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read theory bank" ON theory_bank;
CREATE POLICY "Public read theory bank" ON theory_bank FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read paper patterns" ON paper_patterns;
CREATE POLICY "Public read paper patterns" ON paper_patterns FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users read own mock attempts" ON mock_attempts;
CREATE POLICY "Users read own mock attempts" ON mock_attempts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own mock attempts" ON mock_attempts;
CREATE POLICY "Users insert own mock attempts" ON mock_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own mock attempts" ON mock_attempts;
CREATE POLICY "Users update own mock attempts" ON mock_attempts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own learning memory" ON student_learning_memory;
CREATE POLICY "Users read own learning memory" ON student_learning_memory FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own learning memory" ON student_learning_memory;
CREATE POLICY "Users insert own learning memory" ON student_learning_memory FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own learning memory" ON student_learning_memory;
CREATE POLICY "Users update own learning memory" ON student_learning_memory FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
