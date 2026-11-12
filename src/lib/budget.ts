// src/lib/budget.ts
// Currency-aware Smart Budget Guard enforcing single-purchase and daily spending ceilings.
// Uses integer minor-unit arithmetic and exchange-rate normalization across currencies.

import { getUserBudget, getTodaySpending } from './database';
import {
  convertAmountWithRates,
  formatCurrency,
  fromMinorUnits,
  roundCurrencyAmount,
  toMinorUnits,
} from './exchange-rates';
import { BudgetValidationResult, SpendingCheck } from '@/types';

const DEFAULT_USER_ID = 'demo-user-1';
const FALLBACK_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  INR: 83.25,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 155.4,
};

/**
 * Evaluate single-order & daily limits for a candidate amount in `amountCurrency`,
 * normalizing accurately into the user's configured `budget.currency`.
 */
export function checkSpendingLimits(
  amount: number,
  userId: string = DEFAULT_USER_ID,
  amountCurrency: string = 'USD',
  rates: Record<string, number> = FALLBACK_RATES
): SpendingCheck {
  const budget = getUserBudget(userId);
  const budgetCurrency = (budget?.currency || 'USD').toUpperCase();
  const maxPurchaseAmount = budget ? Number(budget.max_purchase_amount) : 150.0;
  const dailySpendingLimit = budget ? Number(budget.daily_spending_limit) : 300.0;

  // Captured orders store USD settlement amounts; convert today's USD spend into budgetCurrency
  const todaySpendingUSD = getTodaySpending(userId);
  const currentDailySpending = convertAmountWithRates(
    todaySpendingUSD,
    'USD',
    budgetCurrency,
    rates
  ).displayAmount;

  // Convert candidate amount into budgetCurrency
  const amountInBudgetCurrency = convertAmountWithRates(
    amount,
    amountCurrency,
    budgetCurrency,
    rates
  ).displayAmount;

  const amountMinor = toMinorUnits(amountInBudgetCurrency, budgetCurrency);
  const maxPurchaseMinor = toMinorUnits(maxPurchaseAmount, budgetCurrency);
  const dailyLimitMinor = toMinorUnits(dailySpendingLimit, budgetCurrency);
  const currentSpendMinor = toMinorUnits(currentDailySpending, budgetCurrency);
  const remainingMinor = Math.max(0, dailyLimitMinor - currentSpendMinor);

  const remainingDailyBudget = fromMinorUnits(remainingMinor, budgetCurrency);
  const withinPurchaseLimit = amountMinor <= maxPurchaseMinor;
  const withinDailyLimit = currentSpendMinor + amountMinor <= dailyLimitMinor;
  const allowed = withinPurchaseLimit && withinDailyLimit;

  const fmt = (val: number) => formatCurrency(val, budgetCurrency);

  let message = '';
  if (allowed) {
    message = `Within budget limits (${fmt(amountInBudgetCurrency)} of ${fmt(maxPurchaseAmount)} max purchase, ${fmt(remainingDailyBudget)} daily remaining).`;
  } else if (!withinPurchaseLimit && !withinDailyLimit) {
    message = `Blocked: ${fmt(amountInBudgetCurrency)} exceeds both your ${fmt(maxPurchaseAmount)} single-purchase limit and your ${fmt(remainingDailyBudget)} remaining daily limit.`;
  } else if (!withinPurchaseLimit) {
    message = `Blocked: ${fmt(amountInBudgetCurrency)} exceeds your single-purchase limit of ${fmt(maxPurchaseAmount)}.`;
  } else {
    message = `Blocked: ${fmt(amountInBudgetCurrency)} would exceed your daily spending limit of ${fmt(dailySpendingLimit)} (spent today: ${fmt(currentDailySpending)}, remaining: ${fmt(remainingDailyBudget)}).`;
  }

  return {
    withinPurchaseLimit,
    withinDailyLimit,
    currentDailySpending: roundCurrencyAmount(currentDailySpending, budgetCurrency),
    remainingDailyBudget,
    maxPurchaseAmount: roundCurrencyAmount(maxPurchaseAmount, budgetCurrency),
    dailySpendingLimit: roundCurrencyAmount(dailySpendingLimit, budgetCurrency),
    currency: budgetCurrency,
    message,
    allowed,
  };
}

/**
 * Validate a proposed total (default in USD or specified currency) against the user's budget rules.
 */
export function evaluateBudgetForTotal(
  totalAmount: number,
  userId: string = DEFAULT_USER_ID,
  amountCurrency: string = 'USD',
  rates: Record<string, number> = FALLBACK_RATES
): BudgetValidationResult {
  const budget = getUserBudget(userId);
  const budgetCurrency = (budget?.currency || 'USD').toUpperCase();
  const maxPurchaseAmount = budget ? Number(budget.max_purchase_amount) : 150.0;
  const dailySpendingLimit = budget ? Number(budget.daily_spending_limit) : 300.0;

  const todaySpendingUSD = getTodaySpending(userId);
  const currentDailySpending = convertAmountWithRates(
    todaySpendingUSD,
    'USD',
    budgetCurrency,
    rates
  ).displayAmount;

  const converted = convertAmountWithRates(
    totalAmount,
    amountCurrency,
    budgetCurrency,
    rates
  );
  const amountInBudgetCurrency = converted.displayAmount;

  const amountMinor = toMinorUnits(amountInBudgetCurrency, budgetCurrency);
  const maxPurchaseMinor = toMinorUnits(maxPurchaseAmount, budgetCurrency);
  const dailyLimitMinor = toMinorUnits(dailySpendingLimit, budgetCurrency);
  const currentSpendMinor = toMinorUnits(currentDailySpending, budgetCurrency);
  const remainingMinor = Math.max(0, dailyLimitMinor - currentSpendMinor);

  const remainingDailyBudget = fromMinorUnits(remainingMinor, budgetCurrency);
  const remainingAfterPurchase = Math.max(
    0,
    fromMinorUnits(dailyLimitMinor - (currentSpendMinor + amountMinor), budgetCurrency)
  );

  const withinPurchaseLimit = amountMinor <= maxPurchaseMinor;
  const withinDailyLimit = currentSpendMinor + amountMinor <= dailyLimitMinor;
  const isPurchaseBoundary = withinPurchaseLimit && amountMinor === maxPurchaseMinor;
  const isDailyBoundary = withinDailyLimit && currentSpendMinor + amountMinor === dailyLimitMinor;
  const isBoundaryMatch = isPurchaseBoundary || isDailyBoundary;
  const allowed = withinPurchaseLimit && withinDailyLimit;

  let status: BudgetValidationResult['status'] = 'approved';
  let message = 'Approved by Smart Budget Guard';
  let explanation = '';

  const fmt = (val: number) => formatCurrency(val, budgetCurrency);
  const sameCurrency = amountCurrency.toUpperCase() === budgetCurrency;
  const sourceLabel = sameCurrency
    ? fmt(amountInBudgetCurrency)
    : `${formatCurrency(totalAmount, amountCurrency)} (≈ ${fmt(amountInBudgetCurrency)} at ${converted.rate.toFixed(4)})`;

  if (!withinPurchaseLimit && !withinDailyLimit) {
    status = 'blocked_both';
    message = 'Exceeds Per-Purchase & Daily Limits';
    explanation = `Total ${sourceLabel} exceeds both your ${fmt(maxPurchaseAmount)} single-purchase limit and your remaining daily allowance (${fmt(remainingDailyBudget)}).`;
  } else if (!withinPurchaseLimit) {
    status = 'blocked_purchase_limit';
    message = 'Exceeds Single-Purchase Ceiling';
    explanation = `Total ${sourceLabel} exceeds your single-purchase maximum of ${fmt(maxPurchaseAmount)}. Raise your budget ceiling in Smart Budget Guard or reduce your cart quantity.`;
  } else if (!withinDailyLimit) {
    status = 'blocked_daily_limit';
    message = 'Exceeds Daily Spending Limit';
    explanation = `Total ${sourceLabel} exceeds your remaining daily budget (${fmt(remainingDailyBudget)} of ${fmt(dailySpendingLimit)} daily limit).`;
  } else if (isBoundaryMatch) {
    explanation = `Exact boundary match: ${sourceLabel} is permitted up to your ${fmt(isPurchaseBoundary ? maxPurchaseAmount : dailySpendingLimit)} limit.`;
  } else {
    explanation = `${sourceLabel} is approved within your ${fmt(maxPurchaseAmount)} per-purchase and ${fmt(dailySpendingLimit)} daily limits.`;
  }

  return {
    allowed,
    productId: 'cart',
    productName: 'Order Total',
    productImage: '',
    brand: 'AgentPay',
    seller: 'AgentPay Store',
    actualPrice: totalAmount,
    currency: amountCurrency.toUpperCase(),
    budgetCurrency,
    actualPriceInBudgetCurrency: amountInBudgetCurrency,
    exchangeRateUsed: converted.rate,
    maxPurchaseAmount: roundCurrencyAmount(maxPurchaseAmount, budgetCurrency),
    dailySpendingLimit: roundCurrencyAmount(dailySpendingLimit, budgetCurrency),
    currentDailySpending: roundCurrencyAmount(currentDailySpending, budgetCurrency),
    remainingDailyBudget,
    remainingAfterPurchase,
    withinPurchaseLimit,
    withinDailyLimit,
    isBoundaryMatch,
    isPurchaseBoundary,
    isDailyBoundary,
    status,
    message,
    explanation,
  };
}
