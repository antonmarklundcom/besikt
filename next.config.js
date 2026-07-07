/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // sharp / docxtemplater are server-only native/CJS deps; keep them external.
    serverComponentsExternalPackages: ["sharp", "docxtemplater", "pizzip"],
  },
};

module.exports = nextConfig;
