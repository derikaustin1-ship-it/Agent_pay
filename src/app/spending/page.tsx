'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import SpendingDashboard from '@/components/SpendingDashboard';
import BudgetSettings from '@/components/BudgetSettings';
import { Lock } from 'lucide-react';

export default function SpendingPage() {
  const { state, openAuthModal, loginAsDemo } = useApp();

  if (!state.user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          Smart Budget Protection &amp; Spending Guard
        </h1>
        <p className="text-sm text-slate-500">
          Sign in or launch the Demo Shopper account to configure per-purchase and daily spending ceilings.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={openAuthModal}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => loginAsDemo()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            1-Click Demo Shopper
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <SpendingDashboard />
      <div className="border-t border-slate-200 pt-8">
        <BudgetSettings />
      </div>
    </div>
  );
}
