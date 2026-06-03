-- ScholarHAAB academic dataset pipeline schema.
-- Safe to run repeatedly. Academic data is public read/no public write; student data is owner-only.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS academic_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL,
  source_name text,
  board text,
  level text,
  subject text,
  year int,
  paper_code text,
  paper_type text,
  license_status text NOT NULL DEFAULT 'unknown',
  allowed_status text NOT NULL DEFAULT 'needs_review',
  notes text,
  checksum text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS papers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_source_id uuid REFERENCES academic_sources(id) ON DELETE SET NULL,
  board text,
  level text,
  subject text,
  year int,
  paper_code text,
  paper_type text,
  source_pdf_url text,
  source_file_path text,
  checksum text UNIQUE,
  download_status text DEFAULT 'not_downloaded',
  parse_status text DEFAULT 'not_parsed',
  db_status text DEFAULT 'not_inserted',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paper_id uuid REFERENCES papers(id) ON DELETE SET NULL,
  board text,
  level text,
  subject text,
  topic text,
  chapter text,
  subtopic text,
  year int,
  paper_code text,
  paper_type text,
  question_number text,
  question_text text,
  marks int,
  difficulty text,
  command_word text,
  question_type text,
  source_pdf_url text,
  source_file_path text,
  checksum text,
  extraction_confidence numeric DEFAULT 0,
  tag_confidence numeric DEFAULT 0,
  embedding vector(384),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS paper_id uuid REFERENCES papers(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS subtopic text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS command_word text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS question_type text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS source_file_path text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS checksum text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS extraction_confidence numeric DEFAULT 0;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS tag_confidence numeric DEFAULT 0;

CREATE TABLE IF NOT EXISTS mark_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text,
  mark_points text[],
  examiner_notes text,
  source_pdf_url text,
  checksum text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS mark_schemes ADD COLUMN IF NOT EXISTS checksum text;

CREATE TABLE IF NOT EXISTS question_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  content text NOT NULL,
  embedding vector(384),
  metadata jsonb DEFAULT '{}'::jsonb,
  checksum text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS formula_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text,
  subject text NOT NULL,
  topic text NOT NULL,
  formula text NOT NULL,
  variables jsonb DEFAULT '{}'::jsonb,
  meaning text,
  units text,
  when_to_use text,
  common_mistakes text,
  example text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS variables jsonb DEFAULT '{}'::jsonb;
ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS when_to_use text;

CREATE TABLE IF NOT EXISTS theory_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text,
  subject text NOT NULL,
  chapter text,
  topic text NOT NULL,
  concept text,
  short_explanation text,
  detailed_explanation text,
  exam_keywords text[],
  misconceptions text[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS concept text;

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  level text NOT NULL,
  subject text NOT NULL,
  chapter text,
  topic text NOT NULL,
  learning_objectives text[],
  specification_ref text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS paper_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text NOT NULL,
  level text NOT NULL,
  subject text NOT NULL,
  topic text NOT NULL,
  chapter text,
  paper_type text,
  question_type text,
  command_word text,
  marks_range int4range,
  years_appeared int[] DEFAULT '{}',
  frequency int DEFAULT 0,
  sample_question_ids uuid[] DEFAULT '{}',
  mark_scheme_keywords text[],
  common_mistakes text[],
  reasoning_pattern text,
  confidence numeric DEFAULT 0,
  common_question_types text[],
  mark_scheme_patterns text[],
  formula_patterns text[],
  command_words text[],
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mark_scheme_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  topic text NOT NULL,
  question_type text,
  command_word text,
  required_points text[],
  optional_points text[],
  common_wrong_answers text[],
  mark_allocation_pattern text[],
  examiner_keywords text[],
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS concept_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text,
  subject text NOT NULL,
  topic text NOT NULL,
  concept text NOT NULL,
  explanation text,
  source_url text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS misconception_bank (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text,
  subject text NOT NULL,
  topic text NOT NULL,
  misconception text NOT NULL,
  correction text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS command_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  command_word text UNIQUE NOT NULL,
  meaning text NOT NULL,
  examiner_expectation text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  level text NOT NULL,
  board text NOT NULL,
  stage text,
  subjects text[] NOT NULL DEFAULT '{}',
  language_preference text NOT NULL DEFAULT 'English',
  explanation_style text NOT NULL DEFAULT 'Step-by-step teacher style',
  setup_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
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

CREATE TABLE IF NOT EXISTS exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level text NOT NULL,
  board text NOT NULL,
  subject text NOT NULL,
  exam_date date NOT NULL,
  paper_type text,
  topic_focus text,
  available_study_minutes int,
  target_grade text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  exam_session_id uuid REFERENCES exam_sessions(id) ON DELETE CASCADE,
  plan_json jsonb NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS academic_sources_lookup_idx ON academic_sources (board, level, subject, year, paper_type);
CREATE INDEX IF NOT EXISTS papers_lookup_idx ON papers (board, level, subject, year, paper_type);
CREATE INDEX IF NOT EXISTS questions_lookup_idx ON questions (board, level, subject, topic, year);
CREATE INDEX IF NOT EXISTS question_chunks_metadata_idx ON question_chunks USING gin (metadata);
CREATE INDEX IF NOT EXISTS mark_schemes_question_idx ON mark_schemes (question_id);
CREATE INDEX IF NOT EXISTS formula_bank_lookup_idx ON formula_bank (level, subject, topic);
CREATE INDEX IF NOT EXISTS theory_bank_lookup_idx ON theory_bank (level, subject, topic);
CREATE INDEX IF NOT EXISTS syllabus_topics_lookup_idx ON syllabus_topics (board, level, subject, topic);
CREATE INDEX IF NOT EXISTS paper_patterns_lookup_idx ON paper_patterns (board, level, subject, paper_type, topic);
CREATE INDEX IF NOT EXISTS mark_scheme_patterns_lookup_idx ON mark_scheme_patterns (subject, topic, question_type, command_word);
CREATE INDEX IF NOT EXISTS user_profiles_user_idx ON user_profiles (user_id);
CREATE INDEX IF NOT EXISTS student_progress_user_idx ON student_progress (user_id, subject, topic);
CREATE INDEX IF NOT EXISTS student_learning_gaps_user_idx ON student_learning_gaps (user_id, status);
CREATE INDEX IF NOT EXISTS mock_attempts_user_created_idx ON mock_attempts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS exam_sessions_user_date_idx ON exam_sessions (user_id, exam_date);
CREATE INDEX IF NOT EXISTS exam_plans_user_created_idx ON exam_plans (user_id, created_at DESC);

ALTER TABLE academic_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mark_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE theory_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mark_scheme_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE concept_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE misconception_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE command_words ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_learning_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read academic sources" ON academic_sources;
CREATE POLICY "Public read academic sources" ON academic_sources FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read papers" ON papers;
CREATE POLICY "Public read papers" ON papers FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read questions" ON questions;
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read mark schemes" ON mark_schemes;
CREATE POLICY "Public read mark schemes" ON mark_schemes FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read question chunks" ON question_chunks;
CREATE POLICY "Public read question chunks" ON question_chunks FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read formula bank" ON formula_bank;
CREATE POLICY "Public read formula bank" ON formula_bank FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read theory bank" ON theory_bank;
CREATE POLICY "Public read theory bank" ON theory_bank FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read syllabus topics" ON syllabus_topics;
CREATE POLICY "Public read syllabus topics" ON syllabus_topics FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read paper patterns" ON paper_patterns;
CREATE POLICY "Public read paper patterns" ON paper_patterns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read mark scheme patterns" ON mark_scheme_patterns;
CREATE POLICY "Public read mark scheme patterns" ON mark_scheme_patterns FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read concept bank" ON concept_bank;
CREATE POLICY "Public read concept bank" ON concept_bank FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read misconception bank" ON misconception_bank;
CREATE POLICY "Public read misconception bank" ON misconception_bank FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read command words" ON command_words;
CREATE POLICY "Public read command words" ON command_words FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users read own profiles" ON user_profiles;
CREATE POLICY "Users read own profiles" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own profiles" ON user_profiles;
CREATE POLICY "Users insert own profiles" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own profiles" ON user_profiles;
CREATE POLICY "Users update own profiles" ON user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own student progress" ON student_progress;
CREATE POLICY "Users read own student progress" ON student_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own student progress" ON student_progress;
CREATE POLICY "Users insert own student progress" ON student_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own student progress" ON student_progress;
CREATE POLICY "Users update own student progress" ON student_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users read own learning gaps" ON student_learning_gaps FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users insert own learning gaps" ON student_learning_gaps FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users update own learning gaps" ON student_learning_gaps FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own mock attempts" ON mock_attempts;
CREATE POLICY "Users read own mock attempts" ON mock_attempts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own mock attempts" ON mock_attempts;
CREATE POLICY "Users insert own mock attempts" ON mock_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own mock attempts" ON mock_attempts;
CREATE POLICY "Users update own mock attempts" ON mock_attempts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own exam sessions" ON exam_sessions;
CREATE POLICY "Users read own exam sessions" ON exam_sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own exam sessions" ON exam_sessions;
CREATE POLICY "Users insert own exam sessions" ON exam_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own exam sessions" ON exam_sessions;
CREATE POLICY "Users update own exam sessions" ON exam_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own exam plans" ON exam_plans;
CREATE POLICY "Users read own exam plans" ON exam_plans FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own exam plans" ON exam_plans;
CREATE POLICY "Users insert own exam plans" ON exam_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own exam plans" ON exam_plans;
CREATE POLICY "Users update own exam plans" ON exam_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
