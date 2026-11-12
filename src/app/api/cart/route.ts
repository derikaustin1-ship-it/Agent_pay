// src/app/api/cart/route.ts
// Backend-validated shopping cart API (supports multi-product cart, coupon validation, and session persistence)

import { NextRequest, NextResponse } from 'next/server';
import {
  addToCart,
  clearCart,
  getProductById,
  removeFromCart,
  updateCartItemQuantity,
} from '@/lib/database';
import { attachGuestCookieIfNeeded, getShoppingOwnerId } from '@/lib/auth';
import { buildCartSummary } from '@/lib/cart';
import { getExchangeRates } from '@/lib/exchange-rates';
import { resolveServerPreferences } from '@/lib/preferences';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const couponCode = searchParams.get('coupon') || undefined;
    const prefsResolved = await resolveServerPreferences(
      searchParams.get('country'),
      searchParams.get('currency')
    );
    const ratesData = await getExchangeRates();
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    const { summary, couponError } = buildCartSummary(ownerId, couponCode, prefsResolved, ratesData);

    const res = NextResponse.json({
      success: true,
      data: summary,
      couponError,
    });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Cart GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load cart' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity = 1, couponCode } = body as {
      productId?: string;
      quantity?: number;
      couponCode?: string;
    };

    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found in catalogue' }, { status: 404 });
    }

    if (product.availability && product.availability.toLowerCase().includes('out of stock')) {
      return NextResponse.json({ success: false, error: 'Product is currently out of stock' }, { status: 400 });
    }

    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    addToCart(ownerId, productId, Number(quantity) || 1);

    const { summary } = buildCartSummary(ownerId, couponCode, prefsResolved, ratesData);
    const res = NextResponse.json({ success: true, data: summary });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Cart POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to add item to cart' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, quantity, couponCode } = body as {
      productId?: string;
      quantity?: number;
      couponCode?: string;
    };

    if (!productId || typeof quantity !== 'number') {
      return NextResponse.json(
        { success: false, error: 'Product ID and numeric quantity are required' },
        { status: 400 }
      );
    }

    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    updateCartItemQuantity(ownerId, productId, quantity);

    const { summary } = buildCartSummary(ownerId, couponCode, prefsResolved, ratesData);
    const res = NextResponse.json({ success: true, data: summary });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Cart PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update cart item' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get('productId');
    const clearAll = searchParams.get('clear') === 'true';

    const { ownerId, newGuestToken } = await getShoppingOwnerId();

    if (clearAll) {
      clearCart(ownerId);
    } else if (productId) {
      removeFromCart(ownerId, productId);
    } else {
      return NextResponse.json(
        { success: false, error: 'Specify productId or clear=true' },
        { status: 400 }
      );
    }

    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();
    const { summary } = buildCartSummary(ownerId, undefined, prefsResolved, ratesData);
    const res = NextResponse.json({ success: true, data: summary });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Cart DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to remove cart item' }, { status: 500 });
  }
}
