/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/', destination: '/index.html' },
      { source: '/unggah', destination: '/unggah.html' },
      { source: '/spesifikasi', destination: '/spesifikasi.html' },
      { source: '/pembayaran', destination: '/pembayaran.html' },
      { source: '/tiket', destination: '/tiket.html' },
      { source: '/login', destination: '/login.html' },
      { source: '/dasbor', destination: '/dasbor.html' },
      { source: '/antrean', destination: '/antrean.html' }
    ];
  }
};

export default nextConfig;
