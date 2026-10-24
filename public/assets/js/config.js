/**
 * PrintShop POS - Global Client Configuration
 */
const PrintShopConfig = {
  apiBase: '/api',
  supabase: {
    url: typeof window !== 'undefined' && window.__ENV_SUPABASE_URL
      ? window.__ENV_SUPABASE_URL
      : 'https://your-project-id.supabase.co',
    anonKey: typeof window !== 'undefined' && window.__ENV_SUPABASE_ANON_KEY
      ? window.__ENV_SUPABASE_ANON_KEY
      : 'placeholder'
  },
  midtrans: {
    clientKey: typeof window !== 'undefined' && window.__ENV_MIDTRANS_CLIENT_KEY
      ? window.__ENV_MIDTRANS_CLIENT_KEY
      : 'SB-Mid-client-sandbox-demo-key',
    isProduction: false
  }
};

if (typeof window !== 'undefined') {
  window.PrintShopConfig = PrintShopConfig;
}
