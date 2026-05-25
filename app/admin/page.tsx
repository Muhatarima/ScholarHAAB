import Link from 'next/link'
import AuthGuard from '@/components/auth/AuthGuard'
import Blackhole from '@/components/Blackhole'
import Stars from '@/components/Stars'
import { requireAdmin } from '@/lib/admin/check'
import { getAdminStats, getActiveUsers, getRecentLogs } from '@/lib/admin/data'

export const dynamic = 'force-dynamic'

function formatCurrency(value: number) {
  return `$${value.toFixed(value >= 1 ? 2 : 5)}`
}

function formatTime(value: string | null) {
  if (!value) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    timeZone: 'Asia/Dhaka',
  }).format(new Date(value))
}

function compactMessage(value: string | null, maxLength = 140) {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength - 3).trim()}...`
}

export default async function AdminPage() {
  await requireAdmin()

  const [stats, logs, activeUsers] = await Promise.all([
    getAdminStats(),
    getRecentLogs(50),
    getActiveUsers(7),
  ])

  const statCards = [
    { label: 'Total users', value: stats.totalUsers, hint: 'Signed-in student profiles' },
    { label: 'Active (7d)', value: activeUsers, hint: 'Unique signed-in users' },
    { label: 'Total queries', value: stats.totalQueries, hint: 'Logged qbank requests' },
    { label: 'Today queries', value: stats.todayQueries, hint: 'Live query volume' },
    { label: 'Cache hit rate', value: `${stats.cacheHitRate}%`, hint: 'Last 7 days' },
    { label: 'Today tokens', value: stats.todayTokens, hint: 'Estimated answer tokens' },
    { label: 'Today cost', value: formatCurrency(stats.todayCost), hint: 'Estimated from query logs' },
    { label: 'Avg response', value: `${stats.avgResponseMs} ms`, hint: 'Today average latency' },
  ]

  const maxDailyQueries = Math.max(1, ...stats.costByDay.map((point) => point.totalQueries))

  return (
    <AuthGuard>
      <main
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#00000d',
        color: '#E8E8FF',
        padding: '120px 24px 48px',
      }}
    >
      <Stars />
      <Blackhole />
      <div style={{ position: 'relative', zIndex: 10, maxWidth: '1040px', margin: '0 auto', display: 'grid', gap: '18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div>
            <p style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: '#9A6CFF' }}>Admin visibility</p>
            <h1 style={{ fontSize: 'clamp(32px, 5vw, 54px)', margin: '10px 0 12px' }}>ScholarHAAB admin dashboard</h1>
            <p style={{ color: '#9a9abe', lineHeight: 1.7, maxWidth: '760px', margin: 0 }}>
              Live usage, cache behavior, cost pressure, and the exact questions students keep asking.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Link
              href="/dashboard"
              style={{
                border: '1px solid rgba(170,85,255,0.22)',
                borderRadius: '999px',
                padding: '10px 16px',
                color: '#E8E8FF',
                textDecoration: 'none',
              }}
            >
              Back to dashboard
            </Link>
            <Link
              href="/admin"
              style={{
                border: '1px solid rgba(107,228,255,0.22)',
                borderRadius: '999px',
                padding: '10px 16px',
                color: '#74dfff',
                textDecoration: 'none',
              }}
            >
              Refresh now
            </Link>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '14px', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {statCards.map((card) => (
            <article
              key={card.label}
              style={{
                borderRadius: '18px',
                border: '1px solid rgba(170,85,255,0.16)',
                background: 'rgba(255,255,255,0.04)',
                padding: '18px',
              }}
            >
              <div style={{ fontSize: '12px', color: '#9A6CFF', textTransform: 'uppercase', letterSpacing: '2px' }}>{card.label}</div>
              <div style={{ fontSize: '30px', marginTop: '8px' }}>{card.value}</div>
              <p style={{ margin: '10px 0 0', color: '#9a9abe', lineHeight: 1.5, fontSize: '13px' }}>{card.hint}</p>
            </article>
          ))}
        </div>

        <section
          style={{
            borderRadius: '20px',
            border: '1px solid rgba(59,130,246,0.22)',
            background: 'rgba(15,23,42,0.5)',
            padding: '20px',
            display: 'grid',
            gap: '14px',
          }}
        >
          <div>
            <div style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: '#93c5fd' }}>
              Cache performance
            </div>
            <h2 style={{ margin: '8px 0 0' }}>{stats.cacheHitRate}% hit rate over the last 7 days</h2>
          </div>

          <div style={{ borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', height: '14px' }}>
            <div
              style={{
                width: `${Math.max(4, stats.cacheHitRate)}%`,
                height: '100%',
                background: 'linear-gradient(90deg, #38bdf8 0%, #8b5cf6 100%)',
              }}
            />
          </div>

          <div style={{ display: 'grid', gap: '12px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <div style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.04)', padding: '14px' }}>
              <div style={{ fontSize: '12px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '2px' }}>Cache entries</div>
              <div style={{ fontSize: '28px', marginTop: '8px' }}>{stats.cacheStats.totalEntries}</div>
            </div>
            <div style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.04)', padding: '14px' }}>
              <div style={{ fontSize: '12px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '2px' }}>Hits today</div>
              <div style={{ fontSize: '28px', marginTop: '8px' }}>{stats.cacheStats.hitsToday}</div>
            </div>
            <div style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.04)', padding: '14px' }}>
              <div style={{ fontSize: '12px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '2px' }}>Avg hits / entry</div>
              <div style={{ fontSize: '28px', marginTop: '8px' }}>{stats.cacheStats.avgHitsPerEntry.toFixed(2)}</div>
            </div>
            <div style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.04)', padding: '14px' }}>
              <div style={{ fontSize: '12px', color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '2px' }}>Hot entries</div>
              <div style={{ fontSize: '28px', marginTop: '8px' }}>{stats.cacheStats.hotEntries}</div>
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gap: '18px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
          <section style={{ borderRadius: '20px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '20px' }}>
            <h2 style={{ marginTop: 0 }}>Top questions (30d)</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {stats.topQuestions.length === 0 ? (
                <div style={{ color: '#9a9abe' }}>No logged queries yet. Run the SQL setup, then ask a few real qbank questions.</div>
              ) : (
                stats.topQuestions.map((question, index) => (
                  <article key={`${question.message}-${index}`} style={{ borderRadius: '14px', background: 'rgba(255,255,255,0.03)', padding: '14px' }}>
                    <div style={{ color: '#f3e8ff', fontSize: '14px', lineHeight: 1.6 }}>{question.message}</div>
                    <div style={{ marginTop: '8px', color: '#9a9abe', fontSize: '12px' }}>
                      {question.count} asks | {question.queryType ?? 'unknown type'} | {question.subject ?? 'no subject'} | last seen {formatTime(question.lastSeenAt)}
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section style={{ borderRadius: '20px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '20px' }}>
            <h2 style={{ marginTop: 0 }}>Cost tracking (7d)</h2>
            <div style={{ display: 'grid', gap: '12px' }}>
              {stats.costByDay.map((point) => (
                <div key={point.date} style={{ display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', color: '#e9e6ff', fontSize: '14px' }}>
                    <span>{point.label}</span>
                    <span>
                      {point.totalQueries} queries | {formatCurrency(point.totalCostUsd)}
                    </span>
                  </div>
                  <div style={{ borderRadius: '999px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', height: '10px' }}>
                    <div
                      style={{
                        width: `${Math.max(6, Math.round((point.totalQueries / maxDailyQueries) * 100))}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #22d3ee 0%, #8b5cf6 100%)',
                      }}
                    />
                  </div>
                  <div style={{ color: '#9a9abe', fontSize: '12px' }}>
                    {point.totalTokens} tokens | {point.cacheHits} cache hits
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <section style={{ borderRadius: '20px', border: '1px solid rgba(170,85,255,0.16)', background: 'rgba(255,255,255,0.04)', padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0 }}>Recent queries</h2>
              <p style={{ color: '#9a9abe', margin: '8px 0 0', lineHeight: 1.6 }}>
                Real rows from <code>query_logs</code>. Cost is estimated from logged tokens at $0.00000015/token.
              </p>
            </div>
            <div style={{ color: '#9a9abe', fontSize: '13px' }}>{logs.length} rows shown</div>
          </div>

          <div style={{ marginTop: '18px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '920px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', textAlign: 'left', color: '#9A6CFF' }}>
                  {['User', 'Query', 'Type', 'Subject', 'Tokens', 'Cost', 'Cache', 'Latency', 'Time'].map((label) => (
                    <th key={label} style={{ padding: '12px 10px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '18px 10px', color: '#9a9abe' }}>
                      No logs yet. Run the SQL in <code>docs/SUPABASE_ADMIN_SETUP.md</code>, then ask a few qbank questions.
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', verticalAlign: 'top' }}>
                      <td style={{ padding: '14px 10px', color: '#e9e6ff' }}>{log.user_email ?? 'anonymous'}</td>
                      <td style={{ padding: '14px 10px', color: '#f3e8ff', lineHeight: 1.5 }}>{compactMessage(log.message)}</td>
                      <td style={{ padding: '14px 10px', color: '#dcd8f6' }}>{log.query_type ?? 'unknown'}</td>
                      <td style={{ padding: '14px 10px', color: '#dcd8f6' }}>{log.subject ?? '-'}</td>
                      <td style={{ padding: '14px 10px', color: '#dcd8f6' }}>{log.tokens_used ?? 0}</td>
                      <td style={{ padding: '14px 10px', color: '#dcd8f6' }}>{formatCurrency(Number(log.cost_usd ?? 0))}</td>
                      <td style={{ padding: '14px 10px', color: log.from_cache ? '#74dfff' : '#fda4af' }}>{log.from_cache ? 'hit' : 'miss'}</td>
                      <td style={{ padding: '14px 10px', color: '#dcd8f6' }}>{log.response_ms ?? 0} ms</td>
                      <td style={{ padding: '14px 10px', color: '#9a9abe' }}>{formatTime(log.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
      </main>
    </AuthGuard>
  )
}
