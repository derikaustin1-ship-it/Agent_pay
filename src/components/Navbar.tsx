// src/components/Navbar.tsx
// Modern fintech header with quick stats, navigation controls, and currency selector

'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import { MenuIcon, ShieldCheckIcon, WalletIcon, GlobeIcon } from './Icons';

export default function Navbar() {
  const { state, dispatch, formatPrice, openCountrySelector } = useApp();
  const { activePage, spendingSummary, budget, sidebarOpen, userPreferences } = state;

  const currentCountry = userPreferences?.country || {
    flag: '🇺🇸',
    name: 'United States',
    code: 'US',
    currencyCode: 'USD',
  };

  const pageTitles: Record<string, { title: string; subtitle: string; tag: string }> = {
    assistant: {
      title: 'AI Shopping Assistant',
      subtitle: 'Conversational product discovery with autonomous budget guard',
      tag: 'Agentic AI',
    },
    comparison: {
      title: 'Product Comparison',
      subtitle: 'Side-by-side spec analysis, ratings, and recommendation rationale',
      tag: 'Spec Matrix',
    },
    spending: {
      title: 'Spending Dashboard',
      subtitle: 'Real-time transaction tracking, budget utilization, and purchase limits',
      tag: 'Analytics',
    },
    orders: {
      title: 'Order History',
      subtitle: 'Verified audit log of PayPal captured transactions',
      tag: 'Ledger',
    },
    rewards: {
      title: 'PayPal Rewards Intelligence',
      subtitle: 'Researched cash back rules, regional eligibility, and program mechanics',
      tag: 'Rewards',
    },
    budget: {
      title: 'Budget Settings',
      subtitle: 'Automated spending controls and maximum item purchase limits',
      tag: 'Controls',
    },
    settings: {
      title: 'Preferences & Settings',
      subtitle: 'Manage country, currency display, and account guardrails',
      tag: 'Config',
    },
  };

  const current = pageTitles[activePage] || {
    title: 'AgentPay',
    subtitle: 'AI-Powered Agentic Shopping & Payment Assistant',
    tag: 'Platform',
  };

  return (
    <header className="h-16 sm:h-18 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-3 sm:px-6 flex items-center justify-between sticky top-0 z-30 shadow-xs shrink-0 transition-all">
      <div className="flex items-center space-x-2.5 sm:space-x-4 min-w-0">
        {/* Hamburger Menu Button */}
        <button
          type="button"
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="lg:hidden p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 active:bg-slate-200 transition-colors focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0 cursor-pointer"
          aria-label="Open navigation menu"
          aria-expanded={sidebarOpen}
        >
          <MenuIcon className="w-5 h-5 text-slate-800" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center space-x-2">
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight truncate">
              {current.title}
            </h2>
            <span className="hidden sm:inline text-[10px] uppercase font-bold tracking-wider bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
              {current.tag}
            </span>
          </div>
          <p className="text-xs text-slate-500 hidden md:block truncate mt-0.5">{current.subtitle}</p>
        </div>
      </div>

      {/* Quick Nav Links for Primary Views (Desktop Large) */}
      <div className="hidden xl:flex items-center space-x-1 bg-slate-100/90 p-1 rounded-xl text-xs font-semibold shrink-0 border border-slate-200/50">
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_PAGE', payload: 'assistant' })}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            activePage === 'assistant'
              ? 'bg-white text-blue-600 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Shopping
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_PAGE', payload: 'spending' })}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            activePage === 'spending'
              ? 'bg-white text-blue-600 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Dashboard
        </button>
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_PAGE', payload: 'orders' })}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
            activePage === 'orders'
              ? 'bg-white text-blue-600 shadow-xs font-bold'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Order History
        </button>
      </div>

      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Country & Currency Selector Trigger */}
        <button
          type="button"
          onClick={openCountrySelector}
          className="flex items-center space-x-1.5 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/90 text-slate-800 px-3 py-1.5 rounded-full text-xs font-bold transition-all shadow-2xs cursor-pointer group"
          title="Change Country & Currency"
          aria-label="Change Country and Currency"
        >
          <span className="text-sm leading-none">{currentCountry.flag}</span>
          <span className="font-extrabold text-slate-900">{userPreferences?.currencyCode || 'USD'}</span>
          <GlobeIcon className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
        </button>

        {/* Real-time Budget Pill (Medium screens and up) */}
        <div className="hidden md:flex items-center space-x-2 bg-slate-50 border border-slate-200/80 px-3.5 py-1.5 rounded-full text-xs shadow-2xs">
          <WalletIcon className="w-4 h-4 text-blue-600 shrink-0" />
          <span className="text-slate-500 font-medium">Daily Left:</span>
          <span className="font-bold text-slate-900">
            {spendingSummary
              ? formatPrice(
                  spendingSummary.remainingDailyBudget,
                  false,
                  spendingSummary.currency || budget?.currency || 'USD'
                )
              : formatPrice(budget?.dailySpendingLimit || 200, false, budget?.currency || 'USD')}
          </span>
        </div>

        {/* Security / Verification Badge */}
        <div className="flex items-center space-x-1.5 bg-emerald-50/80 border border-emerald-200/90 text-emerald-800 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="hidden sm:inline">Secure Checkout</span>
          <span className="sm:hidden text-[11px]">Protected</span>
        </div>

        {/* User Badge */}
        <div className="flex items-center space-x-2 pl-1.5 sm:pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-700 text-white font-bold text-xs flex items-center justify-center shadow-xs shrink-0 ring-2 ring-white">
            DU
          </div>
          <span className="text-xs font-semibold text-slate-700 hidden sm:inline">Demo User</span>
        </div>
      </div>
    </header>
  );
}
