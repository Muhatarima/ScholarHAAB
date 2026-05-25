import AuthGuard from '@/components/auth/AuthGuard'
import GraphPlayground from '@/components/graphs/GraphPlayground'

export const metadata = {
  title: 'Graph Playground | ScholarHAAB',
  description: 'Interactive Cambridge A/O Level math, physics, chemistry, and statistics graph practice.',
}

export default function QbankGraphsPage() {
  return (
    <AuthGuard>
      <main
        style={{
          minHeight: '100vh',
          background:
            'radial-gradient(circle at top left, rgba(34,211,238,0.12), transparent 32%), radial-gradient(circle at bottom right, rgba(139,92,246,0.2), transparent 34%), #050510',
          padding: '42px 18px',
        }}
      >
        <div style={{ maxWidth: '1120px', margin: '0 auto', display: 'grid', gap: '22px' }}>
          <header style={{ display: 'grid', gap: '10px' }}>
            <p style={{ margin: 0, color: '#67e8f9', fontWeight: 900, letterSpacing: '0.08em', textTransform: 'uppercase', fontSize: '12px' }}>
              ScholarHAAB visual lab
            </p>
            <h1 style={{ margin: 0, color: '#f8f5ff', fontSize: 'clamp(32px, 5vw, 58px)', letterSpacing: '-0.05em' }}>
              Graphs that feel like exam practice, not decoration.
            </h1>
            <p style={{ margin: 0, color: '#c8c4e8', maxWidth: '760px', fontSize: '16px', lineHeight: 1.7 }}>
              Plot functions, inspect gradients, shade integration areas, revise wave labels, compare chemistry curves, and practise statistics diagrams in one place.
            </p>
          </header>
          <GraphPlayground />
        </div>
      </main>
    </AuthGuard>
  )
}
