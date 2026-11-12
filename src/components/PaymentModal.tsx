// src/components/PaymentModal.tsx
// Secure Payment Approval Screen for PayPal Sandbox with Smart Budget Protection
// Features server-side spending validation, explicit user authorization,
// PayPal Sandbox order creation, and direct user approval redirect.

'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { BudgetValidationResult } from '@/types';
import CurrencyDisplay from './CurrencyDisplay';
import { formatCurrency } from '@/lib/exchange-rates';
import {
  ShieldCheckIcon,
  ShieldAlertIcon,
  CreditCardIcon,
  XIcon,
  AlertCircleIcon,
  ArrowRightIcon,
  SlidersIcon,
  AlertTriangleIcon,
} from './Icons';

export default function PaymentModal() {
  const { state, cancelCheckout, dispatch, sendMessage, openAuthModal } = useApp();
  const { selectedProduct, showCheckout, budget, user } = state;

  const [step, setStep] = useState<'validating' | 'review' | 'redirecting' | 'blocked' | 'external' | 'error'>('validating');
  const [validation, setValidation] = useState<BudgetValidationResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [approvalUrl, setApprovalUrl] = useState<string | null>(null);
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [isPreparingOrder, setIsPreparingOrder] = useState(false);

  // Run backend budget validation whenever modal opens with a selected product
  useEffect(() => {
    if (!showCheckout || !selectedProduct) return;

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      if (selectedProduct.product.checkoutType === 'external') {
        setStep('external');
        return;
      }
      if (!user) {
        cancelCheckout();
        openAuthModal();
        return;
      }
      setStep('validating');
      setErrorMessage('');
      setValidation(null);
      setApprovalUrl(null);
      setPaypalOrderId(null);
      setIsPreparingOrder(false);

      // Perform strict server-side budget validation
      void validateOnBackend(selectedProduct.product.id);
    });

    return () => {
      cancelled = true;
    };
  }, [showCheckout, selectedProduct, user, cancelCheckout, openAuthModal]);

  if (!showCheckout || !selectedProduct) return null;

  const { product } = selectedProduct;
  const maxPurchase = budget?.maxPurchaseAmount || 100;

  async function validateOnBackend(productId: string) {
    try {
      const res = await fetch('/api/budget/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to validate spending limits on server.');
      }

      const result: BudgetValidationResult = json.data;
      setValidation(result);

      if (result.allowed) {
        setStep('review');
      } else {
        setStep('blocked');
      }
    } catch (err) {
      console.error('Budget validation error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Unable to complete budget verification.');
      setStep('error');
    }
  }

  // Handle user clicking "Continue to PayPal for Approval"
  async function handleProceedToPayPal() {
    if (!validation || !validation.allowed) {
      setStep('blocked');
      return;
    }

    setIsPreparingOrder(true);
    setStep('redirecting');
    setErrorMessage('');

    try {
      const needsSettlementConfirm = !state.userPreferences.country?.paypalSupportedCurrency;
      // Create PayPal Sandbox Order after validating budget server-side
      const createRes = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          confirmedSettlementCurrency: needsSettlementConfirm ? 'USD' : undefined,
        }),
      });

      const createData = await createRes.json();

      if (!createRes.ok || !createData.success) {
        if (createRes.status === 403 || createData.error?.includes('Budget')) {
          setStep('blocked');
          setIsPreparingOrder(false);
          return;
        }
        throw new Error(createData.error || 'Failed to prepare PayPal Sandbox order');
      }

      const returnedApprovalUrl = createData.data.approvalUrl;
      const returnedOrderId = createData.data.paypalOrderId;

      setPaypalOrderId(returnedOrderId);
      setApprovalUrl(returnedApprovalUrl);

      // If PayPal returns approval URL, redirect user to PayPal Sandbox approval screen
      if (returnedApprovalUrl) {
        window.location.href = returnedApprovalUrl;
      } else {
        // Fallback for simulated/demo order
        window.location.href = `/?payment=approved&paypalOrderId=${returnedOrderId}`;
      }
    } catch (err) {
      console.error('PayPal order preparation error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to redirect to PayPal Sandbox.');
      setStep('error');
      setIsPreparingOrder(false);
    }
  }

  function handleFindCheaperAlternatives() {
    cancelCheckout();
    dispatch({ type: 'SET_PAGE', payload: 'assistant' });
    const ceiling = validation?.maxPurchaseAmount || maxPurchase;
    const budgetCurr = validation?.budgetCurrency || budget?.currency || state.userPreferences.currencyCode || 'USD';
    sendMessage(`Find cheaper alternatives to ${product.name} under ${formatCurrency(ceiling, budgetCurr)}`);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden transform transition-all">
        {/* Modal Header */}
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-bold">
              <CreditCardIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-slate-900 text-base">PayPal Order Review</h3>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Verified Checkout
                </span>
              </div>
              <p className="text-xs text-slate-500">Explicit User Approval Required · Budget Protected</p>
            </div>
          </div>
          <button
            onClick={cancelCheckout}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          {/* STEP 0: VALIDATING SPENDING LIMITS ON SERVER */}
          {step === 'validating' && (
            <div className="text-center py-10 space-y-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div>
                <h4 className="text-base font-bold text-slate-900">Verifying Spending Controls...</h4>
                <p className="text-xs text-slate-500 mt-1">Reading actual product price from database and checking against limits</p>
              </div>
            </div>
          )}

          {/* STEP 1: REVIEW SCREEN (Budget Pre-Approved) */}
          {step === 'review' && validation && (
            <div className="space-y-4">
              {/* Product Preview Row */}
              <div className="flex items-center space-x-4 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-16 h-16 rounded-xl object-cover bg-slate-200 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider block">
                    {product.brand}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm truncate">{product.name}</h4>
                  <p className="text-xs text-slate-500">Sold by {product.seller}</p>
                </div>
                <div className="text-right">
                  <CurrencyDisplay
                    amountUSD={validation.actualPrice}
                    fromCurrency={validation.currency || 'USD'}
                    showOriginal={true}
                    size="md"
                  />
                </div>
              </div>

              {/* Order Total Breakdown */}
              <div className="space-y-1.5 text-xs border-y border-slate-100 py-2.5 text-slate-600">
                <div className="flex justify-between">
                  <span>Server-Verified Product Price</span>
                  <span className="font-medium text-slate-800">
                    {formatCurrency(validation.actualPrice, validation.currency || 'USD')} {validation.currency || 'USD'}
                  </span>
                </div>
                {state.userPreferences?.currencyCode &&
                  state.userPreferences.currencyCode !== (validation.currency || 'USD') && (
                  <div className="flex justify-between text-blue-600 font-medium">
                    <span>Local Display Equivalent</span>
                    <CurrencyDisplay
                      amountUSD={validation.actualPrice}
                      fromCurrency={validation.currency || 'USD'}
                      size="sm"
                    />
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Processing & Handling</span>
                  <span className="text-emerald-600 font-medium">Free</span>
                </div>
                <div className="flex justify-between font-bold text-slate-900 text-sm pt-2 border-t border-slate-100">
                  <span>Total Product Value</span>
                  <span className="text-blue-600">
                    {formatCurrency(validation.actualPrice, validation.currency || 'USD')} {validation.currency || 'USD'}
                  </span>
                </div>
                {(validation.currency || 'USD') !== 'USD' && (
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-1">
                    PayPal Sandbox settles payments in USD using verified server exchange rates.
                  </div>
                )}
              </div>

              {/* Budget Approved Banner */}
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-950 space-y-1.5">
                <div className="flex items-center justify-between font-bold text-emerald-900">
                  <div className="flex items-center space-x-1.5">
                    <ShieldCheckIcon className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Budget Verified & Approved ({validation.budgetCurrency || 'USD'})</span>
                  </div>
                  {validation.isBoundaryMatch && (
                    <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-2 py-0.5 rounded-full">
                      Exact Limit Match
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between text-[11px] text-emerald-800 font-medium">
                  <span>
                    Single Purchase Limit:{' '}
                    <strong>
                      {formatCurrency(validation.maxPurchaseAmount, validation.budgetCurrency || 'USD')}{' '}
                      {validation.budgetCurrency || 'USD'}
                    </strong>
                  </span>
                  <span>
                    Daily Remaining:{' '}
                    <strong>
                      {formatCurrency(validation.remainingDailyBudget, validation.budgetCurrency || 'USD')}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Regional India / Currency Notification */}
              {state.userPreferences?.country?.paypalDomesticUnavailable && (
                <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-[11px] text-amber-900 space-y-1">
                  <div className="font-bold flex items-center space-x-1.5 text-amber-950">
                    <AlertTriangleIcon className="w-3.5 h-3.5 text-amber-600" />
                    <span>India Regional Payment Guidance</span>
                  </div>
                  <p className="leading-relaxed">
                    {state.userPreferences.country.currencyCode} is a display-only currency. Continuing confirms PayPal USD Sandbox settlement using server-verified rates.
                  </p>
                </div>
              )}

              {/* Explicit Authorization Notice */}
              <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-200/80 text-[11px] text-blue-950 space-y-1">
                <div className="font-bold flex items-center space-x-1.5 text-blue-900">
                  <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
                  <span>PayPal Explicit Authorization</span>
                </div>
                <p className="leading-relaxed text-blue-900/90">
                  You will be securely redirected to PayPal to review and approve this specific transaction. No charges occur without your explicit authorization.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-3 pt-1">
                <button
                  type="button"
                  onClick={cancelCheckout}
                  className="w-1/3 py-3 px-4 rounded-xl border border-slate-300 font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={handleProceedToPayPal}
                  disabled={isPreparingOrder}
                  className="w-2/3 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-blue-600/25 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
                >
                  <span>Continue to PayPal for Approval</span>
                  <ArrowRightIcon className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: REDIRECTING TO PAYPAL */}
          {step === 'redirecting' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">Redirecting to PayPal...</h4>
                <p className="text-xs text-slate-500">Creating verified order and loading the secure approval page</p>
              </div>
              {approvalUrl && (
                <div className="pt-2 text-xs">
                  <a
                    href={approvalUrl}
                    className="text-blue-600 font-bold hover:underline inline-flex items-center space-x-1"
                  >
                    <span>Click here if not redirected automatically</span>
                    <ArrowRightIcon className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
              {paypalOrderId && (
                <p className="text-[11px] text-slate-400 font-mono">
                  Order ID: {paypalOrderId}
                </p>
              )}
            </div>
          )}

          {/* STEP 3: BUDGET BLOCKED SCREEN (Strict Backend Enforcement) */}
          {step === 'blocked' && (
            <div className="text-center py-2 space-y-4 animate-in fade-in duration-200">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
                <ShieldAlertIcon className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-slate-900">Checkout Blocked by Smart Budget Protection</h4>
                <p className="text-xs text-slate-500">Backend Spending Limit Policy Enforced</p>
              </div>

              {/* Clear Explanation Card */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-950 text-left space-y-2">
                <div className="flex items-center space-x-1.5 font-bold text-rose-900">
                  <AlertCircleIcon className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{validation?.message || 'Transaction Exceeds Configured Budget'}</span>
                </div>
                <p className="leading-relaxed text-rose-900/90 text-[11px]">
                  {validation?.explanation || 'This purchase violates configured safety limits.'}
                </p>

                {/* Limit Breakdown Table */}
                {validation && (
                  <div className="mt-3 pt-3 border-t border-rose-200/80 space-y-1.5 text-[11px]">
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Product Price (Database):</span>
                      <strong className="text-slate-900">
                        {formatCurrency(validation.actualPrice, validation.currency || 'USD')} {validation.currency || 'USD'}
                      </strong>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Single Purchase Limit ({validation.budgetCurrency || 'USD'}):</span>
                      <span className={`font-semibold ${validation.withinPurchaseLimit ? 'text-emerald-700' : 'text-rose-700 font-bold'}`}>
                        {formatCurrency(validation.maxPurchaseAmount, validation.budgetCurrency || 'USD')}{' '}
                        {validation.withinPurchaseLimit ? '✓ OK' : '✕ Exceeded'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-slate-600">Recorded Spent Today:</span>
                      <span className="text-slate-800">
                        {formatCurrency(validation.currentDailySpending, validation.budgetCurrency || 'USD')}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-rose-200/50">
                      <span className="text-slate-600">Remaining Daily Budget:</span>
                      <span className={`font-bold ${validation.withinDailyLimit ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {formatCurrency(validation.remainingDailyBudget, validation.budgetCurrency || 'USD')}{' '}
                        {validation.withinDailyLimit ? '✓ Available' : '✕ Insufficient'}
                      </span>
                    </div>
                  </div>
                )}

                <div className="mt-2 pt-2 border-t border-rose-200/70 text-[10px] text-rose-800 font-medium">
                  🔒 Security Notice: No payment order was created or charged. Your balance and limits remain protected.
                </div>
              </div>

              {/* Action Buttons for Blocked Screen */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleFindCheaperAlternatives}
                  className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  Ask AI for Alternatives Under{' '}
                  {formatCurrency(
                    validation?.maxPurchaseAmount || maxPurchase,
                    validation?.budgetCurrency || budget?.currency || state.userPreferences.currencyCode || 'USD'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cancelCheckout();
                    dispatch({ type: 'SET_PAGE', payload: 'budget' });
                  }}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-300 font-semibold text-xs text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <SlidersIcon className="w-3.5 h-3.5 text-slate-500" />
                  <span>Adjust Spending Limits in Settings</span>
                </button>
                <button
                  type="button"
                  onClick={cancelCheckout}
                  className="w-full py-2 text-xs text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
                >
                  Close & Keep Browsing
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: EXTERNAL MERCHANT REDIRECT */}
          {step === 'external' && (
            <div className="space-y-4 py-2">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-1.5">
                <p className="font-bold text-sm">External Merchant Checkout</p>
                <p>
                  This item is discovered live via Channel3 from{' '}
                  <span className="font-semibold">{product.seller}</span>. AgentPay does not capture payment on behalf of external merchants.
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 bg-slate-50">
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-14 h-14 rounded-lg object-contain bg-white p-1 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-900 truncate">{product.name}</p>
                  <p className="text-xs text-slate-500">{product.seller}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={cancelCheckout}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <a
                  href={product.productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    fetch('/api/orders', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ productId: product.id, logOrder: true }),
                    }).catch(() => {});
                    cancelCheckout();
                  }}
                  className="w-1/2 py-2.5 rounded-xl bg-amber-500 text-white text-xs font-bold hover:bg-amber-600 text-center"
                >
                  Open Merchant Site
                </a>
              </div>
            </div>
          )}

          {/* STEP 5: ERROR SCREEN */}
          {step === 'error' && (
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
                <AlertCircleIcon className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-slate-900">Payment Order Issue</h4>
                <p className="text-xs text-rose-600">{errorMessage || 'An error occurred while preparing PayPal checkout.'}</p>
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={cancelCheckout}
                  className="w-1/2 py-2.5 px-4 rounded-xl border border-slate-300 font-semibold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => validateOnBackend(product.id)}
                  className="w-1/2 py-2.5 px-4 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
