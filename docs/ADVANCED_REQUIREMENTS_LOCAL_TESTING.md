# ScholarHAAB Advanced Requirements Local Testing

## Before testing

1. Run `npm install`
2. Make sure `.env.local` has:
   - `GEMINI_API_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SSLCOMMERZ_STORE_ID`
   - `SSLCOMMERZ_STORE_PASSWORD`
3. Run the SQL setup in Supabase:
   - [004_rag_documents.sql](C:/Users/User/scholorhaab/docs/sql/004_rag_documents.sql)
   - [011_high_security_rls_and_limits.sql](C:/Users/User/scholorhaab/docs/sql/011_high_security_rls_and_limits.sql)
   - [014_cached_answers.sql](C:/Users/User/scholorhaab/docs/sql/014_cached_answers.sql)
   - [015_payment_logs.sql](C:/Users/User/scholorhaab/docs/sql/015_payment_logs.sql)
4. Start locally: `npm run dev`

## File input

- Text chat still works in both `/abroad` and `/qbank`
- Attach a JPG/PNG math problem and ask for a solve
- Attach a PDF SOP and ask for evaluation
- Attach a DOCX LOR/SOP and ask for feedback
- Try a file above 10MB and confirm the client blocks it
- Confirm the file is cleared after a successful send

## Smart caching

- Ask the same non-personal QBank question twice
- Ask the same non-personal scholarship question twice
- Confirm second response returns without a fresh model call path
- Confirm personal questions like `My CGPA is 3.4, am I eligible?` are not cached
- Confirm file-upload messages are not cached

## Payment security

- Start a `pro` payment and confirm a `pending` row appears in `payment_logs`
- Replay the same IPN and confirm the second request does not create a second success
- Send a mismatched amount in sandbox and confirm it is rejected
- Confirm successful IPN updates `subscriptions`, `profiles`, and `payment_logs`

## Security and usage

- Confirm unauthenticated protected API routes return `401`
- Confirm 7-day expired trial returns `403`
- Confirm daily credit limit still works after cache hits
- Confirm file uploads are not written to local disk or DB tables

## Final checks

- Run `npm run lint`
- Run `npm run build`
- Test mobile layout in browser dev tools
- Test one QBank query, one Abroad query, one file upload, and one payment sandbox flow before deploy
