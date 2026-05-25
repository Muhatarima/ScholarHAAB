'use client'

import ChemistryGraph from './ChemistryGraph'
import FunctionGraph from './FunctionGraph'
import PhysicsGraph from './PhysicsGraph'
import StatisticsGraph from './StatisticsGraph'
import { detectGraphIntents } from '@/lib/graphDetection'

export default function GraphDetector({ text }: { text: string }) {
  const intents = detectGraphIntents(text)
  if (intents.length === 0) {
    return null
  }

  return (
    <div data-testid="graph-detector-output" style={{ display: 'grid', gap: '14px', marginTop: '14px' }}>
      {intents.map((intent, index) => {
        if (intent.kind === 'function') {
          return (
            <FunctionGraph
              key={`${intent.kind}-${index}`}
              title={intent.title}
              functions={intent.functions}
              showArea={intent.showArea}
              areaRange={intent.areaRange}
            />
          )
        }
        if (intent.kind === 'physics') {
          return <PhysicsGraph key={`${intent.kind}-${index}`} title={intent.title} type={intent.type} interactive />
        }
        if (intent.kind === 'chemistry') {
          return <ChemistryGraph key={`${intent.kind}-${index}`} title={intent.title} type={intent.type} interactive />
        }
        if (intent.kind === 'statistics') {
          return <StatisticsGraph key={`${intent.kind}-${index}`} title={intent.title} type={intent.type} />
        }
        return <PhysicsGraphGallery key={`${intent.kind}-${index}`} />
      })}
    </div>
  )
}

export function PhysicsGraphGallery() {
  const cards = [
    {
      title: 'Distance-time',
      type: 'distance-time' as const,
      frequency: 'Very High - appears in about 73% of Paper 2 style mechanics sets',
    },
    {
      title: 'Velocity-time',
      type: 'velocity-time' as const,
      frequency: 'Very High - area and gradient questions repeat constantly',
    },
    {
      title: 'Force-extension',
      type: 'force-extension' as const,
      frequency: "High - Hooke's law and spring energy",
    },
    {
      title: 'Wave diagram',
      type: 'wave' as const,
      frequency: 'High - amplitude, wavelength, phase, period',
    },
    {
      title: 'Projectile motion',
      type: 'projectile' as const,
      frequency: 'Medium - resolves into horizontal/vertical components',
    },
    {
      title: 'SHM',
      type: 'shm' as const,
      frequency: 'Medium - displacement, velocity, acceleration links',
    },
  ]

  return (
    <section style={{ display: 'grid', gap: '14px' }}>
      {cards.map((card) => (
        <div key={card.title} style={{ display: 'grid', gap: '8px' }}>
          <PhysicsGraph title={card.title} type={card.type} interactive={false} />
          <div style={{ color: '#facc15', fontSize: '12px', fontWeight: 800 }}>{card.frequency}</div>
        </div>
      ))}
    </section>
  )
}
