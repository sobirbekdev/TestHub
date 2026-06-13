'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/theme';
import { useAuthStore } from '@/store/auth';
import { Question } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ThemeWrapper from '@/components/layout/ThemeWrapper';

// ─── Screenshot himoyasi ──────────────────────────────────────────────────────
const antiScreenshotStyle: React.CSSProperties = {
  userSelect: 'none',
  WebkitUserSelect: 'none',
  pointerEvents: 'none',
};

// ─── Turlar ──────────────────────────────────────────────────────────────────

type TestType = 'DTM_VARIANT' | 'DTM_RANDOM' | 'NATIONAL_CERT' | 'ATTESTATION' | 'TOPIC';

interface TestInfo {
  id: number;
  type: TestType;
  title: string;
  duration: number;
  totalQ: number;
  pdfUrl?: string;
}

interface TQ {
  orderNo: number;
  imageUrl?: string;
  questionText?: string;
  correctAnswer?: string;
  scorePoint?: number;
}

interface UserAnswer {
  questionId?: number;
  orderNo?: number;
  selectedOpts: string[];
  openText?: string;
  imageUrl?: string;
}

// ─── Milliy Sert javob variantlari ─────────────────────────────────────────
function getOpts(testType: TestType, orderNo: number): string[] {
  if (testType === 'NATIONAL_CERT') {
    if (orderNo >= 33 && orderNo <= 35) return ['A', 'B', 'C', 'D', 'E', 'F'];
    if (orderNo >= 36 && orderNo <= 40) return []; // open
    if (orderNo >= 41 && orderNo <= 43) return []; // AI image
  }
  // ATTESTATION va DTM_VARIANT: hammasi A/B/C/D
  return ['A', 'B', 'C', 'D'];
}

function isOpenQ(testType: TestType, orderNo: number) {
  if (testType === 'NATIONAL_CERT' && orderNo >= 36 && orderNo <= 40) return true;
  return false;
}

function isAiQ(testType: TestType, orderNo: number) {
  return testType === 'NATIONAL_CERT' && orderNo >= 41 && orderNo <= 43;
}

// ─── Asosiy komponent ────────────────────────────────────────────────────────

export default function TestPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const searchParams = useSearchParams();
  const testId = searchParams.get('testId');
  const router = useRouter();
  const { theme } = useThemeStore();
  const { user } = useAuthStore();

  const [testInfo, setTestInfo] = useState<TestInfo | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]); // question-based
  const [tqs, setTqs] = useState<TQ[]>([]); // image-based
  const [current, setCurrent] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [answers, setAnswers] = useState<Map<string, UserAnswer>>(new Map()); // key: "q{id}" or "o{orderNo}"
  const [remaining, setRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [finishing, setFinishing] = useState(false);
  const finishingRef = useRef(false); // race condition oldini olish
  const [uploading, setUploading] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const isImageBased = testInfo?.type === 'DTM_VARIANT' || testInfo?.type === 'NATIONAL_CERT' || testInfo?.type === 'ATTESTATION' || testInfo?.type === 'TOPIC';
  const totalQ = isImageBased ? tqs.length : questions.length;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 700);
    check();
    window.addEventListener('resize', check);

    // Screenshot va saqlashni bloklash
    const blockKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // PrintScreen
      if (e.key === 'PrintScreen') { e.preventDefault(); toast.error('Ruxsat etilmagan'); return; }
      // Ctrl/Cmd + S (saqlash), P (print), U (source), Shift+I (devtools), Shift+J, Shift+C
      if (e.ctrlKey || e.metaKey) {
        if (['s','p','u'].includes(k)) { e.preventDefault(); return; }
        if (e.shiftKey && ['i','j','c'].includes(k)) { e.preventDefault(); return; }
      }
      // F12 (devtools)
      if (e.key === 'F12') { e.preventDefault(); return; }
    };
    const blockContext = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('keydown', blockKey);
    document.addEventListener('contextmenu', blockContext);

    return () => {
      window.removeEventListener('resize', check);
      document.removeEventListener('keydown', blockKey);
      document.removeEventListener('contextmenu', blockContext);
    };
  }, []);

  useEffect(() => {
    if (!testId) return;
    const load = async () => {
      try {
        const tRes = await api.get(`/tests/${testId}`);
        const test: TestInfo = tRes.data;
        setTestInfo(test);

        const imageBased = test.type === 'DTM_VARIANT' || test.type === 'NATIONAL_CERT' || test.type === 'ATTESTATION' || test.type === 'TOPIC';
        if (imageBased) {
          const qRes = await api.get(`/tests/${testId}/tq`);
          const all = qRes.data as TQ[];
          // Fill gaps
          const n = test.totalQ;
          const qMap: Record<number, TQ> = {};
          all.forEach((q) => { qMap[q.orderNo] = q; });
          setTqs(Array.from({ length: n }, (_, i) => ({ orderNo: i + 1, imageUrl: qMap[i + 1]?.imageUrl, questionText: qMap[i + 1]?.questionText, correctAnswer: qMap[i + 1]?.correctAnswer, scorePoint: qMap[i + 1]?.scorePoint })));
        } else {
          const qRes = await api.get(`/questions/by-test/${testId}`);
          setQuestions(qRes.data);
        }

        const dur = test.duration * 60;
        setRemaining(dur);
        setLoading(false);

        timerRef.current = setInterval(() => {
          setRemaining((prev) => {
            if (prev <= 1) { clearInterval(timerRef.current!); finishTest(true); return 0; }
            return prev - 1;
          });
        }, 1000);
      } catch {
        toast.error('Test yuklanmadi');
        router.back();
      }
    };
    load();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [testId]);

  const setAnswer = (key: string, update: Partial<UserAnswer>) => {
    setAnswers((prev) => {
      const map = new Map(prev);
      const cur = map.get(key) || { selectedOpts: [] };
      map.set(key, { ...cur, ...update });
      return map;
    });
  };

  const selectOpt = (key: string, label: string, multi = false) => {
    setAnswers((prev) => {
      const map = new Map(prev);
      const cur = map.get(key) || { selectedOpts: [] };
      let opts = [...cur.selectedOpts];
      if (multi) {
        opts = opts.includes(label) ? opts.filter((o) => o !== label) : [...opts, label];
      } else {
        opts = [label];
      }
      map.set(key, { ...cur, selectedOpts: opts });
      return map;
    });
  };

  const uploadAiImage = async (orderNo: number, file: File) => {
    setUploading(true);
    try {
      const fd = new FormData(); fd.append('file', file);
      const r = await api.post('/upload/file', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAnswer(`o${orderNo}`, { orderNo, selectedOpts: [], imageUrl: r.data.url });
      toast.success('Rasm yuklandi');
    } catch { toast.error('Rasm yuklanmadi'); }
    setUploading(false);
  };

  const finishTest = useCallback(async (forced = false) => {
    if (finishingRef.current) return;
    if (!forced && !isImageBased && answers.size < questions.length) {
      const ok = window.confirm(`${questions.length - answers.size} ta savol javobsiz. Yakunlaysizmi?`);
      if (!ok) return;
    }
    finishingRef.current = true;
    if (timerRef.current) clearInterval(timerRef.current);
    setFinishing(true);
    try {
      let payload: any[];
      if (isImageBased && testInfo) {
        payload = Array.from({ length: testInfo.totalQ }, (_, i) => {
          const orderNo = i + 1;
          const ans = answers.get(`o${orderNo}`);
          return { orderNo, selectedOpts: ans?.selectedOpts || [], openText: ans?.openText, imageUrl: ans?.imageUrl };
        });
      } else {
        payload = questions.map((q) => {
          const ans = answers.get(`q${q.id}`);
          return { questionId: q.id, selectedOpts: ans?.selectedOpts || [], openText: ans?.openText };
        });
      }
      await api.post(`/attempts/${attemptId}/finish`, { answers: payload });
      router.push(`/result/${attemptId}`);
    } catch (e: any) {
      const msg = e.response?.data?.message || 'Yakunlashda xatolik';
      toast.error(msg);
      finishingRef.current = false;
      setFinishing(false);
    }
  }, [isImageBased, questions, answers, testInfo, attemptId, router]);

  if (loading) return (
    <ThemeWrapper>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: theme.text }}>
        Yuklanmoqda...
      </div>
    </ThemeWrapper>
  );

  const mins = String(Math.floor(remaining / 60)).padStart(2, '0');
  const secs = String(remaining % 60).padStart(2, '0');
  const isUrgent = remaining < 300;

  const Header = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
      backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 18px', gap: 12 }}>
      <span style={{ color: theme.text, fontWeight: 600, fontSize: 14 }}>{testInfo?.title}</span>
      <span style={{ color: isUrgent ? '#ef4444' : theme.accent, fontWeight: 700, fontSize: 20, fontFamily: 'monospace', flexShrink: 0 }}>
        ⏱ {mins}:{secs}
      </span>
      <button onClick={() => finishTest()} disabled={finishing}
        style={{ padding: '7px 16px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', borderRadius: 10, fontWeight: 600, fontSize: 13, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
        {finishing ? '⏳' : '✓ Yakunlash'}
      </button>
    </div>
  );

  // ─── DTM / ATTESTATION ────────────────────────────────────────────────────
  if (testInfo?.type === 'DTM_VARIANT' || testInfo?.type === 'ATTESTATION' || testInfo?.type === 'TOPIC') {
    const answeredCount = tqs.filter((tq) => {
      const a = answers.get(`o${tq.orderNo}`);
      return a && a.selectedOpts.length > 0;
    }).length;

    // Har bir savol uchun rasm yoki matn bor bo'lsa — per-question view
    const hasPerQ = tqs.some(q => q.imageUrl || q.questionText);

    if (hasPerQ) {
      // Per-question view (like NATIONAL_CERT)
      const tq = tqs[current];
      const key = `o${tq?.orderNo}`;
      const ans = answers.get(key);
      return (
        <ThemeWrapper>
          <div style={{ maxWidth: 800, margin: '0 auto', padding: '16px', paddingBottom: 100, userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}>
            <Header />
            {/* Nav */}
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 16 }}>
              {tqs.map((q, i) => {
                const k = `o${q.orderNo}`;
                const hasAns = answers.has(k) && answers.get(k)!.selectedOpts.length > 0;
                return (
                  <button key={i} onClick={() => setCurrent(i)}
                    style={{ width: 34, height: 34, borderRadius: 8, fontWeight: 600, fontSize: 12,
                      border: `1px solid ${i === current ? theme.accent : theme.border}`,
                      backgroundColor: hasAns ? `${theme.accent}30` : theme.card,
                      color: i === current ? theme.accent : theme.text, cursor: 'pointer' }}>
                    {q.orderNo}
                  </button>
                );
              })}
            </div>
            {tq && (
              <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                  <span style={{ color: theme.accent, fontWeight: 700, fontSize: 18 }}>{tq.orderNo}-savol</span>
                  <span style={{ fontSize: 11, color: theme.text, opacity: 0.4 }}>{answeredCount}/{tqs.length} javoblandi</span>
                </div>
                {tq.questionText && (
                  <div style={{ marginBottom: 14, padding: '12px 16px', backgroundColor: `${theme.accent}0a`, border: `1px solid ${theme.accent}25`, borderRadius: 12 }}>
                    <p style={{ color: theme.text, fontSize: 15, lineHeight: 1.6, margin: 0 }}>{tq.questionText}</p>
                  </div>
                )}
                {tq.imageUrl && (
                  <div style={{ marginBottom: 16 }}>
                    <img src={tq.imageUrl} alt={`Savol ${tq.orderNo}`}
                      style={{ maxWidth: '100%', borderRadius: 10, userSelect: 'none', pointerEvents: 'none' }}
                      onContextMenu={e => e.preventDefault()} draggable={false} />
                  </div>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {['A', 'B', 'C', 'D'].map((opt) => {
                    const sel = ans?.selectedOpts?.[0] === opt;
                    return (
                      <button key={opt} onClick={() => selectOpt(key, opt)}
                        style={{ minWidth: 56, height: 48, borderRadius: 12, fontWeight: 700, fontSize: 18,
                          border: `2px solid ${sel ? '#10b981' : theme.border}`,
                          backgroundColor: sel ? '#10b981' : theme.card,
                          color: sel ? '#fff' : theme.text, cursor: 'pointer' }}>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                  <button onClick={() => setCurrent(c => Math.max(0, c - 1))} disabled={current === 0}
                    style={{ padding: '8px 18px', borderRadius: 9, border: `1px solid ${theme.border}`, backgroundColor: theme.card, color: theme.text, cursor: 'pointer', fontWeight: 600, opacity: current === 0 ? 0.4 : 1 }}>
                    ← Oldingi
                  </button>
                  {current < tqs.length - 1 ? (
                    <button onClick={() => setCurrent(c => c + 1)}
                      style={{ padding: '8px 18px', borderRadius: 9, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      Keyingi →
                    </button>
                  ) : (
                    <button onClick={() => finishTest()} disabled={finishing}
                      style={{ padding: '8px 18px', borderRadius: 9, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                      {finishing ? '⏳' : '✓ Yakunlash'}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </ThemeWrapper>
      );
    }

    // PDF + answers panel view
    return (
      <ThemeWrapper>
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', padding: '12px 12px 0', gap: 10, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 14px', gap: 10, flexShrink: 0 }}>
            <span style={{ color: theme.text, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40vw' }}>{testInfo?.title}</span>
            <span style={{ color: isUrgent ? '#ef4444' : theme.accent, fontWeight: 700, fontSize: 18, fontFamily: 'monospace', flexShrink: 0 }}>
              ⏱ {mins}:{secs}
            </span>
            <button onClick={() => finishTest()} disabled={finishing}
              style={{ padding: '7px 14px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', borderRadius: 9, fontWeight: 600, fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              {finishing ? '⏳' : '✓ Yakunlash'}
            </button>
          </div>

          {/* Kontent: katta ekranda yon-yon, kichikda ustma-ust */}
          <div style={{ flex: 1, display: 'flex', gap: 10, minHeight: 0,
            flexDirection: isMobile ? 'column' : 'row' }}>

            {/* PDF — himoyalangan ko'rinish */}
            <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: `1px solid ${theme.border}`, minHeight: isMobile ? 160 : undefined, display: 'flex', flexDirection: 'column', position: 'relative' }}>
              {testInfo.pdfUrl ? (
                <>
                  <iframe
                    src={`${testInfo.pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                    style={{ width: '100%', flex: 1, border: 'none', minHeight: isMobile ? 300 : undefined }}
                    title="PDF"
                  />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 50, zIndex: 20, backgroundColor: 'transparent' }} onContextMenu={e => e.preventDefault()} />
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.text, opacity: 0.4, flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 32 }}>📄</span>
                  <span>PDF yuklanmagan</span>
                </div>
              )}
            </div>

            {/* Javoblar paneli */}
            <div style={{ width: isMobile ? '100%' : 320,
              flexShrink: 0, backgroundColor: theme.card, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: 12, overflowY: 'auto', maxHeight: isMobile ? 280 : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ color: theme.text, fontWeight: 600, fontSize: 13 }}>Javoblar</p>
                <span style={{ fontSize: 11, color: theme.text, opacity: 0.5 }}>{answeredCount}/{tqs.length}</span>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                {[0, 1].map((col) => {
                  const half = Math.ceil(tqs.length / 2);
                  return (
                    <div key={col} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {tqs.slice(col * half, col * half + half).map((tq) => {
                        const key = `o${tq.orderNo}`;
                        const ans = answers.get(key);
                        const selected = ans?.selectedOpts?.[0];
                        return (
                          <div key={tq.orderNo} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <span style={{ color: theme.text, opacity: 0.6, fontSize: 11, minWidth: 18, textAlign: 'right' }}>{tq.orderNo}.</span>
                            {['A', 'B', 'C', 'D'].map((opt) => (
                              <button key={opt} onClick={() => selectOpt(key, opt)}
                                style={{
                                  flex: 1, height: 26, borderRadius: 5,
                                  border: `2px solid ${selected === opt ? '#10b981' : theme.border}`,
                                  backgroundColor: selected === opt ? '#10b981' : 'transparent',
                                  color: selected === opt ? '#fff' : theme.text,
                                  fontWeight: 700, cursor: 'pointer', fontSize: 11,
                                }}>
                                {opt}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ height: 12 }} />
        </div>
      </ThemeWrapper>
    );
  }

  // ─── Milliy Sert: PDF + Javoblar paneli ─────────────────────────────────
  if (testInfo?.type === 'NATIONAL_CERT') {
    const answeredCount = tqs.filter((tq) => {
      const a = answers.get(`o${tq.orderNo}`);
      return a && (a.selectedOpts.length > 0 || a.openText || a.imageUrl);
    }).length;

    return (
      <ThemeWrapper>
        <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', padding: '10px 10px 0', gap: 8, overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 12,
            padding: '10px 14px', gap: 10, flexShrink: 0 }}>
            <span style={{ color: theme.text, fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '40vw' }}>
              {testInfo.title}
            </span>
            <span style={{ color: isUrgent ? '#ef4444' : theme.accent, fontWeight: 700, fontSize: 18, fontFamily: 'monospace', flexShrink: 0 }}>
              ⏱ {mins}:{secs}
            </span>
            <button onClick={() => finishTest()} disabled={finishing}
              style={{ padding: '7px 14px', background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', borderRadius: 9, fontWeight: 600, fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0 }}>
              {finishing ? '⏳' : '✓ Yakunlash'}
            </button>
          </div>

          {/* Kontent */}
          <div style={{ flex: 1, display: 'flex', gap: 8, minHeight: 0, flexDirection: isMobile ? 'column' : 'row' }}>

            {/* Chap: PDF himoyalangan */}
            <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: `1px solid ${theme.border}`, display: 'flex', flexDirection: 'column', position: 'relative', minHeight: isMobile ? 200 : undefined, userSelect: 'none', WebkitUserSelect: 'none' } as React.CSSProperties}>
              {testInfo.pdfUrl ? (
                <>
                  <iframe
                    src={`${testInfo.pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
                    style={{ width: '100%', flex: 1, border: 'none', minHeight: isMobile ? 280 : undefined }}
                    title="PDF"
                  />
                  {/* Yuklab olish / right-click bloklash */}
                  <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }} />
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 44, zIndex: 20, background: 'transparent' }}
                    onContextMenu={e => e.preventDefault()} />
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: theme.text, opacity: 0.4, flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontSize: 32 }}>📄</span>
                  <span style={{ fontSize: 13 }}>PDF yuklanmagan</span>
                </div>
              )}
            </div>

            {/* O'ng: Javoblar paneli */}
            <div style={{
              width: isMobile ? '100%' : 240, flexShrink: 0,
              backgroundColor: theme.card, border: `1px solid ${theme.border}`,
              borderRadius: 12, padding: '10px 10px', overflowY: 'auto',
              maxHeight: isMobile ? 320 : undefined,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <p style={{ color: theme.text, fontWeight: 700, fontSize: 13 }}>Javoblar</p>
                <span style={{ fontSize: 11, color: theme.text, opacity: 0.5 }}>{answeredCount}/{tqs.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {tqs.map((tq) => {
                  const k = `o${tq.orderNo}`;
                  const a = answers.get(k);
                  const selected = a?.selectedOpts?.[0];
                  const openVal = a?.openText || '';
                  const hasImg = !!a?.imageUrl;
                  const opts = getOpts('NATIONAL_CERT', tq.orderNo);
                  const isOpenRow = isOpenQ('NATIONAL_CERT', tq.orderNo);
                  const isAiRow = isAiQ('NATIONAL_CERT', tq.orderNo);

                  return (
                    <div key={tq.orderNo} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ color: theme.text, opacity: 0.55, fontSize: 11, minWidth: 20, textAlign: 'right', flexShrink: 0 }}>
                        {tq.orderNo}.
                      </span>

                      {/* A-D yoki A-F tugmalar */}
                      {opts.length > 0 && opts.map((opt) => (
                        <button key={opt} onClick={() => selectOpt(k, opt)}
                          style={{
                            flex: 1, height: 24, borderRadius: 4, fontSize: 10, fontWeight: 700,
                            border: `1.5px solid ${selected === opt ? theme.accent : theme.border}`,
                            backgroundColor: selected === opt ? theme.accent : 'transparent',
                            color: selected === opt ? '#fff' : theme.text,
                            cursor: 'pointer', minWidth: 0,
                          }}>
                          {opt}
                        </button>
                      ))}

                      {/* Ochiq javob (36-40) */}
                      {isOpenRow && (
                        <input
                          placeholder="Javob..."
                          value={openVal}
                          onChange={e => setAnswer(k, { orderNo: tq.orderNo, selectedOpts: [], openText: e.target.value })}
                          style={{
                            flex: 1, height: 28, padding: '0 8px', fontSize: 12,
                            backgroundColor: theme.input, border: `1px solid ${theme.accent}`,
                            color: theme.text, borderRadius: 6, outline: 'none',
                          }}
                        />
                      )}

                      {/* AI rasm (41-43) */}
                      {isAiRow && (
                        <label style={{ flex: 1, cursor: 'pointer', pointerEvents: 'auto' } as React.CSSProperties}>
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadAiImage(tq.orderNo, f); e.target.value = ''; }} />
                          <span style={{
                            display: 'block', textAlign: 'center', height: 24, lineHeight: '24px',
                            fontSize: 10, borderRadius: 5, fontWeight: 600,
                            backgroundColor: hasImg ? '#10b98120' : `${theme.accent}15`,
                            border: `1px dashed ${hasImg ? '#10b981' : theme.accent}`,
                            color: hasImg ? '#10b981' : theme.accent,
                          }}>
                            {uploading ? '⏳' : hasImg ? '✅ rasm' : '📷 yuklang'}
                          </span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          <div style={{ height: 8 }} />
        </div>
      </ThemeWrapper>
    );
  }

  // ─── Oddiy savol asosidagi test (DTM_RANDOM, TOPIC) ─────────────────────
  const q = questions[current];
  const key = `q${q?.id}`;
  const ans = answers.get(key);
  const isMulti = q?.qType === 'MULTI';
  const isOpen = q?.qType === 'OPEN' || q?.qType === 'REACTIONS';

  return (
    <ThemeWrapper>
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '16px', paddingBottom: 100 }}>
        <Header />

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrent(i)}
              style={{
                width: 34, height: 34, borderRadius: 8, fontWeight: 600, fontSize: 12,
                border: `1px solid ${i === current ? theme.accent : theme.border}`,
                backgroundColor: answers.has(`q${questions[i].id}`) ? `${theme.accent}30` : theme.card,
                color: i === current ? theme.accent : theme.text, cursor: 'pointer',
              }}>
              {i + 1}
            </button>
          ))}
        </div>

        {q && (
          <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20 }}>
            <p style={{ color: theme.text, opacity: 0.4, fontSize: 12, marginBottom: 8 }}>
              {q.qType === 'MULTI' ? "⚠️ Ko'p to'g'ri javob" : q.qType === 'OPEN' ? '✍️ Ochiq javob' : ''}
            </p>
            <p style={{ color: theme.text, fontSize: 16, lineHeight: 1.6, marginBottom: 20 }}>{q.text}</p>
            {q.imageUrl && <img src={q.imageUrl} alt="" style={{ maxWidth: '100%', borderRadius: 10, marginBottom: 16 }} />}

            {!isOpen && q.options.map((opt) => {
              const selected = ans?.selectedOpts?.includes(opt.label);
              return (
                <button key={opt.id} onClick={() => selectOpt(key, opt.label, isMulti)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                    marginBottom: 8, padding: '12px 16px', borderRadius: 12, textAlign: 'left',
                    border: `1px solid ${selected ? theme.accent : theme.border}`,
                    backgroundColor: selected ? `${theme.accent}20` : theme.input,
                    color: theme.text, cursor: 'pointer', transition: 'all 0.15s',
                  }}>
                  <span style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? theme.accent : theme.border, color: selected ? '#fff' : theme.text, fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {opt.label}
                  </span>
                  <span style={{ fontSize: 14 }}>{opt.text}</span>
                </button>
              );
            })}

            {isOpen && (
              <textarea placeholder="Javobingizni yozing..." value={ans?.openText || ''}
                onChange={(e) => setAnswer(key, { questionId: q.id, selectedOpts: [], openText: e.target.value })}
                style={{ width: '100%', minHeight: 100, padding: '12px 14px', backgroundColor: theme.input, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 10, fontSize: 14, resize: 'vertical', outline: 'none' }}
              />
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button onClick={() => setCurrent((p) => Math.max(0, p - 1))} disabled={current === 0}
            style={{ flex: 1, padding: '12px', borderRadius: 12, border: `1px solid ${theme.border}`, backgroundColor: theme.card, color: theme.text, cursor: 'pointer', fontWeight: 600, opacity: current === 0 ? 0.4 : 1 }}>
            ← Oldingi
          </button>
          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent((p) => p + 1)}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              Keyingi →
            </button>
          ) : (
            <button onClick={() => finishTest()} disabled={finishing}
              style={{ flex: 1, padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
              ✓ Yakunlash
            </button>
          )}
        </div>
      </div>
    </ThemeWrapper>
  );
}
