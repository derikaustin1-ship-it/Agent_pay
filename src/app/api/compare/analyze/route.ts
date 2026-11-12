// src/app/api/compare/analyze/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getProduct } from '@/lib/products';
import { generateComparisonAdviceWithGemini, isGeminiConfigured } from '@/lib/gemini';
import { resolveServerPreferences } from '@/lib/preferences';
import { formatCurrency } from '@/lib/exchange-rates';
import { Product } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds, userGoal } = body as { productIds?: string[]; userGoal?: string };

    if (!Array.isArray(productIds) || productIds.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Please select at least 2 products to compare.' },
        { status: 400 }
      );
    }

    const prefs = await resolveServerPreferences();
    const products: Product[] = [];
    for (const id of productIds.slice(0, 4)) {
      const p = await getProduct(id, prefs.currencyCode);
      if (p) products.push(p);
    }

    if (products.length < 2) {
      return NextResponse.json(
        { success: false, error: 'At least 2 valid products are required for comparison.' },
        { status: 400 }
      );
    }

    if (isGeminiConfigured()) {
      try {
        const advice = await generateComparisonAdviceWithGemini(products, userGoal || '');
        return NextResponse.json({ success: true, data: { ...advice, source: 'gemini' } });
      } catch (err) {
        console.warn('Gemini comparison advice failed, using factual fallback:', err);
      }
    }

    // Factual heuristic fallback using FX-normalized display prices
    const sortedByPrice = [...products].sort(
      (a, b) => (a.displayPrice ?? a.price) - (b.displayPrice ?? b.price)
    );
    const sortedByRating = [...products].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const bestValue = sortedByPrice[0];
    const topRated = sortedByRating[0];
    const fmt = (p: Product) => {
      const curr = p.displayCurrency || p.originalCurrency || 'USD';
      const val = p.displayPrice ?? p.price;
      return `${formatCurrency(val, curr, prefs.locale)} (${curr})`;
    };

    return NextResponse.json({
      success: true,
      data: {
        winnerProductId: topRated.id,
        bestValueId: bestValue.id,
        summary: `${topRated.name} leads on recorded rating (${topRated.rating ? `${topRated.rating}/5` : 'N/A'}), while ${bestValue.name} offers the lowest price at ${fmt(bestValue)}.`,
        tradeOffs: products.map(
          (p) =>
            `${p.name}: ${fmt(p)} · ${
              p.rating ? `${p.rating}/5 rating` : 'No rating data'
            } · ${p.checkoutType === 'agentpay' ? 'AgentPay Checkout' : `External (${p.seller})`}`
        ),
        source: 'factual_catalog',
      },
    });
  } catch (error) {
    console.error('Compare analyze error:', error);
    return NextResponse.json({ success: false, error: 'Comparison analysis failed' }, { status: 500 });
  }
}
