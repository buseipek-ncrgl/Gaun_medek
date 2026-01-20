/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Image optimization
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
  },
  // Webpack cache sorunlarını önlemek için
  webpack: (config, { isServer }) => {
    // Cache ayarlarını optimize et
    if (!isServer) {
      config.cache = {
        type: 'filesystem',
        buildDependencies: {
          config: [__filename],
        },
      };
    }
    return config;
  },
  // Experimental: Cache sorunlarını azalt
  experimental: {
    webpackBuildWorker: true,
  },
};

module.exports = nextConfig;

