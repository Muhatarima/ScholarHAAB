CREATE EXTENSION IF NOT EXISTS vector;

-- This migration is intentionally self-healing. Some production databases
-- received the academic pipeline migration before these layer tables existed,
-- so create the app-facing profile/progress tables here as well.
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
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, level, board, subject, topic)
);

CREATE TABLE IF NOT EXISTS student_learning_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  level text NOT NULL,
  board text NOT NULL,
  subject text,
  skipped_chapter text NOT NULL,
  current_topic text,
  detected_from_message text,
  detection_count int DEFAULT 1,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS student_learning_gaps_unique_active_idx
  ON student_learning_gaps (user_id, level, board, skipped_chapter, COALESCE(current_topic, ''));

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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS academic_sources ADD COLUMN IF NOT EXISTS source_type text;

ALTER TABLE IF EXISTS academic_sources ADD COLUMN IF NOT EXISTS allowed_status text DEFAULT 'needs_review';

ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS board text;

ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS chapter text;

ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS subtopic text;

ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS embedding extensions.vector(384);

ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS board text;

ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS chapter text;

ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS subtopic text;

ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS embedding extensions.vector(384);

ALTER TABLE IF EXISTS syllabus_topics ADD COLUMN IF NOT EXISTS board text;

ALTER TABLE IF EXISTS syllabus_topics ADD COLUMN IF NOT EXISTS chapter text;

ALTER TABLE IF EXISTS syllabus_topics ADD COLUMN IF NOT EXISTS subtopic text;

ALTER TABLE IF EXISTS syllabus_topics ADD COLUMN IF NOT EXISTS embedding extensions.vector(384);

ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS board text;

ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS chapter text;

ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS subtopic text;

ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS embedding extensions.vector(384);

ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS chunk_index integer;

ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS embedding extensions.vector(384);
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS board text;
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS chapter text;
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS subtopic text;
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS content text DEFAULT '';
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS chunk_type text DEFAULT 'public_dataset';
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS license text DEFAULT 'unknown';
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS quality_score integer DEFAULT 0;
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS allowed_status text DEFAULT 'needs_review';
ALTER TABLE IF EXISTS public_education_chunks ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Indexes for vector columns
CREATE INDEX IF NOT EXISTS idx_formula_embedding ON formula_bank USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_theory_embedding ON theory_bank USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_syllabus_embedding ON syllabus_topics USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_misconception_embedding ON misconception_bank USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_public_education_embedding ON public_education_chunks USING ivfflat (embedding extensions.vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_public_education_lookup ON public_education_chunks (board, level, subject, topic);
CREATE INDEX IF NOT EXISTS idx_student_topic_progress_lookup ON student_topic_progress (user_id, level, board, subject, topic);
CREATE INDEX IF NOT EXISTS idx_student_learning_gaps_lookup ON student_learning_gaps (user_id, status);

-- Enable RLS and policies
ALTER TABLE IF EXISTS academic_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS formula_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS theory_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS misconception_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public_education_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS concept_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_learning_gaps ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policies
DROP POLICY IF EXISTS "Public read academic sources" ON academic_sources;
CREATE POLICY "Public read academic sources" ON academic_sources FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read formula bank" ON formula_bank;
CREATE POLICY "Public read formula bank" ON formula_bank FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read theory bank" ON theory_bank;
CREATE POLICY "Public read theory bank" ON theory_bank FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read syllabus topics" ON syllabus_topics;
CREATE POLICY "Public read syllabus topics" ON syllabus_topics FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read misconception bank" ON misconception_bank;
CREATE POLICY "Public read misconception bank" ON misconception_bank FOR SELECT USING (true);



DROP POLICY IF EXISTS "Public read public education chunks" ON public_education_chunks;
CREATE POLICY "Public read public education chunks" ON public_education_chunks FOR SELECT USING (true);

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

-- Public write remains denied by default because no INSERT/UPDATE/DELETE policies are defined.
