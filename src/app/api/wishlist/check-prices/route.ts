// src/app/api/wishlist/check-prices/route.ts
// On-demand wishlist price re-verification against Channel3 (for external products) and local DB.
// Generates a persistent notification if a genuine price drop is detected.

import { NextResponse } from 'next/server';
import {
  createNotification,
  getProductById,
  getWishlistItems,
  updateWishlistCheckedPrice,
  upsertProducts,
} from '@/lib/database';
import { getShoppingOwnerId } from '@/lib/auth';
import { isChannel3Configured, searchChannel3Products } from '@/lib/channel3';
import { mapProductToDbProduct } from '@/lib/products';
import { formatCurrency, toMinorUnits } from '@/lib/exchange-rates';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const { ownerId, isAuthenticated } = await getShoppingOwnerId();
    const items = getWishlistItems(ownerId);
    const drops: Array<{ productId: string; productName: string; oldPrice: number; newPrice: number }> = [];

    for (const item of items) {
      const dbProduct = getProductById(item.product_id);
      if (!dbProduct) continue;

      let latestPrice = dbProduct.price;

      // For live Channel3 items, re-query Channel3 by exact product title when configured
      if (dbProduct.is_demo === 0 && isChannel3Configured()) {
        try {
          const fresh = await searchChannel3Products(dbProduct.name, { limit: 5 });
          const match = fresh.find((p) => p.id === dbProduct.id) || fresh[0];
          if (match && match.id === dbProduct.id) {
            latestPrice = match.price;
            upsertProducts([mapProductToDbProduct(match)]);
          }
        } catch {
          // keep current price if Channel3 fails
        }
      }

      updateWishlistCheckedPrice(ownerId, item.product_id, latestPrice);

      const itemCurrency = (dbProduct.currency || item.currency || 'USD').toUpperCase();
      const savedMinor = toMinorUnits(item.saved_price, itemCurrency);
      const latestMinor = toMinorUnits(latestPrice, itemCurrency);
      if (latestMinor < savedMinor) {
        drops.push({
          productId: dbProduct.id,
          productName: dbProduct.name,
          oldPrice: item.saved_price,
          newPrice: latestPrice,
        });

        if (isAuthenticated && item.price_alert_enabled === 1) {
          createNotification(ownerId, {
            type: 'price_drop',
            title: 'Wishlist Price Drop Detected',
            message: `${dbProduct.name} dropped from ${formatCurrency(item.saved_price, itemCurrency)} to ${formatCurrency(latestPrice, itemCurrency)} (${itemCurrency}).`,
            link: `/products/${dbProduct.id}`,
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        checkedCount: items.length,
        dropsFound: drops.length,
        drops,
        checkedAt: new Date().toISOString(),
        mechanismNote:
          'Prices are re-verified on demand against the catalogue and live Channel3 API when triggered.',
      },
    });
  } catch (error) {
    console.error('Wishlist price check error:', error);
    return NextResponse.json({ success: false, error: 'Failed to verify wishlist prices' }, { status: 500 });
  }
}
