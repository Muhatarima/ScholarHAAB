ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS setup_completed boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'onboarding_completed'
  ) THEN
    EXECUTE '
      UPDATE public.profiles
      SET setup_completed = true
      WHERE onboarding_completed = true
    ';
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.user_profiles') IS NOT NULL THEN
    UPDATE public.profiles AS profile
    SET setup_completed = true
    FROM public.user_profiles AS study_profile
    WHERE study_profile.user_id = profile.id
      AND study_profile.setup_completed = true;
  END IF;
END
$$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users insert own profile" ON public.profiles;
CREATE POLICY "Users insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
