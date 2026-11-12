'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import {
  Search,
  Sparkles,
  MapPin,
  Heart,
  ShoppingCart,
  Bell,
  User,
  ChevronDown,
  ShieldCheck,
  Package,
  LogOut,
  Wallet,
  Scale,
} from 'lucide-react';

const PRESET_LOCATIONS = [
  { label: 'San Francisco, 94105', city: 'San Francisco', postalCode: '94105' },
  { label: 'New York, 10001', city: 'New York', postalCode: '10001' },
  { label: 'Bengaluru, 560001', city: 'Bengaluru', postalCode: '560001' },
  { label: 'London, SW1A 1AA', city: 'London', postalCode: 'SW1A 1AA' },
];

export function Header() {
  const router = useRouter();
  const {
    state,
    unreadNotificationCount,
    openCountrySelector,
    openCartDrawer,
    openAuthModal,
    openCopilot,
    setDeliveryLocation,
    markNotificationsRead,
    logout,
    formatPrice,
  } = useApp();

  const [query, setQuery] = useState('');
  const [aiSearchMode, setAiSearchMode] = useState(false);
  const [locationOpen, setLocationOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = query.trim();
    if (aiSearchMode && trimmed) {
      openCopilot(trimmed);
      return;
    }
    if (!trimmed) {
      router.push('/catalog');
      return;
    }
    router.push(`/catalog?q=${encodeURIComponent(trimmed)}`);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md">
      {/* Top utility bar */}
      <div className="bg-slate-950/70 border-b border-slate-800 text-[11px] text-slate-300">
        <div className="max-w-7xl mx-auto px-4 py-1 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              <strong>AgentPay Smart Budget Guard:</strong>{' '}
              {state.spendingSummary
                ? `${formatPrice(
                    state.spendingSummary.remainingDailyBudget,
                    false,
                    state.spendingSummary.currency || state.budget?.currency || 'USD'
                  )} remaining today`
                : 'Spend safer with server-verified purchase limits'}
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-4">
            <Link href="/deals" className="hover:text-white transition">
              Today&apos;s Deals
            </Link>
            <Link href="/spending" className="hover:text-white transition">
              Spending Guard
            </Link>
            <Link href="/rewards" className="hover:text-white transition">
              PayPal Rewards Info
            </Link>
          </div>
        </div>
      </div>

      {/* Main Header Row */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center gap-3 flex-wrap lg:flex-nowrap">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md font-black text-white text-lg">
            A
          </div>
          <div>
            <span className="text-lg font-extrabold tracking-tight text-white group-hover:text-indigo-300 transition">
              AgentPay
            </span>
            <p className="text-[10px] text-slate-400 leading-none hidden sm:block">
              Find smarter. Spend safer.
            </p>
          </div>
        </Link>

        {/* Delivery Location Picker */}
        <div className="relative hidden md:block shrink-0">
          <button
            type="button"
            onClick={() => {
              setLocationOpen((o) => !o);
              setAccountOpen(false);
              setNotifOpen(false);
            }}
            className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left hover:bg-slate-800 transition"
          >
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="leading-tight">
              <span className="block text-[10px] text-slate-400">Deliver to</span>
              <span className="block text-xs font-semibold text-white">
                {state.deliveryLocation.label}
              </span>
            </div>
          </button>

          {locationOpen && (
            <div className="absolute left-0 mt-2 w-60 rounded-xl border border-slate-200 bg-white text-slate-900 shadow-xl p-2 z-50">
              <p className="px-2 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Select Delivery Location
              </p>
              {PRESET_LOCATIONS.map((loc) => (
                <button
                  key={loc.label}
                  type="button"
                  onClick={() => {
                    setDeliveryLocation(loc);
                    setLocationOpen(false);
                  }}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-xs font-medium hover:bg-indigo-50 ${
                    state.deliveryLocation.label === loc.label
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-700'
                  }`}
                >
                  {loc.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Large Search Bar + AI Search Toggle */}
        <form
          onSubmit={handleSearch}
          className="flex-1 min-w-[240px] flex items-center rounded-xl bg-white p-1 shadow-sm focus-within:ring-2 focus-within:ring-amber-400 order-last lg:order-none w-full lg:w-auto"
        >
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              aiSearchMode
                ? 'Ask AI Co-Pilot: e.g. "Best programming laptop under $900"...'
                : 'Search products, brands, laptops, mobiles, deals...'
            }
            className="flex-1 bg-transparent px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => setAiSearchMode((v) => !v)}
            title="Toggle AI natural-language search"
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold mr-1 transition ${
              aiSearchMode
                ? 'bg-indigo-600 text-white'
                : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">AI Search</span>
          </button>

          <button
            type="submit"
            aria-label="Search products"
            className="rounded-lg bg-amber-400 hover:bg-amber-500 text-slate-950 font-bold px-3.5 py-1.5 transition flex items-center gap-1 text-xs"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </form>

        {/* Right Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
          {/* Country & Currency Selector */}
          <button
            type="button"
            onClick={openCountrySelector}
            title="Country & Currency"
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 transition"
          >
            <span>{state.userPreferences.country?.flag || '🌐'}</span>
            <span>{state.userPreferences.currencyCode}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {/* Compare Shortcut */}
          {state.compareProducts.length > 0 && (
            <Link
              href="/compare"
              title="Compare Products"
              className="relative hidden sm:flex items-center gap-1 rounded-xl p-2 hover:bg-slate-800 transition text-slate-200"
            >
              <Scale className="w-4 h-4" />
              <span className="rounded-full bg-indigo-500 px-1.5 text-[10px] font-bold text-white">
                {state.compareProducts.length}
              </span>
            </Link>
          )}

          {/* Notifications Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setNotifOpen((o) => !o);
                setAccountOpen(false);
                setLocationOpen(false);
              }}
              aria-label="Notifications"
              className="relative rounded-xl p-2 hover:bg-slate-800 transition text-slate-200"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white flex items-center justify-center">
                  {unreadNotificationCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">Notifications</span>
                  {unreadNotificationCount > 0 && (
                    <button
                      type="button"
                      onClick={() => markNotificationsRead()}
                      className="text-[11px] font-semibold text-indigo-600 hover:underline"
                    >
                      Mark all read
                    </button>
                  )}
                </div>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                  {state.notifications.length === 0 ? (
                    <p className="p-4 text-xs text-slate-500 text-center">
                      {state.user
                        ? 'No notifications yet.'
                        : 'Sign in to view order updates & price drop alerts.'}
                    </p>
                  ) : (
                    state.notifications.slice(0, 6).map((n) => (
                      <Link
                        key={n.id}
                        href={n.link || '/orders'}
                        onClick={() => {
                          if (!n.isRead) markNotificationsRead(n.id);
                          setNotifOpen(false);
                        }}
                        className={`block px-4 py-2.5 hover:bg-slate-50 ${
                          !n.isRead ? 'bg-indigo-50/40' : ''
                        }`}
                      >
                        <p className="text-xs font-semibold text-slate-900">{n.title}</p>
                        <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                      </Link>
                    ))
                  )}
                </div>
                <Link
                  href="/account#notifications"
                  onClick={() => setNotifOpen(false)}
                  className="block text-center py-2 text-xs font-semibold text-indigo-600 bg-slate-50 border-t border-slate-200 hover:bg-slate-100"
                >
                  Notification Settings
                </Link>
              </div>
            )}
          </div>

          {/* Wishlist */}
          <Link
            href="/wishlist"
            aria-label="Wishlist"
            className="relative rounded-xl p-2 hover:bg-slate-800 transition text-slate-200"
          >
            <Heart className="w-5 h-5" />
            {state.wishlist.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-4 min-w-[16px] rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white flex items-center justify-center">
                {state.wishlist.length}
              </span>
            )}
          </Link>

          {/* Cart */}
          <button
            type="button"
            onClick={openCartDrawer}
            aria-label="Open Cart"
            className="relative flex items-center gap-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 px-2.5 py-2 transition"
          >
            <ShoppingCart className="w-5 h-5 text-amber-400" />
            <span className="text-xs font-bold">{state.cart.itemCount}</span>
          </button>

          {/* Profile / Account */}
          <div className="relative">
            {state.user ? (
              <button
                type="button"
                onClick={() => {
                  setAccountOpen((o) => !o);
                  setNotifOpen(false);
                  setLocationOpen(false);
                }}
                className="flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 hover:bg-slate-800 transition"
              >
                <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold">
                  {state.user.name.slice(0, 1).toUpperCase()}
                </div>
                <span className="hidden xl:block text-xs font-semibold max-w-[100px] truncate">
                  {state.user.name.split(' ')[0]}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            ) : (
              <button
                type="button"
                onClick={openAuthModal}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3 py-2 text-xs font-semibold transition"
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Sign In</span>
              </button>
            )}

            {accountOpen && state.user && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl overflow-hidden z-50">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                  <p className="text-xs font-bold text-slate-900 truncate">{state.user.name}</p>
                  <p className="text-[11px] text-slate-500 truncate">{state.user.email}</p>
                </div>
                <div className="p-1.5 text-xs font-medium">
                  <Link
                    href="/account"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100"
                  >
                    <User className="w-4 h-4 text-slate-500" />
                    My Account &amp; Addresses
                  </Link>
                  <Link
                    href="/orders"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100"
                  >
                    <Package className="w-4 h-4 text-slate-500" />
                    My Orders
                  </Link>
                  <Link
                    href="/spending"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100"
                  >
                    <Wallet className="w-4 h-4 text-slate-500" />
                    Budget &amp; Spending
                  </Link>
                  <Link
                    href="/wishlist"
                    onClick={() => setAccountOpen(false)}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-100"
                  >
                    <Heart className="w-4 h-4 text-slate-500" />
                    Wishlist ({state.wishlist.length})
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountOpen(false);
                      logout();
                    }}
                    className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-rose-600 hover:bg-rose-50 mt-1 border-t border-slate-100"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
