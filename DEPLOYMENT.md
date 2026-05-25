# ScholarHAAB Deployment Guide

## Deploy to Vercel
1. Push to GitHub
2. Connect repo to Vercel
3. Add all env variables from .env.example
4. Run docs/sql/024_final_deployment_rls.sql in Supabase SQL Editor
5. Deploy

## Post-deployment checklist
- [ ] Supabase URL updated to production
- [ ] DEMO_MODE set to false
- [ ] Final RLS SQL run in Supabase
- [ ] Test QBank on live URL
- [ ] Test Exam Prep on live URL
- [ ] Test signup/login
