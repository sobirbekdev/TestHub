'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import ThemeWrapper from '@/components/layout/ThemeWrapper';

const ADMIN_NAV = [
  { href: '/admin', label: '📊 Dashboard', exact: true },
  { href: '/admin/questions', label: '📚 Savol bazasi' },
  { href: '/admin/milliy', label: '🏆 Milliy Sertifikat' },
  { href: '/admin/attestation', label: '📝 Atestatsiya' },
  { href: '/admin/dtm', label: '🎯 DTM' },
  { href: '/admin/ai', label: '🤖 AI tekshiruv' },
  { href: '/admin/groups', label: '👥 Guruhlar' },
  { href: '/admin/users', label: '👤 Foydalanuvchilar' },
  { href: '/admin/payments', label: '💳 To\'lovlar' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, fetchMe } = useAuthStore();
  const { theme } = useThemeStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!token) { router.replace('/login'); return; }
    if (!user) fetchMe();
  }, [token]);

  useEffect(() => {
    if (user && user.role === 'STUDENT') router.replace('/home');
  }, [user]);

  if (!token || !user || user.role === 'STUDENT') return null;

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <ThemeWrapper>
      <div style={{ display: 'flex', minHeight: '100vh' }}>
        {/* Sidebar */}
        <aside style={{
          width: 220, flexShrink: 0, backgroundColor: theme.card,
          borderRight: `1px solid ${theme.border}`, padding: '20px 12px',
          display: 'flex', flexDirection: 'column', gap: 4,
          position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
        }}
          className="hidden md:flex">
          <Link href="/admin" style={{ color: theme.accent, fontWeight: 700, fontSize: 18, marginBottom: 16, display: 'block', padding: '0 8px' }}>
            🧪 TestHub Admin
          </Link>
          {ADMIN_NAV.map(({ href, label, exact }) => (
            <Link key={href} href={href}
              style={{
                padding: '9px 12px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                backgroundColor: isActive(href, exact) ? `${theme.accent}20` : 'transparent',
                color: isActive(href, exact) ? theme.accent : theme.text,
                textDecoration: 'none', transition: 'all 0.15s',
              }}>
              {label}
            </Link>
          ))}
          <Link href="/home" style={{ marginTop: 'auto', padding: '9px 12px', fontSize: 13, color: theme.text, opacity: 0.5, textDecoration: 'none' }}>
            ← Saytga qaytish
          </Link>
        </aside>

        {/* Content */}
        <main style={{ flex: 1, padding: '24px', overflowX: 'hidden' }}>
          {/* Mobile header */}
          <div className="md:hidden" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ padding: '8px 12px', backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, cursor: 'pointer' }}>
              ☰
            </button>
            <span style={{ color: theme.accent, fontWeight: 700 }}>Admin Panel</span>
          </div>
          {children}
        </main>
      </div>
    </ThemeWrapper>
  );
}
