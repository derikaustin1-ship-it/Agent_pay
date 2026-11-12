'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { Product, TrustWarning } from '@/types';
import { useApp } from '@/context/AppContext';
import { StoreProductCard } from '@/components/StoreProductCard';
import {
  ShoppingCart,
  Heart,
  Scale,
  Star,
  ShieldCheck,
  AlertTriangle,
  ExternalLink,
  Sparkles,
  Zap,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Truck,
} from 'lucide-react';

interface ProductSummaryData {
  headline: string;
  keyHighlights: string[];
  bestSuitedFor: string;
  thingsToVerify: string[];
  source: string;
}

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const decodedId = decodeURIComponent(id);

  const {
    formatPrice,
    addToCart,
    toggleWishlist,
    isInWishlist,
    toggleCompare,
    isInCompare,
    proceedToCheckout,
    recordRecentlyViewed,
    state,
  } = useApp();

  const [product, setProduct] = useState<Product | null>(null);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [trustWarnings, setTrustWarnings] = useState<TrustWarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const [summary, setSummary] = useState<ProductSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setActiveImage(0);
      setSummary(null);
      try {
        const res = await fetch(`/api/products/${encodeURIComponent(decodedId)}`);
        const json = await res.json();
        if (json.success && json.data?.product) {
          setProduct(json.data.product);
          setSimilarProducts(json.data.similarProducts || []);
          setTrustWarnings(json.data.trustWarnings || []);
          recordRecentlyViewed(json.data.product);
        } else {
          setProduct(null);
        }
      } catch (err) {
        console.error('Failed to fetch product detail:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [decodedId, recordRecentlyViewed]);

  const handleLoadSummary = async () => {
    if (!product || summaryLoading) return;
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/products/${encodeURIComponent(product.id)}/summary`);
      const json = await res.json();
      if (json.success && json.data) {
        setSummary(json.data);
      }
    } catch (err) {
      console.error('Failed to generate summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 flex flex-col items-center justify-center text-slate-500">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
        <p className="text-sm font-medium">Loading product details...</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold text-slate-900">Product Not Found</h1>
        <p className="text-sm text-slate-500">
          This listing may have expired from Channel3 cache or is no longer available.
        </p>
        <Link
          href="/catalog"
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          Back to Catalogue
        </Link>
      </div>
    );
  }

  const gallery =
    product.images && product.images.length > 0 ? product.images : [product.imageUrl];
  const isExternal = product.checkoutType === 'external';
  const wishlisted = isInWishlist(product.id);
  const compared = isInCompare(product.id);
  const origPrice = product.originalPrice ?? product.price;
  const origCurrency = product.originalCurrency || product.currency || 'USD';
  const discountPct =
    typeof product.compareAtPrice === 'number' && product.compareAtPrice > origPrice
      ? Math.round(((product.compareAtPrice - origPrice) / product.compareAtPrice) * 100)
      : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
        <Link href="/" className="hover:text-slate-900">
          Home
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <Link
          href={`/catalog?category=${encodeURIComponent(product.category)}`}
          className="capitalize hover:text-slate-900"
        >
          {product.category.replace('-', ' & ')}
        </Link>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-800 font-medium truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left: Image Gallery */}
        <div className="lg:col-span-5 space-y-3">
          <div className="rounded-3xl border border-slate-200 bg-white p-8 flex items-center justify-center h-[380px] sm:h-[440px]">
            <img
              src={gallery[activeImage] || product.imageUrl}
              alt={product.name}
              className="max-h-full max-w-full object-contain"
            />
          </div>

          {gallery.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {gallery.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(idx)}
                  className={`h-16 w-16 rounded-xl border p-1 bg-white shrink-0 transition ${
                    activeImage === idx
                      ? 'border-indigo-600 ring-2 ring-indigo-600/20'
                      : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <img
                    src={imgUrl}
                    alt={`${product.name} thumbnail ${idx + 1}`}
                    className="h-full w-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Center/Right: Details & Purchase Box */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 space-y-5 shadow-xs">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-600">
                {product.brand}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${
                  isExternal
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}
              >
                {isExternal ? (
                  <>
                    <ExternalLink className="w-3.5 h-3.5" />
                    External Merchant: {product.seller}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Verified AgentPay Checkout • {product.seller}
                  </>
                )}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight">
              {product.name}
            </h1>

            {/* Genuine Rating */}
            {typeof product.rating === 'number' && product.rating > 0 && (
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white">
                  {product.rating.toFixed(1)}
                  <Star className="w-3.5 h-3.5 fill-current" />
                </span>
                {typeof product.reviewCount === 'number' && product.reviewCount > 0 && (
                  <span className="text-xs text-slate-500">
                    {product.reviewCount.toLocaleString()} customer ratings
                  </span>
                )}
              </div>
            )}

            {/* Price & Verified Discount */}
            <div className="border-y border-slate-100 py-4 space-y-1.5">
              <div className="flex items-baseline gap-3 flex-wrap">
                <span className="text-3xl font-black text-slate-900">
                  {formatPrice(origPrice, true, origCurrency)}
                </span>
                {discountPct > 0 && product.compareAtPrice && (
                  <>
                    <span className="text-base text-slate-400 line-through">
                      {formatPrice(product.compareAtPrice, false, origCurrency)}
                    </span>
                    <span className="rounded-md bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">
                      Save {discountPct}%
                    </span>
                  </>
                )}
              </div>
              {product.priceIsConverted && (
                <p className="text-[11px] text-slate-500">
                  Estimated display currency ({product.displayCurrency}) converted from original merchant price{' '}
                  {origPrice.toLocaleString()} {origCurrency}
                  {product.merchantCountry ? ` • Merchant market: ${product.merchantCountry}` : ''}
                </p>
              )}

              {product.availability && (
                <p className="text-xs font-semibold text-emerald-700">{product.availability}</p>
              )}

              <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                <Truck className="w-3.5 h-3.5 text-slate-400" />
                Delivery location: <strong className="text-slate-700">{state.deliveryLocation.label}</strong>
              </p>
            </div>

            {/* Trust Advisories */}
            {trustWarnings.length > 0 && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 space-y-1.5">
                <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  Buyer Advisory Checks
                </p>
                {trustWarnings.map((w, idx) => (
                  <p key={idx} className="text-xs text-amber-800">
                    • <strong>{w.message}:</strong> {w.details}
                  </p>
                ))}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <p className="text-sm text-slate-700 leading-relaxed">{product.description}</p>
            )}

            {/* Quantity & CTA Buttons */}
            <div className="space-y-3 pt-2">
              {!isExternal && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-slate-700">Quantity:</label>
                  <select
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-900"
                  >
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => addToCart(product, quantity, true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white py-3 px-4 text-sm font-bold text-slate-900 hover:bg-slate-50 transition"
                >
                  <ShoppingCart className="w-4 h-4" />
                  {isExternal ? 'Save to Cart' : 'Add to Cart'}
                </button>

                {isExternal ? (
                  <a
                    href={product.productUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => {
                      fetch('/api/orders', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ productId: product.id, logOrder: true }),
                      }).catch(() => {});
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 py-3 px-4 text-sm font-bold text-white hover:bg-amber-600 transition"
                  >
                    Buy on {product.seller}
                    <ExternalLink className="w-4 h-4" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      proceedToCheckout({
                        product,
                        matchScore: 95,
                        reasoning: 'Selected from Product Detail Page',
                        advantages: product.features || [],
                        limitations: [],
                        trustWarnings,
                      })
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 px-4 text-sm font-bold text-white hover:bg-indigo-700 transition shadow-md"
                  >
                    <Zap className="w-4 h-4" />
                    Buy Now with PayPal Guard
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => toggleWishlist(product)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    wishlisted
                      ? 'border-rose-300 bg-rose-50 text-rose-700'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
                  {wishlisted ? 'Saved in Wishlist' : 'Add to Wishlist'}
                </button>

                <button
                  type="button"
                  onClick={() => toggleCompare(product)}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                    compared
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Scale className="w-4 h-4" />
                  {compared ? 'Added to Compare' : 'Compare Product'}
                </button>
              </div>
            </div>
          </div>

          {/* AI-Generated Product Summary Card */}
          <div className="rounded-3xl border border-indigo-200 bg-gradient-to-br from-indigo-50/60 to-white p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  AI Product Summary
                </h2>
                <p className="text-xs text-slate-500">
                  Generated strictly from verified listing attributes — zero invented specs.
                </p>
              </div>
              {!summary && (
                <button
                  type="button"
                  onClick={handleLoadSummary}
                  disabled={summaryLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {summaryLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Generate AI Summary
                    </>
                  )}
                </button>
              )}
            </div>

            {summary && (
              <div className="space-y-3 text-xs text-slate-700 border-t border-indigo-100 pt-3">
                <p className="text-sm font-semibold text-slate-900">{summary.headline}</p>
                {summary.keyHighlights.length > 0 && (
                  <ul className="space-y-1">
                    {summary.keyHighlights.map((h, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <p>
                  <strong className="text-slate-900">Best suited for:</strong> {summary.bestSuitedFor}
                </p>
                {summary.thingsToVerify.length > 0 && (
                  <div className="rounded-xl bg-white/80 border border-indigo-100 p-3 space-y-1">
                    <p className="font-semibold text-slate-800">Worth checking before purchase:</p>
                    {summary.thingsToVerify.map((v, i) => (
                      <p key={i} className="text-slate-600">
                        • {v}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Specifications Table */}
          {product.specs && Object.keys(product.specs).length > 0 && (
            <div className="rounded-3xl border border-slate-200 bg-white p-6 space-y-3">
              <h2 className="text-base font-bold text-slate-900">Technical Specifications</h2>
              <div className="divide-y divide-slate-100 text-xs">
                {Object.entries(product.specs).map(([key, val]) => (
                  <div key={key} className="grid grid-cols-3 py-2.5 gap-3">
                    <span className="font-semibold text-slate-500 capitalize">{key}</span>
                    <span className="col-span-2 text-slate-900 font-medium">{val}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Similar Products */}
      {similarProducts.length > 0 && (
        <section className="space-y-4 pt-4 border-t border-slate-200">
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
            Similar Products You Might Consider
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {similarProducts.map((item) => (
              <StoreProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
