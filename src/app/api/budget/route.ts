// src/app/api/budget/route.ts
// Budget settings API - strictly scoped to the authenticated user

import { NextRequest, NextResponse } from 'next/server';
import { getUserBudget, updateUserBudget } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { resolveServerPreferences } from '@/lib/preferences';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    const prefsResolved = await resolveServerPreferences();
    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          userId: null,
          maxPurchaseAmount: 150,
          dailySpendingLimit: 300,
          currency: 'USD',
          preferredCurrency: prefsResolved.currencyCode,
          isDefault: true,
        },
      });
    }

    const budget = getUserBudget(user.id);
    if (!budget) {
      return NextResponse.json({
        success: true,
        data: {
          userId: user.id,
          maxPurchaseAmount: 150,
          dailySpendingLimit: 300,
          currency: 'USD',
          preferredCurrency: prefsResolved.currencyCode,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        userId: budget.user_id,
        maxPurchaseAmount: budget.max_purchase_amount,
        dailySpendingLimit: budget.daily_spending_limit,
        currency: (budget.currency || 'USD').toUpperCase(),
        preferredCurrency: prefsResolved.currencyCode,
        createdAt: budget.created_at,
        updatedAt: budget.updated_at,
      },
    });
  } catch (error) {
    console.error('Budget GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load budget settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Please sign in to update your budget settings.' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { maxPurchaseAmount, dailySpendingLimit, currency } = body as {
      maxPurchaseAmount: number;
      dailySpendingLimit: number;
      currency?: string;
    };

    if (typeof maxPurchaseAmount !== 'number' || maxPurchaseAmount <= 0) {
      return NextResponse.json(
        { success: false, error: 'Maximum purchase amount must be a positive number' },
        { status: 400 }
      );
    }
    if (typeof dailySpendingLimit !== 'number' || dailySpendingLimit <= 0) {
      return NextResponse.json(
        { success: false, error: 'Daily spending limit must be a positive number' },
        { status: 400 }
      );
    }
    if (maxPurchaseAmount > dailySpendingLimit) {
      return NextResponse.json(
        { success: false, error: 'Maximum purchase amount cannot exceed daily spending limit' },
        { status: 400 }
      );
    }

    const prefsResolved = await resolveServerPreferences(undefined, currency);
    const budgetCurrency = (currency || prefsResolved.currencyCode || 'USD').toUpperCase();

    updateUserBudget(user.id, maxPurchaseAmount, dailySpendingLimit, budgetCurrency);
    const updated = getUserBudget(user.id);

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        maxPurchaseAmount: updated?.max_purchase_amount || maxPurchaseAmount,
        dailySpendingLimit: updated?.daily_spending_limit || dailySpendingLimit,
        currency: (updated?.currency || budgetCurrency).toUpperCase(),
        updatedAt: updated?.updated_at,
      },
    });
  } catch (error) {
    console.error('Budget POST error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update budget settings' },
      { status: 500 }
    );
  }
}
