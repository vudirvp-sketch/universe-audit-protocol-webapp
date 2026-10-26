import type { NextConfig } from 'next';

// GitHub Pages serves a project site under /<repo>/, so the export must emit
// asset URLs with that prefix or every /_next/... request 404s. Local builds
// leave the variable unset and stay at the root, which is what the relay serves.
const basePath = (process.env.NEXT_BASE_PATH ?? '').replace(/\/$/, '');

const nextConfig: NextConfig = {
  basePath,
  reactStrictMode: true,
  output: 'export',
  images: {
    unoptimized: true, // Required for static export
  },
};

export default nextConfig;
