'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useThemeStore } from '@/store/theme';
import { useAuthStore } from '@/store/auth';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type GroupTest = {
  testId: number;
  title: string;
  totalQ: number;
  duration: number;
  startsAt: string | null;
  endsAt: string | null;
  status: 'LOCKED' | 'OPEN' | 'CLOSED' | 'DONE';
  attemptId: number | null;
  attemptStatus: string | null;
  score: number | null;
};

const STATUS_META: Record<GroupTest['status'], { label: string; color: string; icon: string }> = {
  OPEN: { label: 'Ochiq', color: '#10b981', icon: '🟢' },
  LOCKED: { label: 'Qulflangan', color: '#f59e0b', icon: '🔒' },
  CLOSED: { label: 'Yopilgan', color: '#ef4444', icon: '⛔' },
  DONE: { label: 'Ishlangan', color: '#6366f1', icon: '✅' },
};

function fmt(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleString('uz-UZ', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

export default function GroupTestsPage() {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const router = useRouter();
  const [tests, setTests] = useState<GroupTest[]>([]);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tests/group')
      .then((r) => { setTests(r.data.tests); setGroupId(r.data.groupId); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const startTest = async (t: GroupTest) => {
    if (t.status === 'DONE' && t.attemptId) {
      router.push(`/result/${t.attemptId}`);
      return;
    }
    if (t.status !== 'OPEN') return;
    try {
      const { data } = await api.post('/attempts/start', { testId: t.testId });
      router.push(`/test/${data.id}?testId=${t.testId}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xatolik');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', color: theme.text, opacity: 0.4, padding: 60 }}>Yuklanmoqda...</div>;
  }

  if (!groupId) {
    return (
      <div className="animate-fade-in" style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>👥</div>
        <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Guruh tanlanmagan</h1>
        <p style={{ color: theme.text, opacity: 0.55, fontSize: 14, marginBottom: 20 }}>
          Guruh testlarini ishlash uchun avval profildan guruhingizni tanlang.
        </p>
        <Link href="/profile" style={{
          display: 'inline-block', padding: '11px 24px', borderRadius: 12,
          background: theme.accent, color: '#fff', fontWeight: 600, textDecoration: 'none',
        }}>
          Guruhni tanlash →
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, margin: 0 }}>👥 Guruh testlari</h1>
        <Link href="/profile" style={{ color: theme.accent, fontSize: 13, textDecoration: 'none', fontWeight: 500 }}>
          Guruhni almashtirish
        </Link>
      </div>

      {tests.length === 0 ? (
        <div style={{ textAlign: 'center', color: theme.text, opacity: 0.4, padding: 60 }}>
          Hozircha guruhingizga test ochilmagan
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tests.map((t) => {
            const meta = STATUS_META[t.status];
            const clickable = t.status === 'OPEN' || t.status === 'DONE';
            return (
              <div key={t.testId} style={{
                backgroundColor: theme.card, border: `1px solid ${theme.border}`,
                borderRadius: 14, padding: '14px 18px',
                opacity: t.status === 'LOCKED' || t.status === 'CLOSED' ? 0.7 : 1,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                        backgroundColor: `${meta.color}20`, color: meta.color,
                      }}>
                        {meta.icon} {meta.label}
                      </span>
                      {t.status === 'DONE' && t.score != null && (
                        <span style={{ fontSize: 11, color: theme.text, opacity: 0.55 }}>
                          Natija: {Math.round(t.score)}%
                        </span>
                      )}
                    </div>
                    <p style={{ color: theme.text, fontWeight: 600, fontSize: 15, margin: 0 }}>{t.title}</p>
                    <p style={{ color: theme.text, opacity: 0.4, fontSize: 12, marginTop: 4 }}>
                      ⏱ {t.duration} daqiqa · ❓ {t.totalQ} savol
                    </p>
                    {(t.startsAt || t.endsAt) && (
                      <p style={{ color: theme.text, opacity: 0.5, fontSize: 11, marginTop: 4 }}>
                        {t.status === 'LOCKED' && t.startsAt && `🔓 Ochiladi: ${fmt(t.startsAt)}`}
                        {t.status === 'OPEN' && t.endsAt && `⏳ Tugaydi: ${fmt(t.endsAt)}`}
                        {t.status === 'CLOSED' && t.endsAt && `Tugagan: ${fmt(t.endsAt)}`}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => startTest(t)}
                    disabled={!clickable}
                    style={{
                      marginLeft: 12, padding: '8px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13,
                      whiteSpace: 'nowrap', border: 'none',
                      cursor: clickable ? 'pointer' : 'not-allowed',
                      background: t.status === 'OPEN'
                        ? 'linear-gradient(135deg, #10b981, #059669)'
                        : t.status === 'DONE'
                          ? `${theme.accent}20`
                          : theme.input,
                      color: t.status === 'OPEN' ? '#fff' : t.status === 'DONE' ? theme.accent : theme.text,
                      opacity: clickable ? 1 : 0.6,
                    }}>
                    {t.status === 'OPEN' ? '▶ Boshlash'
                      : t.status === 'DONE' ? 'Natija'
                      : t.status === 'LOCKED' ? '🔒 Qulf'
                      : '⛔ Yopiq'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
