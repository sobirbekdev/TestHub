'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import api from '@/lib/api';

export default function AdminDashboard() {
  const { theme } = useThemeStore();
  const [stats, setStats] = useState<any>(null);
  const [qStats, setQStats] = useState<any>(null);

  useEffect(() => {
    api.get('/tests/stats').then((r) => setStats(r.data)).catch(() => {});
    api.get('/questions/stats').then((r) => setQStats(r.data)).catch(() => {});
  }, []);

  const card = (label: string, value: any, color = '') => (
    <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '18px 22px' }}>
      <p style={{ color: theme.text, opacity: 0.5, fontSize: 12, marginBottom: 4 }}>{label}</p>
      <p style={{ color: color || theme.accent, fontSize: 28, fontWeight: 700 }}>{value ?? '—'}</p>
    </div>
  );

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 22, fontWeight: 700, marginBottom: 20 }}>📊 Dashboard</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 28 }}>
        {card('Jami testlar', stats?.totalTests)}
        {card("Foydalanuvchilar", stats?.totalUsers)}
        {card('Yakunlangan testlar', stats?.totalAttempts)}
        {card('Jami savollar', qStats?.total)}
      </div>

      {/* Savol bazasi tuzilmasi */}
      {qStats && (
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20, marginBottom: 20 }}>
          <p style={{ color: theme.text, fontWeight: 600, marginBottom: 14 }}>Savol bazasi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {qStats.byDifficulty?.map((d: any) => {
              const colors: Record<string, string> = { EASY: '#10b981', MEDIUM: '#f59e0b', HARD: '#ef4444' };
              const labels: Record<string, string> = { EASY: '🟢 Oson', MEDIUM: '🟡 O\'rta', HARD: '🔴 Qiyin' };
              return (
                <div key={d.difficulty} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: theme.text, fontSize: 14 }}>{labels[d.difficulty]}</span>
                  <span style={{ color: colors[d.difficulty], fontWeight: 700 }}>{d.count} ta</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Test turlari */}
      {stats?.byType?.length > 0 && (
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20 }}>
          <p style={{ color: theme.text, fontWeight: 600, marginBottom: 14 }}>Test turlari bo'yicha</p>
          {stats.byType.map((t: any) => (
            <div key={t.type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ color: theme.text, fontSize: 14 }}>{t.type}</span>
              <span style={{ color: theme.accent, fontWeight: 600 }}>{t.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
