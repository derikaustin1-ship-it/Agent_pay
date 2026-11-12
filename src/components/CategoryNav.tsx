'use client';

import React from 'react';
import Link from 'next/link';

const NAV_CATEGORIES = [
  { label: 'All Products', href: '/catalog' },
  { label: 'Electronics', href: '/catalog?category=electronics' },
  { label: 'Mobiles', href: '/catalog?category=mobiles' },
  { label: 'Fashion', href: '/catalog?category=fashion' },
  { label: 'Home & Kitchen', href: '/catalog?category=home-kitchen' },
  { label: 'Beauty', href: '/catalog?category=beauty' },
  { label: 'Grocery', href: '/catalog?category=grocery' },
  { label: 'Sports', href: '/catalog?category=sports' },
  { label: 'Accessories', href: '/catalog?category=accessories' },
  { label: 'Books', href: '/catalog?category=books' },
  { label: 'Shoes', href: '/catalog?category=shoes' },
  { label: 'Outdoor', href: '/catalog?category=outdoor' },
  { label: "Today's Deals", href: '/deals', highlight: true },
];

export function CategoryNav() {
  return (
    <nav
      aria-label="Product categories"
      className="bg-slate-800 border-b border-slate-700 text-slate-200 text-xs"
    >
      <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 overflow-x-auto py-1.5 no-scrollbar">
        {NAV_CATEGORIES.map((cat) => (
          <Link
            key={cat.label}
            href={cat.href}
            className={`shrink-0 rounded-lg px-3 py-1.5 font-medium transition ${
              cat.highlight
                ? 'bg-amber-400/15 text-amber-300 hover:bg-amber-400/25 font-semibold'
                : 'hover:bg-slate-700 hover:text-white'
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
