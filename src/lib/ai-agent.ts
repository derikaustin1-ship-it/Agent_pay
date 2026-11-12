// src/lib/ai-agent.ts
// AI Shopping Co-Pilot with Gemini reasoning, Channel3 + local catalogue discovery,
// country-aware & multi-currency budget resolution, action proposals, and backend budget guard.

import { searchProductCatalogue, analyzeProductTrust, getProduct, enrichProductForPreferences } from './products';
import { checkSpendingLimits } from './budget';
import {
  convertAmountWithRates,
  ExchangeRatesData,
  formatCurrency,
  getExchangeRates,
} from './exchange-rates';
import { getCountryByCode } from './countries';
import { ResolvedLocalePreferences } from './preferences';
import {
  isGeminiConfigured,
  analyzeConversationWithGemini,
  evaluateAndRankProductsWithAI,
  AIComparisonResponse,
  LocalePromptContext,
} from './gemini';
import {
  Product,
  ProductRecommendation,
  ShoppingRequirements,
  AgentResponse,
  SpendingCheck,
  ChatMessage,
  CopilotActionProposal,
} from '@/types';

const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';

export function isAIConfigured(): boolean {
  if (AI_PROVIDER === 'rule-based') return true;
  if (AI_PROVIDER === 'gemini') return isGeminiConfigured();
  return false;
}

/**
 * Detect whether the user explicitly specified a currency symbol or ISO code in their message.
 * Returns null if the user supplied only a bare number (e.g., "under 500").
 */
export function detectExplicitCurrencyInMessage(userMessage: string): string | null {
  if (/(?:₹|rs\.?|inr|rupees?)/i.test(userMessage)) return 'INR';
  if (/(?:£|gbp|pounds?)/i.test(userMessage)) return 'GBP';
  if (/(?:€|eur|euros?)/i.test(userMessage)) return 'EUR';
  if (/(?:¥|jpy|yen)/i.test(userMessage)) return 'JPY';
  if (/(?:\$|usd|dollars?)/i.test(userMessage)) return 'USD';
  if (/\bcad\b|\bca\$/i.test(userMessage)) return 'CAD';
  if (/\baud\b|\ba\$/i.test(userMessage)) return 'AUD';
  if (/\bsgd\b|\bs\$/i.test(userMessage)) return 'SGD';
  if (/\baed\b/i.test(userMessage)) return 'AED';
  return null;
}

// ============================================================
// Fallback Rule-Based Requirements Extraction (Multi-Currency)
// ============================================================

function extractRequirementsFallback(
  userMessage: string,
  localeCtx: LocalePromptContext
): {
  req: ShoppingRequirements;
  budgetCurrency: string;
  rawBudget?: number;
  explicitCurrencyMentioned?: string;
  currencyConflictDetected: boolean;
} {
  const msg = userMessage.toLowerCase();

  let budgetCurrency = localeCtx.currencyCode || 'USD';
  let rawBudget: number | undefined;
  let explicitCurrencyMentioned: string | undefined;

  const inrMatch = userMessage.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:inr|rupees?)/i);
  const eurMatch = userMessage.match(/(?:€|eur)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:euros?|eur)/i);
  const gbpMatch = userMessage.match(/(?:£|gbp)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:pounds?|gbp)/i);
  const jpyMatch = userMessage.match(/(?:¥|jpy)\s*([\d,]+)|([\d,]+)\s*(?:yen|jpy)/i);
  const usdMatch = userMessage.match(/\$([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:dollars?|usd)/i);

  if (inrMatch) {
    budgetCurrency = 'INR';
    explicitCurrencyMentioned = 'INR';
    rawBudget = parseFloat((inrMatch[1] || inrMatch[2]).replace(/,/g, ''));
  } else if (eurMatch) {
    budgetCurrency = 'EUR';
    explicitCurrencyMentioned = 'EUR';
    rawBudget = parseFloat((eurMatch[1] || eurMatch[2]).replace(/,/g, ''));
  } else if (gbpMatch) {
    budgetCurrency = 'GBP';
    explicitCurrencyMentioned = 'GBP';
    rawBudget = parseFloat((gbpMatch[1] || gbpMatch[2]).replace(/,/g, ''));
  } else if (jpyMatch) {
    budgetCurrency = 'JPY';
    explicitCurrencyMentioned = 'JPY';
    rawBudget = parseFloat((jpyMatch[1] || jpyMatch[2]).replace(/,/g, ''));
  } else if (usdMatch) {
    budgetCurrency = 'USD';
    explicitCurrencyMentioned = 'USD';
    rawBudget = parseFloat((usdMatch[1] || usdMatch[2]).replace(/,/g, ''));
  } else {
    const genericUnder = userMessage.match(/(?:under|below|budget|max|within|less than)\s+([\d,]+(?:\.\d{1,2})?)/i);
    if (genericUnder) {
      rawBudget = parseFloat(genericUnder[1].replace(/,/g, ''));
      budgetCurrency = localeCtx.currencyCode || 'USD';
    }
  }

  const currencyConflictDetected = Boolean(
    explicitCurrencyMentioned && explicitCurrencyMentioned !== localeCtx.currencyCode
  );

  let productCategory = 'general';
  const categoryMap: Array<[string, RegExp]> = [
    ['electronics', /\b(headphones?|earphones?|earbuds?|headsets?|speakers?|smartwatch(?:es)?|laptops?|computers?|electronic|keyboards?|audio)\b/i],
    ['mobiles', /\b(smartphones?|mobiles?|phones?|android|iphone|5g)\b/i],
    ['outdoor', /\b(hiking|camping|outdoor|trail|trek(?:king)?|backpacks?|tents?|nature)\b/i],
    ['shoes', /\b(shoes?|sneakers?|running shoes?|trainers?|footwear|boots?)\b/i],
    ['fashion', /\b(shirts?|jackets?|fashion|clothing|apparel|dresses?)\b/i],
    ['home-kitchen', /\b(coffee|kettle|kitchen|knives|knife|home|cookware)\b/i],
    ['beauty', /\b(serums?|skin ?care|beauty|creams?|cosmetics?)\b/i],
    ['grocery', /\b(coffee beans?|grocery|groceries|snacks?|tea|pantry)\b/i],
    ['sports', /\b(yoga|gym|fitness|sports?|mats?|workouts?)\b/i],
    ['books', /\b(books?|novels?|handbooks?|guides?|reading)\b/i],
    ['accessories', /\b(chargers?|cables?|mouse|mice|accessories|accessory|gan)\b/i],
  ];

  for (const [cat, regex] of categoryMap) {
    if (regex.test(msg)) {
      productCategory = cat;
      break;
    }
  }

  const cleanedSearchQuery = userMessage
    .replace(/\b(under|below|less\s+than|max(?:imum)?|within|up\s+to|budget\s+of)\s*([$£€₹¥]?\s*[\d,]+(?:\.\d+)?\s*(?:usd|inr|eur|gbp|jpy|cad|aud|rs\.?|dollars?|rupees?|pounds?|euros?|yen)?)/gi, '')
    .replace(/^(please\s+|hi[,\s]+|hello[,\s]+)?(i\s+(?:need|want|am\s+looking\s+for)|looking\s+for|find|show|search|get|recommend|suggest|give)\s+(me\s+)?(the\s+)?(best|good|top|cheap(?:est)?|affordable|a|an)?\s*/i, '')
    .replace(/\bfor\s+(online\s+classes?|video\s+calls?|meetings?|study(?:ing)?|work|programming|coding|gaming|music|travel|gifts?)\b/gi, '')
    .replace(/[.,!?]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let intentType: ShoppingRequirements['intentType'] = 'search';
  if (msg.includes('wishlist') || msg.includes('save this')) intentType = 'wishlist_action';
  else if (msg.includes('add to cart') || msg.includes('add this to my cart')) intentType = 'cart_action';
  else if (msg.includes('compare')) intentType = 'compare';
  else if (msg.includes('deal') || msg.includes('offer') || msg.includes('discount')) intentType = 'deal_discovery';
  else if (msg.includes('within my budget') || msg.includes('stay within')) intentType = 'budget_advice';

  const preferences: string[] = [];
  const intendedUsage: string[] = [];
  if (msg.includes('online class') || msg.includes('classes') || msg.includes('meeting') || msg.includes('zoom') || msg.includes('calls')) {
    intendedUsage.push('online classes & calls');
    preferences.push('built-in microphone');
  }
  if (msg.includes('programming') || msg.includes('coding') || msg.includes('developer')) {
    intendedUsage.push('programming / coding');
    preferences.push('comfortable for long sessions');
  }
  if (msg.includes('music') || msg.includes('audio') || msg.includes('sound quality')) {
    intendedUsage.push('music playback');
  }
  if (msg.includes('gaming') || msg.includes('game')) {
    intendedUsage.push('gaming');
  }
  if (msg.includes('study') || msg.includes('work') || msg.includes('office')) {
    intendedUsage.push('study & work');
  }
  if (msg.includes('gift') || msg.includes('birthday') || msg.includes('present')) preferences.push('gift');
  if (msg.includes('lightweight') || msg.includes('compact') || msg.includes('portable')) preferences.push('portable');
  if (msg.includes('waterproof') || msg.includes('water resistant')) preferences.push('waterproof');

  const preferredBrands: string[] = [];
  for (const b of ['Sony', 'Bose', 'Anker', 'Sennheiser', 'JBL', 'boAt', 'Portronics', 'Zebronics', 'Apple', 'Samsung', 'Nike']) {
    if (msg.includes(b.toLowerCase())) preferredBrands.push(b);
  }

  const importantFeatures: string[] = [];
  if (msg.includes('noise cancel') || msg.includes('anc')) importantFeatures.push('Active Noise Cancellation (ANC)');
  if (msg.includes('battery') || msg.includes('long lasting')) importantFeatures.push('Long battery life');
  if (msg.includes('bluetooth') || msg.includes('wireless')) importantFeatures.push('Wireless / Bluetooth');

  const isGreetingOrVague = ['hi', 'hello', 'hey', 'help me', 'shop'].includes(msg.trim());

  return {
    req: {
      productCategory,
      preferences,
      maxBudget: rawBudget,
      budgetCurrency,
      explicitCurrencyMentioned,
      currencyConflictDetected,
      country: localeCtx.countryCode,
      preferredBrands,
      importantFeatures,
      intendedUsage,
      constraints: rawBudget ? [`Budget: ${rawBudget} ${budgetCurrency}`] : [],
      searchQuery: cleanedSearchQuery || userMessage,
      isMissingEssentialInfo: isGreetingOrVague,
      followUpQuestion: isGreetingOrVague
        ? 'What kind of product or gift are you shopping for today? Feel free to mention your budget or preferred features!'
        : undefined,
      intentType,
    },
    budgetCurrency,
    rawBudget,
    explicitCurrencyMentioned,
    currencyConflictDetected,
  };
}

// ============================================================
// Heuristic Ranking Fallback
// ============================================================

function rankProductsHeuristic(
  products: Product[],
  requirements: ShoppingRequirements,
  localeCtx: LocalePromptContext,
  ratesData: ExchangeRatesData
): ProductRecommendation[] {
  const budgetCurrency = (requirements.budgetCurrency || localeCtx.currencyCode || 'USD').toUpperCase();

  return products
    .map((product) => {
      let matchScore = 50;
      const advantages: string[] = [];
      const limitations: string[] = [];

      const origCurrency = (product.originalCurrency || product.currency || 'USD').toUpperCase();
      const origPrice = product.originalPrice ?? product.price;
      const dispCurrency = (product.displayCurrency || localeCtx.currencyCode).toUpperCase();
      const dispPrice = product.displayPrice ?? origPrice;

      // Boost matching country/currency items honestly
      if (product.merchantCountry?.toUpperCase() === localeCtx.countryCode.toUpperCase()) {
        matchScore += 8;
      }
      if (origCurrency === localeCtx.currencyCode.toUpperCase()) {
        matchScore += 6;
      }

      if (requirements.maxBudget) {
        const productInBudgetCurrency = convertAmountWithRates(
          origPrice,
          origCurrency,
          budgetCurrency,
          ratesData.rates
        ).displayAmount;
        const formattedCeiling = formatCurrency(requirements.maxBudget, budgetCurrency, localeCtx.locale);

        if (productInBudgetCurrency <= requirements.maxBudget) {
          matchScore += 18;
          advantages.push(`Fits within your ${formattedCeiling} budget`);
        } else {
          matchScore -= 25;
          limitations.push(`Exceeds your ${formattedCeiling} budget`);
        }
      }

      if (product.rating) {
        if (product.rating >= 4.5) {
          matchScore += 15;
          advantages.push(`Highly rated (${product.rating}/5)`);
        } else if (product.rating >= 4.0) {
          matchScore += 10;
          advantages.push(`Well rated (${product.rating}/5)`);
        } else if (product.rating < 3.5) {
          matchScore -= 10;
          limitations.push(`Lower rating (${product.rating}/5)`);
        }
      }

      if (product.features) {
        for (const feature of requirements.importantFeatures) {
          const featureLower = feature.toLowerCase();
          if (product.features.some((f) => f.toLowerCase().includes(featureLower))) {
            matchScore += 8;
            advantages.push(`Has ${feature}`);
          }
        }
      }

      const trustWarnings = analyzeProductTrust(product);
      if (trustWarnings.length > 0) {
        matchScore -= trustWarnings.length * 5;
      }

      const parts: string[] = [];
      if (requirements.intendedUsage && requirements.intendedUsage.length > 0) {
        parts.push(`Recommended for ${requirements.intendedUsage.join(' and ')}.`);
      }
      if (requirements.maxBudget) {
        const productInBudgetCurrency = convertAmountWithRates(
          origPrice,
          origCurrency,
          budgetCurrency,
          ratesData.rates
        ).displayAmount;
        if (productInBudgetCurrency <= requirements.maxBudget) {
          parts.push(`At ${formatCurrency(dispPrice, dispCurrency, localeCtx.locale)}, it fits your budget.`);
        }
      }
      if (product.rating) {
        parts.push(`Rated ${product.rating}/5 across ${product.reviewCount || 0} reviews.`);
      }
      if (advantages.length > 0) {
        parts.push(`Strengths: ${advantages.slice(0, 3).join(', ')}.`);
      }

      return {
        product,
        matchScore: Math.max(0, Math.min(100, matchScore)),
        reasoning: parts.join(' ') || `${product.name} matches your shopping query.`,
        advantages,
        limitations,
        trustWarnings,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);
}

// ============================================================
// Main Agent Processing (Gemini + Channel3 + Smart Budget)
// ============================================================

export async function processShoppingRequest(
  userMessage: string,
  chatHistory: ChatMessage[],
  countryCode: string = 'US',
  currencyCode: string = 'USD',
  userId: string = 'demo-user-1',
  contextProductId?: string,
  resolvedPrefs?: ResolvedLocalePreferences
): Promise<AgentResponse> {
  try {
    const countryCfg = resolvedPrefs?.country || getCountryByCode(countryCode);
    const localeCtx: LocalePromptContext = {
      countryCode: resolvedPrefs?.countryCode || countryCfg.code,
      countryName: resolvedPrefs?.countryName || countryCfg.name,
      currencyCode: (resolvedPrefs?.currencyCode || currencyCode || countryCfg.currencyCode).toUpperCase(),
      locale: resolvedPrefs?.locale || countryCfg.locale,
    };

    const ratesData = await getExchangeRates();
    const explicitInText = detectExplicitCurrencyInMessage(userMessage);

    let requirements: ShoppingRequirements;
    let rawStatedBudget: number | undefined;
    let resolvedBudgetCurrency: string = localeCtx.currencyCode;
    let explicitCurrencyMentioned: string | undefined;
    let currencyConflictDetected = false;

    // Step 1: Parse intent & country/currency-bound budget
    if (isGeminiConfigured()) {
      try {
        const geminiAnalysis = await analyzeConversationWithGemini(
          userMessage,
          chatHistory,
          localeCtx
        );

        if (geminiAnalysis.isMissingEssentialInfo && geminiAnalysis.followUpQuestion) {
          return {
            message: geminiAnalysis.followUpQuestion,
            resolvedPreferences: localeCtx,
          };
        }

        if (typeof geminiAnalysis.maxBudget === 'number' && geminiAnalysis.maxBudget > 0) {
          rawStatedBudget = geminiAnalysis.maxBudget;

          // Backend currency guard: bare numbers WITHOUT explicit currency symbol/code MUST bind to localeCtx.currencyCode!
          if (explicitInText) {
            explicitCurrencyMentioned = explicitInText;
            resolvedBudgetCurrency = explicitInText;
            currencyConflictDetected = explicitInText !== localeCtx.currencyCode;
          } else {
            explicitCurrencyMentioned = undefined;
            resolvedBudgetCurrency = localeCtx.currencyCode;
            currencyConflictDetected = false;
          }
        } else {
          const fbBudget = extractRequirementsFallback(userMessage, localeCtx);
          if (typeof fbBudget.rawBudget === 'number' && fbBudget.rawBudget > 0) {
            rawStatedBudget = fbBudget.rawBudget;
            resolvedBudgetCurrency = fbBudget.budgetCurrency;
            explicitCurrencyMentioned = fbBudget.explicitCurrencyMentioned;
            currencyConflictDetected = fbBudget.currencyConflictDetected;
          }
        }

        requirements = {
          productCategory: geminiAnalysis.productCategory,
          maxBudget: rawStatedBudget,
          budgetCurrency: resolvedBudgetCurrency,
          explicitCurrencyMentioned,
          currencyConflictDetected,
          country: localeCtx.countryCode,
          preferredBrands: geminiAnalysis.preferredBrands,
          productRequirements: geminiAnalysis.productRequirements,
          intendedUsage: geminiAnalysis.intendedUsage,
          otherPreferences: geminiAnalysis.otherPreferences,
          preferences: [...geminiAnalysis.otherPreferences, ...geminiAnalysis.intendedUsage],
          importantFeatures: geminiAnalysis.productRequirements,
          constraints: rawStatedBudget
            ? [`Budget: ${formatCurrency(rawStatedBudget, resolvedBudgetCurrency, localeCtx.locale)}`]
            : [],
          searchQuery: geminiAnalysis.searchQuery,
          refinementAction: geminiAnalysis.refinementAction,
          intentType: geminiAnalysis.intentType,
        };
      } catch (geminiError) {
        console.warn('Gemini conversational analysis failed, using fallback parser:', geminiError);
        const fb = extractRequirementsFallback(userMessage, localeCtx);
        requirements = fb.req;
        rawStatedBudget = fb.rawBudget;
        resolvedBudgetCurrency = fb.budgetCurrency;
        explicitCurrencyMentioned = fb.explicitCurrencyMentioned;
        currencyConflictDetected = fb.currencyConflictDetected;
      }
    } else {
      const fb = extractRequirementsFallback(userMessage, localeCtx);
      requirements = fb.req;
      rawStatedBudget = fb.rawBudget;
      resolvedBudgetCurrency = fb.budgetCurrency;
      explicitCurrencyMentioned = fb.explicitCurrencyMentioned;
      currencyConflictDetected = fb.currencyConflictDetected;
      if (requirements.isMissingEssentialInfo && requirements.followUpQuestion) {
        return {
          message: requirements.followUpQuestion,
          resolvedPreferences: localeCtx,
        };
      }
    }

    const normalizedBudgetUSD =
      typeof rawStatedBudget === 'number' && rawStatedBudget > 0
        ? convertAmountWithRates(rawStatedBudget, resolvedBudgetCurrency, 'USD', ratesData.rates).amountUSD
        : undefined;

    const budgetExtraction = {
      category: requirements.productCategory,
      budget: rawStatedBudget,
      currency: resolvedBudgetCurrency,
      country: localeCtx.countryCode,
      maxPrice: rawStatedBudget,
      explicitCurrencyMentioned,
      currencyConflictDetected,
      normalizedUSD: normalizedBudgetUSD,
    };

    // Handle direct Budget Advice intent
    if (requirements.intentType === 'budget_advice') {
      const check = checkSpendingLimits(0, userId, 'USD', ratesData.rates);
      const safeCapInBudgetCurr =
        check.remainingDailyBudget > 0
          ? Math.min(check.maxPurchaseAmount, check.remainingDailyBudget)
          : check.maxPurchaseAmount;
      const safeCapInDisplay = convertAmountWithRates(
        safeCapInBudgetCurr,
        check.currency,
        localeCtx.currencyCode,
        ratesData.rates
      ).displayAmount;

      const budgetProducts = await searchProductCatalogue({
        query: '',
        maxPrice: safeCapInBudgetCurr,
        budgetCurrency: check.currency,
        countryCode: localeCtx.countryCode,
        currencyCode: localeCtx.currencyCode,
        ratesData,
      });
      const topRecs = rankProductsHeuristic(
        budgetProducts,
        {
          ...requirements,
          maxBudget: safeCapInBudgetCurr,
          budgetCurrency: check.currency,
        },
        localeCtx,
        ratesData
      ).slice(0, 3);

      const actions: CopilotActionProposal[] = topRecs.map((rec) => ({
        id: `act-cart-${rec.product.id}`,
        type: 'add_to_cart',
        label: `Add "${rec.product.name.slice(0, 28)}..." to Cart`,
        productId: rec.product.id,
        productName: rec.product.name,
        quantity: 1,
        requiresConfirmation: true,
      }));

      const fmtCheck = (amt: number) => {
        const native = formatCurrency(amt, check.currency);
        if (check.currency !== localeCtx.currencyCode) {
          const conv = convertAmountWithRates(amt, check.currency, localeCtx.currencyCode, ratesData.rates).displayAmount;
          return `${native} (~${formatCurrency(conv, localeCtx.currencyCode, localeCtx.locale)})`;
        }
        return native;
      };

      return {
        message: [
          `🛡️ **Smart Budget Status (${check.currency})**`,
          `- **Single Purchase Limit:** ${fmtCheck(check.maxPurchaseAmount)}`,
          `- **Daily Spending Limit:** ${fmtCheck(check.dailySpendingLimit)}`,
          `- **Spent Today:** ${fmtCheck(check.currentDailySpending)}`,
          `- **Remaining Daily Budget:** ${fmtCheck(check.remainingDailyBudget)}`,
          '',
          `Here are verified products currently within your **${formatCurrency(safeCapInDisplay, localeCtx.currencyCode, localeCtx.locale)}** safe limit:`,
        ].join('\n'),
        products: topRecs,
        actions,
        spendingCheck: check,
        budgetExtraction,
        resolvedPreferences: localeCtx,
      };
    }

    // Handle explicit Cart or Wishlist action when contextProductId is present
    if (
      contextProductId &&
      (requirements.intentType === 'wishlist_action' || requirements.intentType === 'cart_action')
    ) {
      const target = await getProduct(contextProductId, localeCtx.currencyCode);
      if (target) {
        const isWishlist = requirements.intentType === 'wishlist_action';
        const spendingCheck = checkSpendingLimits(
          target.originalPrice,
          userId,
          target.originalCurrency,
          ratesData.rates
        );
        const dispText = formatCurrency(
          target.displayPrice ?? target.originalPrice,
          target.displayCurrency || target.originalCurrency,
          localeCtx.locale
        );
        const origNote = target.priceIsConverted
          ? ` (Original: ${formatCurrency(target.originalPrice, target.originalCurrency)})`
          : '';
        return {
          message: isWishlist
            ? `I'm ready to add **${target.name}** (${dispText}${origNote}) to your Wishlist. Please confirm below:`
            : `I'm ready to add **${target.name}** (${dispText}${origNote}) to your Cart. ${
                spendingCheck.allowed ? 'It fits within your active budget limits.' : `⚠️ ${spendingCheck.message}`
              }\n\nPlease confirm below:`,
          actions: [
            {
              id: `act-confirm-${target.id}`,
              type: isWishlist ? 'add_to_wishlist' : 'add_to_cart',
              label: isWishlist ? `Confirm Add to Wishlist` : `Confirm Add to Cart`,
              productId: target.id,
              productName: target.name,
              quantity: 1,
              requiresConfirmation: true,
            },
          ],
          spendingCheck,
          budgetExtraction,
          resolvedPreferences: localeCtx,
        };
      }
    }

    // Step 2: Product Discovery via Channel3 + Country-Aware Local Catalog
    let query = requirements.searchQuery || userMessage;
    if (requirements.intentType === 'deal_discovery' && query.toLowerCase().includes('deal')) {
      query = '';
    }

    let products = await searchProductCatalogue({
      query,
      category: requirements.productCategory !== 'general' ? requirements.productCategory : undefined,
      maxPrice: rawStatedBudget,
      budgetCurrency: resolvedBudgetCurrency,
      countryCode: localeCtx.countryCode,
      currencyCode: localeCtx.currencyCode,
      ratesData,
      preferences: requirements.preferences,
    });

    // If deal discovery, prioritize items with genuine compareAtPrice > originalPrice
    if (requirements.intentType === 'deal_discovery') {
      const deals = products.filter(
        (p) => typeof p.compareAtPrice === 'number' && p.compareAtPrice > p.originalPrice
      );
      if (deals.length > 0) products = deals;
    }

    let relaxedBudgetNote: string | undefined;
    if (products.length === 0) {
      const broadQuery =
        requirements.productCategory !== 'general'
          ? requirements.productCategory
          : userMessage.split(' ').slice(0, 3).join(' ');
      const broader = await searchProductCatalogue({
        query: broadQuery,
        category: requirements.productCategory !== 'general' ? requirements.productCategory : undefined,
        countryCode: localeCtx.countryCode,
        currencyCode: localeCtx.currencyCode,
        ratesData,
      });
      if (broader.length > 0 && rawStatedBudget) {
        relaxedBudgetNote = `No exact matches were found under **${formatCurrency(rawStatedBudget, resolvedBudgetCurrency, localeCtx.locale)}**. Showing closest available options converted to **${localeCtx.currencyCode}**:`;
        products = broader.sort(
          (a, b) => (a.displayPrice ?? a.price) - (b.displayPrice ?? b.price)
        );
      } else {
        products = broader;
      }
    }

    if (products.length === 0) {
      return {
        message: `I searched live retailer catalogues and AgentPay inventory for "${query || userMessage}", but couldn't find matching products.\n\nTry:\n- Broadening your category or search term\n- Adjusting your budget limit`,
        budgetExtraction,
        resolvedPreferences: localeCtx,
      };
    }

    // Step 3: AI Product Evaluation & Comparison with Gemini
    let topRecommendations: ProductRecommendation[] = [];
    let comparisonSummary = '';

    if (isGeminiConfigured() && products.length > 0) {
      try {
        const candidatePool = products.slice(0, 8);
        const aiEvaluation: AIComparisonResponse = await evaluateAndRankProductsWithAI(
          candidatePool,
          requirements
        );

        comparisonSummary = aiEvaluation.comparisonSummary;
        const evalMap = new Map(aiEvaluation.evaluations.map((e) => [e.productId, e]));

        const ranked = candidatePool
          .map((product) => {
            const ev = evalMap.get(product.id);
            const trustWarnings = analyzeProductTrust(product, candidatePool);

            if (ev) {
              return {
                product,
                matchScore: Math.min(100, Math.max(0, ev.matchScore)),
                reasoning: ev.whyItMatches,
                advantages: ev.advantages,
                limitations: ev.limitations,
                trustWarnings,
                rank: ev.rank,
              };
            }
            const heuristicRec = rankProductsHeuristic([product], requirements, localeCtx, ratesData)[0];
            return { ...heuristicRec, rank: 99 };
          })
          .sort((a, b) => a.rank - b.rank);

        topRecommendations = ranked.slice(0, 3);
      } catch (evalError) {
        console.warn('Gemini AI evaluation failed, falling back to heuristic ranking:', evalError);
        topRecommendations = rankProductsHeuristic(products, requirements, localeCtx, ratesData).slice(0, 3);
      }
    } else {
      topRecommendations = rankProductsHeuristic(products, requirements, localeCtx, ratesData).slice(0, 3);
    }

    // Ensure every recommended product retains full currency metadata
    topRecommendations = topRecommendations.map((rec) => ({
      ...rec,
      product: enrichProductForPreferences(rec.product, localeCtx.currencyCode, ratesData),
    }));

    // Step 4: Smart Budget Protection check for top pick (converted safely to user's budget currency)
    let spendingCheck: SpendingCheck | undefined;
    if (topRecommendations.length > 0) {
      const topProd = topRecommendations[0].product;
      spendingCheck = checkSpendingLimits(
        topProd.originalPrice,
        userId,
        topProd.originalCurrency,
        ratesData.rates
      );
    }

    // Step 5: Generate explicit confirmation actions for Co-Pilot
    const actions: CopilotActionProposal[] = [];
    if (topRecommendations.length > 0) {
      const top = topRecommendations[0].product;
      actions.push({
        id: `act-cart-${top.id}`,
        type: 'add_to_cart',
        label: `Add #1 Pick to Cart`,
        productId: top.id,
        productName: top.name,
        quantity: 1,
        requiresConfirmation: true,
      });
      actions.push({
        id: `act-wish-${top.id}`,
        type: 'add_to_wishlist',
        label: `Save #1 Pick to Wishlist`,
        productId: top.id,
        productName: top.name,
        requiresConfirmation: true,
      });
    }
    if (topRecommendations.length >= 2) {
      actions.push({
        id: `act-cmp-${Date.now()}`,
        type: 'compare_products',
        label: `Compare Top ${topRecommendations.length} Picks`,
        productIds: topRecommendations.map((r) => r.product.id),
        requiresConfirmation: false,
      });
    }

    const isLive = topRecommendations.some((r) => !r.product.isDemo);
    const message = formatAgentResponse({
      userMessage,
      requirements,
      topRecommendations,
      spendingCheck,
      comparisonSummary,
      isLive,
      localeCtx,
      rawStatedBudget,
      resolvedBudgetCurrency,
      currencyConflictDetected,
      explicitCurrencyMentioned,
      ratesData,
      relaxedBudgetNote,
    });

    return {
      message,
      products: topRecommendations,
      actions,
      spendingCheck,
      budgetExtraction,
      resolvedPreferences: localeCtx,
    };
  } catch (error) {
    console.error('Agent processing error:', error);
    return {
      message: `I encountered an unexpected issue while processing your request. Please try again.\n\n*Error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }*`,
    };
  }
}

interface FormatAgentResponseParams {
  userMessage: string;
  requirements: ShoppingRequirements;
  topRecommendations: ProductRecommendation[];
  spendingCheck?: SpendingCheck;
  comparisonSummary?: string;
  isLive: boolean;
  localeCtx: LocalePromptContext;
  rawStatedBudget?: number;
  resolvedBudgetCurrency: string;
  currencyConflictDetected: boolean;
  explicitCurrencyMentioned?: string;
  ratesData: ExchangeRatesData;
  relaxedBudgetNote?: string;
}

function formatAgentResponse({
  requirements,
  topRecommendations,
  spendingCheck,
  comparisonSummary,
  isLive,
  localeCtx,
  rawStatedBudget,
  resolvedBudgetCurrency,
  currencyConflictDetected,
  explicitCurrencyMentioned,
  ratesData,
  relaxedBudgetNote,
}: FormatAgentResponseParams): string {
  const parts: string[] = [];

  const usageText =
    requirements.intendedUsage && requirements.intendedUsage.length > 0
      ? ` for **${requirements.intendedUsage.join(' & ')}**`
      : '';

  let budgetText = '';
  if (typeof rawStatedBudget === 'number' && rawStatedBudget > 0) {
    const formattedBudget = formatCurrency(rawStatedBudget, resolvedBudgetCurrency, localeCtx.locale);
    const scopeWord = relaxedBudgetNote ? 'nearest to' : 'within';
    if (resolvedBudgetCurrency !== localeCtx.currencyCode) {
      const convertedDisplay = convertAmountWithRates(
        rawStatedBudget,
        resolvedBudgetCurrency,
        localeCtx.currencyCode,
        ratesData.rates
      ).displayAmount;
      budgetText = ` ${scopeWord} your explicit **${formattedBudget}** (${resolvedBudgetCurrency}) budget (~${formatCurrency(convertedDisplay, localeCtx.currencyCode, localeCtx.locale)})`;
    } else {
      budgetText = ` ${scopeWord} your **${formattedBudget} (${resolvedBudgetCurrency})** budget`;
    }
  }

  parts.push(
    `I analyzed verified options for **${localeCtx.countryName} (${localeCtx.currencyCode})** and selected the **top ${topRecommendations.length} recommendations**${usageText}${budgetText}:`
  );
  parts.push('');

  if (currencyConflictDetected && explicitCurrencyMentioned && typeof rawStatedBudget === 'number') {
    const convertedLocal = convertAmountWithRates(
      rawStatedBudget,
      explicitCurrencyMentioned,
      localeCtx.currencyCode,
      ratesData.rates
    ).displayAmount;
    parts.push(
      `> 💱 **Explicit Currency Notice:** You specified **${formatCurrency(rawStatedBudget, explicitCurrencyMentioned)} (${explicitCurrencyMentioned})** while your storefront is set to **${localeCtx.countryName} (${localeCtx.currencyCode})**. Treating your budget strictly as **${rawStatedBudget} ${explicitCurrencyMentioned}** (~${formatCurrency(convertedLocal, localeCtx.currencyCode, localeCtx.locale)}) rather than overriding it.`
    );
    parts.push('');
  }

  if (relaxedBudgetNote) {
    parts.push(`> ℹ️ ${relaxedBudgetNote}`);
    parts.push('');
  }

  if (isLive) {
    parts.push(`*Sourced from Channel3 external merchants and AgentPay catalogue.*`);
  } else {
    parts.push(`*Verified AgentPay catalogue inventory.*`);
  }
  parts.push('');

  topRecommendations.forEach((rec, idx) => {
    const { product, matchScore, reasoning, advantages, limitations } = rec;
    const origPrice = product.originalPrice ?? product.price;
    const origCurrency = (product.originalCurrency || product.currency || 'USD').toUpperCase();
    const dispPrice = product.displayPrice ?? origPrice;
    const dispCurrency = (product.displayCurrency || origCurrency).toUpperCase();

    const formattedDisplay = formatCurrency(dispPrice, dispCurrency, localeCtx.locale);
    const rateNote =
      product.priceIsConverted && origCurrency !== dispCurrency && product.exchangeRateTimestamp
        ? ` · FX as of ${product.exchangeRateTimestamp}`
        : '';
    const convertedDisclosure =
      product.priceIsConverted && origCurrency !== dispCurrency
        ? ` *(Est. from ${formatCurrency(origPrice, origCurrency)} ${origCurrency} · Merchant: ${product.merchantCountry || 'International'}${rateNote})*`
        : product.merchantCountry
        ? ` *(Original ${product.merchantCountry} ${origCurrency} price)*`
        : '';

    const checkoutNote =
      product.checkoutType === 'agentpay'
        ? 'AgentPay PayPal Checkout'
        : `External Merchant (${product.seller}${product.merchantCountry && product.merchantCountry !== localeCtx.countryCode ? ` · ${product.merchantCountry} merchant — verify shipping` : ''})`;

    const specKeys = product.specs ? Object.entries(product.specs).slice(0, 3) : [];
    const specsDisclosure =
      specKeys.length > 0
        ? `Known specs: ${specKeys.map(([k, v]) => `${k}: ${v}`).join(', ')}`
        : 'Known specs: Not provided in merchant listing (check features/seller page)';

    parts.push(`### #${idx + 1}. ${product.name} — **${formattedDisplay} ${dispCurrency}**${convertedDisclosure}`);
    parts.push(
      `*Brand: **${product.brand}** · ${checkoutNote} · Match: **${matchScore}%**${
        product.rating ? ` · Rating: ⭐ ${product.rating}/5 (${product.reviewCount || 0})` : ' · Rating: Unverified'
      }*`
    );
    parts.push(`> ${reasoning}`);
    parts.push(`📋 ${specsDisclosure}`);
    if (advantages && advantages.length > 0) {
      parts.push(`✅ **Highlights:** ${advantages.slice(0, 3).join(' · ')}`);
    }
    if (limitations && limitations.length > 0) {
      parts.push(`⚠️ **Considerations:** ${limitations.slice(0, 2).join(' · ')}`);
    }
    parts.push('');
  });

  if (comparisonSummary) {
    parts.push('---');
    parts.push(`**AI Comparison:** ${comparisonSummary}`);
    parts.push('');
  }

  if (spendingCheck) {
    if (spendingCheck.allowed) {
      parts.push(`🛡️ **Budget Guard (${spendingCheck.currency}):** ${spendingCheck.message}`);
    } else {
      parts.push(`🚨 **Budget Warning (${spendingCheck.currency}):** ${spendingCheck.message}`);
    }
  }

  return parts.join('\n');
}
