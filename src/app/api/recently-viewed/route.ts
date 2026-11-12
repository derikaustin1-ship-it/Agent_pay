// src/app/api/recently-viewed/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  clearRecentlyViewed,
  getProductById,
  getRecentlyViewed,
  recordRecentlyViewed,
} from '@/lib/database';
import { attachGuestCookieIfNeeded, getShoppingOwnerId } from '@/lib/auth';
import { mapDbProductToProduct } from '@/lib/products';
import { Product } from '@/types';

export const dynamic = 'force-dynamic';

function buildRecentlyViewedProducts(ownerId: string): Product[] {
  const rows = getRecentlyViewed(ownerId, 12);
  const products: Product[] = [];
  for (const r of rows) {
    const dbProd = getProductById(r.product_id);
    if (dbProd) {
      products.push(mapDbProductToProduct(dbProd));
    }
  }
  return products;
}

export async function GET() {
  try {
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    const products = buildRecentlyViewedProducts(ownerId);
    const res = NextResponse.json({ success: true, data: products });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Recently viewed GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load recently viewed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId } = body as { productId?: string };
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const dbProd = getProductById(productId);
    if (!dbProd) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    recordRecentlyViewed(ownerId, productId);
    const products = buildRecentlyViewedProducts(ownerId);

    const res = NextResponse.json({ success: true, data: products });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Recently viewed POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to record view' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    clearRecentlyViewed(ownerId);
    const res = NextResponse.json({ success: true, data: [] });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Recently viewed DELETE error:', error);
    return NextResponse.json({ success: false, error: 'Failed to clear history' }, { status: 500 });
  }
}
