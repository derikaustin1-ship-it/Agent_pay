'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Product } from '@/types';
import { useApp } from '@/context/AppContext';
import {
  Heart,
  ShoppingCart,
  Eye,
  Scale,
  Star,
  ExternalLink,
  ShieldCheck,
  Check,
} from 'lucide-react';

interface StoreProductCardProps {
  product: Product;
  compact?: boolean;
}

export function StoreProductCard({ product, compact = false }: StoreProductCardProps) {
  const {
    formatPrice,
    addToCart,
    toggleWishlist,
    isInWishlist,
    toggleCompare,
    isInCompare,
    openQuickView,
  } = useApp();

  const [imgError, setImgError] = useState(false);
  const [adding, setAdding] = useState(false);

  const wishlisted = isInWishlist(product.id);
  const compared = isInCompare(product.id);
  const isExternal = product.checkoutType === 'external';

  // Only show verified discount percentage when compareAtPrice > originalPrice exists in catalog data
  const origPrice = product.originalPrice ?? product.price;
  const origCurrency = product.originalCurrency || product.currency || 'USD';
  const discountPct =
    typeof product.compareAtPrice === 'number' && product.compareAtPrice > origPrice
      ? Math.round(((product.compareAtPrice - origPrice) / product.compareAtPrice) * 100)
      : 0;

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setAdding(true);
    try {
      await addToCart(product, 1, true);
    } finally {
      setAdding(false);
    }
  };

  const handleWishlist = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleWishlist(product);
  };

  const handleCompare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleCompare(product);
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openQuickView(product);
  };

  return (
    <div className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-sm hover:shadow-lg hover:border-indigo-200 transition-all duration-200">
      {/* Image Area */}
      <Link
        href={`/products/${encodeURIComponent(product.id)}`}
        className={`relative block bg-slate-50 overflow-hidden ${compact ? 'h-40' : 'h-52'}`}
      >
        {!imgError && product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            onError={() => setImgError(true)}
            className="h-full w-full object-contain p-4 group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-slate-400 text-xs p-4 text-center">
            <span className="font-semibold text-slate-500">{product.brand}</span>
            <span className="mt-1 line-clamp-2">{product.name}</span>
          </div>
        )}

        {/* Top Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1.5">
          {discountPct > 0 && (
            <span className="inline-flex items-center rounded-md bg-rose-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
              -{discountPct}%
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold shadow-sm ${
              isExternal
                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {isExternal ? (
              <>
                <ExternalLink className="w-2.5 h-2.5" />
                External
              </>
            ) : (
              <>
                <ShieldCheck className="w-2.5 h-2.5" />
                AgentPay
              </>
            )}
          </span>
        </div>

        {/* Action Icon Stack */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5">
          <button
            type="button"
            onClick={handleWishlist}
            title={wishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
            aria-label={wishlisted ? 'Remove from Wishlist' : 'Save to Wishlist'}
            className={`rounded-full p-2 shadow-sm border transition ${
              wishlisted
                ? 'bg-rose-500 border-rose-500 text-white'
                : 'bg-white/95 border-slate-200 text-slate-600 hover:text-rose-500 hover:border-rose-200'
            }`}
          >
            <Heart className={`w-3.5 h-3.5 ${wishlisted ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleQuickView}
            title="Quick View"
            aria-label="Quick View"
            className="rounded-full bg-white/95 border border-slate-200 p-2 text-slate-600 shadow-sm hover:text-indigo-600 hover:border-indigo-200 transition"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={handleCompare}
            title={compared ? 'In Comparison' : 'Compare Product'}
            aria-label={compared ? 'In Comparison' : 'Compare Product'}
            className={`rounded-full p-2 shadow-sm border transition ${
              compared
                ? 'bg-indigo-600 border-indigo-600 text-white'
                : 'bg-white/95 border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200'
            }`}
          >
            {compared ? <Check className="w-3.5 h-3.5" /> : <Scale className="w-3.5 h-3.5" />}
          </button>
        </div>
      </Link>

      {/* Details Area */}
      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
          <span className="font-semibold uppercase tracking-wide text-indigo-600 truncate">
            {product.brand || product.category}
          </span>
          <span className="truncate">{product.seller}</span>
        </div>

        <Link
          href={`/products/${encodeURIComponent(product.id)}`}
          className="mt-1 text-sm font-semibold text-slate-900 line-clamp-2 hover:text-indigo-600 transition min-h-[2.5rem]"
        >
          {product.name}
        </Link>

        {/* Genuine Rating Only */}
        <div className="mt-1.5 flex items-center gap-1.5 min-h-[1.25rem]">
          {typeof product.rating === 'number' && product.rating > 0 ? (
            <>
              <span className="inline-flex items-center gap-0.5 rounded bg-emerald-600 px-1.5 py-0.5 text-[11px] font-bold text-white">
                {product.rating.toFixed(1)}
                <Star className="w-2.5 h-2.5 fill-current" />
              </span>
              {typeof product.reviewCount === 'number' && product.reviewCount > 0 && (
                <span className="text-xs text-slate-500">
                  ({product.reviewCount.toLocaleString()})
                </span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-slate-400">No verified ratings yet</span>
          )}
        </div>

        {/* Price Row */}
        <div className="mt-2.5 flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-extrabold text-slate-900">
              {formatPrice(origPrice, false, origCurrency)}
            </span>
            {discountPct > 0 && product.compareAtPrice && (
              <span className="text-xs text-slate-400 line-through">
                {formatPrice(product.compareAtPrice, false, origCurrency)}
              </span>
            )}
          </div>
          {product.priceIsConverted && (
            <span className="text-[10px] text-slate-500">
              Est. from {origPrice.toLocaleString()} {origCurrency}
              {product.merchantCountry ? ` · ${product.merchantCountry}` : ''}
            </span>
          )}
        </div>

        {/* Availability only if provided */}
        {product.availability && (
          <p className="mt-1 text-[11px] text-slate-500 truncate">{product.availability}</p>
        )}

        {/* Primary CTA */}
        <div className="mt-auto pt-3 flex gap-2">
          {isExternal ? (
            <>
              <button
                type="button"
                disabled={adding}
                onClick={handleAddToCart}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Save Cart
              </button>
              <a
                href={product.productUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition"
              >
                Merchant
                <ExternalLink className="w-3 h-3" />
              </a>
            </>
          ) : (
            <button
              type="button"
              disabled={adding}
              onClick={handleAddToCart}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 transition"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {adding ? 'Adding...' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
