'use client'

import React, { useEffect, useState } from 'react'
import { getLiveSystemStats } from '@/app/docs/actions'

export default function LiveStats() {
  const [stats, setStats] = useState({
    activeUsers: 0,
    queriesToday: 0,
    systemUptime: '99.9%',
    aiAccuracy: '94.8%'
  })

  useEffect(() => {
    async function fetchStats() {
      try {
        const live = await getLiveSystemStats()
        setStats({
          activeUsers: live.activeUsers,
          queriesToday: live.totalQueries,
          systemUptime: live.uptime,
          aiAccuracy: live.accuracy
        })
      } catch (err) {
        console.error('Failed to fetch live stats:', err)
      }
    }

    fetchStats()
    const interval = setInterval(fetchStats, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="statsGrid">
      <div className="statCard">
        <div className="statValue">{stats.activeUsers}</div>
        <div className="statLabel">Live Users</div>
      </div>
      <div className="statCard">
        <div className="statValue">{stats.queriesToday.toLocaleString()}</div>
        <div className="statLabel">Queries Today</div>
      </div>
      <div className="statCard">
        <div className="statValue">{stats.systemUptime}</div>
        <div className="statLabel">Uptime</div>
      </div>
      <div className="statCard">
        <div className="statValue">{stats.aiAccuracy}</div>
        <div className="statLabel">AI Precision</div>
      </div>
    </div>
  )
}
