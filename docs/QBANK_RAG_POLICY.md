# QBank RAG Policy

QBank should stay cheap and accurate by separating sources into 3 tiers.

## Tier 1: Truth

Use for:
- board names
- syllabus scope
- paper structure
- official subject requirements
- officially published past papers and mark schemes

Examples:
- Cambridge International subject pages
- Cambridge official past-paper pages
- Pearson Edexcel qualification pages
- Pearson official specification PDFs

## Tier 2: Discovery

Use for:
- finding paper collections quickly
- locating revision-topic groupings
- building crawl queues

Do not use alone for:
- final factual claims about mark schemes
- exact official wording
- official paper availability claims

Examples:
- PapaCambridge
- Physics & Maths Tutor

## Tier 3: Proxy

Use for:
- concept explanation style
- extra formula or science background
- weak-supervision data for tutoring behavior

Do not use for:
- board-specific truth
- exact year/paper claims
- official syllabus coverage

Examples:
- Hugging Face concept datasets

## Product rule

- QBank chat should answer from Tier 1 when available.
- Tier 2 can support retrieval and discovery.
- Tier 3 can support teaching style and concept clarity.
- Never let Tier 3 overrule Tier 1.
