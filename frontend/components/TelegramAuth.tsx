'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';

// Telegram WebApp tip (qisman)
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        close: () => void;
        colorScheme?: string;
      };
    };
  }
}

/**
 * Telegram Mini App ichida ochilganda avtomatik login qiladi.
 * Oddiy brauzerda hech narsa qilmaydi.
 */
export default function TelegramAuth() {
  const router = useRouter();
  const { setAuth, token } = useAuthStore();
  const [needsPhone, setNeedsPhone] = useState(false);

  useEffect(() => {
    const wa = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;
    // Telegram ichida emasmiz — hech narsa qilmaymiz
    if (!wa || !wa.initData) return;

    try {
      wa.ready();
      wa.expand();
    } catch {
      /* ignore */
    }

    // Allaqachon tizimga kirgan bo'lsa — qayta login shart emas
    if (token || localStorage.getItem('token')) return;

    (async () => {
      try {
        const { data } = await api.post('/auth/telegram', { initData: wa.initData });
        if (data.access_token) {
          setAuth(data.user, data.access_token);
          router.replace('/home');
        } else if (data.needsPhone) {
          setNeedsPhone(true);
        }
      } catch {
        /* tarmoq xatosi — foydalanuvchi qo'lda login qilishi mumkin */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!needsPhone) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0f172a',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 48 }}>📱</div>
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Telefon raqamingizni ulang</h2>
      <p style={{ opacity: 0.7, maxWidth: 320, lineHeight: 1.5 }}>
        Davom etish uchun botga qayting va{' '}
        <b>«📱 Telefon raqamni ulashish»</b> tugmasini bosing. Shundan so'ng bu
        ilovani qayta oching.
      </p>
      <button
        onClick={() => window.Telegram?.WebApp?.close()}
        style={{
          marginTop: 8,
          padding: '12px 28px',
          borderRadius: 12,
          border: 'none',
          background: '#3b82f6',
          color: '#fff',
          fontWeight: 600,
          fontSize: 15,
          cursor: 'pointer',
        }}
      >
        Botga qaytish
      </button>
    </div>
  );
}
