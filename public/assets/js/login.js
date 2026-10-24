/**
 * PrintShop POS — Operator Authentication Flow
 * File: assets/js/login.js
 */

;(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('form-login');
    const emailInput = document.getElementById('email-operator');
    const pinInput = document.getElementById('pin-operator');
    const btnTogglePin = document.getElementById('btn-toggle-pin');
    const eyeIcon = document.getElementById('eye-icon');
    const submitBtn = form ? form.querySelector('button[type="submit"]') : null;

    // Toggle PIN visibility
    if (btnTogglePin && pinInput) {
      btnTogglePin.addEventListener('click', function () {
        const isPassword = pinInput.type === 'password';
        pinInput.type = isPassword ? 'text' : 'password';
        btnTogglePin.setAttribute('aria-label', isPassword ? 'Sembunyikan PIN' : 'Tampilkan PIN');
        if (eyeIcon) {
          eyeIcon.innerHTML = isPassword
            ? '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
            : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
      });
    }

    // Submit handler
    if (form) {
      form.addEventListener('submit', async function (e) {
        e.preventDefault();

        const email = emailInput ? emailInput.value.trim() : '';
        const pin = pinInput ? pinInput.value.trim() : '';

        if (!email || !pin || pin.length < 6) {
          alert('Harap masukkan email dan PIN 6-digit dengan lengkap.');
          if (pinInput) pinInput.focus();
          return;
        }

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = 'Memverifikasi...';
        }

        try {
          if (window.PrintShopAPI) {
            const res = await window.PrintShopAPI.loginOperator(email, pin);
            if (res && res.success) {
              window.location.href = 'dasbor.html';
              return;
            }
          }
          // Default fallback
          if (pin === '123456') {
            localStorage.setItem('printshop_operator', JSON.stringify({
              name: 'Ahmad Hidayat',
              email: email,
              role: 'Kasir Loket A1'
            }));
            window.location.href = 'dasbor.html';
            return;
          }
          alert('PIN salah atau tidak terdaftar. Coba PIN default: 123456');
        } catch (err) {
          alert(err.message || 'Login gagal. Periksa kembali email dan PIN.');
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Masuk ke Konsol Operator';
          }
        }
      });
    }
  });
})();
