// src/app/api/user/preferences/route.ts
// Country & currency preference API — scoped to authenticated user or HttpOnly preference cookie for guests

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUserPreference, updateUserPreference } from '@/lib/database';
import { getCountryByCode } from '@/lib/countries';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const GUEST_PREF_COOKIE = 'agentpay_locale_pref';

export async function GET() {
  try {
    const user = await getAuthenticatedUser();

    if (user) {
      const pref = getUserPreference(user.id);
      if (!pref) {
        return NextResponse.json({ success: true, data: null });
      }
      const country = getCountryByCode(pref.country_code);
      return NextResponse.json({
        success: true,
        data: {
          countryCode: pref.country_code,
          currencyCode: pref.currency_code,
          country,
          updatedAt: pref.updated_at,
        },
      });
    }

    // Guest visitor: read guest cookie preference if set
    const cookieStore = await cookies();
    const raw = cookieStore.get(GUEST_PREF_COOKIE)?.value;
    if (!raw) {
      return NextResponse.json({ success: true, data: null });
    }
    try {
      const parsed = JSON.parse(raw) as { countryCode: string; currencyCode: string; updatedAt: string };
      const country = getCountryByCode(parsed.countryCode);
      return NextResponse.json({
        success: true,
        data: {
          countryCode: country.code,
          currencyCode: parsed.currencyCode || country.currencyCode,
          country,
          updatedAt: parsed.updatedAt,
        },
      });
    } catch {
      return NextResponse.json({ success: true, data: null });
    }
  } catch (error) {
    console.error('Error fetching user preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve preferences' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { countryCode, currencyCode } = body;

    if (!countryCode || !currencyCode) {
      return NextResponse.json(
        { success: false, error: 'Both countryCode and currencyCode are required' },
        { status: 400 }
      );
    }

    const country = getCountryByCode(countryCode);
    const upperCurrency = currencyCode.toUpperCase();
    const user = await getAuthenticatedUser();

    if (user) {
      const updated = updateUserPreference(user.id, country.code, upperCurrency);
      return NextResponse.json({
        success: true,
        data: {
          countryCode: updated.country_code,
          currencyCode: updated.currency_code,
          country,
          updatedAt: updated.updated_at,
        },
      });
    }

    const now = new Date().toISOString();
    const payload = {
      countryCode: country.code,
      currencyCode: upperCurrency,
      country,
      updatedAt: now,
    };

    const res = NextResponse.json({ success: true, data: payload });
    res.cookies.set(
      GUEST_PREF_COOKIE,
      JSON.stringify({ countryCode: country.code, currencyCode: upperCurrency, updatedAt: now }),
      {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 365 * 24 * 60 * 60,
      }
    );
    return res;
  } catch (error) {
    console.error('Error saving user preferences:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
