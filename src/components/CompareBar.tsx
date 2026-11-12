'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import { Scale, X, ArrowRight } from 'lucide-react';

export function CompareBar() {
  const pathname = usePathname();
  const { state, toggleCompare, clearCompare } = useApp();

  if (state.compareProducts.length === 0 || pathname === '/compare') return null;

  return (
    <div className="fixed bottom-4 left-4 z-30 max-w-xl rounded-2xl border border-indigo-200 bg-white/95 backdrop-blur-md p-3 shadow-xl flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-700">
        <Scale className="w-4 h-4" />
        Compare ({state.compareProducts.length}/4)
      </div>

      <div className="flex items-center gap-1.5">
        {state.compareProducts.map((p) => (
          <div
            key={p.id}
            className="relative group flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 pl-1.5 pr-2 py-1"
          >
            <img src={p.imageUrl} alt={p.name} className="h-6 w-6 rounded object-contain bg-white" />
            <span className="text-[11px] font-medium text-slate-700 max-w-[90px] truncate">
              {p.name}
            </span>
            <button
              type="button"
              onClick={() => toggleCompare(p)}
              aria-label={`Remove ${p.name} from compare`}
              className="text-slate-400 hover:text-rose-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 ml-auto">
        <button
          type="button"
          onClick={clearCompare}
          className="text-[11px] font-medium text-slate-500 hover:text-slate-800"
        >
          Clear
        </button>
        <Link
          href="/compare"
          className="inline-flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Compare Now
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
}
