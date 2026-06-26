'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import { Group, Test } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const OPTS = ['A', 'B', 'C', 'D'];
type QMode = 'answers' | 'image' | 'pdf';

interface TQ { orderNo: number; imageUrl?: string; questionText?: string; correctAnswer?: string; scorePoint?: number; }

type Assignment = {
  id: number;
  groupId: number;
  startsAt: string | null;
  endsAt: string | null;
  group: { id: number; name: string; telegramChatId?: string | null };
};

function extractOrderNo(filename: string): number | null {
  const match = filename.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

// Vaqt yordamchilari — input maydonlari har doim ayni vaqtdan boshlab to'ldirilgan tursin
const pad2 = (n: number) => String(n).padStart(2, '0');
// datetime-local input formati: "YYYY-MM-DDTHH:mm" (mahalliy vaqt)
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
// hozirgi vaqtdan h soat keyin
const nowPlusHours = (h: number) => toLocalInput(new Date(Date.now() + h * 3600 * 1000));

export default function AdminGroupTestsPage() {
  const { theme } = useThemeStore();
  const [tests, setTests] = useState<Test[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selected, setSelected] = useState<Test | null>(null);
  const [loading, setLoading] = useState(true);

  // Yaratish formasi
  const [showCreate, setShowCreate] = useState(false);
  const [nt, setNt] = useState({ examNo: '', topics: '', totalQ: '', duration: '', price: '' });
  const [creating, setCreating] = useState(false);

  // Savol muharriri
  const [questions, setQuestions] = useState<TQ[]>([]);
  const [videos, setVideos] = useState<Record<number, string>>({});
  const [qLoading, setQLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'videos' | 'groups'>('questions');
  const [qMode, setQMode] = useState<QMode>('answers');
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [pasteTarget, setPasteTarget] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // Guruhga biriktirish
  const [groupId, setGroupId] = useState<number | null>(null);
  // Boshlanish = ayni vaqt, Tugash = +2 soat (har doim to'ldirilgan)
  const [startsAt, setStartsAt] = useState(() => nowPlusHours(0));
  const [endsAt, setEndsAt] = useState(() => nowPlusHours(2));
  const [assignSaving, setAssignSaving] = useState(false);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [pending, setPending] = useState<Record<number, { id: number; name: string | null; phone: string }[]>>({});

  const TOTAL_Q = selected?.totalQ || 30;

  const loadTests = () => api.get('/tests?type=TOPIC').then((r) => setTests(r.data)).catch(() => {});

  useEffect(() => {
    Promise.all([api.get('/tests?type=TOPIC'), api.get('/groups')])
      .then(([t, g]) => { setTests(t.data); setGroups(g.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const loadQuestions = async (test: Test) => {
    setQLoading(true);
    try {
      const [qRes, vRes] = await Promise.all([
        api.get(`/tests/${test.id}/tq/admin`),
        api.get(`/telegram/videos/${test.id}`),
      ]);
      const qMap: Record<number, TQ> = {};
      qRes.data.forEach((q: TQ) => { qMap[q.orderNo] = q; });
      setQuestions(Array.from({ length: test.totalQ || 30 }, (_, i) => ({
        orderNo: i + 1,
        imageUrl: qMap[i + 1]?.imageUrl,
        questionText: qMap[i + 1]?.questionText,
        correctAnswer: qMap[i + 1]?.correctAnswer,
        scorePoint: qMap[i + 1]?.scorePoint,
      })));
      const vMap: Record<number, string> = {};
      vRes.data.forEach((v: any) => { vMap[v.questionNo] = v.fileId; });
      setVideos(vMap);
    } catch { toast.error('Yuklashda xatolik'); }
    setQLoading(false);
  };

  const selectTest = (t: Test) => {
    setSelected(t);
    setActiveTab('questions');
    setQMode('answers');
    loadQuestions(t);
    loadAssignments(t.id);
  };

  const createTopic = async () => {
    const examNo = parseInt(nt.examNo, 10);
    if (!examNo || examNo < 1) return toast.error('Nechinchi imtihon ekanini kiriting');
    if (!nt.topics.trim()) return toast.error('Mavzularni kiriting');
    // Bo'sh qoldirilsa — mantiqiy standart qiymatlar ishlatiladi
    const totalQ = parseInt(nt.totalQ, 10) || 30;
    const duration = parseInt(nt.duration, 10) || 90;
    const price = parseInt(nt.price, 10) || 0;
    setCreating(true);
    try {
      const r = await api.post('/tests', {
        type: 'TOPIC',
        title: `${examNo}-imtihon: ${nt.topics}`,
        variantNo: examNo,
        topics: nt.topics,
        totalQ,
        duration,
        price,
      });
      toast.success('Mavzulashtirilgan test yaratildi!');
      setShowCreate(false);
      setNt({ examNo: '', topics: '', totalQ: '', duration: '', price: '' });
      await loadTests();
      selectTest(r.data);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xatolik');
    }
    setCreating(false);
  };

  const deleteTest = async (t: Test) => {
    if (!confirm(`"${t.title}" o'chirasizmi?`)) return;
    try {
      await api.delete(`/tests/${t.id}`);
      toast.success("O'chirildi");
      if (selected?.id === t.id) { setSelected(null); setQuestions([]); }
      await loadTests();
    } catch { toast.error('Xatolik'); }
  };

  // ─── Fayl yuklash ───────────────────────────────────────────────
  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData(); fd.append('file', file);
    const r = await api.post('/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data.url;
  };

  const uploadPdf = async (file: File) => {
    if (!selected) return;
    setUploadingPdf(true);
    try {
      const url = await uploadFile(file);
      await api.patch(`/tests/${selected.id}`, { pdfUrl: url });
      setSelected((p) => p ? { ...p, pdfUrl: url } : p);
      setTests((p) => p.map((t) => t.id === selected.id ? { ...t, pdfUrl: url } : t));
      toast.success('PDF yuklandi!');
    } catch { toast.error('PDF yuklanmadi'); }
    setUploadingPdf(false);
  };

  const uploadImage = async (orderNo: number, file: File) => {
    if (!selected) return;
    setUploading(orderNo);
    try {
      const url = await uploadFile(file);
      const q = questions.find((q) => q.orderNo === orderNo);
      await api.post(`/tests/${selected.id}/tq`, { orderNo, imageUrl: url, correctAnswer: q?.correctAnswer, scorePoint: q?.scorePoint || 1 });
      setQuestions((p) => p.map((q) => q.orderNo === orderNo ? { ...q, imageUrl: url } : q));
      toast.success(`${orderNo}-savol rasmi yuklandi`);
    } catch { toast.error('Yuklanmadi'); }
    setUploading(null);
  };

  const deleteImage = async (orderNo: number) => {
    if (!selected) return;
    if (!confirm(`${orderNo}-savol rasmi o'chirilsinmi?`)) return;
    setUploading(orderNo);
    try {
      await api.post(`/tests/${selected.id}/tq`, { orderNo, imageUrl: null });
      setQuestions((p) => p.map((q) => q.orderNo === orderNo ? { ...q, imageUrl: undefined } : q));
    } catch { toast.error("O'chirilmadi"); }
    setUploading(null);
  };

  const pasteImage = async (orderNo: number, e: React.ClipboardEvent) => {
    if (!selected) return;
    for (const item of Array.from(e.clipboardData?.items || [])) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); await uploadImage(orderNo, file); }
      }
    }
  };

  const bulkUpload = async (files: FileList) => {
    if (!selected) return;
    const arr = Array.from(files).sort((a, b) => (extractOrderNo(a.name) ?? 999) - (extractOrderNo(b.name) ?? 999));
    setBulkUploading(true); setBulkProgress({ done: 0, total: arr.length });
    let ok = 0;
    for (const file of arr) {
      const orderNo = extractOrderNo(file.name);
      if (!orderNo || orderNo < 1 || orderNo > TOTAL_Q) { toast.error(`${file.name} — raqam yo'q`); continue; }
      try {
        const url = await uploadFile(file);
        const q = questions.find((q) => q.orderNo === orderNo);
        await api.post(`/tests/${selected.id}/tq`, { orderNo, imageUrl: url, correctAnswer: q?.correctAnswer, scorePoint: q?.scorePoint || 1 });
        ok++; setBulkProgress((p) => ({ ...p, done: p.done + 1 }));
      } catch { toast.error(`${orderNo}-savol yuklanmadi`); }
    }
    await loadQuestions(selected);
    setBulkUploading(false);
    toast.success(`✅ ${ok} ta rasm yuklandi!`);
  };

  const saveAnswer = async (orderNo: number, correctAnswer: string) => {
    if (!selected) return;
    const q = questions.find((q) => q.orderNo === orderNo);
    setQuestions((p) => p.map((q) => q.orderNo === orderNo ? { ...q, correctAnswer } : q));
    try {
      await api.post(`/tests/${selected.id}/tq`, { orderNo, imageUrl: q?.imageUrl, correctAnswer, scorePoint: q?.scorePoint || 1 });
    } catch { toast.error('Saqlanmadi'); }
  };

  const setScore = async (orderNo: number, scorePoint: number) => {
    if (!selected) return;
    const q = questions.find((q) => q.orderNo === orderNo);
    try {
      await api.post(`/tests/${selected.id}/tq`, { orderNo, imageUrl: q?.imageUrl, correctAnswer: q?.correctAnswer, scorePoint });
    } catch {}
  };

  const saveAllAnswers = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.post(`/tests/${selected.id}/tq/bulk`, {
        questions: questions.map((q) => ({ orderNo: q.orderNo, correctAnswer: q.correctAnswer, scorePoint: q.scorePoint || 1 })),
      });
      toast.success('Barcha javoblar saqlandi!');
    } catch { toast.error('Xatolik'); }
    setSaving(false);
  };

  const saveVideo = async (questionNo: number, fileId: string) => {
    if (!selected) return;
    const trimmed = fileId.trim();
    try {
      if (!trimmed) {
        // Bo'sh qoldirilsa — file_id ni o'chiramiz
        await api.delete(`/telegram/videos/${selected.id}/${questionNo}`);
        setVideos((p) => { const n = { ...p }; delete n[questionNo]; return n; });
        toast.success(`${questionNo}-savol videosi o'chirildi`);
        return;
      }
      await api.post('/telegram/videos', { testId: selected.id, questionNo, fileId: trimmed });
      setVideos((p) => ({ ...p, [questionNo]: trimmed }));
      toast.success(`${questionNo}-savol video saqlandi`);
    } catch { toast.error('Xatolik'); }
  };

  // ─── Guruhga biriktirish ────────────────────────────────────────
  const loadAssignments = (id: number) => {
    api.get(`/tests/${id}/groups`).then((r) => setAssignments(r.data)).catch(() => setAssignments([]));
  };

  const assign = async () => {
    if (!selected || !groupId) return toast.error('Guruhni tanlang');
    setAssignSaving(true);
    try {
      await api.post(`/tests/${selected.id}/open-group`, {
        groupId,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
      });
      toast.success('Test guruhga ochildi');
      // Maydonlar yana ayni vaqt / +2 soat bilan to'ldirilgan tursin
      setStartsAt(nowPlusHours(0));
      setEndsAt(nowPlusHours(2));
      loadAssignments(selected.id);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xatolik');
    }
    setAssignSaving(false);
  };

  const loadPending = async (gId: number) => {
    if (!selected) return;
    if (pending[gId]) { setPending((p) => { const n = { ...p }; delete n[gId]; return n; }); return; }
    try {
      const { data } = await api.get(`/telegram/non-completers/${selected.id}/${gId}`);
      setPending((p) => ({ ...p, [gId]: data }));
    } catch { toast.error('Xatolik'); }
  };

  const groupName = (gId: number) => assignments.find((a) => a.groupId === gId)?.group.name || 'guruh';

  const notify = async (gId: number) => {
    if (!selected) return;
    if (!confirm(`«${selected.title}» bo'yicha ishlamaganlar ro'yxati «${groupName(gId)}» guruhi kuratoriga (shaxsiy) yuborilsinmi?`)) return;
    try {
      const { data } = await api.post('/telegram/notify-curator', { testId: selected.id, groupId: gId });
      if (data.ok) toast.success(`«${selected.title}» → kuratorga (shaxsiy) yuborildi (${data.count} kishi)`);
      else toast.error(data.message || 'Yuborilmadi');
    } catch (e: any) { toast.error(e.response?.data?.message || 'Xatolik'); }
  };

  const sendRanking = async (gId: number) => {
    if (!selected) return;
    if (!confirm(`«${selected.title}» reytingi «${groupName(gId)}» guruhiga yuborilsinmi?`)) return;
    const t = toast.loading(`«${selected.title}» reytingi yuborilmoqda...`);
    try {
      const { data } = await api.post('/telegram/send-ranking', { testId: selected.id, groupId: gId });
      if (data.ok) toast.success(`«${selected.title}» reytingi yuborildi (${data.count} kishi ishladi)`, { id: t });
      else toast.error(data.message || 'Yuborilmadi', { id: t });
    } catch (e: any) { toast.error(e.response?.data?.message || 'Xatolik', { id: t }); }
  };

  const saveGroupChat = async (gId: number, value: string) => {
    try {
      await api.patch(`/groups/${gId}/telegram`, { telegramChatId: value });
      toast.success(value ? 'Telegram chat saqlandi' : 'Telegram chat o\'chirildi');
      if (selected) loadAssignments(selected.id);
    } catch { toast.error('Xatolik'); }
  };

  const closeGroup = async (gId: number) => {
    if (!selected) return;
    if (!confirm('Guruhdan yopilsinmi? (dedlayn hozirgi vaqtga qo\'yiladi)')) return;
    await api.post(`/tests/${selected.id}/close-group`, { groupId: gId }).catch(() => {});
    loadAssignments(selected.id);
  };

  const reopenGroup = async (gId: number) => {
    if (!selected) return;
    const val = prompt(
      'Yangi dedlayn (masalan 2026-06-20 18:00). Bo\'sh qoldirsangiz — muddatsiz ochiq.\n' +
      'Diqqat: qayta ochilsa, avval ishlaganlar ham qaytadan ishlay oladi.',
      nowPlusHours(2).replace('T', ' '), // ayni vaqtdan +2 soat oldindan to'ldirilgan
    );
    if (val === null) return; // bekor qilindi
    const endsAt = val.trim() ? new Date(val.trim().replace(' ', 'T')) : undefined;
    if (endsAt && isNaN(endsAt.getTime())) return toast.error('Sana formati noto\'g\'ri');
    try {
      await api.post(`/tests/${selected.id}/reopen-group`, {
        groupId: gId,
        endsAt: endsAt ? endsAt.toISOString() : undefined,
      });
      toast.success('Test qayta ochildi');
      loadAssignments(selected.id);
    } catch (e: any) { toast.error(e.response?.data?.message || 'Xatolik'); }
  };

  const inp: React.CSSProperties = {
    width: '100%', padding: '9px 12px', backgroundColor: theme.input,
    border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, outline: 'none', fontSize: 14,
  };
  const s = { card: { backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16 } as React.CSSProperties };
  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString('uz-UZ', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';

  if (loading) return <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>;

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h1 style={{ color: theme.text, fontSize: 22, fontWeight: 700 }}>📚 Mavzulashtirilgan testlar</h1>
          <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginTop: 2 }}>
            Imtihon yarating, savollarni qo'shing va guruhlarga oching.
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{ padding: '8px 18px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap' }}>
          + Yangi imtihon
        </button>
      </div>

      {showCreate && (
        <div style={{ ...s.card, marginBottom: 20 }}>
          <h3 style={{ color: theme.text, fontWeight: 700, marginBottom: 14 }}>📝 Yangi mavzulashtirilgan imtihon</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12, display: 'block', marginBottom: 4 }}>Nechinchi imtihon *</label>
              <input type="number" min={1} value={nt.examNo} placeholder="Masalan: 14"
                onChange={(e) => setNt((p) => ({ ...p, examNo: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12, display: 'block', marginBottom: 4 }}>Savollar soni</label>
              <input type="number" min={1} max={100} value={nt.totalQ} placeholder="30"
                onChange={(e) => setNt((p) => ({ ...p, totalQ: e.target.value }))} style={inp} />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12, display: 'block', marginBottom: 4 }}>Qaysi mavzularni qamrab oladi *</label>
              <input value={nt.topics} onChange={(e) => setNt((p) => ({ ...p, topics: e.target.value }))}
                placeholder="Masalan: Atom tuzilishi, Mol, Oksidlanish-qaytarilish" style={inp} />
            </div>
            <div>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12, display: 'block', marginBottom: 4 }}>Davomiyligi (min)</label>
              <input type="number" min={1} max={300} value={nt.duration} placeholder="90"
                onChange={(e) => setNt((p) => ({ ...p, duration: e.target.value }))} style={inp} />
            </div>
            <div>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12, display: 'block', marginBottom: 4 }}>Narx (so'm)</label>
              <input type="number" min={0} value={nt.price} placeholder="0 (tekin)"
                onChange={(e) => setNt((p) => ({ ...p, price: e.target.value }))} style={inp} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={createTopic} disabled={creating}
              style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, opacity: creating ? 0.7 : 1 }}>
              {creating ? '⏳ Yaratilmoqda...' : '✅ Imtihon yaratish'}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '10px 18px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, cursor: 'pointer' }}>
              Bekor
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT: testlar ro'yxati */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tests.length === 0 ? (
            <div style={{ ...s.card, textAlign: 'center', color: theme.text, opacity: 0.4, padding: 30 }}>
              Hozircha imtihon yo'q.<br />+ Yangi imtihon bosing
            </div>
          ) : (
            tests.map((t) => {
              const active = selected?.id === t.id;
              return (
                <div key={t.id} style={{ position: 'relative' }}>
                  <button onClick={() => selectTest(t)}
                    style={{
                      width: '100%', textAlign: 'left', padding: '12px 14px', borderRadius: 12,
                      border: `2px solid ${active ? theme.accent : theme.border}`,
                      backgroundColor: active ? `${theme.accent}15` : theme.card, cursor: 'pointer',
                    }}>
                    <div style={{ color: active ? theme.accent : theme.text, fontWeight: 700, fontSize: 14 }}>
                      {t.variantNo ? `${t.variantNo}-imtihon` : t.title}
                    </div>
                    {t.topics && <div style={{ color: theme.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>{t.topics}</div>}
                    <div style={{ color: theme.text, opacity: 0.4, fontSize: 11, marginTop: 3 }}>{t.totalQ} savol · {t.duration} min</div>
                  </button>
                  <button onClick={() => deleteTest(t)} title="O'chirish"
                    style={{ position: 'absolute', top: 6, right: 6, width: 22, height: 22, borderRadius: '50%', backgroundColor: '#ef444420', color: '#ef4444', border: 'none', cursor: 'pointer', fontSize: 12 }}>×</button>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT */}
        {selected ? (
          <div>
            <div style={{ ...s.card, marginBottom: 14 }}>
              <div style={{ color: theme.text, fontWeight: 700, fontSize: 16 }}>{selected.title}</div>
              <div style={{ color: theme.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>
                {selected.totalQ} savol · {selected.duration} min {selected.topics ? `· ${selected.topics}` : ''}
              </div>
            </div>

            {/* PDF + Telegram ID */}
            <div style={{ ...s.card, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ color: theme.text, fontWeight: 600, marginBottom: 3 }}>📄 PDF (ixtiyoriy)</div>
                {selected.pdfUrl
                  ? <a href={selected.pdfUrl} target="_blank" rel="noreferrer" style={{ color: theme.accent, fontSize: 13 }}>PDF ko'rish →</a>
                  : <span style={{ color: '#f59e0b', fontSize: 13 }}>PDF yuklanmagan</span>}
              </div>
              <label style={{ cursor: 'pointer' }}>
                <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ''; }} />
                <span style={{ padding: '7px 14px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', borderRadius: 9, fontWeight: 600, fontSize: 13, display: 'inline-block' }}>
                  {uploadingPdf ? '⏳...' : selected.pdfUrl ? '🔄 Almashtirish' : '📎 PDF Yuklash'}
                </span>
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: theme.text, opacity: 0.6, fontSize: 12 }}>📱 Telegram ID:</span>
                <input type="text" placeholder="AT1, SB2..." defaultValue={selected.telegramId ?? ''} key={selected.id}
                  style={{ width: 90, padding: '7px 10px', borderRadius: 9, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, fontSize: 14 }}
                  onBlur={async (e) => {
                    const val = e.target.value.trim() || null;
                    if (val === (selected.telegramId ?? null)) return;
                    try {
                      await api.patch(`/tests/${selected.id}`, { telegramId: val });
                      setSelected((p) => p ? { ...p, telegramId: val ?? undefined } : p);
                      await loadTests();
                      await loadQuestions(selected);
                      toast.success('Telegram ID saqlandi!');
                    } catch (err: any) { toast.error(err.response?.data?.message || 'Xatolik'); }
                  }} />
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {([['questions', '📋 Savollar'], ['videos', '📹 Videolar'], ['groups', '👥 Guruhlar']] as const).map(([tab, label]) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ padding: '7px 16px', borderRadius: 9, border: `1px solid ${activeTab === tab ? theme.accent : theme.border}`, backgroundColor: activeTab === tab ? `${theme.accent}20` : 'transparent', color: activeTab === tab ? theme.accent : theme.text, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {activeTab === 'questions' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: theme.text, opacity: 0.5, fontSize: 12 }}>Usul:</span>
                  {(['answers', 'image', 'pdf'] as QMode[]).map((m) => (
                    <button key={m} onClick={() => setQMode(m)}
                      style={{ padding: '5px 12px', borderRadius: 7, border: `1px solid ${qMode === m ? theme.accent : theme.border}`, backgroundColor: qMode === m ? `${theme.accent}20` : 'transparent', color: qMode === m ? theme.accent : theme.text, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
                      {m === 'answers' ? '✅ Javob kalitlari' : m === 'image' ? '🖼 Rasm' : '📄 PDF'}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {activeTab === 'questions' && (
              <>
                {qMode === 'pdf' && (
                  <div style={{ ...s.card, textAlign: 'center', padding: 30 }}>
                    <p style={{ color: theme.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>📄 Butun imtihon uchun PDF yuklang</p>
                    <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 20 }}>Student test vaqtida shu PDF ni ko'radi va A/B/C/D belgilaydi</p>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ''; }} />
                      <span style={{ padding: '12px 28px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 15, display: 'inline-block' }}>
                        {uploadingPdf ? '⏳ Yuklanmoqda...' : selected.pdfUrl ? '🔄 PDF Almashtirish' : '📎 PDF Yuklash'}
                      </span>
                    </label>
                    {selected.pdfUrl && <p style={{ color: '#10b981', fontSize: 13, marginTop: 14 }}>✅ PDF biriktirilgan</p>}
                  </div>
                )}

                {qMode === 'image' && (
                  <>
                    <label style={{ cursor: 'pointer', display: 'block', border: `2px dashed ${bulkUploading ? theme.accent : theme.border}`, borderRadius: 12, padding: '14px 20px', marginBottom: 16, textAlign: 'center' }}>
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { if (e.target.files) bulkUpload(e.target.files); e.target.value = ''; }} />
                      {bulkUploading
                        ? <span style={{ color: theme.accent, fontWeight: 600 }}>⏳ {bulkProgress.done}/{bulkProgress.total} yuklanyapti...</span>
                        : <span style={{ color: theme.accent, fontWeight: 600 }}>🖼 Ko'p rasm birdan yuklash</span>}
                      <p style={{ color: theme.text, opacity: 0.4, fontSize: 12, margin: '4px 0 0' }}>Fayl nomida raqam bo'lsin: 1.jpg, 2.png, savol1.jpg</p>
                    </label>
                    {qLoading ? (
                      <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {questions.map((q) => (
                          <div key={q.orderNo} style={{ ...s.card, borderRadius: 12, padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <span style={{ color: theme.accent, fontWeight: 800, fontSize: 15, minWidth: 28 }}>{q.orderNo}</span>
                              {q.imageUrl && <span style={{ fontSize: 11, color: '#10b981', backgroundColor: '#10b98115', padding: '2px 7px', borderRadius: 5 }}>✓ Rasm</span>}
                              <div style={{ flex: 1 }} />
                              <span style={{ color: theme.text, opacity: 0.5, fontSize: 11 }}>Ball:</span>
                              <input type="number" defaultValue={q.scorePoint || 1} min={0} max={10} step={0.5}
                                onBlur={(e) => setScore(q.orderNo, parseFloat(e.target.value))}
                                style={{ width: 48, padding: '3px 5px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 6, outline: 'none', fontSize: 12 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div tabIndex={0} onPaste={(e) => pasteImage(q.orderNo, e)}
                                onFocus={() => setPasteTarget(q.orderNo)} onBlur={() => setPasteTarget(null)}
                                style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 10px', borderRadius: 9, border: `2px dashed ${pasteTarget === q.orderNo ? theme.accent : theme.border}`, backgroundColor: pasteTarget === q.orderNo ? `${theme.accent}10` : theme.input, cursor: 'pointer', outline: 'none' }}>
                                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(q.orderNo, f); e.target.value = ''; }} />
                                  <span style={{ color: theme.text, fontSize: 12 }}>{uploading === q.orderNo ? '⏳' : q.imageUrl ? '🖼 Almashtir' : '📎 Yuklash'}</span>
                                </label>
                                <span style={{ color: theme.text, opacity: 0.4, fontSize: 11 }}>yoki ⌘V</span>
                              </div>
                              {q.imageUrl && (
                                <div style={{ position: 'relative' }}>
                                  <img src={q.imageUrl} alt="" style={{ height: 52, borderRadius: 6, border: `1px solid ${theme.border}`, objectFit: 'cover' }} />
                                  <button onClick={() => deleteImage(q.orderNo)} title="Rasmni o'chirish"
                                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>×</button>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 5 }}>
                                {OPTS.map((opt) => (
                                  <button key={opt} onClick={() => saveAnswer(q.orderNo, opt)}
                                    style={{ width: 36, height: 36, borderRadius: 8, border: `2px solid ${q.correctAnswer === opt ? '#10b981' : theme.border}`, backgroundColor: q.correctAnswer === opt ? '#10b981' : 'transparent', color: q.correctAnswer === opt ? '#fff' : theme.text, fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                                    {opt}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {qMode === 'answers' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                      <button onClick={saveAllAnswers} disabled={saving}
                        style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                        {saving ? '⏳ Saqlanmoqda...' : '💾 Hammasini saqlash'}
                      </button>
                    </div>
                    {qLoading ? (
                      <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {[0, 1].map((col) => {
                          const half = Math.ceil(questions.length / 2);
                          return (
                            <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {questions.slice(col * half, col * half + half).map((q) => (
                                <div key={q.orderNo} style={{ ...s.card, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <span style={{ color: theme.accent, fontWeight: 700, fontSize: 15, minWidth: 26 }}>{q.orderNo}</span>
                                  <div style={{ display: 'flex', gap: 5, flex: 1 }}>
                                    {OPTS.map((opt) => (
                                      <button key={opt} onClick={() => saveAnswer(q.orderNo, opt)}
                                        style={{ flex: 1, height: 34, borderRadius: 8, border: `2px solid ${q.correctAnswer === opt ? '#10b981' : theme.border}`, backgroundColor: q.correctAnswer === opt ? '#10b981' : 'transparent', color: q.correctAnswer === opt ? '#fff' : theme.text, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                  <input type="number" defaultValue={q.scorePoint || 1} min={0} max={5} step={0.5}
                                    onBlur={(e) => setScore(q.orderNo, parseFloat(e.target.value))}
                                    style={{ width: 44, padding: '3px 5px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 6, outline: 'none', fontSize: 12 }} />
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'videos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.from({ length: TOTAL_Q }, (_, i) => i + 1).map((n) => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, ...s.card, borderRadius: 10, padding: '8px 14px' }}>
                    <span style={{ color: theme.accent, fontWeight: 700, minWidth: 28, fontSize: 14 }}>{n}</span>
                    <input defaultValue={videos[n] || ''} placeholder="Telegram file_id..."
                      onBlur={(e) => { if (e.target.value.trim() !== (videos[n] || '')) saveVideo(n, e.target.value); }}
                      style={{ flex: 1, padding: '6px 10px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 7, outline: 'none', fontSize: 12 }} />
                    {videos[n] && <span style={{ color: '#10b981', fontSize: 12 }}>✓</span>}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'groups' && (
              <>
                <div style={{ ...s.card, marginBottom: 14 }}>
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
                    <button onClick={assign} disabled={assignSaving}
                      style={{ padding: '11px', borderRadius: 10, border: 'none', fontWeight: 600, background: theme.accent, color: '#fff', cursor: assignSaving ? 'default' : 'pointer', opacity: assignSaving ? 0.6 : 1 }}>
                      {assignSaving ? 'Saqlanmoqda...' : 'Ochish / Yangilash'}
                    </button>
                  </div>
                </div>

                <div style={{ ...s.card }}>
                  <p style={{ color: theme.text, fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Ochilgan guruhlar</p>
                  {assignments.length === 0 ? (
                    <p style={{ color: theme.text, opacity: 0.4, fontSize: 13 }}>Hali hech bir guruhga ochilmagan</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {assignments.map((a) => (
                        <div key={a.id} style={{ padding: '10px 12px', backgroundColor: theme.input, borderRadius: 10 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <div>
                              <p style={{ color: theme.text, fontWeight: 600, fontSize: 14 }}>
                                {a.group.name}
                                {a.endsAt && new Date(a.endsAt) < new Date() && (
                                  <span style={{ marginLeft: 8, fontSize: 11, color: '#ef4444', fontWeight: 500 }}>⛔ tugagan</span>
                                )}
                              </p>
                              <p style={{ color: theme.text, opacity: 0.5, fontSize: 12, marginTop: 2 }}>🔓 {fmt(a.startsAt)} → ⏳ {fmt(a.endsAt)}</p>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => loadPending(a.groupId)}
                                style={{ padding: '6px 10px', backgroundColor: `${theme.accent}20`, color: theme.accent, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12 }}>
                                {pending[a.groupId] ? 'Yashirish' : 'Ishlamaganlar'}
                              </button>
                              <button onClick={() => notify(a.groupId)}
                                style={{ padding: '6px 10px', backgroundColor: '#10b98120', color: '#10b981', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12 }}>📨 Kuratorga</button>
                              <button onClick={() => sendRanking(a.groupId)}
                                style={{ padding: '6px 10px', backgroundColor: '#f59e0b20', color: '#f59e0b', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12 }}>🏆 Reyting</button>
                              <button onClick={() => reopenGroup(a.groupId)}
                                style={{ padding: '6px 10px', backgroundColor: '#6366f120', color: '#6366f1', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12 }}>🔄 Qayta ochish</button>
                              <button onClick={() => closeGroup(a.groupId)}
                                style={{ padding: '6px 10px', backgroundColor: '#ef444420', color: '#ef4444', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12 }}>Yopish</button>
                            </div>
                          </div>
                          <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ color: theme.text, opacity: 0.55, fontSize: 12, whiteSpace: 'nowrap' }}>📨 Guruh chat ID:</span>
                            <input
                              defaultValue={a.group.telegramChatId ?? ''}
                              placeholder="masalan -1003386841898"
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v !== (a.group.telegramChatId ?? '')) saveGroupChat(a.groupId, v);
                              }}
                              style={{ flex: '1 1 200px', padding: '6px 10px', backgroundColor: theme.card, border: `1px solid ${a.group.telegramChatId ? '#10b981' : theme.border}`, color: theme.text, borderRadius: 8, fontSize: 12, outline: 'none' }} />
                            {a.group.telegramChatId
                              ? <span style={{ color: '#10b981', fontSize: 11 }}>✓ ulangan</span>
                              : <span style={{ color: '#ef4444', fontSize: 11 }}>ulanmagan</span>}
                          </div>
                          {pending[a.groupId] && (
                            <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${theme.border}` }}>
                              {pending[a.groupId].length === 0 ? (
                                <p style={{ color: '#10b981', fontSize: 13 }}>✅ Barcha a'zolar ishlagan</p>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <p style={{ color: theme.text, opacity: 0.6, fontSize: 12, marginBottom: 4 }}>Ishlamaganlar ({pending[a.groupId].length}):</p>
                                  {pending[a.groupId].map((u, i) => (
                                    <p key={u.id} style={{ color: theme.text, fontSize: 13 }}>{i + 1}. {u.name || u.phone}</p>
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
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.text, opacity: 0.4, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 40 }}>📚</span>
            <span>Chap tarafdan imtihon tanlang yoki yangi yarating</span>
          </div>
        )}
      </div>
    </div>
  );
}
