# Payment Gateway Setup

ScholarHAAB supports two optional checkout providers:

- `bKash`
- `SSLCommerz`

At least one enabled gateway must be fully configured before release.

## Enable or disable gateways

```env
ENABLE_BKASH=true
ENABLE_SSLCOMMERZ=false
```

If a gateway is disabled:

- the server rejects that checkout path clearly
- the pricing page can hide that button with `NEXT_PUBLIC_ENABLE_*`
- `npm run prod:check` does not require credentials for the disabled gateway

## bKash envs

```env
ENABLE_BKASH=true
NEXT_PUBLIC_ENABLE_BKASH=true
BKASH_BASE_URL=https://tokenized.sandbox.bka.sh/v1.2.0-beta
BKASH_APP_KEY=...
BKASH_APP_SECRET=...
BKASH_USERNAME=...
BKASH_PASSWORD=...
```

## SSLCommerz envs

```env
ENABLE_SSLCOMMERZ=true
NEXT_PUBLIC_ENABLE_SSLCOMMERZ=true
SSLCOMMERZ_STORE_ID=...
SSLCOMMERZ_STORE_PASSWORD=...
SSLCOMMERZ_IS_LIVE=false
```

## Release rule

Release is blocked if:

- both gateways are disabled
- or every enabled gateway is missing required credentials

## Fastest deploy path

1. Copy [C:\Users\User\scholorhaab\.env.example](C:/Users/User/scholorhaab/.env.example) to `.env.local`
2. Fill the real production values
3. Keep at least one gateway both enabled and fully configured
4. Run:

```bash
npm run deploy:verify
```

If that passes locally, the remaining live step is your real production deploy with the same env values in Vercel.
