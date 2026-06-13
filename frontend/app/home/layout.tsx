'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import ThemeWrapper from '@/components/layout/ThemeWrapper';
import Navbar from '@/components/layout/Navbar';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, token, fetchMe } = useAuthStore();

  useEffect(() => {
    if (!token) {
      router.replace('/login');
      return;
    }
    if (!user) fetchMe();
  }, [token]);

  if (!token) return null;

  return (
    <ThemeWrapper>
      <Navbar />
      <main style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', paddingBottom: 80 }}>
        {children}
      </main>
    </ThemeWrapper>
  );
}
