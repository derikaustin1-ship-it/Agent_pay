'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import {
  Scale,
  Sparkles,
  ShoppingCart,
  Trash2,
  Star,
  ExternalLink,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface ComparisonAnalysis {
  winnerProductId: string | null;
  bestValueId: string | null;
  summary: string;
  tradeOffs: string[];
  source: string;
}

export default function ComparePage() {
  const { state, toggleCompare, clearCompare, addToCart, formatPrice } = useApp();
  const products = state.compareProducts;

  const [userGoal, setUserGoal] = useState('');
  const [analysis, setAnalysis] = useState<ComparisonAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const allSpecKeys = Array.from(
    new Set(products.flatMap((p) => Object.keys(p.specs || {})))
  );

  const handleAnalyze = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (products.length < 2) return;
    setAnalyzing(true);
    try {
      const res = await fetch('/api/compare/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productIds: products.map((p) => p.id),
          userGoal: userGoal.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setAnalysis(json.data);
      }
    } catch (err) {
      console.error('Comparison analyze error:', err);
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Scale className="w-6 h-6 text-indigo-600" />
            Compare Products ({products.length}/4)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Side-by-side matrix of verified prices, sellers, features, and specifications with AI Advisor.
          </p>
        </div>

        {products.length > 0 && (
          <button
            type="button"
            onClick={() => {
              clearCompare();
              setAnalysis(null);
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:text-rose-600"
          >
            Clear Comparison
          </button>
        )}
      </div>

      {products.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-14 text-center space-y-4">
          <Scale className="w-10 h-10 text-indigo-500 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">No products selected for comparison</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Click the scale icon on any product card in the catalogue or homepage to compare up to 4 items side by side.
          </p>
          <Link
            href="/catalog"
            className="inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            Browse Catalogue
          </Link>
        </div>
      ) : (
        <>
          {/* AI Comparison Box */}
          {products.length >= 2 && (
            <div className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white p-6 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    AI Comparison Verdict
                  </h2>
                  <p className="text-xs text-slate-500">
                    Tell Gemini your priority (optional), then compare based strictly on real specs.
                  </p>
                </div>

                <form onSubmit={handleAnalyze} className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={userGoal}
                    onChange={(e) => setUserGoal(e.target.value)}
                    placeholder="e.g. best battery for travel & coding"
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs w-64 focus:border-indigo-500 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={analyzing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {analyzing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Comparing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Analyze Differences
                      </>
                    )}
                  </button>
                </form>
              </div>

              {analysis && (
                <div className="rounded-xl border border-indigo-100 bg-white p-4 space-y-2 text-xs text-slate-700">
                  <p className="text-sm font-semibold text-slate-900">{analysis.summary}</p>
                  {analysis.tradeOffs.length > 0 && (
                    <ul className="space-y-1 pt-1">
                      {analysis.tradeOffs.map((t, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0 mt-0.5" />
                          <span>{t}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Side-by-Side Table */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left border-collapse min-w-[680px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70">
                  <th className="p-4 w-44 text-xs font-bold uppercase tracking-wider text-slate-500 align-top">
                    Attribute
                  </th>
                  {products.map((p) => {
                    const isWinner = analysis?.winnerProductId === p.id;
                    const isExternal = p.checkoutType === 'external';
                    return (
                      <th key={p.id} className="p-4 align-top min-w-[210px]">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            {isWinner ? (
                              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white">
                                AI Top Pick
                              </span>
                            ) : (
                              <span />
                            )}
                            <button
                              type="button"
                              onClick={() => toggleCompare(p)}
                              className="text-slate-400 hover:text-rose-600"
                              title="Remove from comparison"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <Link
                            href={`/products/${encodeURIComponent(p.id)}`}
                            className="block h-32 rounded-xl bg-slate-50 p-3 flex items-center justify-center"
                          >
                            <img
                              src={p.imageUrl}
                              alt={p.name}
                              className="max-h-full max-w-full object-contain"
                            />
                          </Link>

                          <Link
                            href={`/products/${encodeURIComponent(p.id)}`}
                            className="block text-sm font-bold text-slate-900 hover:text-indigo-600 line-clamp-2"
                          >
                            {p.name}
                          </Link>

                          {isExternal ? (
                            <a
                              href={p.productUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-amber-500 py-2 text-xs font-bold text-white hover:bg-amber-600"
                            >
                              Merchant Site <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={() => addToCart(p, 1, true)}
                              className="inline-flex w-full items-center justify-center gap-1 rounded-xl bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-700"
                            >
                              <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
                            </button>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                <tr>
                  <td className="p-4 font-bold text-slate-600">Price</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 font-black text-base text-slate-900">
                      {formatPrice(
                        p.originalPrice ?? p.price,
                        true,
                        p.originalCurrency || p.currency
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-bold text-slate-600">Brand</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 text-slate-800 font-medium">
                      {p.brand || '—'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-bold text-slate-600">Seller &amp; Checkout</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 text-slate-700">
                      {p.seller}{' '}
                      <span className="block text-[11px] text-slate-500">
                        {p.checkoutType === 'external' ? 'External Merchant' : 'AgentPay Checkout'}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-bold text-slate-600">Rating</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4">
                      {typeof p.rating === 'number' && p.rating > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 font-bold text-white">
                          {p.rating.toFixed(1)}
                          <Star className="w-3 h-3 fill-current" />
                        </span>
                      ) : (
                        <span className="text-slate-400">Not listed</span>
                      )}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-bold text-slate-600">Availability</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 text-slate-700">
                      {p.availability || 'Not specified'}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className="p-4 font-bold text-slate-600 align-top">Key Features</td>
                  {products.map((p) => (
                    <td key={p.id} className="p-4 align-top">
                      {p.features && p.features.length > 0 ? (
                        <ul className="space-y-1 text-slate-600">
                          {p.features.map((f, i) => (
                            <li key={i}>• {f}</li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                  ))}
                </tr>
                {allSpecKeys.map((specKey) => (
                  <tr key={specKey}>
                    <td className="p-4 font-bold text-slate-600 capitalize">{specKey}</td>
                    {products.map((p) => (
                      <td key={p.id} className="p-4 text-slate-700">
                        {p.specs?.[specKey] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
