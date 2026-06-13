'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import { useAuthStore } from '@/store/auth';
import { LeaderboardEntry } from '@/types';
import api from '@/lib/api';

type Filter = 'global' | 'daily';

export default function RatingPage() {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const [filter, setFilter] = useState<Filter>('global');
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get(`/leaderboard/${filter}`)
      .then((r) => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filter]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>🏆 Reyting</h1>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['global', 'daily'] as Filter[]).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 500,
              border: `1px solid ${filter === f ? theme.accent : theme.border}`,
              backgroundColor: filter === f ? `${theme.accent}20` : theme.card,
              color: filter === f ? theme.accent : theme.text, cursor: 'pointer' }}>
            {f === 'global' ? '🌐 Umumiy' : '📅 Bugungi'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: theme.text, opacity: 0.4, padding: 40 }}>Yuklanmoqda...</div>
      ) : data.length === 0 ? (
        <div style={{ textAlign: 'center', color: theme.text, opacity: 0.4, padding: 40 }}>Ma'lumot yo'q</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.map((entry) => {
            const isMe = entry.userId === user?.id;
            return (
              <div key={entry.userId}
                style={{ backgroundColor: isMe ? `${theme.accent}15` : theme.card,
                  border: `1px solid ${isMe ? theme.accent : theme.border}`, borderRadius: 14, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: entry.rank <= 3 ? 22 : 14, fontWeight: 700,
                  color: entry.rank <= 3 ? undefined : theme.text, opacity: entry.rank > 3 ? 0.5 : 1, width: 28 }}>
                  {entry.rank <= 3 ? medals[entry.rank - 1] : `#${entry.rank}`}
                </span>
                <div style={{ flex: 1 }}>
                  <p style={{ color: theme.text, fontWeight: isMe ? 700 : 500, fontSize: 14 }}>
                    {entry.name || entry.phone.slice(-4)} {isMe && '(Siz)'}
                  </p>
                  <p style={{ color: theme.text, opacity: 0.4, fontSize: 12 }}>{entry.attempts} test</p>
                </div>
                <span style={{ color: theme.accent, fontWeight: 700, fontSize: 16 }}>{entry.avgScore}%</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
