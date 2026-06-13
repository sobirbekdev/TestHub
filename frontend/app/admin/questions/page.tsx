'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import { Question, Difficulty, QuestionType } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const DIFF_COLORS: Record<string, string> = { EASY: '#10b981', MEDIUM: '#f59e0b', HARD: '#ef4444' };
const DIFF_LABELS: Record<string, string> = { EASY: 'Oson', MEDIUM: "O'rta", HARD: 'Qiyin' };
const TYPE_LABELS: Record<string, string> = { TEXT: 'Yozma', IMAGE: 'Rasmli', GRAPH: 'Grafikli', THEORY: 'Nazariy', OPEN: 'Ochiq', MULTI: "Ko'p javob", REACTIONS: 'Reaksiyalar' };

export default function AdminQuestionsPage() {
  const { theme } = useThemeStore();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterDiff, setFilterDiff] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ text: '', difficulty: 'MEDIUM', qType: 'TEXT', options: [
    { label: 'A', text: '', isCorrect: false },
    { label: 'B', text: '', isCorrect: false },
    { label: 'C', text: '', isCorrect: false },
    { label: 'D', text: '', isCorrect: false },
  ]});

  const load = () => {
    const q = filterDiff ? `?difficulty=${filterDiff}` : '';
    api.get(`/questions${q}`).then((r) => { setQuestions(r.data); setLoading(false); }).catch(() => setLoading(false));
    api.get('/questions/stats').then((r) => setStats(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [filterDiff]);

  const create = async () => {
    try {
      await api.post('/questions', { text: form.text, difficulty: form.difficulty, qType: form.qType, options: form.options });
      toast.success('Savol yaratildi!');
      setShowForm(false);
      load();
    } catch { toast.error('Xatolik'); }
  };

  const remove = async (id: number) => {
    if (!confirm('O\'chirasizmi?')) return;
    await api.delete(`/questions/${id}`).catch(() => {});
    load();
  };

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700 }}>❓ Savollar {stats ? `(${stats.total})` : ''}</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{ padding: '8px 16px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', cursor: 'pointer' }}>
          + Yangi
        </button>
      </div>

      {/* Statistika chiplari */}
      {stats && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {stats.byDifficulty?.map((d: any) => (
            <button key={d.difficulty} onClick={() => setFilterDiff(filterDiff === d.difficulty ? '' : d.difficulty)}
              style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer',
                backgroundColor: filterDiff === d.difficulty ? DIFF_COLORS[d.difficulty] : `${DIFF_COLORS[d.difficulty]}20`,
                color: filterDiff === d.difficulty ? '#fff' : DIFF_COLORS[d.difficulty] }}>
              {DIFF_LABELS[d.difficulty]}: {d.count}
            </button>
          ))}
        </div>
      )}

      {/* Yangi savol formasi */}
      {showForm && (
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
          <h3 style={{ color: theme.text, fontWeight: 600, marginBottom: 14 }}>Yangi savol</h3>
          <textarea value={form.text} onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
            placeholder="Savol matni..."
            style={{ width: '100%', padding: '10px', backgroundColor: theme.input, border: `1px solid ${theme.border}`,
              color: theme.text, borderRadius: 8, marginBottom: 12, minHeight: 70, outline: 'none' }} />
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <select value={form.difficulty} onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
              style={{ flex: 1, padding: '8px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }}>
              {Object.entries(DIFF_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={form.qType} onChange={(e) => setForm((f) => ({ ...f, qType: e.target.value }))}
              style={{ flex: 1, padding: '8px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {form.options.map((opt, i) => (
            <div key={opt.label} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ color: theme.accent, fontWeight: 700, width: 20 }}>{opt.label}</span>
              <input value={opt.text} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((o, j) => j === i ? { ...o, text: e.target.value } : o) }))}
                placeholder={`${opt.label} varianti`}
                style={{ flex: 1, padding: '8px 10px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }} />
              <input type="checkbox" checked={opt.isCorrect} onChange={(e) => setForm((f) => ({ ...f, options: f.options.map((o, j) => j === i ? { ...o, isCorrect: e.target.checked } : o) }))} />
              <label style={{ color: theme.text, fontSize: 12 }}>To'g'ri</label>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button onClick={create} style={{ padding: '9px 20px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: 10, fontWeight: 600, border: 'none', cursor: 'pointer' }}>✓ Saqlash</button>
            <button onClick={() => setShowForm(false)} style={{ padding: '9px 16px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 10, cursor: 'pointer' }}>Bekor</button>
          </div>
        </div>
      )}

      {loading ? <div style={{ color: theme.text, opacity: 0.4, padding: 40, textAlign: 'center' }}>Yuklanmoqda...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {questions.map((q) => (
            <div key={q.id} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: DIFF_COLORS[(q as any).difficulty], backgroundColor: `${DIFF_COLORS[(q as any).difficulty]}20`, padding: '2px 7px', borderRadius: 5 }}>{DIFF_LABELS[(q as any).difficulty]}</span>
                  <span style={{ fontSize: 11, color: theme.accent, backgroundColor: `${theme.accent}15`, padding: '2px 7px', borderRadius: 5 }}>{TYPE_LABELS[q.qType]}</span>
                </div>
                <p style={{ color: theme.text, fontSize: 13 }}>{q.text.slice(0, 120)}{q.text.length > 120 ? '...' : ''}</p>
              </div>
              <button onClick={() => remove(q.id)} style={{ padding: '5px 10px', borderRadius: 7, backgroundColor: '#ef444420', color: '#ef4444', border: 'none', cursor: 'pointer', flexShrink: 0 }}>🗑</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
