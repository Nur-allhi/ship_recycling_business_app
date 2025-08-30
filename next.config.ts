
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  
  // Turbopack configuration (moved from experimental.turbo)
  turbopack: {
    // Turbopack-specific configurations
  },
};

// Apply PWA configuration conditionally
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

export default withPWA(nextConfig);
