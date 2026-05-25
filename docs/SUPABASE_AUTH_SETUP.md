# Supabase Auth Setup

Manual steps:

1. Go to [supabase.com](https://supabase.com/) and create a new project.
2. Name it `scholorhaab`.
3. Save the database password somewhere safe.
4. Choose the `Southeast Asia (Singapore)` region for low latency from Bangladesh.
5. Open `Project Settings -> API`.
6. Copy these values into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Database setup:

1. Open `SQL Editor` in Supabase.
2. Run `docs/sql/999_master_setup.sql` if you are setting the project up from scratch.
3. If your database already exists, make sure at least these migrations are applied:
   - `docs/sql/003_identity_and_subscriptions.sql`
   - `docs/sql/013_add_dob_and_profile_trigger.sql`
   - `docs/sql/018_launch_blockers.sql`
   - `docs/sql/019_study_progress.sql`

What this enables:

- Email and password signup
- Email and password login
- Protected routes for `/dashboard`, `/qbank`, and `/chat`
- Protected QBank API access
- Auto-created `profiles` row on signup through the `handle_new_user()` trigger
