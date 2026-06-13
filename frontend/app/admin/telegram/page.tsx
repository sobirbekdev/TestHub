'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function AdminTelegramPage() {
  const { theme } = useThemeStore();
  const [testId, setTestId] = useState('');
  const [videos, setVideos] = useState<any[]>([]);
  const [form, setForm] = useState({ testId: '', questionNo: '', fileId: '' });

  const loadVideos = () => {
    if (!testId) return;
    api.get(`/telegram/videos/${testId}`).then((r) => setVideos(r.data)).catch(() => {});
  };

  useEffect(() => { loadVideos(); }, [testId]);

  const save = async () => {
    try {
      await api.post('/telegram/videos', { testId: parseInt(form.testId), questionNo: parseInt(form.questionNo), fileId: form.fileId });
      toast.success('Video biriktirildi!');
      setTestId(form.testId);
      loadVideos();
    } catch { toast.error('Xatolik'); }
  };

  const remove = async (testId: number, questionNo: number) => {
    await api.delete(`/telegram/videos/${testId}/${questionNo}`);
    loadVideos();
  };

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>📹 Telegram Video</h1>
      <p style={{ color: theme.text, opacity: 0.4, fontSize: 13, marginBottom: 20 }}>Video Telegram kanaliga yuklang → Bot file_id ni oling → Bu yerga kiriting</p>

      <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20, marginBottom: 20 }}>
        <h3 style={{ color: theme.text, fontWeight: 600, marginBottom: 14 }}>Video biriktirish</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          {[['Test ID', 'testId'], ['Savol №', 'questionNo']].map(([label, key]) => (
            <div key={key}>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>{label}</label>
              <input type="number" value={(form as any)[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                style={{ width: '100%', marginTop: 4, padding: '9px 12px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }} />
            </div>
          ))}
        </div>
        <div>
          <label style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>Telegram file_id</label>
          <input value={form.fileId} onChange={(e) => setForm((f) => ({ ...f, fileId: e.target.value }))}
            placeholder="BAACAgIAAxkBAAI..."
            style={{ width: '100%', marginTop: 4, padding: '9px 12px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }} />
        </div>
        <button onClick={save} style={{ marginTop: 12, padding: '9px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          ✓ Saqlash
        </button>
      </div>

      {/* Test ID bilan qidirish */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
        <input value={testId} onChange={(e) => setTestId(e.target.value)} placeholder="Test ID kiriting..."
          style={{ flex: 1, padding: '9px 12px', backgroundColor: theme.card, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 10, outline: 'none' }} />
        <button onClick={loadVideos} style={{ padding: '9px 18px', backgroundColor: `${theme.accent}20`, color: theme.accent, border: `1px solid ${theme.accent}`, borderRadius: 10, cursor: 'pointer', fontWeight: 600 }}>
          Yuklash
        </button>
      </div>

      {videos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {videos.map((v) => (
            <div key={v.id} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: theme.text, fontWeight: 600 }}>{v.questionNo}-savol</p>
                <p style={{ color: theme.text, opacity: 0.4, fontSize: 12, fontFamily: 'monospace' }}>{v.fileId.slice(0, 30)}...</p>
              </div>
              <button onClick={() => remove(v.testId, v.questionNo)}
                style={{ padding: '5px 10px', backgroundColor: '#ef444420', color: '#ef4444', borderRadius: 8, border: 'none', cursor: 'pointer' }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
