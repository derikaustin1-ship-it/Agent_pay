// src/app/api/orders/route.ts
// Order management API — strictly scoped to the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import {
  createOrder,
  getProductById,
  getUserOrders,
  recordExternalClick,
} from '@/lib/database';
import { getAuthenticatedUser, getShoppingOwnerId } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to view order history.' },
        { status: 401 }
      );
    }

    const orders = getUserOrders(user.id);

    return NextResponse.json({
      success: true,
      data: orders.map((order) => {
        let parsedItems;
        let parsedAddress;
        try {
          parsedItems = order.items ? JSON.parse(order.items) : undefined;
        } catch {
          parsedItems = undefined;
        }
        try {
          parsedAddress = order.shipping_address ? JSON.parse(order.shipping_address) : undefined;
        } catch {
          parsedAddress = undefined;
        }

        return {
          id: order.id,
          userId: order.user_id,
          productId: order.product_id,
          productName: order.product_name,
          productImage: order.product_image,
          items: parsedItems,
          subtotal: order.subtotal,
          discountAmount: order.discount_amount,
          couponCode: order.coupon_code,
          shippingAddress: parsedAddress,
          orderType: order.order_type || 'agentpay',
          merchantName: order.merchant_name,
          merchantUrl: order.merchant_url,
          paypalOrderId: order.paypal_order_id,
          paypalCaptureId: order.paypal_capture_id,
          amount: order.amount,
          currency: order.currency,
          paymentStatus: order.payment_status,
          createdAt: order.created_at,
          isSandbox: Boolean(order.is_sandbox),
          displayAmount: order.display_amount,
          displayCurrency: order.display_currency,
        };
      }),
    });
  } catch (error) {
    console.error('Orders GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load orders' }, { status: 500 });
  }
}

/**
 * Record an external merchant redirect click (distinct from AgentPay-captured orders).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, logOrder } = body as { productId?: string; logOrder?: boolean };

    if (!productId) {
      return NextResponse.json({ success: false, error: 'Product ID is required' }, { status: 400 });
    }

    const product = getProductById(productId);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    const { ownerId, user } = await getShoppingOwnerId();
    recordExternalClick(ownerId, product.id, product.seller, product.product_url);

    // If user is authenticated and explicitly logs an external purchase redirect reference:
    if (user && logOrder) {
      const orderId = `ext-order-${Date.now()}`;
      createOrder({
        id: orderId,
        userId: user.id,
        productId: product.id,
        productName: product.name,
        productImage: product.image_url,
        orderType: 'external',
        merchantName: product.seller,
        merchantUrl: product.product_url,
        paypalOrderId: `EXT-${Date.now()}`,
        amount: product.price,
        currency: product.currency || 'USD',
        paymentStatus: 'pending',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        merchantUrl: product.product_url,
        merchantName: product.seller,
      },
    });
  } catch (error) {
    console.error('External redirect record error:', error);
    return NextResponse.json({ success: false, error: 'Failed to process external redirect' }, { status: 500 });
  }
}
