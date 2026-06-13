'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import { Group } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type Staff = { id: number; name: string | null; phone: string; role: string };

export default function AdminGroupsPage() {
  const { theme } = useThemeStore();
  const [groups, setGroups] = useState<Group[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/groups').then((r) => { setGroups(r.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => {
    load();
    // Kuratorlar ro'yxati (faqat SUPER_ADMIN/TEACHER ko'ra oladi)
    api.get('/users')
      .then((r) => setStaff((r.data as Staff[]).filter((u) => u.role === 'CURATOR' || u.role === 'TEACHER')))
      .catch(() => {});
  }, []);

  const setCurator = async (groupId: number, curatorId: number | null) => {
    try {
      await api.patch(`/groups/${groupId}/curator`, { curatorId });
      toast.success('Kurator saqlandi');
      load();
    } catch { toast.error('Xatolik'); }
  };

  const create = async () => {
    if (!name.trim()) return;
    try { await api.post('/groups', { name }); toast.success("Guruh yaratildi"); setName(''); load(); }
    catch { toast.error('Xatolik'); }
  };

  const remove = async (id: number) => {
    if (!confirm("O'chirasizmi?")) return;
    await api.delete(`/groups/${id}`).catch(() => {});
    load();
  };

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 20 }}>👥 Guruhlar</h1>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Guruh nomi"
          onKeyDown={(e) => e.key === 'Enter' && create()}
          style={{ flex: 1, padding: '10px 14px', backgroundColor: theme.card, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 10, outline: 'none' }} />
        <button onClick={create}
          style={{ padding: '10px 20px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          + Yaratish
        </button>
      </div>
      {loading ? <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {groups.map((g) => (
            <div key={g.id} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ color: theme.text, fontWeight: 600 }}>{g.name}</p>
                  <p style={{ color: theme.text, opacity: 0.4, fontSize: 12 }}>{g._count?.users ?? 0} a'zo</p>
                </div>
                <button onClick={() => remove(g.id)} style={{ padding: '5px 10px', backgroundColor: '#ef444420', color: '#ef4444', borderRadius: 8, border: 'none', cursor: 'pointer' }}>🗑</button>
              </div>
              {staff.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: theme.text, opacity: 0.5, fontSize: 12 }}>Kurator:</span>
                  <select
                    value={g.curatorId ?? ''}
                    onChange={(e) => setCurator(g.id, Number(e.target.value) || null)}
                    style={{ flex: 1, padding: '7px 10px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, fontSize: 13, outline: 'none' }}>
                    <option value="">— Tanlanmagan —</option>
                    {staff.map((s) => (
                      <option key={s.id} value={s.id}>{s.name || s.phone}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
