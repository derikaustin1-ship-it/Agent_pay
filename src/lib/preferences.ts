// src/lib/preferences.ts
// Single Source of Truth preference resolver for server API routes and AI services.
// Resolution priority:
//   1) Explicit country/currency parameters on the incoming request
//   2) Authenticated user's persisted preferences in the database
//   3) Persisted `agentpay_locale_pref` HTTP cookie (supports guests & pre-hydration SSR)
//   4) Default country configuration (US / USD / en-US)

import { cookies } from 'next/headers';
import { getAuthenticatedUser } from './auth';
import { getUserPreference } from './database';
import {
  CountryConfig,
  DEFAULT_COUNTRY,
  getCountryByCode,
  getCountryByCurrency,
} from './countries';

export const LOCALE_PREF_COOKIE = 'agentpay_locale_pref';

export interface ResolvedLocalePreferences {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  locale: string;
  country: CountryConfig;
}

/**
 * Resolve country, currency, and locale cleanly on the server without falling back
 * blindly to USD when the user has already chosen a country/currency.
 */
export async function resolveServerPreferences(
  explicitCountryCode?: string | null,
  explicitCurrencyCode?: string | null
): Promise<ResolvedLocalePreferences> {
  let rawCountryCode = explicitCountryCode?.trim().toUpperCase() || '';
  let rawCurrencyCode = explicitCurrencyCode?.trim().toUpperCase() || '';

  // Try cookie next if explicit params are missing
  if (!rawCountryCode && !rawCurrencyCode) {
    try {
      const cookieStore = await cookies();
      const rawCookie = cookieStore.get(LOCALE_PREF_COOKIE)?.value;
      if (rawCookie) {
        const parsed = JSON.parse(rawCookie) as {
          countryCode?: string;
          currencyCode?: string;
        };
        if (parsed.countryCode) rawCountryCode = parsed.countryCode.trim().toUpperCase();
        if (parsed.currencyCode) rawCurrencyCode = parsed.currencyCode.trim().toUpperCase();
      }
    } catch {
      // Ignore malformed cookie
    }
  }

  // Try authenticated DB record if still missing
  if (!rawCountryCode && !rawCurrencyCode) {
    try {
      const user = await getAuthenticatedUser();
      if (user) {
        const dbPref = getUserPreference(user.id);
        if (dbPref) {
          rawCountryCode = dbPref.country_code?.toUpperCase() || '';
          rawCurrencyCode = dbPref.currency_code?.toUpperCase() || '';
        }
      }
    } catch {
      // Ignore auth lookup errors in non-request contexts
    }
  }

  // Derive CountryConfig from countryCode first, or currencyCode, or DEFAULT_COUNTRY
  let countryConfig: CountryConfig | undefined;
  if (rawCountryCode) {
    countryConfig = getCountryByCode(rawCountryCode);
  }
  if (!countryConfig && rawCurrencyCode) {
    countryConfig = getCountryByCurrency(rawCurrencyCode);
  }
  if (!countryConfig) {
    countryConfig = DEFAULT_COUNTRY;
  }

  const finalCurrencyCode = rawCurrencyCode || countryConfig.currencyCode;

  return {
    countryCode: countryConfig.code,
    countryName: countryConfig.name,
    currencyCode: finalCurrencyCode,
    locale: countryConfig.locale,
    country: countryConfig,
  };
}
