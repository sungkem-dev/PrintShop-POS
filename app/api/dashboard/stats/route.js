import { NextResponse } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { mockStore } from '@/lib/mockStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseClient();
    if (!supabase || !isSupabaseConfigured()) {
      return NextResponse.json({ success: true, data: mockStore.getDashboardStats() });
    }

    const { data: kpiData, error: kpiErr } = await supabase
      .from('view_dashboard_kpis')
      .select('*')
      .maybeSingle();

    if (kpiErr) throw kpiErr;

    const { data: chartData, error: chartErr } = await supabase
      .from('view_dashboard_revenue_7days')
      .select('*')
      .order('report_date', { ascending: true });

    if (chartErr) throw chartErr;

    const { data: printersData, error: printerErr } = await supabase
      .from('printers')
      .select('*');

    if (printerErr) throw printerErr;

    const formattedKpi = {
      omzetHariIni: kpiData?.omzet_hari_ini || 0,
      lembarHariIni: kpiData?.lembar_tercetak_hari_ini || 0,
      pesananSelesai: kpiData?.pesanan_selesai_hari_ini || 0,
      antreanAktif: kpiData?.antrean_aktif_saat_ini || 0
    };

    const formattedChart = (chartData || []).map(row => ({
      day: row.day_short_name,
      date: row.formatted_date,
      total: Number(row.total_revenue || 0),
      orders: Number(row.total_orders || 0)
    }));

    const formattedPrinters = (printersData || []).map(p => ({
      id: p.id,
      name: p.name,
      status: p.status,
      paperLevel: `${p.paper_level}%`,
      toner: `${p.toner_level}%`,
      queueCount: p.queue_count
    }));

    return NextResponse.json({
      success: true,
      data: {
        kpi: formattedKpi,
        chart7Days: formattedChart,
        printers: formattedPrinters
      }
    });
  } catch (error) {
    console.error('API /api/dashboard/stats error:', error);
    return NextResponse.json({ success: true, data: mockStore.getDashboardStats() });
  }
}
