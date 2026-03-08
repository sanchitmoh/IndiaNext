import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // React strict mode for catching bugs early
  reactStrictMode: true,

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
    ],
  },

  // Enable gzip/brotli compression
  compress: true,

  // Production optimizations
  poweredByHeader: false,
};

export default nextConfig;
