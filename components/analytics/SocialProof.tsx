'use client';

import { useEffect, useState } from 'react';
import { getTractionStats } from '@/lib/analytics/usageTracker';

export default function SocialProof() {
  const [stats, setStats] = useState({
    totalQuestions: 0,
    uniqueSessions: 0,
    questionsToday: 0,
  });

  useEffect(() => {
    let mounted = true;

    const fetchStats = async () => {
      const data = await getTractionStats();
      if (!mounted) return;
      setStats({
        totalQuestions: data.totalQuestions,
        uniqueSessions: data.uniqueSessions,
        questionsToday: data.questionsToday,
      });
    };

    fetchStats();
    const interval = window.setInterval(fetchStats, 60000);

    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, []);

  const formatNumber = (value: number) =>
    value > 1000 ? `${(value / 1000).toFixed(1)}k+` : `${value}+`;

  return (
    <div className="flex flex-wrap justify-center gap-6 py-4">
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">
          {formatNumber(stats.totalQuestions)}
        </div>
        <div className="text-sm text-gray-500">Questions Solved</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">
          {formatNumber(stats.uniqueSessions)}
        </div>
        <div className="text-sm text-gray-500">Students Used</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold text-purple-600">
          {formatNumber(stats.questionsToday)}
        </div>
        <div className="text-sm text-gray-500">Questions Today</div>
      </div>
    </div>
  );
}
