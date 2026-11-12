// src/app/api/deals/route.ts
import { NextResponse } from 'next/server';
import { getActiveCoupons, getAllProducts } from '@/lib/database';
import {
  enrichProductForPreferences,
  getCountryMatchScore,
  mapDbProductToProduct,
} from '@/lib/products';
import { getExchangeRates } from '@/lib/exchange-rates';
import { resolveServerPreferences } from '@/lib/preferences';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();
    const allProducts = getAllProducts()
      .map(mapDbProductToProduct)
      .map((p) => enrichProductForPreferences(p, prefsResolved.currencyCode, ratesData))
      .sort(
        (a, b) =>
          getCountryMatchScore(b, prefsResolved.countryCode, prefsResolved.currencyCode) -
          getCountryMatchScore(a, prefsResolved.countryCode, prefsResolved.currencyCode)
      );
    // Only include products that have a genuine compareAtPrice > originalPrice
    const dealProducts = allProducts.filter(
      (p) => typeof p.compareAtPrice === 'number' && p.compareAtPrice > p.originalPrice
    );

    const coupons = getActiveCoupons().map((c) => ({
      code: c.code,
      description: c.description,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      minOrderAmount: c.min_order_amount,
      maxDiscount: c.max_discount ?? undefined,
      active: c.active === 1,
      expiresAt: c.expires_at,
      eligibleScope: c.eligible_scope,
    }));

    return NextResponse.json({
      success: true,
      data: {
        deals: dealProducts,
        coupons,
      },
    });
  } catch (error) {
    console.error('Deals GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load deals' }, { status: 500 });
  }
}
