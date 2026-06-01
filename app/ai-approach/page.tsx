import type { CSSProperties } from 'react'
import AppShell from '@/components/AppShell'
import Badge from '@/components/Badge'
import FeatureCard from '@/components/FeatureCard'

const layers = [
  {
    badge: 'Layer 1',
    title: 'RAG System',
    items: [
      '10 years Cambridge + Edexcel past papers',
      'Chunked by topic, year, board, and level',
      'Embedded into vector search',
      'Verified answer retrieved first',
    ],
  },
  {
    badge: 'Layer 2',
    title: 'Pattern Intelligence',
    items: [
      'Extracts mark scheme solving patterns',
      'Detects formulas and command words',
      'Classifies question type',
      'Uses examiner-style reasoning only when unseen',
    ],
  },
  {
    badge: 'Layer 3',
    title: 'Intent Understanding',
    items: [
      'Banglish and typo handling',
      'Panic mode redirect',
      'Skipped chapter detection',
      'Weak topic adaptation',
    ],
  },
]

const stack = ['Next.js', 'Supabase', 'Gemini', 'ChromaDB', 'LangChain']

export default function AIApproachPage() {
  return (
    <AppShell>
      <section style={styles.hero}>
        <Badge tone="violet">AI you can actually trust</Badge>
        <h1 style={styles.title}>Three layers before every answer.</h1>
        <p style={styles.copy}>
          ScholarHAAB searches verified past papers first, then applies Cambridge/Edexcel pattern intelligence, then explains in the student&apos;s language.
        </p>
      </section>

      <section style={styles.grid}>
        {layers.map((layer) => (
          <FeatureCard key={layer.title} badge={layer.badge} title={layer.title}>
            <ul style={styles.list}>
              {layer.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </FeatureCard>
        ))}
      </section>

      <section style={styles.stack}>
        {stack.map((item) => <Badge key={item} tone="muted">{item}</Badge>)}
      </section>
    </AppShell>
  )
}

const styles = {
  hero: {
    display: 'grid',
    gap: 16,
    margin: '0 auto',
    padding: '92px clamp(16px,5vw,72px) 28px',
    textAlign: 'center',
    width: 'min(940px, 100%)',
  } satisfies CSSProperties,
  title: {
    color: '#f4eeff',
    fontSize: 'clamp(42px,7vw,82px)',
    fontWeight: 500,
    letterSpacing: '-0.065em',
    lineHeight: 0.95,
    margin: 0,
  } satisfies CSSProperties,
  copy: {
    color: '#aaa6ca',
    fontSize: 17,
    lineHeight: 1.7,
    margin: '0 auto',
    maxWidth: 680,
  } satisfies CSSProperties,
  grid: {
    display: 'grid',
    gap: 16,
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    margin: '0 auto',
    padding: '18px clamp(16px,5vw,72px)',
    width: 'min(1160px, 100%)',
  } satisfies CSSProperties,
  list: {
    display: 'grid',
    gap: 10,
    margin: 0,
    paddingLeft: 18,
  } satisfies CSSProperties,
  stack: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    padding: '24px 16px 70px',
  } satisfies CSSProperties,
}
