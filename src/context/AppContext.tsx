'use client';

// src/context/AppContext.tsx
// Global application state management for the AgentPay E-Commerce Platform

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import {
  ChatMessage,
  ProductRecommendation,
  UserBudget,
  SpendingSummary,
  Order,
  PayPalOrder,
  Product,
  UserPreferences,
  ExchangeRatesState,
  AuthUser,
  CartSummary,
  WishlistItem,
  AppNotification,
} from '@/types';
import { DEFAULT_COUNTRY, getCountryByCode } from '@/lib/countries';
import { convertAmountWithRates, formatCurrency } from '@/lib/exchange-rates';

type PageType =
  | 'assistant'
  | 'comparison'
  | 'spending'
  | 'orders'
  | 'rewards'
  | 'budget'
  | 'settings';

export interface DeliveryLocation {
  label: string;
  city: string;
  postalCode: string;
}

export interface ToastMessage {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

const DEFAULT_CART: CartSummary = {
  items: [],
  agentPayItems: [],
  externalItems: [],
  itemCount: 0,
  agentPaySubtotal: 0,
  externalSubtotal: 0,
  subtotal: 0,
  discountAmount: 0,
  shippingAmount: 0,
  finalPayableAmount: 0,
  appliedCoupon: null,
  currency: 'USD',
  displayCurrency: 'USD',
  displayAgentPaySubtotal: 0,
  displayExternalSubtotal: 0,
  displaySubtotal: 0,
  displayDiscountAmount: 0,
  displayShippingAmount: 0,
  displayFinalPayableAmount: 0,
  exchangeRate: 1,
  selectedCountryCode: 'US',
  paypalCheckoutAllowed: true,
  paypalSettlementCurrency: 'USD',
};

const COMPARE_STORAGE_KEY = 'agentpay_compare_v1';
const DELIVERY_STORAGE_KEY = 'agentpay_delivery_v1';
const LOCALE_STORAGE_KEY = 'agentpay_locale_v1';

interface AppState {
  currentPage: PageType;
  activePage: PageType;
  user: AuthUser | null;
  authLoading: boolean;
  showAuthModal: boolean;
  messages: ChatMessage[];
  isTyping: boolean;
  isProcessing: boolean;
  selectedProduct: ProductRecommendation | null;
  budget: UserBudget | null;
  spendingSummary: SpendingSummary | null;
  orders: Order[];
  activePaymentOrder: PayPalOrder | null;
  showPaymentModal: boolean;
  showCheckout: boolean;
  sidebarOpen: boolean;
  showCountrySelector: boolean;
  userPreferences: UserPreferences;
  exchangeRates: ExchangeRatesState;
  ratesSource: string;
  ratesTimestamp: string;
  isDemoMode: boolean;
  error: string | null;
  // Storefront state
  cart: CartSummary;
  cartDrawerOpen: boolean;
  appliedCouponCode: string;
  wishlist: WishlistItem[];
  compareProducts: Product[];
  quickViewProduct: Product | null;
  copilotOpen: boolean;
  copilotInitialPrompt: string | null;
  notifications: AppNotification[];
  deliveryLocation: DeliveryLocation;
  toast: ToastMessage | null;
}

type AppAction =
  | { type: 'SET_PAGE'; payload: string }
  | { type: 'TOGGLE_SIDEBAR'; payload?: boolean }
  | { type: 'CLOSE_SIDEBAR' }
  | { type: 'SET_USER'; payload: AuthUser | null }
  | { type: 'SET_AUTH_LOADING'; payload: boolean }
  | { type: 'SET_SHOW_AUTH_MODAL'; payload: boolean }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_LAST_MESSAGE'; payload: Partial<ChatMessage> }
  | { type: 'SET_TYPING'; payload: boolean }
  | { type: 'SELECT_PRODUCT'; payload: ProductRecommendation | null }
  | { type: 'SET_BUDGET'; payload: UserBudget | null }
  | { type: 'SET_SPENDING_SUMMARY'; payload: SpendingSummary | null }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'SET_ACTIVE_PAYMENT'; payload: PayPalOrder | null }
  | { type: 'SET_SHOW_PAYMENT_MODAL'; payload: boolean }
  | { type: 'SET_SHOW_COUNTRY_SELECTOR'; payload: boolean }
  | { type: 'SET_USER_PREFERENCES'; payload: UserPreferences }
  | { type: 'SET_EXCHANGE_RATES'; payload: ExchangeRatesState }
  | { type: 'SET_DEMO_MODE'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_CART'; payload: CartSummary }
  | { type: 'SET_CART_DRAWER_OPEN'; payload: boolean }
  | { type: 'SET_COUPON_CODE'; payload: string }
  | { type: 'SET_WISHLIST'; payload: WishlistItem[] }
  | { type: 'SET_COMPARE_PRODUCTS'; payload: Product[] }
  | { type: 'SET_QUICK_VIEW_PRODUCT'; payload: Product | null }
  | { type: 'SET_COPILOT_OPEN'; payload: { open: boolean; prompt?: string | null } }
  | { type: 'SET_NOTIFICATIONS'; payload: AppNotification[] }
  | { type: 'SET_DELIVERY_LOCATION'; payload: DeliveryLocation }
  | { type: 'SET_TOAST'; payload: ToastMessage | null };

const DEFAULT_PREFERENCES: UserPreferences = {
  countryCode: DEFAULT_COUNTRY.code,
  currencyCode: DEFAULT_COUNTRY.currencyCode,
  country: {
    code: DEFAULT_COUNTRY.code,
    name: DEFAULT_COUNTRY.name,
    flag: DEFAULT_COUNTRY.flag,
    currencyCode: DEFAULT_COUNTRY.currencyCode,
    currencySymbol: DEFAULT_COUNTRY.currencySymbol,
    locale: DEFAULT_COUNTRY.locale,
    paypalCheckoutSupported: DEFAULT_COUNTRY.paypalCheckoutSupported,
    paypalSupportedCurrency: DEFAULT_COUNTRY.paypalSupportedCurrency,
    paypalDomesticUnavailable: DEFAULT_COUNTRY.paypalDomesticUnavailable,
    notes: DEFAULT_COUNTRY.notes,
  },
  updatedAt: new Date().toISOString(),
};

const DEFAULT_EXCHANGE_RATES: ExchangeRatesState = {
  rates: {
    USD: 1.0,
    INR: 85.0,
    GBP: 0.79,
    EUR: 0.92,
    CAD: 1.38,
    AUD: 1.54,
    JPY: 152.0,
    SGD: 1.35,
  },
  timestamp: new Date().toISOString(),
  source: 'fallback',
};

const initialState: AppState = {
  currentPage: 'assistant',
  activePage: 'assistant',
  user: null,
  authLoading: true,
  showAuthModal: false,
  messages: [
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        "Hi! I'm your **AgentPay AI Co-Pilot**. Ask me to search products across the store & live merchants, compare options, check deals within your budget, or add items to your cart and wishlist.",
      timestamp: new Date().toISOString(),
    },
  ],
  isTyping: false,
  isProcessing: false,
  selectedProduct: null,
  budget: null,
  spendingSummary: null,
  orders: [],
  activePaymentOrder: null,
  showPaymentModal: false,
  showCheckout: false,
  sidebarOpen: false,
  showCountrySelector: false,
  userPreferences: DEFAULT_PREFERENCES,
  exchangeRates: DEFAULT_EXCHANGE_RATES,
  ratesSource: DEFAULT_EXCHANGE_RATES.source,
  ratesTimestamp: DEFAULT_EXCHANGE_RATES.timestamp,
  isDemoMode: true,
  error: null,
  cart: DEFAULT_CART,
  cartDrawerOpen: false,
  appliedCouponCode: '',
  wishlist: [],
  compareProducts: [],
  quickViewProduct: null,
  copilotOpen: false,
  copilotInitialPrompt: null,
  notifications: [],
  deliveryLocation: {
    label: 'San Francisco, 94105',
    city: 'San Francisco',
    postalCode: '94105',
  },
  toast: null,
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_PAGE': {
      const page = action.payload as PageType;
      return { ...state, currentPage: page, activePage: page };
    }
    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        sidebarOpen: action.payload !== undefined ? action.payload : !state.sidebarOpen,
      };
    case 'CLOSE_SIDEBAR':
      return { ...state, sidebarOpen: false };
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_AUTH_LOADING':
      return { ...state, authLoading: action.payload };
    case 'SET_SHOW_AUTH_MODAL':
      return { ...state, showAuthModal: action.payload };
    case 'SET_MESSAGES':
      return { ...state, messages: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'UPDATE_LAST_MESSAGE': {
      const updated = [...state.messages];
      if (updated.length > 0) {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          ...action.payload,
        };
      }
      return { ...state, messages: updated };
    }
    case 'SET_TYPING':
      return { ...state, isTyping: action.payload, isProcessing: action.payload };
    case 'SELECT_PRODUCT':
      return { ...state, selectedProduct: action.payload };
    case 'SET_BUDGET':
      return { ...state, budget: action.payload };
    case 'SET_SPENDING_SUMMARY':
      return { ...state, spendingSummary: action.payload };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'SET_ACTIVE_PAYMENT':
      return { ...state, activePaymentOrder: action.payload };
    case 'SET_SHOW_PAYMENT_MODAL':
      return { ...state, showPaymentModal: action.payload, showCheckout: action.payload };
    case 'SET_SHOW_COUNTRY_SELECTOR':
      return { ...state, showCountrySelector: action.payload };
    case 'SET_USER_PREFERENCES':
      return { ...state, userPreferences: action.payload };
    case 'SET_EXCHANGE_RATES':
      return {
        ...state,
        exchangeRates: action.payload,
        ratesSource: action.payload.source,
        ratesTimestamp: action.payload.timestamp,
      };
    case 'SET_DEMO_MODE':
      return { ...state, isDemoMode: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'CLEAR_MESSAGES':
      return { ...state, messages: [initialState.messages[0]], selectedProduct: null };
    case 'SET_CART':
      return { ...state, cart: action.payload };
    case 'SET_CART_DRAWER_OPEN':
      return { ...state, cartDrawerOpen: action.payload };
    case 'SET_COUPON_CODE':
      return { ...state, appliedCouponCode: action.payload };
    case 'SET_WISHLIST':
      return { ...state, wishlist: action.payload };
    case 'SET_COMPARE_PRODUCTS':
      return { ...state, compareProducts: action.payload };
    case 'SET_QUICK_VIEW_PRODUCT':
      return { ...state, quickViewProduct: action.payload };
    case 'SET_COPILOT_OPEN':
      return {
        ...state,
        copilotOpen: action.payload.open,
        copilotInitialPrompt:
          action.payload.prompt !== undefined ? action.payload.prompt : state.copilotInitialPrompt,
      };
    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload };
    case 'SET_DELIVERY_LOCATION':
      return { ...state, deliveryLocation: action.payload };
    case 'SET_TOAST':
      return { ...state, toast: action.payload };
    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Auth
  refreshAuth: () => Promise<AuthUser | null>;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (
    name: string,
    email: string,
    password: string,
    phone?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  loginAsDemo: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  // Assistant
  sendMessage: (content: string) => Promise<void>;
  // Budget, Orders, Spending
  loadBudget: () => Promise<void>;
  saveBudget: (maxPurchaseAmount: number, dailySpendingLimit: number, currencyCode?: string) => Promise<boolean>;
  loadOrders: () => Promise<void>;
  loadSpendingSummary: () => Promise<void>;
  // Product & Checkout
  selectProduct: (rec: ProductRecommendation) => void;
  clearSelectedProduct: () => void;
  proceedToCheckout: (rec?: ProductRecommendation) => void;
  selectProductForCheckout: (rec: ProductRecommendation) => void;
  cancelCheckout: () => void;
  // Preferences & Currency
  loadUserPreferences: () => Promise<void>;
  saveUserPreferences: (countryCode: string, currencyCode: string) => Promise<boolean>;
  loadExchangeRates: () => Promise<void>;
  openCountrySelector: () => void;
  closeCountrySelector: () => void;
  getConvertedPrice: (amount: number, fromCurrency?: string) => {
    displayAmount: number;
    displayCurrency: string;
    originalCurrency: string;
    formatted: string;
    formattedOriginal: string;
    exchangeRate: number;
    isConverted: boolean;
  };
  formatPrice: (amount: number, showOriginal?: boolean, fromCurrency?: string) => string;
  // Cart
  loadCart: (couponCode?: string) => Promise<void>;
  addToCart: (product: Product, quantity?: number, openDrawer?: boolean) => Promise<boolean>;
  updateCartQty: (productId: string, quantity: number) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  applyCoupon: (code: string) => Promise<{ ok: boolean; error?: string }>;
  openCartDrawer: () => void;
  closeCartDrawer: () => void;
  // Wishlist
  loadWishlist: () => Promise<void>;
  toggleWishlist: (product: Product) => Promise<boolean>;
  isInWishlist: (productId: string) => boolean;
  moveWishlistToCart: (productId: string) => Promise<void>;
  // Compare
  toggleCompare: (product: Product) => void;
  isInCompare: (productId: string) => boolean;
  clearCompare: () => void;
  // Quick View & Recently Viewed
  openQuickView: (product: Product) => void;
  closeQuickView: () => void;
  recordRecentlyViewed: (product: Product) => Promise<void>;
  // Copilot
  openCopilot: (initialPrompt?: string) => void;
  closeCopilot: () => void;
  // Notifications & Delivery & Toast
  unreadNotificationCount: number;
  loadNotifications: () => Promise<void>;
  markNotificationsRead: (notificationId?: string) => Promise<void>;
  setDeliveryLocation: (loc: DeliveryLocation) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback(
    (message: string, type: 'success' | 'error' | 'info' = 'info') => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      const id = `toast-${Date.now()}`;
      dispatch({ type: 'SET_TOAST', payload: { id, message, type } });
      toastTimerRef.current = setTimeout(() => {
        dispatch({ type: 'SET_TOAST', payload: null });
      }, 3600);
    },
    []
  );

  const clearToast = useCallback(() => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    dispatch({ type: 'SET_TOAST', payload: null });
  }, []);

  const loadBudget = useCallback(async () => {
    try {
      const res = await fetch('/api/budget');
      if (res.status === 401) {
        dispatch({ type: 'SET_BUDGET', payload: null });
        return;
      }
      const data = await res.json();
      if (data.success && data.data) {
        dispatch({ type: 'SET_BUDGET', payload: data.data });
      }
    } catch (err) {
      console.error('Failed to load budget:', err);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.status === 401) {
        dispatch({ type: 'SET_ORDERS', payload: [] });
        return;
      }
      const data = await res.json();
      if (data.success && data.data) {
        dispatch({ type: 'SET_ORDERS', payload: data.data });
      }
    } catch (err) {
      console.error('Failed to load orders:', err);
    }
  }, []);

  const loadSpendingSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/spending');
      if (res.status === 401) {
        dispatch({ type: 'SET_SPENDING_SUMMARY', payload: null });
        return;
      }
      const data = await res.json();
      if (data.success && data.data) {
        dispatch({ type: 'SET_SPENDING_SUMMARY', payload: data.data });
      }
    } catch (err) {
      console.error('Failed to load spending summary:', err);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      if (!res.ok) {
        dispatch({ type: 'SET_NOTIFICATIONS', payload: [] });
        return;
      }
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        dispatch({ type: 'SET_NOTIFICATIONS', payload: data.data });
      }
    } catch (err) {
      console.error('Failed to load notifications:', err);
    }
  }, []);

  const markNotificationsRead = useCallback(async (notificationId?: string) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notificationId ? { notificationId } : {}),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          dispatch({ type: 'SET_NOTIFICATIONS', payload: data.data });
        }
      }
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  }, []);

  const loadCart = useCallback(
    async (couponOverride?: string) => {
      try {
        const code = couponOverride !== undefined ? couponOverride : state.appliedCouponCode;
        const url = code
          ? `/api/cart?coupon=${encodeURIComponent(code)}`
          : '/api/cart';
        const res = await fetch(url);
        const data = await res.json();
        if (data.success && data.data) {
          dispatch({ type: 'SET_CART', payload: data.data });
        }
      } catch (err) {
        console.error('Failed to load cart:', err);
      }
    },
    [state.appliedCouponCode]
  );

  const loadWishlist = useCallback(async () => {
    try {
      const res = await fetch('/api/wishlist');
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        dispatch({ type: 'SET_WISHLIST', payload: data.data });
      }
    } catch (err) {
      console.error('Failed to load wishlist:', err);
    }
  }, []);

  const loadUserPreferences = useCallback(async () => {
    try {
      const res = await fetch('/api/user/preferences');
      const data = await res.json();
      if (data.success && data.data) {
        dispatch({ type: 'SET_USER_PREFERENCES', payload: data.data });
        try {
          localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(data.data));
        } catch {
          // ignore storage quota errors
        }
      } else {
        try {
          const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
          if (savedLocale) {
            const parsed = JSON.parse(savedLocale) as UserPreferences;
            if (parsed?.countryCode && parsed?.currencyCode) {
              dispatch({ type: 'SET_USER_PREFERENCES', payload: parsed });
              // Sync client preference back to server cookie so SSR/API stay aligned
              fetch('/api/user/preferences', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  countryCode: parsed.countryCode,
                  currencyCode: parsed.currencyCode,
                }),
              }).catch(() => {});
            }
          }
        } catch {
          // ignore malformed localStorage
        }
      }
    } catch (err) {
      console.error('Failed to load user preferences:', err);
    }
  }, []);

  const loadExchangeRates = useCallback(async () => {
    try {
      const res = await fetch('/api/exchange-rates');
      const data = await res.json();
      if (data.success && data.data) {
        dispatch({ type: 'SET_EXCHANGE_RATES', payload: data.data });
      }
    } catch (err) {
      console.error('Failed to load exchange rates:', err);
    }
  }, []);

  const refreshAuth = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await fetch('/api/auth/me');
      const data = await res.json();
      const user = data.success ? data.data?.user || null : null;
      dispatch({ type: 'SET_USER', payload: user });
      return user;
    } catch {
      dispatch({ type: 'SET_USER', payload: null });
      return null;
    } finally {
      dispatch({ type: 'SET_AUTH_LOADING', payload: false });
    }
  }, []);

  const hydrateUserData = useCallback(async () => {
    await Promise.all([
      loadCart(),
      loadWishlist(),
      loadBudget(),
      loadOrders(),
      loadSpendingSummary(),
      loadNotifications(),
      loadUserPreferences(),
    ]);
  }, [
    loadCart,
    loadWishlist,
    loadBudget,
    loadOrders,
    loadSpendingSummary,
    loadNotifications,
    loadUserPreferences,
  ]);

  // Initial load on mount
  useEffect(() => {
    // Hydrate localStorage state safely on client
    try {
      const savedCompare = localStorage.getItem(COMPARE_STORAGE_KEY);
      if (savedCompare) {
        const parsed = JSON.parse(savedCompare);
        if (Array.isArray(parsed)) {
          dispatch({ type: 'SET_COMPARE_PRODUCTS', payload: parsed.slice(0, 4) });
        }
      }
      const savedDelivery = localStorage.getItem(DELIVERY_STORAGE_KEY);
      if (savedDelivery) {
        const parsed = JSON.parse(savedDelivery);
        if (parsed?.city) {
          dispatch({ type: 'SET_DELIVERY_LOCATION', payload: parsed });
        }
      }
      const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (savedLocale) {
        const parsedLocale = JSON.parse(savedLocale) as UserPreferences;
        if (parsedLocale?.countryCode && parsedLocale?.currencyCode) {
          dispatch({ type: 'SET_USER_PREFERENCES', payload: parsedLocale });
        }
      }
    } catch {
      // Ignore localStorage parse errors
    }

    (async () => {
      await loadExchangeRates();
      const user = await refreshAuth();
      await Promise.all([loadCart(), loadWishlist(), loadUserPreferences()]);
      if (user) {
        await Promise.all([
          loadBudget(),
          loadOrders(),
          loadSpendingSummary(),
          loadNotifications(),
        ]);
      }
    })();
  }, [
    loadExchangeRates,
    refreshAuth,
    loadCart,
    loadWishlist,
    loadUserPreferences,
    loadBudget,
    loadOrders,
    loadSpendingSummary,
    loadNotifications,
  ]);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { ok: false, error: data.error || 'Sign in failed' };
        }
        dispatch({ type: 'SET_USER', payload: data.data.user });
        dispatch({ type: 'SET_SHOW_AUTH_MODAL', payload: false });
        await hydrateUserData();
        showToast(`Welcome back, ${data.data.user.name}!`, 'success');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Sign in failed',
        };
      }
    },
    [hydrateUserData, showToast]
  );

  const register = useCallback(
    async (name: string, email: string, password: string, phone?: string) => {
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password, phone }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          return { ok: false, error: data.error || 'Registration failed' };
        }
        dispatch({ type: 'SET_USER', payload: data.data.user });
        dispatch({ type: 'SET_SHOW_AUTH_MODAL', payload: false });
        await hydrateUserData();
        showToast(`Account created! Welcome, ${data.data.user.name}.`, 'success');
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Registration failed',
        };
      }
    },
    [hydrateUserData, showToast]
  );

  const loginAsDemo = useCallback(async () => {
    return login('demo@agentpay.app', 'DemoUser123!');
  }, [login]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      dispatch({ type: 'SET_USER', payload: null });
      dispatch({ type: 'SET_BUDGET', payload: null });
      dispatch({ type: 'SET_SPENDING_SUMMARY', payload: null });
      dispatch({ type: 'SET_ORDERS', payload: [] });
      dispatch({ type: 'SET_NOTIFICATIONS', payload: [] });
      dispatch({ type: 'SET_COUPON_CODE', payload: '' });
      await Promise.all([loadCart(''), loadWishlist()]);
      showToast('Signed out cleanly.', 'info');
    }
  }, [loadCart, loadWishlist, showToast]);

  const saveUserPreferences = useCallback(
    async (countryCode: string, currencyCode: string): Promise<boolean> => {
      try {
        const countryCfg = getCountryByCode(countryCode);
        const optimisticPref: UserPreferences = {
          countryCode: countryCfg.code,
          currencyCode: currencyCode || countryCfg.currencyCode,
          country: countryCfg,
          updatedAt: new Date().toISOString(),
        };
        dispatch({ type: 'SET_USER_PREFERENCES', payload: optimisticPref });
        try {
          localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(optimisticPref));
        } catch {
          // ignore
        }

        const res = await fetch('/api/user/preferences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            countryCode: optimisticPref.countryCode,
            currencyCode: optimisticPref.currencyCode,
          }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          dispatch({ type: 'SET_USER_PREFERENCES', payload: data.data });
          try {
            localStorage.setItem(LOCALE_STORAGE_KEY, JSON.stringify(data.data));
          } catch {
            // ignore
          }
          await Promise.all([loadCart(), loadWishlist(), loadBudget()]);
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to save user preferences:', err);
        return false;
      }
    },
    [loadCart, loadWishlist, loadBudget]
  );

  const openCountrySelector = useCallback(() => {
    dispatch({ type: 'SET_SHOW_COUNTRY_SELECTOR', payload: true });
  }, []);

  const closeCountrySelector = useCallback(() => {
    dispatch({ type: 'SET_SHOW_COUNTRY_SELECTOR', payload: false });
  }, []);

  const openAuthModal = useCallback(() => {
    dispatch({ type: 'SET_SHOW_AUTH_MODAL', payload: true });
  }, []);

  const closeAuthModal = useCallback(() => {
    dispatch({ type: 'SET_SHOW_AUTH_MODAL', payload: false });
  }, []);

  const getConvertedPrice = useCallback(
    (amount: number, fromCurrency: string = 'USD') => {
      const targetCurrency = (state.userPreferences.currencyCode || 'USD').toUpperCase();
      const sourceCurrency = (fromCurrency || 'USD').toUpperCase();
      const locale = state.userPreferences.country?.locale || 'en-US';
      const formattedOriginal = formatCurrency(amount, sourceCurrency);

      if (targetCurrency === sourceCurrency) {
        return {
          displayAmount: amount,
          displayCurrency: targetCurrency,
          originalCurrency: sourceCurrency,
          formatted: formatCurrency(amount, targetCurrency, locale),
          formattedOriginal,
          exchangeRate: 1,
          isConverted: false,
        };
      }
      const { displayAmount, rate } = convertAmountWithRates(
        amount,
        sourceCurrency,
        targetCurrency,
        state.exchangeRates.rates
      );
      return {
        displayAmount,
        displayCurrency: targetCurrency,
        originalCurrency: sourceCurrency,
        formatted: formatCurrency(displayAmount, targetCurrency, locale),
        formattedOriginal,
        exchangeRate: rate,
        isConverted: true,
      };
    },
    [state.userPreferences, state.exchangeRates.rates]
  );

  const formatPrice = useCallback(
    (amount: number, showOriginal = false, fromCurrency = 'USD'): string => {
      const info = getConvertedPrice(amount, fromCurrency);
      if (showOriginal && info.isConverted) {
        return `${info.formatted} (${info.formattedOriginal})`;
      }
      return info.formatted;
    },
    [getConvertedPrice]
  );

  const saveBudget = useCallback(
    async (
      maxPurchaseAmount: number,
      dailySpendingLimit: number,
      currencyCode?: string
    ): Promise<boolean> => {
      try {
        const targetCurrency = (currencyCode || state.userPreferences.currencyCode || 'USD').toUpperCase();
        const res = await fetch('/api/budget', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            maxPurchaseAmount,
            dailySpendingLimit,
            currency: targetCurrency,
          }),
        });
        if (res.status === 401) {
          dispatch({ type: 'SET_SHOW_AUTH_MODAL', payload: true });
          showToast('Please sign in to save your spending limits.', 'error');
          return false;
        }
        const data = await res.json();
        if (data.success && data.data) {
          dispatch({ type: 'SET_BUDGET', payload: data.data });
          await loadSpendingSummary();
          return true;
        }
        return false;
      } catch (err) {
        console.error('Failed to save budget:', err);
        return false;
      }
    },
    [loadSpendingSummary, showToast, state.userPreferences.currencyCode]
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const userMsg: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_MESSAGE', payload: userMsg });
      dispatch({ type: 'SET_TYPING', payload: true });

      const loadingMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isLoading: true,
        searchStatus: 'Analyzing your request & searching catalogue...',
      };
      dispatch({ type: 'ADD_MESSAGE', payload: loadingMsg });

      try {
        const history = state.messages
          .filter((m) => m.id !== 'welcome-msg' && !m.isLoading)
          .slice(-6)
          .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: content,
            history,
            countryCode: state.userPreferences.countryCode,
            currencyCode: state.userPreferences.currencyCode,
          }),
        });

        const data = await res.json();

        if (data.success && data.data) {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: {
              content: data.data.message,
              products: data.data.products,
              actions: data.data.actions,
              isLoading: false,
              searchStatus: undefined,
            },
          });
        } else {
          dispatch({
            type: 'UPDATE_LAST_MESSAGE',
            payload: {
              content: data.error || 'Sorry, I encountered an error processing your request.',
              isLoading: false,
              error: data.error,
              searchStatus: undefined,
            },
          });
        }
      } catch (err) {
        dispatch({
          type: 'UPDATE_LAST_MESSAGE',
          payload: {
            content: 'Connection error. Please check your internet connection and try again.',
            isLoading: false,
            error: err instanceof Error ? err.message : 'Network error',
            searchStatus: undefined,
          },
        });
      } finally {
        dispatch({ type: 'SET_TYPING', payload: false });
      }
    },
    [state.messages, state.userPreferences.countryCode, state.userPreferences.currencyCode]
  );

  const selectProduct = useCallback((rec: ProductRecommendation) => {
    dispatch({ type: 'SELECT_PRODUCT', payload: rec });
  }, []);

  const clearSelectedProduct = useCallback(() => {
    dispatch({ type: 'SELECT_PRODUCT', payload: null });
  }, []);

  const proceedToCheckout = useCallback(
    (rec?: ProductRecommendation) => {
      if (rec) {
        dispatch({ type: 'SELECT_PRODUCT', payload: rec });
      }
      if (!state.user) {
        dispatch({ type: 'SET_SHOW_AUTH_MODAL', payload: true });
        showToast('Sign in or use the Demo Account to check out.', 'info');
        return;
      }
      dispatch({ type: 'SET_SHOW_PAYMENT_MODAL', payload: true });
    },
    [state.user, showToast]
  );

  const selectProductForCheckout = useCallback(
    (rec: ProductRecommendation) => {
      proceedToCheckout(rec);
    },
    [proceedToCheckout]
  );

  const cancelCheckout = useCallback(() => {
    dispatch({ type: 'SET_SHOW_PAYMENT_MODAL', payload: false });
    dispatch({ type: 'SET_ACTIVE_PAYMENT', payload: null });
  }, []);

  // Cart Actions
  const addToCart = useCallback(
    async (product: Product, quantity = 1, openDrawer = true): Promise<boolean> => {
      try {
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product,
            productId: product.id,
            quantity,
            couponCode: state.appliedCouponCode || undefined,
          }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          dispatch({ type: 'SET_CART', payload: data.data });
          if (openDrawer) {
            dispatch({ type: 'SET_CART_DRAWER_OPEN', payload: true });
          }
          showToast(`Added "${product.name}" to cart`, 'success');
          return true;
        }
        showToast(data.error || 'Could not add item to cart', 'error');
        return false;
      } catch {
        showToast('Failed to update cart', 'error');
        return false;
      }
    },
    [state.appliedCouponCode, showToast]
  );

  const updateCartQty = useCallback(
    async (productId: string, quantity: number) => {
      try {
        const res = await fetch('/api/cart', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId,
            quantity,
            couponCode: state.appliedCouponCode || undefined,
          }),
        });
        const data = await res.json();
        if (data.success && data.data) {
          dispatch({ type: 'SET_CART', payload: data.data });
        }
      } catch (err) {
        console.error('Failed to update cart qty:', err);
      }
    },
    [state.appliedCouponCode]
  );

  const removeFromCart = useCallback(
    async (productId: string) => {
      try {
        const couponParam = state.appliedCouponCode
          ? `&coupon=${encodeURIComponent(state.appliedCouponCode)}`
          : '';
        const res = await fetch(
          `/api/cart?productId=${encodeURIComponent(productId)}${couponParam}`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (data.success && data.data) {
          dispatch({ type: 'SET_CART', payload: data.data });
          showToast('Removed item from cart', 'info');
        }
      } catch (err) {
        console.error('Failed to remove from cart:', err);
      }
    },
    [state.appliedCouponCode, showToast]
  );

  const clearCart = useCallback(async () => {
    try {
      const res = await fetch('/api/cart?clear=true', { method: 'DELETE' });
      const data = await res.json();
      if (data.success && data.data) {
        dispatch({ type: 'SET_CART', payload: data.data });
        dispatch({ type: 'SET_COUPON_CODE', payload: '' });
        showToast('Cart cleared', 'info');
      }
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  }, [showToast]);

  const applyCoupon = useCallback(
    async (code: string): Promise<{ ok: boolean; error?: string }> => {
      const normalized = code.trim().toUpperCase();
      if (!normalized) {
        dispatch({ type: 'SET_COUPON_CODE', payload: '' });
        await loadCart('');
        return { ok: true };
      }
      try {
        const res = await fetch(`/api/cart?coupon=${encodeURIComponent(normalized)}`);
        const data = await res.json();
        if (data.couponError) {
          return { ok: false, error: data.couponError };
        }
        if (data.success && data.data) {
          dispatch({ type: 'SET_COUPON_CODE', payload: normalized });
          dispatch({ type: 'SET_CART', payload: data.data });
          showToast(`Coupon ${normalized} applied!`, 'success');
          return { ok: true };
        }
        return { ok: false, error: 'Failed to validate coupon' };
      } catch {
        return { ok: false, error: 'Failed to validate coupon' };
      }
    },
    [loadCart, showToast]
  );

  const openCartDrawer = useCallback(() => {
    dispatch({ type: 'SET_CART_DRAWER_OPEN', payload: true });
  }, []);

  const closeCartDrawer = useCallback(() => {
    dispatch({ type: 'SET_CART_DRAWER_OPEN', payload: false });
  }, []);

  // Wishlist Actions
  const isInWishlist = useCallback(
    (productId: string) => state.wishlist.some((w) => w.productId === productId),
    [state.wishlist]
  );

  const toggleWishlist = useCallback(
    async (product: Product): Promise<boolean> => {
      const exists = state.wishlist.some((w) => w.productId === product.id);
      try {
        if (exists) {
          const res = await fetch(
            `/api/wishlist?productId=${encodeURIComponent(product.id)}`,
            { method: 'DELETE' }
          );
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            dispatch({ type: 'SET_WISHLIST', payload: data.data });
            showToast('Removed from wishlist', 'info');
            return false;
          }
        } else {
          const res = await fetch('/api/wishlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ product, productId: product.id }),
          });
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            dispatch({ type: 'SET_WISHLIST', payload: data.data });
            showToast(`Saved "${product.name}" to wishlist`, 'success');
            return true;
          }
        }
      } catch (err) {
        console.error('Wishlist toggle error:', err);
      }
      return exists;
    },
    [state.wishlist, showToast]
  );

  const moveWishlistToCart = useCallback(
    async (productId: string) => {
      const item = state.wishlist.find((w) => w.productId === productId);
      if (!item) return;
      const added = await addToCart(item.product, 1, false);
      if (added) {
        const res = await fetch(
          `/api/wishlist?productId=${encodeURIComponent(productId)}`,
          { method: 'DELETE' }
        );
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          dispatch({ type: 'SET_WISHLIST', payload: data.data });
        }
      }
    },
    [state.wishlist, addToCart]
  );

  // Compare Actions
  const isInCompare = useCallback(
    (productId: string) => state.compareProducts.some((p) => p.id === productId),
    [state.compareProducts]
  );

  const toggleCompare = useCallback(
    (product: Product) => {
      const exists = state.compareProducts.some((p) => p.id === product.id);
      let next: Product[];
      if (exists) {
        next = state.compareProducts.filter((p) => p.id !== product.id);
        showToast('Removed from comparison', 'info');
      } else {
        if (state.compareProducts.length >= 4) {
          showToast('Compare up to 4 products at a time', 'error');
          return;
        }
        next = [...state.compareProducts, product];
        showToast(`Added "${product.name}" to compare (${next.length}/4)`, 'success');
      }
      dispatch({ type: 'SET_COMPARE_PRODUCTS', payload: next });
      try {
        localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
    },
    [state.compareProducts, showToast]
  );

  const clearCompare = useCallback(() => {
    dispatch({ type: 'SET_COMPARE_PRODUCTS', payload: [] });
    try {
      localStorage.removeItem(COMPARE_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }, []);

  // Quick View & Recently Viewed
  const recordRecentlyViewed = useCallback(async (product: Product) => {
    try {
      await fetch('/api/recently-viewed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product, productId: product.id }),
      });
    } catch {
      // Ignore non-critical tracking failures
    }
  }, []);

  const openQuickView = useCallback(
    (product: Product) => {
      dispatch({ type: 'SET_QUICK_VIEW_PRODUCT', payload: product });
      recordRecentlyViewed(product);
    },
    [recordRecentlyViewed]
  );

  const closeQuickView = useCallback(() => {
    dispatch({ type: 'SET_QUICK_VIEW_PRODUCT', payload: null });
  }, []);

  // Copilot
  const openCopilot = useCallback((initialPrompt?: string) => {
    dispatch({
      type: 'SET_COPILOT_OPEN',
      payload: { open: true, prompt: initialPrompt ?? null },
    });
  }, []);

  const closeCopilot = useCallback(() => {
    dispatch({ type: 'SET_COPILOT_OPEN', payload: { open: false, prompt: null } });
  }, []);

  const setDeliveryLocation = useCallback((loc: DeliveryLocation) => {
    dispatch({ type: 'SET_DELIVERY_LOCATION', payload: loc });
    try {
      localStorage.setItem(DELIVERY_STORAGE_KEY, JSON.stringify(loc));
    } catch {
      // Ignore
    }
  }, []);

  const unreadNotificationCount = state.notifications.filter((n) => !n.isRead).length;

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,
        refreshAuth,
        login,
        register,
        loginAsDemo,
        logout,
        openAuthModal,
        closeAuthModal,
        sendMessage,
        loadBudget,
        saveBudget,
        loadOrders,
        loadSpendingSummary,
        selectProduct,
        clearSelectedProduct,
        proceedToCheckout,
        selectProductForCheckout,
        cancelCheckout,
        loadUserPreferences,
        saveUserPreferences,
        loadExchangeRates,
        openCountrySelector,
        closeCountrySelector,
        getConvertedPrice,
        formatPrice,
        loadCart,
        addToCart,
        updateCartQty,
        removeFromCart,
        clearCart,
        applyCoupon,
        openCartDrawer,
        closeCartDrawer,
        loadWishlist,
        toggleWishlist,
        isInWishlist,
        moveWishlistToCart,
        toggleCompare,
        isInCompare,
        clearCompare,
        openQuickView,
        closeQuickView,
        recordRecentlyViewed,
        openCopilot,
        closeCopilot,
        unreadNotificationCount,
        loadNotifications,
        markNotificationsRead,
        setDeliveryLocation,
        showToast,
        clearToast,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
