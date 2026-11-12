'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { convertAmountWithRates } from '@/lib/exchange-rates';
import {
  X,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Heart,
  Tag,
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export function CartDrawer() {
  const router = useRouter();
  const {
    state,
    closeCartDrawer,
    updateCartQty,
    removeFromCart,
    clearCart,
    toggleWishlist,
    applyCoupon,
    formatPrice,
  } = useApp();

  const [couponInput, setCouponInput] = useState(state.appliedCouponCode || '');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);

  if (!state.cartDrawerOpen) return null;

  const { cart, budget, spendingSummary, exchangeRates } = state;

  // Compare budget limits accurately in budget.currency (never raw USD vs INR)
  const budgetCurrency = (budget?.currency || 'USD').toUpperCase();
  const payableInBudgetCurrency = convertAmountWithRates(
    cart.finalPayableAmount,
    'USD',
    budgetCurrency,
    exchangeRates.rates
  ).displayAmount;
  const remainingDaily =
    spendingSummary?.remainingDailyBudget ??
    (budget ? budget.dailySpendingLimit : null);
  const exceedsPerPurchase =
    budget && payableInBudgetCurrency > 0 && payableInBudgetCurrency > budget.maxPurchaseAmount;
  const exceedsDaily =
    remainingDaily !== null && payableInBudgetCurrency > 0 && payableInBudgetCurrency > remainingDaily;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setApplyingCoupon(true);
    try {
      const res = await applyCoupon(couponInput);
      if (!res.ok) setCouponError(res.error || 'Invalid coupon');
    } finally {
      setApplyingCoupon(false);
    }
  };

  const handleMoveToWishlist = async (product: (typeof cart.items)[number]['product']) => {
    await toggleWishlist(product);
    await removeFromCart(product.id);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/50 backdrop-blur-xs">
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-bold text-slate-900">
              Your Cart ({cart.itemCount})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {cart.items.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-xs font-medium text-slate-500 hover:text-rose-600 px-2 py-1"
              >
                Clear All
              </button>
            )}
            <button
              type="button"
              onClick={closeCartDrawer}
              aria-label="Close cart drawer"
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {cart.items.length === 0 ? (
            <div className="py-16 text-center space-y-3">
              <div className="mx-auto h-14 w-14 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600">
                <ShoppingCart className="w-7 h-7" />
              </div>
              <p className="text-sm font-semibold text-slate-900">Your cart is empty</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Browse deals across Electronics, Mobiles, Fashion, Home &amp; more, or ask the AI Co-Pilot to build a cart within your budget.
              </p>
              <Link
                href="/catalog"
                onClick={closeCartDrawer}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
              >
                Explore Products
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <>
              {/* AgentPay Eligible Items */}
              {cart.agentPayItems.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      AgentPay Checkout ({cart.agentPayItems.length})
                    </span>
                    <span className="text-xs font-semibold text-slate-600">
                      {formatPrice(cart.agentPaySubtotal)}
                    </span>
                  </div>

                  {cart.agentPayItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-xl border border-slate-200 p-3 bg-white"
                    >
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="h-16 w-16 rounded-lg object-contain bg-slate-50 p-1 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/products/${encodeURIComponent(item.product.id)}`}
                          onClick={closeCartDrawer}
                          className="text-xs font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-xs font-bold text-slate-900 mt-1">
                          {formatPrice(item.originalLineTotal, true, item.originalCurrency)}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="inline-flex items-center rounded-lg border border-slate-200">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                              className="p-1 text-slate-600 hover:bg-slate-100"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="px-2.5 text-xs font-semibold">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                              className="p-1 text-slate-600 hover:bg-slate-100"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleMoveToWishlist(item.product)}
                              title="Move to Wishlist"
                              className="p-1 text-slate-400 hover:text-rose-500"
                            >
                              <Heart className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.productId)}
                              title="Remove"
                              className="p-1 text-slate-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* External Merchant Saved Items */}
              {cart.externalItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1">
                      <ExternalLink className="w-3.5 h-3.5" />
                      External Merchants ({cart.externalItems.length})
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    External items complete payment directly on each merchant&apos;s site.
                  </p>

                  {cart.externalItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/30 p-3"
                    >
                      <img
                        src={item.product.imageUrl}
                        alt={item.product.name}
                        className="h-14 w-14 rounded-lg object-contain bg-white p-1 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-900 line-clamp-1">
                          {item.product.name}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {item.product.seller} • {formatPrice(item.originalLineTotal, true, item.originalCurrency)}
                        </p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <a
                            href={item.product.productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-amber-600"
                          >
                            Buy at Merchant
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.productId)}
                            className="text-xs text-slate-400 hover:text-rose-600 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Coupon Box */}
              {cart.agentPayItems.length > 0 && (
                <form onSubmit={handleApplyCoupon} className="space-y-1.5 pt-2 border-t border-slate-200">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    Promo Coupon (e.g. AGENT10, SAVE15)
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      placeholder="Enter coupon code"
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-900 uppercase focus:border-indigo-500 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={applyingCoupon}
                      className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      Apply
                    </button>
                  </div>
                  {couponError && <p className="text-[11px] text-rose-600">{couponError}</p>}
                  {cart.appliedCoupon && (
                    <div className="flex items-center justify-between text-[11px] text-emerald-700 font-medium">
                      <span>Applied: {cart.appliedCoupon.code}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCouponInput('');
                          applyCoupon('');
                        }}
                        className="underline"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer Totals & Checkout */}
        {cart.items.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 p-5 space-y-3">
            {(exceedsPerPurchase || exceedsDaily) && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Budget Protection Warning</p>
                  <p className="text-[11px] mt-0.5">
                    {exceedsPerPurchase
                      ? `Order exceeds your per-purchase limit (${formatPrice(budget!.maxPurchaseAmount, false, budgetCurrency)}).`
                      : `Order exceeds your remaining daily budget (${formatPrice(remainingDaily!, false, budgetCurrency)}).`}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex justify-between">
                <span>AgentPay Subtotal</span>
                <span className="font-medium text-slate-900">
                  {formatPrice(cart.agentPaySubtotal)}
                </span>
              </div>
              {cart.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-medium">
                  <span>Coupon Discount</span>
                  <span>-{formatPrice(cart.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-slate-900 pt-1.5 border-t border-slate-200">
                <span>Final Payable (AgentPay)</span>
                <span>{formatPrice(cart.finalPayableAmount, true)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Link
                href="/cart"
                onClick={closeCartDrawer}
                className="flex items-center justify-center rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100"
              >
                View Full Cart
              </Link>
              <button
                type="button"
                disabled={cart.agentPayItems.length === 0}
                onClick={() => {
                  closeCartDrawer();
                  router.push('/checkout');
                }}
                className="flex items-center justify-center gap-1 rounded-xl bg-indigo-600 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Checkout
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
