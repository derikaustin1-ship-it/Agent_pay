'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Product, CouponInfo } from '@/types';
import { useApp } from '@/context/AppContext';
import { StoreProductCard } from '@/components/StoreProductCard';
import {
  Sparkles,
  ShieldCheck,
  Tag,
  TrendingUp,
  Clock,
  Flame,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Laptop,
  Shirt,
  Home as HomeIcon,
  HeartHandshake,
  ShoppingBasket,
  Dumbbell,
  BookOpen,
  Watch,
  Footprints,
  Mountain,
} from 'lucide-react';

interface HomeData {
  maxBudget: number;
  budgetCurrency?: string;
  maxBudgetInDisplay?: number;
  displayCurrency?: string;
  countryCode?: string;
  todaysDeals: Product[];
  trendingProducts: Product[];
  underBudget: Product[];
  recommendedForYou: Product[];
  aiRecommended: Product[];
  featuredProducts: Product[];
  newArrivals: Product[];
  recentlyViewed: Product[];
  categoryCounts: Record<string, number> | Array<{ category: string; count: number }>;
  coupons: CouponInfo[];
}

const HERO_SLIDES = [
  {
    badge: 'Smart E-Commerce + Budget Guard',
    title: 'Find smarter. Spend safer. Shop with confidence.',
    subtitle:
      'Discover top products across curated inventory and live Channel3 merchants with real-time AI advice, verified coupons, and automated PayPal Sandbox budget protection.',
    primaryCta: { label: 'Shop All Products', href: '/catalog' },
    secondaryCta: { label: "Explore Today's Deals", href: '/deals' },
    gradient: 'from-slate-900 via-indigo-950 to-blue-900',
  },
  {
    badge: 'Verified Storewide Promo • AGENT10',
    title: 'Save 10% on Eligible AgentPay Orders Over $50',
    subtitle:
      'Apply code AGENT10 (orders $50+) or SAVE15 ($15 off $100+) at checkout. Backend-verified totals ensure you never exceed your daily or per-purchase spending cap.',
    primaryCta: { label: 'Browse Deals & Coupons', href: '/deals' },
    secondaryCta: { label: 'Configure Budget Limits', href: '/account' },
    gradient: 'from-indigo-900 via-blue-900 to-emerald-900',
  },
  {
    badge: 'AI Shopping Co-Pilot + Live Discovery',
    title: 'Ask Gemini to Compare, Filter & Guard Your Budget',
    subtitle:
      'Try "Find me the best phone under ₹20,000" or "Compare two laptops for coding" in the floating AI Co-Pilot — backed by live catalog specs and real merchant links.',
    primaryCta: { label: 'Open Full AI Assistant', href: '/assistant' },
    secondaryCta: { label: 'Compare Products', href: '/compare' },
    gradient: 'from-slate-900 via-purple-950 to-indigo-900',
  },
];

const POPULAR_CATEGORIES = [
  { id: 'electronics', label: 'Electronics', icon: Laptop, color: 'bg-blue-50 text-blue-600' },
  { id: 'mobiles', label: 'Mobiles', icon: Smartphone, color: 'bg-indigo-50 text-indigo-600' },
  { id: 'fashion', label: 'Fashion', icon: Shirt, color: 'bg-rose-50 text-rose-600' },
  { id: 'home-kitchen', label: 'Home & Kitchen', icon: HomeIcon, color: 'bg-amber-50 text-amber-600' },
  { id: 'beauty', label: 'Beauty', icon: HeartHandshake, color: 'bg-pink-50 text-pink-600' },
  { id: 'grocery', label: 'Grocery', icon: ShoppingBasket, color: 'bg-emerald-50 text-emerald-600' },
  { id: 'sports', label: 'Sports', icon: Dumbbell, color: 'bg-orange-50 text-orange-600' },
  { id: 'accessories', label: 'Accessories', icon: Watch, color: 'bg-cyan-50 text-cyan-600' },
  { id: 'books', label: 'Books', icon: BookOpen, color: 'bg-violet-50 text-violet-600' },
  { id: 'shoes', label: 'Footwear', icon: Footprints, color: 'bg-teal-50 text-teal-600' },
  { id: 'outdoor', label: 'Outdoor', icon: Mountain, color: 'bg-lime-50 text-lime-700' },
];

function SectionRow({
  title,
  subtitle,
  icon,
  viewAllHref,
  products,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  viewAllHref: string;
  products: Product[];
}) {
  if (!products || products.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2">
            {icon}
            {title}
          </h2>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-700 shrink-0"
        >
          See all
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {products.slice(0, 4).map((product) => (
          <StoreProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const { state, formatPrice, openCopilot } = useApp();
  const [homeData, setHomeData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [slideIdx, setSlideIdx] = useState(0);

  const activeCountry = state.userPreferences.countryCode;
  const activeCurrency = state.userPreferences.currencyCode;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/products/home?country=${encodeURIComponent(activeCountry)}&currency=${encodeURIComponent(activeCurrency)}`
        );
        const json = await res.json();
        if (active && json.success && json.data) {
          setHomeData(json.data);
        }
      } catch (err) {
        console.error('Failed to load home showcase:', err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [activeCountry, activeCurrency]);

  const slide = HERO_SLIDES[slideIdx];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-10">
      {/* 1. Promotional Hero Carousel Banner */}
      <section className="relative rounded-3xl overflow-hidden shadow-xl text-white">
        <div
          className={`bg-gradient-to-r ${slide.gradient} px-6 py-10 sm:px-12 sm:py-14 transition-colors duration-500`}
        >
          <div className="max-w-2xl space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur-sm px-3 py-1 text-xs font-semibold text-amber-300 border border-white/15">
              <Sparkles className="w-3.5 h-3.5" />
              {slide.badge}
            </span>

            <h1 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
              {slide.title}
            </h1>

            <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
              {slide.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Link
                href={slide.primaryCta.href}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold px-5 py-3 text-sm shadow-md transition"
              >
                {slide.primaryCta.label}
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href={slide.secondaryCta.href}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold px-5 py-3 text-sm border border-white/20 transition"
              >
                {slide.secondaryCta.label}
              </Link>
              <button
                type="button"
                onClick={() => openCopilot('Find the best deals within my budget')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/50 text-indigo-100 font-semibold px-4 py-3 text-sm border border-indigo-400/30 transition"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                Ask AI Co-Pilot
              </button>
            </div>
          </div>
        </div>

        {/* Slide Controls */}
        <div className="absolute bottom-4 right-5 flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous banner"
            onClick={() => setSlideIdx((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
            className="rounded-full bg-black/30 hover:bg-black/50 p-1.5 text-white transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex gap-1.5">
            {HERO_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                aria-label={`Banner ${idx + 1}`}
                onClick={() => setSlideIdx(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === slideIdx ? 'w-6 bg-amber-400' : 'w-2 bg-white/40'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            aria-label="Next banner"
            onClick={() => setSlideIdx((i) => (i + 1) % HERO_SLIDES.length)}
            className="rounded-full bg-black/30 hover:bg-black/50 p-1.5 text-white transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* 2. Verified Coupon Strip & Trust Highlights */}
      {homeData?.coupons && homeData.coupons.length > 0 && (
        <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {homeData.coupons.map((coupon) => (
            <div
              key={coupon.code}
              className="rounded-2xl border border-indigo-200 bg-gradient-to-br from-indigo-50/70 to-white p-4 flex items-center justify-between gap-3"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-md bg-indigo-600 px-2 py-0.5 text-xs font-extrabold text-white tracking-wider">
                    {coupon.code}
                  </span>
                  <span className="text-xs font-bold text-emerald-700">Verified Offer</span>
                </div>
                <p className="text-xs text-slate-600 mt-1.5">{coupon.description}</p>
              </div>
              <Link
                href="/deals"
                className="shrink-0 text-xs font-bold text-indigo-600 hover:underline"
              >
                Use Offer
              </Link>
            </div>
          ))}
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-white p-4 flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            <div>
              <p className="text-xs font-bold text-slate-900">Backend Budget Guard Active</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Current ceiling: {formatPrice(homeData.maxBudget, false, homeData.budgetCurrency || 'USD')} per order before PayPal authorization.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 3. Popular Categories */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
              Shop by Category
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Curated AgentPay inventory &amp; live Channel3 merchant discovery across departments
            </p>
          </div>
          <Link
            href="/catalog"
            className="text-xs font-bold text-indigo-600 hover:text-indigo-700 inline-flex items-center gap-1"
          >
            Browse all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-2.5">
          {POPULAR_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const rawCounts = homeData?.categoryCounts;
            const count = Array.isArray(rawCounts)
              ? (rawCounts.find((c) => c.category === cat.id)?.count ?? null)
              : rawCounts && typeof rawCounts === 'object'
                ? (rawCounts[cat.id] ?? null)
                : null;
            return (
              <Link
                key={cat.id}
                href={`/catalog?category=${cat.id}`}
                className="group rounded-2xl border border-slate-200 bg-white p-3 text-center hover:border-indigo-300 hover:shadow-md transition flex flex-col items-center justify-center gap-2"
              >
                <div
                  className={`h-10 w-10 rounded-xl ${cat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-800 leading-tight">{cat.label}</p>
                  {count !== null && count > 0 && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{count} items</p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-72 rounded-2xl border border-slate-200 bg-white p-4 animate-pulse space-y-3"
            >
              <div className="h-40 rounded-xl bg-slate-100" />
              <div className="h-4 w-3/4 rounded bg-slate-100" />
              <div className="h-4 w-1/2 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : homeData ? (
        <>
          {/* 4. Today's Deals (Verified Original vs Current Price only) */}
          <SectionRow
            title="Today's Verified Deals"
            subtitle="Genuine price drops verified directly against listed catalog retail prices"
            icon={<Tag className="w-5 h-5 text-rose-600" />}
            viewAllHref="/deals"
            products={homeData.todaysDeals}
          />

          {/* 5. Recently Viewed (if any) */}
          <SectionRow
            title="Recently Viewed"
            subtitle="Pick up right where you left off"
            icon={<Clock className="w-5 h-5 text-slate-700" />}
            viewAllHref="/catalog"
            products={homeData.recentlyViewed}
          />

          {/* 6. Best Deals Under Budget */}
          <SectionRow
            title={`Best Picks Under ${formatPrice(homeData.maxBudget, false, homeData.budgetCurrency || 'USD')}`}
            subtitle="Guaranteed within your single-purchase protection limit"
            icon={<ShieldCheck className="w-5 h-5 text-emerald-600" />}
            viewAllHref={`/catalog?maxPrice=${homeData.maxBudgetInDisplay ?? homeData.maxBudget}`}
            products={homeData.underBudget}
          />

          {/* 7. Trending Products */}
          <SectionRow
            title="Trending Now"
            subtitle="Popular top-rated picks across Electronics, Mobiles, Fashion & Home"
            icon={<Flame className="w-5 h-5 text-amber-500" />}
            viewAllHref="/catalog?sort=popularity"
            products={homeData.trendingProducts}
          />

          {/* 8. AI Recommended Products */}
          <SectionRow
            title="AI Recommended For You"
            subtitle="Selected based on price-to-value specs and verified availability"
            icon={<Sparkles className="w-5 h-5 text-indigo-600" />}
            viewAllHref="/catalog?sort=rating_desc"
            products={homeData.aiRecommended}
          />

          {/* 9. Recommended & Featured */}
          <SectionRow
            title="Recommended For Your Lifestyle"
            icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
            viewAllHref="/catalog"
            products={homeData.recommendedForYou}
          />

          {/* 10. Featured & New Arrivals */}
          <SectionRow
            title="New Arrivals"
            subtitle="Latest additions in the AgentPay catalogue"
            icon={<Sparkles className="w-5 h-5 text-violet-600" />}
            viewAllHref="/catalog?sort=newest"
            products={homeData.newArrivals}
          />
        </>
      ) : null}
    </div>
  );
}
