import { NextResponse } from 'next/server';
import { DataService } from '@/lib/supabase';

export async function GET() {
  try {
    const stats = await DataService.getDashboardStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
