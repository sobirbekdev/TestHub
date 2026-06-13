'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminAiPage() {
  const { theme } = useThemeStore();
  const [pending, setPending] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    api.get('/ai/pending').then((r) => { setPending(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const manualScore = async (id: number, score: number) => {
    await api.patch(`/ai/answers/${id}/score`, { score });
    toast.success('Ball saqlandi');
    load();
  };

  const recheck = async (id: number) => {
    await api.patch(`/ai/answers/${id}/recheck`);
    toast.success('Qayta yuborildi');
    load();
  };

  const statusColor: Record<string, string> = { PENDING: '#f59e0b', RECHECK: '#8b5cf6', CONFIRMED: '#10b981', MANUAL: '#6366f1' };

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 20 }}>🤖 AI Tekshiruv</h1>
      <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 20 }}>Gemini Flash — oyiga 1500 so'rov (bepul tier)</p>

      {loading ? (
        <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>
      ) : pending.length === 0 ? (
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 32 }}>✅</p>
          <p style={{ color: theme.text, opacity: 0.5, marginTop: 8 }}>Tekshirishni kutayotgan javoblar yo'q</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.map((ans) => (
            <div key={ans.id} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: statusColor[ans.aiStatus], backgroundColor: `${statusColor[ans.aiStatus]}20`, padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                  {ans.aiStatus}
                </span>
                <span style={{ color: theme.text, opacity: 0.4, fontSize: 12 }}>{ans.attempt?.user?.phone}</span>
              </div>
              <p style={{ color: theme.text, fontSize: 13, marginBottom: 8 }}>📝 {ans.question?.text?.slice(0, 100)}</p>
              <p style={{ color: theme.text, opacity: 0.5, fontSize: 12, marginBottom: 12 }}>Test: {ans.attempt?.test?.title}</p>
              {ans.imageUrl && (
                <img src={ans.imageUrl} alt="" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginBottom: 12 }} />
              )}
              {(ans.aiComment || ans.aiScore != null) && (
                <div style={{ backgroundColor: theme.input, borderRadius: 10, padding: 12, marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: ans.aiComment ? 6 : 0 }}>
                    <span style={{ color: theme.text, opacity: 0.6, fontSize: 12, fontWeight: 600 }}>🤖 AI baho</span>
                    {ans.aiScore != null && (
                      <span style={{ color: ans.aiScore > 0 ? '#10b981' : '#ef4444', fontWeight: 700, fontSize: 13 }}>{ans.aiScore} ball</span>
                    )}
                  </div>
                  {ans.aiComment && (
                    <p style={{ color: theme.text, opacity: 0.75, fontSize: 12, lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>{ans.aiComment}</p>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[0, 25, 50, 75, 100].map((score) => (
                  <button key={score} onClick={() => manualScore(ans.id, score)}
                    style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${theme.border}`,
                      backgroundColor: theme.input, color: theme.text, cursor: 'pointer' }}>
                    {score}%
                  </button>
                ))}
                <button onClick={() => recheck(ans.id)}
                  style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    backgroundColor: '#8b5cf620', color: '#8b5cf6', border: 'none', cursor: 'pointer' }}>
                  🔄 Qayta
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
