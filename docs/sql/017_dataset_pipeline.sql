CREATE TABLE IF NOT EXISTS qbank_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_hash TEXT UNIQUE NOT NULL,
  board TEXT NOT NULL,
  level TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_code TEXT,
  topic TEXT,
  subtopic TEXT,
  year INTEGER,
  session TEXT,
  paper_number INTEGER,
  question_number INTEGER,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  worked_solution TEXT,
  marks INTEGER,
  question_type TEXT,
  formulas_used JSONB DEFAULT '[]',
  concepts_used JSONB DEFAULT '[]',
  reasoning_steps JSONB DEFAULT '[]',
  common_mistakes JSONB DEFAULT '[]',
  exam_tips JSONB DEFAULT '[]',
  difficulty TEXT,
  source TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_score FLOAT,
  verification_notes TEXT,
  needs_review BOOLEAN DEFAULT FALSE,
  enriched BOOLEAN DEFAULT FALSE,
  embedding vector(768),
  embedding_model TEXT DEFAULT 'text-embedding-004',
  embedding_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS formula_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT,
  formula_text TEXT NOT NULL,
  latex TEXT,
  variables JSONB,
  conditions TEXT,
  level TEXT,
  board TEXT,
  source TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_score FLOAT,
  embedding vector(768),
  embedding_model TEXT DEFAULT 'text-embedding-004',
  embedding_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS concept_bank (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject TEXT NOT NULL,
  topic TEXT,
  concept_name TEXT NOT NULL,
  definition TEXT,
  explanation TEXT,
  examples JSONB DEFAULT '[]',
  common_mistakes JSONB DEFAULT '[]',
  exam_tips JSONB DEFAULT '[]',
  level TEXT,
  board TEXT,
  source TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_score FLOAT,
  embedding vector(768),
  embedding_model TEXT DEFAULT 'text-embedding-004',
  embedding_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS review_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_data JSONB NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  collected INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  auto_fixed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  needs_review INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_qbank_board_level_subject ON qbank_chunks(board, level, subject);
CREATE INDEX IF NOT EXISTS idx_qbank_year ON qbank_chunks(year);
CREATE INDEX IF NOT EXISTS idx_qbank_verified ON qbank_chunks(verified);
CREATE INDEX IF NOT EXISTS idx_qbank_embedding ON qbank_chunks USING hnsw(embedding vector_cosine_ops)
  WITH (m=16, ef_construction=64);
CREATE INDEX IF NOT EXISTS idx_formula_embedding ON formula_bank USING hnsw(embedding vector_cosine_ops)
  WITH (m=16, ef_construction=64);
CREATE INDEX IF NOT EXISTS idx_concept_embedding ON concept_bank USING hnsw(embedding vector_cosine_ops)
  WITH (m=16, ef_construction=64);
