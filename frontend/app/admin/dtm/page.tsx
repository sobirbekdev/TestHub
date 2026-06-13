'use client';
import { useEffect, useState, useRef } from 'react';
import { useThemeStore } from '@/store/theme';
import api from '@/lib/api';
import toast from 'react-hot-toast';

function extractOrderNo(filename: string): number | null {
  const match = filename.match(/(\d+)/);
  return match ? parseInt(match[1]) : null;
}

const TOTAL_Q = 30;
const OPTS = ['A', 'B', 'C', 'D'];

type QMode = 'answers' | 'image' | 'pdf';

interface TQ { orderNo: number; imageUrl?: string; questionText?: string; correctAnswer?: string; scorePoint?: number; }
interface Test { id: number; title: string; variantNo?: number; year?: number; duration: number; totalQ: number; pdfUrl?: string; coverImage?: string; authorName?: string; collectionName?: string; price?: number; telegramId?: string; }

export default function DtmAdminPage() {
  const { theme } = useThemeStore();
  const [tests, setTests] = useState<Test[]>([]);
  const [selectedTest, setSelectedTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<TQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'videos'>('questions');
  const [videos, setVideos] = useState<Record<number, string>>({});
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [pasteTarget, setPasteTarget] = useState<number | null>(null);
  const [qMode, setQMode] = useState<QMode>('answers');
  const [saving, setSaving] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [newColl, setNewColl] = useState({
    authorName: '', collectionName: '', variantCount: 1,
    year: new Date().getFullYear(), duration: 60, price: 0,
  });
  const [creating, setCreating] = useState(false);
  const [expandedAuthors, setExpandedAuthors] = useState<Record<string, boolean | undefined>>({});
  const [expandedColls, setExpandedColls] = useState<Record<string, boolean | undefined>>({});
  const [uploadingCover, setUploadingCover] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const coverInputTarget = useRef<{ author: string; collName: string; collKey: string } | null>(null);

  const loadTests = async () => {
    try { const r = await api.get('/tests?type=DTM_VARIANT'); setTests(r.data); } catch {}
  };

  const loadQuestions = async (testId: number) => {
    setLoading(true);
    try {
      const [qRes, vRes] = await Promise.all([
        api.get(`/tests/${testId}/tq/admin`),
        api.get(`/telegram/videos/${testId}`),
      ]);
      const qMap: Record<number, TQ> = {};
      qRes.data.forEach((q: TQ) => { qMap[q.orderNo] = q; });
      setQuestions(Array.from({ length: TOTAL_Q }, (_, i) => ({
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
    setLoading(false);
  };

  useEffect(() => { loadTests(); }, []);

  const createCollection = async () => {
    if (!newColl.authorName) return toast.error('Muallif ismini kiriting');
    if (!newColl.collectionName) return toast.error('To\'plam nomini kiriting');
    if (newColl.variantCount < 1) return toast.error('Variant soni 1 dan ko\'p bo\'lsin');
    setCreating(true);
    try {
      let lastTest: Test | null = null;
      for (let i = 1; i <= newColl.variantCount; i++) {
        const r = await api.post('/tests', {
          type: 'DTM_VARIANT',
          title: `${newColl.collectionName} - ${i}-variant`,
          authorName: newColl.authorName,
          collectionName: newColl.collectionName,
          variantNo: i,
          year: newColl.year,
          duration: newColl.duration,
          totalQ: TOTAL_Q,
          price: newColl.price,
        });
        lastTest = r.data;
      }
      toast.success(`✅ ${newColl.variantCount} ta variant yaratildi!`);
      setShowCreate(false);
      setNewColl({ authorName: '', collectionName: '', variantCount: 1, year: new Date().getFullYear(), duration: 60, price: 0 });
      await loadTests();
      if (lastTest) { setSelectedTest(lastTest); await loadQuestions(lastTest.id); }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xatolik yuz berdi');
    }
    setCreating(false);
  };

  const uploadCover = async (authorName: string, collectionName: string, collKey: string, file: File) => {
    setUploadingCover(collKey);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await api.post('/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      await api.patch('/tests/collection-cover', { authorName, collectionName, coverImage: r.data.url });
      setTests(p => p.map(t => t.authorName === authorName && t.collectionName === collectionName ? { ...t, coverImage: r.data.url } : t));
      toast.success('Muqova yuklandi!');
    } catch (e: any) {
      toast.error(e.response?.data?.message || e.message || 'Muqova yuklanmadi');
    }
    setUploadingCover(null);
  };

  const deleteTest = async (t: Test) => {
    if (!confirm(`"${t.title}" o'chirasizmi?`)) return;
    try {
      await api.delete(`/tests/${t.id}`);
      toast.success('O\'chirildi');
      if (selectedTest?.id === t.id) { setSelectedTest(null); setQuestions([]); }
      await loadTests();
    } catch { toast.error('Xatolik'); }
  };

  const deleteAuthor = async (author: string, tests: Test[]) => {
    if (!confirm(`"${author}" muallifining BARCHA testlari (${tests.length} ta) o'chiriladi. Davom etasizmi?`)) return;
    try {
      await Promise.all(tests.map(t => api.delete(`/tests/${t.id}`)));
      toast.success(`${tests.length} ta test o'chirildi`);
      if (tests.some(t => t.id === selectedTest?.id)) { setSelectedTest(null); setQuestions([]); }
      await loadTests();
    } catch { toast.error('Xatolik'); }
  };

  const uploadFile = async (file: File): Promise<string> => {
    const fd = new FormData(); fd.append('file', file);
    const r = await api.post('/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
    return r.data.url;
  };

  const uploadPdf = async (file: File) => {
    if (!selectedTest) return;
    setUploadingPdf(true);
    try {
      const url = await uploadFile(file);
      await api.patch(`/tests/${selectedTest.id}`, { pdfUrl: url });
      setSelectedTest(p => p ? { ...p, pdfUrl: url } : p);
      setTests(p => p.map(t => t.id === selectedTest.id ? { ...t, pdfUrl: url } : t));
      toast.success('PDF yuklandi!');
    } catch { toast.error('PDF yuklanmadi'); }
    setUploadingPdf(false);
  };

  const uploadImage = async (orderNo: number, file: File) => {
    if (!selectedTest) return;
    setUploading(orderNo);
    try {
      const url = await uploadFile(file);
      const q = questions.find(q => q.orderNo === orderNo);
      await api.post(`/tests/${selectedTest.id}/tq`, { orderNo, imageUrl: url, correctAnswer: q?.correctAnswer, scorePoint: q?.scorePoint || 1 });
      setQuestions(p => p.map(q => q.orderNo === orderNo ? { ...q, imageUrl: url } : q));
      toast.success(`${orderNo}-savol rasmi yuklandi`);
    } catch { toast.error('Yuklanmadi'); }
    setUploading(null);
  };

  const deletePdf = async () => {
    if (!selectedTest?.pdfUrl) return;
    if (!confirm("PDF o'chirilsinmi?")) return;
    setUploadingPdf(true);
    try {
      await api.patch(`/tests/${selectedTest.id}`, { pdfUrl: null });
      setSelectedTest(p => p ? { ...p, pdfUrl: undefined } : p);
      setTests(p => p.map(t => t.id === selectedTest.id ? { ...t, pdfUrl: undefined } : t));
      toast.success("PDF o'chirildi");
    } catch (e: any) { toast.error(e.response?.data?.message || "O'chirilmadi"); }
    setUploadingPdf(false);
  };

  const deleteImage = async (orderNo: number) => {
    if (!selectedTest) return;
    if (!confirm(`${orderNo}-savol rasmi o'chirilsinmi?`)) return;
    setUploading(orderNo);
    try {
      await api.post(`/tests/${selectedTest.id}/tq`, { orderNo, imageUrl: null });
      setQuestions(p => p.map(q => q.orderNo === orderNo ? { ...q, imageUrl: undefined } : q));
      toast.success(`${orderNo}-savol rasmi o'chirildi`);
    } catch (e: any) { toast.error(e.response?.data?.message || "O'chirilmadi"); }
    setUploading(null);
  };

  const pasteImage = async (orderNo: number, e: React.ClipboardEvent) => {
    if (!selectedTest) return;
    for (const item of Array.from(e.clipboardData?.items || [])) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) { e.preventDefault(); await uploadImage(orderNo, file); }
      }
    }
  };

  const bulkUpload = async (files: FileList) => {
    if (!selectedTest) return;
    const arr = Array.from(files).sort((a, b) => (extractOrderNo(a.name) ?? 999) - (extractOrderNo(b.name) ?? 999));
    setBulkUploading(true); setBulkProgress({ done: 0, total: arr.length });
    let ok = 0;
    for (const file of arr) {
      const orderNo = extractOrderNo(file.name);
      if (!orderNo || orderNo < 1 || orderNo > TOTAL_Q) { toast.error(`${file.name} — raqam yo'q`); continue; }
      try {
        const url = await uploadFile(file);
        const q = questions.find(q => q.orderNo === orderNo);
        await api.post(`/tests/${selectedTest.id}/tq`, { orderNo, imageUrl: url, correctAnswer: q?.correctAnswer, scorePoint: q?.scorePoint || 1 });
        ok++; setBulkProgress(p => ({ ...p, done: p.done + 1 }));
      } catch { toast.error(`${orderNo}-savol yuklanmadi`); }
    }
    await loadQuestions(selectedTest.id);
    setBulkUploading(false);
    toast.success(`✅ ${ok} ta rasm yuklandi!`);
  };

  const saveAnswer = async (orderNo: number, correctAnswer: string) => {
    if (!selectedTest) return;
    const q = questions.find(q => q.orderNo === orderNo);
    setQuestions(p => p.map(q => q.orderNo === orderNo ? { ...q, correctAnswer } : q));
    try {
      await api.post(`/tests/${selectedTest.id}/tq`, { orderNo, imageUrl: q?.imageUrl, correctAnswer, scorePoint: q?.scorePoint || 1 });
    } catch { toast.error('Saqlanmadi'); }
  };

  const setScore = async (orderNo: number, scorePoint: number) => {
    if (!selectedTest) return;
    const q = questions.find(q => q.orderNo === orderNo);
    try {
      await api.post(`/tests/${selectedTest.id}/tq`, { orderNo, imageUrl: q?.imageUrl, correctAnswer: q?.correctAnswer, scorePoint });
    } catch {}
  };

  const saveAllAnswers = async () => {
    if (!selectedTest) return;
    setSaving(true);
    try {
      await api.post(`/tests/${selectedTest.id}/tq/bulk`, {
        questions: questions.map(q => ({ orderNo: q.orderNo, correctAnswer: q.correctAnswer, scorePoint: q.scorePoint || 1 })),
      });
      toast.success('Barcha javoblar saqlandi!');
    } catch { toast.error('Xatolik'); }
    setSaving(false);
  };

  const saveVideo = async (questionNo: number, fileId: string) => {
    if (!selectedTest) return;
    try {
      await api.post('/telegram/videos', { testId: selectedTest.id, questionNo, fileId });
      setVideos(p => ({ ...p, [questionNo]: fileId }));
      toast.success(`${questionNo}-savol video saqlandi`);
    } catch { toast.error('Xatolik'); }
  };

  // Author → Collection grouping
  const grouped: Record<string, Record<string, Test[]>> = {};
  for (const t of tests) {
    const author = t.authorName || 'DTM Variantlari';
    const coll = t.collectionName || `${t.year || 'Yilsiz'} yil`;
    if (!grouped[author]) grouped[author] = {};
    if (!grouped[author][coll]) grouped[author][coll] = [];
    grouped[author][coll].push(t);
  }

  const s = { card: { backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 16 } as React.CSSProperties };

  return (
    <div>
      <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0];
          const t = coverInputTarget.current;
          if (f && t) uploadCover(t.author, t.collName, t.collKey, f);
          e.target.value = '';
        }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ color: theme.text, fontSize: 22, fontWeight: 700 }}>🎯 DTM Variantlari</h1>
        <button onClick={() => setShowCreate(!showCreate)}
          style={{ padding: '8px 18px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}>
          + Yangi kolleksiya
        </button>
      </div>

      {showCreate && (
        <div style={{ ...s.card, marginBottom: 20 }}>
          <h3 style={{ color: theme.text, fontWeight: 700, marginBottom: 14 }}>📚 Yangi DTM to'plami yaratish</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12, display: 'block', marginBottom: 4 }}>Muallif / Manba *</label>
              <input value={newColl.authorName} onChange={e => setNewColl(p => ({ ...p, authorName: e.target.value }))}
                placeholder="Masalan: DTM 2024"
                style={{ width: '100%', padding: '8px 12px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }} />
            </div>
            <div>
              <label style={{ color: theme.text, opacity: 0.6, fontSize: 12, display: 'block', marginBottom: 4 }}>To'plam nomi *</label>
              <input value={newColl.collectionName} onChange={e => setNewColl(p => ({ ...p, collectionName: e.target.value }))}
                placeholder="Masalan: 2024 DTM Kimyo"
                style={{ width: '100%', padding: '8px 12px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }} />
            </div>
            {[
              ['Variant soni', 'variantCount', 1, 100],
              ['Yil', 'year', 2020, 2030],
              ['Vaqt (min)', 'duration', 10, 300],
              ['Narx (so\'m)', 'price', 0, 9999999],
            ].map(([label, key, min, max]) => (
              <div key={String(key)}>
                <label style={{ color: theme.text, opacity: 0.6, fontSize: 12, display: 'block', marginBottom: 4 }}>{label}</label>
                <input type="number" min={Number(min)} max={Number(max)}
                  value={(newColl as any)[key]}
                  onChange={e => setNewColl(p => ({ ...p, [key]: +e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 8, outline: 'none' }} />
              </div>
            ))}
          </div>
          <div style={{ backgroundColor: `${theme.accent}10`, border: `1px solid ${theme.accent}30`, borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: theme.text, opacity: 0.7 }}>
            💡 "{newColl.collectionName || 'To\'plam nomi'}" uchun {newColl.variantCount} ta variant yaratiladi — har biri {TOTAL_Q} savol bilan
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={createCollection} disabled={creating}
              style={{ flex: 1, padding: '10px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: 9, border: 'none', cursor: 'pointer', fontWeight: 700, opacity: creating ? 0.7 : 1 }}>
              {creating ? '⏳ Yaratilmoqda...' : `✅ ${newColl.variantCount} ta variant yaratish`}
            </button>
            <button onClick={() => setShowCreate(false)}
              style={{ padding: '10px 18px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 9, cursor: 'pointer' }}>
              Bekor
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        {/* LEFT */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Object.keys(grouped).length === 0 && (
            <div style={{ ...s.card, textAlign: 'center', color: theme.text, opacity: 0.4, padding: 30 }}>
              Hozircha hech narsa yo'q.<br />+ Yangi kolleksiya bosing
            </div>
          )}
          {Object.entries(grouped).map(([author, colls]) => (
            <div key={author} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', borderBottom: expandedAuthors[author] === false ? 'none' : `1px solid ${theme.border}` }}>
                <button
                  onClick={() => setExpandedAuthors(p => ({ ...p, [author]: p[author] === false ? undefined : false }))}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <span style={{ color: theme.text, opacity: 0.5, fontSize: 12, display: 'inline-block', transform: expandedAuthors[author] === false ? 'rotate(-90deg)' : 'rotate(0deg)' }}>▼</span>
                  <span style={{ color: theme.text, fontWeight: 700, fontSize: 14, flex: 1, textAlign: 'left' }}>🎯 {author}</span>
                  <span style={{ color: theme.text, opacity: 0.4, fontSize: 12 }}>{Object.values(colls).flat().length}</span>
                </button>
                <button onClick={() => deleteAuthor(author, Object.values(colls).flat())} title="Butun bo'limni o'chirish"
                  style={{ padding: '8px 12px', marginRight: 6, background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16 }}>
                  🗑
                </button>
              </div>
              {expandedAuthors[author] !== false && (
                <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {Object.entries(colls).map(([collName, variants]) => {
                    const collKey = `${author}__${collName}`;
                    const isOpen = expandedColls[collKey] !== false;
                    const sorted = [...variants].sort((a, b) => (a.variantNo || 0) - (b.variantNo || 0));
                    return (
                      <div key={collName}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: isOpen ? 6 : 0 }}>
                          <button
                            onClick={() => { coverInputTarget.current = { author, collName, collKey }; coverInputRef.current?.click(); }}
                            title="Muqova rasm yuklash"
                            style={{ width: 34, height: 44, borderRadius: 5, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', padding: 0, border: `1px solid ${theme.border}`, background: `${theme.accent}10`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {uploadingCover === collKey ? <span style={{ fontSize: 12 }}>⏳</span>
                              : variants[0]?.coverImage ? <img src={variants[0].coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={{ opacity: 0.4, fontSize: 14 }}>📷</span>}
                          </button>
                          <button
                            onClick={() => setExpandedColls(p => ({ ...p, [collKey]: p[collKey] === false ? undefined : false }))}
                            style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '6px 4px', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <span style={{ color: theme.text, opacity: 0.4, fontSize: 11, display: 'inline-block', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }}>▼</span>
                            <span style={{ color: theme.accent, fontWeight: 600, fontSize: 13, flex: 1, textAlign: 'left' }}>📋 {collName}</span>
                            <span style={{ color: theme.text, opacity: 0.35, fontSize: 11 }}>{variants.length}</span>
                          </button>
                        </div>
                        {isOpen && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 4 }}>
                            {sorted.map(t => (
                              <div key={t.id} style={{ position: 'relative' }}>
                                <button
                                  onClick={() => { setSelectedTest(t); loadQuestions(t.id); setActiveTab('questions'); }}
                                  title={`${t.variantNo}-variant${t.pdfUrl ? ' · PDF ✅' : ''}`}
                                  style={{ width: 38, height: 38, borderRadius: 8, fontWeight: 700, fontSize: 13,
                                    border: `2px solid ${selectedTest?.id === t.id ? theme.accent : theme.border}`,
                                    backgroundColor: selectedTest?.id === t.id ? `${theme.accent}20` : t.pdfUrl ? `${theme.accent}08` : 'transparent',
                                    color: selectedTest?.id === t.id ? theme.accent : theme.text, cursor: 'pointer', position: 'relative' }}>
                                  {t.variantNo}
                                  {t.pdfUrl && <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, backgroundColor: '#10b981', borderRadius: '50%', border: `1px solid ${theme.card}` }} />}
                                </button>
                                <button onClick={() => deleteTest(t)} title="O'chirish"
                                  style={{ position: 'absolute', top: -6, left: -6, width: 16, height: 16, borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.85 }}>
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* RIGHT */}
        {selectedTest ? (
          <div>
            <div style={{ ...s.card, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: theme.text, fontWeight: 700, fontSize: 16 }}>{selectedTest.title}</div>
                <div style={{ color: theme.text, opacity: 0.5, fontSize: 12 }}>
                  {selectedTest.authorName} · {selectedTest.collectionName} · {selectedTest.duration} min · {TOTAL_Q} savol
                </div>
              </div>
            </div>

            {/* PDF */}
            <div style={{ ...s.card, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: theme.text, fontWeight: 600, marginBottom: 3 }}>📄 PDF Fayl (ixtiyoriy)</div>
                {selectedTest.pdfUrl
                  ? <a href={selectedTest.pdfUrl} target="_blank" rel="noreferrer" style={{ color: theme.accent, fontSize: 13 }}>PDF ko'rish →</a>
                  : <span style={{ color: '#f59e0b', fontSize: 13 }}>PDF yuklanmagan</span>}
              </div>
              <label style={{ cursor: 'pointer' }}>
                <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ''; }} />
                <span style={{ padding: '7px 14px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', borderRadius: 9, fontWeight: 600, fontSize: 13, display: 'inline-block' }}>
                  {uploadingPdf ? '⏳...' : selectedTest.pdfUrl ? '🔄 Almashtirish' : '📎 PDF Yuklash'}
                </span>
              </label>
              {selectedTest.pdfUrl && (
                <button onClick={deletePdf} disabled={uploadingPdf}
                  style={{ padding: '7px 12px', backgroundColor: '#ef444420', color: '#ef4444', border: '1px solid #ef4444', borderRadius: 9, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                  🗑 O'chirish
                </button>
              )}
            </div>

            {/* Telegram ID */}
            <div style={{ ...s.card, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: theme.text, fontWeight: 600, marginBottom: 2 }}>📱 Telegram ID</div>
                <div style={{ color: theme.text, opacity: 0.5, fontSize: 12 }}>Kanal caption uchun: <b>{selectedTest.telegramId ?? '—'}</b> → masalan <b>{selectedTest.telegramId ?? '?'}:5</b></div>
              </div>
              <input
                type="text"
                placeholder="masalan 1 yoki AT1"
                defaultValue={selectedTest.telegramId ?? ''}
                key={selectedTest.id}
                style={{ width: 110, padding: '7px 10px', borderRadius: 9, border: `1px solid ${theme.border}`, backgroundColor: theme.bg, color: theme.text, fontSize: 14 }}
                onBlur={async e => {
                  const val = e.target.value.trim() || null;
                  if (val === (selectedTest.telegramId ?? null)) return;
                  try {
                    await api.patch(`/tests/${selectedTest.id}`, { telegramId: val });
                    setSelectedTest(p => p ? { ...p, telegramId: val ?? undefined } : p);
                    await loadTests();
                    await loadQuestions(selectedTest.id);
                    toast.success('Telegram ID saqlandi! Videolar ham yangilandi.');
                  } catch (err: any) { toast.error(err.response?.data?.message || 'Xatolik'); }
                }}
              />
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
              {(['questions', 'videos'] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ padding: '7px 16px', borderRadius: 9, border: `1px solid ${activeTab === tab ? theme.accent : theme.border}`, backgroundColor: activeTab === tab ? `${theme.accent}20` : 'transparent', color: activeTab === tab ? theme.accent : theme.text, cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
                  {tab === 'questions' ? '📋 Savollar' : '📹 Videolar'}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              {activeTab === 'questions' && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ color: theme.text, opacity: 0.5, fontSize: 12 }}>Savol usuli:</span>
                  {(['answers', 'image', 'pdf'] as QMode[]).map(m => (
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
                {/* PDF mode */}
                {qMode === 'pdf' && (
                  <div style={{ ...s.card, textAlign: 'center', padding: 30 }}>
                    <p style={{ color: theme.text, fontSize: 15, fontWeight: 600, marginBottom: 8 }}>📄 Butun variant uchun PDF yuklang</p>
                    <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 20 }}>Student test vaqtida shu PDF ni ko'radi va javoblarni A/B/C/D belgilaydi</p>
                    <label style={{ cursor: 'pointer' }}>
                      <input type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadPdf(f); e.target.value = ''; }} />
                      <span style={{ padding: '12px 28px', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', borderRadius: 12, fontWeight: 700, fontSize: 15, display: 'inline-block' }}>
                        {uploadingPdf ? '⏳ Yuklanmoqda...' : selectedTest.pdfUrl ? '🔄 PDF Almashtirish' : '📎 PDF Yuklash'}
                      </span>
                    </label>
                    {selectedTest.pdfUrl && (
                      <p style={{ color: '#10b981', fontSize: 13, marginTop: 14 }}>✅ PDF biriktirilgan — <a href={selectedTest.pdfUrl} target="_blank" rel="noreferrer" style={{ color: theme.accent }}>ko'rish →</a></p>
                    )}
                  </div>
                )}

                {/* Image mode */}
                {qMode === 'image' && (
                  <>
                    <label style={{ cursor: 'pointer', display: 'block', border: `2px dashed ${bulkUploading ? theme.accent : theme.border}`, borderRadius: 12, padding: '14px 20px', marginBottom: 16, textAlign: 'center' }}>
                      <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => { if (e.target.files) bulkUpload(e.target.files); e.target.value = ''; }} />
                      {bulkUploading
                        ? <span style={{ color: theme.accent, fontWeight: 600 }}>⏳ {bulkProgress.done}/{bulkProgress.total} yuklanyapti...</span>
                        : <span style={{ color: theme.accent, fontWeight: 600 }}>🖼 Ko'p rasm birdan yuklash</span>}
                      <p style={{ color: theme.text, opacity: 0.4, fontSize: 12, margin: '4px 0 0' }}>Fayl nomi raqam bo'lsin: 1.jpg, 2.png yoki savol1.jpg</p>
                    </label>
                    {loading ? (
                      <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {questions.map(q => (
                          <div key={q.orderNo} style={{ ...s.card, borderRadius: 12, padding: '12px 16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                              <span style={{ color: theme.accent, fontWeight: 800, fontSize: 15, minWidth: 28 }}>{q.orderNo}</span>
                              {q.imageUrl && <span style={{ fontSize: 11, color: '#10b981', backgroundColor: '#10b98115', padding: '2px 7px', borderRadius: 5 }}>✓ Rasm</span>}
                              <div style={{ flex: 1 }} />
                              <span style={{ color: theme.text, opacity: 0.5, fontSize: 11 }}>Ball:</span>
                              <input type="number" defaultValue={q.scorePoint || 1} min={0} max={10} step={0.5}
                                onBlur={e => setScore(q.orderNo, parseFloat(e.target.value))}
                                style={{ width: 48, padding: '3px 5px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 6, outline: 'none', fontSize: 12 }} />
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                              <div tabIndex={0} onPaste={e => pasteImage(q.orderNo, e)}
                                onFocus={() => setPasteTarget(q.orderNo)} onBlur={() => setPasteTarget(null)}
                                style={{ display: 'flex', gap: 5, alignItems: 'center', padding: '5px 10px', borderRadius: 9, border: `2px dashed ${pasteTarget === q.orderNo ? theme.accent : theme.border}`, backgroundColor: pasteTarget === q.orderNo ? `${theme.accent}10` : theme.input, cursor: 'pointer', outline: 'none' }}>
                                <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(q.orderNo, f); e.target.value = ''; }} />
                                  <span style={{ color: theme.text, fontSize: 12 }}>{uploading === q.orderNo ? '⏳' : q.imageUrl ? '🖼 Almashtir' : '📎 Yuklash'}</span>
                                </label>
                                <span style={{ color: theme.text, opacity: 0.4, fontSize: 11 }}>yoki ⌘V</span>
                              </div>
                              {q.imageUrl && (
                                <div style={{ position: 'relative' }}>
                                  <img src={q.imageUrl} alt="" style={{ height: 52, borderRadius: 6, border: `1px solid ${theme.border}`, objectFit: 'cover' }} />
                                  <button onClick={() => deleteImage(q.orderNo)} title="Rasmni o'chirish"
                                    style={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                                </div>
                              )}
                              <div style={{ display: 'flex', gap: 5 }}>
                                {OPTS.map(opt => (
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

                {/* Answers mode */}
                {qMode === 'answers' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                      <button onClick={saveAllAnswers} disabled={saving}
                        style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13, opacity: saving ? 0.7 : 1 }}>
                        {saving ? '⏳ Saqlanmoqda...' : '💾 Hammasini saqlash'}
                      </button>
                    </div>
                    {loading ? (
                      <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: `repeat(${Math.ceil(questions.length / 2)}, auto)`, gridAutoFlow: 'column', gap: 8 }}>
                        {questions.map(q => (
                          <div key={q.orderNo} style={{ ...s.card, borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                            <span style={{ color: theme.accent, fontWeight: 700, fontSize: 15, minWidth: 26 }}>{q.orderNo}</span>
                            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
                              {OPTS.map(opt => (
                                <button key={opt} onClick={() => saveAnswer(q.orderNo, opt)}
                                  style={{ flex: 1, height: 34, borderRadius: 8, border: `2px solid ${q.correctAnswer === opt ? '#10b981' : theme.border}`, backgroundColor: q.correctAnswer === opt ? '#10b981' : 'transparent', color: q.correctAnswer === opt ? '#fff' : theme.text, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                                  {opt}
                                </button>
                              ))}
                            </div>
                            <input type="number" defaultValue={q.scorePoint || 1} min={0} max={5} step={0.5}
                              onBlur={e => setScore(q.orderNo, parseFloat(e.target.value))}
                              style={{ width: 44, padding: '3px 5px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 6, outline: 'none', fontSize: 12 }} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === 'videos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Array.from({ length: TOTAL_Q }, (_, i) => i + 1).map(n => (
                  <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 10, ...s.card, borderRadius: 10, padding: '8px 14px' }}>
                    <span style={{ color: theme.accent, fontWeight: 700, minWidth: 28, fontSize: 14 }}>{n}</span>
                    <input defaultValue={videos[n] || ''} placeholder="Telegram file_id..."
                      onBlur={e => { if (e.target.value) saveVideo(n, e.target.value); }}
                      style={{ flex: 1, padding: '6px 10px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 7, outline: 'none', fontSize: 12 }} />
                    {videos[n] && <span style={{ color: '#10b981', fontSize: 12 }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, color: theme.text, opacity: 0.4, flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 40 }}>🎯</span>
            <span>Chap tarafdan variant tanlang</span>
          </div>
        )}
      </div>
    </div>
  );
}
