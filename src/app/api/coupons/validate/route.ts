// src/app/api/coupons/validate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { validateCouponCode } from '@/lib/database';
import { getShoppingOwnerId } from '@/lib/auth';
import { buildCartSummary } from '@/lib/cart';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { code, subtotal } = body as { code?: string; subtotal?: number };

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ success: false, error: 'Coupon code is required' }, { status: 400 });
    }

    // Use server-calculated cart subtotal if not explicitly passed for single-item preview
    const { ownerId } = await getShoppingOwnerId();
    const { summary } = buildCartSummary(ownerId);
    const eligibleSubtotal =
      typeof subtotal === 'number' && subtotal > 0 ? subtotal : summary.agentPaySubtotal;

    const result = validateCouponCode(code, eligibleSubtotal);
    if (!result.valid || !result.coupon) {
      return NextResponse.json(
        { success: false, error: result.error || 'Invalid coupon code' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        coupon: {
          code: result.coupon.code,
          description: result.coupon.description,
          discountType: result.coupon.discount_type,
          discountValue: result.coupon.discount_value,
          minOrderAmount: result.coupon.min_order_amount,
          maxDiscount: result.coupon.max_discount ?? undefined,
          active: true,
          expiresAt: result.coupon.expires_at,
          eligibleScope: result.coupon.eligible_scope,
        },
        discountAmount: result.discountAmount,
      },
    });
  } catch (error) {
    console.error('Coupon validate error:', error);
    return NextResponse.json({ success: false, error: 'Failed to validate coupon' }, { status: 500 });
  }
}
