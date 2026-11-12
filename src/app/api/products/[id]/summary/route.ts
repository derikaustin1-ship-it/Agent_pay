// src/app/api/products/[id]/summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getProduct } from '@/lib/products';
import { generateProductSummaryWithGemini, isGeminiConfigured } from '@/lib/gemini';
import { resolveServerPreferences } from '@/lib/preferences';
import { formatCurrency } from '@/lib/exchange-rates';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const prefs = await resolveServerPreferences();
    const product = await getProduct(decodeURIComponent(id), prefs.currencyCode);
    if (!product) {
      return NextResponse.json({ success: false, error: 'Product not found' }, { status: 404 });
    }

    if (isGeminiConfigured()) {
      try {
        const aiSummary = await generateProductSummaryWithGemini(product);
        return NextResponse.json({
          success: true,
          data: { ...aiSummary, source: 'gemini' },
        });
      } catch (err) {
        console.warn('Gemini product summary failed, returning factual fallback:', err);
      }
    }

    const dispCurr = product.displayCurrency || product.originalCurrency || 'USD';
    const dispAmt = product.displayPrice ?? product.price;
    const formattedPrice = formatCurrency(dispAmt, dispCurr, prefs.locale);

    // Grounded factual fallback from actual product fields only
    return NextResponse.json({
      success: true,
      data: {
        headline: `${product.brand} ${product.name} — ${formattedPrice} (${dispCurr})`,
        keyHighlights:
          product.features && product.features.length > 0
            ? product.features.slice(0, 4)
            : [product.description.slice(0, 120) || 'Listed by ' + product.seller],
        bestSuitedFor: `Shoppers looking for ${product.category} options from ${product.brand}.`,
        thingsToVerify: [
          product.checkoutType === 'agentpay'
            ? 'Eligible for AgentPay PayPal Checkout with budget guard.'
            : `Sold via external merchant (${product.seller}). Review merchant shipping and return terms before buying.`,
          product.rating
            ? `Customer rating: ${product.rating}/5 across ${product.reviewCount || 0} reviews.`
            : 'No customer rating data recorded in the catalogue.',
        ],
        source: 'factual_catalog',
      },
    });
  } catch (error) {
    console.error('Product summary GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to generate product summary' }, { status: 500 });
  }
}
