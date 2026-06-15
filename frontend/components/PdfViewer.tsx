'use client';
import { useEffect, useRef, useState } from 'react';

// Android brauzerlar <iframe> ichida PDF ko'rsatmaydi (qora ekran).
// Shuning uchun pdf.js bilan har bir sahifani canvas'ga chizamiz — barcha qurilmalarda ishlaydi.
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function PdfViewer({ url, bg = '#111' }: { url: string; bg?: string }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');

  useEffect(() => {
    let cancelled = false;
    let lastWidth = 0;

    const draw = async (doc: any) => {
      const host = hostRef.current;
      const scroll = scrollRef.current;
      if (!host || !scroll) return;
      const width = Math.floor(scroll.clientWidth) || 600;
      lastWidth = width;
      host.innerHTML = '';
      const dpr = Math.min(window.devicePixelRatio || 1, 2); // mobil xotira uchun cheklov

      for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        if (cancelled) return;
        const base = page.getViewport({ scale: 1 });
        const cssScale = width / base.width;
        const viewport = page.getViewport({ scale: cssScale * dpr });

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        canvas.style.display = 'block';
        canvas.style.marginBottom = '8px';
        canvas.style.borderRadius = '4px';
        const ctx = canvas.getContext('2d');
        if (!ctx) continue;
        host.appendChild(canvas);
        await page.render({ canvasContext: ctx, viewport }).promise;
        if (cancelled) return;
        // Birinchi sahifa chizilishi bilan "yuklanmoqda" ni olib tashlaymiz
        if (n === 1) setStatus('done');
      }
    };

    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
        const proxied = `${API}/upload/pdf?url=${encodeURIComponent(url)}`;
        const doc = await pdfjs.getDocument({ url: proxied }).promise;
        if (cancelled) return;

        // Layout joylashishi uchun bir kadr kutamiz (clientWidth to'g'ri bo'lsin)
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        if (cancelled) return;
        await draw(doc);

        // Orientatsiya/o'lcham o'zgarsa — qayta chizamiz
        const ro = new ResizeObserver(() => {
          const w = Math.floor(scrollRef.current?.clientWidth || 0);
          if (w && Math.abs(w - lastWidth) > 30) draw(doc);
        });
        if (scrollRef.current) ro.observe(scrollRef.current);
        (draw as any)._ro = ro;
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      const ro = (draw as any)._ro as ResizeObserver | undefined;
      if (ro) ro.disconnect();
      if (hostRef.current) hostRef.current.innerHTML = '';
    };
  }, [url]);

  return (
    <div
      ref={scrollRef}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        position: 'absolute', inset: 0,
        overflowY: 'auto', WebkitOverflowScrolling: 'touch',
        backgroundColor: bg, padding: 8,
      } as React.CSSProperties}
    >
      {status !== 'done' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', opacity: 0.5, flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
          <span style={{ fontSize: 28 }}>{status === 'error' ? '⚠️' : '📄'}</span>
          <span style={{ fontSize: 13 }}>{status === 'error' ? 'PDF yuklanmadi' : 'PDF yuklanmoqda...'}</span>
        </div>
      )}
      <div ref={hostRef} style={{ width: '100%' }} />
    </div>
  );
}
