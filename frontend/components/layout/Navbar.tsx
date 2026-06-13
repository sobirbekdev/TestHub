'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useThemeStore, THEMES } from '@/store/theme';
import { useAuthStore } from '@/store/auth';

const NAV = [
  { href: '/home', icon: '🏠', label: 'Bosh sahifa' },
  { href: '/tests', icon: '📋', label: 'Testlar' },
  { href: '/group', icon: '👥', label: 'Guruh' },
  { href: '/rating', icon: '🏆', label: 'Reyting' },
  { href: '/stats', icon: '📊', label: 'Statistika' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useThemeStore();
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const handleLogout = () => { logout(); router.push('/login'); };

  const isActive = (href: string) => pathname === href || (href !== '/home' && pathname.startsWith(href));

  return (
    <>
      {/* ── DESKTOP ── */}
      <header style={{
        backgroundColor: theme.card,
        borderBottom: `1px solid ${theme.border}`,
        position: 'sticky', top: 0, zIndex: 50,
        backdropFilter: 'blur(12px)',
      }} className="hidden md:block">
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', height: 60, gap: 8 }}>

          {/* Logo */}
          <Link href="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 24 }}>
            <span style={{ fontSize: 24 }}>🧪</span>
            <span style={{ color: theme.accent, fontWeight: 800, fontSize: 20, letterSpacing: -0.5 }}>TestHub</span>
          </Link>

          {/* Nav links */}
          <nav style={{ display: 'flex', gap: 4, flex: 1 }}>
            {NAV.map(({ href, icon, label }) => {
              const active = isActive(href);
              return (
                <Link key={href} href={href} style={{
                  textDecoration: 'none',
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '7px 14px', borderRadius: 10,
                  fontSize: 14, fontWeight: active ? 600 : 500,
                  color: active ? theme.accent : theme.text,
                  backgroundColor: active ? `${theme.accent}18` : 'transparent',
                  transition: 'all 0.15s',
                  opacity: active ? 1 : 0.75,
                }}>
                  <span style={{ fontSize: 15 }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Tema */}
            <div style={{ display: 'flex', gap: 2, backgroundColor: theme.input, borderRadius: 10, padding: '4px 6px', marginRight: 4 }}>
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => setTheme(t.id)} title={t.label}
                  style={{
                    fontSize: 16, border: 'none', cursor: 'pointer', background: 'none',
                    opacity: theme.id === t.id ? 1 : 0.35,
                    transform: theme.id === t.id ? 'scale(1.15)' : 'scale(1)',
                    transition: 'all 0.15s',
                  }}>
                  {t.icon}
                </button>
              ))}
            </div>

            {/* Admin tugmasi */}
            {user?.role !== 'STUDENT' && (
              <Link href="/admin" style={{
                textDecoration: 'none', padding: '6px 14px', borderRadius: 9,
                fontSize: 13, fontWeight: 600, color: theme.accent,
                border: `1.5px solid ${theme.accent}40`,
                backgroundColor: `${theme.accent}10`,
              }}>
                ⚙️ Admin
              </Link>
            )}

            {/* Profil */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '5px 12px', borderRadius: 10,
              backgroundColor: theme.input, border: `1px solid ${theme.border}`,
              marginLeft: 4,
            }}>
              <Link href="/profile" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent}88)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {(user?.name || user?.phone || 'U')[0].toUpperCase()}
                </div>
                <span style={{ color: theme.text, fontSize: 13, fontWeight: 500 }}>
                  {user?.name || user?.phone?.slice(-4)}
                </span>
              </Link>
              <button onClick={handleLogout} title="Chiqish"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.text, opacity: 0.4, fontSize: 14, padding: '2px 4px', marginLeft: 2 }}>
                ✕
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MOBILE BOTTOM NAV ── */}
      <nav style={{
        backgroundColor: theme.card,
        borderTop: `1px solid ${theme.border}`,
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        display: 'flex', justifyContent: 'space-around',
        padding: '8px 0 12px',
        backdropFilter: 'blur(12px)',
      }} className="md:hidden">
        {NAV.map(({ href, icon, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} style={{
              textDecoration: 'none', display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 3, padding: '4px 12px', borderRadius: 10,
              color: active ? theme.accent : theme.text,
              opacity: active ? 1 : 0.5,
              transition: 'all 0.15s',
            }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
            </Link>
          );
        })}
        {/* Mobile: Profil */}
        <Link href="/profile" style={{
          textDecoration: 'none',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          color: isActive('/profile') ? theme.accent : theme.text,
          opacity: isActive('/profile') ? 1 : 0.5, padding: '4px 12px',
        }}>
          <span style={{ fontSize: 20 }}>👤</span>
          <span style={{ fontSize: 10 }}>Profil</span>
        </Link>
      </nav>
    </>
  );
}
