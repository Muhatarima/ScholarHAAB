'use client'

export type SyllabusTopic = {
  name: string
  mastery: number
  attempts: number
  lastPracticed: string
}

function tileColor(mastery: number) {
  if (mastery >= 80) {
    return { bg: 'rgba(34,197,94,0.18)', border: 'rgba(74,222,128,0.36)', text: '#bbf7d0' }
  }
  if (mastery >= 50) {
    return { bg: 'rgba(250,204,21,0.15)', border: 'rgba(250,204,21,0.32)', text: '#fef3c7' }
  }
  if (mastery > 0) {
    return { bg: 'rgba(244,63,94,0.15)', border: 'rgba(251,113,133,0.32)', text: '#fecdd3' }
  }
  return { bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.2)', text: '#cbd5e1' }
}

export default function SyllabusMap({
  subject,
  topics,
  onTopicClick,
}: {
  subject: string
  topics: SyllabusTopic[]
  onTopicClick: (topic: string) => void
}) {
  return (
    <section style={{ display: 'grid', gap: 14 }}>
      <div>
        <h3 style={{ margin: 0, color: '#fff' }}>{subject} syllabus map</h3>
        <p style={{ margin: '6px 0 0', color: '#c7c3e8' }}>Click any tile to start focused practice.</p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        {topics.map((topic) => {
          const color = tileColor(topic.mastery)
          return (
            <button
              key={topic.name}
              type="button"
              title={`${topic.mastery}% mastery, ${topic.attempts} attempts, last practiced: ${topic.lastPracticed || 'never'}`}
              onClick={() => onTopicClick(topic.name)}
              style={{
                border: `1px solid ${color.border}`,
                background: color.bg,
                color: color.text,
                borderRadius: 18,
                padding: 14,
                textAlign: 'left',
                cursor: 'pointer',
                minHeight: 104,
                display: 'grid',
                alignContent: 'space-between',
              }}
            >
              <strong style={{ color: '#fff' }}>{topic.name}</strong>
              <span style={{ fontSize: 13 }}>{topic.mastery}% · {topic.attempts} attempts</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: '#c7c3e8', fontSize: 13 }}>
        <span>Green: mastered</span>
        <span>Yellow: learning</span>
        <span>Red: weak</span>
        <span>Gray: not attempted</span>
      </div>
    </section>
  )
}
