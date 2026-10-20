import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Gastapp — Portal Financiero',
  description: 'Gestión y control de finanzas personales',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${inter.className} bg-[#F8FAFC] text-slate-900 min-h-screen antialiased`}>
        {children}
      </body>
    </html>
  );
}
