// src/types/index.ts
// Central type definitions for the AgentPay E-Commerce Platform

// ============================================================
// Product Types
// ============================================================

export type CheckoutType = 'agentpay' | 'external';

export interface Product {
  id: string;
  name: string;
  brand: string;
  price: number; // Original numeric merchant price (= originalPrice)
  originalPrice: number; // Genuine original merchant price in originalCurrency
  originalCurrency: string; // ISO 4217 currency of merchant price (e.g. 'USD', 'INR')
  compareAtPrice?: number; // Retail MSRP strike-through price in originalCurrency when discounted
  currency: string; // Alias for originalCurrency
  displayPrice?: number; // Converted price in user's selected displayCurrency
  displayCurrency?: string; // User's selected ISO 4217 display currency
  displayCompareAtPrice?: number; // Converted compareAtPrice in displayCurrency when discounted
  exchangeRate?: number; // Multiplier originalCurrency -> displayCurrency (when converted)
  exchangeRateTimestamp?: string; // Exchange rate timestamp ISO string
  merchantCountry?: string; // ISO 3166-1 alpha-2 country code if known (e.g. 'IN', 'US')
  priceIsConverted?: boolean; // True when displayCurrency !== originalCurrency
  imageUrl: string;
  images?: string[];
  description: string;
  seller: string;
  productUrl: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  availability?: string;
  features?: string[];
  specs?: Record<string, string>;
  checkoutType?: CheckoutType;
  createdAt?: string;
  isDemo: boolean; // True for AgentPay store/demo items, false for live Channel3 external merchant items
}

export interface ProductSearchParams {
  query: string;
  category?: string;
  maxPrice?: number;
  minPrice?: number;
  minRating?: number;
  brands?: string[];
  preferences?: string[];
  sort?: 'relevance' | 'price_asc' | 'price_desc' | 'rating_desc' | 'popularity' | 'newest';
  checkoutType?: CheckoutType | 'all';
  page?: number;
  limit?: number;
}

export interface ProductRecommendation {
  product: Product;
  matchScore: number; // 0-100
  reasoning: string;
  advantages: string[];
  limitations: string[];
  trustWarnings: TrustWarning[];
}

// ============================================================
// Trust & Warning Types
// ============================================================

export interface TrustWarning {
  type: 'missing_seller' | 'missing_description' | 'price_anomaly' | 'incomplete_details' | 'suspicious_offer';
  severity: 'low' | 'medium' | 'high';
  message: string;
  details: string;
}

// ============================================================
// Auth & User Types
// ============================================================

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
}

export interface SavedAddress {
  id: string;
  userId: string;
  label: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  countryCode: string;
  isDefault: boolean;
  createdAt: string;
}

export interface ShoppingPreferencesData {
  preferredBrands: string[];
  preferredCategories: string[];
  maxBudget: number | null;
}

export interface NotificationPreferencesData {
  orderUpdates: boolean;
  paymentAlerts: boolean;
  priceDrops: boolean;
  promotions: boolean;
  updatedAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: 'order_update' | 'payment_status' | 'price_drop' | 'budget_alert' | 'promotion' | 'cart_reminder';
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

// ============================================================
// Cart, Wishlist & Coupons Types
// ============================================================

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
  lineTotal: number; // PayPal-normalized USD line total
  originalPrice: number;
  originalCurrency: string;
  originalLineTotal: number;
  displayPrice: number;
  displayCurrency: string;
  displayLineTotal: number;
  exchangeRate?: number;
  priceIsConverted: boolean;
  addedAt: string;
}

export interface CartSummary {
  items: CartItem[];
  agentPayItems: CartItem[];
  externalItems: CartItem[];
  itemCount: number;
  agentPaySubtotal: number; // Settlement USD subtotal
  externalSubtotal: number;
  subtotal: number;
  discountAmount: number;
  shippingAmount: number;
  finalPayableAmount: number; // Settlement USD payable amount
  appliedCoupon: CouponInfo | null;
  currency: string; // Settlement currency ('USD')
  displayCurrency: string;
  displayAgentPaySubtotal: number;
  displayExternalSubtotal: number;
  displaySubtotal: number;
  displayDiscountAmount: number;
  displayShippingAmount: number;
  displayFinalPayableAmount: number;
  exchangeRate?: number;
  exchangeRateTimestamp?: string;
  selectedCountryCode: string;
  paypalCheckoutAllowed: boolean;
  paypalSettlementCurrency: string;
  paypalEligibilityNote?: string;
}

export interface WishlistItem {
  id: string;
  productId: string;
  product: Product;
  savedPrice: number;
  currency: string;
  priceAlertEnabled: boolean;
  lastCheckedPrice?: number;
  lastCheckedAt?: string;
  priceDropped: boolean;
  priceDropAmount: number;
  addedAt: string;
}

export interface CouponInfo {
  code: string;
  description: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscount?: number;
  active: boolean;
  expiresAt?: string;
  eligibleScope: 'agentpay_checkout';
}

// ============================================================
// Budget Types
// ============================================================

export interface UserBudget {
  id: string;
  userId: string;
  maxPurchaseAmount: number;
  dailySpendingLimit: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpendingCheck {
  withinPurchaseLimit: boolean;
  withinDailyLimit: boolean;
  currentDailySpending: number;
  remainingDailyBudget: number;
  maxPurchaseAmount: number;
  dailySpendingLimit: number;
  currency: string;
  message: string;
  allowed: boolean;
}

export interface BudgetValidationResult {
  allowed: boolean;
  productId: string;
  productName: string;
  productImage: string;
  brand: string;
  seller: string;
  actualPrice: number;
  currency: string;
  budgetCurrency?: string;
  actualPriceInBudgetCurrency?: number;
  exchangeRateUsed?: number;
  maxPurchaseAmount: number;
  dailySpendingLimit: number;
  currentDailySpending: number;
  remainingDailyBudget: number;
  remainingAfterPurchase: number;
  withinPurchaseLimit: boolean;
  withinDailyLimit: boolean;
  isBoundaryMatch: boolean;
  isPurchaseBoundary?: boolean;
  isDailyBoundary?: boolean;
  status: 'approved' | 'blocked_purchase_limit' | 'blocked_daily_limit' | 'blocked_both';
  message: string;
  explanation: string;
}

// ============================================================
// Order Types
// ============================================================

export interface OrderLineItem {
  productId: string;
  productName: string;
  productImage: string;
  brand?: string;
  seller?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Order {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productImage: string;
  items?: OrderLineItem[];
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string;
  shippingAddress?: SavedAddress | null;
  orderType?: 'agentpay' | 'external';
  merchantName?: string;
  merchantUrl?: string;
  paypalOrderId: string;
  paypalCaptureId?: string;
  amount: number;
  currency: string;
  paymentStatus: 'pending' | 'approved' | 'captured' | 'cancelled' | 'failed';
  createdAt: string;
  isSandbox: boolean;
  displayAmount?: number;
  displayCurrency?: string;
  exchangeRate?: number;
  rateTimestamp?: string;
}

// ============================================================
// Country & Currency Preferences Types
// ============================================================

export interface UserPreferences {
  countryCode: string;
  currencyCode: string;
  country: {
    code: string;
    name: string;
    flag: string;
    currencyCode: string;
    currencySymbol: string;
    locale: string;
    paypalCheckoutSupported: boolean;
    paypalSupportedCurrency: boolean;
    paypalDomesticUnavailable?: boolean;
    notes?: string;
  };
  updatedAt: string;
}

export interface ExchangeRatesState {
  rates: Record<string, number>;
  timestamp: string;
  source: string;
}

// ============================================================
// Chat & AI Co-Pilot Types
// ============================================================

export interface CopilotActionProposal {
  id: string;
  type: 'add_to_cart' | 'add_to_wishlist' | 'compare_products' | 'open_checkout';
  label: string;
  productId?: string;
  productName?: string;
  productIds?: string[];
  quantity?: number;
  requiresConfirmation: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  products?: ProductRecommendation[];
  actions?: CopilotActionProposal[];
  isLoading?: boolean;
  searchStatus?: string;
  error?: string;
}

export interface ShoppingRequirements {
  productCategory: string;
  preferences: string[];
  maxBudget?: number;
  budgetCurrency?: string;
  explicitCurrencyMentioned?: string;
  currencyConflictDetected?: boolean;
  country?: string;
  preferredBrands: string[];
  importantFeatures: string[];
  productRequirements?: string[];
  intendedUsage?: string[];
  otherPreferences?: string[];
  occasion?: string;
  constraints: string[];
  searchQuery?: string;
  isMissingEssentialInfo?: boolean;
  followUpQuestion?: string;
  refinementAction?: 'none' | 'cheaper' | 'better_rated' | 'different_brand' | 'usage_change' | 'compare';
  intentType?: 'search' | 'compare' | 'wishlist_action' | 'cart_action' | 'budget_advice' | 'deal_discovery' | 'general_qa';
}

// ============================================================
// PayPal Types
// ============================================================

export interface PayPalOrder {
  id: string;
  status: string;
  approvalUrl?: string;
  amount: number;
  currency: string;
}

export interface PaymentApproval {
  product: Product;
  amount: number;
  currency: string;
  remainingBudget: number;
  paypalOrderId: string;
  status: string;
}

// ============================================================
// Dashboard Types
// ============================================================

export interface SpendingSummary {
  totalSpending: number;
  orderCount: number;
  todaySpending: number;
  dailySpendingLimit: number;
  remainingDailyBudget: number;
  maxPurchaseAmount: number;
  currency?: string;
  recentOrders: Order[];
  budgetUtilization: number; // percentage
}

// ============================================================
// AI Agent Types
// ============================================================

export type AgentToolName =
  | 'search_products'
  | 'compare_products'
  | 'recommend_products'
  | 'check_spending_limits'
  | 'create_paypal_order'
  | 'get_order_status';

export interface AgentToolCall {
  name: AgentToolName;
  arguments: Record<string, unknown>;
}

export interface AgentResponse {
  message: string;
  toolCalls?: AgentToolCall[];
  products?: ProductRecommendation[];
  actions?: CopilotActionProposal[];
  spendingCheck?: SpendingCheck;
  paypalOrder?: PayPalOrder;
  budgetExtraction?: {
    category: string;
    budget?: number;
    currency: string;
    country: string;
    maxPrice?: number;
    explicitCurrencyMentioned?: string;
    currencyConflictDetected?: boolean;
    normalizedUSD?: number;
  };
  resolvedPreferences?: {
    countryCode: string;
    countryName: string;
    currencyCode: string;
    locale: string;
  };
}

// ============================================================
// API Response Types
// ============================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
