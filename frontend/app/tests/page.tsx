'use client';
import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/theme';
import { useAuthStore } from '@/store/auth';
import { Test, TestType } from '@/types';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const TABS: { id: TestType | 'ALL'; label: string; emoji: string }[] = [
  { id: 'ALL', label: 'Hammasi', emoji: '📋' },
  { id: 'NATIONAL_CERT', label: 'Milliy Sert.', emoji: '🏆' },
  { id: 'DTM_VARIANT', label: 'DTM', emoji: '📘' },
  { id: 'ATTESTATION', label: 'Atestatsiya', emoji: '📝' },
  { id: 'TOPIC', label: 'Mavzular', emoji: '📚' },
];

// Grouped types — author → collection → variants
const GROUPED_TYPES: (TestType | string)[] = ['NATIONAL_CERT', 'DTM_VARIANT', 'ATTESTATION'];

export default function TestsPage() {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAdmin = user?.role && user.role !== 'STUDENT';
  const initialType = searchParams.get('type') as TestType | null;
  const [active, setActive] = useState<TestType | 'ALL'>(initialType || 'ALL');
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  // Selected variant for details panel
  const [selected, setSelected] = useState<Test | null>(null);

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    const query = active !== 'ALL' ? `?type=${active}` : '';
    api.get(`/tests${query}`)
      .then(r => { setTests(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [active]);

  const startTest = async (test: Test) => {
    if (!test.isPaid && !isAdmin) {
      router.push(`/payment?testId=${test.id}`);
      return;
    }
    try {
      const { data } = await api.post('/attempts/start', { testId: test.id });
      router.push(`/test/${data.id}?testId=${test.id}`);
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Xatolik');
    }
  };

  // Selected collection key for expanded variants
  const [openColl, setOpenColl] = useState<string | null>(null);

  // Split tests into grouped (has collectionName) and flat
  const groupedTests = tests.filter(t => GROUPED_TYPES.includes(t.type));
  // TOPIC (Mavzular) testlari "Hammasi"da alohida chiqmaydi — faqat "Mavzular" bo'limida
  const flatTests = tests.filter(t =>
    !GROUPED_TYPES.includes(t.type) && (t.type !== 'TOPIC' || active === 'TOPIC'),
  );

  // Build flat list of collections: { key, author, collName, variants[] }
  const collMap: Record<string, { author: string; collName: string; variants: Test[] }> = {};
  for (const t of groupedTests) {
    const author = t.authorName || 'Noma\'lum muallif';
    const coll = t.collectionName || t.title;
    const key = `${author}__${coll}`;
    if (!collMap[key]) collMap[key] = { author, collName: coll, variants: [] };
    collMap[key].variants.push(t);
  }
  const collections = Object.entries(collMap).map(([key, v]) => ({ key, ...v }));

  const card: React.CSSProperties = {
    backgroundColor: theme.card,
    border: `1px solid ${theme.border}`,
    borderRadius: 14,
  };

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Testlar</h1>

      {/* Tablar */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActive(tab.id)}
            style={{
              padding: '7px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap',
              border: `1px solid ${active === tab.id ? theme.accent : theme.border}`,
              backgroundColor: active === tab.id ? `${theme.accent}20` : theme.card,
              color: active === tab.id ? theme.accent : theme.text,
              cursor: 'pointer', flexShrink: 0,
            }}>
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: theme.text, opacity: 0.4, padding: 60 }}>Yuklanmoqda...</div>
      ) : tests.length === 0 ? (
        <div style={{ textAlign: 'center', color: theme.text, opacity: 0.4, padding: 60 }}>Testlar topilmadi</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Guruhlangan testlar (Milliy, DTM, Atestatsiya) ── */}
          {collections.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {collections.map(({ key, author, collName, variants }) => {
                const sorted = [...variants].sort((a, b) => (a.variantNo || 0) - (b.variantNo || 0));
                const coverImage = variants[0]?.coverImage;
                const isOpen = openColl === key;
                return (
                  <div key={key} style={{ ...card, overflow: 'hidden' }}>
                    {/* Kolleksiya kartasi — rasm + muallif */}
                    <button
                      onClick={() => { setOpenColl(isOpen ? null : key); setSelected(null); }}
                      style={{ width: '100%', display: 'flex', alignItems: 'stretch', gap: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}>
                      {/* Katta muqova rasmi */}
                      <div style={{ width: 90, flexShrink: 0, position: 'relative', overflow: 'hidden', borderRadius: '14px 0 0 14px' }}>
                        {coverImage ? (
                          <img src={coverImage} alt={collName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', minHeight: 110 }} />
                        ) : (
                          <div style={{ width: '100%', minHeight: 110, backgroundColor: `${theme.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: 32 }}>📖</span>
                          </div>
                        )}
                        {/* Muallif overlay */}
                        <div style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                          padding: '18px 6px 6px',
                          display: 'flex', alignItems: 'flex-end',
                        }}>
                          <span style={{ color: '#fff', fontSize: 10, fontWeight: 700, lineHeight: 1.2, wordBreak: 'break-word' }}>
                            ✍️ {author}
                          </span>
                        </div>
                      </div>
                      {/* O'ng qism — nom + info */}
                      <div style={{ flex: 1, padding: '14px 16px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <div style={{ color: theme.text, fontWeight: 700, fontSize: 16, marginBottom: 6 }}>{collName}</div>
                        <div style={{ color: theme.text, opacity: 0.45, fontSize: 13, marginBottom: 8 }}>
                          {variants.length} ta variant
                        </div>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          color: isOpen ? theme.accent : theme.text,
                          opacity: isOpen ? 1 : 0.4,
                          fontSize: 12, fontWeight: 600,
                        }}>
                          {isOpen ? '▲ Yopish' : '▼ Variantlarni ko\'rish'}
                        </div>
                      </div>
                    </button>

                    {/* Variantlar ro'yxati */}
                    {isOpen && (
                      <div style={{ borderTop: `1px solid ${theme.border}`, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: selected && variants.some(t => t.id === selected.id) ? 14 : 0 }}>
                          {sorted.map(t => {
                            const isPaid = t.isPaid || isAdmin;
                            const isSel = selected?.id === t.id;
                            return (
                              <button
                                key={t.id}
                                onClick={() => setSelected(isSel ? null : t)}
                                style={{
                                  padding: '8px 16px', borderRadius: 10,
                                  fontWeight: 600, fontSize: 13, cursor: 'pointer',
                                  border: `2px solid ${isSel ? theme.accent : isPaid ? '#10b98150' : theme.border}`,
                                  backgroundColor: isSel ? `${theme.accent}20` : isPaid ? '#10b98108' : 'transparent',
                                  color: isSel ? theme.accent : theme.text,
                                  position: 'relative',
                                }}>
                                {t.variantNo}-variant
                                {t.price > 0 && !isPaid && (
                                  <span style={{
                                    position: 'absolute', top: -5, right: -5,
                                    backgroundColor: '#f59e0b', borderRadius: '50%',
                                    width: 14, height: 14, fontSize: 8, fontWeight: 700,
                                    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    border: `1px solid ${theme.card}`,
                                  }}>₴</span>
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {/* Tanlangan variant detail */}
                        {selected && variants.some(t => t.id === selected.id) && (
                          <div style={{
                            padding: '14px 16px',
                            backgroundColor: `${theme.accent}08`,
                            border: `1px solid ${theme.accent}30`,
                            borderRadius: 12,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                            flexWrap: 'wrap',
                          }}>
                            <div>
                              <div style={{ color: theme.text, fontWeight: 700, fontSize: 15, marginBottom: 4 }}>
                                {selected.title}
                              </div>
                              <div style={{ color: theme.text, opacity: 0.5, fontSize: 13, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                <span>⏱ {selected.duration} daqiqa</span>
                                <span>❓ {selected.totalQ} savol</span>
                                {selected.price > 0 && (selected.isPaid || isAdmin)
                                  ? <span style={{ color: '#10b981' }}>✅ {isAdmin ? 'Admin' : "To'langan"}</span>
                                  : selected.price > 0
                                    ? <span style={{ color: '#f59e0b' }}>💳 {(selected.price / 1000).toFixed(0)}K so'm</span>
                                    : <span style={{ color: '#10b981' }}>Bepul</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => startTest(selected)}
                              style={{
                                padding: '10px 22px', borderRadius: 10, fontWeight: 700, fontSize: 14,
                                background: (selected.isPaid || isAdmin)
                                  ? 'linear-gradient(135deg, #10b981, #059669)'
                                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                                color: '#fff', border: 'none', cursor: 'pointer', flexShrink: 0,
                              }}>
                              {(selected.isPaid || isAdmin) ? '▶ Boshlash' : '💳 Sotib olish'}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Flat testlar (Mavzular va boshqalar) ── */}
          {flatTests.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {flatTests.map(test => (
                <div key={test.id} style={{ ...card, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                        {test.year && <span style={{ fontSize: 11, color: theme.text, opacity: 0.5 }}>{test.year}</span>}
                        {test.price === 0 && <span style={{ fontSize: 11, backgroundColor: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: 6 }}>Bepul</span>}
                        {test.price > 0 && !test.isPaid && <span style={{ fontSize: 11, backgroundColor: '#f59e0b20', color: '#f59e0b', padding: '2px 8px', borderRadius: 6 }}>💳 {(test.price / 1000).toFixed(0)}K</span>}
                        {test.price > 0 && test.isPaid && !isAdmin && <span style={{ fontSize: 11, backgroundColor: '#10b98120', color: '#10b981', padding: '2px 8px', borderRadius: 6 }}>✅ To'langan</span>}
                        {test.price > 0 && isAdmin && <span style={{ fontSize: 11, backgroundColor: '#8b5cf620', color: '#8b5cf6', padding: '2px 8px', borderRadius: 6 }}>🔑 Admin</span>}
                      </div>
                      <p style={{ color: theme.text, fontWeight: 600, fontSize: 15 }}>{test.title}</p>
                      {test.authorName && <p style={{ color: theme.text, opacity: 0.5, fontSize: 13 }}>✍️ {test.authorName}</p>}
                      <p style={{ color: theme.text, opacity: 0.4, fontSize: 12, marginTop: 4 }}>
                        ⏱ {test.duration} daqiqa · ❓ {test.totalQ} savol
                      </p>
                    </div>
                    <button onClick={() => startTest(test)}
                      style={{
                        marginLeft: 12, padding: '8px 16px', borderRadius: 10, fontWeight: 600, fontSize: 13,
                        background: (test.isPaid || isAdmin)
                          ? 'linear-gradient(135deg, #10b981, #059669)'
                          : 'linear-gradient(135deg, #f59e0b, #d97706)',
                        color: '#fff', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}>
                      {(test.isPaid || isAdmin) ? '▶ Boshlash' : '💳 Sotib olish'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
