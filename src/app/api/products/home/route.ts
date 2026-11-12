// src/app/api/products/home/route.ts
// Curates real homepage sections from the database catalogue, user budget, preferences, and recently viewed

import { NextRequest, NextResponse } from 'next/server';
import {
  getActiveCoupons,
  getAllProducts,
  getProductById,
  getRecentlyViewed,
  getShoppingPreferences,
  getUserBudget,
} from '@/lib/database';
import { getShoppingOwnerId } from '@/lib/auth';
import {
  enrichProductForPreferences,
  getCountryMatchScore,
  mapDbProductToProduct,
} from '@/lib/products';
import { convertAmountWithRates, getExchangeRates } from '@/lib/exchange-rates';
import { resolveServerPreferences } from '@/lib/preferences';
import { Product } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefsResolved = await resolveServerPreferences(
      searchParams.get('country'),
      searchParams.get('currency')
    );
    const ratesData = await getExchangeRates();

    const { ownerId, isAuthenticated } = await getShoppingOwnerId();
    const allProductsRaw = getAllProducts().map(mapDbProductToProduct);
    const allProducts = allProductsRaw
      .map((p) => enrichProductForPreferences(p, prefsResolved.currencyCode, ratesData))
      .sort(
        (a, b) =>
          getCountryMatchScore(b, prefsResolved.countryCode, prefsResolved.currencyCode) -
          getCountryMatchScore(a, prefsResolved.countryCode, prefsResolved.currencyCode)
      );

    const budget = isAuthenticated ? getUserBudget(ownerId) : undefined;
    const rawBudgetAmount = budget?.max_purchase_amount ?? 150;
    const budgetCurrency = (budget?.currency || 'USD').toUpperCase();
    const maxBudgetInDisplay = convertAmountWithRates(
      rawBudgetAmount,
      budgetCurrency,
      prefsResolved.currencyCode,
      ratesData.rates
    ).displayAmount;

    // 1. Today's Deals (strictly products with genuine compareAtPrice > originalPrice)
    const todaysDeals = allProducts
      .filter((p) => typeof p.compareAtPrice === 'number' && p.compareAtPrice > p.originalPrice)
      .slice(0, 8);

    // 2. Trending Products (highest reviewCount when available, preserving market affinity)
    const trendingProducts = [...allProducts]
      .filter((p) => typeof p.reviewCount === 'number' && p.reviewCount > 0)
      .sort((a, b) => {
        const marketDiff =
          getCountryMatchScore(b, prefsResolved.countryCode, prefsResolved.currencyCode) -
          getCountryMatchScore(a, prefsResolved.countryCode, prefsResolved.currencyCode);
        if (marketDiff !== 0) return marketDiff;
        return (b.reviewCount ?? 0) - (a.reviewCount ?? 0);
      })
      .slice(0, 8);

    // 3. Best Deals Under Budget (compared in user's display/budget currency!)
    const underBudget = allProducts
      .filter((p) => (p.displayPrice ?? p.price) <= maxBudgetInDisplay)
      .sort((a, b) => {
        const marketDiff =
          getCountryMatchScore(b, prefsResolved.countryCode, prefsResolved.currencyCode) -
          getCountryMatchScore(a, prefsResolved.countryCode, prefsResolved.currencyCode);
        if (marketDiff !== 0) return marketDiff;
        return (b.rating ?? 0) - (a.rating ?? 0);
      })
      .slice(0, 8);

    // 4. Recommended For You (based on saved shopping preferences or highest rated)
    const shoppingPrefs = isAuthenticated ? getShoppingPreferences(ownerId) : null;
    let recommendedForYou: Product[] = [];
    if (
      shoppingPrefs &&
      (shoppingPrefs.preferredCategories.length > 0 || shoppingPrefs.preferredBrands.length > 0)
    ) {
      const catSet = new Set(shoppingPrefs.preferredCategories.map((c) => c.toLowerCase()));
      const brandSet = new Set(shoppingPrefs.preferredBrands.map((b) => b.toLowerCase()));
      recommendedForYou = allProducts
        .filter(
          (p) =>
            catSet.has(p.category.toLowerCase()) || brandSet.has(p.brand.toLowerCase())
        )
        .slice(0, 8);
    }
    if (recommendedForYou.length < 4) {
      recommendedForYou = [...allProducts]
        .sort((a, b) => {
          const marketDiff =
            getCountryMatchScore(b, prefsResolved.countryCode, prefsResolved.currencyCode) -
            getCountryMatchScore(a, prefsResolved.countryCode, prefsResolved.currencyCode);
          if (marketDiff !== 0) return marketDiff;
          return (b.rating ?? 0) - (a.rating ?? 0);
        })
        .slice(0, 8);
    }

    // 5. AI Recommended Picks (top-rated within budget with diverse categories)
    const seenCats = new Set<string>();
    const aiRecommended: Product[] = [];
    for (const p of [...allProducts].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))) {
      if ((p.displayPrice ?? p.price) <= maxBudgetInDisplay && !seenCats.has(p.category)) {
        seenCats.add(p.category);
        aiRecommended.push(p);
      }
      if (aiRecommended.length >= 6) break;
    }

    // 6. Featured Products
    const featuredProducts = allProducts.filter((p) => p.checkoutType === 'agentpay').slice(0, 8);

    // 7. New Arrivals (sorted by createdAt desc)
    const newArrivals = [...allProducts]
      .filter((p) => Boolean(p.createdAt))
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )
      .slice(0, 8);

    // 8. Recently Viewed
    const rvRows = getRecentlyViewed(ownerId, 8);
    const recentlyViewed: Product[] = [];
    for (const row of rvRows) {
      const dbProd = getProductById(row.product_id);
      if (dbProd) {
        recentlyViewed.push(
          enrichProductForPreferences(
            mapDbProductToProduct(dbProd),
            prefsResolved.currencyCode,
            ratesData
          )
        );
      }
    }

    // 9. Category Counts
    const categoryCounts: Record<string, number> = {};
    for (const p of allProducts) {
      const cat = p.category.toLowerCase();
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    }

    // 10. Verified Coupons
    const coupons = getActiveCoupons().map((c) => ({
      code: c.code,
      description: c.description,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      minOrderAmount: c.min_order_amount,
    }));

    return NextResponse.json({
      success: true,
      data: {
        maxBudget: rawBudgetAmount,
        budgetCurrency,
        maxBudgetInDisplay,
        displayCurrency: prefsResolved.currencyCode,
        countryCode: prefsResolved.countryCode,
        todaysDeals,
        trendingProducts,
        underBudget,
        recommendedForYou,
        aiRecommended,
        featuredProducts,
        newArrivals,
        recentlyViewed,
        categoryCounts,
        coupons,
      },
    });
  } catch (error) {
    console.error('Home products GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load homepage catalogue' },
      { status: 500 }
    );
  }
}
