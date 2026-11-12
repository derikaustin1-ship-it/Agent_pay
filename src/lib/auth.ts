// src/lib/auth.ts
// Real session-based authentication and guest-owner resolution for AgentPay
// Uses cryptographically random session tokens hashed with SHA-256 in the database
// and HttpOnly cookies. Never trusts client-supplied user IDs.

import crypto from 'crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  DbUser,
  createSession,
  deleteSessionByToken,
  getSessionByToken,
  mergeGuestStateToUser,
} from './database';
import { AuthUser } from '@/types';

export const SESSION_COOKIE_NAME = 'agentpay_session';
export const GUEST_COOKIE_NAME = 'agentpay_guest';
const SESSION_TTL_DAYS = 14;

export function toPublicUser(user: DbUser): AuthUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    createdAt: user.created_at,
  };
}

/**
 * Retrieve the currently authenticated user from the HttpOnly session cookie.
 * Returns null if not authenticated or session is expired/invalid.
 */
export async function getAuthenticatedUser(): Promise<DbUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token || token.length < 32) {
      return null;
    }
    const found = getSessionByToken(token);
    return found ? found.user : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the current shopping owner ID for cart, wishlist, and recently viewed.
 * Uses the authenticated user's ID if logged in, otherwise an HttpOnly guest token.
 */
export async function getShoppingOwnerId(): Promise<{
  ownerId: string;
  isAuthenticated: boolean;
  user: DbUser | null;
  newGuestToken?: string;
}> {
  const user = await getAuthenticatedUser();
  if (user) {
    return { ownerId: user.id, isAuthenticated: true, user };
  }

  const cookieStore = await cookies();
  const existingGuest = cookieStore.get(GUEST_COOKIE_NAME)?.value;
  if (existingGuest && existingGuest.startsWith('guest-')) {
    return { ownerId: existingGuest, isAuthenticated: false, user: null };
  }

  const newGuestToken = `guest-${crypto.randomUUID()}`;
  return { ownerId: newGuestToken, isAuthenticated: false, user: null, newGuestToken };
}

/**
 * Attach guest cookie to a NextResponse if a new guest token was minted.
 */
export function attachGuestCookieIfNeeded(response: NextResponse, newGuestToken?: string): NextResponse {
  if (newGuestToken) {
    response.cookies.set(GUEST_COOKIE_NAME, newGuestToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return response;
}

/**
 * Issue a real session for an authenticated user, merge any guest cart/wishlist/history,
 * and set the HttpOnly session cookie on the response.
 */
export async function issueSessionCookie(response: NextResponse, userId: string): Promise<NextResponse> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  createSession(userId, rawToken, SESSION_TTL_DAYS);

  // Merge guest cart/wishlist/recently viewed into authenticated user's account
  try {
    const cookieStore = await cookies();
    const guestId = cookieStore.get(GUEST_COOKIE_NAME)?.value;
    if (guestId && guestId.startsWith('guest-')) {
      mergeGuestStateToUser(guestId, userId);
    }
  } catch {
    // ignore merge error
  }

  response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });

  return response;
}

/**
 * Revoke the current session token and clear the session cookie.
 */
export async function clearSessionCookie(response: NextResponse): Promise<NextResponse> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (token) {
      deleteSessionByToken(token);
    }
  } catch {
    // ignore
  }

  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
