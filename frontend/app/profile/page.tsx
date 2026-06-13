'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/theme';
import { useAuthStore } from '@/store/auth';
import { Group, User } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ThemeWrapper from '@/components/layout/ThemeWrapper';
import Navbar from '@/components/layout/Navbar';

export default function ProfilePage() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { setAuth, token, logout } = useAuthStore();
  const [me, setMe] = useState<User | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState('');
  const [groupId, setGroupId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [meRes, grRes] = await Promise.all([
          api.get('/auth/me'),
          api.get('/groups'),
        ]);
        setMe(meRes.data);
        setName(meRes.data.name || '');
        setGroupId(meRes.data.groupId ?? null);
        setGroups(grRes.data);
      } catch {
        toast.error('Ma\'lumotlarni yuklab bo\'lmadi');
      }
      setLoading(false);
    })();
  }, []);

  const saveName = async () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error('Ism kamida 2 ta harf bo\'lsin');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.patch('/users/me/name', { name: trimmed });
      if (me && token) setAuth({ ...me, ...data }, token);
      setMe((m) => (m ? { ...m, name: data.name } : m));
      toast.success('Ism saqlandi');
    } catch {
      toast.error('Saqlanmadi');
    }
    setSaving(false);
  };

  const saveGroup = async (newGroupId: number) => {
    setGroupId(newGroupId);
    try {
      const { data } = await api.patch('/users/me/group', { groupId: newGroupId });
      setMe((m) => (m ? { ...m, groupId: data.groupId, group: data.group } : m));
      if (me && token) setAuth({ ...me, groupId: data.groupId, group: data.group }, token);
      toast.success('Guruh tanlandi');
    } catch {
      toast.error('Guruh saqlanmadi');
    }
  };

  if (loading) {
    return (
      <ThemeWrapper>
        <Navbar />
        <div style={{ padding: 40, textAlign: 'center', color: theme.text, opacity: 0.5 }}>
          Yuklanmoqda...
        </div>
      </ThemeWrapper>
    );
  }

  return (
    <ThemeWrapper>
      <Navbar />
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 16px', paddingBottom: 100 }}>
        <h1 style={{ color: theme.text, fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
          👤 Profil
        </h1>

        {/* Telefon */}
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 4 }}>Telefon raqam</p>
          <p style={{ color: theme.text, fontSize: 16, fontWeight: 600 }}>{me?.phone}</p>
        </div>

        {/* Ism familiya */}
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18, marginBottom: 16 }}>
          <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 8 }}>Ism familiya</p>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Masalan: Jamshid Karimov"
            style={{
              width: '100%', padding: '12px 14px', borderRadius: 10,
              border: `1px solid ${theme.border}`, backgroundColor: theme.input,
              color: theme.text, fontSize: 15, outline: 'none', marginBottom: 12,
            }}
          />
          <button onClick={saveName} disabled={saving}
            style={{
              padding: '10px 24px', borderRadius: 10, border: 'none',
              backgroundColor: theme.accent, color: '#fff', fontWeight: 600,
              cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.6 : 1,
            }}>
            {saving ? 'Saqlanmoqda...' : 'Saqlash'}
          </button>
        </div>

        {/* Guruh */}
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 18 }}>
          <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 4 }}>Guruhingiz</p>
          <p style={{ color: theme.text, opacity: 0.45, fontSize: 12, marginBottom: 12 }}>
            Guruhni tanlang. Keyinchalik boshqa guruhga o'tishingiz mumkin.
          </p>
          {groups.length === 0 ? (
            <p style={{ color: theme.text, opacity: 0.4, fontSize: 13 }}>Guruhlar yo'q</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {groups.map((g) => {
                const active = g.id === groupId;
                return (
                  <button key={g.id} onClick={() => saveGroup(g.id)}
                    style={{
                      padding: '8px 16px', borderRadius: 10, fontSize: 14, fontWeight: 600,
                      border: `1px solid ${active ? theme.accent : theme.border}`,
                      backgroundColor: active ? `${theme.accent}20` : theme.input,
                      color: active ? theme.accent : theme.text, cursor: 'pointer',
                    }}>
                    {g.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Chiqish */}
        <button onClick={() => { logout(); router.push('/login'); }}
          style={{
            marginTop: 24, width: '100%', padding: '12px', borderRadius: 12,
            border: `1px solid #ef444450`, backgroundColor: '#ef444415',
            color: '#ef4444', fontWeight: 600, fontSize: 15, cursor: 'pointer',
          }}>
          Chiqish
        </button>
      </div>
    </ThemeWrapper>
  );
}
