// src/components/BudgetSettings.tsx
// Interactive budget and spending limit management screen with server-side validation

'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import {
  SlidersIcon,
  ShieldCheckIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  WalletIcon,
  CreditCardIcon,
} from './Icons';

export default function BudgetSettings() {
  const { state, saveBudget, loadBudget, loadSpendingSummary, formatPrice } = useApp();
  const { budget, userPreferences } = state;

  const activeCurrency = (userPreferences?.currencyCode || budget?.currency || 'USD').toUpperCase();
  const currencySymbol = userPreferences?.country?.currencySymbol || '$';

  const [maxPurchase, setMaxPurchase] = useState<number>(budget?.maxPurchaseAmount ?? 100);
  const [dailyLimit, setDailyLimit] = useState<number>(budget?.dailySpendingLimit ?? 200);
  const [syncedBudget, setSyncedBudget] = useState(budget);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (budget !== syncedBudget) {
    setSyncedBudget(budget);
    if (budget) {
      setMaxPurchase(budget.maxPurchaseAmount);
      setDailyLimit(budget.dailySpendingLimit);
    }
  }

  useEffect(() => {
    loadBudget();
  }, [loadBudget]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage('');
    setSaveSuccess(false);

    if (maxPurchase <= 0) {
      setErrorMessage(`Maximum purchase amount must be greater than ${currencySymbol}0.`);
      return;
    }
    if (dailyLimit <= 0) {
      setErrorMessage(`Daily spending limit must be greater than ${currencySymbol}0.`);
      return;
    }
    if (maxPurchase > dailyLimit) {
      setErrorMessage('Maximum single purchase amount cannot exceed the daily spending limit.');
      return;
    }

    setIsSaving(true);
    try {
      await saveBudget(maxPurchase, dailyLimit, activeCurrency);
      await loadSpendingSummary();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      setErrorMessage('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  const presets =
    activeCurrency === 'INR'
      ? [
          { label: '🛡️ Conservative', max: 1500, daily: 3000 },
          { label: '⚖️ Balanced (Recommended)', max: 5000, daily: 10000 },
          { label: '🚀 Flexible', max: 15000, daily: 30000 },
        ]
      : activeCurrency === 'JPY'
      ? [
          { label: '🛡️ Conservative', max: 5000, daily: 10000 },
          { label: '⚖️ Balanced (Recommended)', max: 15000, daily: 30000 },
          { label: '🚀 Flexible', max: 40000, daily: 80000 },
        ]
      : [
          { label: '🛡️ Conservative', max: 50, daily: 100 },
          { label: '⚖️ Balanced (Recommended)', max: 100, daily: 200 },
          { label: '🚀 Flexible', max: 250, daily: 500 },
        ];

  function applyPreset(presetMax: number, presetDaily: number) {
    setMaxPurchase(presetMax);
    setDailyLimit(presetDaily);
    setSaveSuccess(false);
  }

  return (
    <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-8">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <SlidersIcon className="w-6 h-6 text-blue-600" />
          Smart Budget & Spending Controls
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Enforced server-side before any payment order is created or authorized.
        </p>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6">
        {/* Preset Profiles */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
            Quick Budget Profiles ({activeCurrency})
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {presets.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.max, p.daily)}
                className={`p-3.5 rounded-2xl border text-left transition-all group ${
                  i === 1
                    ? 'border-blue-500 bg-blue-50/40'
                    : 'border-slate-200 hover:border-blue-500 hover:bg-blue-50/50'
                }`}
              >
                <div className="font-bold text-slate-900 text-xs group-hover:text-blue-600">
                  {p.label}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {currencySymbol}
                  {p.max.toLocaleString()} max item / {currencySymbol}
                  {p.daily.toLocaleString()} daily limit
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Form Inputs */}
        <form onSubmit={handleSave} className="space-y-6 pt-4 border-t border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Input 1: Maximum Item Purchase */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Maximum Single Purchase Limit ({activeCurrency})</span>
                <span className="text-blue-600 font-mono">
                  {formatPrice(maxPurchase, false, activeCurrency)}
                  {activeCurrency !== 'USD' && (
                    <span className="text-slate-400 font-normal ml-1">
                      (≈ {formatPrice(maxPurchase, true, activeCurrency)})
                    </span>
                  )}
                </span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-semibold">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="1"
                  max="1000000"
                  step={activeCurrency === 'INR' || activeCurrency === 'JPY' ? '50' : '5'}
                  value={maxPurchase}
                  onChange={(e) => setMaxPurchase(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-3 text-sm text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Any item priced above this limit ({activeCurrency}) is blocked before payment authorization.
              </p>
            </div>

            {/* Input 2: Daily Spending Limit */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800 flex items-center justify-between">
                <span>Daily Spending Ceiling ({activeCurrency})</span>
                <span className="text-indigo-600 font-mono">
                  {formatPrice(dailyLimit, false, activeCurrency)}
                </span>
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400 font-semibold">
                  {currencySymbol}
                </span>
                <input
                  type="number"
                  min="1"
                  max="5000000"
                  step={activeCurrency === 'INR' || activeCurrency === 'JPY' ? '100' : '10'}
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-3 text-sm text-slate-900 font-bold focus:bg-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden transition-all"
                />
              </div>
              <p className="text-[11px] text-slate-500">
                Sum of captured orders within the same calendar day (normalized to {activeCurrency}) cannot exceed this limit.
              </p>
            </div>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center space-x-2">
              <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center space-x-2 animate-fade-in">
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Budget limits successfully saved and active in the database!</span>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2 flex items-center justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="py-3 px-6 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <ShieldCheckIcon className="w-4 h-4 text-white" />
              <span>{isSaving ? 'Updating Database...' : 'Save Spending Limits'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Security & Enforcement Explanation */}
      <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 text-xs text-slate-600 space-y-2">
        <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
          Server-Side Safety Guarantee
        </h4>
        <p className="leading-relaxed">
          Unlike client-only shopping websites, AgentPay validates these rules on the server inside the{' '}
          <code className="text-blue-700 bg-blue-100/60 px-1.5 py-0.5 rounded">/api/paypal/create-order</code>{' '}
          endpoint. Even if client code is manipulated, orders exceeding your budget are rejected before PayPal is
          contacted.
        </p>
      </div>
    </div>
  );
}

