-- ScholarHAAB core product profile/progress schema.
-- Run this in Supabase SQL editor.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) UNIQUE NOT NULL,
  level text NOT NULL,
  board text NOT NULL,
  stage text,
  subjects text[] NOT NULL DEFAULT '{}',
  language_preference text NOT NULL DEFAULT 'English',
  explanation_style text NOT NULL DEFAULT 'Step-by-step teacher style',
  setup_completed boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS student_topic_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
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
  last_practiced_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE (user_id, level, board, subject, topic)
);

CREATE TABLE IF NOT EXISTS student_learning_gaps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  level text NOT NULL,
  board text NOT NULL,
  subject text,
  skipped_chapter text NOT NULL,
  current_topic text,
  detected_from_message text,
  detection_count int DEFAULT 1,
  status text DEFAULT 'active',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  UNIQUE (user_id, level, board, skipped_chapter, current_topic)
);

CREATE TABLE IF NOT EXISTS exam_sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  level text NOT NULL,
  board text NOT NULL,
  subject text NOT NULL,
  exam_date date NOT NULL,
  paper_type text,
  topic_focus text,
  available_study_minutes int,
  target_grade text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_plans (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  exam_session_id uuid REFERENCES exam_sessions(id),
  plan_json jsonb NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mock_attempts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  level text,
  board text,
  subject text,
  topic text,
  score numeric DEFAULT 0,
  total_marks numeric DEFAULT 0,
  feedback_json jsonb DEFAULT '{}',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  board text,
  level text,
  subject text,
  chapter text,
  topic text,
  learning_objectives text[],
  specification_ref text
);

CREATE TABLE IF NOT EXISTS formula_bank (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  level text,
  subject text,
  topic text,
  formula text,
  meaning text,
  units text,
  common_mistakes text,
  example text
);

CREATE TABLE IF NOT EXISTS theory_bank (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  level text,
  subject text,
  chapter text,
  topic text,
  short_explanation text,
  detailed_explanation text,
  exam_keywords text[],
  misconceptions text[]
);

CREATE TABLE IF NOT EXISTS paper_patterns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  board text,
  level text,
  subject text,
  paper_type text,
  topic text,
  frequency int DEFAULT 0,
  years_appeared int[] DEFAULT '{}',
  common_question_types text[],
  mark_scheme_patterns text[]
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_learning_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE formula_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE theory_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE paper_patterns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users select own user profile" ON user_profiles;
CREATE POLICY "Users select own user profile" ON user_profiles FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own user profile" ON user_profiles;
CREATE POLICY "Users insert own user profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own user profile" ON user_profiles;
CREATE POLICY "Users update own user profile" ON user_profiles FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own topic progress" ON student_topic_progress;
CREATE POLICY "Users select own topic progress" ON student_topic_progress FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own topic progress" ON student_topic_progress;
CREATE POLICY "Users insert own topic progress" ON student_topic_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own topic progress" ON student_topic_progress;
CREATE POLICY "Users update own topic progress" ON student_topic_progress FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users select own learning gaps" ON student_learning_gaps FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users insert own learning gaps" ON student_learning_gaps FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users update own learning gaps" ON student_learning_gaps FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own exam sessions" ON exam_sessions;
CREATE POLICY "Users select own exam sessions" ON exam_sessions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own exam sessions" ON exam_sessions;
CREATE POLICY "Users insert own exam sessions" ON exam_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own exam sessions" ON exam_sessions;
CREATE POLICY "Users update own exam sessions" ON exam_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own exam plans" ON exam_plans;
CREATE POLICY "Users select own exam plans" ON exam_plans FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own exam plans" ON exam_plans;
CREATE POLICY "Users insert own exam plans" ON exam_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own exam plans" ON exam_plans;
CREATE POLICY "Users update own exam plans" ON exam_plans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own mock attempts" ON mock_attempts;
CREATE POLICY "Users select own mock attempts" ON mock_attempts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own mock attempts" ON mock_attempts;
CREATE POLICY "Users insert own mock attempts" ON mock_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own mock attempts" ON mock_attempts;
CREATE POLICY "Users update own mock attempts" ON mock_attempts FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public read syllabus topics" ON syllabus_topics;
CREATE POLICY "Public read syllabus topics" ON syllabus_topics FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read formula bank" ON formula_bank;
CREATE POLICY "Public read formula bank" ON formula_bank FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read theory bank" ON theory_bank;
CREATE POLICY "Public read theory bank" ON theory_bank FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read paper patterns" ON paper_patterns;
CREATE POLICY "Public read paper patterns" ON paper_patterns FOR SELECT USING (true);
