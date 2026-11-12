// src/app/api/products/search/route.ts
// Product catalogue search API with Channel3 + local catalog, filters, sorting, and pagination

import { NextRequest, NextResponse } from 'next/server';
import { queryCatalog } from '@/lib/products';
import { isChannel3Configured } from '@/lib/channel3';
import { resolveServerPreferences } from '@/lib/preferences';
import { ProductSearchParams } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const prefsResolved = await resolveServerPreferences(
      searchParams.get('country'),
      searchParams.get('currency')
    );

    const query = searchParams.get('q') || '';
    const category = searchParams.get('category') || undefined;
    const maxPrice = searchParams.get('maxPrice') ? Number(searchParams.get('maxPrice')) : undefined;
    const minPrice = searchParams.get('minPrice') ? Number(searchParams.get('minPrice')) : undefined;
    const minRating = searchParams.get('minRating') ? Number(searchParams.get('minRating')) : undefined;
    const brandsParam = searchParams.get('brands');
    const brands = brandsParam ? brandsParam.split(',').map((b) => b.trim()).filter(Boolean) : undefined;
    const sort = (searchParams.get('sort') || 'relevance') as ProductSearchParams['sort'];
    const checkoutType = (searchParams.get('checkoutType') || 'all') as ProductSearchParams['checkoutType'];
    const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
    const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 16;

    const result = await queryCatalog({
      query,
      category,
      maxPrice,
      minPrice,
      minRating,
      brands,
      sort,
      checkoutType,
      page,
      limit,
      localePreferences: prefsResolved,
    });

    return NextResponse.json({
      success: true,
      data: result.items,
      pagination: {
        total: result.total,
        page: result.page,
        limit: result.limit,
        totalPages: result.totalPages,
      },
      facets: result.facets,
      meta: {
        source: result.source,
        channel3Active: isChannel3Configured(),
        count: result.items.length,
        countryCode: prefsResolved.countryCode,
        currencyCode: prefsResolved.currencyCode,
      },
    });
  } catch (error: unknown) {
    console.error('Product search error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Product search failed' },
      { status: 500 }
    );
  }
}
