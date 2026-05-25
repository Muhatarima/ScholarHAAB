# ScholarHAAB Mobile

Cross-platform mobile client for ScholarHAAB, built with Expo + React Native.

## Reuse strategy

- Reuses the existing ScholarHAAB backend and domain logic through the live API.
- Reuses Supabase auth with mobile-safe token persistence.
- Keeps the web backend as the source of truth for chat, retrieval, history, uploads, usage, and payments.
- Replaces browser-only cookie auth assumptions with bearer-token plus viewer-header support on key routes.

## Required env vars

Copy `.env.example` to `.env` and set:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_API_BASE_URL`

For local development against the Next.js app:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

For Android emulator:

```env
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000
```

For a physical device on the same LAN:

```env
EXPO_PUBLIC_API_BASE_URL=http://YOUR_COMPUTER_IP:3000
```

## Local run

```bash
npm install
npm run typecheck
npm run smoke
npm run start
```

## Android release

```bash
npm run prebuild
npm run android:release
```

## iOS release

```bash
npm run prebuild
npm run ios:release
```

## Smoke checklist

- Sign in or sign up.
- Complete onboarding.
- Open QBank chat and send a message.
- Attach an image or PDF and send it.
- Open Abroad chat and send a scholarship question.
- Open History and reopen a saved session.
- Open Settings and trigger the payment URL flow.
- Log out and sign back in.
