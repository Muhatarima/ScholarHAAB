CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS past_papers (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  level TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_code TEXT,
  year INTEGER NOT NULL,
  session TEXT NOT NULL,
  paper TEXT NOT NULL,
  paper_type TEXT NOT NULL,
  file_path TEXT,
  total_questions INTEGER DEFAULT 0,
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  board TEXT NOT NULL,
  level TEXT NOT NULL,
  subject TEXT NOT NULL,
  subject_code TEXT,
  year INTEGER NOT NULL,
  session TEXT NOT NULL,
  paper TEXT NOT NULL,
  question_number TEXT NOT NULL,
  part TEXT,
  question_text TEXT NOT NULL,
  question_text_clean TEXT,
  has_diagram BOOLEAN DEFAULT FALSE,
  diagram_description TEXT,
  marks INTEGER,
  mark_scheme TEXT,
  mark_scheme_points JSONB DEFAULT '[]',
  mark_scheme_clean TEXT,
  topic TEXT,
  subtopic TEXT,
  difficulty TEXT,
  keywords JSONB DEFAULT '[]',
  command_word TEXT,
  question_type TEXT,
  embedding vector(1536),
  confidence_score FLOAT DEFAULT 1.0,
  needs_review BOOLEAN DEFAULT FALSE,
  review_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pipeline_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase TEXT,
  board TEXT,
  level TEXT,
  subject TEXT,
  year INTEGER,
  session TEXT,
  paper TEXT,
  status TEXT,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_embedding
  ON questions USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_questions_subject_year
  ON questions(subject, year, level, board);

CREATE INDEX IF NOT EXISTS idx_questions_topic
  ON questions(subject, topic, difficulty);

CREATE INDEX IF NOT EXISTS idx_questions_board_level
  ON questions(board, level);

CREATE OR REPLACE FUNCTION match_questions(
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter_subject text DEFAULT NULL,
  filter_level text DEFAULT NULL,
  filter_board text DEFAULT NULL,
  filter_topic text DEFAULT NULL,
  filter_year_from int DEFAULT NULL,
  filter_year_to int DEFAULT NULL
)
RETURNS TABLE (
  id text,
  board text,
  level text,
  subject text,
  subject_code text,
  year int,
  session text,
  paper text,
  question_number text,
  part text,
  question_text text,
  marks int,
  mark_scheme text,
  mark_scheme_points jsonb,
  topic text,
  subtopic text,
  difficulty text,
  has_diagram boolean,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    q.id,
    q.board,
    q.level,
    q.subject,
    q.subject_code,
    q.year,
    q.session,
    q.paper,
    q.question_number,
    q.part,
    q.question_text,
    q.marks,
    q.mark_scheme,
    q.mark_scheme_points,
    q.topic,
    q.subtopic,
    q.difficulty,
    q.has_diagram,
    1 - (q.embedding <=> query_embedding) AS similarity
  FROM questions q
  WHERE q.embedding IS NOT NULL
    AND (filter_subject IS NULL OR q.subject = filter_subject)
    AND (filter_level IS NULL OR q.level = filter_level)
    AND (filter_board IS NULL OR q.board = filter_board)
    AND (filter_topic IS NULL OR q.topic = filter_topic)
    AND (filter_year_from IS NULL OR q.year >= filter_year_from)
    AND (filter_year_to IS NULL OR q.year <= filter_year_to)
    AND 1 - (q.embedding <=> query_embedding) > 0.5
  ORDER BY q.embedding <=> query_embedding
  LIMIT match_count;
$$;
