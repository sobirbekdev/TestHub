'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/theme';
import { AttemptResult, Answer } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import ThemeWrapper from '@/components/layout/ThemeWrapper';
import Navbar from '@/components/layout/Navbar';

export default function ResultPage() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeNo, setActiveNo] = useState<number | null>(null);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;

    const fetchResult = async () => {
      try {
        const r = await api.get(`/attempts/${attemptId}/result`);
        setResult(r.data);
        setLoading(false);
        // AI hali tekshirayotgan savollar bormi?
        const stillPending = (r.data.answers || []).some(
          (a: Answer) => a.aiStatus === 'PENDING' || a.aiStatus === 'RECHECK',
        );
        if (!stillPending && timer) { clearInterval(timer); timer = null; }
        return stillPending;
      } catch {
        setLoading(false);
        return false;
      }
    };

    fetchResult().then((pending) => {
      if (pending) {
        timer = setInterval(fetchResult, 4000);
      }
    });

    return () => { if (timer) clearInterval(timer); };
  }, [attemptId]);

  const openVideo = async (ans: Answer) => {
    const no = ans.orderNo ?? 0;

    // Yopish
    if (activeNo === no) {
      if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
      setActiveNo(null); setVideoBlobUrl(null);
      return;
    }

    // Videosi yo'q
    if (!ans.videoFileId) {
      toast('Bu savol uchun video yechim yo\'q', { icon: 'ℹ️' });
      return;
    }

    if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl);
    setVideoBlobUrl(null);
    setActiveNo(no);
    setVideoLoading(true);
    try {
      const res = await api.get(`/telegram/stream/${ans.videoFileId}`, { responseType: 'blob' });
      setVideoBlobUrl(URL.createObjectURL(res.data));
    } catch {
      toast.error('Video yuklanmadi');
      setActiveNo(null);
    }
    setVideoLoading(false);
  };

  if (loading) return (
    <ThemeWrapper>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'white' }}>
        Yuklanmoqda...
      </div>
    </ThemeWrapper>
  );
  if (!result) return (
    <ThemeWrapper>
      <div style={{ padding: 20, color: 'white' }}>Natija topilmadi</div>
    </ThemeWrapper>
  );

  const score = result.totalScore ?? result.score ?? 0;
  const correct = result.answers.filter((a) => a.isCorrect === true).length;
  const total = result.test.totalQ;

  // Savollarni orderNo yoki index bo'yicha sort
  const answers = [...result.answers].sort((a, b) => (a.orderNo ?? 0) - (b.orderNo ?? 0));

  const btnColor = (ans: Answer) => {
    if (ans.aiStatus === 'PENDING' || ans.aiStatus === 'RECHECK') return '#8b5cf6';
    if (ans.isCorrect === true) return '#10b981';
    if (ans.isCorrect === false) return '#ef4444';
    return '#64748b';
  };

  const activeAns = activeNo !== null ? answers.find(a => (a.orderNo ?? 0) === activeNo) : null;

  // AI hali tekshirayotgan savollar
  const aiPendingAnswers = answers.filter(a => a.aiStatus === 'PENDING' || a.aiStatus === 'RECHECK');
  const aiChecking = aiPendingAnswers.length > 0;
  const aiDone = answers.filter(a => a.aiScore !== null && a.aiScore !== undefined).length;
  const aiTotal = aiDone + aiPendingAnswers.length;

  // ── AI tekshirilmaguncha umumiy natija ko'rsatilmaydi ──
  if (aiChecking) {
    return (
      <ThemeWrapper>
        <Navbar />
        <div style={{ position: 'relative', maxWidth: 560, margin: '0 auto', padding: '20px 16px', minHeight: 'calc(100vh - 80px)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {/* Orqa fon yorug'ligi (umumiy ekran animatsiyasi) */}
          <div className="ai-bg-glow" />

          <div style={{ position: 'relative', zIndex: 1, width: '100%', backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 24, padding: '40px 28px', textAlign: 'center' }}
            className="animate-fade-in">

            {/* Inson + AI sxema animatsiyasi */}
            <div style={{ position: 'relative', width: 200, height: 200, margin: '0 auto 24px' }}>
              {/* Yonib aylanuvchi halqa */}
              <div className="ai-ring" />
              {/* Pulslanuvchi yorug'lik */}
              <div className="ai-glow" />

              {/* Inson boshi + ishlab turgan sxemalar */}
              <div className="ai-head-wrap" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="160" height="160" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="aiGrad" x1="30" y1="30" x2="170" y2="170" gradientUnits="userSpaceOnUse">
                      <stop stopColor={theme.accent} stopOpacity="0.65" />
                      <stop offset="1" stopColor={theme.accent} />
                    </linearGradient>
                    <radialGradient id="aiChipFill" cx="0.5" cy="0.5" r="0.5">
                      <stop stopColor={theme.accent} stopOpacity="0.28" />
                      <stop offset="1" stopColor={theme.accent} stopOpacity="0" />
                    </radialGradient>
                  </defs>

                  {/* Inson boshi profili (o'ngga qaragan, silliqroq) */}
                  <path
                    d="M70 168 L70 140 C70 132 66 128 61 122 C50 109 44 94 44 78 C44 49 67 28 99 28 C129 28 152 50 152 78 C152 96 144 110 130 119 C122 124 117 129 116 139 L115 150 C114.5 156 110 160 104 160 L94 160 C90 160 88 162 88 166 L88 168 Z"
                    stroke="url(#aiGrad)" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" fill="none" />
                  {/* Burun/lab nozik chizig'i */}
                  <path d="M44 84 L36 92 C34 94 35 98 39 98 L46 98" stroke="url(#aiGrad)" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.7" />

                  {/* Tarqaluvchi to'lqinlar (aniq harakat) */}
                  {[0, 1, 2].map(i => (
                    <circle key={`r${i}`} cx="98" cy="86" r="22" fill="none"
                      stroke={theme.accent} strokeWidth="1.6" opacity="0">
                      <animate attributeName="r" values="20;46" dur="2.4s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0.55;0" dur="2.4s" begin={`${i * 0.8}s`} repeatCount="indefinite" />
                    </circle>
                  ))}

                  {/* AI chip (markaziy protsessor) */}
                  <rect x="78" y="66" width="40" height="40" rx="7" fill="url(#aiChipFill)" stroke="url(#aiGrad)" strokeWidth="2.6" />
                  <rect x="86" y="74" width="24" height="24" rx="4" stroke={theme.accent} strokeWidth="1.4" fill="none" opacity="0.6" />
                  <text x="98" y="91" textAnchor="middle" fontSize="13" fontWeight="800" fill={theme.accent} fontFamily="system-ui, sans-serif">AI</text>

                  {/* Sxema yo'llari + uchqunlanuvchi tugunlar */}
                  {[
                    [88, 66, 88, 52, 88, 48], [98, 66, 98, 46, 98, 42], [108, 66, 108, 52, 108, 48],
                    [78, 76, 62, 76, 58, 76], [78, 86, 56, 86, 52, 86], [78, 96, 64, 96, 60, 96],
                    [118, 76, 132, 76, 136, 76], [118, 86, 136, 86, 140, 86], [118, 96, 130, 96, 134, 96],
                    [90, 106, 90, 118, 90, 122], [106, 106, 106, 116, 106, 120],
                  ].map((n, i) => (
                    <g key={i}>
                      <line x1={n[0]} y1={n[1]} x2={n[2]} y2={n[3]}
                        stroke={theme.accent} strokeWidth="1.6" strokeDasharray="3 2" opacity="0.85"
                        className="ai-trace" style={{ animationDelay: `${i * 0.12}s` }} />
                      <circle cx={n[4]} cy={n[5]} r="3" fill={theme.accent}
                        className="ai-node" style={{ animationDelay: `${i * 0.12}s` }} />
                    </g>
                  ))}
                </svg>
              </div>
            </div>

            <h2 style={{ color: theme.text, fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>
              AI javoblarni tekshirmoqda
            </h2>
            <p style={{ color: theme.text, opacity: 0.55, fontSize: 14, margin: '0 0 24px', lineHeight: 1.5 }}>
              Sun'iy intellekt yozma javoblaringizni baholayapti.<br />
              Bu bir necha soniya davom etadi — sahifa avtomatik yangilanadi.
            </p>

            {/* Progress */}
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: theme.text, opacity: 0.6 }}>
              <span>Tekshirildi</span>
              <span>{aiDone} / {aiTotal}</span>
            </div>
            <div style={{ height: 10, borderRadius: 6, backgroundColor: theme.input, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${aiTotal > 0 ? (aiDone / aiTotal) * 100 : 5}%`,
                background: `linear-gradient(90deg, ${theme.accent}88, ${theme.accent})`,
                borderRadius: 6, transition: 'width 0.5s ease',
              }} />
            </div>

            <div style={{ marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8, color: theme.accent, fontSize: 13, fontWeight: 600 }}>
              <span className="animate-pulse-soft" style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: theme.accent }} />
              Iltimos kuting...
            </div>
          </div>
        </div>
      </ThemeWrapper>
    );
  }

  return (
    <ThemeWrapper>
      <Navbar />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', paddingBottom: 100 }}>

        {/* ── Umumiy ball ── */}
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 24, textAlign: 'center', marginBottom: 16 }}
          className="animate-fade-in">
          <p style={{ color: theme.text, opacity: 0.5, fontSize: 14, marginBottom: 4 }}>{result.test.title}</p>
          <div style={{ fontSize: 56, fontWeight: 800, color: score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444' }}>
            {score.toFixed(1)}%
          </div>
          <p style={{ color: theme.text, opacity: 0.6, marginTop: 4 }}>{correct} / {total} to'g'ri</p>
          <button onClick={() => router.push('/tests')}
            style={{ marginTop: 16, padding: '10px 24px', borderRadius: 10, border: `1px solid ${theme.border}`,
              backgroundColor: theme.input, color: theme.text, cursor: 'pointer', fontWeight: 600 }}>
            ← Testlarga qaytish
          </button>
        </div>

        {/* ── Savol tugmalari gridi ── */}
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 20, marginBottom: 16 }}>
          <p style={{ color: theme.text, fontWeight: 600, marginBottom: 12 }}>
            Natijalar <span style={{ opacity: 0.45, fontWeight: 400, fontSize: 13 }}>— savol ustiga bosing</span>
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {answers.map((ans, i) => {
              const no = ans.orderNo ?? i + 1;
              const isActive = activeNo === no;
              return (
                <button
                  key={`ans-${no}-${i}`}
                  onClick={() => openVideo(ans)}
                  title={ans.videoFileId ? `${no}-savol: video yechim bor` : `${no}-savol`}
                  style={{
                    width: 42, height: 42, borderRadius: 8, fontWeight: 700, fontSize: 13,
                    backgroundColor: btnColor(ans),
                    color: '#fff',
                    border: isActive ? `3px solid ${theme.accent}` : `2px solid transparent`,
                    cursor: 'pointer',
                    position: 'relative',
                    transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    transition: 'transform 0.15s',
                    outline: 'none',
                  }}>
                  {no}
                  {ans.videoFileId && (
                    <span style={{
                      position: 'absolute', top: -5, right: -5, fontSize: 9,
                      backgroundColor: theme.accent, borderRadius: '50%',
                      width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1.5px solid ${theme.card}`, color: '#fff',
                    }}>▶</span>
                  )}
                </button>
              );
            })}
          </div>
          {/* Izoh */}
          <div style={{ display: 'flex', gap: 14, marginTop: 14, fontSize: 12, flexWrap: 'wrap' }}>
            {[
              { color: '#10b981', label: "To'g'ri" },
              { color: '#ef4444', label: "Noto'g'ri" },
              { color: '#8b5cf6', label: 'AI tekshirmoqda' },
              { color: '#64748b', label: "Javob yo'q" },
            ].map(({ color, label }) => (
              <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, color: theme.text, opacity: 0.6 }}>
                <span style={{ width: 12, height: 12, backgroundColor: color, borderRadius: 3, display: 'inline-block', flexShrink: 0 }} />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ── Video panel ── */}
        {activeNo !== null && (
          <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.accent}`, borderRadius: 18, padding: 16, marginBottom: 16 }}
            className="animate-fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <p style={{ color: theme.accent, fontWeight: 700, margin: 0, fontSize: 15 }}>
                ▶ {activeNo}-savol — video yechim
              </p>
              <button
                onClick={() => { if (videoBlobUrl) URL.revokeObjectURL(videoBlobUrl); setActiveNo(null); setVideoBlobUrl(null); }}
                style={{ background: 'none', border: 'none', color: theme.text, opacity: 0.5, cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>
                ✕
              </button>
            </div>
            {videoLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 140, gap: 12, color: theme.text, opacity: 0.5 }}>
                <span style={{ fontSize: 28 }}>⏳</span>
                <span style={{ fontSize: 14 }}>Video yuklanmoqda...</span>
              </div>
            ) : videoBlobUrl ? (
              <video controls autoPlay style={{ width: '100%', borderRadius: 12, maxHeight: 420, backgroundColor: '#000' }}
                src={videoBlobUrl} />
            ) : null}
          </div>
        )}


      </div>
    </ThemeWrapper>
  );
}
