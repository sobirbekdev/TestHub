'use client';
import { useEffect, useRef, useState } from 'react';

// Android brauzerlar <iframe> ichida PDF ko'rsatmaydi (qora ekran).
// Shuning uchun pdf.js bilan har bir sahifani canvas'ga chizamiz — barcha qurilmalarda ishlaydi.
const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function PdfViewer({ url, bg = '#111' }: { url: string; bg?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading');

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;

    (async () => {
      try {
        const pdfjs: any = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

        const proxied = `${API}/upload/pdf?url=${encodeURIComponent(url)}`;
        const doc = await pdfjs.getDocument({ url: proxied }).promise;
        if (cancelled || !host) return;
        host.innerHTML = '';

        const containerWidth = host.clientWidth || 600;
        const dpr = Math.min(window.devicePixelRatio || 1, 2); // mobil xotira uchun cheklov

        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n);
          if (cancelled) return;
          const base = page.getViewport({ scale: 1 });
          const cssScale = containerWidth / base.width;
          const viewport = page.getViewport({ scale: cssScale * dpr });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          canvas.style.display = 'block';
          canvas.style.marginBottom = '8px';
          canvas.style.borderRadius = '4px';
          const ctx = canvas.getContext('2d');
          if (!ctx) continue;
          host.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setStatus('done');
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();

    return () => { cancelled = true; if (host) host.innerHTML = ''; };
  }, [url]);

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      style={{ width: '100%', height: '100%', overflowY: 'auto', backgroundColor: bg, padding: 8 }}
    >
      {status !== 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#fff', opacity: 0.5, flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 28 }}>{status === 'error' ? '⚠️' : '📄'}</span>
          <span style={{ fontSize: 13 }}>{status === 'error' ? 'PDF yuklanmadi' : 'PDF yuklanmoqda...'}</span>
        </div>
      )}
      <div ref={hostRef} style={{ width: '100%' }} />
    </div>
  );
}
