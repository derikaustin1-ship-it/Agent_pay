// src/app/api/spending/route.ts
// Spending dashboard data API — strictly scoped to authenticated user

import { NextResponse } from 'next/server';
import { getSpendingSummary } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { convertAmountWithRates, fromMinorUnits, getExchangeRates, toMinorUnits } from '@/lib/exchange-rates';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const summary = getSpendingSummary(user.id);
    const budgetCurrency = (summary.currency || 'USD').toUpperCase();
    const ratesData = await getExchangeRates();

    const todaySpendingInBudgetCurrency = convertAmountWithRates(
      summary.todaySpending,
      'USD',
      budgetCurrency,
      ratesData.rates
    ).displayAmount;

    const dailyLimitMinor = toMinorUnits(summary.dailySpendingLimit, budgetCurrency);
    const todaySpendMinor = toMinorUnits(todaySpendingInBudgetCurrency, budgetCurrency);
    const remainingMinor = Math.max(0, dailyLimitMinor - todaySpendMinor);
    const remainingDailyBudget = fromMinorUnits(remainingMinor, budgetCurrency);
    const budgetUtilization =
      summary.dailySpendingLimit > 0
        ? (todaySpendingInBudgetCurrency / summary.dailySpendingLimit) * 100
        : 0;

    return NextResponse.json({
      success: true,
      data: {
        totalSpending: summary.totalSpending,
        orderCount: summary.orderCount,
        todaySpending: todaySpendingInBudgetCurrency,
        dailySpendingLimit: summary.dailySpendingLimit,
        remainingDailyBudget,
        maxPurchaseAmount: summary.maxPurchaseAmount,
        currency: budgetCurrency,
        budgetUtilization,
        recentOrders: summary.recentOrders.map((order) => ({
          id: order.id,
          productName: order.product_name,
          productImage: order.product_image,
          paypalOrderId: order.paypal_order_id,
          paypalCaptureId: order.paypal_capture_id,
          amount: order.amount,
          currency: order.currency,
          paymentStatus: order.payment_status,
          createdAt: order.created_at,
          isSandbox: Boolean(order.is_sandbox),
          orderType: order.order_type || 'agentpay',
        })),
      },
    });
  } catch (error) {
    console.error('Spending GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to load spending data' },
      { status: 500 }
    );
  }
}
