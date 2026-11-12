// src/lib/test-ecommerce-e2e.js
// End-to-end verification suite for AgentPay E-Commerce Transformation
// Usage: node src/lib/test-ecommerce-e2e.js (with server running on http://localhost:3000)

const BASE = process.env.AGENTPAY_BASE_URL || 'http://127.0.0.1:3000';

class CookieClient {
  constructor() {
    this.cookies = new Map();
  }

  captureSetCookies(res) {
    const raw =
      typeof res.headers.getSetCookie === 'function'
        ? res.headers.getSetCookie()
        : res.headers.get('set-cookie')
          ? [res.headers.get('set-cookie')]
          : [];
    for (const entry of raw) {
      if (!entry) continue;
      const first = entry.split(';')[0];
      const eqIdx = first.indexOf('=');
      if (eqIdx > 0) {
        const name = first.slice(0, eqIdx).trim();
        const val = first.slice(eqIdx + 1).trim();
        if (val === '' || entry.toLowerCase().includes('max-age=0')) {
          this.cookies.delete(name);
        } else {
          this.cookies.set(name, val);
        }
      }
    }
  }

  cookieHeader() {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }

  async fetch(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    const ch = this.cookieHeader();
    if (ch) headers['Cookie'] = ch;
    const res = await fetch(`${BASE}${path}`, { ...options, headers, redirect: 'manual' });
    this.captureSetCookies(res);
    const text = await res.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {
      // HTML or non-JSON response
    }
    return { status: res.status, headers: res.headers, text, json };
  }
}

function assert(cond, msg) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function run() {
  let passed = 0;
  const pass = (name) => {
    passed++;
    console.log(`  PASS: ${name}`);
  };

  console.log(`\nRunning AgentPay E-Commerce E2E Suite against ${BASE}\n`);

  // 1. Storefront routes render HTTP 200
  const routes = [
    '/',
    '/catalog',
    '/products/prod-001',
    '/cart',
    '/checkout',
    '/wishlist',
    '/compare',
    '/deals',
    '/orders',
    '/account',
    '/spending',
    '/rewards',
    '/assistant',
  ];
  const anon = new CookieClient();
  for (const r of routes) {
    const res = await anon.fetch(r);
    assert(res.status === 200, `Route ${r} returned status ${res.status}`);
  }
  pass(`All ${routes.length} App Router pages returned HTTP 200`);

  // 2. Auth boundary checks (401 when unauthenticated)
  for (const priv of ['/api/account', '/api/orders', '/api/spending']) {
    const res = await anon.fetch(priv);
    assert(res.status === 401, `Expected 401 for unauthenticated ${priv}, got ${res.status}`);
  }
  const anonBudget = await anon.fetch('/api/budget');
  assert(
    anonBudget.status === 200 && anonBudget.json?.data?.isDefault === true && anonBudget.json?.data?.userId === null,
    `Expected unauthenticated GET /api/budget to return anonymous defaults`
  );
  const unauthBudgetPost = await anon.fetch('/api/budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxPurchaseAmount: 500, dailySpendingLimit: 1000 }),
  });
  assert(unauthBudgetPost.status === 401, `Expected 401 for unauthenticated POST /api/budget, got ${unauthBudgetPost.status}`);
  const unauthCreate = await anon.fetch('/api/paypal/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod-001' }),
  });
  assert(unauthCreate.status === 401, `Expected 401 for unauthenticated checkout, got ${unauthCreate.status}`);
  pass('Unauthenticated protected endpoints & mutations return 401 cleanly');

  // 3. Home showcase & Catalog search & Detail summary
  const home = await anon.fetch('/api/products/home');
  assert(home.status === 200 && home.json?.success, 'Home API failed');
  assert(home.json.data.todaysDeals.length > 0, 'Expected verified deals on home');
  assert(home.json.data.trendingProducts.length > 0, 'Expected trending products on home');
  pass('Home showcase sections return structured catalog data');

  const search = await anon.fetch('/api/products/search?q=laptop&sort=price_asc&limit=10');
  assert(search.status === 200 && search.json?.success && search.json.data.length > 0, 'Catalog search failed');
  pass(`Catalog search returned ${search.json.data.length} items`);

  const detail = await anon.fetch('/api/products/prod-001');
  assert(detail.status === 200 && detail.json?.data?.product?.id === 'prod-001', 'Product detail failed');
  const summary = await anon.fetch('/api/products/prod-001/summary');
  assert(summary.status === 200 && summary.json?.data?.headline, 'Product AI summary failed');
  pass('Product detail & grounded AI summary working');

  // 4. Guest cart -> Login merge + User isolation
  const guestAdd = await anon.fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod-004', quantity: 2 }),
  });
  assert(guestAdd.status === 200 && guestAdd.json?.data?.itemCount === 2, 'Guest cart add failed');

  // Sign in as Demo User (should merge guest cart if desired or keep user authenticated)
  const demo = new CookieClient();
  const loginRes = await demo.fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'demo@agentpay.app', password: 'DemoUser123!' }),
  });
  assert(loginRes.status === 200 && loginRes.json?.data?.user?.email === 'demo@agentpay.app', 'Demo login failed');
  pass('Demo shopper login succeeded with session cookie');

  // Register a second fresh user to test isolation & guest merge
  const user2 = new CookieClient();
  await user2.fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod-004', quantity: 1 }),
  });
  const uniqueEmail = `e2e_${Date.now()}@agentpay.app`;
  const regRes = await user2.fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'E2E Tester',
      email: uniqueEmail,
      password: 'Password123!',
    }),
  });
  assert(
    (regRes.status === 200 || regRes.status === 201) && regRes.json?.data?.user?.email === uniqueEmail,
    `User registration failed: ${regRes.status} ${JSON.stringify(regRes.json)}`
  );
  const u2Cart = await user2.fetch('/api/cart');
  assert(u2Cart.json?.data?.itemCount === 1, 'Guest cart item did not merge upon registration');
  pass('New account registration & guest cart merge verified');

  // 5. Coupon validation & backend total math (min order check + multi-product discount)
  const lowSubtotalCoupon = await user2.fetch('/api/cart?coupon=AGENT10');
  assert(
    lowSubtotalCoupon.status === 200 && Boolean(lowSubtotalCoupon.json?.couponError),
    'Expected couponError when subtotal ($24.99) is below $50 minimum for AGENT10'
  );
  // Add a second item (2 more units of prod-004 => total $74.97 >= $50)
  await user2.fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod-004', quantity: 2 }),
  });
  const couponRes = await user2.fetch('/api/cart?coupon=AGENT10');
  assert(
    couponRes.status === 200 &&
      couponRes.json?.data?.discountAmount > 0 &&
      couponRes.json.data.finalPayableAmount < couponRes.json.data.agentPaySubtotal,
    `Coupon AGENT10 failed to apply discount on backend: ${JSON.stringify(couponRes.json)}`
  );
  pass('Verified coupon AGENT10 minimum order rule & backend discount math');

  // 6. Wishlist & Price Check & Compare Analysis
  const wlAdd = await user2.fetch('/api/wishlist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod-002' }),
  });
  assert(wlAdd.status === 200 && wlAdd.json?.data?.length === 1, 'Wishlist add failed');
  const priceCheck = await user2.fetch('/api/wishlist/check-prices', { method: 'POST' });
  assert(priceCheck.status === 200 && priceCheck.json?.data?.checkedCount === 1, 'Price check failed');

  const cmp = await user2.fetch('/api/compare/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productIds: ['prod-001', 'prod-002'], userGoal: 'best value' }),
  });
  assert(cmp.status === 200 && cmp.json?.data?.summary, 'Comparison analysis failed');
  pass('Wishlist, on-demand price check, and product comparison AI advisor verified');

  // 7. Budget Enforcement + PayPal Order Creation + Cross-user isolation
  // Set strict budget on user2: $80 maxPurchase, $150 daily (cart payable ~$67.47)
  const setB = await user2.fetch('/api/budget', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ maxPurchaseAmount: 80, dailySpendingLimit: 150 }),
  });
  assert(setB.status === 200, 'Budget save failed');

  // Try over-budget product prod-010 ($849 laptop)
  const blockedOrder = await user2.fetch('/api/paypal/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId: 'prod-010' }),
  });
  assert(blockedOrder.status === 403, `Expected 403 budget block for $849 item, got ${blockedOrder.status}`);
  pass('Over-budget purchase blocked server-side with HTTP 403');

  // Within-budget multi-item cart checkout (prod-004 is $39.99)
  const createOrder = await user2.fetch('/api/paypal/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'cart', couponCode: 'AGENT10' }),
  });
  assert(
    createOrder.status === 200 && createOrder.json?.data?.paypalOrderId,
    `Cart PayPal create-order failed: ${createOrder.status} ${JSON.stringify(createOrder.json)}`
  );
  const { orderId } = createOrder.json.data;
  pass(`PayPal Sandbox cart order created (${createOrder.json.data.paypalOrderId})`);

  // Demo user must NOT be able to cancel user2's order!
  const crossCancel = await demo.fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel' }),
  });
  assert(
    crossCancel.status === 403 || crossCancel.status === 404,
    `Cross-user order access should fail (got ${crossCancel.status})`
  );
  pass('Cross-user order isolation enforced cleanly');

  // User2 cancels their own pending order
  const selfCancel = await user2.fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'cancel' }),
  });
  assert(selfCancel.status === 200 && selfCancel.json?.data?.paymentStatus === 'cancelled', 'Self cancel failed');
  pass('Pending order cancellation works for owner');

  // 8. Exchange rates & AI Co-Pilot
  const fx = await anon.fetch('/api/exchange-rates');
  assert(fx.status === 200 && fx.json?.data?.rates?.INR, 'Exchange rates endpoint failed');
  const chat = await user2.fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Find running shoes under $80',
      currencyCode: 'USD',
    }),
  });
  assert(
    chat.status === 200 && chat.json?.data?.message && Array.isArray(chat.json?.data?.products),
    'AI Co-Pilot /api/chat failed'
  );
  pass(`AI Co-Pilot responded with ${chat.json.data.products.length} product recommendations`);

  console.log(`\nALL ${passed} E2E CHECKS PASSED CLEANLY!\n`);
}

run().catch((err) => {
  console.error('\nTEST SUITE FAILED:', err);
  process.exit(1);
});
