'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useThemeStore } from '@/store/theme';
import api from '@/lib/api';
import toast from 'react-hot-toast';

function PaymentContent() {
  const { theme } = useThemeStore();
  const searchParams = useSearchParams();
  const router = useRouter();
  const testId = searchParams.get('testId');
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<'click' | 'payme' | null>(null);

  useEffect(() => {
    if (!testId) return;
    // /tests/:id/info endpoint token bilan ishlaydi
    api.get(`/tests/${testId}/info`).then(r => { setTest(r.data); setLoading(false); }).catch(() => {
      // fallback: basic info
      api.get(`/tests`).then(r => {
        const t = r.data.find((x: any) => x.id === Number(testId));
        if (t) { setTest(t); setLoading(false); } else { toast.error('Test topilmadi'); router.back(); }
      }).catch(() => { toast.error('Test topilmadi'); router.back(); });
    });
  }, [testId]);

  const pay = async (provider: 'CLICK' | 'PAYME') => {
    if (!testId || !test) return;
    setPaying(true);
    try {
      const r = await api.post('/payments/create', { testId: Number(testId), provider });
      // Dev mode: to'lov avtomatik tasdiqlangan bo'lsa
      if (r.data.status === 'PAID') {
        toast.success('✅ To\'lov qabul qilindi!');
        const attempt = await api.post('/attempts/start', { testId: Number(testId) });
        router.push(`/test/${attempt.data.id}?testId=${testId}`);
      } else if (r.data.payUrl) {
        window.location.href = r.data.payUrl;
      } else {
        toast.success('✅ To\'lov qabul qilindi!');
        const attempt = await api.post('/attempts/start', { testId: Number(testId) });
        router.push(`/test/${attempt.data.id}?testId=${testId}`);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'To\'lovda xatolik');
    }
    setPaying(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', backgroundColor: theme.bg }}>
      <div style={{ color: theme.text }}>Yuklanmoqda...</div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440 }}>
        {/* Test ma'lumoti */}
        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 20, padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
              📋
            </div>
            <div>
              <p style={{ color: theme.text, fontWeight: 700, fontSize: 16 }}>{test?.title}</p>
              <p style={{ color: theme.text, opacity: 0.5, fontSize: 13 }}>⏱ {test?.duration} daqiqa · ❓ {test?.totalQ} savol</p>
            </div>
          </div>
          <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: theme.text, opacity: 0.6, fontSize: 14 }}>To'lov summasi:</span>
            <span style={{ color: theme.accent, fontWeight: 800, fontSize: 22 }}>
              {test?.price?.toLocaleString()} so'm
            </span>
          </div>
        </div>

        {/* To'lov usulini tanlash */}
        <p style={{ color: theme.text, opacity: 0.6, fontSize: 13, textAlign: 'center', marginBottom: 12 }}>To'lov usulini tanlang</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Click */}
          <button onClick={() => { setMethod('click'); pay('CLICK'); }} disabled={paying}
            style={{
              padding: '16px 24px', borderRadius: 16, border: `2px solid ${method === 'click' ? '#00AEFF' : theme.border}`,
              background: method === 'click' ? '#00AEFF15' : theme.card,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.2s',
              opacity: paying ? 0.7 : 1,
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#00AEFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>C</span>
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{ color: theme.text, fontWeight: 700, fontSize: 15 }}>Click</p>
              <p style={{ color: theme.text, opacity: 0.5, fontSize: 12 }}>Click.uz orqali to'lash</p>
            </div>
            {method === 'click' && paying && <span style={{ color: '#00AEFF', fontSize: 20 }}>⏳</span>}
          </button>

          {/* Payme */}
          <button onClick={() => { setMethod('payme'); pay('PAYME'); }} disabled={paying}
            style={{
              padding: '16px 24px', borderRadius: 16, border: `2px solid ${method === 'payme' ? '#1AC060' : theme.border}`,
              background: method === 'payme' ? '#1AC06015' : theme.card,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, transition: 'all 0.2s',
              opacity: paying ? 0.7 : 1,
            }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#1AC060', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>P</span>
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{ color: theme.text, fontWeight: 700, fontSize: 15 }}>Payme</p>
              <p style={{ color: theme.text, opacity: 0.5, fontSize: 12 }}>Payme.uz orqali to'lash</p>
            </div>
            {method === 'payme' && paying && <span style={{ color: '#1AC060', fontSize: 20 }}>⏳</span>}
          </button>
        </div>

        <button onClick={() => router.back()}
          style={{ width: '100%', marginTop: 16, padding: '12px', borderRadius: 12, border: `1px solid ${theme.border}`, backgroundColor: 'transparent', color: theme.text, cursor: 'pointer', fontSize: 14 }}>
          ← Orqaga
        </button>

        {/* Dev mode eslatma */}
        {process.env.NODE_ENV !== 'production' && (
          <p style={{ color: theme.text, opacity: 0.3, fontSize: 11, textAlign: 'center', marginTop: 12 }}>
            🔧 Dev mode: to'lov avtomatik tasdiqlanadi
          </p>
        )}
      </div>
    </div>
  );
}

export default function PaymentPage() {
  return <Suspense><PaymentContent /></Suspense>;
}
