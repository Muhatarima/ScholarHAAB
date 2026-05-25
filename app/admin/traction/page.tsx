'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import AuthGuard from '@/components/auth/AuthGuard';
import { getTractionStats, type TractionStats } from '@/lib/analytics/usageTracker';

function TractionDashboardContent() {
  const [stats, setStats] = useState<TractionStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTractionStats().then((data) => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-xl">Loading traction data...</div>
      </div>
    );
  }

  const summaryStats = [
    { label: 'Total Questions', value: stats?.totalQuestions || 0, icon: 'Books' },
    { label: 'Unique Students', value: stats?.uniqueSessions || 0, icon: 'Students' },
    { label: 'Questions Today', value: stats?.questionsToday || 0, icon: 'Today' },
    { label: 'Subjects', value: stats?.popularSubjects.length || 0, icon: 'Subjects' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8">
      <h1 className="text-3xl font-bold mb-2">ScholarHAAB Traction</h1>
      <p className="text-gray-400 mb-8">Live usage statistics for demo proof.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {summaryStats.map((stat) => (
          <div key={stat.label} className="bg-gray-900 rounded-xl p-4 border border-purple-900">
            <div className="text-sm text-purple-300 mb-1">{stat.icon}</div>
            <div className="text-3xl font-bold text-purple-400">
              {stat.value.toLocaleString()}
            </div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {stats && stats.popularSubjects.length > 0 ? (
        <div className="bg-gray-900 rounded-xl p-6 border border-purple-900 mb-8">
          <h2 className="text-xl font-bold mb-4">Most Popular Subjects</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stats.popularSubjects}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="subject" stroke="#9CA3AF" />
              <YAxis stroke="#9CA3AF" />
              <Tooltip
                contentStyle={{ backgroundColor: '#111827', border: '1px solid #7C3AED' }}
              />
              <Bar dataKey="count" fill="#7C3AED" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="bg-gray-900 rounded-xl p-6 border border-purple-900 mb-8">
          <h2 className="text-xl font-bold mb-2">No live events yet</h2>
          <p className="text-gray-400 text-sm">
            The tracker is online-safe: when Supabase is unavailable it shows a calm empty state
            instead of breaking the demo.
          </p>
        </div>
      )}

      <div className="text-center text-gray-500 text-sm">
        ScholarHAAB - built for Bangladesh.
      </div>
    </div>
  );
}

export default function TractionDashboard() {
  return (
    <AuthGuard>
      <TractionDashboardContent />
    </AuthGuard>
  );
}
