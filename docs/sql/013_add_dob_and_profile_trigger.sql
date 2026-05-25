-- 1. Add date_of_birth to the profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- 2. Create an automated trigger so that when someone signs up,
-- their Auth metadata (Full Name, Date of Birth) is instantly mirrored 
-- into the secure public.profiles table so it can be queried safely via Next.js.
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, date_of_birth, created_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    CAST(NEW.raw_user_meta_data->>'date_of_birth' AS DATE),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to Supabase Auth user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Ensure RLS maintains its lockdown on this modified table format.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
