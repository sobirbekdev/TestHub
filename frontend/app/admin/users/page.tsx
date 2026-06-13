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

  useEffect(() => {
    api.get('/users').then((r) => { setUsers(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const changeRole = async (id: number, role: Role) => {
    try {
      await api.patch(`/users/${id}/role`, { role });
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
      toast.success('Rol o\'zgartirildi');
    } catch { toast.error('Xatolik'); }
  };

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 20 }}>
        👤 Foydalanuvchilar {loading ? '' : `(${users.length})`}
      </h1>
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
