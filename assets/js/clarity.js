/**
 * PrintShop POS - Microsoft Clarity Integration
 * 
 * Terkonfigurasi dengan Environment Variable:
 * - NEXT_PUBLIC_CLARITY_PROJECT_ID di .env.local
 * - Fallback ID: z66p3x0k2q
 */
(function () {
  var DEFAULT_CLARITY_ID = 'z66p3x0k2q';

  // Siapkan stub function agar panggilan window.clarity(...) selalu aman digunakan
  window.clarity = window.clarity || function () {
    (window.clarity.q = window.clarity.q || []).push(arguments);
  };

  var initialized = false;

  function initClarity(forcedId) {
    if (initialized) return true;

    var clarityId = forcedId || (typeof window !== 'undefined' && (
      window.__ENV_CLARITY_ID ||
      (window.PrintShopConfig && window.PrintShopConfig.clarityId)
    )) || DEFAULT_CLARITY_ID;

    if (!clarityId || clarityId === 'YOUR_CLARITY_PROJECT_ID') {
      return false;
    }

    initialized = true;

    // Skrip snippet resmi Microsoft Clarity
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r);
      t.async = 1;
      t.src = "https://www.clarity.ms/tag/" + i;
      y = l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t, y);
    })(window, document, "clarity", "script", clarityId);

    return true;
  }

  // 1. Eksekusi langsung jika ID default / env window sudah siap
  initClarity();

  // 2. Coba ulang saat DOM selesai dimuat (jika ada script config tambahan)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initClarity();
    });
  }

  // 3. Sinkronkan dengan API route config jika berjalan di lingkungan server Next.js
  if (typeof fetch === 'function') {
    fetch('/api/config')
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (res) {
        var apiId = res && res.data && res.data.clarityId;
        if (apiId) {
          if (window.PrintShopConfig) {
            window.PrintShopConfig.clarityId = apiId;
          }
          initClarity(apiId);
        }
      })
      .catch(function () {
        // Fallback hening jika server API belum menyala / mode static file
      });
  }
})();
