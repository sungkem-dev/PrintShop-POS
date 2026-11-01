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

    // Return isolated operator session data with dedicated loket identity
    return NextResponse.json({
      success: true,
      message: 'Login berhasil',
      operator: {
        id: operator.id,
        name: operator.name,
        email: operator.email,
        role: operator.role,
        loket_id: operator.loket_id || 'LOKET-1',
        station_id: operator.station_id || operator.loket_id || 'LOKET-1',
        station_name: operator.station_name || 'Loket 1 (Kasir Utama)'
      },
      token: operator.token || `auth_${Date.now()}_${operator.id}`
    });
  } catch (error) {
    const isPending = error.message && error.message.toLowerCase().includes('menunggu');
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: isPending ? 403 : 500 });
  }
}
