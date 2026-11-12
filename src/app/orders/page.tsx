'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import { Order } from '@/types';
import {
  Package,
  ShieldCheck,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Lock,
  RefreshCw,
} from 'lucide-react';

function StatusBadge({ status }: { status: Order['paymentStatus'] }) {
  if (status === 'captured') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800">
        <CheckCircle2 className="w-3 h-3" />
        Verified Paid
      </span>
    );
  }
  if (status === 'pending' || status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
        <Clock className="w-3 h-3" />
        {status === 'approved' ? 'Approved (Awaiting Capture)' : 'Pending Approval'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
      <XCircle className="w-3 h-3" />
      {status === 'cancelled' ? 'Cancelled' : 'Failed'}
    </span>
  );
}

export default function OrdersPage() {
  const { state, loadOrders, openAuthModal, loginAsDemo, formatPrice, showToast } = useApp();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'captured' | 'pending' | 'external'>('all');

  useEffect(() => {
    if (state.user) {
      loadOrders();
    }
  }, [state.user, loadOrders]);

  const handleCancelOrder = async (orderId: string) => {
    setCancellingId(orderId);
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const json = await res.json();
      if (json.success) {
        await loadOrders();
        showToast('Pending order cancelled cleanly.', 'info');
      } else {
        showToast(json.error || 'Could not cancel order', 'error');
      }
    } finally {
      setCancellingId(null);
    }
  };

  if (!state.user) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Lock className="w-7 h-7" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">Sign in to View Your Orders</h1>
        <p className="text-sm text-slate-500">
          Order history is isolated per authenticated account so no one else can access your receipts.
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={openAuthModal}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => loginAsDemo()}
            className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            1-Click Demo Shopper
          </button>
        </div>
      </div>
    );
  }

  const filtered = state.orders.filter((o) => {
    if (filter === 'captured') return o.paymentStatus === 'captured';
    if (filter === 'pending') return o.paymentStatus === 'pending' || o.paymentStatus === 'approved';
    if (filter === 'external') return o.orderType === 'external';
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2.5">
            <Package className="w-6 h-6 text-indigo-600" />
            Order History &amp; Verification
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Only orders verified by the backend PayPal capture endpoint are marked Paid &amp; counted toward your daily spend.
          </p>
        </div>

        <button
          type="button"
          onClick={() => loadOrders()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all', label: `All Orders (${state.orders.length})` },
          { id: 'captured', label: 'Verified Paid' },
          { id: 'pending', label: 'Pending' },
          { id: 'external', label: 'External Merchant Links' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold border transition ${
              filter === tab.id
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center space-y-3">
          <Package className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-base font-bold text-slate-900">No orders match this view</p>
          <Link
            href="/catalog"
            className="inline-block rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
          >
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((order) => {
            const isExternal = order.orderType === 'external';
            const canCancel =
              !isExternal &&
              (order.paymentStatus === 'pending' || order.paymentStatus === 'approved');
            return (
              <div
                key={order.id}
                className="rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-xs"
              >
                <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-4">
                    <div>
                      <span className="text-slate-400 uppercase font-bold block text-[10px]">
                        Order ID
                      </span>
                      <span className="font-mono font-semibold text-slate-800">{order.id}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase font-bold block text-[10px]">
                        Placed On
                      </span>
                      <span className="font-semibold text-slate-700">
                        {new Date(order.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 uppercase font-bold block text-[10px]">
                        Total
                      </span>
                      <span className="font-extrabold text-slate-900">
                        {formatPrice(order.amount, true, order.currency || 'USD')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isExternal ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900">
                        <ExternalLink className="w-3 h-3" />
                        External Merchant Redirect ({order.merchantName || 'Merchant'})
                      </span>
                    ) : (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                          <ShieldCheck className="w-3 h-3" />
                          AgentPay Checkout
                        </span>
                        <StatusBadge status={order.paymentStatus} />
                      </>
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Line Items */}
                  {order.items && order.items.length > 0 ? (
                    <div className="space-y-2.5">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <img
                              src={item.productImage || order.productImage}
                              alt={item.productName}
                              className="h-12 w-12 rounded-lg object-contain bg-slate-50 p-1 shrink-0"
                            />
                            <div className="min-w-0">
                              <Link
                                href={`/products/${encodeURIComponent(item.productId)}`}
                                className="text-xs font-bold text-slate-900 hover:text-indigo-600 line-clamp-1"
                              >
                                {item.productName}
                              </Link>
                              <p className="text-[11px] text-slate-500">
                                Qty: {item.quantity} × {formatPrice(item.unitPrice, false, order.currency || 'USD')}
                                {item.seller ? ` • Seller: ${item.seller}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-slate-800 shrink-0">
                            {formatPrice(item.lineTotal, false, order.currency || 'USD')}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <img
                        src={order.productImage}
                        alt={order.productName}
                        className="h-14 w-14 rounded-lg object-contain bg-slate-50 p-1 shrink-0"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-900">{order.productName}</p>
                        <p className="text-xs text-slate-500">
                          PayPal Ref: {order.paypalOrderId}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Footer Meta & Actions */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-[11px] text-slate-500">
                    <div className="space-x-3">
                      {order.couponCode && (
                        <span className="font-semibold text-emerald-700">
                          Coupon: {order.couponCode} (-{formatPrice(order.discountAmount || 0, false, order.currency || 'USD')})
                        </span>
                      )}
                      {order.paypalCaptureId && (
                        <span>Capture ID: {order.paypalCaptureId}</span>
                      )}
                      {order.shippingAddress && (
                        <span>
                          Ship to: {order.shippingAddress.fullName}, {order.shippingAddress.city}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isExternal && order.merchantUrl && (
                        <a
                          href={order.merchantUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
                        >
                          Open Merchant Order Page
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                      {canCancel && (
                        <button
                          type="button"
                          disabled={cancellingId === order.id}
                          onClick={() => handleCancelOrder(order.id)}
                          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          {cancellingId === order.id ? 'Cancelling...' : 'Cancel Pending Order'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
