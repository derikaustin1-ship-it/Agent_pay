'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { convertAmountWithRates } from '@/lib/exchange-rates';
import {
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  Heart,
  Tag,
  ShieldCheck,
  ShieldAlert,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export default function CartPage() {
  const router = useRouter();
  const {
    state,
    updateCartQty,
    removeFromCart,
    clearCart,
    toggleWishlist,
    applyCoupon,
    formatPrice,
  } = useApp();

  const { cart, budget, spendingSummary, exchangeRates } = state;
  const [couponInput, setCouponInput] = useState(state.appliedCouponCode || '');
  const [couponError, setCouponError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const budgetCurrency = (budget?.currency || 'USD').toUpperCase();
  const payableInBudgetCurrency = convertAmountWithRates(
    cart.finalPayableAmount,
    'USD',
    budgetCurrency,
    exchangeRates.rates
  ).displayAmount;
  const remainingDaily =
    spendingSummary?.remainingDailyBudget ?? budget?.dailySpendingLimit ?? null;
  const exceedsPerPurchase =
    budget && payableInBudgetCurrency > 0 && payableInBudgetCurrency > budget.maxPurchaseAmount;
  const exceedsDaily =
    remainingDaily !== null && payableInBudgetCurrency > 0 && payableInBudgetCurrency > remainingDaily;

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setCouponError(null);
    setApplying(true);
    try {
      const res = await applyCoupon(couponInput);
      if (!res.ok) setCouponError(res.error || 'Coupon rejected');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <ShoppingCart className="w-6 h-6 text-indigo-600" />
            Shopping Cart ({cart.itemCount})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            All quantities, discounts, and final totals are verified server-side prior to PayPal approval.
          </p>
        </div>

        {cart.items.length > 0 && (
          <button
            type="button"
            onClick={clearCart}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:text-rose-600 hover:border-rose-200 transition"
          >
            Clear Cart
          </button>
        )}
      </div>

      {cart.items.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-14 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Your cart is empty</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Add products from Today&apos;s Deals, search the catalogue, or move saved items from your wishlist.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/catalog"
              className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Browse Catalogue
            </Link>
            <Link
              href="/wishlist"
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              View Wishlist
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Cart Item Columns */}
          <div className="lg:col-span-8 space-y-6">
            {cart.agentPayItems.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                <div className="px-5 py-3.5 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    AgentPay Multi-Item Checkout Eligible ({cart.agentPayItems.length})
                  </span>
                  <span className="text-xs font-bold text-emerald-900">
                    {formatPrice(cart.agentPaySubtotal)}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  {cart.agentPayItems.map((item) => (
                    <div key={item.id} className="p-5 flex gap-4 items-start sm:items-center flex-col sm:flex-row">
                      <Link
                        href={`/products/${encodeURIComponent(item.product.id)}`}
                        className="h-24 w-24 rounded-xl bg-slate-50 p-2 shrink-0 flex items-center justify-center border border-slate-100"
                      >
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      </Link>

                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                          {item.product.brand} • {item.product.seller}
                        </p>
                        <Link
                          href={`/products/${encodeURIComponent(item.product.id)}`}
                          className="text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-2 mt-0.5"
                        >
                          {item.product.name}
                        </Link>
                        <p className="text-xs text-slate-500 mt-1">
                          Unit price: {formatPrice(item.originalPrice, true, item.originalCurrency)}
                        </p>

                        <div className="mt-3 flex items-center gap-4 flex-wrap">
                          <div className="inline-flex items-center rounded-xl border border-slate-300">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              onClick={() => updateCartQty(item.productId, item.quantity - 1)}
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-l-xl"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-bold">{item.quantity}</span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => updateCartQty(item.productId, item.quantity + 1)}
                              className="p-2 text-slate-600 hover:bg-slate-100 rounded-r-xl"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={async () => {
                              await toggleWishlist(item.product);
                              await removeFromCart(item.productId);
                            }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-rose-600"
                          >
                            <Heart className="w-3.5 h-3.5" />
                            Move to Wishlist
                          </button>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.productId)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-rose-600"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>

                      <div className="sm:text-right shrink-0">
                        <p className="text-base font-extrabold text-slate-900">
                          {formatPrice(item.originalLineTotal, true, item.originalCurrency)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {cart.externalItems.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden">
                <div className="px-5 py-3.5 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 text-amber-700" />
                    External Merchant Items ({cart.externalItems.length})
                  </span>
                  <span className="text-xs font-bold text-amber-900">
                    {formatPrice(cart.externalSubtotal)}
                  </span>
                </div>
                <p className="px-5 py-2.5 text-xs text-amber-800 bg-amber-50/40 border-b border-amber-100">
                  These products were discovered live from external retailers and cannot be paid directly through AgentPay. Open each merchant link to complete your order externally.
                </p>

                <div className="divide-y divide-slate-100">
                  {cart.externalItems.map((item) => (
                    <div key={item.id} className="p-5 flex gap-4 items-center justify-between flex-wrap">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <img
                          src={item.product.imageUrl}
                          alt={item.product.name}
                          className="h-16 w-16 rounded-xl object-contain bg-slate-50 p-1.5 shrink-0"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/products/${encodeURIComponent(item.product.id)}`}
                            className="text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-1"
                          >
                            {item.product.name}
                          </Link>
                          <p className="text-xs text-slate-500">
                            Seller: {item.product.seller} • {formatPrice(item.originalLineTotal, true, item.originalCurrency)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={item.product.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-600"
                        >
                          Buy on {item.product.seller}
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.productId)}
                          className="p-2 text-slate-400 hover:text-rose-600"
                          title="Remove"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Order Summary */}
          <aside className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6 space-y-5 shadow-xs">
            <h2 className="text-base font-bold text-slate-900">Order Summary</h2>

            {cart.agentPayItems.length > 0 && (
              <form onSubmit={handleApplyCoupon} className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-600" />
                  Apply Verified Coupon (AGENT10 / SAVE15)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="COUPON CODE"
                    className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs uppercase focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={applying}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                  >
                    Apply
                  </button>
                </div>
                {couponError && <p className="text-xs text-rose-600">{couponError}</p>}
                {cart.appliedCoupon && (
                  <p className="text-xs text-emerald-700 font-medium">
                    Applied {cart.appliedCoupon.code}: {cart.appliedCoupon.description}
                  </p>
                )}
              </form>
            )}

            <div className="space-y-2 text-sm border-t border-slate-100 pt-4">
              <div className="flex justify-between text-slate-600">
                <span>AgentPay Subtotal</span>
                <span className="font-semibold text-slate-900">
                  {formatPrice(cart.agentPaySubtotal)}
                </span>
              </div>
              {cart.discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Discount</span>
                  <span>-{formatPrice(cart.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-slate-600">
                <span>Shipping</span>
                <span className="font-semibold text-emerald-700">
                  {cart.shippingAmount === 0 ? 'FREE' : formatPrice(cart.shippingAmount)}
                </span>
              </div>
              <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-3">
                <span>Payable at Checkout</span>
                <span>{formatPrice(cart.finalPayableAmount, true)}</span>
              </div>
            </div>

            {(exceedsPerPurchase || exceedsDaily) && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Exceeds Configured Budget</p>
                  <p className="mt-0.5">
                    {exceedsPerPurchase
                      ? `Per-purchase limit is ${formatPrice(budget!.maxPurchaseAmount, false, budgetCurrency)}.`
                      : `Remaining daily limit is ${formatPrice(remainingDaily!, false, budgetCurrency)}.`}
                  </p>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={cart.agentPayItems.length === 0}
              onClick={() => router.push('/checkout')}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition shadow-md"
            >
              Proceed to Multi-Product Checkout
              <ArrowRight className="w-4 h-4" />
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
