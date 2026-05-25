-- Final deployment RLS policies for ScholarHAAB.
-- Run this in Supabase SQL Editor before Vercel production traffic.

ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_topic_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_prep_sessions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'questions'
      AND policyname = 'Allow public read on questions'
  ) THEN
    CREATE POLICY "Allow public read on questions"
    ON questions FOR SELECT
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'student_topic_performance'
      AND policyname = 'Users read own performance'
  ) THEN
    CREATE POLICY "Users read own performance"
    ON student_topic_performance FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'exam_prep_sessions'
      AND policyname = 'Users read own sessions'
  ) THEN
    CREATE POLICY "Users read own sessions"
    ON exam_prep_sessions FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

SELECT schemaname, tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
