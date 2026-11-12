// src/app/api/paypal/capture-order/route.ts
// Captures an approved PayPal Sandbox order securely
// Features pre-capture status verification, duplicate-capture protection, cart cleanup, and notifications.

import { NextRequest, NextResponse } from 'next/server';
import { capturePayPalOrder, getPayPalOrderStatus, isPayPalConfigured } from '@/lib/paypal';
import {
  clearCart,
  createNotification,
  DbOrderItem,
  getOrderByPayPalId,
  isOrderAlreadyCaptured,
  updateOrderStatusByPayPalId,
} from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function clearPurchasedCartItems(paypalOrderId: string) {
  const dbOrder = getOrderByPayPalId(paypalOrderId);
  if (!dbOrder) return;

  let productIds: string[] = [dbOrder.product_id];
  if (dbOrder.items) {
    try {
      const parsed = JSON.parse(dbOrder.items) as DbOrderItem[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        productIds = parsed.map((i) => i.productId);
      }
    } catch {
      // ignore
    }
  }
  clearCart(dbOrder.user_id, productIds);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { paypalOrderId } = body;

    if (!paypalOrderId || typeof paypalOrderId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid PayPal order ID is required' },
        { status: 400 }
      );
    }

    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required to capture payment.' },
        { status: 401 }
      );
    }

    const existingOrderRecord = getOrderByPayPalId(paypalOrderId);
    if (existingOrderRecord && existingOrderRecord.user_id !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Order belongs to another account.' },
        { status: 403 }
      );
    }

    // Step 1: Idempotency & Duplicate capture protection
    if (isOrderAlreadyCaptured(paypalOrderId)) {
      const existingOrder = getOrderByPayPalId(paypalOrderId);
      return NextResponse.json({
        success: true,
        alreadyCaptured: true,
        message: 'Order has already been captured. Returning existing receipt.',
        data: {
          paypalOrderId,
          captureId: existingOrder?.paypal_capture_id,
          status: 'COMPLETED',
          amount: existingOrder ? existingOrder.amount.toFixed(2) : undefined,
          currency: existingOrder ? existingOrder.currency : 'USD',
          productName: existingOrder ? existingOrder.product_name : undefined,
          productImage: existingOrder ? existingOrder.product_image : undefined,
          isDemo: Boolean(!isPayPalConfigured() || existingOrder?.is_sandbox),
        },
      });
    }

    // Step 2: Demo Mode fallback (PayPal credentials not configured)
    if (!isPayPalConfigured()) {
      const dbOrder = getOrderByPayPalId(paypalOrderId);
      updateOrderStatusByPayPalId(paypalOrderId, 'captured');
      clearPurchasedCartItems(paypalOrderId);
      if (dbOrder) {
        createNotification(dbOrder.user_id, {
          type: 'payment_status',
          title: 'Order Payment Captured (Demo)',
          message: `Order for ${dbOrder.product_name} ($${dbOrder.amount.toFixed(2)} USD) completed.`,
          link: '/orders',
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          paypalOrderId,
          status: 'COMPLETED',
          amount: dbOrder ? dbOrder.amount.toFixed(2) : '0.00',
          currency: dbOrder ? dbOrder.currency : 'USD',
          productName: dbOrder?.product_name || 'Simulated Item',
          productImage: dbOrder?.product_image || '',
          isDemo: true,
          message: 'Simulated capture (PayPal not configured).',
        },
      });
    }

    // Step 3: Verify PayPal Sandbox order status before capture
    let paypalStatus;
    try {
      paypalStatus = await getPayPalOrderStatus(paypalOrderId);
    } catch (statusErr) {
      console.error('PayPal getOrderStatus error:', statusErr);
      const errMsg = statusErr instanceof Error ? statusErr.message : '';
      const isNetworkOrConfig =
        /network|timed out|OAuth|not configured/i.test(errMsg);
      return NextResponse.json(
        {
          success: false,
          error: isNetworkOrConfig
            ? errMsg
            : 'Invalid or unverified PayPal order ID. Order was not found in PayPal Sandbox.',
        },
        { status: isNetworkOrConfig ? 502 : 400 }
      );
    }

    if (paypalStatus.status === 'COMPLETED') {
      updateOrderStatusByPayPalId(paypalOrderId, 'captured', paypalStatus.captureId);
      clearPurchasedCartItems(paypalOrderId);
      const dbOrder = getOrderByPayPalId(paypalOrderId);
      return NextResponse.json({
        success: true,
        alreadyCaptured: true,
        data: {
          paypalOrderId: paypalStatus.id,
          captureId: paypalStatus.captureId,
          status: 'COMPLETED',
          amount: paypalStatus.amount,
          currency: paypalStatus.currency || 'USD',
          productName: dbOrder?.product_name,
          productImage: dbOrder?.product_image,
          isDemo: false,
        },
      });
    }

    if (paypalStatus.status !== 'APPROVED') {
      return NextResponse.json(
        {
          success: false,
          error: `Order cannot be captured because user approval is required. Current status: ${paypalStatus.status}.`,
        },
        { status: 400 }
      );
    }

    // Step 4: Capture payment with PayPal REST Orders API
    const captureResult = await capturePayPalOrder(paypalOrderId);

    if (captureResult.status === 'COMPLETED') {
      updateOrderStatusByPayPalId(paypalOrderId, 'captured', captureResult.captureId);
      clearPurchasedCartItems(paypalOrderId);
      const dbOrder = getOrderByPayPalId(paypalOrderId);
      if (dbOrder) {
        createNotification(dbOrder.user_id, {
          type: 'payment_status',
          title: 'PayPal Payment Confirmed',
          message: `Payment of $${(captureResult.amount || dbOrder.amount.toFixed(2))} USD for ${dbOrder.product_name} was captured.`,
          link: '/orders',
        });
      }

      return NextResponse.json({
        success: true,
        data: {
          paypalOrderId: captureResult.id,
          captureId: captureResult.captureId,
          status: captureResult.status,
          amount: captureResult.amount || paypalStatus.amount,
          currency: captureResult.currency || paypalStatus.currency || 'USD',
          productName: dbOrder?.product_name,
          productImage: dbOrder?.product_image,
          isDemo: false,
        },
      });
    } else {
      updateOrderStatusByPayPalId(paypalOrderId, 'failed');
      return NextResponse.json(
        {
          success: false,
          error: `PayPal payment capture did not complete. Status: ${captureResult.status}`,
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('PayPal capture error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to capture payment' },
      { status: 500 }
    );
  }
}
