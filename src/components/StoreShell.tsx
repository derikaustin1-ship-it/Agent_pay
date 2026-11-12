'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { Header } from '@/components/Header';
import { CategoryNav } from '@/components/CategoryNav';
import { Footer } from '@/components/Footer';
import { CartDrawer } from '@/components/CartDrawer';
import { QuickViewModal } from '@/components/QuickViewModal';
import { AuthModal } from '@/components/AuthModal';
import { FloatingAICopilot } from '@/components/FloatingAICopilot';
import { CompareBar } from '@/components/CompareBar';
import { PaymentResultHandler } from '@/components/PaymentResultHandler';
import CountrySelector from '@/components/CountrySelector';
import PaymentModal from '@/components/PaymentModal';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

export function StoreShell({ children }: { children: React.ReactNode }) {
  const { state, clearToast } = useApp();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <Header />
      <CategoryNav />

      <main className="flex-1">{children}</main>

      <Footer />

      {/* Global Overlays & Drawers */}
      <CartDrawer />
      <QuickViewModal />
      <AuthModal />
      <CountrySelector />
      <PaymentModal />
      <PaymentResultHandler />
      <CompareBar />
      <FloatingAICopilot />

      {/* Toast Notification */}
      {state.toast && (
        <div
          key={state.toast.id}
          className={`fixed top-20 right-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-xl border ${
            state.toast.type === 'success'
              ? 'bg-emerald-950 text-emerald-50 border-emerald-700'
              : state.toast.type === 'error'
              ? 'bg-rose-950 text-rose-50 border-rose-700'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          {state.toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : state.toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          )}
          <span>{state.toast.message}</span>
          <button
            type="button"
            onClick={clearToast}
            aria-label="Dismiss notification"
            className="ml-1 opacity-75 hover:opacity-100"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
