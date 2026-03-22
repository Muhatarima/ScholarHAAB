# Credit System

## Goal

Keep answer quality high while controlling API cost.

The product should not feel worse for trial users.
Instead, it should feel strong but limited.

## Tier Limits

- `trial`: 12 credits per day
- `pro`: 30 credits per day
- `premium`: 50 credits per day

## Weighted Actions

- `abroad_chat`: 1 credit
- `scholarship_match`: 2 credits
- `abroad_document_review`: 3 credits
- `qbank_direct`: 1 credit
- `qbank_tutor`: 2 credits
- `qbank_topic_analysis`: 2 credits

## Why This Design

- normal chat stays cheap
- heavy tasks cost more
- users feel real value before hitting the limit
- upgrade pressure comes from dependency and trust, not bad answers

## Current Implementation

The limit engine currently:

- identifies a visitor with a cookie
- defaults everyone to `trial`
- tracks usage per day in Supabase
- returns remaining credits in API responses
- returns the next reset time in `Asia/Dhaka`
- fails open if the SQL table is not created yet

## Important Product Rule

Do not reduce the intelligence of the answer by tier.

Keep:

- the same core quality
- the same concise and accurate style

Change only:

- usage allowance
- access to heavier actions

## Next Upgrade Later

When auth and billing are added:

- tier should come from subscription state
- visitor cookie usage should become a fallback only
- document-review monthly caps can be added on top of daily credits
