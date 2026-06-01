-- ScholarHAAB recommended Supabase RLS policies.
-- Run in Supabase SQL editor after confirming table names match production.

ALTER TABLE IF EXISTS questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mark_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_topic_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_learning_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS exam_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS mock_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS syllabus_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS formula_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS theory_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS paper_patterns ENABLE ROW LEVEL SECURITY;
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

DROP POLICY IF EXISTS "Users read own user profile" ON user_profiles;
CREATE POLICY "Users read own user profile"
ON user_profiles
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own user profile" ON user_profiles;
CREATE POLICY "Users insert own user profile"
ON user_profiles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own user profile" ON user_profiles;
CREATE POLICY "Users update own user profile"
ON user_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own topic progress" ON student_topic_progress;
CREATE POLICY "Users select own topic progress"
ON student_topic_progress
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own topic progress" ON student_topic_progress;
CREATE POLICY "Users insert own topic progress"
ON student_topic_progress
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own topic progress" ON student_topic_progress;
CREATE POLICY "Users update own topic progress"
ON student_topic_progress
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users select own learning gaps"
ON student_learning_gaps
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users insert own learning gaps"
ON student_learning_gaps
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own learning gaps" ON student_learning_gaps;
CREATE POLICY "Users update own learning gaps"
ON student_learning_gaps
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users select own exam sessions" ON exam_sessions;
CREATE POLICY "Users select own exam sessions"
ON exam_sessions
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own exam sessions" ON exam_sessions;
CREATE POLICY "Users insert own exam sessions"
ON exam_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own exam sessions" ON exam_sessions;
CREATE POLICY "Users update own exam sessions"
ON exam_sessions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

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

DROP POLICY IF EXISTS "Users select own mock attempts" ON mock_attempts;
CREATE POLICY "Users select own mock attempts"
ON mock_attempts
FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own mock attempts" ON mock_attempts;
CREATE POLICY "Users insert own mock attempts"
ON mock_attempts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own mock attempts" ON mock_attempts;
CREATE POLICY "Users update own mock attempts"
ON mock_attempts
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public read syllabus topics" ON syllabus_topics;
CREATE POLICY "Public read syllabus topics"
ON syllabus_topics
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public read formula bank" ON formula_bank;
CREATE POLICY "Public read formula bank"
ON formula_bank
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public read theory bank" ON theory_bank;
CREATE POLICY "Public read theory bank"
ON theory_bank
FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Public read paper patterns" ON paper_patterns;
CREATE POLICY "Public read paper patterns"
ON paper_patterns
FOR SELECT
USING (true);

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
