// src/app/api/chat/route.ts
// AI Shopping Co-Pilot chat endpoint

import { NextRequest, NextResponse } from 'next/server';
import { processShoppingRequest } from '@/lib/ai-agent';
import { attachGuestCookieIfNeeded, getShoppingOwnerId } from '@/lib/auth';
import { resolveServerPreferences } from '@/lib/preferences';
import { ChatMessage } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history, countryCode, currencyCode, contextProductId } = body as {
      message: string;
      history?: ChatMessage[];
      countryCode?: string;
      currencyCode?: string;
      contextProductId?: string;
    };

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Message is required' }, { status: 400 });
    }

    const { ownerId, newGuestToken } = await getShoppingOwnerId();
    const resolvedPrefs = await resolveServerPreferences(countryCode, currencyCode);

    const agentResponse = await processShoppingRequest(
      message.trim(),
      history || [],
      resolvedPrefs.countryCode,
      resolvedPrefs.currencyCode,
      ownerId,
      contextProductId,
      resolvedPrefs
    );

    const res = NextResponse.json({
      success: true,
      data: agentResponse,
    });
    return attachGuestCookieIfNeeded(res, newGuestToken);
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
