// src/app/api/wishlist/route.ts
// Persistent wishlist API with duplicate prevention and saved-price tracking

import { NextRequest, NextResponse } from 'next/server';
import {
  addToWishlist,
  getProductById,
  getWishlistItems,
  removeFromWishlist,
} from '@/lib/database';
import { attachGuestCookieIfNeeded, getShoppingOwnerId } from '@/lib/auth';
import { enrichProductForPreferences, mapDbProductToProduct } from '@/lib/products';
import { ExchangeRatesData, getExchangeRates } from '@/lib/exchange-rates';
import { resolveServerPreferences } from '@/lib/preferences';
import { WishlistItem } from '@/types';

export const dynamic = 'force-dynamic';

function buildWishlistResponse(
  ownerId: string,
  targetCurrency: string,
  ratesData: ExchangeRatesData
): WishlistItem[] {
  const rows = getWishlistItems(ownerId);
  const result: WishlistItem[] = [];

  for (const row of rows) {
    const dbProduct = getProductById(row.product_id);
    if (!dbProduct) continue;
    const product = enrichProductForPreferences(
      mapDbProductToProduct(dbProduct),
      targetCurrency,
      ratesData
    );
    const currentCents = Math.round(product.originalPrice * 100);
    const savedCents = Math.round(row.saved_price * 100);
    const priceDropAmount = currentCents < savedCents ? (savedCents - currentCents) / 100 : 0;

    result.push({
      id: row.id,
      productId: product.id,
      product,
      savedPrice: row.saved_price,
      currency: row.currency || product.originalCurrency || 'USD',
      priceAlertEnabled: row.price_alert_enabled === 1,
      lastCheckedPrice: row.last_checked_price,
      lastCheckedAt: row.last_checked_at,
      priceDropped: priceDropAmount > 0,
      priceDropAmount,
      addedAt: row.added_at,
    });
  }
  return result;
}

export async function GET() {
  try {
    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    const items = buildWishlistResponse(ownerId, prefsResolved.currencyCode, ratesData);
    const res = NextResponse.json({ success: true, data: items });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Wishlist GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load wishlist' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, priceAlertEnabled = true } = body as {
      productId?: string;
      priceAlertEnabled?: boolean;
    };

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const dbProduct = getProductById(productId);
    if (!dbProduct) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    const { alreadyExists } = addToWishlist(ownerId, dbProduct, priceAlertEnabled);
    const items = buildWishlistResponse(ownerId, prefsResolved.currencyCode, ratesData);

    const res = NextResponse.json({
      success: true,
      alreadyExists,
      data: items,
    });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Wishlist POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save to wishlist' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    removeFromWishlist(ownerId, productId);
    const items = buildWishlistResponse(ownerId, prefsResolved.currencyCode, ratesData);

    const res = NextResponse.json({ success: true, data: items });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Wishlist DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove from wishlist' }, { status: 500 });
  }
}
