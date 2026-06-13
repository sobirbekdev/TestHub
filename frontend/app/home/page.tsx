'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import api from '@/lib/api';

const TEST_CATEGORIES = [
  {
    href: '/tests?type=DTM_VARIANT',
    icon: '🎯',
    label: 'DTM Variantlari',
    desc: '2020–2025 yillar, 30 ta savol',
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f120, #6366f108)',
    border: '#6366f130',
  },
  {
    href: '/tests?type=NATIONAL_CERT',
    icon: '🏆',
    label: 'Milliy Sertifikat',
    desc: '43 ta savol, 4 variant',
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b98120, #10b98108)',
    border: '#10b98130',
  },
  {
    href: '/tests?type=ATTESTATION',
    icon: '📝',
    label: 'Atestatsiya',
    desc: '35 ta savol, 4 variant',
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b20, #f59e0b08)',
    border: '#f59e0b30',
  },
  {
    href: '/tests?type=TOPIC',
    icon: '📚',
    label: 'Mavzular',
    desc: 'Mavzulashtirilgan testlar',
    color: '#8b5cf6',
    gradient: 'linear-gradient(135deg, #8b5cf620, #8b5cf608)',
    border: '#8b5cf630',
  },
];

export default function HomePage() {
  const { user } = useAuthStore();
  const { theme } = useThemeStore();
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api.get('/leaderboard/my-stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  const firstName = user?.name?.split(' ')[0] || user?.phone?.slice(-4) || '';
  const weeklyCount = stats?.weekly?.reduce((s: number, d: any) => s + d.count, 0) ?? 0;

  return (
    <div style={{ paddingTop: 8 }}>

      {/* ── SALOM BANNER ── */}
      <div style={{
        background: `linear-gradient(135deg, ${theme.accent}22, ${theme.accent}08)`,
        border: `1px solid ${theme.accent}25`,
        borderRadius: 20, padding: '24px 28px', marginBottom: 28,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Fon bezak */}
        <div style={{
          position: 'absolute', right: -20, top: -20,
          width: 140, height: 140, borderRadius: '50%',
          background: `${theme.accent}12`, pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', right: 40, bottom: -30,
          width: 80, height: 80, borderRadius: '50%',
          background: `${theme.accent}08`, pointerEvents: 'none',
        }} />

        <div>
          <p style={{ color: theme.text, opacity: 0.55, fontSize: 13, marginBottom: 4 }}>Xush kelibsiz! 👋</p>
          <h1 style={{ color: theme.text, fontSize: 26, fontWeight: 800, margin: 0 }}>
            {firstName}
          </h1>
          <p style={{ color: theme.accent, fontSize: 13, fontWeight: 500, marginTop: 4 }}>
            Bugun ham muvaffaqiyatli bo'ling! 🚀
          </p>
        </div>

        {/* Avatar */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}88)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 22, fontWeight: 700, flexShrink: 0,
          boxShadow: `0 8px 24px ${theme.accent}40`,
        }}>
          {firstName[0]?.toUpperCase() || '🧪'}
        </div>
      </div>

      {/* ── STATISTIKA ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
        {[
          { label: 'Jami testlar', value: stats?.totalAttempts ?? 0, icon: '📋', color: theme.accent },
          { label: "O'rtacha ball", value: stats?.avgScore ? `${Math.round(stats.avgScore)}%` : '—', icon: '📈', color: '#10b981' },
          { label: 'Bu hafta', value: weeklyCount, icon: '🔥', color: '#f59e0b' },
        ].map(({ label, value, icon, color }) => (
          <div key={label} style={{
            backgroundColor: theme.card, border: `1px solid ${theme.border}`,
            borderRadius: 16, padding: '16px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
            <p style={{ color, fontSize: 22, fontWeight: 800, margin: 0, lineHeight: 1 }}>{value}</p>
            <p style={{ color: theme.text, opacity: 0.45, fontSize: 11, marginTop: 5 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* ── TEST KATEGORIYALARI ── */}
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ color: theme.text, fontSize: 17, fontWeight: 700, margin: 0 }}>Test turlari</h2>
        <Link href="/tests" style={{ color: theme.accent, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
          Barchasi →
        </Link>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {TEST_CATEGORIES.map(({ href, icon, label, desc, color, gradient, border }) => (
          <Link key={href} href={href} style={{ textDecoration: 'none' }}>
            <div style={{
              background: gradient,
              border: `1px solid ${border}`,
              borderRadius: 16, padding: '16px 20px',
              display: 'flex', alignItems: 'center', gap: 16,
              transition: 'transform 0.15s, box-shadow 0.15s',
              cursor: 'pointer',
            }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${color}20`;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}>

              {/* Icon */}
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                backgroundColor: `${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22,
              }}>
                {icon}
              </div>

              {/* Info */}
              <div style={{ flex: 1 }}>
                <p style={{ color: theme.text, fontWeight: 700, fontSize: 15, margin: 0 }}>{label}</p>
                <p style={{ color: theme.text, opacity: 0.5, fontSize: 12, marginTop: 3 }}>{desc}</p>
              </div>

              {/* Arrow */}
              <div style={{
                width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                backgroundColor: `${color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color, fontSize: 14, fontWeight: 700,
              }}>
                →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── SO'NGGI URINISHLAR (agar bo'lsa) ── */}
      {stats?.recentAttempts?.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <h2 style={{ color: theme.text, fontSize: 17, fontWeight: 700, marginBottom: 12 }}>So'nggi testlar</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {stats.recentAttempts.slice(0, 3).map((a: any) => (
              <Link key={a.id} href={`/result/${a.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  backgroundColor: theme.card, border: `1px solid ${theme.border}`,
                  borderRadius: 12, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ color: theme.text, fontWeight: 600, fontSize: 13, margin: 0 }}>{a.test?.title}</p>
                    <p style={{ color: theme.text, opacity: 0.4, fontSize: 11, marginTop: 2 }}>
                      {new Date(a.finishedAt).toLocaleDateString('uz-UZ')}
                    </p>
                  </div>
                  <div style={{
                    padding: '4px 10px', borderRadius: 8,
                    backgroundColor: (a.score || 0) >= 60 ? '#10b98120' : '#ef444420',
                    color: (a.score || 0) >= 60 ? '#10b981' : '#ef4444',
                    fontWeight: 700, fontSize: 14,
                  }}>
                    {a.score ? `${Math.round(a.score)}%` : '—'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
