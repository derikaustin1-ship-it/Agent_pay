'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import {
  SavedAddress,
  ShoppingPreferencesData,
  NotificationPreferencesData,
} from '@/types';
import {
  User,
  MapPin,
  Bell,
  Globe,
  Wallet,
  Heart,
  Package,
  Trash2,
  Plus,
  Lock,
  Sparkles,
  Check,
} from 'lucide-react';

export default function AccountPage() {
  const {
    state,
    openAuthModal,
    loginAsDemo,
    openCountrySelector,
    markNotificationsRead,
    loadNotifications,
    refreshAuth,
    showToast,
    formatPrice,
  } = useApp();

  const { user, userPreferences, notifications } = state;

  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [shoppingPrefs, setShoppingPrefs] = useState<ShoppingPreferencesData>({
    preferredBrands: [],
    preferredCategories: [],
    maxBudget: null,
  });
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferencesData>({
    orderUpdates: true,
    paymentAlerts: true,
    priceDrops: true,
    promotions: true,
    updatedAt: '',
  });
  const [brandsInput, setBrandsInput] = useState('');
  const [categoriesInput, setCategoriesInput] = useState('');
  const [showAddAddress, setShowAddAddress] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: userPreferences.countryCode || 'US',
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    let active = true;
    if (!user) return;
    (async () => {
      try {
        const [accRes, addrRes] = await Promise.all([
          fetch('/api/account'),
          fetch('/api/addresses'),
        ]);
        const accJson = await accRes.json();
        const addrJson = await addrRes.json();
        if (!active) return;
        if (accJson.success && accJson.data) {
          setName(accJson.data.user?.name || '');
          setPhone(accJson.data.user?.phone || '');
          if (accJson.data.shoppingPreferences) {
            setShoppingPrefs(accJson.data.shoppingPreferences);
            setBrandsInput((accJson.data.shoppingPreferences.preferredBrands || []).join(', '));
            setCategoriesInput(
              (accJson.data.shoppingPreferences.preferredCategories || []).join(', ')
            );
          }
          if (accJson.data.notificationPreferences) {
            setNotifPrefs(accJson.data.notificationPreferences);
          }
        }
        if (addrJson.success && Array.isArray(addrJson.data)) {
          setAddresses(addrJson.data);
        }
      } catch (err) {
        console.error('Account load error:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const nextShopping: ShoppingPreferencesData = {
        ...shoppingPrefs,
        preferredBrands: brandsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        preferredCategories: categoriesInput
          .split(',')
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
      };
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          phone,
          shoppingPreferences: nextShopping,
          notificationPreferences: notifPrefs,
        }),
      });
      const json = await res.json();
      if (json.success) {
        await refreshAuth();
        showToast('Account & preferences updated', 'success');
      } else {
        showToast(json.error || 'Update failed', 'error');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/addresses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newAddress, isDefault: addresses.length === 0 }),
    });
    const json = await res.json();
    if (json.success) {
      setAddresses(json.data);
      setShowAddAddress(false);
      setNewAddress({
        label: 'Home',
        fullName: '',
        phone: '',
        line1: '',
        city: '',
        state: '',
        postalCode: '',
        countryCode: userPreferences.countryCode || 'US',
      });
      showToast('Address added', 'success');
    }
  };

  const handleDeleteAddress = async (id: string) => {
    const res = await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const json = await res.json();
    if (json.success) {
      setAddresses(json.data);
      showToast('Address removed', 'info');
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    const res = await fetch('/api/addresses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId }),
    });
    const json = await res.json();
    if (json.success) {
      setAddresses(json.data);
      showToast('Default delivery address updated', 'success');
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Your AgentPay Account</h1>
        <p className="text-sm text-slate-500">
          Sign in or register to manage delivery addresses, smart budget protection, wishlist price alerts, and PayPal Sandbox orders.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={openAuthModal}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Sign In / Create Account
          </button>
          <button
            type="button"
            onClick={() => loginAsDemo()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            <Sparkles className="w-4 h-4" />
            1-Click Demo Shopper
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Summary */}
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-2xl font-black">
            {user.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold">{user.name}</h1>
            <p className="text-xs text-slate-300">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-semibold"
          >
            <Package className="w-4 h-4" /> Orders ({state.orders.length})
          </Link>
          <Link
            href="/wishlist"
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-white/20 px-3.5 py-2 text-xs font-semibold"
          >
            <Heart className="w-4 h-4" /> Wishlist ({state.wishlist.length})
          </Link>
          <Link
            href="/spending"
            className="inline-flex items-center gap-1.5 rounded-xl bg-amber-400 text-slate-950 hover:bg-amber-300 px-3.5 py-2 text-xs font-bold"
          >
            <Wallet className="w-4 h-4" /> Budget Guard
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Profile & Shopping & Notification Preferences */}
        <form
          onSubmit={handleSaveProfile}
          className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 space-y-6 shadow-xs"
        >
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <User className="w-4 h-4 text-indigo-600" />
              Profile &amp; Shopping Personalization
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Customize your contact details, preferred brands/categories, and notification alerts.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0100"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Preferred Brands (comma-separated)
              </label>
              <input
                type="text"
                value={brandsInput}
                onChange={(e) => setBrandsInput(e.target.value)}
                placeholder="Apple, Sony, Dell, Samsung"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Favorite Categories (comma-separated)
              </label>
              <input
                type="text"
                value={categoriesInput}
                onChange={(e) => setCategoriesInput(e.target.value)}
                placeholder="electronics, mobiles, books"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900"
              />
            </div>
          </div>

          {/* Notification Toggles */}
          <div id="notifications" className="border-t border-slate-100 pt-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bell className="w-4 h-4 text-indigo-600" />
              Notification Preferences
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                { key: 'orderUpdates', label: 'Order & Checkout Updates' },
                { key: 'paymentAlerts', label: 'PayPal Verification & Budget Alerts' },
                { key: 'priceDrops', label: 'Wishlist Price Drop Alerts' },
                { key: 'promotions', label: 'Verified Coupon Announcements' },
              ].map((item) => {
                const k = item.key as keyof Pick<
                  NotificationPreferencesData,
                  'orderUpdates' | 'paymentAlerts' | 'priceDrops' | 'promotions'
                >;
                return (
                  <label
                    key={item.key}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={notifPrefs[k]}
                      onChange={(e) =>
                        setNotifPrefs((prev) => ({ ...prev, [k]: e.target.checked }))
                      }
                      className="h-4 w-4 text-indigo-600 rounded"
                    />
                  </label>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingProfile}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            {savingProfile ? 'Saving...' : 'Save Account Settings'}
          </button>
        </form>

        {/* Right Column: Country/Currency, Budget Snapshot, Addresses */}
        <div className="lg:col-span-5 space-y-6">
          {/* Country & Currency */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Globe className="w-4 h-4 text-indigo-600" />
                Country &amp; Currency
              </h2>
              <button
                type="button"
                onClick={openCountrySelector}
                className="text-xs font-bold text-indigo-600 hover:underline"
              >
                Change
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Active region:{' '}
              <strong className="text-slate-900">
                {userPreferences.country?.flag} {userPreferences.country?.name} (
                {userPreferences.currencyCode})
              </strong>
            </p>
            <p className="text-[11px] text-slate-500">
              Your Smart Budget Guard limits:{' '}
              {state.budget
                ? `${formatPrice(
                    state.budget.maxPurchaseAmount,
                    false,
                    state.budget.currency || 'USD'
                  )} max order · ${formatPrice(
                    state.budget.dailySpendingLimit,
                    false,
                    state.budget.currency || 'USD'
                  )} daily`
                : 'Default limits active'}
            </p>
          </div>

          {/* Saved Delivery Addresses */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                Saved Addresses ({addresses.length})
              </h2>
              <button
                type="button"
                onClick={() => setShowAddAddress((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddAddress ? 'Cancel' : 'Add New'}
              </button>
            </div>

            {showAddAddress && (
              <form onSubmit={handleAddAddress} className="grid grid-cols-2 gap-2.5 text-xs">
                <input
                  required
                  placeholder="Label (Home)"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  placeholder="Full Name"
                  value={newAddress.fullName}
                  onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  placeholder="Phone"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2 col-span-2"
                />
                <input
                  required
                  placeholder="Street Address"
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2 col-span-2"
                />
                <input
                  required
                  placeholder="City"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  placeholder="State"
                  value={newAddress.state}
                  onChange={(e) => setNewAddress({ ...newAddress, state: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  placeholder="Postal Code"
                  value={newAddress.postalCode}
                  onChange={(e) => setNewAddress({ ...newAddress, postalCode: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2 col-span-2"
                />
                <button
                  type="submit"
                  className="col-span-2 rounded-xl bg-slate-900 py-2 font-bold text-white"
                >
                  Save Address
                </button>
              </form>
            )}

            <div className="space-y-2.5 text-xs">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className="rounded-xl border border-slate-200 p-3 flex items-start justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{addr.label}</span>
                      {addr.isDefault && (
                        <span className="rounded bg-emerald-100 text-emerald-800 px-1.5 py-0.5 text-[10px] font-bold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="font-medium text-slate-800 mt-0.5">{addr.fullName}</p>
                    <p className="text-slate-500">
                      {addr.line1}, {addr.city}, {addr.state} {addr.postalCode}
                    </p>
                    {!addr.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultAddress(addr.id)}
                        className="mt-1 text-[11px] font-semibold text-indigo-600 hover:underline"
                      >
                        Set as default
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteAddress(addr.id)}
                    aria-label="Delete address"
                    className="text-slate-400 hover:text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Notification Inbox */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Recent Alerts</h2>
              <button
                type="button"
                onClick={async () => {
                  await markNotificationsRead();
                  await loadNotifications();
                }}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500">No notifications yet.</p>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto">
                {notifications.slice(0, 8).map((n) => (
                  <div
                    key={n.id}
                    className={`rounded-xl border p-2.5 text-xs ${
                      n.isRead ? 'border-slate-100 bg-white' : 'border-indigo-200 bg-indigo-50/40'
                    }`}
                  >
                    <p className="font-bold text-slate-900">{n.title}</p>
                    <p className="text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
