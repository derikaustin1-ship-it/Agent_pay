'use client';

import React, { Suspense, useEffect, useState, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import PaymentResultModal, { PaymentResultData } from '@/components/PaymentResultModal';

function PaymentResultInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { loadCart, loadOrders, loadSpendingSummary, loadNotifications } = useApp();

  const [paymentResult, setPaymentResult] = useState<PaymentResultData | null>(null);
  const processedOrderRef = useRef<string | null>(null);

  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const paypalOrderId = searchParams.get('token') || searchParams.get('paypalOrderId');
    const reason = searchParams.get('reason');

    if (!paymentStatus) return;

    const cleanUrl = () => {
      router.replace(pathname || '/', { scroll: false });
    };

    if (paymentStatus === 'approved' && paypalOrderId) {
      if (processedOrderRef.current === paypalOrderId) return;
      processedOrderRef.current = paypalOrderId;

      (async () => {
        await Promise.resolve();
        setPaymentResult({ state: 'pending', paypalOrderId });
        try {
          const res = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paypalOrderId }),
          });
          const data = await res.json();
          if (data.success && data.data) {
            setPaymentResult({
              state: 'success',
              paypalOrderId: data.data.paypalOrderId,
              captureId: data.data.captureId,
              amount: data.data.amount,
              currency: data.data.currency,
              productName: data.data.productName,
              productImage: data.data.productImage,
              alreadyCaptured: data.alreadyCaptured,
            });
            await Promise.all([
              loadCart(),
              loadOrders(),
              loadSpendingSummary(),
              loadNotifications(),
            ]);
          } else {
            setPaymentResult({
              state: 'failed',
              paypalOrderId,
              errorMessage: data.error || 'Payment capture could not be completed.',
            });
          }
        } catch (err) {
          setPaymentResult({
            state: 'failed',
            paypalOrderId,
            errorMessage:
              err instanceof Error ? err.message : 'Network error verifying PayPal payment.',
          });
        } finally {
          cleanUrl();
        }
      })();
    } else if (paymentStatus === 'cancelled') {
      void Promise.resolve().then(() => {
        setPaymentResult({
          state: 'cancelled',
          paypalOrderId: paypalOrderId || undefined,
        });
        cleanUrl();
      });
    } else if (paymentStatus === 'failed') {
      void Promise.resolve().then(() => {
        setPaymentResult({
          state: 'failed',
          paypalOrderId: paypalOrderId || undefined,
          errorMessage: reason || 'PayPal checkout did not complete.',
        });
        cleanUrl();
      });
    }
  }, [searchParams, router, pathname, loadCart, loadOrders, loadSpendingSummary, loadNotifications]);

  return (
    <PaymentResultModal
      result={paymentResult}
      onClose={() => setPaymentResult(null)}
      onViewOrders={() => {
        setPaymentResult(null);
        router.push('/orders');
      }}
    />
  );
}

export function PaymentResultHandler() {
  return (
    <Suspense fallback={null}>
      <PaymentResultInner />
    </Suspense>
  );
}
