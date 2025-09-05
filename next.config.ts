import type {NextConfig} from 'next';

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: false, // Ensure PWA is enabled in all environments
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withPWA(nextConfig);
