// src/app/api/account/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  getNotificationPreferences,
  getShoppingPreferences,
  updateNotificationPreferences,
  updateShoppingPreferences,
  updateUserProfile,
} from '@/lib/database';
import { getAuthenticatedUser, toPublicUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const shoppingPreferences = getShoppingPreferences(user.id);
  const notifPrefs = getNotificationPreferences(user.id);

  return NextResponse.json({
    success: true,
    data: {
      user: toPublicUser(user),
      shoppingPreferences,
      notificationPreferences: {
        orderUpdates: notifPrefs.order_updates === 1,
        paymentAlerts: notifPrefs.payment_alerts === 1,
        priceDrops: notifPrefs.price_drops === 1,
        promotions: notifPrefs.promotions === 1,
        updatedAt: notifPrefs.updated_at,
      },
    },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, phone, shoppingPreferences, notificationPreferences } = body as {
      name?: string;
      phone?: string;
      shoppingPreferences?: {
        preferredBrands?: string[];
        preferredCategories?: string[];
        maxBudget?: number | null;
      };
      notificationPreferences?: {
        orderUpdates?: boolean;
        paymentAlerts?: boolean;
        priceDrops?: boolean;
        promotions?: boolean;
      };
    };

    let updatedUser = user;
    if (name !== undefined || phone !== undefined) {
      const res = updateUserProfile(user.id, { name, phone });
      if (res) updatedUser = res;
    }

    if (shoppingPreferences) {
      updateShoppingPreferences(user.id, {
        preferredBrands: Array.isArray(shoppingPreferences.preferredBrands)
          ? shoppingPreferences.preferredBrands
          : [],
        preferredCategories: Array.isArray(shoppingPreferences.preferredCategories)
          ? shoppingPreferences.preferredCategories
          : [],
        maxBudget:
          typeof shoppingPreferences.maxBudget === 'number' && shoppingPreferences.maxBudget > 0
            ? shoppingPreferences.maxBudget
            : null,
      });
    }

    if (notificationPreferences) {
      const current = getNotificationPreferences(user.id);
      updateNotificationPreferences(user.id, {
        orderUpdates: notificationPreferences.orderUpdates ?? current.order_updates === 1,
        paymentAlerts: notificationPreferences.paymentAlerts ?? current.payment_alerts === 1,
        priceDrops: notificationPreferences.priceDrops ?? current.price_drops === 1,
        promotions: notificationPreferences.promotions ?? current.promotions === 1,
      });
    }

    const updatedShopping = getShoppingPreferences(user.id);
    const updatedNotif = getNotificationPreferences(user.id);

    return NextResponse.json({
      success: true,
      data: {
        user: toPublicUser(updatedUser),
        shoppingPreferences: updatedShopping,
        notificationPreferences: {
          orderUpdates: updatedNotif.order_updates === 1,
          paymentAlerts: updatedNotif.payment_alerts === 1,
          priceDrops: updatedNotif.price_drops === 1,
          promotions: updatedNotif.promotions === 1,
          updatedAt: updatedNotif.updated_at,
        },
      },
    });
  } catch (error) {
    console.error('Account PATCH error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update account' }, { status: 500 });
  }
}
