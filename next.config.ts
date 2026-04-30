import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true, // Required for static export
  },
  // Turbopack needs explicit root to resolve next/package.json
  turbopack: {
    root: '..',
  },
};

export default nextConfig;
