'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useThemeStore, THEMES } from '@/store/theme';
import api from '@/lib/api';
import toast from 'react-hot-toast';

type Step = 'phone' | 'code' | 'register';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const { theme, setTheme } = useThemeStore();

  const [phone, setPhone] = useState('+998');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [step, setStep] = useState<Step>('phone');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [devCode, setDevCode] = useState(''); // Dev rejim uchun

  // 1-qadam: SMS yuborish
  const sendOtp = async () => {
    const cleaned = phone.replace(/\s/g, '');
    if (cleaned.length < 12) return toast.error("Telefon raqamni to'liq kiriting");
    setLoading(true);
    try {
      const res = await api.post('/auth/send-otp', { phone: cleaned });
      // Dev rejim: backend kodni response'da qaytaradi
      if (res.data?.code) setDevCode(res.data.code);
      setStep('code');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Xatolik: backend ishlamoqdami? http://localhost:4000");
    } finally {
      setLoading(false);
    }
  };

  // 2-qadam: Kodni tekshirish
  const verifyOtp = async () => {
    if (code.length !== 6) return toast.error('6 xonali kod kiriting');
    setLoading(true);
    try {
      const cleaned = phone.replace(/\s/g, '');
      const { data } = await api.post('/auth/verify-otp', { phone: cleaned, code });

      // Agar yangi foydalanuvchi bo'lsa (ismi yo'q) — ro'yxatdan o'tish
      if (!data.user.name) {
        setIsNewUser(true);
        // Token vaqtincha saqlab qo'yamiz
        setAuth(data.user, data.access_token);
        setStep('register');
      } else {
        setAuth(data.user, data.access_token);
        toast.success(`Xush kelibsiz, ${data.user.name}!`);
        router.push('/home');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Kod noto'g'ri");
    } finally {
      setLoading(false);
    }
  };

  // 3-qadam: Ism saqlash
  const saveName = async () => {
    if (name.trim().length < 2) return toast.error("Ism familiyangizni kiriting");
    setLoading(true);
    try {
      const { data } = await api.patch('/users/me/name', { name: name.trim() });
      const tok = useAuthStore.getState().token;
      const cur = useAuthStore.getState().user;
      if (tok && cur) setAuth({ ...cur, name: data.name }, tok);
      toast.success("Ro'yxatdan o'tdingiz!");
      router.push('/profile');
    } catch (e: any) {
      toast.error("Ismni saqlashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  const inp = {
    width: '100%',
    backgroundColor: theme.input,
    border: `1px solid ${theme.border}`,
    color: theme.text,
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 16,
    outline: 'none',
  } as React.CSSProperties;

  const btn = {
    width: '100%',
    padding: '13px',
    background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}cc)`,
    color: '#fff',
    borderRadius: 10,
    fontWeight: 600,
    fontSize: 15,
    border: 'none',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
  } as React.CSSProperties;

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      {/* Tema tugmalari */}
      <div style={{ position: 'fixed', top: 16, right: 16, display: 'flex', gap: 8 }}>
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => setTheme(t.id)}
            style={{ fontSize: 20, opacity: theme.id === t.id ? 1 : 0.4, background: 'none', border: 'none', cursor: 'pointer' }}>
            {t.icon}
          </button>
        ))}
      </div>

      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 52 }}>🧪</div>
          <h1 style={{ color: theme.accent, fontSize: 28, fontWeight: 700, margin: '8px 0 4px' }}>TestHub</h1>
          <p style={{ color: theme.text, opacity: 0.6 }}>Kimyo testlari platformasi</p>
        </div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {['phone', 'code', 'register'].map((s, i) => (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              backgroundColor: ['phone', 'code', 'register'].indexOf(step) >= i ? theme.accent : theme.border,
              transition: 'background-color 0.3s',
            }} />
          ))}
        </div>

        <div style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 18, padding: 28 }}>

          {/* ── 1-QADAM: TELEFON ── */}
          {step === 'phone' && (
            <>
              <h2 style={{ color: theme.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>📱 Kirish</h2>
              <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 20 }}>Telefon raqamingizni kiriting</p>

              <label style={{ color: theme.text, opacity: 0.7, fontSize: 13 }}>Telefon raqam</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                type="tel"
                style={{ ...inp, marginTop: 6, marginBottom: 16 }}
                onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                autoFocus
              />
              <button onClick={sendOtp} disabled={loading} style={btn}>
                {loading ? '⏳ Yuborilmoqda...' : 'SMS kod olish →'}
              </button>
            </>
          )}

          {/* ── 2-QADAM: KOD ── */}
          {step === 'code' && (
            <>
              <h2 style={{ color: theme.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>🔑 SMS Kod</h2>
              <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 20 }}>
                <b style={{ color: theme.accent }}>{phone}</b> ga 6 xonali kod yuborildi
              </p>

              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="0  0  0  0  0  0"
                maxLength={6}
                type="number"
                style={{ ...inp, letterSpacing: 10, fontSize: 24, textAlign: 'center', marginBottom: 16 }}
                onKeyDown={(e) => e.key === 'Enter' && verifyOtp()}
                autoFocus
              />
              <button onClick={verifyOtp} disabled={loading} style={btn}>
                {loading ? '⏳ Tekshirilmoqda...' : 'Tasdiqlash →'}
              </button>
              <button onClick={() => { setStep('phone'); setCode(''); }}
                style={{ width: '100%', marginTop: 10, padding: '10px', backgroundColor: 'transparent', color: theme.text, opacity: 0.5, border: `1px solid ${theme.border}`, borderRadius: 10, cursor: 'pointer', fontSize: 14 }}>
                ← Orqaga
              </button>
              {devCode && (
                <div style={{ marginTop: 12, padding: '10px 14px', backgroundColor: '#10b98120', border: '1px solid #10b981', borderRadius: 10, textAlign: 'center' }}>
                  <p style={{ color: '#10b981', fontSize: 12, marginBottom: 4 }}>🔧 Test rejim — SMS kodi:</p>
                  <p style={{ color: '#10b981', fontSize: 28, fontWeight: 700, letterSpacing: 8 }}>{devCode}</p>
                  <button onClick={() => setCode(devCode)} style={{ marginTop: 6, padding: '4px 12px', backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                    Avtomatik to'ldirish
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── 3-QADAM: ISM KIRITISH ── */}
          {step === 'register' && (
            <>
              <h2 style={{ color: theme.text, fontSize: 18, fontWeight: 700, marginBottom: 6 }}>👤 Ro'yxatdan o'tish</h2>
              <p style={{ color: theme.text, opacity: 0.5, fontSize: 13, marginBottom: 20 }}>
                Ism va familiyangizni kiriting
              </p>

              <label style={{ color: theme.text, opacity: 0.7, fontSize: 13 }}>Ism Familiya</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Masalan: Ali Valiyev"
                style={{ ...inp, marginTop: 6, marginBottom: 16 }}
                onKeyDown={(e) => e.key === 'Enter' && saveName()}
                autoFocus
              />
              <button onClick={saveName} disabled={loading} style={btn}>
                {loading ? '⏳ Saqlanmoqda...' : '✓ Boshlash'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
