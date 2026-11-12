// src/app/api/addresses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  createAddress,
  DbAddress,
  deleteAddress,
  getUserAddresses,
  setDefaultAddress,
} from '@/lib/database';
import { getAuthenticatedUser } from '@/lib/auth';
import { SavedAddress } from '@/types';

export const dynamic = 'force-dynamic';

function mapAddress(a: DbAddress): SavedAddress {
  return {
    id: a.id,
    userId: a.user_id,
    label: a.label,
    fullName: a.full_name,
    phone: a.phone,
    line1: a.line1,
    line2: a.line2,
    city: a.city,
    state: a.state,
    postalCode: a.postal_code,
    countryCode: a.country_code,
    isDefault: a.is_default === 1,
    createdAt: a.created_at,
  };
}

export async function GET() {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const list = getUserAddresses(user.id).map(mapAddress);
  return NextResponse.json({ success: true, data: list });
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { label, fullName, phone, line1, line2, city, state, postalCode, countryCode, isDefault } =
      body as Partial<SavedAddress>;

    if (!fullName || !phone || !line1 || !city || !state || !postalCode || !countryCode) {
      return NextResponse.json(
        { success: false, error: 'All required address fields must be filled.' },
        { status: 400 }
      );
    }

    createAddress(user.id, {
      label: label || 'Home',
      fullName,
      phone,
      line1,
      line2,
      city,
      state,
      postalCode,
      countryCode,
      isDefault,
    });

    const list = getUserAddresses(user.id).map(mapAddress);
    return NextResponse.json({ success: true, data: list });
  } catch (error) {
    console.error('Address POST error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save address' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const { addressId } = body as { addressId?: string };
  if (!addressId) {
    return NextResponse.json({ success: false, error: 'Address ID is required' }, { status: 400 });
  }

  const ok = setDefaultAddress(user.id, addressId);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: getUserAddresses(user.id).map(mapAddress) });
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const addressId = searchParams.get('id');
  if (!addressId) {
    return NextResponse.json({ success: false, error: 'Address ID is required' }, { status: 400 });
  }

  const ok = deleteAddress(user.id, addressId);
  if (!ok) {
    return NextResponse.json({ success: false, error: 'Address not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: getUserAddresses(user.id).map(mapAddress) });
}
