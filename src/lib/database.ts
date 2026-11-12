// src/lib/database.ts
// Persistent storage engine for AgentPay E-Commerce Platform
// Uses a robust JSON file store mirroring a relational schema with automatic migrations.
// Requires no native compilation so it works reliably across local and serverless environments.

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

function getDbPath(): string {
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpPath = path.join(os.tmpdir(), 'agentpay.db.json');
    if (!fs.existsSync(tmpPath)) {
      const seedPath = path.join(process.cwd(), 'agentpay.db.json');
      if (fs.existsSync(seedPath)) {
        try {
          fs.copyFileSync(seedPath, tmpPath);
        } catch {
          // ignore copy error
        }
      }
    }
    return tmpPath;
  }
  return path.join(process.cwd(), 'agentpay.db.json');
}

// ============================================================
// Database Table Interfaces
// ============================================================

export interface DbUser {
  id: string;
  name: string;
  email: string;
  password_hash?: string;
  phone?: string;
  created_at: string;
}

export interface DbSession {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: string;
  created_at: string;
}

export interface DbUserBudget {
  id: string;
  user_id: string;
  max_purchase_amount: number;
  daily_spending_limit: number;
  currency?: string;
  created_at: string;
  updated_at: string;
}

export interface DbProduct {
  id: string;
  name: string;
  brand: string;
  price: number;
  original_price?: number | null;
  currency: string;
  merchant_country?: string;
  image_url: string;
  images?: string; // JSON string[]
  description: string;
  seller: string;
  product_url: string;
  category: string;
  rating: number | null;
  review_count: number | null;
  availability: string;
  features: string; // JSON string[]
  specs?: string; // JSON Record<string, string>
  checkout_type?: 'agentpay' | 'external';
  created_at?: string;
  is_demo: number;
}

export interface DbOrderItem {
  productId: string;
  productName: string;
  productImage: string;
  brand?: string;
  seller?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface DbOrder {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  product_image: string;
  items?: string; // JSON DbOrderItem[]
  subtotal?: number;
  discount_amount?: number;
  coupon_code?: string;
  shipping_address?: string; // JSON SavedAddress
  order_type?: 'agentpay' | 'external';
  merchant_name?: string;
  merchant_url?: string;
  paypal_order_id: string;
  paypal_capture_id?: string;
  amount: number;
  currency: string;
  payment_status: 'pending' | 'approved' | 'captured' | 'cancelled' | 'failed';
  created_at: string;
  is_sandbox: number;
  display_amount?: number;
  display_currency?: string;
  exchange_rate?: number;
  exchange_rate_timestamp?: string;
}

export interface DbShoppingPreference {
  id: string;
  user_id: string;
  preferred_brands: string; // JSON array
  preferred_categories: string; // JSON array
  max_budget: number | null;
}

export interface DbUserPreference {
  id: string;
  user_id: string;
  country_code: string;
  currency_code: string;
  updated_at: string;
}

export interface DbAddress {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postal_code: string;
  country_code: string;
  is_default: number;
  created_at: string;
}

export interface DbCartItem {
  id: string;
  owner_id: string; // user_id or guest:<token>
  product_id: string;
  quantity: number;
  added_at: string;
  updated_at: string;
}

export interface DbWishlistItem {
  id: string;
  owner_id: string;
  product_id: string;
  saved_price: number;
  currency: string;
  price_alert_enabled: number;
  last_checked_price?: number;
  last_checked_at?: string;
  added_at: string;
}

export interface DbRecentlyViewed {
  id: string;
  owner_id: string;
  product_id: string;
  viewed_at: string;
}

export interface DbCoupon {
  code: string;
  description: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount?: number | null;
  active: number;
  expires_at?: string;
  eligible_scope: 'agentpay_checkout';
}

export interface DbNotification {
  id: string;
  user_id: string;
  type: 'order_update' | 'payment_status' | 'price_drop' | 'budget_alert' | 'promotion' | 'cart_reminder';
  title: string;
  message: string;
  link?: string;
  is_read: number;
  created_at: string;
}

export interface DbNotificationPreference {
  user_id: string;
  order_updates: number;
  payment_alerts: number;
  price_drops: number;
  promotions: number;
  updated_at: string;
}

export interface DbExternalClick {
  id: string;
  owner_id: string;
  product_id: string;
  merchant_name: string;
  merchant_url: string;
  clicked_at: string;
}

interface DatabaseSchema {
  users: DbUser[];
  sessions: DbSession[];
  user_budgets: DbUserBudget[];
  products: DbProduct[];
  orders: DbOrder[];
  shopping_preferences: DbShoppingPreference[];
  user_preferences: DbUserPreference[];
  addresses: DbAddress[];
  cart_items: DbCartItem[];
  wishlist_items: DbWishlistItem[];
  recently_viewed: DbRecentlyViewed[];
  coupons: DbCoupon[];
  notifications: DbNotification[];
  notification_preferences: DbNotificationPreference[];
  external_clicks: DbExternalClick[];
}

// ============================================================
// Seeded Demo Catalog & Coupons
// ============================================================

export function hashPassword(password: string, existingSalt?: string): string {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

const DEFAULT_COUPONS: DbCoupon[] = [
  {
    code: 'AGENT10',
    description: '10% off AgentPay Checkout orders of $50 or more (up to $30 discount)',
    discount_type: 'percentage',
    discount_value: 10,
    min_order_amount: 50,
    max_discount: 30,
    active: 1,
    expires_at: '2027-12-31T23:59:59.000Z',
    eligible_scope: 'agentpay_checkout',
  },
  {
    code: 'SAVE15',
    description: '$15 off AgentPay Checkout orders of $100 or more',
    discount_type: 'fixed',
    discount_value: 15,
    min_order_amount: 100,
    max_discount: 15,
    active: 1,
    expires_at: '2027-12-31T23:59:59.000Z',
    eligible_scope: 'agentpay_checkout',
  },
];

const DEFAULT_DEMO_PRODUCTS: DbProduct[] = [
  // Hiking & Outdoor
  {
    id: 'prod-001',
    name: 'TrailBlazer Compact Hiking Backpack (25L)',
    brand: 'OutdoorPro',
    price: 45.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&w=600&q=80',
    description: 'A lightweight 25L hiking backpack with hydration bladder compartment, multiple pockets, and rain cover. Perfect for day hikes.',
    seller: 'OutdoorPro Official',
    product_url: '#',
    category: 'outdoor',
    rating: 4.5,
    review_count: 342,
    availability: 'In Stock',
    features: JSON.stringify(['25L capacity', 'Hydration bladder compartment', 'Built-in rain cover', 'Padded shoulder straps', 'Chest and waist straps']),
    specs: JSON.stringify({ Capacity: '25 Liters', Material: 'Ripstop Nylon', Weight: '1.4 lbs', Weatherproofing: 'Included Rain Cover' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-01T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-002',
    name: 'SummitGrip Trekking Poles (Pair)',
    brand: 'MountainGear',
    price: 38.50,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?auto=format&fit=crop&w=600&q=80',
    description: 'Adjustable aluminum trekking poles with cork handles and tungsten carbide tips. Collapses for easy storage.',
    seller: 'MountainGear Store',
    product_url: '#',
    category: 'outdoor',
    rating: 4.3,
    review_count: 189,
    availability: 'In Stock',
    features: JSON.stringify(['Adjustable length 24-54 inches', 'Cork grip handles', 'Tungsten carbide tips', 'Anti-shock mechanism', 'Includes carrying bag']),
    specs: JSON.stringify({ Material: '7075 Aluminum', Length: '24-54 in', Grip: 'Natural Cork', Tips: 'Tungsten Carbide' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-02T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-003',
    name: 'NatureView Compact Binoculars 10x42',
    brand: 'OptiVision',
    price: 49.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=600&q=80',
    description: 'Waterproof compact binoculars ideal for hiking and birdwatching. Clear optics with 10x magnification.',
    seller: 'OptiVision Direct',
    product_url: '#',
    category: 'outdoor',
    rating: 4.4,
    review_count: 267,
    availability: 'In Stock',
    features: JSON.stringify(['10x42 magnification', 'Waterproof and fog-proof', 'BAK4 prism', 'Includes neck strap and case', 'Weighs only 1.2 lbs']),
    specs: JSON.stringify({ Magnification: '10x', ObjectiveLens: '42mm', Prism: 'BAK4', Weight: '1.2 lbs' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-03T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-004',
    name: 'TrailLite LED Headlamp (800 Lumens)',
    brand: 'BrightPath',
    price: 24.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1508873696983-2df5293cb325?auto=format&fit=crop&w=600&q=80',
    description: 'Rechargeable LED headlamp with 800 lumens, red light mode, and adjustable strap. IPX6 waterproof.',
    seller: 'BrightPath Gear',
    product_url: '#',
    category: 'outdoor',
    rating: 4.6,
    review_count: 521,
    availability: 'In Stock',
    features: JSON.stringify(['800 lumens max', 'USB-C rechargeable', 'Red light mode', 'IPX6 waterproof', '12-hour battery life']),
    specs: JSON.stringify({ Output: '800 Lumens', Charging: 'USB-C', Rating: 'IPX6', Runtime: 'Up to 12 hours' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-04T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-005',
    name: 'HydroStream Water Filter Bottle (24oz)',
    brand: 'PureTrail',
    price: 32.00,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=600&q=80',
    description: 'Portable water filter bottle that removes 99.9% of bacteria and parasites. BPA-free, 24oz capacity.',
    seller: 'PureTrail Outdoor',
    product_url: '#',
    category: 'outdoor',
    rating: 4.7,
    review_count: 415,
    availability: 'In Stock',
    features: JSON.stringify(['Removes 99.9% bacteria', '24oz capacity', 'BPA-free', 'Filter lasts 1500 liters', 'Squeeze or sip design']),
    specs: JSON.stringify({ Capacity: '24 oz', FilterLife: '1500 L', Material: 'BPA-Free Tritan' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-05T10:00:00.000Z',
    is_demo: 1,
  },
  // Electronics - Headphones & Audio
  {
    id: 'prod-006',
    name: 'SoundWave Pro Wireless Headphones',
    brand: 'AudioTech',
    price: 79.99,
    original_price: 99.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    description: 'Over-ear wireless headphones with active noise cancelling, 40-hour battery, and premium sound quality.',
    seller: 'AudioTech Official',
    product_url: '#',
    category: 'electronics',
    rating: 4.5,
    review_count: 892,
    availability: 'In Stock',
    features: JSON.stringify(['Active noise cancelling', '40-hour battery', 'Bluetooth 5.3', 'Hi-Res Audio certified', 'Foldable design']),
    specs: JSON.stringify({ Connectivity: 'Bluetooth 5.3', Battery: '40 hours', NoiseCancelling: 'Active ANC', FormFactor: 'Over-Ear' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-06T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-007',
    name: 'BassBoost Wireless Earbuds',
    brand: 'SoundCore',
    price: 49.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80',
    description: 'True wireless earbuds with deep bass, 8-hour playtime, and IPX5 water resistance.',
    seller: 'SoundCore Store',
    product_url: '#',
    category: 'electronics',
    rating: 4.2,
    review_count: 1203,
    availability: 'In Stock',
    features: JSON.stringify(['Deep bass driver', '8hr playtime + 24hr case', 'IPX5 water resistant', 'Touch controls', 'Built-in microphone']),
    specs: JSON.stringify({ Playtime: '8h + 24h case', Resistance: 'IPX5', Controls: 'Touch' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-07T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-008',
    name: 'ClearSound Studio Monitor Headphones',
    brand: 'ProAudio',
    price: 94.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80',
    description: 'Professional studio monitor headphones with flat frequency response for accurate sound reproduction.',
    seller: 'ProAudio Direct',
    product_url: '#',
    category: 'electronics',
    rating: 4.7,
    review_count: 345,
    availability: 'In Stock',
    features: JSON.stringify(['Flat frequency response', '50mm drivers', 'Detachable cable', 'Comfortable for long sessions', 'Includes 3.5mm and 6.35mm adapters']),
    specs: JSON.stringify({ Drivers: '50mm Neodymium', Cable: 'Detachable 3.5mm / 6.35mm', UseCase: 'Studio Monitoring' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-08T10:00:00.000Z',
    is_demo: 1,
  },
  // Electronics - Smartwatches
  {
    id: 'prod-009',
    name: 'FitTrack Active Smartwatch',
    brand: 'TechWear',
    price: 69.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=600&q=80',
    description: 'Affordable smartwatch with heart rate monitoring, GPS, sleep tracking, and 7-day battery life.',
    seller: 'TechWear Official',
    product_url: '#',
    category: 'electronics',
    rating: 4.1,
    review_count: 678,
    availability: 'In Stock',
    features: JSON.stringify(['Heart rate monitor', 'Built-in GPS', 'Sleep tracking', '7-day battery', '5ATM water resistant']),
    specs: JSON.stringify({ Battery: '7 Days', GPS: 'Built-in', WaterResistance: '5ATM' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-09T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-010',
    name: 'PulsePro Sports Watch',
    brand: 'FitGear',
    price: 89.99,
    original_price: 119.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1579586337278-3befd40fd17a?auto=format&fit=crop&w=600&q=80',
    description: 'Advanced sports watch with multi-sport tracking, blood oxygen monitoring, and AMOLED display.',
    seller: 'FitGear Store',
    product_url: '#',
    category: 'electronics',
    rating: 4.4,
    review_count: 432,
    availability: 'In Stock',
    features: JSON.stringify(['AMOLED display', 'Blood oxygen monitor', '100+ sport modes', '14-day battery', 'Stainless steel frame']),
    specs: JSON.stringify({ Display: 'AMOLED', Battery: '14 Days', Frame: 'Stainless Steel' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-10T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-011',
    name: 'MiniWatch Lite',
    brand: 'CompactTech',
    price: 39.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=600&q=80',
    description: 'Lightweight budget smartwatch with step counting, notifications, and 10-day battery life.',
    seller: 'CompactTech Store',
    product_url: '#',
    category: 'electronics',
    rating: 3.9,
    review_count: 890,
    availability: 'In Stock',
    features: JSON.stringify(['Step and calorie counter', 'Phone notifications', '10-day battery', 'IP68 waterproof', 'Lightweight 28g']),
    specs: JSON.stringify({ Weight: '28g', Battery: '10 Days', Waterproof: 'IP68' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-11T10:00:00.000Z',
    is_demo: 1,
  },
  // Electronics - Laptops
  {
    id: 'prod-012',
    name: 'CodeBook Pro 14 Laptop',
    brand: 'DevTech',
    price: 899.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=600&q=80',
    description: 'Developer-focused laptop with 14" display, 16GB RAM, 512GB SSD, and excellent keyboard for programming.',
    seller: 'DevTech Official',
    product_url: '#',
    category: 'electronics',
    rating: 4.6,
    review_count: 234,
    availability: 'In Stock',
    features: JSON.stringify(['14-inch IPS display', '16GB DDR5 RAM', '512GB NVMe SSD', 'Backlit keyboard', '12-hour battery']),
    specs: JSON.stringify({ Display: '14" IPS', Memory: '16GB DDR5', Storage: '512GB NVMe SSD', Battery: '12 Hours' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-12T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-013',
    name: 'SwiftBook Air 13 Laptop',
    brand: 'UltraPC',
    price: 649.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=600&q=80',
    description: 'Ultralight 13" laptop weighing just 2.2 lbs with all-day battery life. Great for students and professionals.',
    seller: 'UltraPC Store',
    product_url: '#',
    category: 'electronics',
    rating: 4.3,
    review_count: 567,
    availability: 'In Stock',
    features: JSON.stringify(['13.3-inch display', '8GB RAM', '256GB SSD', '2.2 lbs weight', '15-hour battery']),
    specs: JSON.stringify({ Display: '13.3"', Memory: '8GB', Storage: '256GB SSD', Weight: '2.2 lbs' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-13T10:00:00.000Z',
    is_demo: 1,
  },
  // Shoes
  {
    id: 'prod-014',
    name: 'SpeedStride Running Shoes',
    brand: 'RunFast',
    price: 64.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=600&q=80',
    description: 'Lightweight running shoes with responsive cushioning and breathable mesh upper.',
    seller: 'RunFast Official',
    product_url: '#',
    category: 'shoes',
    rating: 4.4,
    review_count: 1456,
    availability: 'In Stock',
    features: JSON.stringify(['Responsive foam cushioning', 'Breathable mesh upper', 'Rubber outsole', 'Weighs 8.5 oz', 'Available in 6 colors']),
    specs: JSON.stringify({ Weight: '8.5 oz', Upper: 'Breathable Mesh', Outsole: 'High-traction Rubber' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-14T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-015',
    name: 'TrailRunner Pro All-Terrain Shoes',
    brand: 'PathFinder',
    price: 79.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&w=600&q=80',
    description: 'Durable trail running shoes with aggressive tread pattern and rock plate protection.',
    seller: 'PathFinder Gear',
    product_url: '#',
    category: 'shoes',
    rating: 4.5,
    review_count: 623,
    availability: 'In Stock',
    features: JSON.stringify(['Vibram outsole', 'Rock plate protection', 'Water-resistant upper', 'Reinforced toe cap', 'Ankle support collar']),
    specs: JSON.stringify({ Outsole: 'Vibram Tread', Protection: 'Rock Plate', Terrain: 'All-Terrain Trail' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-15T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-016',
    name: 'CloudWalk Daily Trainers',
    brand: 'ComfortStep',
    price: 44.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?auto=format&fit=crop&w=600&q=80',
    description: 'Comfortable everyday training shoes with cloud-like cushioning. Perfect for gym and casual wear.',
    seller: 'ComfortStep Store',
    product_url: '#',
    category: 'shoes',
    rating: 4.2,
    review_count: 2103,
    availability: 'In Stock',
    features: JSON.stringify(['Cloud foam midsole', 'Slip-on design', 'Machine washable', 'Arch support', 'Memory foam insole']),
    specs: JSON.stringify({ Midsole: 'Cloud Foam', Care: 'Machine Washable', Insole: 'Memory Foam' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-16T10:00:00.000Z',
    is_demo: 1,
  },
  // Speakers / Audio
  {
    id: 'prod-017',
    name: 'PortaBeat Mini Bluetooth Speaker',
    brand: 'SoundBox',
    price: 34.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?auto=format&fit=crop&w=600&q=80',
    description: 'Portable waterproof Bluetooth speaker with 360-degree sound and 12-hour battery.',
    seller: 'SoundBox Audio',
    product_url: '#',
    category: 'electronics',
    rating: 4.3,
    review_count: 876,
    availability: 'In Stock',
    features: JSON.stringify(['360-degree sound', 'IPX7 waterproof', '12-hour battery', 'USB-C charging', 'Built-in microphone']),
    specs: JSON.stringify({ Sound: '360-degree', Waterproof: 'IPX7', Battery: '12 Hours' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-17T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-018',
    name: 'VinylSpin Portable Record Player',
    brand: 'RetroSound',
    price: 89.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1539185441755-769473a23570?auto=format&fit=crop&w=600&q=80',
    description: 'Compact portable record player with built-in speakers and Bluetooth output.',
    seller: 'RetroSound Store',
    product_url: '#',
    category: 'electronics',
    rating: 4.1,
    review_count: 234,
    availability: 'In Stock',
    features: JSON.stringify(['3-speed turntable', 'Built-in stereo speakers', 'Bluetooth output', 'RCA line out', 'Vintage suitcase design']),
    specs: JSON.stringify({ Speeds: '33 / 45 / 78 RPM', Output: 'Bluetooth + RCA', Speakers: 'Built-in Stereo' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-18T10:00:00.000Z',
    is_demo: 1,
  },
  // High-price items (budget protection demonstration)
  {
    id: 'prod-019',
    name: 'UltraHike Professional Tent (4-Person)',
    brand: 'CampMaster',
    price: 189.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=600&q=80',
    description: 'Professional 4-person tent with aluminum poles, full-coverage rainfly, and vestibule.',
    seller: 'CampMaster Pro',
    product_url: '#',
    category: 'outdoor',
    rating: 4.8,
    review_count: 156,
    availability: 'In Stock',
    features: JSON.stringify(['4-person capacity', 'Aluminum poles', 'Full rainfly', '2 vestibules', 'Sets up in 5 minutes']),
    specs: JSON.stringify({ Capacity: '4 Persons', Poles: 'Aluminum', Vestibules: '2' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-19T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-020',
    name: 'ProTrail GPS Navigation Watch',
    brand: 'ExploreMax',
    price: 249.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1508685096489-7aacd43bd3b1?auto=format&fit=crop&w=600&q=80',
    description: 'Advanced GPS navigation watch with topographic maps, compass, and barometric altimeter.',
    seller: 'ExploreMax Gear',
    product_url: '#',
    category: 'outdoor',
    rating: 4.6,
    review_count: 189,
    availability: 'In Stock',
    features: JSON.stringify(['Topographic maps', 'ABC sensors', 'Multi-band GPS', 'Solar charging', 'Sapphire crystal display']),
    specs: JSON.stringify({ GPS: 'Multi-Band', Glass: 'Sapphire Crystal', Charging: 'Solar Assisted' }),
    checkout_type: 'agentpay',
    created_at: '2026-10-20T10:00:00.000Z',
    is_demo: 1,
  },

  // Additional Multi-Category Storefront Products (Mobiles, Fashion, Home & Kitchen, Beauty, Grocery, Sports, Accessories, Books)
  {
    id: 'prod-021',
    name: 'NovaPhone X5 5G Smartphone (128GB)',
    brand: 'NovaMobile',
    price: 229.00,
    original_price: 259.00,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=600&q=80',
    description: '6.6-inch 120Hz AMOLED 5G smartphone with 50MP dual camera, 5000mAh battery, and fast 33W charging.',
    seller: 'NovaMobile Official',
    product_url: '#',
    category: 'mobiles',
    rating: 4.5,
    review_count: 612,
    availability: 'In Stock',
    features: JSON.stringify(['6.6" 120Hz AMOLED display', '5G Dual-SIM', '128GB UFS 2.2 storage', '50MP main camera', '5000mAh battery']),
    specs: JSON.stringify({ Display: '6.6" AMOLED 120Hz', Storage: '128GB', Battery: '5000mAh', Network: '5G' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-01T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-022',
    name: 'AeroLite Everyday Cotton Oxford Shirt',
    brand: 'UrbanLoom',
    price: 36.00,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80',
    description: 'Breathable 100% combed cotton tailored oxford shirt suited for work and casual wear.',
    seller: 'UrbanLoom Apparel',
    product_url: '#',
    category: 'fashion',
    rating: 4.4,
    review_count: 284,
    availability: 'In Stock',
    features: JSON.stringify(['100% combed cotton', 'Pre-shrunk fabric', 'Button-down collar', 'Machine washable']),
    specs: JSON.stringify({ Material: '100% Cotton', Fit: 'Tailored Regular', Care: 'Machine Wash' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-02T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-023',
    name: 'BrewCraft Precision Pour-Over Coffee Kettle (1L)',
    brand: 'HearthHome',
    price: 42.50,
    original_price: 54.00,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=600&q=80',
    description: 'Matte stainless steel gooseneck electric kettle with accurate temperature hold for pour-over coffee and tea.',
    seller: 'HearthHome Kitchen',
    product_url: '#',
    category: 'home-kitchen',
    rating: 4.7,
    review_count: 498,
    availability: 'In Stock',
    features: JSON.stringify(['1L capacity', '304 stainless steel', 'Gooseneck precision spout', 'Auto shut-off']),
    specs: JSON.stringify({ Capacity: '1.0 Liter', Material: '304 Stainless Steel', Power: '1200W' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-03T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-024',
    name: 'PureGlow Hyaluronic Hydration Serum (50ml)',
    brand: 'BotanicaCare',
    price: 22.00,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=600&q=80',
    description: 'Fragrance-free daily facial hydration serum formulated with multi-molecular hyaluronic acid and vitamin B5.',
    seller: 'BotanicaCare Direct',
    product_url: '#',
    category: 'beauty',
    rating: 4.6,
    review_count: 731,
    availability: 'In Stock',
    features: JSON.stringify(['Fragrance-free formula', 'Vitamin B5 enriched', 'Dermatologist tested', '50ml glass dropper bottle']),
    specs: JSON.stringify({ Volume: '50ml', SkinType: 'All Skin Types', Fragrance: 'Free' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-04T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-025',
    name: 'Highland Reserve Whole Bean Arabica Coffee (1kg)',
    brand: 'RoastHouse',
    price: 19.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?auto=format&fit=crop&w=600&q=80',
    description: 'Single-origin medium roast 100% Arabica whole coffee beans with balanced cocoa and toasted hazelnut notes.',
    seller: 'RoastHouse Pantry',
    product_url: '#',
    category: 'grocery',
    rating: 4.8,
    review_count: 915,
    availability: 'In Stock',
    features: JSON.stringify(['100% Arabica beans', 'Medium roast', '1kg resealable valve bag', 'Fresh roasted in small batches']),
    specs: JSON.stringify({ Weight: '1 kg', Roast: 'Medium', Origin: 'Single-Origin Arabica' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-05T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-026',
    name: 'FlexCore Non-Slip Alignment Yoga Mat (6mm)',
    brand: 'KineticFit',
    price: 29.50,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?auto=format&fit=crop&w=600&q=80',
    description: 'High-density 6mm TPE exercise and yoga mat with laser-etched alignment lines and carry strap.',
    seller: 'KineticFit Athletics',
    product_url: '#',
    category: 'sports',
    rating: 4.5,
    review_count: 388,
    availability: 'In Stock',
    features: JSON.stringify(['6mm cushioned TPE', 'Dual-sided non-slip grip', 'Alignment guide lines', 'Includes carry strap']),
    specs: JSON.stringify({ Thickness: '6mm', Dimensions: '72" x 24"', Material: 'Eco TPE' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-06T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-027',
    name: 'KeyMaster Tactile Wireless Mechanical Keyboard',
    brand: 'TypeForge',
    price: 74.99,
    original_price: 89.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
    description: 'Compact 75% hot-swappable wireless mechanical keyboard with tactile brown switches and PBT keycaps for coding.',
    seller: 'TypeForge Peripherals',
    product_url: '#',
    category: 'accessories',
    rating: 4.7,
    review_count: 540,
    availability: 'In Stock',
    features: JSON.stringify(['75% compact layout', 'Hot-swappable switches', 'Bluetooth + USB-C wired', 'PBT double-shot keycaps']),
    specs: JSON.stringify({ Layout: '75% (84 Keys)', Connectivity: 'Bluetooth 5.1 / USB-C', Keycaps: 'PBT' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-07T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-028',
    name: 'Designing Resilient Systems — Engineering Handbook',
    brand: 'TechPress',
    price: 28.00,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80',
    description: 'Comprehensive paperback engineering guide covering distributed systems, payment reliability, and API safety.',
    seller: 'TechPress Books',
    product_url: '#',
    category: 'books',
    rating: 4.8,
    review_count: 194,
    availability: 'In Stock',
    features: JSON.stringify(['420 pages paperback', 'Practical architecture diagrams', 'Case studies on payment systems']),
    specs: JSON.stringify({ Format: 'Paperback', Pages: '420', Language: 'English' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-08T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-029',
    name: 'VoltDock 65W GaN 3-Port Fast Charger',
    brand: 'ChargeWave',
    price: 29.99,
    currency: 'USD',
    image_url: 'https://images.unsplash.com/photo-1583863788434-e58a36330cf0?auto=format&fit=crop&w=600&q=80',
    description: 'Compact 65W GaN USB-C wall charger with two USB-C PD ports and one USB-A port for laptops and phones.',
    seller: 'ChargeWave Official',
    product_url: '#',
    category: 'accessories',
    rating: 4.6,
    review_count: 812,
    availability: 'In Stock',
    features: JSON.stringify(['65W GaN technology', '2x USB-C PD + 1x USB-A', 'Foldable prongs', 'Over-voltage protection']),
    specs: JSON.stringify({ MaxOutput: '65W', Ports: '2x USB-C, 1x USB-A', Technology: 'GaN' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-09T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-030',
    name: 'ChefBlade 8-Inch Forged Steel Kitchen Knife',
    brand: 'HearthHome',
    price: 46.00,
    currency: 'USD',
    merchant_country: 'US',
    image_url: 'https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=600&q=80',
    description: 'Full-tang high-carbon stainless steel chef knife balanced for everyday slicing, dicing, and prep.',
    seller: 'HearthHome Kitchen',
    product_url: '#',
    category: 'home-kitchen',
    rating: 4.7,
    review_count: 310,
    availability: 'In Stock',
    features: JSON.stringify(['8-inch blade', 'High-carbon German steel', 'Full-tang ergonomic handle', 'Includes blade guard']),
    specs: JSON.stringify({ BladeLength: '8 inches', Steel: 'High-Carbon Stainless', Tang: 'Full Tang' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-10T10:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-in-001',
    name: 'boAt BassHeads 100 Wired In-Ear Headphones with Mic',
    brand: 'boAt',
    price: 399,
    original_price: 999,
    currency: 'INR',
    merchant_country: 'IN',
    image_url: 'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=600&q=80',
    description: 'India-market hawk-inspired in-ear wired headphones with 10mm dynamic drivers, integrated HD mic, and 1.2m tangle-free cable.',
    seller: 'Imagine Marketing India',
    product_url: '#',
    category: 'electronics',
    rating: 4.3,
    review_count: 2450,
    availability: 'In Stock (India)',
    features: JSON.stringify(['10mm dynamic drivers', 'In-line HD microphone', '3.5mm gold-plated jack', '1-year India warranty']),
    specs: JSON.stringify({ Driver: '10mm Dynamic', Connectivity: '3.5mm Wired', Market: 'India (INR)' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-10T12:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-in-002',
    name: 'Portronics Conch Theta Type-C Wired Earphones',
    brand: 'Portronics',
    price: 449,
    original_price: 799,
    currency: 'INR',
    merchant_country: 'IN',
    image_url: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=600&q=80',
    description: 'Compact USB Type-C wired earphones with DAC chip, multi-function in-line controls, and ergonomic angled earbuds.',
    seller: 'Portronics Digital India',
    product_url: '#',
    category: 'electronics',
    rating: 4.2,
    review_count: 680,
    availability: 'In Stock (India)',
    features: JSON.stringify(['USB Type-C connector', 'Built-in DAC chip', 'Call & media button', 'Passive noise isolation']),
    specs: JSON.stringify({ Connector: 'USB-C', CableLength: '1.2m', Market: 'India (INR)' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-10T13:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-in-003',
    name: 'Zebronics Zeb-Bang Over-Ear Wireless Headphones',
    brand: 'Zebronics',
    price: 499,
    original_price: 1299,
    currency: 'INR',
    merchant_country: 'IN',
    image_url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=600&q=80',
    description: 'Foldable Bluetooth over-ear headphones with soft cushioned earcups, MicroSD playback, and USB-C charging.',
    seller: 'Zebronics India Official',
    product_url: '#',
    category: 'electronics',
    rating: 4.1,
    review_count: 1120,
    availability: 'In Stock (India)',
    features: JSON.stringify(['Bluetooth 5.0 wireless', 'Foldable headband', 'Soft ear cushions', 'Built-in mic']),
    specs: JSON.stringify({ Battery: '16 hours', Connectivity: 'Bluetooth 5.0 + AUX', Market: 'India (INR)' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-10T14:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-in-004',
    name: 'boAt Rockerz 450 Bluetooth On-Ear Headphones',
    brand: 'boAt',
    price: 1499,
    original_price: 3990,
    currency: 'INR',
    merchant_country: 'IN',
    image_url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=600&q=80',
    description: 'Popular wireless on-ear headphones featuring 40mm dynamic drivers, up to 15 hours playback, and dual Bluetooth/AUX mode.',
    seller: 'Imagine Marketing India',
    product_url: '#',
    category: 'electronics',
    rating: 4.4,
    review_count: 4210,
    availability: 'In Stock (India)',
    features: JSON.stringify(['40mm dynamic drivers', '15H playback', 'Dual mode BT + AUX', 'Padded ear cushions']),
    specs: JSON.stringify({ Driver: '40mm', Battery: '15 hours', Market: 'India (INR)' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-10T15:00:00.000Z',
    is_demo: 1,
  },
  {
    id: 'prod-gb-001',
    name: 'Cambridge SoundPods Lite Wireless Headphones',
    brand: 'Cambridge Audio',
    price: 44.99,
    original_price: 59.99,
    currency: 'GBP',
    merchant_country: 'GB',
    image_url: 'https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=600&q=80',
    description: 'UK-tuned lightweight wireless over-ear headphones with balanced acoustic drivers and 24-hour USB-C battery.',
    seller: 'London HiFi Direct',
    product_url: '#',
    category: 'electronics',
    rating: 4.5,
    review_count: 280,
    availability: 'In Stock (UK)',
    features: JSON.stringify(['24h USB-C battery', 'Bluetooth 5.3', 'Lightweight folding design', 'Multipoint pairing']),
    specs: JSON.stringify({ Battery: '24 hours', Connectivity: 'Bluetooth 5.3', Market: 'United Kingdom (GBP)' }),
    checkout_type: 'agentpay',
    created_at: '2026-11-10T16:00:00.000Z',
    is_demo: 1,
  },
];

// ============================================================
// Read / Write Engine with Safe Schema Migration
// ============================================================

function createInitialDb(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: 'demo-user-1',
        name: 'Demo User',
        email: 'demo@agentpay.app',
        password_hash: hashPassword('DemoUser123!'),
        created_at: now,
      },
    ],
    sessions: [],
    user_budgets: [
      {
        id: 'budget-1',
        user_id: 'demo-user-1',
        max_purchase_amount: 150.00,
        daily_spending_limit: 300.00,
        currency: 'USD',
        created_at: now,
        updated_at: now,
      },
    ],
    products: DEFAULT_DEMO_PRODUCTS,
    orders: [],
    shopping_preferences: [],
    user_preferences: [],
    addresses: [
      {
        id: 'addr-demo-1',
        user_id: 'demo-user-1',
        label: 'Home',
        full_name: 'Demo User',
        phone: '+1 555-0142',
        line1: '742 Evergreen Terrace',
        city: 'San Jose',
        state: 'CA',
        postal_code: '95112',
        country_code: 'US',
        is_default: 1,
        created_at: now,
      },
    ],
    cart_items: [],
    wishlist_items: [],
    recently_viewed: [],
    coupons: DEFAULT_COUPONS,
    notifications: [
      {
        id: 'notif-welcome-1',
        user_id: 'demo-user-1',
        type: 'promotion',
        title: 'Welcome to AgentPay Store',
        message: 'Use verified store coupon AGENT10 for 10% off orders $50+ on AgentPay Checkout.',
        link: '/deals',
        is_read: 0,
        created_at: now,
      },
    ],
    notification_preferences: [
      {
        user_id: 'demo-user-1',
        order_updates: 1,
        payment_alerts: 1,
        price_drops: 1,
        promotions: 1,
        updated_at: now,
      },
    ],
    external_clicks: [],
  };
}

function readDb(): DatabaseSchema {
  const dbPath = getDbPath();
  try {
    if (!fs.existsSync(dbPath)) {
      const initialData = createInitialDb();
      fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf8');
      return initialData;
    }

    const raw = fs.readFileSync(dbPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<DatabaseSchema>;
    let dirty = false;

    const defaults = createInitialDb();
    const db: DatabaseSchema = {
      users: parsed.users || defaults.users,
      sessions: parsed.sessions || [],
      user_budgets: parsed.user_budgets || defaults.user_budgets,
      products: parsed.products && parsed.products.length > 0 ? parsed.products : DEFAULT_DEMO_PRODUCTS,
      orders: parsed.orders || [],
      shopping_preferences: parsed.shopping_preferences || [],
      user_preferences: parsed.user_preferences || [],
      addresses: parsed.addresses || [],
      cart_items: parsed.cart_items || [],
      wishlist_items: parsed.wishlist_items || [],
      recently_viewed: parsed.recently_viewed || [],
      coupons: parsed.coupons && parsed.coupons.length > 0 ? parsed.coupons : DEFAULT_COUPONS,
      notifications: parsed.notifications || [],
      notification_preferences: parsed.notification_preferences || [],
      external_clicks: parsed.external_clicks || [],
    };

    // Ensure demo-user-1 has password_hash for real login
    const demoUser = db.users.find((u) => u.id === 'demo-user-1');
    if (demoUser && !demoUser.password_hash) {
      demoUser.password_hash = hashPassword('DemoUser123!');
      dirty = true;
    }

    // Ensure all new multi-category demo products exist in db.products without overwriting user-cached items
    const existingIds = new Set(db.products.map((p) => p.id));
    for (const demoProd of DEFAULT_DEMO_PRODUCTS) {
      if (!existingIds.has(demoProd.id)) {
        db.products.push(demoProd);
        dirty = true;
      } else {
        // Backfill checkout_type, merchant_country & specs on existing demo products if missing
        const existing = db.products.find((p) => p.id === demoProd.id);
        if (existing && (!existing.checkout_type || !existing.merchant_country)) {
          existing.checkout_type = existing.checkout_type || demoProd.checkout_type;
          existing.specs = existing.specs || demoProd.specs;
          existing.original_price = existing.original_price ?? demoProd.original_price ?? null;
          existing.merchant_country =
            existing.merchant_country || demoProd.merchant_country || (existing.currency === 'INR' ? 'IN' : existing.currency === 'GBP' ? 'GB' : 'US');
          existing.created_at = existing.created_at || demoProd.created_at;
          dirty = true;
        }
      }
    }

    // Backfill checkout_type and currency on budgets / products
    for (const p of db.products) {
      if (!p.checkout_type) {
        p.checkout_type = p.is_demo === 1 ? 'agentpay' : 'external';
        dirty = true;
      }
    }
    for (const b of db.user_budgets) {
      if (!b.currency) {
        b.currency = 'USD';
        dirty = true;
      }
    }

    if (!parsed.sessions || !parsed.coupons || !parsed.cart_items || !parsed.wishlist_items || !parsed.addresses || !parsed.notifications) {
      dirty = true;
    }

    if (dirty) {
      writeDb(db);
    }

    return db;
  } catch (err) {
    console.error('Error reading agentpay database file:', err);
    return createInitialDb();
  }
}

function writeDb(data: DatabaseSchema): void {
  const dbPath = getDbPath();
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('Error writing agentpay database file:', err);
    try {
      const fallbackPath = path.join(os.tmpdir(), 'agentpay.db.json');
      fs.writeFileSync(fallbackPath, JSON.stringify(data, null, 2), 'utf8');
    } catch (fallbackErr) {
      console.error('Fatal: Could not write database to fallback path either:', fallbackErr);
    }
  }
}

// ============================================================
// Auth & User Queries
// ============================================================

export function getUserByEmail(email: string): DbUser | undefined {
  const db = readDb();
  const normalized = email.trim().toLowerCase();
  return db.users.find((u) => u.email.toLowerCase() === normalized);
}

export function getUserById(userId: string): DbUser | undefined {
  const db = readDb();
  return db.users.find((u) => u.id === userId);
}

export function createUserAccount(name: string, email: string, password: string, phone?: string): DbUser {
  const db = readDb();
  const normalizedEmail = email.trim().toLowerCase();
  if (db.users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error('An account with this email already exists.');
  }

  const now = new Date().toISOString();
  const newUser: DbUser = {
    id: `user-${crypto.randomUUID()}`,
    name: name.trim(),
    email: normalizedEmail,
    password_hash: hashPassword(password),
    phone: phone?.trim() || undefined,
    created_at: now,
  };
  db.users.push(newUser);

  // Initialize default budget & notification prefs for new user
  db.user_budgets.push({
    id: `budget-${crypto.randomUUID()}`,
    user_id: newUser.id,
    max_purchase_amount: 150,
    daily_spending_limit: 300,
    created_at: now,
    updated_at: now,
  });

  db.notification_preferences.push({
    user_id: newUser.id,
    order_updates: 1,
    payment_alerts: 1,
    price_drops: 1,
    promotions: 1,
    updated_at: now,
  });

  db.notifications.unshift({
    id: `notif-${crypto.randomUUID()}`,
    user_id: newUser.id,
    type: 'promotion',
    title: 'Welcome to AgentPay!',
    message: 'Your Smart Budget Guard ($150/item, $300/day) is active. Customize limits anytime in Account.',
    link: '/account',
    is_read: 0,
    created_at: now,
  });

  writeDb(db);
  return newUser;
}

export function updateUserProfile(userId: string, updates: { name?: string; phone?: string }): DbUser | null {
  const db = readDb();
  const user = db.users.find((u) => u.id === userId);
  if (!user) return null;
  if (updates.name !== undefined && updates.name.trim()) {
    user.name = updates.name.trim();
  }
  if (updates.phone !== undefined) {
    user.phone = updates.phone.trim() || undefined;
  }
  writeDb(db);
  return user;
}

export function createSession(userId: string, rawToken: string, ttlDays: number = 14): DbSession {
  const db = readDb();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

  // Prune expired sessions
  db.sessions = db.sessions.filter((s) => new Date(s.expires_at).getTime() > now.getTime());

  const session: DbSession = {
    id: `sess-${crypto.randomUUID()}`,
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
    created_at: now.toISOString(),
  };
  db.sessions.push(session);
  writeDb(db);
  return session;
}

export function getSessionByToken(rawToken: string): { session: DbSession; user: DbUser } | null {
  const db = readDb();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  const now = Date.now();
  const session = db.sessions.find(
    (s) => s.token_hash === tokenHash && new Date(s.expires_at).getTime() > now
  );
  if (!session) return null;
  const user = db.users.find((u) => u.id === session.user_id);
  if (!user) return null;
  return { session, user };
}

export function deleteSessionByToken(rawToken: string): void {
  const db = readDb();
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  db.sessions = db.sessions.filter((s) => s.token_hash !== tokenHash);
  writeDb(db);
}

// ============================================================
// Budget Queries (Preserved + Multi-user)
// ============================================================

export function getUserBudget(userId: string): DbUserBudget | undefined {
  const db = readDb();
  return db.user_budgets.find((b) => b.user_id === userId);
}

export function updateUserBudget(
  userId: string,
  maxPurchase: number,
  dailyLimit: number,
  currency: string = 'USD'
): void {
  const db = readDb();
  const existingIndex = db.user_budgets.findIndex((b) => b.user_id === userId);
  const now = new Date().toISOString();
  const safeCurrency = (currency || 'USD').toUpperCase();

  if (existingIndex >= 0) {
    db.user_budgets[existingIndex].max_purchase_amount = maxPurchase;
    db.user_budgets[existingIndex].daily_spending_limit = dailyLimit;
    db.user_budgets[existingIndex].currency = safeCurrency;
    db.user_budgets[existingIndex].updated_at = now;
  } else {
    db.user_budgets.push({
      id: `budget-${Date.now()}`,
      user_id: userId,
      max_purchase_amount: maxPurchase,
      daily_spending_limit: dailyLimit,
      currency: safeCurrency,
      created_at: now,
      updated_at: now,
    });
  }
  writeDb(db);
}

export function getTodaySpending(userId: string): number {
  const db = readDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  const totalCents = db.orders
    .filter(
      (o) =>
        o.user_id === userId &&
        o.payment_status === 'captured' &&
        o.order_type !== 'external' &&
        o.created_at.slice(0, 10) === todayStr
    )
    .reduce((sumCents, o) => sumCents + Math.round(Number(o.amount) * 100), 0);

  return totalCents / 100;
}

// ============================================================
// Product Catalog Queries
// ============================================================

export function getAllProducts(): DbProduct[] {
  const db = readDb();
  return db.products;
}

export function searchProducts(
  query: string,
  category?: string,
  maxPrice?: number
): DbProduct[] {
  const db = readDb();
  const q = query.toLowerCase().trim();

  return db.products
    .filter((p) => {
      let matchesQuery = true;
      if (q) {
        const stopWords = new Set([
          'for', 'the', 'and', 'with', 'need', 'want', 'under', 'below', 'from',
          'that', 'this', 'have', 'has', 'are', 'you', 'your', 'find', 'show',
          'best', 'good', 'online', 'classes', 'looking', 'buy', 'get', 'some',
        ]);
        const words = q
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter((w) => w.length > 2 && !stopWords.has(w));
        const target = `${p.name} ${p.description} ${p.brand} ${p.category} ${p.features}`.toLowerCase();
        matchesQuery = target.includes(q) || (words.length > 0 && words.some((w) => target.includes(w)));
      }

      let matchesCategory = true;
      if (category && category !== 'all') {
        const cat = category.toLowerCase();
        const pCat = p.category.toLowerCase();
        if (cat === 'home' || cat === 'home-kitchen') {
          matchesCategory = pCat.includes('home') || pCat.includes('kitchen');
        } else {
          matchesCategory = pCat.includes(cat);
        }
      }

      let matchesPrice = true;
      if (typeof maxPrice === 'number' && !isNaN(maxPrice)) {
        // Only apply raw numeric ceiling here when product is in USD; cross-currency filtering
        // runs with live FX normalization in src/lib/products.ts.
        if ((p.currency || 'USD').toUpperCase() === 'USD') {
          matchesPrice = p.price <= maxPrice;
        }
      }

      return matchesQuery && matchesCategory && matchesPrice;
    })
    .slice(0, 50);
}

export function getProductById(productId: string): DbProduct | undefined {
  const db = readDb();
  return db.products.find((p) => p.id === productId);
}

export function upsertProducts(products: DbProduct[]): void {
  const db = readDb();
  for (const p of products) {
    const normalized: DbProduct = {
      ...p,
      checkout_type: p.checkout_type || (p.is_demo === 1 ? 'agentpay' : 'external'),
      created_at: p.created_at || new Date().toISOString(),
    };
    const idx = db.products.findIndex((existing) => existing.id === p.id);
    if (idx >= 0) {
      db.products[idx] = { ...db.products[idx], ...normalized };
    } else {
      db.products.push(normalized);
    }
  }
  writeDb(db);
}

// ============================================================
// Order Queries (Single + Multi-Product)
// ============================================================

export function createOrder(order: {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  productImage: string;
  items?: DbOrderItem[];
  subtotal?: number;
  discountAmount?: number;
  couponCode?: string;
  shippingAddress?: unknown;
  orderType?: 'agentpay' | 'external';
  merchantName?: string;
  merchantUrl?: string;
  paypalOrderId: string;
  paypalCaptureId?: string;
  amount: number;
  currency: string;
  paymentStatus: 'pending' | 'approved' | 'captured' | 'cancelled' | 'failed' | string;
  displayAmount?: number;
  displayCurrency?: string;
  exchangeRate?: number;
  exchangeRateTimestamp?: string;
}): void {
  const db = readDb();
  const existingOrder = db.orders.find((o) => o.paypal_order_id === order.paypalOrderId);
  if (existingOrder) {
    existingOrder.payment_status = order.paymentStatus as DbOrder['payment_status'];
    if (order.paypalCaptureId) existingOrder.paypal_capture_id = order.paypalCaptureId;
    if (order.displayAmount !== undefined) existingOrder.display_amount = order.displayAmount;
    if (order.displayCurrency !== undefined) existingOrder.display_currency = order.displayCurrency;
    if (order.exchangeRate !== undefined) existingOrder.exchange_rate = order.exchangeRate;
    if (order.exchangeRateTimestamp !== undefined) existingOrder.exchange_rate_timestamp = order.exchangeRateTimestamp;
    writeDb(db);
    return;
  }

  db.orders.unshift({
    id: order.id,
    user_id: order.userId,
    product_id: order.productId,
    product_name: order.productName,
    product_image: order.productImage,
    items: order.items ? JSON.stringify(order.items) : undefined,
    subtotal: order.subtotal,
    discount_amount: order.discountAmount,
    coupon_code: order.couponCode,
    shipping_address: order.shippingAddress ? JSON.stringify(order.shippingAddress) : undefined,
    order_type: order.orderType || 'agentpay',
    merchant_name: order.merchantName,
    merchant_url: order.merchantUrl,
    paypal_order_id: order.paypalOrderId,
    paypal_capture_id: order.paypalCaptureId,
    amount: order.amount,
    currency: order.currency,
    payment_status: order.paymentStatus as DbOrder['payment_status'],
    created_at: new Date().toISOString(),
    is_sandbox: 1,
    display_amount: order.displayAmount,
    display_currency: order.displayCurrency,
    exchange_rate: order.exchangeRate,
    exchange_rate_timestamp: order.exchangeRateTimestamp,
  });
  writeDb(db);
}

export function updateOrderStatus(orderId: string, status: string): void {
  const db = readDb();
  const order = db.orders.find((o) => o.id === orderId);
  if (order) {
    order.payment_status = status as DbOrder['payment_status'];
    writeDb(db);
  }
}

export function updateOrderStatusByPayPalId(paypalOrderId: string, status: string, captureId?: string): void {
  const db = readDb();
  const order = db.orders.find((o) => o.paypal_order_id === paypalOrderId);
  if (order) {
    order.payment_status = status as DbOrder['payment_status'];
    if (captureId) {
      order.paypal_capture_id = captureId;
    }
    writeDb(db);
  }
}

export function getOrderById(orderId: string): DbOrder | undefined {
  const db = readDb();
  return db.orders.find((o) => o.id === orderId);
}

export function getOrderByPayPalId(paypalOrderId: string): DbOrder | undefined {
  const db = readDb();
  return db.orders.find((o) => o.paypal_order_id === paypalOrderId);
}

export function getUserOrders(userId: string): DbOrder[] {
  const db = readDb();
  return db.orders
    .filter((o) => o.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getSpendingSummary(userId: string) {
  const db = readDb();
  const userOrders = db.orders.filter((o) => o.user_id === userId);
  const capturedOrders = userOrders.filter(
    (o) => o.payment_status === 'captured' && o.order_type !== 'external'
  );

  const totalSpendingCents = capturedOrders.reduce(
    (sum, o) => sum + Math.round(Number(o.amount) * 100),
    0
  );
  const totalSpending = totalSpendingCents / 100;
  const orderCount = capturedOrders.length;
  const todaySpending = getTodaySpending(userId);
  const budget = getUserBudget(userId);
  const dailyLimit = budget?.daily_spending_limit || 200;
  const maxPurchase = budget?.max_purchase_amount || 100;
  const budgetCurrency = (budget?.currency || 'USD').toUpperCase();

  const recentOrders = userOrders
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return {
    totalSpending,
    orderCount,
    todaySpending,
    dailySpendingLimit: dailyLimit,
    remainingDailyBudget: Math.max(0, Math.round((dailyLimit - todaySpending) * 100) / 100),
    maxPurchaseAmount: maxPurchase,
    currency: budgetCurrency,
    recentOrders,
    budgetUtilization: dailyLimit > 0 ? (todaySpending / dailyLimit) * 100 : 0,
  };
}

export function isOrderAlreadyCaptured(paypalOrderId: string): boolean {
  const db = readDb();
  return db.orders.some((o) => o.paypal_order_id === paypalOrderId && o.payment_status === 'captured');
}

// ============================================================
// User Country / Currency & Shopping Preferences
// ============================================================

export function getUserPreference(userId: string): DbUserPreference | undefined {
  const db = readDb();
  return db.user_preferences?.find((p) => p.user_id === userId);
}

export function updateUserPreference(
  userId: string,
  countryCode: string,
  currencyCode: string
): DbUserPreference {
  const db = readDb();
  if (!db.user_preferences) db.user_preferences = [];

  const existingIndex = db.user_preferences.findIndex((p) => p.user_id === userId);
  const now = new Date().toISOString();

  if (existingIndex >= 0) {
    db.user_preferences[existingIndex].country_code = countryCode.toUpperCase();
    db.user_preferences[existingIndex].currency_code = currencyCode.toUpperCase();
    db.user_preferences[existingIndex].updated_at = now;
    writeDb(db);
    return db.user_preferences[existingIndex];
  } else {
    const newPref: DbUserPreference = {
      id: `pref-${Date.now()}`,
      user_id: userId,
      country_code: countryCode.toUpperCase(),
      currency_code: currencyCode.toUpperCase(),
      updated_at: now,
    };
    db.user_preferences.push(newPref);
    writeDb(db);
    return newPref;
  }
}

export function getShoppingPreferences(userId: string): {
  preferredBrands: string[];
  preferredCategories: string[];
  maxBudget: number | null;
} {
  const db = readDb();
  const row = db.shopping_preferences.find((p) => p.user_id === userId);
  if (!row) {
    return { preferredBrands: [], preferredCategories: [], maxBudget: null };
  }
  return {
    preferredBrands: row.preferred_brands ? JSON.parse(row.preferred_brands) : [],
    preferredCategories: row.preferred_categories ? JSON.parse(row.preferred_categories) : [],
    maxBudget: row.max_budget ?? null,
  };
}

export function updateShoppingPreferences(
  userId: string,
  prefs: { preferredBrands: string[]; preferredCategories: string[]; maxBudget: number | null }
) {
  const db = readDb();
  const idx = db.shopping_preferences.findIndex((p) => p.user_id === userId);
  const record: DbShoppingPreference = {
    id: idx >= 0 ? db.shopping_preferences[idx].id : `spref-${crypto.randomUUID()}`,
    user_id: userId,
    preferred_brands: JSON.stringify(prefs.preferredBrands),
    preferred_categories: JSON.stringify(prefs.preferredCategories),
    max_budget: prefs.maxBudget,
  };
  if (idx >= 0) {
    db.shopping_preferences[idx] = record;
  } else {
    db.shopping_preferences.push(record);
  }
  writeDb(db);
  return prefs;
}

// ============================================================
// Saved Addresses
// ============================================================

export function getUserAddresses(userId: string): DbAddress[] {
  const db = readDb();
  return db.addresses
    .filter((a) => a.user_id === userId)
    .sort((a, b) => b.is_default - a.is_default || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function createAddress(
  userId: string,
  addr: {
    label: string;
    fullName: string;
    phone: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    countryCode: string;
    isDefault?: boolean;
  }
): DbAddress {
  const db = readDb();
  const existingForUser = db.addresses.filter((a) => a.user_id === userId);
  const shouldBeDefault = addr.isDefault || existingForUser.length === 0 ? 1 : 0;

  if (shouldBeDefault === 1) {
    db.addresses.forEach((a) => {
      if (a.user_id === userId) a.is_default = 0;
    });
  }

  const record: DbAddress = {
    id: `addr-${crypto.randomUUID()}`,
    user_id: userId,
    label: addr.label || 'Home',
    full_name: addr.fullName,
    phone: addr.phone,
    line1: addr.line1,
    line2: addr.line2,
    city: addr.city,
    state: addr.state,
    postal_code: addr.postalCode,
    country_code: addr.countryCode.toUpperCase(),
    is_default: shouldBeDefault,
    created_at: new Date().toISOString(),
  };
  db.addresses.push(record);
  writeDb(db);
  return record;
}

export function setDefaultAddress(userId: string, addressId: string): boolean {
  const db = readDb();
  const target = db.addresses.find((a) => a.id === addressId && a.user_id === userId);
  if (!target) return false;
  db.addresses.forEach((a) => {
    if (a.user_id === userId) {
      a.is_default = a.id === addressId ? 1 : 0;
    }
  });
  writeDb(db);
  return true;
}

export function deleteAddress(userId: string, addressId: string): boolean {
  const db = readDb();
  const before = db.addresses.length;
  const target = db.addresses.find((a) => a.id === addressId && a.user_id === userId);
  if (!target) return false;

  db.addresses = db.addresses.filter((a) => !(a.id === addressId && a.user_id === userId));
  if (target.is_default === 1) {
    const next = db.addresses.find((a) => a.user_id === userId);
    if (next) next.is_default = 1;
  }
  writeDb(db);
  return db.addresses.length < before;
}

// ============================================================
// Shopping Cart (Owner-Scoped: userId or guest token)
// ============================================================

export function getCartItems(ownerId: string): DbCartItem[] {
  const db = readDb();
  return db.cart_items.filter((item) => item.owner_id === ownerId);
}

export function addToCart(ownerId: string, productId: string, quantity: number = 1): DbCartItem {
  const db = readDb();
  const qty = Math.max(1, Math.min(20, Math.floor(quantity)));
  const now = new Date().toISOString();
  const existing = db.cart_items.find(
    (c) => c.owner_id === ownerId && c.product_id === productId
  );

  if (existing) {
    existing.quantity = Math.min(20, existing.quantity + qty);
    existing.updated_at = now;
    writeDb(db);
    return existing;
  }

  const item: DbCartItem = {
    id: `cart-${crypto.randomUUID()}`,
    owner_id: ownerId,
    product_id: productId,
    quantity: qty,
    added_at: now,
    updated_at: now,
  };
  db.cart_items.push(item);
  writeDb(db);
  return item;
}

export function updateCartItemQuantity(ownerId: string, productId: string, quantity: number): boolean {
  const db = readDb();
  const idx = db.cart_items.findIndex(
    (c) => c.owner_id === ownerId && c.product_id === productId
  );
  if (idx < 0) return false;

  if (quantity <= 0) {
    db.cart_items.splice(idx, 1);
  } else {
    db.cart_items[idx].quantity = Math.min(20, Math.floor(quantity));
    db.cart_items[idx].updated_at = new Date().toISOString();
  }
  writeDb(db);
  return true;
}

export function removeFromCart(ownerId: string, productId: string): boolean {
  const db = readDb();
  const before = db.cart_items.length;
  db.cart_items = db.cart_items.filter(
    (c) => !(c.owner_id === ownerId && c.product_id === productId)
  );
  writeDb(db);
  return db.cart_items.length < before;
}

export function clearCart(ownerId: string, productIds?: string[]): void {
  const db = readDb();
  if (productIds && productIds.length > 0) {
    const idSet = new Set(productIds);
    db.cart_items = db.cart_items.filter(
      (c) => !(c.owner_id === ownerId && idSet.has(c.product_id))
    );
  } else {
    db.cart_items = db.cart_items.filter((c) => c.owner_id !== ownerId);
  }
  writeDb(db);
}

// ============================================================
// Wishlist (Duplicate-Safe)
// ============================================================

export function getWishlistItems(ownerId: string): DbWishlistItem[] {
  const db = readDb();
  return db.wishlist_items
    .filter((w) => w.owner_id === ownerId)
    .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
}

export function addToWishlist(
  ownerId: string,
  product: DbProduct,
  priceAlertEnabled: boolean = true
): { item: DbWishlistItem; alreadyExists: boolean } {
  const db = readDb();
  const existing = db.wishlist_items.find(
    (w) => w.owner_id === ownerId && w.product_id === product.id
  );
  if (existing) {
    return { item: existing, alreadyExists: true };
  }

  const now = new Date().toISOString();
  const item: DbWishlistItem = {
    id: `wish-${crypto.randomUUID()}`,
    owner_id: ownerId,
    product_id: product.id,
    saved_price: product.price,
    currency: product.currency || 'USD',
    price_alert_enabled: priceAlertEnabled ? 1 : 0,
    last_checked_price: product.price,
    last_checked_at: now,
    added_at: now,
  };
  db.wishlist_items.unshift(item);
  writeDb(db);
  return { item, alreadyExists: false };
}

export function removeFromWishlist(ownerId: string, productId: string): boolean {
  const db = readDb();
  const before = db.wishlist_items.length;
  db.wishlist_items = db.wishlist_items.filter(
    (w) => !(w.owner_id === ownerId && w.product_id === productId)
  );
  writeDb(db);
  return db.wishlist_items.length < before;
}

export function updateWishlistCheckedPrice(
  ownerId: string,
  productId: string,
  latestPrice: number
): void {
  const db = readDb();
  const item = db.wishlist_items.find(
    (w) => w.owner_id === ownerId && w.product_id === productId
  );
  if (item) {
    item.last_checked_price = latestPrice;
    item.last_checked_at = new Date().toISOString();
    writeDb(db);
  }
}

// ============================================================
// Recently Viewed (Deduplicated & Bounded to 20 Items)
// ============================================================

export function getRecentlyViewed(ownerId: string, limit: number = 12): DbRecentlyViewed[] {
  const db = readDb();
  return db.recently_viewed
    .filter((r) => r.owner_id === ownerId)
    .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())
    .slice(0, limit);
}

export function recordRecentlyViewed(ownerId: string, productId: string): void {
  const db = readDb();
  const now = new Date().toISOString();
  // Remove previous entry for same product & owner
  db.recently_viewed = db.recently_viewed.filter(
    (r) => !(r.owner_id === ownerId && r.product_id === productId)
  );
  db.recently_viewed.unshift({
    id: `rv-${crypto.randomUUID()}`,
    owner_id: ownerId,
    product_id: productId,
    viewed_at: now,
  });

  // Keep max 20 items per owner
  const ownerEntries = db.recently_viewed.filter((r) => r.owner_id === ownerId);
  if (ownerEntries.length > 20) {
    const keepIds = new Set(ownerEntries.slice(0, 20).map((r) => r.id));
    db.recently_viewed = db.recently_viewed.filter(
      (r) => r.owner_id !== ownerId || keepIds.has(r.id)
    );
  }
  writeDb(db);
}

export function clearRecentlyViewed(ownerId: string): void {
  const db = readDb();
  db.recently_viewed = db.recently_viewed.filter((r) => r.owner_id !== ownerId);
  writeDb(db);
}

// ============================================================
// Coupons & Promotions
// ============================================================

export function getActiveCoupons(): DbCoupon[] {
  const db = readDb();
  const now = Date.now();
  return db.coupons.filter((c) => {
    if (c.active !== 1) return false;
    if (c.expires_at && new Date(c.expires_at).getTime() < now) return false;
    return true;
  });
}

export function validateCouponCode(
  code: string,
  agentPaySubtotalUSD: number
): { valid: boolean; coupon?: DbCoupon; discountAmount: number; error?: string } {
  const normalized = code.trim().toUpperCase();
  if (!normalized) {
    return { valid: false, discountAmount: 0, error: 'Please enter a coupon code.' };
  }

  const db = readDb();
  const coupon = db.coupons.find((c) => c.code.toUpperCase() === normalized);
  if (!coupon || coupon.active !== 1) {
    return { valid: false, discountAmount: 0, error: `Coupon "${normalized}" is not valid.` };
  }

  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { valid: false, discountAmount: 0, error: `Coupon "${normalized}" has expired.` };
  }

  const subtotalCents = Math.round(agentPaySubtotalUSD * 100);
  const minCents = Math.round(coupon.min_order_amount * 100);
  if (subtotalCents < minCents) {
    return {
      valid: false,
      discountAmount: 0,
      error: `Coupon "${normalized}" requires a minimum AgentPay Checkout subtotal of $${coupon.min_order_amount.toFixed(2)}.`,
    };
  }

  let discountCents = 0;
  if (coupon.discount_type === 'percentage') {
    discountCents = Math.round((subtotalCents * coupon.discount_value) / 100);
    if (coupon.max_discount) {
      discountCents = Math.min(discountCents, Math.round(coupon.max_discount * 100));
    }
  } else {
    discountCents = Math.round(coupon.discount_value * 100);
  }
  discountCents = Math.min(discountCents, subtotalCents);

  return {
    valid: true,
    coupon,
    discountAmount: discountCents / 100,
  };
}

// ============================================================
// Notifications & Preferences
// ============================================================

export function getUserNotifications(userId: string): DbNotification[] {
  const db = readDb();
  return db.notifications
    .filter((n) => n.user_id === userId)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 50);
}

export function createNotification(
  userId: string,
  notif: {
    type: DbNotification['type'];
    title: string;
    message: string;
    link?: string;
  }
): DbNotification {
  const db = readDb();
  const record: DbNotification = {
    id: `notif-${crypto.randomUUID()}`,
    user_id: userId,
    type: notif.type,
    title: notif.title,
    message: notif.message,
    link: notif.link,
    is_read: 0,
    created_at: new Date().toISOString(),
  };
  db.notifications.unshift(record);
  // Keep latest 50 per user
  const userNotifs = db.notifications.filter((n) => n.user_id === userId);
  if (userNotifs.length > 50) {
    const keepIds = new Set(userNotifs.slice(0, 50).map((n) => n.id));
    db.notifications = db.notifications.filter((n) => n.user_id !== userId || keepIds.has(n.id));
  }
  writeDb(db);
  return record;
}

export function markNotificationsRead(userId: string, notificationId?: string): void {
  const db = readDb();
  db.notifications.forEach((n) => {
    if (n.user_id === userId && (!notificationId || n.id === notificationId)) {
      n.is_read = 1;
    }
  });
  writeDb(db);
}

export function getNotificationPreferences(userId: string): DbNotificationPreference {
  const db = readDb();
  const existing = db.notification_preferences.find((p) => p.user_id === userId);
  if (existing) return existing;
  return {
    user_id: userId,
    order_updates: 1,
    payment_alerts: 1,
    price_drops: 1,
    promotions: 1,
    updated_at: new Date().toISOString(),
  };
}

export function updateNotificationPreferences(
  userId: string,
  prefs: {
    orderUpdates: boolean;
    paymentAlerts: boolean;
    priceDrops: boolean;
    promotions: boolean;
  }
): DbNotificationPreference {
  const db = readDb();
  const idx = db.notification_preferences.findIndex((p) => p.user_id === userId);
  const record: DbNotificationPreference = {
    user_id: userId,
    order_updates: prefs.orderUpdates ? 1 : 0,
    payment_alerts: prefs.paymentAlerts ? 1 : 0,
    price_drops: prefs.priceDrops ? 1 : 0,
    promotions: prefs.promotions ? 1 : 0,
    updated_at: new Date().toISOString(),
  };
  if (idx >= 0) {
    db.notification_preferences[idx] = record;
  } else {
    db.notification_preferences.push(record);
  }
  writeDb(db);
  return record;
}

// ============================================================
// External Merchant Redirect Tracking (Separate from Search)
// ============================================================

export function recordExternalClick(
  ownerId: string,
  productId: string,
  merchantName: string,
  merchantUrl: string
): void {
  const db = readDb();
  db.external_clicks.unshift({
    id: `ext-${crypto.randomUUID()}`,
    owner_id: ownerId,
    product_id: productId,
    merchant_name: merchantName,
    merchant_url: merchantUrl,
    clicked_at: new Date().toISOString(),
  });
  writeDb(db);
}

// ============================================================
// Guest-to-User Merge on Login / Registration
// ============================================================

export function mergeGuestStateToUser(guestOwnerId: string, userId: string): void {
  if (!guestOwnerId || guestOwnerId === userId) return;
  const db = readDb();
  const now = new Date().toISOString();

  // Merge cart items
  const guestCart = db.cart_items.filter((c) => c.owner_id === guestOwnerId);
  for (const gc of guestCart) {
    const existing = db.cart_items.find(
      (uc) => uc.owner_id === userId && uc.product_id === gc.product_id
    );
    if (existing) {
      existing.quantity = Math.min(20, existing.quantity + gc.quantity);
      existing.updated_at = now;
    } else {
      db.cart_items.push({ ...gc, owner_id: userId, updated_at: now });
    }
  }
  db.cart_items = db.cart_items.filter((c) => c.owner_id !== guestOwnerId);

  // Merge wishlist items (avoiding duplicates)
  const guestWish = db.wishlist_items.filter((w) => w.owner_id === guestOwnerId);
  for (const gw of guestWish) {
    const exists = db.wishlist_items.some(
      (uw) => uw.owner_id === userId && uw.product_id === gw.product_id
    );
    if (!exists) {
      db.wishlist_items.push({ ...gw, owner_id: userId });
    }
  }
  db.wishlist_items = db.wishlist_items.filter((w) => w.owner_id !== guestOwnerId);

  // Merge recently viewed
  const guestRv = db.recently_viewed.filter((r) => r.owner_id === guestOwnerId);
  for (const gr of guestRv) {
    const exists = db.recently_viewed.some(
      (ur) => ur.owner_id === userId && ur.product_id === gr.product_id
    );
    if (!exists) {
      db.recently_viewed.push({ ...gr, owner_id: userId });
    }
  }
  db.recently_viewed = db.recently_viewed.filter((r) => r.owner_id !== guestOwnerId);

  writeDb(db);
}
