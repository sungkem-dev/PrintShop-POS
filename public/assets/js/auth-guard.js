/**
 * PrintShop POS — Authentication Guard (Immediate Execution)
 * This script MUST be loaded FIRST in <head> on protected operator/admin pages.
 * It synchronously verifies operator authentication before DOM renders.
 * 
 * Strictly Protected pages: dasbor.html, antrean.html, order-manual.html
 * Public pages (Open for everyone): index.html, login.html, register.html, tiket.html, unggah.html, spesifikasi.html, pembayaran.html
 */

;(function () {
  'use strict';

  // Session key constants
  var SESSION_KEY = 'printshop_operator';
  var SESSION_TOKEN_KEY = 'printshop_auth_token';
  var SESSION_EXPIRY_KEY = 'printshop_session_expiry';
  var SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

  // Current page detection (handles clean paths e.g. /dasbor as well as /dasbor.html)
  var pathname = window.location.pathname.toLowerCase();
  var pathSegments = pathname.split('/').filter(Boolean);
  var rawPage = pathSegments.pop() || 'index.html';
  var currentPage = rawPage.endsWith('.html') ? rawPage : rawPage + '.html';

  // Check if current page is strictly protected (dasbor, antrean, order-manual)
  var isProtected = (
    currentPage === 'dasbor.html' ||
    currentPage === 'antrean.html' ||
    currentPage === 'order-manual.html' ||
    pathname.indexOf('/dasbor') !== -1 ||
    pathname.indexOf('/antrean') !== -1 ||
    pathname.indexOf('/order-manual') !== -1
  );

  // If NOT a protected page (e.g. login.html, register.html, index.html), allow open access
  if (!isProtected) {
    window.__PrintShopAuth = {
      getSession: function () {
        try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
      },
      getToken: function () {
        return localStorage.getItem(SESSION_TOKEN_KEY);
      },
      isAdmin: function () {
        var s = this.getSession();
        return s && s.role === 'admin';
      },
      logout: function () {
        try {
          localStorage.removeItem(SESSION_KEY);
          localStorage.removeItem(SESSION_TOKEN_KEY);
          localStorage.removeItem(SESSION_EXPIRY_KEY);
        } catch (e) {}
        window.location.replace('login.html');
      }
    };
    return;
  }

  // If PROTECTED PAGE: Check for active, valid, unexpired session in localStorage
  var operatorRaw = null;
  var authToken = null;
  var sessionExpiry = null;

  try {
    operatorRaw = localStorage.getItem(SESSION_KEY);
    authToken = localStorage.getItem(SESSION_TOKEN_KEY);
    sessionExpiry = localStorage.getItem(SESSION_EXPIRY_KEY);
  } catch (e) {
    // localStorage unavailable
  }

  var isAuthenticated = false;
  var currentOperator = null;

  if (operatorRaw) {
    try {
      currentOperator = JSON.parse(operatorRaw);
      var expiry = Number(sessionExpiry) || 0;
      var now = Date.now();

      // Must have valid operator object with an id and token
      if (currentOperator && currentOperator.id) {
        if (!sessionExpiry || expiry > now) {
          isAuthenticated = true;
          // Refresh expiry if missing
          if (!sessionExpiry) {
            try { localStorage.setItem(SESSION_EXPIRY_KEY, String(now + SESSION_DURATION_MS)); } catch (e) {}
          }
          if (!authToken) {
            try { localStorage.setItem(SESSION_TOKEN_KEY, 'auth_' + Date.now()); } catch (e) {}
          }
        }
      }
    } catch (e) {
      isAuthenticated = false;
    }
  }

  // Not authenticated on a protected page -> Redirect to login immediately!
  if (!isAuthenticated) {
    // Prevent flash of protected UI
    if (document.documentElement) {
      document.documentElement.style.display = 'none';
    }

    // Clean up any invalid keys
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_TOKEN_KEY);
      localStorage.removeItem(SESSION_EXPIRY_KEY);
    } catch (e) {}

    // Immediate redirect to login
    window.location.replace('login.html');
    return;
  }

  // Helper on protected pages
  window.__PrintShopAuth = {
    getSession: function () {
      try {
        return JSON.parse(localStorage.getItem(SESSION_KEY));
      } catch (e) {
        return null;
      }
    },
    getToken: function () {
      return localStorage.getItem(SESSION_TOKEN_KEY);
    },
    isAdmin: function () {
      var s = this.getSession();
      return s && s.role === 'admin';
    },
    logout: function () {
      try {
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_TOKEN_KEY);
        localStorage.removeItem(SESSION_EXPIRY_KEY);
      } catch (e) {}
      window.location.replace('login.html');
    },
    extendSession: function () {
      try {
        localStorage.setItem(SESSION_EXPIRY_KEY, String(Date.now() + SESSION_DURATION_MS));
      } catch (e) {}
    }
  };
})();
