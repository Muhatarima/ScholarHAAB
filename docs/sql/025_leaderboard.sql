CREATE TABLE IF NOT EXISTS leaderboard (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  display_name TEXT,
  total_score INTEGER DEFAULT 0,
  topics_mastered INTEGER DEFAULT 0,
  streak_days INTEGER DEFAULT 0,
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leaderboard'
      AND policyname = 'Allow public read on leaderboard'
  ) THEN
    CREATE POLICY "Allow public read on leaderboard"
    ON leaderboard FOR SELECT
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'leaderboard'
      AND policyname = 'Users update own leaderboard row'
  ) THEN
    CREATE POLICY "Users update own leaderboard row"
    ON leaderboard FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_leaderboard_total_score
  ON leaderboard(total_score DESC, updated_at DESC);
