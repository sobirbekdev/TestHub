'use client';
import { useEffect, useState } from 'react';
import { useThemeStore } from '@/store/theme';
import api from '@/lib/api';

const STATUS_COLORS: Record<string, string> = { PAID: '#10b981', PENDING: '#f59e0b', FAILED: '#ef4444', REFUNDED: '#8b5cf6' };

export default function AdminPaymentsPage() {
  const { theme } = useThemeStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/payments/all').then((r) => { setPayments(r.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const total = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="animate-fade-in">
      <h1 style={{ color: theme.text, fontSize: 20, fontWeight: 700, marginBottom: 8 }}>💳 To'lovlar</h1>
      <p style={{ color: theme.accent, fontSize: 22, fontWeight: 700, marginBottom: 20 }}>
        Jami: {total.toLocaleString()} so'm
      </p>
      {loading ? (
        <div style={{ color: theme.text, opacity: 0.4, textAlign: 'center', padding: 40 }}>Yuklanmoqda...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map((p) => (
            <div key={p.id} style={{ backgroundColor: theme.card, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: theme.text, fontWeight: 500 }}>{p.user?.phone}</p>
                <p style={{ color: theme.text, opacity: 0.4, fontSize: 12 }}>
                  {p.provider} · {new Date(p.createdAt).toLocaleDateString('uz')}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: theme.text, fontWeight: 700 }}>{p.amount.toLocaleString()} so'm</p>
                <span style={{ fontSize: 11, fontWeight: 600, color: STATUS_COLORS[p.status], backgroundColor: `${STATUS_COLORS[p.status]}20`, padding: '2px 7px', borderRadius: 5 }}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
