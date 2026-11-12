// src/lib/test-country-currency.js
// Automated test script for Country, Currency, and Live Exchange Rate features

const BASE_URL = 'http://localhost:3000';

let cookieJar = '';
function captureCookies(res) {
  const raw = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : (res.headers.get('set-cookie') ? [res.headers.get('set-cookie')] : []);
  const map = new Map();
  if (cookieJar) {
    for (const part of cookieJar.split('; ')) {
      const idx = part.indexOf('=');
      if (idx > 0) map.set(part.slice(0, idx), part.slice(idx + 1));
    }
  }
  for (const entry of raw) {
    const first = entry.split(';')[0];
    const idx = first.indexOf('=');
    if (idx > 0) map.set(first.slice(0, idx).trim(), first.slice(idx + 1).trim());
  }
  cookieJar = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
}

async function apiFetch(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (cookieJar) headers['Cookie'] = cookieJar;
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  captureCookies(res);
  return res;
}

async function runTests() {
  console.log('====================================================');
  console.log('🌍 AGENTPAY: GLOBAL COUNTRY & CURRENCY VERIFICATION');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Exchange Rates API
  try {
    process.stdout.write('👉 TEST 1: Live Exchange Rates API returns valid rates and source... ');
    const res = await fetch(`${BASE_URL}/api/exchange-rates`);
    const json = await res.json();
    if (!res.ok || !json.success || !json.data.rates || !json.data.rates.EUR || !json.data.rates.INR) {
      throw new Error('Invalid exchange rates response payload');
    }
    console.log(`✅ PASSED (USD/EUR: ${json.data.rates.EUR}, USD/INR: ${json.data.rates.INR}, Source: ${json.data.source})`);
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }

  // Test 2: User Preference Update (Set to India INR)
  try {
    process.stdout.write('👉 TEST 2: Save and persist user country & currency (India / INR)... ');
    const postRes = await apiFetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: 'IN', currencyCode: 'INR' }),
    });
    const postJson = await postRes.json();
    if (!postRes.ok || !postJson.success || postJson.data.countryCode !== 'IN' || postJson.data.currencyCode !== 'INR') {
      throw new Error('Failed to update user preference');
    }

    const getRes = await apiFetch('/api/user/preferences');
    const getJson = await getRes.json();
    if (!getRes.ok || !getJson.success || getJson.data?.countryCode !== 'IN') {
      throw new Error('Persisted preference does not match updated country');
    }
    console.log(`✅ PASSED (Persisted country: ${getJson.data.country.name}, Currency: ${getJson.data.currencyCode}, Flag: ${getJson.data.country.flag})`);
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }

  // Test 3: India Domestic PayPal Gating Flag
  try {
    process.stdout.write('👉 TEST 3: India country profile surfaces PayPal domestic limitation... ');
    const res = await apiFetch('/api/user/preferences');
    const json = await res.json();
    if (!json.data?.country?.paypalDomesticUnavailable) {
      throw new Error('paypalDomesticUnavailable flag is missing for India');
    }
    console.log('✅ PASSED (paypalDomesticUnavailable: true verified)');
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }

  // Test 4: Reset User Preference to US / USD
  try {
    process.stdout.write('👉 TEST 4: Revert user country to US / USD... ');
    const res = await apiFetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ countryCode: 'US', currencyCode: 'USD' }),
    });
    const json = await res.json();
    if (!res.ok || !json.success || json.data.countryCode !== 'US') {
      throw new Error('Failed to reset preference to US');
    }
    console.log('✅ PASSED');
    passed++;
  } catch (err) {
    console.log(`❌ FAILED: ${err.message}`);
    failed++;
  }

  console.log('\n====================================================');
  console.log(`🏁 COUNTRY & CURRENCY SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');
}

runTests();

