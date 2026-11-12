'use client';

import React, { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Product } from '@/types';
import { useApp } from '@/context/AppContext';
import { StoreProductCard } from '@/components/StoreProductCard';
import {
  Search,
  SlidersHorizontal,
  X,
  Sparkles,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface Facets {
  categories: string[];
  brands: string[];
  hasRatings?: boolean;
  minCatalogPrice?: number;
  maxCatalogPrice?: number;
}

function CatalogInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { state, openCopilot, formatPrice } = useApp();

  const urlQ = searchParams.get('q') || '';
  const urlCategory = searchParams.get('category') || 'all';
  const urlMaxPrice = searchParams.get('maxPrice') || '';
  const urlSort = searchParams.get('sort') || 'relevance';
  const urlPage = Number(searchParams.get('page') || 1);

  const [query, setQuery] = useState(urlQ);
  const [category, setCategory] = useState(urlCategory);
  const [selectedBrands, setSelectedBrands] = useState<string[]>(
    searchParams.get('brands')?.split(',').filter(Boolean) || []
  );
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(urlMaxPrice);
  const [minRating, setMinRating] = useState(searchParams.get('minRating') || '');
  const [checkoutType, setCheckoutType] = useState<'all' | 'agentpay' | 'external'>(
    (searchParams.get('checkoutType') as 'all' | 'agentpay' | 'external') || 'all'
  );
  const [sort, setSort] = useState(urlSort);
  const [page, setPage] = useState(urlPage);

  const [products, setProducts] = useState<Product[]>([]);
  const [facets, setFacets] = useState<Facets>({
    categories: [],
    brands: [],
    hasRatings: false,
    minCatalogPrice: 0,
    maxCatalogPrice: 1000,
  });
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [channel3Used, setChannel3Used] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [prevUrlKey, setPrevUrlKey] = useState(
    `${urlQ}|${urlCategory}|${urlMaxPrice}|${urlSort}|${urlPage}`
  );

  // Sync URL query params using React's supported adjust-state-during-render pattern
  const currentUrlKey = `${urlQ}|${urlCategory}|${urlMaxPrice}|${urlSort}|${urlPage}`;
  if (currentUrlKey !== prevUrlKey) {
    setPrevUrlKey(currentUrlKey);
    setQuery(urlQ);
    setCategory(urlCategory);
    setMaxPrice(urlMaxPrice);
    setSort(urlSort);
    setPage(urlPage);
  }

  const fetchCatalog = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set('q', query.trim());
      if (category && category !== 'all') params.set('category', category);
      if (selectedBrands.length > 0) params.set('brands', selectedBrands.join(','));
      if (minPrice) params.set('minPrice', minPrice);
      if (maxPrice) params.set('maxPrice', maxPrice);
      if (minRating) params.set('minRating', minRating);
      if (checkoutType !== 'all') params.set('checkoutType', checkoutType);
      if (sort) params.set('sort', sort);
      params.set('country', state.userPreferences.countryCode);
      params.set('currency', state.userPreferences.currencyCode);
      params.set('page', String(page));
      params.set('limit', '12');

      const res = await fetch(`/api/products/search?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setProducts(json.data || []);
        setFacets(
          json.facets || {
            categories: [],
            brands: [],
            hasRatings: false,
            minCatalogPrice: 0,
            maxCatalogPrice: 1000,
          }
        );
        setTotal(json.pagination?.total ?? 0);
        setTotalPages(json.pagination?.totalPages ?? 1);
        setChannel3Used(Boolean(json.meta?.channel3Included));
      }
    } catch (err) {
      console.error('Catalog load failed:', err);
    } finally {
      setLoading(false);
    }
  }, [
    query,
    category,
    selectedBrands,
    minPrice,
    maxPrice,
    minRating,
    checkoutType,
    sort,
    page,
    state.userPreferences.countryCode,
    state.userPreferences.currencyCode,
  ]);

  useEffect(() => {
    let active = true;
    (async () => {
      await Promise.resolve();
      if (!active) return;
      setLoading(true);
      await fetchCatalog();
    })();
    return () => {
      active = false;
    };
  }, [fetchCatalog]);

  const toggleBrand = (brand: string) => {
    setPage(1);
    setSelectedBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    );
  };

  const resetFilters = () => {
    setQuery('');
    setCategory('all');
    setSelectedBrands([]);
    setMinPrice('');
    setMaxPrice('');
    setMinRating('');
    setCheckoutType('all');
    setSort('relevance');
    setPage(1);
    router.push('/catalog');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Bar */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">Product Catalogue</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {total} {total === 1 ? 'result' : 'results'}
            {query ? ` for "${query}"` : ''}
            {category !== 'all' ? ` in ${category}` : ''}
            {channel3Used ? ' • Includes live Channel3 external merchant results' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              fetchCatalog();
            }}
            className="flex items-center rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5"
          >
            <Search className="w-4 h-4 text-slate-400 mr-2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Refine search..."
              className="bg-transparent text-xs text-slate-900 focus:outline-none w-40 sm:w-52"
            />
          </form>

          <select
            aria-label="Sort products"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 focus:outline-none focus:border-indigo-500"
          >
            <option value="relevance">Sort: Relevance</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="rating_desc">Customer Rating</option>
            <option value="popularity">Most Reviewed</option>
            <option value="newest">Newest Arrivals</option>
          </select>

          <button
            type="button"
            onClick={() => setMobileFiltersOpen((v) => !v)}
            className="lg:hidden inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Filter Sidebar */}
        <aside
          className={`lg:col-span-3 rounded-2xl border border-slate-200 bg-white p-5 space-y-5 shadow-xs ${
            mobileFiltersOpen ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
              Filters
            </h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs font-semibold text-indigo-600 hover:underline flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Checkout Eligibility */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Checkout Type
            </p>
            <div className="space-y-1.5 text-xs">
              {[
                { id: 'all', label: 'All Merchants' },
                { id: 'agentpay', label: 'AgentPay Checkout Only' },
                { id: 'external', label: 'External Merchant Sites' },
              ].map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="checkoutType"
                    checked={checkoutType === opt.id}
                    onChange={() => {
                      setCheckoutType(opt.id as 'all' | 'agentpay' | 'external');
                      setPage(1);
                    }}
                    className="text-indigo-600"
                  />
                  <span className="text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Budget Quick Filter */}
          {state.budget && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 space-y-2">
              <p className="text-xs font-bold text-emerald-900">Your Budget Guard</p>
              <button
                type="button"
                onClick={() => {
                  const convertedMax = Math.round(
                    state.budget!.maxPurchaseAmount *
                      ((state.exchangeRates.rates[state.userPreferences.currencyCode] || 1) /
                        (state.exchangeRates.rates[(state.budget!.currency || 'USD').toUpperCase()] || 1))
                  );
                  setMaxPrice(String(convertedMax));
                  setPage(1);
                }}
                className="w-full rounded-lg bg-emerald-600 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                Under {formatPrice(state.budget.maxPurchaseAmount, false, state.budget.currency || 'USD')}
              </button>
            </div>
          )}

          {/* Category */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Category
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto pr-1 text-xs">
              <button
                type="button"
                onClick={() => {
                  setCategory('all');
                  setPage(1);
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between ${
                  category === 'all'
                    ? 'bg-indigo-50 text-indigo-700 font-bold'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span>All Categories</span>
              </button>
              {facets.categories.map((catName) => {
                const label = typeof catName === 'string' ? catName : String(catName);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      setCategory(label);
                      setPage(1);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex justify-between capitalize ${
                      category.toLowerCase() === label.toLowerCase()
                        ? 'bg-indigo-50 text-indigo-700 font-bold'
                        : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span>{label.replace('-', ' & ')}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Price Range (USD base) */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Price Range (USD Base)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => {
                  setMinPrice(e.target.value);
                  setPage(1);
                }}
                placeholder="Min $"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => {
                  setMaxPrice(e.target.value);
                  setPage(1);
                }}
                placeholder="Max $"
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
          </div>

          {/* Rating Filter */}
          <div className="space-y-2 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Minimum Rating
            </p>
            <div className="space-y-1 text-xs">
              {[
                { val: '', label: 'Any Rating' },
                { val: '4.5', label: '4.5★ & up' },
                { val: '4', label: '4.0★ & up' },
                { val: '3.5', label: '3.5★ & up' },
              ].map((r) => (
                <label key={r.label} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="minRating"
                    checked={minRating === r.val}
                    onChange={() => {
                      setMinRating(r.val);
                      setPage(1);
                    }}
                  />
                  <span className="text-slate-700">{r.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Brands */}
          {facets.brands.length > 0 && (
            <div className="space-y-2 border-t border-slate-100 pt-4">
              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Brands
              </p>
              <div className="space-y-1 max-h-44 overflow-y-auto text-xs">
                {facets.brands.map((brandName) => {
                  const label = typeof brandName === 'string' ? brandName : String(brandName);
                  return (
                    <label key={label} className="flex items-center justify-between gap-2 cursor-pointer py-0.5">
                      <span className="flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={selectedBrands.includes(label)}
                          onChange={() => toggleBrand(label)}
                        />
                        <span className="truncate text-slate-700">{label}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Search Trigger */}
          <div className="rounded-xl bg-indigo-50 border border-indigo-200 p-3 space-y-2">
            <p className="text-xs font-bold text-indigo-900 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              Need tailored advice?
            </p>
            <button
              type="button"
              onClick={() =>
                openCopilot(
                  query
                    ? `Help me choose the best ${query}`
                    : 'Recommend top products within my budget'
                )
              }
              className="w-full rounded-lg bg-indigo-600 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Ask AI Co-Pilot
            </button>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mb-3" />
              <p className="text-sm font-medium">Searching AgentPay &amp; Channel3 catalogues...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center space-y-3">
              <p className="text-base font-bold text-slate-900">No matching products found</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Try broadening your price range or clearing category filters, or ask the AI Co-Pilot to discover alternatives via live search.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Clear All Filters
                </button>
                <button
                  type="button"
                  onClick={() => openCopilot(query || 'Show popular products under $100')}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                >
                  Ask AI Co-Pilot
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {products.map((product) => (
                  <StoreProductCard key={product.id} product={product} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-4">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </button>
                  <span className="text-xs font-semibold text-slate-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-sm text-slate-500">
          Loading catalogue...
        </div>
      }
    >
      <CatalogInner />
    </Suspense>
  );
}
