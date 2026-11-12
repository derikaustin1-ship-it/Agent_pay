// src/app/api/paypal/create-order/route.ts
// Creates a single-item or multi-item PayPal Sandbox order after strict server-side validation.
// Never trusts amounts, prices, or user IDs from the frontend.

import { NextRequest, NextResponse } from 'next/server';
import { createPayPalOrder, isPayPalConfigured } from '@/lib/paypal';
import { checkSpendingLimits } from '@/lib/budget';
import {
  createNotification,
  createOrder,
  DbOrderItem,
  getProductById,
  getUserAddresses,
  validateCouponCode,
} from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { buildCartSummary } from '@/lib/cart';
import { isPayPalSupportedCurrency } from '@/lib/countries';
import { convertAmountWithRates, fromMinorUnits, getExchangeRates, toMinorUnits } from '@/lib/exchange-rates';
import { resolveServerPreferences } from '@/lib/preferences';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Please sign in to proceed with PayPal checkout.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      productId,
      items,
      mode,
      couponCode,
      addressId,
      currency: requestedCurrency,
      confirmedSettlementCurrency,
    } = body as {
      productId?: string;
      items?: Array<{ productId: string; quantity: number }>;
      mode?: 'cart' | 'single';
      couponCode?: string;
      addressId?: string;
      currency?: string;
      confirmedSettlementCurrency?: string;
    };

    const prefsResolved = await resolveServerPreferences();
    const ratesData = await getExchangeRates();

    if (requestedCurrency && !isPayPalSupportedCurrency(requestedCurrency)) {
      return NextResponse.json(
        {
          success: false,
          error: `PayPal Checkout cannot settle transactions directly in ${requestedCurrency.toUpperCase()}. Please confirm supported USD settlement or choose a supported currency.`,
        },
        { status: 400 }
      );
    }

    if (
      !prefsResolved.country.paypalCheckoutSupported ||
      (!prefsResolved.country.paypalSupportedCurrency &&
        confirmedSettlementCurrency?.toUpperCase() !== 'USD' &&
        requestedCurrency?.toUpperCase() !== 'USD')
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `${prefsResolved.country.currencyCode} (${prefsResolved.country.name}) is a display-only currency and is not supported for direct PayPal settlement. Confirm PayPal USD settlement before submitting checkout.`,
          requiresSettlementConfirmation: true,
          supportedSettlementCurrency: 'USD',
        },
        { status: 400 }
      );
    }

    // 1. Resolve verified line items strictly from database with minor-unit USD conversion
    const lineItems: DbOrderItem[] = [];

    if (mode === 'cart') {
      const { summary } = buildCartSummary(user.id, couponCode, prefsResolved, ratesData);
      if (summary.agentPayItems.length === 0) {
        return NextResponse.json(
          {
            success: false,
            error:
              summary.externalItems.length > 0
                ? 'External merchant items in your cart must be purchased directly on the merchant website.'
                : 'Your cart has no eligible items for AgentPay checkout.',
          },
          { status: 400 }
        );
      }
      for (const ci of summary.agentPayItems) {
        if (ci.product.availability?.toLowerCase().includes('out of stock')) {
          return NextResponse.json(
            { success: false, error: `"${ci.product.name}" is currently out of stock.` },
            { status: 400 }
          );
        }
        const unitUSD = convertAmountWithRates(
          ci.product.originalPrice,
          ci.product.originalCurrency,
          'USD',
          ratesData.rates
        ).amountUSD;
        const unitCents = toMinorUnits(unitUSD, 'USD');
        lineItems.push({
          productId: ci.product.id,
          productName: ci.product.name,
          productImage: ci.product.imageUrl,
          brand: ci.product.brand,
          seller: ci.product.seller,
          quantity: ci.quantity,
          unitPrice: fromMinorUnits(unitCents, 'USD'),
          lineTotal: fromMinorUnits(unitCents * ci.quantity, 'USD'),
        });
      }
    } else if (Array.isArray(items) && items.length > 0) {
      for (const reqItem of items) {
        const prod = getProductById(reqItem.productId);
        if (!prod) {
          return NextResponse.json(
            { success: false, error: `Product '${reqItem.productId}' not found.` },
            { status: 404 }
          );
        }
        if (prod.checkout_type === 'external' || prod.is_demo === 0) {
          return NextResponse.json(
            {
              success: false,
              error: `"${prod.name}" is an external merchant item (${prod.seller}) and must be purchased at the merchant website.`,
            },
            { status: 400 }
          );
        }
        if (prod.availability?.toLowerCase().includes('out of stock')) {
          return NextResponse.json(
            { success: false, error: `"${prod.name}" is currently out of stock.` },
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
        const unitCents = toMinorUnits(unitUSD, 'USD');
        lineItems.push({
          productId: prod.id,
          productName: prod.name,
          productImage: prod.image_url || '',
          brand: prod.brand,
          seller: prod.seller,
          quantity: qty,
          unitPrice: fromMinorUnits(unitCents, 'USD'),
          lineTotal: fromMinorUnits(unitCents * qty, 'USD'),
        });
      }
    } else {
      if (!productId) {
        return NextResponse.json(
          { success: false, error: 'Product ID or cart items are required' },
          { status: 400 }
        );
      }

      const product = getProductById(productId);
      if (!product) {
        return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
      }
      if (product.checkout_type === 'external' || product.is_demo === 0) {
        return NextResponse.json(
          {
            success: false,
            error: `"${product.name}" is sold by external merchant ${product.seller}. Use the merchant purchase link instead of AgentPay PayPal checkout.`,
          },
          { status: 400 }
        );
      }
      if (product.availability?.toLowerCase().includes('out of stock')) {
        return NextResponse.json(
          { success: false, error: `"${product.name}" is currently out of stock.` },
          { status: 400 }
        );
      }

      const unitUSD = convertAmountWithRates(
        Number(product.price),
        (product.currency || 'USD').toUpperCase(),
        'USD',
        ratesData.rates
      ).amountUSD;
      const unitCents = toMinorUnits(unitUSD, 'USD');
      lineItems.push({
        productId: product.id,
        productName: product.name,
        productImage: product.image_url || '',
        brand: product.brand,
        seller: product.seller,
        quantity: 1,
        unitPrice: fromMinorUnits(unitCents, 'USD'),
        lineTotal: fromMinorUnits(unitCents, 'USD'),
      });
    }

    // 2. Server-side subtotal, coupon validation, and final total in integer cents
    const subtotalCents = lineItems.reduce(
      (sum, item) => sum + toMinorUnits(item.unitPrice, 'USD') * item.quantity,
      0
    );

    let discountCents = 0;
    let verifiedCouponCode: string | undefined;
    if (couponCode && couponCode.trim()) {
      const couponRes = validateCouponCode(couponCode, subtotalCents / 100);
      if (!couponRes.valid || !couponRes.coupon) {
        return NextResponse.json(
          { success: false, error: couponRes.error || 'Invalid coupon code' },
          { status: 400 }
        );
      }
      discountCents = toMinorUnits(couponRes.discountAmount, 'USD');
      verifiedCouponCode = couponRes.coupon.code;
    }

    const finalTotalCents = Math.max(1, subtotalCents - discountCents);
    const finalTotalUSD = fromMinorUnits(finalTotalCents, 'USD');
    const subtotalUSD = fromMinorUnits(subtotalCents, 'USD');
    const discountUSD = fromMinorUnits(discountCents, 'USD');

    // 3. Server-side Smart Budget Protection check against FINAL payable amount (currency-normalized!)
    const spendingCheck = checkSpendingLimits(finalTotalUSD, user.id, 'USD', ratesData.rates);
    if (!spendingCheck.allowed) {
      createNotification(user.id, {
        type: 'budget_alert',
        title: 'Checkout Blocked by Budget Guard',
        message: spendingCheck.message,
        link: '/account?tab=budget',
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Budget limit exceeded',
          data: { spendingCheck },
        },
        { status: 403 }
      );
    }

    // 4. Resolve optional verified shipping address owned by user
    let shippingAddress: unknown = null;
    if (addressId) {
      const addresses = getUserAddresses(user.id);
      const found = addresses.find((a) => a.id === addressId);
      if (found) {
        shippingAddress = {
          id: found.id,
          label: found.label,
          fullName: found.full_name,
          phone: found.phone,
          line1: found.line1,
          line2: found.line2,
          city: found.city,
          state: found.state,
          postalCode: found.postal_code,
          countryCode: found.country_code,
        };
      }
    }

    const firstItem = lineItems[0];
    const summaryTitle =
      lineItems.length > 1
        ? `${firstItem.productName} (+${lineItems.length - 1} more)`
        : firstItem.productName;

    // 5. Demo mode fallback if PayPal credentials unconfigured
    if (!isPayPalConfigured()) {
      const demoOrderId = `DEMO-${Date.now()}`;
      const orderId = `order-${Date.now()}`;

      createOrder({
        id: orderId,
        userId: user.id,
        productId: firstItem.productId,
        productName: summaryTitle,
        productImage: firstItem.productImage,
        items: lineItems,
        subtotal: subtotalUSD,
        discountAmount: discountUSD,
        couponCode: verifiedCouponCode,
        shippingAddress,
        orderType: 'agentpay',
        merchantName: lineItems.length > 1 ? 'AgentPay Store' : firstItem.seller,
        paypalOrderId: demoOrderId,
        amount: finalTotalUSD,
        currency: 'USD',
        paymentStatus: 'pending',
      });

      return NextResponse.json({
        success: true,
        data: {
          orderId,
          paypalOrderId: demoOrderId,
          approvalUrl: null,
          amount: finalTotalUSD,
          subtotal: subtotalUSD,
          discountAmount: discountUSD,
          couponCode: verifiedCouponCode,
          currency: 'USD',
          productName: summaryTitle,
          isDemo: true,
        },
      });
    }

    // 6. Create real PayPal Sandbox v2 order with itemized purchase unit
    const origin =
      request.headers.get('origin') ||
      (request.headers.get('x-forwarded-host')
        ? `${request.headers.get('x-forwarded-proto') || 'https'}://${request.headers.get('x-forwarded-host')}`
        : null) ||
      (request.headers.get('host')
        ? `${request.headers.get('x-forwarded-proto') || 'http'}://${request.headers.get('host')}`
        : null) ||
      (process.env.APP_URL ? process.env.APP_URL.replace(/\/$/, '') : null) ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const paypalOrder = await createPayPalOrder(
      finalTotalUSD,
      'USD',
      summaryTitle,
      `${origin}/api/paypal/success`,
      `${origin}/api/paypal/cancel`,
      lineItems.map((li) => ({
        name: li.productName,
        quantity: li.quantity,
        unitAmount: li.unitPrice,
      })),
      discountUSD
    );

    const orderId = `order-${Date.now()}`;
    createOrder({
      id: orderId,
      userId: user.id,
      productId: firstItem.productId,
      productName: summaryTitle,
      productImage: firstItem.productImage,
      items: lineItems,
      subtotal: subtotalUSD,
      discountAmount: discountUSD,
      couponCode: verifiedCouponCode,
      shippingAddress,
      orderType: 'agentpay',
      merchantName: lineItems.length > 1 ? 'AgentPay Store' : firstItem.seller,
      paypalOrderId: paypalOrder.id,
      amount: finalTotalUSD,
      currency: 'USD',
      paymentStatus: 'pending',
    });

    return NextResponse.json({
      success: true,
      data: {
        orderId,
        paypalOrderId: paypalOrder.id,
        approvalUrl: paypalOrder.approvalUrl,
        amount: finalTotalUSD,
        subtotal: subtotalUSD,
        discountAmount: discountUSD,
        couponCode: verifiedCouponCode,
        currency: 'USD',
        productName: summaryTitle,
        isDemo: false,
      },
    });
  } catch (error) {
    console.error('PayPal create order error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to create order' },
      { status: 500 }
    );
  }
}
