'use client';

import React, { useEffect, useState } from 'react';
import { Product, CouponInfo } from '@/types';
import { useApp } from '@/context/AppContext';
import { StoreProductCard } from '@/components/StoreProductCard';
import { Tag, Copy, Check, Flame, ShieldCheck, Loader2 } from 'lucide-react';

export default function DealsPage() {
  const { formatPrice, applyCoupon, showToast } = useApp();
  const [deals, setDeals] = useState<Product[]>([]);
  const [coupons, setCoupons] = useState<CouponInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/deals');
        const json = await res.json();
        if (json.success && json.data) {
          setDeals(json.data.deals || []);
          setCoupons(json.data.coupons || []);
        }
      } catch (err) {
        console.error('Failed to load deals:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = Array.from(new Set(deals.map((d) => d.category)));
  const visibleDeals =
    selectedCategory === 'all'
      ? deals
      : deals.filter((d) => d.category === selectedCategory);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      // Fallback
    }
    const res = await applyCoupon(code);
    if (!res.ok) {
      showToast(`Code ${code} copied — minimum subtotal applies in cart.`, 'info');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">
      <div className="rounded-3xl bg-gradient-to-r from-rose-600 via-rose-700 to-indigo-800 p-8 text-white shadow-lg">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold uppercase tracking-wider">
          <Flame className="w-3.5 h-3.5 text-amber-300" />
          Verified Offers &amp; Price Drops
        </span>
        <h1 className="text-2xl sm:text-3xl font-black mt-3">
          Today&apos;s Deals &amp; Verified Promo Coupons
        </h1>
        <p className="text-sm text-rose-100 mt-1 max-w-2xl">
          Every discount shown here is calculated strictly from verified original catalog prices vs. current prices — zero fabricated markdowns.
        </p>
      </div>

      {/* Coupons Section */}
      {coupons.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Tag className="w-5 h-5 text-indigo-600" />
            Verified Checkout Coupons
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coupons.map((c) => (
              <div
                key={c.code}
                className="rounded-2xl border border-indigo-200 bg-white p-5 flex items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-indigo-600 px-3 py-1 text-sm font-black text-white tracking-wider">
                      {c.code}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Active on AgentPay Checkout
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 pt-1">{c.description}</p>
                  <p className="text-xs text-slate-500">
                    Minimum order: {formatPrice(c.minOrderAmount)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(c.code)}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                >
                  {copiedCode === c.code ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copy &amp; Apply
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Deals Filter & Grid */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="text-lg font-extrabold text-slate-900">
            Discounted Products ({visibleDeals.length})
          </h2>
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
                selectedCategory === 'all'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              All Deals
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border capitalize transition ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                {cat.replace('-', ' & ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {visibleDeals.map((product) => (
              <StoreProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
