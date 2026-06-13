'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import api from '@/lib/api';

const TYPE_LABELS: Record<string, string> = {
  DTM_VARIANT: 'DTM Variant', DTM_RANDOM: 'DTM Sinov',
  ATTESTATION: 'Atestatsiya', NATIONAL_CERT: 'Milliy Sert.', TOPIC: 'Mavzu',
};

export default function StatsPage() {
  const { theme } = useThemeStore();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/leaderboard/my-stats').then((r) => { setStats(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: theme.text, opacity: 0.4, padding: 40, textAlign: 'center' }}>Yuklanmoqda...</div>;
  if (!stats) return null;

  const maxBar = Math.max(...(stats.weekly?.map((d: any) => d.count) || [1]), 1);

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 20 }}>📊 Statistika</h1>

      {/* Jami */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Jami testlar', value: stats.totalAttempts },
          { label: "O'rtacha ball", value: `${stats.avgScore ?? 0}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '16px 20px' }}>
            <p style={{ color: theme.text, opacity: 0.5, fontSize: 12 }}>{label}</p>
            <p style={{ color: theme.accent, fontSize: 26, fontWeight: 700 }}>{value}</p>
          </div>
        ))}
      </div>

      {/* Haftalik grafik */}
      <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
        <p style={{ color: theme.text, fontWeight: 600, marginBottom: 16 }}>Haftalik faollik</p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
          {(stats.weekly || []).map((d: any) => (
            <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', borderRadius: 6,
                backgroundColor: d.count > 0 ? theme.accent : theme.border,
                height: `${Math.max((d.count / maxBar) * 60, 4)}px`,
                transition: 'height 0.3s',
              }} />
              <span style={{ fontSize: 9, color: theme.text, opacity: 0.4 }}>
                {new Date(d.date).toLocaleDateString('uz', { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Test turlari */}
      {Object.keys(stats.byType || {}).length > 0 && (
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20 }}>
          <p style={{ color: theme.text, fontWeight: 600, marginBottom: 14 }}>Test turlari</p>
          {Object.entries(stats.byType).map(([type, info]: any) => (
            <div key={type} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0',
              borderBottom: `1px solid ${theme.border}` }}>
              <span style={{ color: theme.text, fontSize: 14 }}>{TYPE_LABELS[type] || type}</span>
              <span style={{ color: theme.accent, fontWeight: 600, fontSize: 14 }}>
                {info.count} ta · {info.avgScore}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
