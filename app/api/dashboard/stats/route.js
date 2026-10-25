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

    // 1. Try querying view_dashboard_kpis
    let formattedKpi = null;
    try {
      const { data: kpiData } = await supabase
        .from('view_dashboard_kpis')
        .select('*')
        .maybeSingle();

      if (kpiData) {
        formattedKpi = {
          omzetHariIni: Number(kpiData.omzet_hari_ini) || 0,
          lembarHariIni: Number(kpiData.lembar_tercetak_hari_ini) || 0,
          pesananSelesai: Number(kpiData.pesanan_selesai_hari_ini) || 0,
          antreanAktif: Number(kpiData.antrean_aktif_saat_ini) || 0
        };
      }
    } catch (e) {
      console.warn('[Dashboard Stats] view_dashboard_kpis view not available, calculating directly:', e.message);
    }

    // 2. Direct aggregation fallback on Supabase orders table
    if (!formattedKpi) {
      const today = new Date().toISOString().split('T')[0];
      const { data: allOrders } = await supabase
        .from('orders')
        .select('*, print_specifications(*)');

      const ordersList = allOrders || [];
      const todayOrders = ordersList.filter(o => o.created_at && o.created_at.startsWith(today));

      const omzetHariIni = todayOrders
        .filter(o => o.status !== 'CANCELLED' && o.status !== 'DRAFT' && o.status !== 'PENDING_PAYMENT')
        .reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);

      const lembarHariIni = todayOrders
        .filter(o => o.status === 'PRINTING' || o.status === 'READY_FOR_PICKUP' || o.status === 'COMPLETED')
        .reduce((sum, o) => sum + ((o.print_specifications?.[0]?.sheets_count || o.total_pages || 1) * (o.copies || 1)), 0);

      const pesananSelesai = ordersList.filter(o => o.status === 'COMPLETED').length;
      const antreanAktif = ordersList.filter(o =>
        ['WAITING_IN_QUEUE', 'PROCESSING', 'PRINTING'].includes(o.status)
      ).length;

      formattedKpi = {
        omzetHariIni,
        lembarHariIni,
        pesananSelesai,
        antreanAktif
      };
    }

    // 3. 7-Day Chart Data
    let formattedChart = null;
    try {
      const { data: chartData } = await supabase
        .from('view_dashboard_revenue_7days')
        .select('*')
        .order('report_date', { ascending: true });

      if (chartData && chartData.length > 0) {
        formattedChart = chartData.map(row => ({
          day: row.day_short_name,
          date: row.formatted_date,
          total: Number(row.total_revenue || 0),
          orders: Number(row.total_orders || 0)
        }));
      }
    } catch (e) {
      console.warn('[Dashboard Stats] view_dashboard_revenue_7days not available:', e.message);
    }

    if (!formattedChart) {
      formattedChart = mockStore.getDashboardStats().chart7Days;
    }

    // 4. Printers Data
    let formattedPrinters = null;
    try {
      const { data: printersData } = await supabase.from('printers').select('*');
      if (printersData && printersData.length > 0) {
        formattedPrinters = printersData.map(p => ({
          id: p.id,
          name: p.name,
          status: p.status,
          paperLevel: `${p.paper_level}%`,
          toner: `${p.toner_level}%`,
          queueCount: p.queue_count
        }));
      }
    } catch (e) {
      // Printers table optional
    }

    if (!formattedPrinters) {
      formattedPrinters = mockStore.getDashboardStats().printers;
    }

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
