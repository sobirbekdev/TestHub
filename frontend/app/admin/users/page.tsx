'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import { User, Role } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const ROLE_LABELS: Record<Role, string> = { STUDENT: 'Talaba', CURATOR: 'Kurator', TEACHER: "O'qituvchi", SUPER_ADMIN: 'Super Admin' };
const ROLE_COLORS: Record<Role, string> = { STUDENT: '#6b7280', CURATOR: '#8b5cf6', TEACHER: '#3b82f6', SUPER_ADMIN: '#ef4444' };

export default function AdminUsersPage() {
  const { theme } = useThemeStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [staff, setStaff] = useState({ phone: '', name: '', role: 'CURATOR' as Role });
  const [adding, setAdding] = useState(false);

  const load = () => api.get('/users').then((r) => { setUsers(r.data); setLoading(false); }).catch(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const changeRole = async (id: number, role: Role) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
      toast.success('Rol o\'zgartirildi');
    } catch { toast.error('Xatolik'); }
  };

  const addStaff = async () => {
    if (!staff.phone.trim()) return toast.error('Telefon raqamini kiriting');
    setAdding(true);
    try {
      await api.post('/users/staff', { phone: staff.phone.trim(), role: staff.role, name: staff.name.trim() || undefined });
      toast.success(`${ROLE_LABELS[staff.role]} qo'shildi`);
      setStaff({ phone: '', name: '', role: 'CURATOR' });
      await load();
    } catch (e: any) { toast.error(e.response?.data?.message || 'Xatolik'); }
    setAdding(false);
  };

  const inp: React.CSSProperties = {
    padding: '9px 12px', backgroundColor: theme.card, border: `1px solid ${theme.border}`,
    color: theme.text, borderRadius: 9, outline: 'none', fontSize: 14,
  };

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
        👤 Foydalanuvchilar {loading ? '' : `(${users.length})`}
      </h1>

      {/* Kurator/o'qituvchi qo'shish */}
      <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16, marginBottom: 20 }}>
        <p style={{ color: theme.text, fontWeight: 600, fontSize: 14, marginBottom: 10 }}>➕ Kurator / O'qituvchi qo'shish</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input value={staff.phone} onChange={(e) => setStaff((p) => ({ ...p, phone: e.target.value }))}
            placeholder="+998901234567" style={{ ...inp, flex: '1 1 160px' }} />
          <input value={staff.name} onChange={(e) => setStaff((p) => ({ ...p, name: e.target.value }))}
            placeholder="Ism (ixtiyoriy)" style={{ ...inp, flex: '1 1 140px' }} />
          <select value={staff.role} onChange={(e) => setStaff((p) => ({ ...p, role: e.target.value as Role }))} style={inp}>
            <option value="CURATOR">Kurator</option>
            <option value="TEACHER">O'qituvchi</option>
          </select>
          <button onClick={addStaff} disabled={adding}
            style={{ padding: '9px 20px', background: theme.accent, color: '#fff', borderRadius: 9, fontWeight: 600, border: 'none', cursor: adding ? 'default' : 'pointer', opacity: adding ? 0.6 : 1 }}>
            {adding ? '...' : "Qo'shish"}
          </button>
        </div>
        <p style={{ color: theme.text, opacity: 0.45, fontSize: 12, marginTop: 8 }}>
          Kuratorlar faqat o'zlariga biriktirilgan guruhlarni boshqaradi. Guruhga biriktirish — Guruhlar bo'limida.
        </p>
      </div>

      {loading ? (
        <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.map((u) => (
            <div key={u.id} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: theme.text, fontWeight: 500 }}>{u.name || '—'}</p>
                <p style={{ color: theme.text, opacity: 0.5, fontSize: 13 }}>{u.phone}</p>
              </div>
              <select value={u.role} onChange={(e) => changeRole(u.id, e.target.value as Role)}
                style={{ padding: '6px 10px', backgroundColor: `${ROLE_COLORS[u.role]}20`, border: `1px solid ${ROLE_COLORS[u.role]}`,
                  color: ROLE_COLORS[u.role], borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer', outline: 'none' }}>
                {(Object.keys(ROLE_LABELS) as Role[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
