// src/lib/products.ts
// Product search, catalog filtering/sorting, and trust analysis service
// Integrates with official Channel3 Product Search API when configured,
// and enriches/caches products in the database for detail pages, cart, and checkout.

import {
  getAllProducts as dbGetAllProducts,
  searchProducts as dbSearchProducts,
  getProductById as dbGetProductById,
  upsertProducts as dbUpsertProducts,
  DbProduct,
} from './database';
import { isChannel3Configured, searchChannel3Products } from './channel3';
import {
  convertAmountWithRates,
  ExchangeRatesData,
  formatCurrency,
  getExchangeRates,
} from './exchange-rates';
import { ResolvedLocalePreferences } from './preferences';
import { Product, ProductSearchParams, TrustWarning } from '@/types';

/**
 * Map a database product record to the public Product interface.
 */
export function mapDbProductToProduct(row: DbProduct): Product {
  let parsedFeatures: string[] = [];
  let parsedImages: string[] | undefined;
  let parsedSpecs: Record<string, string> | undefined;

  try {
    parsedFeatures = row.features ? JSON.parse(row.features) : [];
  } catch {
    parsedFeatures = [];
  }
  try {
    parsedImages = row.images ? JSON.parse(row.images) : undefined;
  } catch {
    parsedImages = undefined;
  }
  try {
    parsedSpecs = row.specs ? JSON.parse(row.specs) : undefined;
  } catch {
    parsedSpecs = undefined;
  }

  const imageUrl =
    row.image_url ||
    'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80';

  const originalCurrency = (row.currency || 'USD').toUpperCase();
  const numericPrice = Number(row.price);
  const compareAtPrice =
    row.original_price && Number(row.original_price) > numericPrice
      ? Number(row.original_price)
      : undefined;

  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    price: numericPrice,
    originalPrice: numericPrice,
    originalCurrency,
    compareAtPrice,
    currency: originalCurrency,
    merchantCountry:
      row.merchant_country ||
      (row.is_demo === 1
        ? originalCurrency === 'INR'
          ? 'IN'
          : originalCurrency === 'GBP'
          ? 'GB'
          : 'US'
        : undefined),
    priceIsConverted: false,
    imageUrl,
    images: parsedImages && parsedImages.length > 0 ? parsedImages : [imageUrl],
    description: row.description || '',
    seller: row.seller || 'AgentPay Merchant',
    productUrl: row.product_url || '#',
    category: row.category || 'general',
    rating: row.rating ?? undefined,
    reviewCount: row.review_count ?? undefined,
    availability: row.availability || undefined,
    features: parsedFeatures,
    specs: parsedSpecs,
    checkoutType: row.checkout_type || (row.is_demo === 1 ? 'agentpay' : 'external'),
    createdAt: row.created_at,
    isDemo: row.is_demo === 1,
  };
}

/**
 * Convert a Product into DbProduct for caching.
 */
export function mapProductToDbProduct(p: Product): DbProduct {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    price: p.originalPrice ?? p.price,
    original_price: p.compareAtPrice ?? null,
    currency: (p.originalCurrency || p.currency || 'USD').toUpperCase(),
    merchant_country: p.merchantCountry,
    image_url: p.imageUrl,
    images: p.images ? JSON.stringify(p.images) : undefined,
    description: p.description,
    seller: p.seller,
    product_url: p.productUrl,
    category: p.category,
    rating: p.rating ?? null,
    review_count: p.reviewCount ?? null,
    availability: p.availability || 'InStock',
    features: JSON.stringify(p.features || []),
    specs: p.specs ? JSON.stringify(p.specs) : undefined,
    checkout_type: p.checkoutType || (p.isDemo ? 'agentpay' : 'external'),
    created_at: p.createdAt || new Date().toISOString(),
    is_demo: p.isDemo ? 1 : 0,
  };
}

/**
 * Attach display currency metadata to a product without mutating originalPrice / originalCurrency.
 */
export function enrichProductForPreferences(
  product: Product,
  targetCurrency: string,
  ratesData: ExchangeRatesData
): Product {
  const fromCurrency = (product.originalCurrency || product.currency || 'USD').toUpperCase();
  const toCurrency = (targetCurrency || 'USD').toUpperCase();
  const origPrice = typeof product.originalPrice === 'number' ? product.originalPrice : product.price;

  const converted = convertAmountWithRates(origPrice, fromCurrency, toCurrency, ratesData.rates);
  const convertedCompareAt =
    typeof product.compareAtPrice === 'number' && product.compareAtPrice > origPrice
      ? convertAmountWithRates(product.compareAtPrice, fromCurrency, toCurrency, ratesData.rates)
          .displayAmount
      : undefined;

  return {
    ...product,
    price: origPrice,
    originalPrice: origPrice,
    originalCurrency: fromCurrency,
    currency: fromCurrency,
    displayPrice: converted.displayAmount,
    displayCurrency: toCurrency,
    displayCompareAtPrice: convertedCompareAt,
    exchangeRate: converted.rate,
    exchangeRateTimestamp: ratesData.timestamp,
    priceIsConverted: converted.isConverted,
  };
}

/**
 * Compute country-aware discovery boost score without falsely labeling foreign listings as domestic.
 */
export function getCountryMatchScore(product: Product, countryCode?: string, currencyCode?: string): number {
  const cCode = (countryCode || '').toUpperCase();
  const curCode = (currencyCode || '').toUpperCase();
  let score = 0;
  if (cCode && product.merchantCountry?.toUpperCase() === cCode) score += 3;
  if (curCode && product.originalCurrency?.toUpperCase() === curCode) score += 2;
  if (product.checkoutType === 'agentpay') score += 1;
  return score;
}

/**
 * Search the product catalogue (Channel3 live API + local AgentPay catalog).
 */
export async function searchProductCatalogue(
  params: ProductSearchParams & {
    budgetCurrency?: string;
    countryCode?: string;
    currencyCode?: string;
    ratesData?: ExchangeRatesData;
  }
): Promise<Product[]> {
  const queryStr = params.query?.trim() || '';
  const searchTerms =
    queryStr || [params.category, ...(params.preferences || [])].filter(Boolean).join(' ');

  const ratesData = params.ratesData || (await getExchangeRates());
  const targetCurrency = (params.currencyCode || params.budgetCurrency || 'USD').toUpperCase();
  const filterCurrency = (params.budgetCurrency || targetCurrency).toUpperCase();

  let liveResults: Product[] = [];

  // 1. If Channel3 is configured and search terms exist, query live retailers
  if (isChannel3Configured() && searchTerms.trim() && params.checkoutType !== 'agentpay') {
    try {
      liveResults = await searchChannel3Products(searchTerms, {
        maxPrice: params.maxPrice,
        maxPriceCurrency: filterCurrency,
        rates: ratesData.rates,
      });

      if (liveResults.length > 0) {
        dbUpsertProducts(liveResults.map(mapProductToDbProduct));
      }
    } catch (c3Error) {
      console.warn('Channel3 search failed, falling back to local catalogue:', c3Error);
    }
  }

  // 2. Query local catalog (currency-normalized price filtering happens below!)
  const localRows = dbSearchProducts(searchTerms, params.category);
  const localProducts = localRows.map(mapDbProductToProduct);

  // Combine without duplicates, giving country-matching local products fair inclusion alongside live hits
  const combinedMap = new Map<string, Product>();
  for (const lp of localProducts) {
    combinedMap.set(lp.id, lp);
  }
  for (const lr of liveResults) {
    combinedMap.set(lr.id, lr);
  }

  let results = Array.from(combinedMap.values()).map((p) =>
    enrichProductForPreferences(p, targetCurrency, ratesData)
  );

  // Apply granular currency-aware filters
  results = applyCatalogFilters(results, params, filterCurrency, ratesData.rates);

  if (params.sort && params.sort !== 'relevance') {
    results = applyCatalogSort(results, params.sort);
  } else if (params.countryCode || params.currencyCode) {
    results = results.sort(
      (a, b) =>
        getCountryMatchScore(b, params.countryCode, params.currencyCode) -
        getCountryMatchScore(a, params.countryCode, params.currencyCode)
    );
  }

  return results;
}

/**
 * Query full catalog with pagination, facets (available brands, categories, price range), and sorting.
 */
export async function queryCatalog(
  params: ProductSearchParams & {
    localePreferences?: ResolvedLocalePreferences;
    countryCode?: string;
    currencyCode?: string;
  }
): Promise<{
  items: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  facets: {
    categories: string[];
    brands: string[];
    hasRatings: boolean;
    minCatalogPrice: number;
    maxCatalogPrice: number;
  };
  source: 'channel3_live_api' | 'hybrid_catalogue' | 'demo_catalogue';
}> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(48, params.limit || 12));
  const ratesData = await getExchangeRates();
  const displayCurrency = (
    params.localePreferences?.currencyCode ||
    params.currencyCode ||
    'USD'
  ).toUpperCase();
  const countryCode = params.localePreferences?.countryCode || params.countryCode;

  let pool: Product[] = [];
  let hasLive = false;

  const queryStr = params.query?.trim() || '';
  const searchTerms = queryStr || (params.category && params.category !== 'all' ? params.category : '');

  if (searchTerms && isChannel3Configured() && params.checkoutType !== 'agentpay') {
    try {
      const c3 = await searchChannel3Products(searchTerms);
      if (c3.length > 0) {
        hasLive = true;
        dbUpsertProducts(c3.map(mapProductToDbProduct));
      }
    } catch (err) {
      console.warn('Channel3 catalog query failed, using cached/local catalog:', err);
    }
  }

  const allDbProducts = dbGetAllProducts()
    .map(mapDbProductToProduct)
    .map((p) => enrichProductForPreferences(p, displayCurrency, ratesData));

  if (queryStr) {
    const q = queryStr.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length > 2);
    pool = allDbProducts.filter((p) => {
      const haystack = `${p.name} ${p.description} ${p.brand} ${p.category} ${(p.features || []).join(' ')}`.toLowerCase();
      return haystack.includes(q) || words.some((w) => haystack.includes(w));
    });
  } else {
    pool = allDbProducts;
  }

  // Facets computed before narrow filters (prices expressed cleanly in active displayCurrency)
  const categories = Array.from(new Set(allDbProducts.map((p) => p.category).filter(Boolean))).sort();
  const brands = Array.from(new Set(pool.map((p) => p.brand).filter(Boolean))).sort();
  const hasRatings = pool.some((p) => typeof p.rating === 'number' && p.rating > 0);
  const prices = pool.map((p) => p.displayPrice ?? p.price);
  const minCatalogPrice = prices.length > 0 ? Math.floor(Math.min(...prices)) : 0;
  const maxCatalogPrice = prices.length > 0 ? Math.ceil(Math.max(...prices)) : 1000;

  // Apply category, brand, price, rating, checkoutType filters using active displayCurrency
  let filtered = applyCatalogFilters(pool, params, displayCurrency, ratesData.rates);
  if (params.sort && params.sort !== 'relevance') {
    filtered = applyCatalogSort(filtered, params.sort);
  } else if (countryCode || displayCurrency) {
    filtered = [...filtered].sort(
      (a, b) =>
        getCountryMatchScore(b, countryCode, displayCurrency) -
        getCountryMatchScore(a, countryCode, displayCurrency)
    );
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const offset = (page - 1) * limit;
  const items = filtered.slice(offset, offset + limit);

  const hasAgentPay = items.some((p) => p.checkoutType === 'agentpay');
  const hasExternal = items.some((p) => p.checkoutType === 'external') || hasLive;
  const source =
    hasLive && hasAgentPay
      ? 'hybrid_catalogue'
      : hasExternal
      ? 'channel3_live_api'
      : 'demo_catalogue';

  return {
    items,
    total,
    page,
    limit,
    totalPages,
    facets: {
      categories,
      brands,
      hasRatings,
      minCatalogPrice,
      maxCatalogPrice,
    },
    source,
  };
}

function applyCatalogFilters(
  products: Product[],
  params: ProductSearchParams,
  filterCurrency: string = 'USD',
  rates?: Record<string, number>
): Product[] {
  return products.filter((p) => {
    if (params.category && params.category !== 'all') {
      const cat = params.category.toLowerCase();
      const pCat = p.category.toLowerCase();
      if (cat === 'home' || cat === 'home-kitchen') {
        if (!pCat.includes('home') && !pCat.includes('kitchen')) return false;
      } else if (!pCat.includes(cat)) {
        return false;
      }
    }

    if (params.brands && params.brands.length > 0) {
      const allowedBrands = new Set(params.brands.map((b) => b.toLowerCase()));
      if (!allowedBrands.has(p.brand.toLowerCase())) return false;
    }

    const comparablePrice = rates
      ? convertAmountWithRates(p.originalPrice, p.originalCurrency, filterCurrency, rates).displayAmount
      : p.displayPrice ?? p.price;

    if (typeof params.minPrice === 'number' && !isNaN(params.minPrice) && comparablePrice < params.minPrice) {
      return false;
    }

    if (typeof params.maxPrice === 'number' && !isNaN(params.maxPrice) && comparablePrice > params.maxPrice) {
      return false;
    }

    if (typeof params.minRating === 'number' && !isNaN(params.minRating)) {
      if (!p.rating || p.rating < params.minRating) return false;
    }

    if (params.checkoutType && params.checkoutType !== 'all') {
      if (p.checkoutType !== params.checkoutType) return false;
    }

    return true;
  });
}

function applyCatalogSort(products: Product[], sort?: ProductSearchParams['sort']): Product[] {
  const arr = [...products];
  switch (sort) {
    case 'price_asc':
      return arr.sort((a, b) => (a.displayPrice ?? a.price) - (b.displayPrice ?? b.price));
    case 'price_desc':
      return arr.sort((a, b) => (b.displayPrice ?? b.price) - (a.displayPrice ?? a.price));
    case 'rating_desc':
      return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    case 'popularity':
      return arr.sort((a, b) => (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    case 'newest':
      return arr.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    default:
      return arr;
  }
}

/**
 * Get a single product by ID.
 */
export async function getProduct(
  productId: string,
  targetCurrency?: string
): Promise<Product | null> {
  const row = dbGetProductById(productId);
  if (!row) return null;
  const mapped = mapDbProductToProduct(row);
  if (!targetCurrency) return mapped;
  const ratesData = await getExchangeRates();
  return enrichProductForPreferences(mapped, targetCurrency, ratesData);
}

/**
 * Get similar products in the same category (excluding current product).
 */
export function getSimilarProducts(product: Product, limit: number = 4): Product[] {
  const all = dbGetAllProducts().map(mapDbProductToProduct);
  return all
    .filter(
      (p) =>
        p.id !== product.id &&
        (p.category.toLowerCase() === product.category.toLowerCase() ||
          p.brand.toLowerCase() === product.brand.toLowerCase())
    )
    .slice(0, limit);
}

/**
 * Analyze a product for trust signals and price warnings across currencies cleanly.
 */
export function analyzeProductTrust(product: Product, similarProducts?: Product[]): TrustWarning[] {
  const warnings: TrustWarning[] = [];

  if (!product.seller || product.seller.trim() === '' || product.seller.toLowerCase() === 'unknown') {
    warnings.push({
      type: 'missing_seller',
      severity: 'medium',
      message: 'Seller information is not specified.',
      details: 'Consider checking seller credibility before purchasing items from unverified sources.',
    });
  }

  if (!product.description || product.description.trim().length < 25) {
    warnings.push({
      type: 'missing_description',
      severity: 'low',
      message: 'Brief product description.',
      details: 'Product details are limited. Confirm specifications match your requirements.',
    });
  }

  if (!product.rating && !product.reviewCount) {
    warnings.push({
      type: 'incomplete_details',
      severity: 'low',
      message: 'No user reviews recorded yet.',
      details: 'This item has no recorded ratings. Consider checking return policies.',
    });
  }

  if (similarProducts && similarProducts.length > 1) {
    const comparePrices = similarProducts.map((p) => p.displayPrice ?? p.price);
    const subjectPrice = product.displayPrice ?? product.price;
    const compareCurrency = product.displayCurrency || product.originalCurrency || 'USD';
    const avgPrice = comparePrices.reduce((sum, p) => sum + p, 0) / comparePrices.length;
    const priceDiff = avgPrice > 0 ? Math.abs(subjectPrice - avgPrice) / avgPrice : 0;

    if (priceDiff > 0.45) {
      warnings.push({
        type: 'price_anomaly',
        severity: 'medium',
        message: 'Price difference detected.',
        details: `This item's price (${formatCurrency(subjectPrice, compareCurrency)}) differs significantly from comparable items (avg: ${formatCurrency(avgPrice, compareCurrency)}). Consider checking seller and product details.`,
      });
    }
  }

  return warnings;
}
