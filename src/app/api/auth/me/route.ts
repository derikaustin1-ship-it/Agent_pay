// src/app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getAuthenticatedUser, toPublicUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: true, data: { user: null } });
  }
  return NextResponse.json({ success: true, data: { user: toPublicUser(user) } });
}
