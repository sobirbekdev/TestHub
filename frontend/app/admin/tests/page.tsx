'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import { Test, TestType } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const TYPE_LABELS: Record<string, string> = {
  DTM_VARIANT: 'DTM', DTM_RANDOM: 'DTM Sinov', ATTESTATION: 'Atestatsiya',
  NATIONAL_CERT: 'Milliy Sert.', TOPIC: 'Mavzu',
};

export default function AdminTestsPage() {
  const { theme } = useThemeStore();
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'DTM_VARIANT', title: '', year: '', variantNo: '', price: '5000', duration: '60', totalQ: '30', authorName: '' });

  const loadTests = () => {
    api.get('/tests').then((r) => { setTests(r.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { loadTests(); }, []);

  const create = async () => {
    try {
      await api.post('/tests', {
        type: form.type,
        title: form.title,
        year: form.year ? parseInt(form.year) : undefined,
        variantNo: form.variantNo ? parseInt(form.variantNo) : undefined,
        price: parseInt(form.price),
        duration: parseInt(form.duration),
        totalQ: parseInt(form.totalQ),
        authorName: form.authorName || undefined,
      });
      toast.success("Test yaratildi!");
      setShowForm(false);
      loadTests();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xatolik');
    }
  };

  const toggle = async (test: Test) => {
    await api.patch(`/tests/${test.id}`, { isActive: !test.isActive });
    loadTests();
  };

  const remove = async (id: number) => {
    if (!confirm('Testni o\'chirasizmi?')) return;
    await api.delete(`/tests/${id}`).catch(() => toast.error('Xatolik'));
    loadTests();
  };

  const inp = (label: string, key: string, type = 'text') => (
    <div>
      <label style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>{label}</label>
      <input type={type} value={(form as any)[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        style={{ width: '100%', marginTop: 4, padding: '9px 12px', backgroundColor: theme.input,
          border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, fontSize: 14, outline: 'none' }} />
    </div>
  );

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700 }}>📋 Testlar</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 18px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
            color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          + Yangi test
        </button>
      </div>

      {showForm && (
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20, marginBottom: 20 }}>
          <h3 style={{ color: theme.text, fontWeight: 600, marginBottom: 16 }}>Yangi test</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>Tur</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                style={{ width: '100%', marginTop: 4, padding: '9px 12px', backgroundColor: theme.input,
                  border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }}>
                {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {inp('Sarlavha', 'title')}
            {inp('Yil (DTM uchun)', 'year', 'number')}
            {inp('Variant №', 'variantNo', 'number')}
            {inp("Narx (so'm)", 'price', 'number')}
            {inp('Muddati (daqiqa)', 'duration', 'number')}
            {inp('Savollar soni', 'totalQ', 'number')}
            {inp('Muallif (Sert. uchun)', 'authorName')}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={create}
              style={{ padding: '10px 24px', background: `linear-gradient(135deg, #10b981, #059669)`,
                color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
              ✓ Saqlash
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ padding: '10px 24px', backgroundColor: theme.input, border: `1px solid ${theme.border}`,
                color: theme.text, borderRadius: 10, cursor: 'pointer' }}>
              Bekor
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ color: theme.text, opacity: 0.4, padding: 40, textAlign: 'center' }}>Yuklanmoqda...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tests.map((test) => (
            <div key={test.id}
              style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, backgroundColor: `${theme.accent}20`, color: theme.accent, padding: '2px 7px', borderRadius: 5 }}>
                    {TYPE_LABELS[test.type]}
                  </span>
                  {test.year && <span style={{ fontSize: 11, color: theme.text, opacity: 0.4 }}>{test.year}</span>}
                  <span style={{ fontSize: 11, color: test.isActive ? '#10b981' : '#ef4444', backgroundColor: test.isActive ? '#10b98120' : '#ef444420', padding: '2px 7px', borderRadius: 5 }}>
                    {test.isActive ? 'Faol' : 'Yopiq'}
                  </span>
                </div>
                <p style={{ color: theme.text, fontWeight: 500, fontSize: 14 }}>{test.title}</p>
                <p style={{ color: theme.text, opacity: 0.4, fontSize: 12 }}>
                  {test.duration} daq · {test.totalQ} savol · {test.price === 0 ? 'Bepul' : `${test.price.toLocaleString()} so'm`}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => toggle(test)}
                  style={{ padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                    backgroundColor: test.isActive ? '#ef444420' : '#10b98120', color: test.isActive ? '#ef4444' : '#10b981' }}>
                  {test.isActive ? 'Yopish' : 'Ochish'}
                </button>
                <button onClick={() => remove(test.id)}
                  style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, backgroundColor: '#ef444420', color: '#ef4444', border: 'none', cursor: 'pointer' }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
