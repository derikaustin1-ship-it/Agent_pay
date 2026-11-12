'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-16">
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-xs">
        <div className="col-span-2 md:col-span-1 space-y-2.5">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-indigo-600 flex items-center justify-center font-black text-white">
              A
            </div>
            <span className="text-base font-extrabold text-white">AgentPay</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Find smarter. Spend safer. Shop with confidence. Powered by Gemini AI, Channel3 live product discovery, Smart Budget Protection &amp; PayPal Sandbox checkout.
          </p>
        </div>

        <div>
          <h4 className="font-bold text-white uppercase tracking-wider mb-3">Shop</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/catalog" className="hover:text-white">All Products</Link></li>
            <li><Link href="/deals" className="hover:text-white">Today&apos;s Deals &amp; Coupons</Link></li>
            <li><Link href="/compare" className="hover:text-white">Compare Products</Link></li>
            <li><Link href="/wishlist" className="hover:text-white">Wishlist &amp; Price Alerts</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white uppercase tracking-wider mb-3">Account &amp; Safety</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/account" className="hover:text-white">Your Account</Link></li>
            <li><Link href="/orders" className="hover:text-white">Order History</Link></li>
            <li><Link href="/spending" className="hover:text-white">Budget &amp; Spending Guard</Link></li>
            <li><Link href="/rewards" className="hover:text-white">PayPal Rewards Eligibility</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold text-white uppercase tracking-wider mb-3">AI Co-Pilot</h4>
          <ul className="space-y-2 text-slate-400">
            <li><Link href="/assistant" className="hover:text-white">Full-Screen AI Assistant</Link></li>
            <li><Link href="/cart" className="hover:text-white">Shopping Cart</Link></li>
            <li><Link href="/checkout" className="hover:text-white">Multi-Product Checkout</Link></li>
          </ul>
        </div>
      </div>

      <div className="border-t border-slate-800 bg-slate-950/60 py-4 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-400">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Server-side PayPal Sandbox verification &amp; strict budget enforcement
          </span>
          <span>External merchant listings redirect directly to merchant checkout pages.</span>
        </div>
      </div>
    </footer>
  );
}
