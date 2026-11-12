// src/lib/paypal.ts
// PayPal Sandbox integration using the official PayPal REST Orders API (v2)
// Uses IPv4-enforced Node HTTPS transport with transient retry and OAuth token caching
// to avoid Windows NAT64/IPv6 "fetch failed" stalls. Server-side only.

import https from 'https';
import http from 'http';
import { isOrderAlreadyCaptured } from './database';

const PAYPAL_API_BASE = (process.env.PAYPAL_API_BASE || 'https://api-m.sandbox.paypal.com').replace(
  /\/$/,
  ''
);
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
const REQUEST_TIMEOUT_MS = 15000;

let cachedAccessToken: string | null = null;
let cachedTokenExpiresAt = 0;

export function isPayPalConfigured(): boolean {
  return Boolean(
    PAYPAL_CLIENT_ID &&
      PAYPAL_CLIENT_SECRET &&
      !PAYPAL_CLIENT_ID.includes('your_paypal_client_id')
  );
}

interface HttpResponseData {
  status: number;
  body: string;
}

function rawHttpRequest(
  fullUrl: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
    timeoutMs?: number;
  }
): Promise<HttpResponseData> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const transport = isHttps ? https : http;

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : isHttps ? 443 : 80,
        path: `${parsed.pathname}${parsed.search}`,
        method: options.method,
        headers: options.headers,
        // Force IPv4 so Windows NAT64/IPv6 transitions cannot stall and throw "TypeError: fetch failed"
        family: 4,
        timeout: options.timeoutMs ?? REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          resolve({
            status: res.statusCode || 0,
            body: Buffer.concat(chunks).toString('utf8'),
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`PayPal API request timed out after ${options.timeoutMs ?? REQUEST_TIMEOUT_MS}ms`));
    });

    req.on('error', (err) => {
      const code = (err as NodeJS.ErrnoException)?.code;
      const msg = err instanceof Error ? err.message : String(err);
      const enhanced = new Error(
        code ? `PayPal network connection error (${code}): ${msg}` : `PayPal network error: ${msg}`
      );
      (enhanced as NodeJS.ErrnoException).code = code;
      reject(enhanced);
    });

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

async function paypalHttp(
  path: string,
  options: {
    method: string;
    headers: Record<string, string>;
    body?: string;
  }
): Promise<HttpResponseData> {
  const fullUrl = `${PAYPAL_API_BASE}${path}`;
  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await rawHttpRequest(fullUrl, {
        ...options,
        timeoutMs: REQUEST_TIMEOUT_MS,
      });
    } catch (err) {
      lastError = err;
      const code = (err as NodeJS.ErrnoException)?.code || '';
      const isTransient =
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === 'EAI_AGAIN' ||
        code === 'ECONNREFUSED' ||
        (err instanceof Error && /timed out|socket hang up/i.test(err.message));

      if (attempt < 2 && isTransient) {
        await new Promise((r) => setTimeout(r, 350));
        continue;
      }
      throw err;
    }
  }

  throw lastError instanceof Error ? lastError : new Error('PayPal network request failed');
}

async function getAccessToken(forceRefresh = false): Promise<string> {
  if (!isPayPalConfigured()) {
    throw new Error(
      'PayPal Sandbox credentials not configured. Please add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env.local.'
    );
  }

  if (!forceRefresh && cachedAccessToken && Date.now() < cachedTokenExpiresAt) {
    return cachedAccessToken;
  }

  const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

  const response = await paypalHttp('/v1/oauth2/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`PayPal Sandbox OAuth error (${response.status}): ${response.body}`);
  }

  const data = JSON.parse(response.body) as { access_token: string; expires_in?: number };
  cachedAccessToken = data.access_token;
  const ttlSec = Math.max(60, (data.expires_in || 3600) - 60);
  cachedTokenExpiresAt = Date.now() + ttlSec * 1000;
  return data.access_token;
}

async function paypalAuthorizedJson<T>(
  path: string,
  method: 'GET' | 'POST',
  bodyObj?: unknown
): Promise<{ status: number; rawBody: string; json: T | null }> {
  const payload = bodyObj !== undefined ? JSON.stringify(bodyObj) : undefined;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const token = await getAccessToken(attempt > 1);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const res = await paypalHttp(path, { method, headers, body: payload });

    // Refresh expired cached token once on 401
    if (res.status === 401 && attempt === 1) {
      cachedAccessToken = null;
      cachedTokenExpiresAt = 0;
      continue;
    }

    let parsed: T | null = null;
    if (res.body) {
      try {
        parsed = JSON.parse(res.body) as T;
      } catch {
        parsed = null;
      }
    }
    return { status: res.status, rawBody: res.body, json: parsed };
  }

  throw new Error('PayPal API authorization failed after token refresh.');
}

export function getDefaultBaseUrl(): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

export interface PayPalLineItemInput {
  name: string;
  quantity: number;
  unitAmount: number;
}

/**
 * Create a PayPal Sandbox Order (v2/checkout/orders).
 * Supports single-item and multi-item purchase units with integer-cent verified breakdown.
 */
export async function createPayPalOrder(
  amount: number,
  currency: string = 'USD',
  productName: string = 'AgentPay Order',
  returnUrl: string = `${getDefaultBaseUrl()}/api/paypal/success`,
  cancelUrl: string = `${getDefaultBaseUrl()}/api/paypal/cancel`,
  lineItems?: PayPalLineItemInput[],
  discountAmount: number = 0
): Promise<{
  id: string;
  status: string;
  approvalUrl: string;
}> {
  const totalCents = Math.max(1, Math.round(amount * 100));
  const rawDiscountCents = Math.max(0, Math.round(discountAmount * 100));

  const purchaseUnit: Record<string, unknown> = {
    description: `${productName.slice(0, 110)} — AgentPay Sandbox`,
  };

  if (lineItems && lineItems.length > 0) {
    const paypalItems = lineItems.map((item) => {
      const unitCents = Math.max(1, Math.round(item.unitAmount * 100));
      return {
        name: (item.name || 'Item').slice(0, 127),
        quantity: String(item.quantity),
        unit_amount: {
          currency_code: currency,
          value: (unitCents / 100).toFixed(2),
        },
        category: 'PHYSICAL_GOODS',
      };
    });

    const itemTotalCents = lineItems.reduce(
      (sum, item) => sum + Math.max(1, Math.round(item.unitAmount * 100)) * item.quantity,
      0
    );

    const effectiveDiscountCents = Math.min(rawDiscountCents, Math.max(0, itemTotalCents - 1));
    const expectedTotalCents = Math.max(1, itemTotalCents - effectiveDiscountCents);

    purchaseUnit.amount = {
      currency_code: currency,
      value: (expectedTotalCents / 100).toFixed(2),
      breakdown: {
        item_total: {
          currency_code: currency,
          value: (itemTotalCents / 100).toFixed(2),
        },
        ...(effectiveDiscountCents > 0
          ? {
              discount: {
                currency_code: currency,
                value: (effectiveDiscountCents / 100).toFixed(2),
              },
            }
          : {}),
      },
    };
    purchaseUnit.items = paypalItems;
  } else {
    purchaseUnit.amount = {
      currency_code: currency,
      value: (totalCents / 100).toFixed(2),
    };
  }

  const payload = {
    intent: 'CAPTURE',
    purchase_units: [purchaseUnit],
    application_context: {
      brand_name: 'AgentPay (Sandbox)',
      landing_page: 'NO_PREFERENCE',
      user_action: 'PAY_NOW',
      return_url: returnUrl,
      cancel_url: cancelUrl,
    },
  };

  const res = await paypalAuthorizedJson<{
    id: string;
    status: string;
    links?: Array<{ rel: string; href: string }>;
  }>('/v2/checkout/orders', 'POST', payload);

  if (res.status < 200 || res.status >= 300 || !res.json) {
    throw new Error(`PayPal Sandbox Create Order failed (${res.status}): ${res.rawBody}`);
  }

  const orderData = res.json;
  const approvalLink = orderData.links?.find(
    (link) => link.rel === 'approve' || link.rel === 'payer-action'
  );

  return {
    id: orderData.id,
    status: orderData.status,
    approvalUrl: approvalLink?.href || '',
  };
}

/**
 * Capture payment for an approved PayPal Sandbox Order.
 * Includes idempotent check against duplicate captures.
 */
export async function capturePayPalOrder(orderId: string): Promise<{
  id: string;
  status: string;
  amount?: string;
  currency?: string;
  captureId?: string;
}> {
  if (isOrderAlreadyCaptured(orderId)) {
    throw new Error('This transaction has already been captured. Duplicate capture prevented.');
  }

  const res = await paypalAuthorizedJson<{
    id: string;
    status: string;
    purchase_units?: Array<{
      amount?: { value?: string; currency_code?: string };
      payments?: {
        captures?: Array<{
          id?: string;
          amount?: { value?: string; currency_code?: string };
        }>;
      };
    }>;
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, 'POST', {});

  if (res.status < 200 || res.status >= 300 || !res.json) {
    throw new Error(`PayPal Sandbox Capture failed (${res.status}): ${res.rawBody}`);
  }

  const captureData = res.json;
  const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0];

  return {
    id: captureData.id,
    status: captureData.status,
    amount: capture?.amount?.value || captureData.purchase_units?.[0]?.amount?.value,
    currency:
      capture?.amount?.currency_code || captureData.purchase_units?.[0]?.amount?.currency_code,
    captureId: capture?.id,
  };
}

/**
 * Get status of an existing PayPal Sandbox Order.
 */
export async function getPayPalOrderStatus(orderId: string): Promise<{
  id: string;
  status: string;
  amount?: string;
  currency?: string;
  captureId?: string;
}> {
  const res = await paypalAuthorizedJson<{
    id: string;
    status: string;
    purchase_units?: Array<{
      amount?: { value?: string; currency_code?: string };
      payments?: {
        captures?: Array<{ id?: string }>;
      };
    }>;
  }>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, 'GET');

  if (res.status < 200 || res.status >= 300 || !res.json) {
    throw new Error(`PayPal Sandbox Order status check failed (${res.status}): ${res.rawBody}`);
  }

  const orderData = res.json;
  const purchaseUnit = orderData.purchase_units?.[0];
  const capture = purchaseUnit?.payments?.captures?.[0];

  return {
    id: orderData.id,
    status: orderData.status,
    amount: purchaseUnit?.amount?.value,
    currency: purchaseUnit?.amount?.currency_code,
    captureId: capture?.id,
  };
}
