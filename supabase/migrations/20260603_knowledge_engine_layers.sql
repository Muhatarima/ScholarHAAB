CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE IF EXISTS academic_sources ADD COLUMN IF NOT EXISTS source_type text;
ALTER TABLE IF EXISTS academic_sources ADD COLUMN IF NOT EXISTS allowed_status text DEFAULT 'needs_review';

ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS board text;
ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS chapter text;
ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS subtopic text;
ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES academic_sources(id);
ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS embedding vector(384);
ALTER TABLE IF EXISTS formula_bank ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS board text;
ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS subtopic text;
ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS common_misconceptions text[];
ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS examiner_tip text;
ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES academic_sources(id);
ALTER TABLE IF EXISTS theory_bank ADD COLUMN IF NOT EXISTS embedding vector(384);

ALTER TABLE IF EXISTS syllabus_topics ADD COLUMN IF NOT EXISTS subtopic text;
ALTER TABLE IF EXISTS syllabus_topics ADD COLUMN IF NOT EXISTS command_words text[];
ALTER TABLE IF EXISTS syllabus_topics ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES academic_sources(id);
ALTER TABLE IF EXISTS syllabus_topics ADD COLUMN IF NOT EXISTS embedding vector(384);

CREATE TABLE IF NOT EXISTS concept_graph (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board text,
  level text,
  subject text NOT NULL,
  concept text NOT NULL,
  prerequisite_concepts text[] DEFAULT '{}'::text[],
  dependent_concepts text[] DEFAULT '{}'::text[],
  related_topics text[] DEFAULT '{}'::text[],
  difficulty text,
  source_id uuid REFERENCES academic_sources(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS board text;
ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS exam_warning text;
ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS example text;
ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES academic_sources(id);
ALTER TABLE IF EXISTS misconception_bank ADD COLUMN IF NOT EXISTS embedding vector(384);

ALTER TABLE IF EXISTS command_words ADD COLUMN IF NOT EXISTS board text;
ALTER TABLE IF EXISTS command_words ADD COLUMN IF NOT EXISTS level text;
ALTER TABLE IF EXISTS command_words ADD COLUMN IF NOT EXISTS expected_answer_style text;
ALTER TABLE IF EXISTS command_words ADD COLUMN IF NOT EXISTS mark_scheme_expectation text;
ALTER TABLE IF EXISTS command_words ADD COLUMN IF NOT EXISTS example text;

CREATE TABLE IF NOT EXISTS public_education_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES academic_sources(id),
  board text,
  level text,
  subject text,
  chapter text,
  topic text,
  content text NOT NULL,
  chunk_type text,
  license text,
  embedding vector(384),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS concept_graph_lookup_idx ON concept_graph (board, level, subject, concept);
CREATE INDEX IF NOT EXISTS misconception_bank_lookup_v2_idx ON misconception_bank (board, level, subject, topic);
CREATE INDEX IF NOT EXISTS public_education_chunks_lookup_idx ON public_education_chunks (board, level, subject, topic);

ALTER TABLE concept_graph ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_education_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read concept graph" ON concept_graph;
CREATE POLICY "Public read concept graph" ON concept_graph FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read public education chunks" ON public_education_chunks;
CREATE POLICY "Public read public education chunks" ON public_education_chunks FOR SELECT USING (true);

-- Public write remains denied by default because no INSERT/UPDATE/DELETE policies are defined.
