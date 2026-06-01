CREATE TABLE IF NOT EXISTS questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text,
  level text,
  subject text,
  topic text,
  year integer,
  paper_code text,
  question_number text,
  question_text text,
  marks integer,
  embedding vector(384),
  source_pdf_url text
);

CREATE TABLE IF NOT EXISTS mark_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES questions(id),
  answer_text text,
  mark_points jsonb DEFAULT '[]'::jsonb,
  source_pdf_url text
);

CREATE TABLE IF NOT EXISTS student_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  subject text,
  topic text,
  accuracy numeric DEFAULT 0,
  solved_count integer DEFAULT 0,
  weak_score numeric DEFAULT 0,
  skipped boolean DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exam_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  subject text,
  level text,
  exam_date date,
  plan_json jsonb DEFAULT '{}'::jsonb
);
