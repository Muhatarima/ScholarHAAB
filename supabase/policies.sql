-- ScholarHAAB recommended Supabase RLS policies.
-- Run in Supabase SQL editor after confirming table names match production.

ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mark_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read verified questions" ON questions;
CREATE POLICY "Public read verified questions"
ON questions
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public read verified mark schemes" ON mark_schemes;
CREATE POLICY "Public read verified mark schemes"
ON mark_schemes
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users select own student progress" ON student_progress;
CREATE POLICY "Users select own student progress"
ON student_progress
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own student progress" ON student_progress;
CREATE POLICY "Users insert own student progress"
ON student_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own student progress" ON student_progress;
CREATE POLICY "Users update own student progress"
ON student_progress
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own student progress" ON student_progress;
CREATE POLICY "Users delete own student progress"
ON student_progress
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own exam plans" ON exam_plans;
CREATE POLICY "Users select own exam plans"
ON exam_plans
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own exam plans" ON exam_plans;
CREATE POLICY "Users insert own exam plans"
ON exam_plans
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own exam plans" ON exam_plans;
CREATE POLICY "Users update own exam plans"
ON exam_plans
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own exam plans" ON exam_plans;
CREATE POLICY "Users delete own exam plans"
ON exam_plans
FOR DELETE
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own profile" ON profiles;
CREATE POLICY "Users read own profile"
ON profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON profiles;
CREATE POLICY "Users update own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
