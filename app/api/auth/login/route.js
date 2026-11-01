import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, pin } = body;

    if (!email || !pin) {
      return NextResponse.json({ success: false, error: 'Email dan PIN wajib diisi' }, { status: 400 });
    }

    const operator = await DataService.authenticateOperator(email.trim(), pin.trim());
    if (!operator) {
      return NextResponse.json({
        success: false,
        error: 'Kombinasi email atau PIN 6-digit tidak valid'
      }, { status: 401 });
    }

    // Return operator session data
    return NextResponse.json({
      success: true,
      message: 'Login berhasil',
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email,
        role: operator.role
      },
      token: `auth_${Date.now()}_${operator.id}`
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
