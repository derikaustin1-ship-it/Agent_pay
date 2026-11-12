// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createNotification, getOrderById, updateOrderStatus } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { id } = await context.params;
  const order = getOrderById(id);
  if (!order) {
    return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
  }

  if (order.user_id !== user.id) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body as { action?: 'cancel' };

  if (action === 'cancel') {
    if (order.payment_status === 'captured') {
      return NextResponse.json(
        {
          success: false,
          error:
            'Captured PayPal Sandbox orders cannot be self-refunded here; manage refunds via PayPal Sandbox dashboard.',
        },
        { status: 400 }
      );
    }

    updateOrderStatus(order.id, 'cancelled');
    createNotification(user.id, {
      type: 'order_update',
      title: 'Order Cancelled',
      message: `Order ${order.paypal_order_id} (${order.product_name}) was cancelled before capture.`,
      link: '/orders',
    });

    return NextResponse.json({ success: true, data: { id: order.id, paymentStatus: 'cancelled' } });
  }

  return NextResponse.json({ success: false, error: 'Unsupported order action' }, { status: 400 });
}
