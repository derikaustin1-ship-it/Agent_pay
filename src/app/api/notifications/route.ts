// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getUserNotifications, markNotificationsRead } from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: true, data: { notifications: [], unreadCount: 0 } });
  }

  const rows = getUserNotifications(user.id);
  const notifications = rows.map((n) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.is_read === 1,
    createdAt: n.created_at,
  }));

  return NextResponse.json({
    success: true,
    data: {
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { notificationId } = body as { notificationId?: string };

  markNotificationsRead(user.id, notificationId);
  const rows = getUserNotifications(user.id);
  const notifications = rows.map((n) => ({
    id: n.id,
    userId: n.user_id,
    type: n.type,
    title: n.title,
    message: n.message,
    link: n.link,
    isRead: n.is_read === 1,
    createdAt: n.created_at,
  }));

  return NextResponse.json({
    success: true,
    data: {
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    },
  });
}
