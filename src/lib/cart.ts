// src/lib/cart.ts
// Currency-safe cart summary calculator with decimal-safe minor-unit arithmetic
// Retains genuine item originalPrice/originalCurrency, calculates USD PayPal settlement totals,
// provides localized display totals, and verifies PayPal currency/country eligibility.

import { getCartItems, getProductById, validateCouponCode } from './database';
import { enrichProductForPreferences, mapDbProductToProduct } from './products';
import {
  convertAmountWithRates,
  ExchangeRatesData,
  fromMinorUnits,
  toMinorUnits,
} from './exchange-rates';
import { ResolvedLocalePreferences } from './preferences';
import { DEFAULT_COUNTRY } from './countries';
import { CartItem, CartSummary, CouponInfo } from '@/types';

const FALLBACK_RATES: ExchangeRatesData = {
  rates: {
    USD: 1.0,
    EUR: 0.92,
    GBP: 0.79,
    INR: 83.25,
    CAD: 1.36,
    AUD: 1.52,
    JPY: 155.4,
  },
  timestamp: new Date().toISOString(),
  source: 'Fallback',
};

export function buildCartSummary(
  ownerId: string,
  couponCode?: string,
  prefs?: ResolvedLocalePreferences,
  ratesData: ExchangeRatesData = FALLBACK_RATES
): {
  summary: CartSummary;
  couponError?: string;
} {
  const rows = getCartItems(ownerId);
  const targetCurrency = (prefs?.currencyCode || 'USD').toUpperCase();
  const countryCfg = prefs?.country || DEFAULT_COUNTRY;

  const items: CartItem[] = [];
  const agentPayItems: CartItem[] = [];
  const externalItems: CartItem[] = [];

  let agentPaySubtotalCents = 0;
  let externalSubtotalCents = 0;
  let displayAgentPayMinor = 0;
  let displayExternalMinor = 0;

  for (const row of rows) {
    const dbProd = getProductById(row.product_id);
    if (!dbProd) continue;

    const rawProduct = mapDbProductToProduct(dbProd);
    const product = enrichProductForPreferences(rawProduct, targetCurrency, ratesData);
    const qty = Math.max(1, Math.floor(row.quantity));

    const origPrice = product.originalPrice;
    const origCurrency = product.originalCurrency;
    const origLineTotal = fromMinorUnits(toMinorUnits(origPrice, origCurrency) * qty, origCurrency);

    const dispPrice = product.displayPrice ?? origPrice;
    const dispLineTotal = fromMinorUnits(toMinorUnits(dispPrice, targetCurrency) * qty, targetCurrency);

    // Canonical settlement amount per line item in USD cents
    const unitUSD = convertAmountWithRates(origPrice, origCurrency, 'USD', ratesData.rates).amountUSD;
    const lineTotalCents = toMinorUnits(unitUSD, 'USD') * qty;
    const lineTotal = fromMinorUnits(lineTotalCents, 'USD');

    const cartItem: CartItem = {
      id: row.id,
      productId: product.id,
      quantity: qty,
      product,
      lineTotal,
      originalPrice: origPrice,
      originalCurrency: origCurrency,
      originalLineTotal: origLineTotal,
      displayPrice: dispPrice,
      displayCurrency: targetCurrency,
      displayLineTotal: dispLineTotal,
      exchangeRate: product.exchangeRate,
      priceIsConverted: Boolean(product.priceIsConverted),
      addedAt: row.added_at,
    };

    items.push(cartItem);
    const dispLineMinor = toMinorUnits(dispLineTotal, targetCurrency);

    if (product.checkoutType === 'external') {
      externalItems.push(cartItem);
      externalSubtotalCents += lineTotalCents;
      displayExternalMinor += dispLineMinor;
    } else {
      agentPayItems.push(cartItem);
      agentPaySubtotalCents += lineTotalCents;
      displayAgentPayMinor += dispLineMinor;
    }
  }

  const agentPaySubtotal = fromMinorUnits(agentPaySubtotalCents, 'USD');
  const externalSubtotal = fromMinorUnits(externalSubtotalCents, 'USD');
  const subtotal = fromMinorUnits(agentPaySubtotalCents + externalSubtotalCents, 'USD');

  const displayAgentPaySubtotal = fromMinorUnits(displayAgentPayMinor, targetCurrency);
  const displayExternalSubtotal = fromMinorUnits(displayExternalMinor, targetCurrency);
  const displaySubtotal = fromMinorUnits(displayAgentPayMinor + displayExternalMinor, targetCurrency);

  let appliedCoupon: CouponInfo | null = null;
  let couponError: string | undefined;
  let discountCents = 0;

  if (couponCode && couponCode.trim()) {
    if (agentPaySubtotal <= 0) {
      couponError = 'Coupons apply only to AgentPay Checkout items in your cart.';
    } else {
      const couponResult = validateCouponCode(couponCode.trim(), agentPaySubtotal);
      if (!couponResult.valid || !couponResult.coupon) {
        couponError = couponResult.error || `Coupon "${couponCode}" is invalid or expired.`;
      } else {
        const dbCoupon = couponResult.coupon;
        discountCents = Math.min(toMinorUnits(couponResult.discountAmount, 'USD'), agentPaySubtotalCents);
        appliedCoupon = {
          code: dbCoupon.code,
          description: dbCoupon.description,
          discountType: dbCoupon.discount_type,
          discountValue: dbCoupon.discount_value,
          minOrderAmount: dbCoupon.min_order_amount,
          maxDiscount: dbCoupon.max_discount ?? undefined,
          active: dbCoupon.active === 1,
          expiresAt: dbCoupon.expires_at,
          eligibleScope: dbCoupon.eligible_scope,
        };
      }
    }
  }

  const discountedSubtotalCents = Math.max(0, agentPaySubtotalCents - discountCents);
  const shippingCents = 0;
  const finalPayableCents = discountedSubtotalCents + shippingCents;

  const discountAmount = fromMinorUnits(discountCents, 'USD');
  const finalPayableAmount = fromMinorUnits(finalPayableCents, 'USD');

  const displayDiscountAmount = convertAmountWithRates(
    discountAmount,
    'USD',
    targetCurrency,
    ratesData.rates
  ).displayAmount;
  const displayShippingAmount = 0;
  const displayFinalMinor = Math.max(
    0,
    displayAgentPayMinor -
      toMinorUnits(displayDiscountAmount, targetCurrency) +
      toMinorUnits(displayShippingAmount, targetCurrency)
  );
  const displayFinalPayableAmount = fromMinorUnits(displayFinalMinor, targetCurrency);

  const usdToTargetRate = convertAmountWithRates(1, 'USD', targetCurrency, ratesData.rates).rate;

  const paypalCheckoutAllowed = Boolean(countryCfg.paypalCheckoutSupported);
  const paypalSettlementCurrency = countryCfg.paypalSupportedCurrency ? targetCurrency : 'USD';
  const paypalEligibilityNote = !countryCfg.paypalSupportedCurrency
    ? `${countryCfg.currencyCode} is not a supported domestic PayPal settlement currency. Checkout settles in verified USD ($${finalPayableAmount.toFixed(2)} USD) only upon explicit confirmation.`
    : countryCfg.notes;

  return {
    summary: {
      items,
      agentPayItems,
      externalItems,
      itemCount: items.reduce((s, it) => s + it.quantity, 0),
      agentPaySubtotal,
      externalSubtotal,
      subtotal,
      discountAmount,
      shippingAmount: 0,
      finalPayableAmount,
      appliedCoupon,
      currency: 'USD',
      displayCurrency: targetCurrency,
      displayAgentPaySubtotal,
      displayExternalSubtotal,
      displaySubtotal,
      displayDiscountAmount,
      displayShippingAmount,
      displayFinalPayableAmount,
      exchangeRate: usdToTargetRate,
      exchangeRateTimestamp: ratesData.timestamp,
      selectedCountryCode: countryCfg.code,
      paypalCheckoutAllowed,
      paypalSettlementCurrency,
      paypalEligibilityNote,
    },
    couponError,
  };
}
