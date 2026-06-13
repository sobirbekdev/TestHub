import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import './globals.css';
import { Toaster } from 'react-hot-toast';
import TelegramAuth from '@/components/TelegramAuth';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'TestHub — Kimyo Testlari',
  description: 'DTM, Atestatsiya, Milliy Sertifikat testlari',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={inter.className}>
        <TelegramAuth />
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
