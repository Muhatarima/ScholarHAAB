CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Repair migration for production projects where an earlier knowledge-layer
-- migration was marked applied before public_education_chunks/profile tables
-- existed. Everything here is idempotent so it is safe to re-run.

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

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS board text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS stage text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS subjects text[] DEFAULT '{}';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS language_preference text DEFAULT 'English';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS explanation_style text DEFAULT 'Step-by-step teacher style';
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS setup_completed boolean DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE TABLE IF NOT EXISTS student_topic_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level text NOT NULL,
  board text NOT NULL,
  subject text NOT NULL,
  topic text NOT NULL,
  attempted_count int DEFAULT 0,
  correct_count int DEFAULT 0,
  wrong_count int DEFAULT 0,
  accuracy numeric DEFAULT 0,
  confidence_score numeric DEFAULT 0,
  weak_score numeric DEFAULT 0,
  last_practiced_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS level text DEFAULT 'O Level';
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS board text DEFAULT 'Cambridge';
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS subject text DEFAULT 'Physics';
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS topic text DEFAULT 'General';
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS attempted_count int DEFAULT 0;
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS correct_count int DEFAULT 0;
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS wrong_count int DEFAULT 0;
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS accuracy numeric DEFAULT 0;
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0;
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS weak_score numeric DEFAULT 0;
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS last_practiced_at timestamptz;
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE student_topic_progress ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS student_topic_progress_user_scope_idx
  ON student_topic_progress (user_id, level, board, subject, topic);

CREATE TABLE IF NOT EXISTS student_learning_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level text NOT NULL,
  board text NOT NULL,
  subject text,
  skipped_chapter text,
  current_topic text,
  detected_from_message text,
  detection_count int DEFAULT 1,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS level text DEFAULT 'O Level';
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS board text DEFAULT 'Cambridge';
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS skipped_chapter text;
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS skipped_topic text;
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS current_topic text;
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS detected_from_message text;
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS detection_count int DEFAULT 1;
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE student_learning_gaps ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

UPDATE student_learning_gaps
SET skipped_chapter = COALESCE(skipped_chapter, skipped_topic)
WHERE skipped_chapter IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS student_learning_gaps_user_scope_idx
  ON student_learning_gaps (user_id, level, board, COALESCE(skipped_chapter, ''), COALESCE(current_topic, ''));

CREATE TABLE IF NOT EXISTS public_education_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid,
  board text,
  level text,
  subject text,
  chapter text,
  topic text,
  subtopic text,
  content text NOT NULL DEFAULT '',
  chunk_type text DEFAULT 'public_dataset',
  license text DEFAULT 'unknown',
  quality_score integer DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  allowed_status text DEFAULT 'needs_review',
  metadata jsonb DEFAULT '{}'::jsonb,
  chunk_index integer,
  embedding extensions.vector(384),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text,
  level text,
  subject text,
  topic text,
  chapter text,
  year integer,
  paper_code text,
  paper_type text,
  question_number text,
  question_text text,
  content text,
  marks integer,
  resource_type text,
  source_pdf_url text,
  embedding extensions.vector(384),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mark_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES questions(id) ON DELETE CASCADE,
  answer_text text,
  mark_points jsonb DEFAULT '[]'::jsonb,
  examiner_notes text,
  source_pdf_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS source_id uuid;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS board text;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS chapter text;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS subtopic text;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS content text DEFAULT '';
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS chunk_type text DEFAULT 'public_dataset';
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS license text DEFAULT 'unknown';
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 0;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS allowed_status text DEFAULT 'needs_review';
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS chunk_index integer;
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS embedding extensions.vector(384);
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE public_education_chunks ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS board text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS chapter text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS paper_type text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS paper_code text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS question_number text;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS marks integer;
ALTER TABLE IF EXISTS questions ADD COLUMN IF NOT EXISTS source_pdf_url text;

ALTER TABLE IF EXISTS mark_schemes ADD COLUMN IF NOT EXISTS mark_points jsonb DEFAULT '[]'::jsonb;
ALTER TABLE IF EXISTS mark_schemes ADD COLUMN IF NOT EXISTS examiner_notes text;
ALTER TABLE IF EXISTS mark_schemes ADD COLUMN IF NOT EXISTS source_pdf_url text;

CREATE INDEX IF NOT EXISTS idx_public_education_lookup
  ON public_education_chunks (board, level, subject, topic);
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_lookup
  ON student_topic_progress (user_id, level, board, subject, topic);
CREATE INDEX IF NOT EXISTS idx_student_learning_gaps_lookup
  ON student_learning_gaps (user_id, status);

CREATE INDEX IF NOT EXISTS idx_public_education_embedding
  ON public_education_chunks USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_learning_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_education_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mark_schemes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own user profiles" ON user_profiles;
CREATE POLICY "Users read own user profiles" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own user profiles" ON user_profiles;
CREATE POLICY "Users insert own user profiles" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own user profiles" ON user_profiles;
CREATE POLICY "Users update own user profiles" ON user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own student topic progress" ON student_topic_progress;
CREATE POLICY "Users read own student topic progress" ON student_topic_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own student topic progress" ON student_topic_progress;
CREATE POLICY "Users insert own student topic progress" ON student_topic_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own student topic progress" ON student_topic_progress;
CREATE POLICY "Users update own student topic progress" ON student_topic_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own student learning gaps" ON student_learning_gaps;
CREATE POLICY "Users read own student learning gaps" ON student_learning_gaps FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own student learning gaps" ON student_learning_gaps;
CREATE POLICY "Users insert own student learning gaps" ON student_learning_gaps FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own student learning gaps" ON student_learning_gaps;
CREATE POLICY "Users update own student learning gaps" ON student_learning_gaps FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public read public education chunks" ON public_education_chunks;
CREATE POLICY "Public read public education chunks" ON public_education_chunks FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read questions" ON questions;
CREATE POLICY "Public read questions" ON questions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read mark schemes" ON mark_schemes;
CREATE POLICY "Public read mark schemes" ON mark_schemes FOR SELECT USING (true);
