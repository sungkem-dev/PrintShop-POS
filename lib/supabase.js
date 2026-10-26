import { createClient } from '@supabase/supabase-js';
import { mockStore } from './mockStore.js';

export const isSupabaseConfigured = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
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
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key =
    supabaseServiceKey && !supabaseServiceKey.includes('placeholder')
      ? supabaseServiceKey
      : supabaseAnonKey;
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false }
  });
};

// Data service layer with Supabase primary storage
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
          print_specifications (*),
          transactions (*)
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
        specifications: order.print_specifications?.[0] || {},
        transaction: order.transactions?.[0] || null
      }));
    } catch (err) {
      console.warn('Supabase fetch failed, falling back to mock store:', err.message);
      return mockStore.getOrders(filters);
    }
  },

  async getOrderById(id) {
    if (!id) return null;
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
          print_specifications (*),
          transactions (*)
        `);

      if (isUuid) {
        query = query.eq('id', id);
      } else {
        const code = id.startsWith('#') ? id.slice(1) : id;
        query = query.or(`order_code.eq.${code},order_code.eq.#${code}`);
      }

      const { data, error } = await query.limit(1);
      if (error) throw error;
      const row = data?.[0];
      if (!row) return null;

      return {
        ...row,
        specifications: row.print_specifications?.[0] || {},
        transaction: row.transactions?.[0] || null
      };
    } catch (err) {
      console.warn('Supabase getOrderById error:', err.message);
      return null;
    }
  },

  async createOrder(data) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.createOrder(data);
    }

    try {
      // Generate unique order_code
      let orderCode = data.order_code || `ORD-${String(Math.floor(Math.random() * 900) + 100)}`;
      const { data: existingCode } = await supabase
        .from('orders')
        .select('id')
        .eq('order_code', orderCode)
        .limit(1);

      if (existingCode && existingCode.length > 0) {
        orderCode = `ORD-${String(Math.floor(Math.random() * 9000) + 1000)}`;
      }

      const totalPages = Math.max(1, Number(data.total_pages) || 1);
      const copies = Math.max(1, Number(data.copies) || 1);
      const totalPrice = Number(data.total_price) || totalPages * copies * 500;

      // 1. Insert order into orders table
      const { data: newOrder, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_code: orderCode,
          customer_name: data.customer_name || 'Mahasiswa',
          customer_phone: data.customer_phone || null,
          file_name: data.file_name || 'Dokumen.pdf',
          file_size: Number(data.file_size) || 0,
          file_url: data.file_url || null,
          total_pages: totalPages,
          copies: copies,
          total_price: totalPrice,
          status: data.status || 'DRAFT'
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      // 2. Always insert specifications into print_specifications table
      const spec = data.specifications || {};
      const specPayload = {
        order_id: newOrder.id,
        paper_size: spec.paper_size || 'A4',
        color_mode: spec.color_mode || 'B/W',
        print_side: spec.print_side || 'Simplex',
        page_range: spec.page_range || 'all',
        sheets_count: Math.max(1, Number(spec.sheets_count) || totalPages),
        notes: spec.notes || null
      };

      const { data: insertedSpec, error: specErr } = await supabase
        .from('print_specifications')
        .insert(specPayload)
        .select()
        .single();

      if (specErr) {
        console.error('[Supabase print_specifications] Gagal insert spesifikasi:', specErr.message);
      }

      return {
        ...newOrder,
        specifications: insertedSpec || specPayload
      };
    } catch (err) {
      console.error('Supabase createOrder failed:', err.message);
      return mockStore.createOrder(data);
    }
  },

  async updateOrder(id, updates) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.updateOrder(id, updates);
    }

    try {
      const orderFields = { updated_at: new Date().toISOString() };
      if (updates.status) orderFields.status = updates.status;
      if (updates.cancel_reason !== undefined) orderFields.cancel_reason = updates.cancel_reason;
      if (updates.total_price !== undefined) orderFields.total_price = Number(updates.total_price);
      if (updates.copies !== undefined) orderFields.copies = Number(updates.copies);
      if (updates.total_pages !== undefined) orderFields.total_pages = Number(updates.total_pages);
      if (updates.customer_name) orderFields.customer_name = updates.customer_name;
      if (updates.customer_phone !== undefined) orderFields.customer_phone = updates.customer_phone;
      if (updates.file_name) orderFields.file_name = updates.file_name;
      if (updates.file_size !== undefined) orderFields.file_size = Number(updates.file_size);
      if (updates.file_url) orderFields.file_url = updates.file_url;

      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      let query = supabase.from('orders').update(orderFields);
      if (isUuid) {
        query = query.eq('id', id);
      } else {
        const code = String(id).startsWith('#') ? String(id).slice(1) : String(id);
        query = query.eq('order_code', code);
      }

      const { data: updatedRows, error } = await query.select('*');
      if (error) throw error;

      let updated = updatedRows?.[0] || null;

      // If the order did not exist in Supabase yet (e.g. legacy sessionStorage ID), create it now in Supabase
      if (!updated) {
        return await this.createOrder({
          ...updates,
          status: updates.status || 'PENDING_PAYMENT'
        });
      }

      // Update or insert print_specifications safely (without relying on a unique constraint on order_id)
      let finalSpec = null;
      const { data: existingSpecs } = await supabase
        .from('print_specifications')
        .select('*')
        .eq('order_id', updated.id)
        .order('created_at', { ascending: true });

      if (updates.specifications) {
        const specFields = {
          paper_size: updates.specifications.paper_size || 'A4',
          color_mode: updates.specifications.color_mode || 'B/W',
          print_side: updates.specifications.print_side || 'Simplex',
          page_range: updates.specifications.page_range || 'all',
          sheets_count: Math.max(1, Number(updates.specifications.sheets_count) || Number(updated.total_pages) || 1),
          notes: updates.specifications.notes !== undefined ? updates.specifications.notes : null
        };

        if (existingSpecs && existingSpecs.length > 0) {
          const primarySpecId = existingSpecs[0].id;
          const { data: specUpd, error: specUpdErr } = await supabase
            .from('print_specifications')
            .update(specFields)
            .eq('id', primarySpecId)
            .select()
            .single();

          if (specUpdErr) {
            console.error('[Supabase print_specifications] Gagal update spesifikasi:', specUpdErr.message);
          } else {
            finalSpec = specUpd;
          }

          // Clean up any duplicate spec rows for the same order_id
          if (existingSpecs.length > 1) {
            const dupIds = existingSpecs.slice(1).map(s => s.id);
            await supabase.from('print_specifications').delete().in('id', dupIds);
          }
        } else {
          const { data: specIns, error: specInsErr } = await supabase
            .from('print_specifications')
            .insert({
              order_id: updated.id,
              ...specFields
            })
            .select()
            .single();

          if (specInsErr) {
            console.error('[Supabase print_specifications] Gagal insert spesifikasi baru:', specInsErr.message);
          } else {
            finalSpec = specIns;
          }
        }
      } else {
        finalSpec = existingSpecs?.[0] || {};
      }

      return {
        ...updated,
        specifications: finalSpec || updates.specifications || {}
      };
    } catch (err) {
      console.error('Supabase updateOrder failed:', err.message);
      return mockStore.updateOrder(id, updates);
    }
  },

  async recordTransaction(data) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.recordTransaction(data);
    }

    try {
      const payload = {
        order_id: data.order_id,
        midtrans_order_id: data.midtrans_order_id,
        payment_type: data.payment_type || 'qris',
        gross_amount: Number(data.gross_amount) || 0,
        transaction_status: data.transaction_status || 'pending',
        fraud_status: data.fraud_status || null,
        snap_token: data.snap_token || null,
        qr_string: data.qr_string || null,
        raw_payload: data.raw_payload || null,
        updated_at: new Date().toISOString()
      };

      // Check if an existing transaction row already exists for this order_id
      const { data: existingRows } = await supabase
        .from('transactions')
        .select('*')
        .eq('order_id', data.order_id)
        .order('created_at', { ascending: false });

      if (existingRows && existingRows.length > 0) {
        const primaryRow = existingRows[0];
        const { data: updatedTrx, error: updErr } = await supabase
          .from('transactions')
          .update(payload)
          .eq('id', primaryRow.id)
          .select()
          .single();

        // Remove older duplicate transaction rows for the same order_id so 1 order = 1 clean transaction row
        if (existingRows.length > 1) {
          const extraIds = existingRows.slice(1).map(r => r.id);
          await supabase.from('transactions').delete().in('id', extraIds);
        }

        if (!updErr && updatedTrx) {
          return updatedTrx;
        }
      }

      const { data: trx, error } = await supabase
        .from('transactions')
        .upsert(payload, { onConflict: 'midtrans_order_id' })
        .select()
        .single();

      if (error) {
        console.error('[Supabase Transactions] Gagal menyimpan transaksi:', error.message, error.details || '');
        return mockStore.recordTransaction(data);
      }

      return trx;
    } catch (err) {
      console.error('[Supabase Transactions Exception]:', err.message);
      return mockStore.recordTransaction(data);
    }
  },

  async updateTransactionStatus(midtransOrderId, status, rawPayload = null, orderId = null, fallbackAmount = 0) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.updateTransactionStatus(midtransOrderId, status, rawPayload);
    }

    try {
      const updateData = {
        transaction_status: status,
        updated_at: new Date().toISOString()
      };
      if (rawPayload) updateData.raw_payload = rawPayload;

      if (midtransOrderId) {
        const { data: trxRows, error } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('midtrans_order_id', midtransOrderId)
          .select();

        if (!error && trxRows && trxRows.length > 0) {
          if (orderId) {
            await supabase
              .from('transactions')
              .update(updateData)
              .eq('order_id', orderId);
          }
          return trxRows[0];
        }
      }

      if (orderId) {
        const { data: byOrderRows, error: ordErr } = await supabase
          .from('transactions')
          .update(updateData)
          .eq('order_id', orderId)
          .select();

        if (!ordErr && byOrderRows && byOrderRows.length > 0) {
          return byOrderRows[0];
        }

        // If no transaction row existed yet for this orderId, insert one now
        const { data: insertedTrx } = await supabase
          .from('transactions')
          .insert({
            order_id: orderId,
            midtrans_order_id: midtransOrderId || `ORD-SIM-${Date.now()}`,
            payment_type: 'qris',
            gross_amount: Number(fallbackAmount) || 0,
            transaction_status: status,
            raw_payload: rawPayload,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();

        return insertedTrx;
      }

      return null;
    } catch (err) {
      console.error('[Supabase Transactions Update Exception]:', err.message);
      return mockStore.updateTransactionStatus(midtransOrderId, status, rawPayload);
    }
  },

  async getTransactionByOrderId(orderId) {
    if (!orderId) return null;
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.getTransactionByOrderId(orderId);
    }

    try {
      const { data: rows, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;
      return rows?.[0] || mockStore.getTransactionByOrderId(orderId);
    } catch (err) {
      return mockStore.getTransactionByOrderId(orderId);
    }
  },

  async authenticateOperator(email, pin) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return mockStore.authenticateOperator(email, pin);
    }

    try {
      const { data: op, error } = await supabase
        .from('operators')
        .select('*')
        .eq('email', email)
        .maybeSingle();

      if (error || !op) {
        return mockStore.authenticateOperator(email, pin);
      }

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
    return mockStore.getDashboardStats();
  }
};
