'use client';

import React from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import {
  X,
  ShoppingCart,
  Heart,
  Scale,
  Star,
  ExternalLink,
  ShieldCheck,
  ArrowRight,
  Zap,
} from 'lucide-react';

export function QuickViewModal() {
  const {
    state,
    closeQuickView,
    formatPrice,
    addToCart,
    toggleWishlist,
    isInWishlist,
    toggleCompare,
    isInCompare,
    proceedToCheckout,
  } = useApp();

  const product = state.quickViewProduct;
  if (!product) return null;

  const isExternal = product.checkoutType === 'external';
  const wishlisted = isInWishlist(product.id);
  const compared = isInCompare(product.id);
  const origPrice = product.originalPrice ?? product.price;
  const origCurrency = product.originalCurrency || product.currency || 'USD';
  const discountPct =
    typeof product.compareAtPrice === 'number' && product.compareAtPrice > origPrice
      ? Math.round(((product.compareAtPrice - origPrice) / product.compareAtPrice) * 100)
      : 0;

  const handleBuyNow = () => {
    closeQuickView();
    if (isExternal) {
      window.open(product.productUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    proceedToCheckout({
      product,
      matchScore: 90,
      reasoning: 'Selected directly from Quick View',
      advantages: product.features?.slice(0, 3) || [],
      limitations: [],
      trustWarnings: [],
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
        <button
          type="button"
          onClick={closeQuickView}
          aria-label="Close quick view"
          className="absolute top-3.5 right-3.5 z-10 rounded-full bg-white/90 border border-slate-200 p-2 text-slate-600 hover:text-slate-900 shadow-sm"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 overflow-y-auto">
          {/* Image */}
          <div className="bg-slate-50 flex items-center justify-center p-8 min-h-[280px]">
            <img
              src={product.imageUrl}
              alt={product.name}
              className="max-h-72 w-full object-contain"
            />
          </div>

          {/* Info */}
          <div className="p-6 flex flex-col gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                {product.brand}
              </span>
              <span className="text-slate-300">•</span>
              <span className="text-xs text-slate-500">Seller: {product.seller}</span>
            </div>

            <h3 className="text-lg font-bold text-slate-900 leading-snug">{product.name}</h3>

            {typeof product.rating === 'number' && product.rating > 0 && (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">
                  {product.rating.toFixed(1)}
                  <Star className="w-3 h-3 fill-current" />
                </span>
                {typeof product.reviewCount === 'number' && product.reviewCount > 0 && (
                  <span className="text-xs text-slate-500">
                    {product.reviewCount.toLocaleString()} verified reviews
                  </span>
                )}
              </div>
            )}

            <div className="flex items-baseline gap-2.5 flex-wrap">
              <span className="text-2xl font-extrabold text-slate-900">
                {formatPrice(origPrice, true, origCurrency)}
              </span>
              {discountPct > 0 && product.compareAtPrice && (
                <>
                  <span className="text-sm text-slate-400 line-through">
                    {formatPrice(product.compareAtPrice, false, origCurrency)}
                  </span>
                  <span className="text-xs font-bold text-rose-600">
                    Save {discountPct}%
                  </span>
                </>
              )}
            </div>

            <div
              className={`rounded-xl px-3 py-2 text-xs flex items-center gap-2 ${
                isExternal
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}
            >
              {isExternal ? (
                <>
                  <ExternalLink className="w-4 h-4 shrink-0" />
                  External Merchant Listing — completes purchase directly on {product.seller}.
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  Eligible for AgentPay Multi-Item Checkout &amp; Smart Budget Protection.
                </>
              )}
            </div>

            {product.description && (
              <p className="text-xs text-slate-600 leading-relaxed line-clamp-3">
                {product.description}
              </p>
            )}

            {product.features && product.features.length > 0 && (
              <ul className="space-y-1 text-xs text-slate-600">
                {product.features.slice(0, 4).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-indigo-500 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-auto pt-3 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={async () => {
                    await addToCart(product, 1, true);
                    closeQuickView();
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 transition"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Add to Cart
                </button>

                <button
                  type="button"
                  onClick={handleBuyNow}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold text-white transition ${
                    isExternal
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isExternal ? (
                    <>
                      Visit Merchant
                      <ExternalLink className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      Buy Now
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleWishlist(product)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition ${
                      wishlisted
                        ? 'border-rose-300 bg-rose-50 text-rose-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
                    {wishlisted ? 'Wishlisted' : 'Wishlist'}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleCompare(product)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition ${
                      compared
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Scale className="w-3.5 h-3.5" />
                    {compared ? 'Comparing' : 'Compare'}
                  </button>
                </div>

                <Link
                  href={`/products/${encodeURIComponent(product.id)}`}
                  onClick={closeQuickView}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                >
                  Full Details
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
