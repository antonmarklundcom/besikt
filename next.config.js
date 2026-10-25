/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // sharp / docxtemplater are server-only native/CJS deps; keep them external.
  serverExternalPackages: [
    "sharp",
    "docxtemplater",
    "pizzip",
    "docxtemplater-image-module-free",
  ],
};

module.exports = nextConfig;
