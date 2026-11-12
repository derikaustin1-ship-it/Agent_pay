// src/app/layout.tsx
import type { Metadata } from 'next';
import { AppProvider } from '@/context/AppContext';
import { StoreShell } from '@/components/StoreShell';
import './globals.css';

export const metadata: Metadata = {
  title: 'AgentPay — AI-Powered E-Commerce & Smart Budget Checkout',
  description: 'Find smarter. Spend safer. Shop with confidence. Complete AI shopping storefront with Channel3 product discovery, multi-product cart, PayPal Sandbox checkout & budget protection.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <AppProvider>
          <StoreShell>{children}</StoreShell>
        </AppProvider>
      </body>
    </html>
  );
}
