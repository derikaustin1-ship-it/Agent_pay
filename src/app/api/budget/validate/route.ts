// src/app/api/budget/validate/route.ts
// Backend spending-limit validation endpoint for single-product and multi-product checkout.
// Verifies actual product prices and coupons from the database — never trusts frontend values.

import { NextRequest, NextResponse } from 'next/server';
import { getProductById, validateCouponCode } from '@/lib/database';
import { getAuthenticatedUser, getShoppingOwnerId } from '@/lib/auth';
import { evaluateBudgetForTotal } from '@/lib/budget';
import { buildCartSummary } from '@/lib/cart';
import { convertAmountWithRates, fromMinorUnits, getExchangeRates, toMinorUnits } from '@/lib/exchange-rates';
import { resolveServerPreferences } from '@/lib/preferences';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const { ownerId } = await getShoppingOwnerId();
    const budgetUserId = user?.id || 'guest-default';
    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();

    const body = await request.json();
    const { productId, items, mode, couponCode } = body as {
      productId?: string;
      items?: Array<{ productId: string; quantity: number }>;
      mode?: 'cart' | 'single';
      couponCode?: string;
    };

    // Multi-product / Cart validation
    if (mode === 'cart' || (Array.isArray(items) && items.length > 0)) {
      let subtotalCents = 0;
      let labelName = '';
      let firstImage = '';
      let firstBrand = 'Multi-Item';
      let firstSeller = 'AgentPay Store';

      if (mode === 'cart') {
        const { summary } = buildCartSummary(ownerId, couponCode, prefsResolved, ratesData);
        if (summary.agentPayItems.length === 0) {
          return NextResponse.json(
            { success: false, error: 'No AgentPay checkout-eligible items in cart.' },
            { status: 400 }
          );
        }
        const evalResult = evaluateBudgetForTotal(
          summary.finalPayableAmount,
          budgetUserId,
          'USD',
          ratesData.rates
        );
        const first = summary.agentPayItems[0].product;
        return NextResponse.json({
          success: true,
          data: {
            ...evalResult,
            productId: first.id,
            productName:
              summary.agentPayItems.length > 1
                ? `${first.name} + ${summary.agentPayItems.length - 1} more`
                : first.name,
            productImage: first.imageUrl,
            brand: first.brand,
            seller: first.seller,
            currency: 'USD',
            subtotal: summary.agentPaySubtotal,
            discountAmount: summary.discountAmount,
            itemCount: summary.agentPayItems.reduce((s, i) => s + i.quantity, 0),
          },
        });
      }

      // Explicit items array
      for (const reqItem of items!) {
        const prod = getProductById(reqItem.productId);
        if (!prod) {
          return NextResponse.json(
            { success: false, error: `Product '${reqItem.productId}' not found` },
            { status: 404 }
          );
        }
        if (prod.checkout_type === 'external' || prod.is_demo === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `"${prod.name}" is sold by an external merchant (${prod.seller}) and must be purchased on the merchant website.`,
            },
            { status: 400 }
          );
        }
        const qty = Math.max(1, Math.min(20, Math.floor(Number(reqItem.quantity) || 1)));
        const unitUSD = convertAmountWithRates(
          Number(prod.price),
          (prod.currency || 'USD').toUpperCase(),
          'USD',
          ratesData.rates
        ).amountUSD;
        subtotalCents += toMinorUnits(unitUSD, 'USD') * qty;
        if (!labelName) {
          labelName = prod.name;
          firstImage = prod.image_url;
          firstBrand = prod.brand;
          firstSeller = prod.seller;
        }
      }

      let discountCents = 0;
      const subtotalUSD = fromMinorUnits(subtotalCents, 'USD');
      if (couponCode) {
        const cCheck = validateCouponCode(couponCode, subtotalUSD);
        if (cCheck.valid) {
          discountCents = toMinorUnits(cCheck.discountAmount, 'USD');
        }
      }
      const payableUSD = fromMinorUnits(Math.max(0, subtotalCents - discountCents), 'USD');
      const evalResult = evaluateBudgetForTotal(payableUSD, budgetUserId, 'USD', ratesData.rates);

      return NextResponse.json({
        success: true,
        data: {
          ...evalResult,
          productId: items![0].productId,
          productName: items!.length > 1 ? `${labelName} + ${items!.length - 1} more` : labelName,
          productImage: firstImage,
          brand: firstBrand,
          seller: firstSeller,
          currency: 'USD',
          subtotal: subtotalUSD,
          discountAmount: fromMinorUnits(discountCents, 'USD'),
        },
      });
    }

    // Single-product validation
    if (!productId || typeof productId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Product ID or items are required for budget validation' },
        { status: 400 }
      );
    }

    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json(
        { success: false, error: `Product with ID '${productId}' was not found in the catalogue` },
        { status: 404 }
      );
    }

    const actualPrice = Number(product.price);
    const productCurrency = (product.currency || 'USD').toUpperCase();
    const evalResult = evaluateBudgetForTotal(
      actualPrice,
      budgetUserId,
      productCurrency,
      ratesData.rates
    );

    return NextResponse.json({
      success: true,
      data: {
        ...evalResult,
        productId: product.id,
        productName: product.name,
        productImage: product.image_url,
        brand: product.brand,
        seller: product.seller,
        currency: productCurrency,
      },
    });
  } catch (error) {
    console.error('Budget validate error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error during budget validation' },
      { status: 500 }
    );
  }
}
