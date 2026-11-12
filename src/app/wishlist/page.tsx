'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import {
  Heart,
  ShoppingCart,
  Trash2,
  BellRing,
  ArrowDownRight,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

export default function WishlistPage() {
  const {
    state,
    formatPrice,
    moveWishlistToCart,
    toggleWishlist,
    loadWishlist,
    loadNotifications,
    showToast,
  } = useApp();

  const [checkingPrices, setCheckingPrices] = useState(false);
  const [priceCheckInfo, setPriceCheckInfo] = useState<string | null>(null);

  const handleCheckPrices = async () => {
    setCheckingPrices(true);
    try {
      const res = await fetch('/api/wishlist/check-prices', { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data) {
        await Promise.all([loadWishlist(), loadNotifications()]);
        setPriceCheckInfo(
          `Checked ${json.data.checkedCount} item(s) at ${new Date(
            json.data.checkedAt
          ).toLocaleTimeString()}. ${json.data.dropsFound} price drop(s) detected.`
        );
        showToast(
          json.data.dropsFound > 0
            ? `${json.data.dropsFound} wishlist price drop(s) found!`
            : 'Prices verified — no new drops right now.',
          'info'
        );
      }
    } catch {
      showToast('Failed to re-check prices', 'error');
    } finally {
      setCheckingPrices(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
            Your Wishlist ({state.wishlist.length})
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Compare saved price against current live catalog price and trigger an on-demand backend price re-check anytime.
          </p>
        </div>

        {state.wishlist.length > 0 && (
          <button
            type="button"
            onClick={handleCheckPrices}
            disabled={checkingPrices}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2 text-xs font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checkingPrices ? 'animate-spin' : ''}`} />
            {checkingPrices ? 'Re-checking Prices...' : 'Check for Price Drops Now'}
          </button>
        )}
      </div>

      {priceCheckInfo && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
          <BellRing className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{priceCheckInfo}</span>
        </div>
      )}

      {state.wishlist.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-14 text-center space-y-4">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <Heart className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Your wishlist is empty</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Tap the heart icon on any product card to track its price and move it to your cart later.
          </p>
          <Link
            href="/catalog"
            className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Discover Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {state.wishlist.map((item) => {
            const isExternal = item.product.checkoutType === 'external';
            return (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col gap-4 shadow-xs"
              >
                <div className="flex gap-4 items-start">
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
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
                      {item.product.brand}
                    </span>
                    <Link
                      href={`/products/${encodeURIComponent(item.product.id)}`}
                      className="block text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-2 mt-0.5"
                    >
                      {item.product.name}
                    </Link>
                    <p className="text-lg font-black text-slate-900 mt-1.5">
                      {formatPrice(
                        item.product.originalPrice ?? item.product.price,
                        true,
                        item.product.originalCurrency || item.product.currency
                      )}
                    </p>
                    {item.priceDropped && item.priceDropAmount > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800 mt-1">
                        <ArrowDownRight className="w-3 h-3" />
                        Price dropped {formatPrice(item.priceDropAmount, false, item.currency)} since saved!
                      </span>
                    ) : (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Saved at {formatPrice(item.savedPrice, false, item.currency)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-3 border-t border-slate-100">
                  {isExternal ? (
                    <a
                      href={item.product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white hover:bg-amber-600"
                    >
                      Visit {item.product.seller}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => moveWishlistToCart(item.productId)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                    >
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Move to Cart
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleWishlist(item.product)}
                    aria-label="Remove from wishlist"
                    className="rounded-xl border border-slate-200 p-2 text-slate-500 hover:text-rose-600 hover:border-rose-200"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
