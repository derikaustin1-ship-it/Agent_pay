// src/lib/channel3.ts
// Official Channel3 Product Search API integration
// Server-side only: CHANNEL3_API_KEY is read securely from environment variables

import { Product } from '@/types';
import { convertAmountWithRates } from './exchange-rates';

const CHANNEL3_API_URL = 'https://api.trychannel3.com/v1/search';
const CHANNEL3_API_KEY = process.env.CHANNEL3_API_KEY || '';

export function isChannel3Configured(): boolean {
  return Boolean(
    CHANNEL3_API_KEY &&
      !CHANNEL3_API_KEY.includes('your_channel3_api_key') &&
      CHANNEL3_API_KEY.trim().length > 5
  );
}

export interface Channel3RawProduct {
  id: string;
  title: string;
  description?: string;
  brands?: { id?: string; name?: string }[];
  category?: string | { id?: string; name?: string; title?: string; slug?: string };
  images?: {
    url?: string;
    cleaned_url?: string;
    is_main_image?: boolean;
    shot_type?: string;
    alt_text?: string;
  }[];
  key_features?: string[];
  offers?: {
    url?: string;
    domain?: string;
    price?: {
      price?: number;
      compare_at_price?: number | null;
      currency?: string;
    };
    availability?: string;
    condition?: string;
  }[];
  ratings?: {
    value?: number;
    count?: number;
    source_count?: number;
  };
}

export interface Channel3SearchResponse {
  products: Channel3RawProduct[];
}

function inferMerchantCountryFromOffer(domain?: string, currency?: string): string | undefined {
  const d = (domain || '').toLowerCase();
  if (d.endsWith('.in') || d.includes('.co.in')) return 'IN';
  if (d.endsWith('.co.uk') || d.endsWith('.uk')) return 'GB';
  if (d.endsWith('.de')) return 'DE';
  if (d.endsWith('.fr')) return 'FR';
  if (d.endsWith('.ca')) return 'CA';
  if (d.endsWith('.jp') || d.endsWith('.co.jp')) return 'JP';
  if (d.endsWith('.au') || d.endsWith('.com.au')) return 'AU';
  const cur = (currency || '').toUpperCase();
  if (cur === 'INR') return 'IN';
  if (cur === 'GBP') return 'GB';
  if (cur === 'JPY') return 'JP';
  if (cur === 'USD') return 'US';
  return undefined;
}

export async function searchChannel3Products(
  query: string,
  options?: {
    maxPrice?: number;
    maxPriceCurrency?: string;
    rates?: Record<string, number>;
    limit?: number;
  }
): Promise<Product[]> {
  if (!isChannel3Configured()) {
    throw new Error(
      'CHANNEL3_API_KEY is not configured in .env.local. Please provide a valid Channel3 API key.'
    );
  }

  const cleanQuery = query.trim();
  if (!cleanQuery) {
    return [];
  }

  try {
    const response = await fetch(CHANNEL3_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CHANNEL3_API_KEY.trim(),
      },
      body: JSON.stringify({
        query: cleanQuery,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Channel3 Authentication Failed (${response.status}): Invalid API key.`);
      }
      if (response.status === 429) {
        throw new Error('Channel3 API Rate Limit Exceeded. Please try again later.');
      }
      throw new Error(`Channel3 API Error (${response.status}): ${errorText}`);
    }

    const data: Channel3SearchResponse = await response.json();
    const rawProducts = data.products || [];

    const mapped: Product[] = rawProducts
      .map((p) => {
        const primaryOffer = p.offers?.[0];
        const price = Number(primaryOffer?.price?.price ?? 0);
        const compareAt = primaryOffer?.price?.compare_at_price;
        const compareAtPrice =
          typeof compareAt === 'number' && compareAt > price ? Number(compareAt) : undefined;
        const originalCurrency = (primaryOffer?.price?.currency || 'USD').toUpperCase();
        const brand = p.brands?.[0]?.name || 'Brand';
        const seller = primaryOffer?.domain || 'External Merchant';
        const productUrl = primaryOffer?.url || '#';
        const merchantCountry = inferMerchantCountryFromOffer(primaryOffer?.domain, originalCurrency);

        const allImages = (p.images || [])
          .map((img) => img.cleaned_url || img.url)
          .filter((u): u is string => Boolean(u && u.startsWith('http')));

        const mainImg = p.images?.find((img) => img.is_main_image) || p.images?.[0];
        const imageUrl =
          mainImg?.cleaned_url ||
          mainImg?.url ||
          allImages[0] ||
          'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80';

        const categoryStr =
          typeof p.category === 'string'
            ? p.category
            : p.category?.title || p.category?.name || p.category?.slug || 'general';

        return {
          id: `c3-${p.id}`,
          name: p.title || 'Untitled Product',
          brand,
          price,
          originalPrice: price,
          originalCurrency,
          compareAtPrice,
          currency: originalCurrency,
          merchantCountry,
          priceIsConverted: false,
          imageUrl,
          images: allImages.length > 0 ? allImages : [imageUrl],
          description: p.description || '',
          seller,
          productUrl,
          category: categoryStr,
          rating: p.ratings?.value ?? undefined,
          reviewCount: p.ratings?.count ?? undefined,
          availability: primaryOffer?.availability || undefined,
          features: Array.isArray(p.key_features) ? p.key_features : [],
          checkoutType: 'external' as const,
          createdAt: new Date().toISOString(),
          isDemo: false,
        };
      })
      .filter((p) => p.price > 0);

    const seenKeys = new Set<string>();
    const deduped = mapped.filter((p) => {
      const key = `${p.name.toLowerCase().trim()}|${p.seller.toLowerCase().trim()}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    if (typeof options?.maxPrice === 'number' && !isNaN(options.maxPrice) && options.maxPrice > 0) {
      const targetCurrency = (options.maxPriceCurrency || 'USD').toUpperCase();
      const ratesMap = options.rates || { USD: 1.0 };
      const getConvertedToTarget = (p: Product) =>
        convertAmountWithRates(p.originalPrice, p.originalCurrency, targetCurrency, ratesMap)
          .displayAmount;

      const withinBudget = deduped.filter((p) => getConvertedToTarget(p) <= options.maxPrice!);
      return options?.limit ? withinBudget.slice(0, options.limit) : withinBudget;
    }

    return options?.limit ? deduped.slice(0, options.limit) : deduped;
  } catch (error) {
    console.error('Channel3 API Search Error:', error);
    throw error;
  }
}
