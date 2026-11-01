import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';

export async function GET() {
  try {
    const operators = await DataService.getOperators();
    return NextResponse.json({
      success: true,
      data: operators
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, pin, role } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Nama lengkap wajib diisi' }, { status: 400 });
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json({ success: false, error: 'Alamat email tidak valid' }, { status: 400 });
    }

    if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
      return NextResponse.json({ success: false, error: 'PIN operator harus terdiri dari tepat 6 angka' }, { status: 400 });
    }

    const newOperator = await DataService.registerOperator({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      pin: pin.trim(),
      role: role || 'admin'
    });

    return NextResponse.json({
      success: true,
      message: 'Operator / Admin baru berhasil didaftarkan ke sistem',
      operator: newOperator
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err.message || 'Gagal mendaftarkan operator'
    }, { status: 400 });
  }
}
