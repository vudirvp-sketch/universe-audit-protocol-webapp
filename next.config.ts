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
  // Dev-only Next.js Dev Tools badge: an English framework widget pinned to the
  // bottom-right corner (fixed right:20px; bottom:20px), where it overlaps the
  // report's «К последнему тексту» control and looks like part of the product.
  // The app has its own UI and no use for it; a production export never contains
  // the indicator. Compile/runtime errors are still surfaced by Next.js.
  devIndicators: false,
  // The dev server blocks its own resources for 127.0.0.1 unless that origin is
  // allowed, and shows an English "Blocked cross-origin request" toast. Accept
  // both local hostnames so the dev overlay stays quiet.
  allowedDevOrigins: ['localhost', '127.0.0.1'],
};

export default nextConfig;
