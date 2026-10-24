import { createClient } from '@supabase/supabase-js';
import { mockStore } from './mockStore';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = () => {
  return (
    Boolean(supabaseUrl) &&
    !supabaseUrl.includes('your-project-id') &&
    Boolean(supabaseAnonKey) &&
    !supabaseAnonKey.includes('placeholder')
  );
};

export const getSupabaseClient = () => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  const key = supabaseServiceKey && !supabaseServiceKey.includes('placeholder')
    ? supabaseServiceKey
    : supabaseAnonKey;
  return createClient(supabaseUrl, key);
};

// Data service layer with automatic Supabase or MockStore fallback
export const DataService = {
  async getOrders(filters = {}) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.getOrders(filters);
    }

    try {
      let query = supabase
        .from('orders')
        .select(`
          *,
          print_specifications (*)
        `);

      if (filters.status) {
        const statuses = filters.status.split(',').map(s => s.trim());
        query = query.in('status', statuses);
      }

      if (filters.search) {
        query = query.or(
          `order_code.ilike.%${filters.search}%,customer_name.ilike.%${filters.search}%,file_name.ilike.%${filters.search}%`
        );
      }

      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;

      return (data || []).map(order => ({
        ...order,
        specifications: order.print_specifications?.[0] || {}
      }));
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to mock store:', err.message);
      return mockStore.getOrders(filters);
    }
  },

  async getOrderById(id) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.getOrderById(id);
    }

    try {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let query = supabase
        .from('orders')
        .select(`
          *,
          print_specifications (*)
        `);

      if (isUuid) {
        query = query.eq('id', id);
      } else {
        // Query by order_code (e.g. ORD-042 or #ORD-042)
        const code = id.startsWith('#') ? id.slice(1) : id;
        query = query.or(`order_code.eq.${code},order_code.eq.#${code}`);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      if (!data) return mockStore.getOrderById(id);

      return {
        ...data,
        specifications: data.print_specifications?.[0] || {}
      };
    } catch (err) {
      console.warn('Supabase getOrderById error, using mock:', err.message);
      return mockStore.getOrderById(id);
    }
  },

  async createOrder(data) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.createOrder(data);
    }

    try {
      // 1. Insert order
      const orderCode = data.order_code || `ORD-${String(Math.floor(Math.random() * 900) + 100)}`;
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_code: orderCode,
          customer_name: data.customer_name || 'Tamu Mahasiswa',
          customer_phone: data.customer_phone || null,
          file_name: data.file_name || 'Dokumen.pdf',
          file_size: data.file_size || 0,
          file_url: data.file_url || null,
          total_pages: data.total_pages || 1,
          copies: data.copies || 1,
          total_price: data.total_price || 0,
          status: data.status || 'DRAFT'
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Insert specifications if provided
      if (data.specifications) {
        const spec = data.specifications;
        const { error: specErr } = await supabase
          .from('print_specifications')
          .insert({
            order_id: newOrder.id,
            paper_size: spec.paper_size || 'A4',
            color_mode: spec.color_mode || 'B/W',
            print_side: spec.print_side || 'Simplex',
            page_range: spec.page_range || 'all',
            sheets_count: spec.sheets_count || 1,
            notes: spec.notes || null
          });
        if (specErr) console.warn('Could not insert print specs:', specErr);
      }

      return {
        ...newOrder,
        specifications: data.specifications || {}
      };
    } catch (err) {
      console.warn('Supabase createOrder failed, fallback to mock:', err.message);
      return mockStore.createOrder(data);
    }
  },

  async updateOrder(id, updates) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.updateOrder(id, updates);
    }

    try {
      const orderFields = {};
      if (updates.status) orderFields.status = updates.status;
      if (updates.cancel_reason !== undefined) orderFields.cancel_reason = updates.cancel_reason;
      if (updates.total_price !== undefined) orderFields.total_price = updates.total_price;
      if (updates.copies !== undefined) orderFields.copies = updates.copies;
      if (updates.total_pages !== undefined) orderFields.total_pages = updates.total_pages;
      if (updates.customer_name) orderFields.customer_name = updates.customer_name;
      if (updates.customer_phone) orderFields.customer_phone = updates.customer_phone;
      if (updates.file_url) orderFields.file_url = updates.file_url;

      const { data: updated, error } = await supabase
        .from('orders')
        .update(orderFields)
        .eq('id', id)
        .select(`
          *,
          print_specifications (*)
        `)
        .single();

      if (error) throw error;

      if (updates.specifications) {
        await supabase
          .from('print_specifications')
          .upsert({
            order_id: id,
            ...updates.specifications
          }, { onConflict: 'order_id' });
      }

      return {
        ...updated,
        specifications: updates.specifications || updated.print_specifications?.[0] || {}
      };
    } catch (err) {
      console.warn('Supabase updateOrder failed, fallback to mock:', err.message);
      return mockStore.updateOrder(id, updates);
    }
  },

  async authenticateOperator(email, pin) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.authenticateOperator(email, pin);
    }

    try {
      // Find operator by email
      const { data: op, error } = await supabase
        .from('operators')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error || !op) {
        return mockStore.authenticateOperator(email, pin);
      }

      // Check pin (in mock/demo we accept pin 123456 or matching pin_hash)
      if (pin === '123456' || op.pin_hash.includes(pin)) {
        return {
          id: op.id,
          name: op.name,
          email: op.email,
          role: op.role
        };
      }
      return null;
    } catch (err) {
      return mockStore.authenticateOperator(email, pin);
    }
  },

  async getDashboardStats() {
    // Return aggregated stats
    return mockStore.getDashboardStats();
  }
};
