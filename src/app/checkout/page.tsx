'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SavedAddress, BudgetValidationResult } from '@/types';
import { useApp } from '@/context/AppContext';
import {
  ShieldCheck,
  ShieldAlert,
  MapPin,
  Plus,
  CreditCard,
  Tag,
  Lock,
  Loader2,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';

export default function CheckoutPage() {
  const {
    state,
    openAuthModal,
    loginAsDemo,
    applyCoupon,
    formatPrice,
    showToast,
  } = useApp();

  const { cart, user } = state;

  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string>('');
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [newAddress, setNewAddress] = useState({
    label: 'Home',
    fullName: '',
    phone: '',
    line1: '',
    city: '',
    state: '',
    postalCode: '',
    countryCode: state.userPreferences.countryCode || 'US',
  });

  const [couponInput, setCouponInput] = useState(state.appliedCouponCode || '');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validation, setValidation] = useState<BudgetValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [confirmUsdSettlement, setConfirmUsdSettlement] = useState(false);

  const requiresUsdSettlementConsent = !state.userPreferences.country?.paypalSupportedCurrency;

  useEffect(() => {
    let active = true;
    if (!user) return;
    (async () => {
      try {
        const res = await fetch('/api/addresses');
        const json = await res.json();
        if (!active) return;
        if (json.success && Array.isArray(json.data)) {
          setAddresses(json.data);
          const def = json.data.find((a: SavedAddress) => a.isDefault) || json.data[0];
          if (def) setSelectedAddressId(def.id);
        }
      } catch (err) {
        console.error('Failed to load addresses:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      if (!user || cart.agentPayItems.length === 0) {
        setValidation(null);
        return;
      }
      setValidating(true);
      setCheckoutError(null);
      try {
        const res = await fetch('/api/budget/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'cart',
            couponCode: state.appliedCouponCode || undefined,
          }),
        });
        const json = await res.json();
        if (!active) return;
        if (json.success && json.data) {
          setValidation(json.data);
        } else {
          setCheckoutError(json.error || 'Could not validate budget limits.');
        }
      } catch {
        if (active) setCheckoutError('Network error while validating budget on server.');
      } finally {
        if (active) setValidating(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, cart.agentPayItems.length, state.appliedCouponCode, cart.finalPayableAmount]);

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newAddress, isDefault: addresses.length === 0 }),
      });
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setAddresses(json.data);
        const latest = json.data[json.data.length - 1];
        if (latest) setSelectedAddressId(latest.id);
        setShowAddressForm(false);
        setNewAddress({
          label: 'Home',
          fullName: '',
          phone: '',
          line1: '',
          city: '',
          state: '',
          postalCode: '',
          countryCode: state.userPreferences.countryCode || 'US',
        });
        showToast('Shipping address saved', 'success');
      } else {
        showToast(json.error || 'Could not save address', 'error');
      }
    } catch {
      showToast('Failed to save address', 'error');
    }
  };

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    const res = await applyCoupon(couponInput);
    if (!res.ok) setCouponError(res.error || 'Invalid coupon');
  };

  const handleAuthorizePayPal = async () => {
    if (!validation?.allowed) return;
    if (requiresUsdSettlementConsent && !confirmUsdSettlement) {
      setCheckoutError(
        `Please confirm PayPal USD settlement ($${cart.finalPayableAmount.toFixed(2)} USD) before proceeding, as ${state.userPreferences.currencyCode} cannot settle directly.`
      );
      return;
    }
    setCreatingOrder(true);
    setCheckoutError(null);
    try {
      const res = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'cart',
          couponCode: state.appliedCouponCode || undefined,
          addressId: selectedAddressId || undefined,
          confirmedSettlementCurrency: state.userPreferences.country?.paypalSupportedCurrency
            ? state.userPreferences.currencyCode
            : 'USD',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to create PayPal order.');
      }
      const { approvalUrl, paypalOrderId } = json.data;
      if (approvalUrl) {
        window.location.href = approvalUrl;
      } else {
        window.location.href = `/?payment=approved&paypalOrderId=${encodeURIComponent(paypalOrderId)}`;
      }
    } catch (err) {
      setCheckoutError(
        err instanceof Error ? err.message : 'Unable to start PayPal Sandbox checkout.'
      );
      setCreatingOrder(false);
    }
  };

  if (!user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Sign in to Complete Checkout</h1>
        <p className="text-sm text-slate-500">
          Your cart items remain preserved. Sign in or use the 1-click Demo Shopper account so AgentPay can verify your budget limits and PayPal Sandbox order securely.
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
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            1-Click Demo Shopper
          </button>
        </div>
      </div>
    );
  }

  if (cart.agentPayItems.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">No AgentPay Checkout Items</h1>
        <p className="text-sm text-slate-500">
          {cart.externalItems.length > 0
            ? 'Your cart currently contains only External Merchant listings, which are purchased directly on each retailer site.'
            : 'Your shopping cart is empty.'}
        </p>
        <Link
          href={cart.externalItems.length > 0 ? '/cart' : '/catalog'}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {cart.externalItems.length > 0 ? 'Return to Cart' : 'Browse Products'}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link
            href="/cart"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Cart
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Multi-Product Secure Checkout
          </h1>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-bold text-emerald-800">
          <ShieldCheck className="w-4 h-4" />
          PayPal Sandbox Verified
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Address & Items */}
        <div className="lg:col-span-7 space-y-6">
          {/* Shipping Address */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600" />
                1. Delivery Address
              </h2>
              <button
                type="button"
                onClick={() => setShowAddressForm((v) => !v)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                {showAddressForm ? 'Cancel' : 'Add New Address'}
              </button>
            </div>

            {addresses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {addresses.map((addr) => (
                  <label
                    key={addr.id}
                    className={`rounded-xl border p-3.5 cursor-pointer transition text-xs ${
                      selectedAddressId === addr.id
                        ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-600/15'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="shippingAddress"
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                      />
                      <span className="font-bold text-slate-900">{addr.label}</span>
                      {addr.isDefault && (
                        <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 font-semibold text-slate-800">{addr.fullName}</p>
                    <p className="text-slate-600">
                      {addr.line1}, {addr.city}, {addr.state} {addr.postalCode}
                    </p>
                    <p className="text-slate-500 mt-0.5">{addr.phone}</p>
                  </label>
                ))}
              </div>
            )}

            {showAddressForm && (
              <form
                onSubmit={handleSaveAddress}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-100 text-xs"
              >
                <input
                  required
                  placeholder="Label (Home, Office)"
                  value={newAddress.label}
                  onChange={(e) => setNewAddress({ ...newAddress, label: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  placeholder="Recipient Full Name"
                  value={newAddress.fullName}
                  onChange={(e) => setNewAddress({ ...newAddress, fullName: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  placeholder="Phone Number"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  placeholder="Street Address"
                  value={newAddress.line1}
                  onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  placeholder="City"
                  value={newAddress.city}
                  onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
                  className="rounded-xl border border-slate-300 px-3 py-2"
                />
                <div className="grid grid-cols-2 gap-2">
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
                    className="rounded-xl border border-slate-300 px-3 py-2"
                  />
                </div>
                <button
                  type="submit"
                  className="sm:col-span-2 rounded-xl bg-slate-900 py-2 font-semibold text-white hover:bg-slate-800"
                >
                  Save &amp; Select Address
                </button>
              </form>
            )}
          </div>

          {/* Order Items */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              2. Review Items ({cart.agentPayItems.length})
            </h2>
            <div className="divide-y divide-slate-100">
              {cart.agentPayItems.map((item) => (
                <div key={item.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={item.product.imageUrl}
                      alt={item.product.name}
                      className="h-14 w-14 rounded-lg object-contain bg-slate-50 p-1 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{item.product.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Qty: {item.quantity} × {formatPrice(item.originalPrice, false, item.originalCurrency)}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-extrabold text-slate-900 shrink-0">
                    {formatPrice(item.originalLineTotal, true, item.originalCurrency)}
                  </span>
                </div>
              ))}
            </div>

            {cart.externalItems.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center justify-between gap-2">
                <span>
                  {cart.externalItems.length} external merchant item(s) excluded from AgentPay payment.
                </span>
                <Link href="/cart" className="font-bold underline shrink-0 flex items-center gap-1">
                  Manage in Cart <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Server Budget Check + PayPal Approval */}
        <aside className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-xs">
          <h2 className="text-base font-bold text-slate-900">
            3. Server Verification &amp; Payment
          </h2>

          {/* Coupon Input */}
          <form onSubmit={handleApplyCoupon} className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-indigo-600" />
              Promo Coupon
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                placeholder="AGENT10 or SAVE15"
                className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs uppercase"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white"
              >
                Apply
              </button>
            </div>
            {couponError && <p className="text-xs text-rose-600">{couponError}</p>}
          </form>

          {/* Price Breakdown */}
          <div className="space-y-2 text-sm border-t border-slate-100 pt-4">
            <div className="flex justify-between text-slate-600">
              <span>Items Subtotal</span>
              <span className="font-semibold text-slate-900">
                {formatPrice(cart.agentPaySubtotal)}
              </span>
            </div>
            {cart.discountAmount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Coupon Discount</span>
                <span>-{formatPrice(cart.discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-3">
              <span>Backend-Verified Payable</span>
              <span>{formatPrice(cart.finalPayableAmount, true)}</span>
            </div>
          </div>

          {/* Budget Guard Status Box */}
          {validating ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex items-center gap-3 text-xs text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
              Checking purchase limits against database...
            </div>
          ) : validation ? (
            <div
              className={`rounded-xl border p-4 text-xs space-y-1.5 ${
                validation.allowed
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-rose-200 bg-rose-50 text-rose-900'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {validation.allowed ? (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                )}
                <span>
                  {validation.allowed
                    ? 'Budget Protection Approved'
                    : 'Blocked by Smart Budget Protection'}
                </span>
              </div>
              <p>{validation.explanation}</p>
              {!validation.allowed && (
                <div className="pt-2">
                  <Link
                    href="/spending"
                    className="inline-block font-bold underline text-rose-800"
                  >
                    Adjust Budget Settings &rarr;
                  </Link>
                </div>
              )}
            </div>
          ) : null}

          {requiresUsdSettlementConsent && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900 space-y-2">
              <p className="font-bold">PayPal Currency Settlement Disclosure</p>
              <p className="text-[11px] leading-relaxed">
                {cart.paypalEligibilityNote ||
                  state.userPreferences.country?.notes ||
                  `${state.userPreferences.currencyCode} is display-only and cannot settle directly via PayPal. Checking out will process $${cart.finalPayableAmount.toFixed(2)} USD in PayPal Sandbox.`}
              </p>
              <label className="flex items-start gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={confirmUsdSettlement}
                  onChange={(e) => setConfirmUsdSettlement(e.target.checked)}
                  className="mt-0.5 rounded border-amber-400 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-[11px] font-semibold">
                  Confirm settlement in USD (${cart.finalPayableAmount.toFixed(2)} USD) via PayPal Sandbox
                </span>
              </label>
            </div>
          )}

          {checkoutError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {checkoutError}
            </div>
          )}

          <button
            type="button"
            disabled={
              !validation?.allowed ||
              creatingOrder ||
              validating ||
              (requiresUsdSettlementConsent && !confirmUsdSettlement)
            }
            onClick={handleAuthorizePayPal}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-md"
          >
            {creatingOrder ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Preparing PayPal Sandbox Order...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4" />
                Continue to PayPal for Approval
              </>
            )}
          </button>

          <p className="text-[11px] text-slate-500 text-center">
            No charge occurs until you explicitly approve the order inside PayPal Sandbox and our backend verifies capture status.
          </p>
        </aside>
      </div>
    </div>
  );
}
