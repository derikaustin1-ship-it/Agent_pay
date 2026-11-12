// src/app/api/products/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  analyzeProductTrust,
  enrichProductForPreferences,
  getProduct,
  getSimilarProducts,
} from '@/lib/products';
import { getExchangeRates } from '@/lib/exchange-rates';
import { resolveServerPreferences } from '@/lib/preferences';
import { recordRecentlyViewed } from '@/lib/database';
import { attachGuestCookieIfNeeded, getShoppingOwnerId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const prefsResolved = await resolveServerPreferences(
      searchParams.get('country'),
      searchParams.get('currency')
    );
    const ratesData = await getExchangeRates();

    const product = await getProduct(decodeURIComponent(id), prefsResolved.currencyCode);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const similarProducts = getSimilarProducts(product, 4).map((p) =>
      enrichProductForPreferences(p, prefsResolved.currencyCode, ratesData)
    );
    const trustWarnings = analyzeProductTrust(product, similarProducts);

    // Record recently viewed server-side
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    recordRecentlyViewed(ownerId, product.id);

    const res = NextResponse.json({
      success: true,
      data: {
        product,
        similarProducts,
        trustWarnings,
      },
    });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Product detail GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load product' }, { status: 500 });
  }
}
