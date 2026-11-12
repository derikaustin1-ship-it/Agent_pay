// src/lib/gemini.ts
// Official Google GenAI SDK integration for AgentPay
// Server-side only: GEMINI_API_KEY is read securely from environment variables

import { GoogleGenAI, Type, Schema } from '@google/genai';
import { Product, ShoppingRequirements, ChatMessage } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';

export function isGeminiConfigured(): boolean {
  return Boolean(
    GEMINI_API_KEY &&
      !GEMINI_API_KEY.includes('your_gemini_api_key') &&
      GEMINI_API_KEY.trim().length > 10
  );
}

export interface StructuredShoppingAnalysis {
  productCategory: string;
  maxBudget: number | null;
  currency: string;
  preferences: string[];
  importantFeatures: string[];
  occasion?: string;
  rawUnderstoodQuery: string;
  summary: string;
}

const shoppingAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    productCategory: {
      type: Type.STRING,
      description: 'The primary category of the product, e.g. electronics, mobiles, fashion, home-kitchen, beauty, grocery, sports, accessories, books, outdoor, shoes.',
    },
    maxBudget: {
      type: Type.NUMBER,
      description: 'The maximum numeric budget extracted from the request in the currency specified by the user (or null if unstated).',
    },
    currency: {
      type: Type.STRING,
      description: 'ISO 4217 currency code of the extracted budget (e.g. USD, INR, EUR, GBP).',
    },
    preferences: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'List of preferences such as portability, brand preference, gift recipient, wireless, etc.',
    },
    importantFeatures: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: 'Specific technical or physical features requested.',
    },
    occasion: {
      type: Type.STRING,
      description: 'The occasion if mentioned.',
    },
    rawUnderstoodQuery: {
      type: Type.STRING,
      description: 'Cleaned search query optimized for catalogue lookup.',
    },
    summary: {
      type: Type.STRING,
      description: 'Concise summary of what the user wants to buy.',
    },
  },
  required: [
    'productCategory',
    'currency',
    'preferences',
    'importantFeatures',
    'rawUnderstoodQuery',
    'summary',
  ],
};

export async function analyzeShoppingRequest(
  userPrompt: string
): Promise<StructuredShoppingAnalysis> {
  if (!isGeminiConfigured()) {
    throw new Error(
      'GEMINI_API_KEY is not configured or is using placeholder text. Please check your .env.local file.'
    );
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const systemInstruction =
    'You are an expert e-commerce shopping analyst for AgentPay. ' +
    'Extract the exact product category, numeric budget, budget currency (USD, INR, EUR, GBP, etc.), user preferences, and important features ' +
    'from the user shopping request. Never guess a price if none was stated. Output strict JSON matching the schema.';

  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.2,
        responseMimeType: 'application/json',
        responseSchema: shoppingAnalysisSchema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini API returned an empty response.');
    }

    return JSON.parse(text) as StructuredShoppingAnalysis;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('API_KEY_INVALID') || message.includes('403')) {
      throw new Error(`Gemini API Authentication Error: Invalid API Key provided (${message}).`);
    } else if (message.includes('429') || message.includes('RESOURCE_EXHAUSTED')) {
      throw new Error(`Gemini API Rate Limit / Quota Exceeded (${message}).`);
    } else if (message.includes('404') || message.includes('model not found')) {
      throw new Error(`Gemini Model Not Found: The model '${GEMINI_MODEL}' may not be supported on this key (${message}).`);
    }
    throw new Error(`Gemini API Error: ${message}`);
  }
}

// ============================================================
// Conversational Understanding & Co-Pilot Intent Parsing
// ============================================================

export interface LocalePromptContext {
  countryCode: string;
  countryName: string;
  currencyCode: string;
  locale: string;
}

export interface ConversationalAnalysisResult {
  productCategory: string;
  maxBudget: number | null;
  budgetCurrency: string;
  explicitCurrencyMentioned: string | null;
  currencyConflictDetected: boolean;
  country: string;
  preferredBrands: string[];
  productRequirements: string[];
  intendedUsage: string[];
  otherPreferences: string[];
  searchQuery: string;
  isMissingEssentialInfo: boolean;
  followUpQuestion: string | null;
  refinementAction: 'none' | 'cheaper' | 'better_rated' | 'different_brand' | 'usage_change' | 'compare';
  intentType: 'search' | 'compare' | 'wishlist_action' | 'cart_action' | 'budget_advice' | 'deal_discovery' | 'general_qa';
  summary: string;
}

const conversationalSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    productCategory: {
      type: Type.STRING,
      description: 'The product category (e.g., electronics, mobiles, fashion, home-kitchen, beauty, grocery, sports, accessories, books, outdoor, shoes, or general).',
    },
    maxBudget: {
      type: Type.NUMBER,
      description: 'Maximum numeric budget stated by the user in budgetCurrency (e.g., 500 for "under 500", 20000 for ₹20,000, 50 for $50). Null if not mentioned.',
    },
    budgetCurrency: {
      type: Type.STRING,
      description: 'ISO 4217 currency code of maxBudget. If user explicitly writes currency symbol/code ($, USD, ₹, Rs, INR, £, GBP, €, EUR, ¥, JPY), set to that currency. For bare numbers without currency symbols, MUST equal user selectedCurrency.',
    },
    explicitCurrencyMentioned: {
      type: Type.STRING,
      description: 'ISO 4217 currency code explicitly mentioned in user text (e.g. "USD" for "$50", "INR" for "₹2000"), or null if bare number.',
    },
    currencyConflictDetected: {
      type: Type.BOOLEAN,
      description: 'True if explicitCurrencyMentioned is present and differs from user selectedCurrency.',
    },
    country: {
      type: Type.STRING,
      description: 'ISO 3166-1 alpha-2 country code matching user selectedCountryCode (e.g. IN, US, GB, JP).',
    },
    preferredBrands: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    productRequirements: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    intendedUsage: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    otherPreferences: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    searchQuery: {
      type: Type.STRING,
      description: 'Clean search terms for catalogue & Channel3 lookup. Combine with prior context when refining.',
    },
    isMissingEssentialInfo: {
      type: Type.BOOLEAN,
      description: 'True ONLY if greeting/empty with zero shopping, budget, deal, cart, or wishlist intent.',
    },
    followUpQuestion: {
      type: Type.STRING,
      description: 'Polite 1-sentence follow-up question if isMissingEssentialInfo is true, else null.',
    },
    refinementAction: {
      type: Type.STRING,
      description: '"none", "cheaper", "better_rated", "different_brand", "usage_change", or "compare".',
    },
    intentType: {
      type: Type.STRING,
      description: 'Classify primary intent: "search", "compare", "wishlist_action", "cart_action", "budget_advice", "deal_discovery", or "general_qa".',
    },
    summary: {
      type: Type.STRING,
      description: 'A 1-sentence summary of the user goal using exact resolved currency.',
    },
  },
  required: [
    'productCategory',
    'budgetCurrency',
    'currencyConflictDetected',
    'country',
    'preferredBrands',
    'productRequirements',
    'intendedUsage',
    'otherPreferences',
    'searchQuery',
    'isMissingEssentialInfo',
    'refinementAction',
    'intentType',
    'summary',
  ],
};

export async function analyzeConversationWithGemini(
  userMessage: string,
  chatHistory: ChatMessage[] = [],
  localeOrCurrency: string | LocalePromptContext = 'USD'
): Promise<ConversationalAnalysisResult> {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API is not configured.');
  }

  const localeCtx: LocalePromptContext =
    typeof localeOrCurrency === 'string'
      ? {
          countryCode: localeOrCurrency === 'INR' ? 'IN' : localeOrCurrency === 'GBP' ? 'GB' : localeOrCurrency === 'JPY' ? 'JP' : 'US',
          countryName:
            localeOrCurrency === 'INR'
              ? 'India'
              : localeOrCurrency === 'GBP'
              ? 'United Kingdom'
              : localeOrCurrency === 'JPY'
              ? 'Japan'
              : 'United States',
          currencyCode: localeOrCurrency,
          locale: localeOrCurrency === 'INR' ? 'en-IN' : localeOrCurrency === 'GBP' ? 'en-GB' : localeOrCurrency === 'JPY' ? 'ja-JP' : 'en-US',
        }
      : localeOrCurrency;

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const recentHistory = chatHistory
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 300)}`)
    .join('\n\n');

  const systemInstruction =
    'You are the AgentPay AI Shopping Co-Pilot conversational parser. ' +
    `Active storefront locale context: selectedCountryCode=${localeCtx.countryCode} (${localeCtx.countryName}), selectedCurrency=${localeCtx.currencyCode}, selectedLocale=${localeCtx.locale}. ` +
    `CRITICAL CURRENCY RULE: Whenever the user gives a budget number WITHOUT an explicit currency symbol or ISO code (e.g. "under 500", "below 50", "under 5000"), ` +
    `you MUST interpret budgetCurrency as "${localeCtx.currencyCode}" and set explicitCurrencyMentioned=null. Never default bare numbers to USD when selectedCurrency is "${localeCtx.currencyCode}". ` +
    `If the user explicitly writes a currency symbol or code ($, USD, ₹, Rs, INR, £, GBP, €, EUR, ¥, JPY), extract that exact explicit currency into explicitCurrencyMentioned and budgetCurrency, ` +
    `and set currencyConflictDetected=true when explicitCurrencyMentioned differs from "${localeCtx.currencyCode}". ` +
    `Set country="${localeCtx.countryCode}". ` +
    'Classify intentType accurately: "wishlist_action", "cart_action", "compare", "budget_advice", "deal_discovery", or "search". ' +
    'Only set isMissingEssentialInfo=true for pure greetings like "hi" or "hello" with no request.';

  const prompt = `Storefront Context:
- selectedCountryCode: ${localeCtx.countryCode} (${localeCtx.countryName})
- selectedCurrency: ${localeCtx.currencyCode}
- selectedLocale: ${localeCtx.locale}

Recent conversation history:
${recentHistory || 'No prior conversation.'}

Current user message:
"${userMessage}"

Output strict JSON according to the schema.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.1,
      responseMimeType: 'application/json',
      responseSchema: conversationalSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini API returned empty conversational analysis.');
  }

  return JSON.parse(text) as ConversationalAnalysisResult;
}

// ============================================================
// AI Product Evaluation & Comparison with Gemini
// ============================================================

export interface AIProductEvaluation {
  productId: string;
  rank: number;
  matchScore: number;
  whyItMatches: string;
  advantages: string[];
  limitations: string[];
  budgetFit: string;
}

export interface AIComparisonResponse {
  evaluations: AIProductEvaluation[];
  topThreeIds: string[];
  comparisonSummary: string;
}

const comparisonSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    evaluations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          productId: { type: Type.STRING },
          rank: { type: Type.NUMBER },
          matchScore: { type: Type.NUMBER },
          whyItMatches: { type: Type.STRING },
          advantages: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          limitations: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          budgetFit: { type: Type.STRING },
        },
        required: ['productId', 'rank', 'matchScore', 'whyItMatches', 'advantages', 'limitations', 'budgetFit'],
      },
    },
    topThreeIds: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    comparisonSummary: { type: Type.STRING },
  },
  required: ['evaluations', 'topThreeIds', 'comparisonSummary'],
};

export async function evaluateAndRankProductsWithAI(
  products: Product[],
  requirements: ShoppingRequirements
): Promise<AIComparisonResponse> {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const activeCurrency = requirements.budgetCurrency || 'USD';
  const productDataText = products
    .map((p, idx) => {
      const origCurrency = p.originalCurrency || p.currency || 'USD';
      const origPrice = p.originalPrice ?? p.price;
      const dispCurrency = p.displayCurrency || origCurrency;
      const dispPrice = p.displayPrice ?? origPrice;
      const priceLabel =
        p.priceIsConverted && origCurrency !== dispCurrency
          ? `${dispPrice} ${dispCurrency} (Estimated from original merchant price ${origPrice} ${origCurrency})`
          : `${origPrice} ${origCurrency}`;

      return `
[Product ${idx + 1}]
ID: ${p.id}
Name: ${p.name}
Brand: ${p.brand}
Price: ${priceLabel}
Merchant Country: ${p.merchantCountry || 'External / Unspecified'}
Seller / Retailer: ${p.seller}
Rating: ${p.rating ? `${p.rating}/5` : 'No rating recorded'} (${p.reviewCount ? `${p.reviewCount} reviews` : '0 reviews'})
Availability: ${p.availability || 'Not specified'}
Features: ${p.features && p.features.length > 0 ? p.features.join('; ') : 'Not specified'}
Description: ${p.description ? p.description.slice(0, 300) : 'None provided'}
Checkout: ${p.checkoutType === 'agentpay' ? 'AgentPay PayPal Checkout' : 'External Merchant Redirect'}
`;
    })
    .join('\n---\n');

  const systemInstruction =
    "You are AgentPay's Chief Product Evaluation AI. You evaluate real shopping results against user requirements. " +
    'CRITICAL RULES: ' +
    '1. Base your evaluation strictly on the actual product information provided. Never fabricate ratings, features, or specs. ' +
    '2. Respect the user country and currency accurately when citing prices (never turn INR into USD symbols or claim foreign US offers are domestic local listings). ' +
    '3. Do not automatically rank the cheapest product first. Value, features, and suitability matter most. ' +
    '4. Select the top 3 most suitable products and rank them 1, 2, and 3. Explain why each matches with clear, evidence-based reasoning.';

  const prompt = `User Requirements:
- Storefront Country: ${requirements.country || 'US'}
- Category: ${requirements.productCategory}
- Budget: ${requirements.maxBudget ? `${requirements.maxBudget} ${activeCurrency}` : 'Flexible / Not specified'}
- Intended Usage: ${requirements.intendedUsage?.join(', ') || 'General use'}
- Key Features Desired: ${requirements.importantFeatures?.join(', ') || 'Any'}
- Brand Preferences: ${requirements.preferredBrands?.join(', ') || 'Any'}
- Other Preferences: ${requirements.preferences?.join(', ') || 'None'}

Retrieved Products:
${productDataText}

Evaluate all candidate products, assign match scores (0-100), rank the top 3, and explain the comparison using accurate currency codes/symbols. Output strict JSON according to the schema.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: comparisonSchema,
    },
  });

  const text = response.text;
  if (!text) {
    throw new Error('Gemini API returned empty evaluation response.');
  }

  return JSON.parse(text) as AIComparisonResponse;
}

// ============================================================
// Grounded Product Detail AI Summary
// ============================================================

export interface ProductAISummary {
  headline: string;
  keyHighlights: string[];
  bestSuitedFor: string;
  thingsToVerify: string[];
}

const productSummarySchema: Schema = {
  type: Type.OBJECT,
  properties: {
    headline: { type: Type.STRING },
    keyHighlights: { type: Type.ARRAY, items: { type: Type.STRING } },
    bestSuitedFor: { type: Type.STRING },
    thingsToVerify: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['headline', 'keyHighlights', 'bestSuitedFor', 'thingsToVerify'],
};

export async function generateProductSummaryWithGemini(product: Product): Promise<ProductAISummary> {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  const specsText = product.specs
    ? Object.entries(product.specs)
        .map(([k, v]) => `${k}: ${v}`)
        .join(', ')
    : 'None listed';

  const prompt = `Summarize this product strictly from the verified details below. NEVER invent technical specs, dimensions, warranties, or claims that are not present.

Name: ${product.name}
Brand: ${product.brand}
Category: ${product.category}
Price: ${product.displayPrice ?? product.price} ${product.displayCurrency || product.originalCurrency || product.currency} (Original: ${product.originalPrice ?? product.price} ${product.originalCurrency || product.currency})${product.compareAtPrice ? ` (Compare at ${product.compareAtPrice} ${product.originalCurrency || product.currency})` : ''}
Seller: ${product.seller}
Rating: ${product.rating ? `${product.rating}/5 (${product.reviewCount || 0} reviews)` : 'No rating recorded'}
Availability: ${product.availability || 'Not specified'}
Features: ${(product.features || []).join('; ') || 'None listed'}
Specs: ${specsText}
Description: ${product.description || 'No description provided'}

Output concise JSON matching the schema.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        'You are a factual product analyst. Base every point strictly on the provided product metadata. Do not fabricate any specification.',
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: productSummarySchema,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty product summary response.');
  return JSON.parse(text) as ProductAISummary;
}

// ============================================================
// Grounded Comparison Matrix AI Advisor
// ============================================================

export interface ComparisonAdvice {
  winnerProductId: string;
  summary: string;
  tradeOffs: string[];
  bestValueId: string;
}

const comparisonAdviceSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    winnerProductId: { type: Type.STRING },
    bestValueId: { type: Type.STRING },
    summary: { type: Type.STRING },
    tradeOffs: { type: Type.ARRAY, items: { type: Type.STRING } },
  },
  required: ['winnerProductId', 'bestValueId', 'summary', 'tradeOffs'],
};

export async function generateComparisonAdviceWithGemini(
  products: Product[],
  userGoal: string
): Promise<ComparisonAdvice> {
  if (!isGeminiConfigured()) {
    throw new Error('Gemini API is not configured.');
  }

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

  const productList = products
    .map(
      (p) => `ID: ${p.id} | Name: ${p.name} | Brand: ${p.brand} | Price: ${p.displayPrice ?? p.price} ${p.displayCurrency || p.originalCurrency || p.currency} (Original: ${p.originalPrice ?? p.price} ${p.originalCurrency || p.currency}) | Country: ${p.merchantCountry || 'Unknown'} | Rating: ${
        p.rating ? `${p.rating}/5 (${p.reviewCount || 0})` : 'N/A'
      } | Seller: ${p.seller} | Features: ${(p.features || []).join('; ')} | Specs: ${
        p.specs ? JSON.stringify(p.specs) : 'N/A'
      }`
    )
    .join('\n');

  const prompt = `User requirement / priority: "${userGoal || 'Best overall value and suitability'}"

Products to compare:
${productList}

Compare ONLY using the facts provided. Do not invent missing specifications. Pick winnerProductId and bestValueId from the provided IDs, summarize the comparison, and list key trade-offs.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      systemInstruction:
        'You are an objective e-commerce comparison advisor. Never fabricate missing specs. Explicitly note if a specification is unavailable.',
      temperature: 0.2,
      responseMimeType: 'application/json',
      responseSchema: comparisonAdviceSchema,
    },
  });

  const text = response.text;
  if (!text) throw new Error('Empty comparison advice response.');
  return JSON.parse(text) as ComparisonAdvice;
}
