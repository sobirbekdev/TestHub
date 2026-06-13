'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import { Group, Test } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type Assignment = {
  id: number;
  groupId: number;
  startsAt: string | null;
  endsAt: string | null;
  group: { id: number; name: string };
};

export default function AdminGroupTestsPage() {
  const { theme } = useThemeStore();
  const [tests, setTests] = useState<Test[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [testId, setTestId] = useState<number | null>(null);
  const [groupId, setGroupId] = useState<number | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pending, setPending] = useState<Record<number, { id: number; name: string | null; phone: string }[]>>({});

  useEffect(() => {
    Promise.all([api.get('/tests?type=TOPIC'), api.get('/groups')])
      .then(([t, g]) => { setTests(t.data); setGroups(g.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadAssignments = (id: number) => {
    api.get(`/tests/${id}/groups`).then((r) => setAssignments(r.data)).catch(() => setAssignments([]));
  };

  const selectTest = (id: number) => {
    setTestId(id);
    loadAssignments(id);
  };

  const assign = async () => {
    if (!testId || !groupId) return toast.error('Test va guruhni tanlang');
    setSaving(true);
    try {
      await api.post(`/tests/${testId}/open-group`, {
        groupId,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      toast.success('Test guruhga ochildi');
      loadAssignments(testId);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xatolik');
    }
    setSaving(false);
  };

  const loadPending = async (gId: number) => {
    if (!testId) return;
    if (pending[gId]) {
      setPending((p) => { const n = { ...p }; delete n[gId]; return n; });
      return;
    }
    try {
      const { data } = await api.get(`/telegram/non-completers/${testId}/${gId}`);
      setPending((p) => ({ ...p, [gId]: data }));
    } catch { toast.error('Xatolik'); }
  };

  const notify = async (gId: number) => {
    if (!testId) return;
    try {
      const { data } = await api.post('/telegram/notify-curator', { testId, groupId: gId });
      if (data.ok) toast.success(`Kuratorga yuborildi (${data.count} kishi)`);
      else toast.error(data.message || 'Yuborilmadi');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Xatolik'); }
  };

  const close = async (gId: number) => {
    if (!testId) return;
    if (!confirm('Guruhdan yopilsinmi?')) return;
    await api.post(`/tests/${testId}/close-group`, { groupId: gId }).catch(() => {});
    loadAssignments(testId);
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', backgroundColor: theme.card,
    border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 10, outline: 'none', fontSize: 14,
  };

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>;

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 6 }}>📚 Guruh testlari</h1>
      <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 20 }}>
        Mavzulashtirilgan testni guruhga oching va boshlanish/tugash vaqtini belgilang.
      </p>

      {/* Test tanlash */}
      <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
        <p style={{ color: theme.text, opacity: 0.6, fontSize: 13, marginBottom: 8 }}>Test (TOPIC)</p>
        {tests.length === 0 ? (
          <p style={{ color: theme.text, opacity: 0.4, fontSize: 13 }}>Mavzulashtirilgan testlar yo'q</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {tests.map((t) => {
              const active = t.id === testId;
              return (
                <button key={t.id} onClick={() => selectTest(t.id)}
                  style={{
                    padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${active ? theme.accent : theme.border}`,
                    backgroundColor: active ? `${theme.accent}20` : theme.input,
                    color: active ? theme.accent : theme.text, cursor: 'pointer',
                  }}>
                  {t.title}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {testId && (
        <>
          {/* Yangi biriktirish */}
          <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
            <p style={{ color: theme.text, fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Guruhga ochish</p>
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <label style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>Guruh</label>
                <select value={groupId ?? ''} onChange={(e) => setGroupId(Number(e.target.value) || null)} style={{ ...inp, marginTop: 4 }}>
                  <option value="">— Guruhni tanlang —</option>
                  {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>Boshlanish (ixtiyoriy)</label>
                  <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} style={{ ...inp, marginTop: 4 }} />
                </div>
                <div>
                  <label style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>Tugash (ixtiyoriy)</label>
                  <input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} style={{ ...inp, marginTop: 4 }} />
                </div>
              </div>
              <button onClick={assign} disabled={saving}
                style={{
                  padding: '11px', borderRadius: 10, border: 'none', fontWeight: 600,
                  background: theme.accent, color: '#fff', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
                }}>
                {saving ? 'Saqlanmoqda...' : 'Ochish / Yangilash'}
              </button>
            </div>
          </div>

          {/* Mavjud biriktirishlar */}
          <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18 }}>
            <p style={{ color: theme.text, fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Ochilgan guruhlar</p>
            {assignments.length === 0 ? (
              <p style={{ color: theme.text, opacity: 0.4, fontSize: 13 }}>Hali hech bir guruhga ochilmagan</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {assignments.map((a) => (
                  <div key={a.id} style={{ padding: '10px 12px', backgroundColor: theme.input, borderRadius: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ color: theme.text, fontWeight: 600, fontSize: 14 }}>{a.group.name}</p>
                        <p style={{ color: theme.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>
                          🔓 {fmt(a.startsAt)} → ⏳ {fmt(a.endsAt)}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => loadPending(a.groupId)}
                          style={{ padding: '6px 10px', backgroundColor: `${theme.accent}20`, color: theme.accent, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12 }}>
                          {pending[a.groupId] ? 'Yashirish' : 'Ishlamaganlar'}
                        </button>
                        <button onClick={() => notify(a.groupId)}
                          style={{ padding: '6px 10px', backgroundColor: '#10b98120', color: '#10b981', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12 }}>
                          📨 Kuratorga
                        </button>
                        <button onClick={() => close(a.groupId)}
                          style={{ padding: '6px 10px', backgroundColor: '#ef444420', color: '#ef4444', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12 }}>
                          Yopish
                        </button>
                      </div>
                    </div>
                    {pending[a.groupId] && (
                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.border}` }}>
                        {pending[a.groupId].length === 0 ? (
                          <p style={{ color: '#10b981', fontSize: 13 }}>✅ Barcha a'zolar ishlagan</p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <p style={{ color: theme.text, opacity: 0.6, fontSize: 12, marginBottom: 4 }}>
                              Ishlamaganlar ({pending[a.groupId].length}):
                            </p>
                            {pending[a.groupId].map((u, i) => (
                              <p key={u.id} style={{ color: theme.text, fontSize: 13 }}>
                                {i + 1}. {u.name || u.phone}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
