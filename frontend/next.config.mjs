/** @type {import('next').NextConfig} */
const backendInternalUrl = process.env.BACKEND_INTERNAL_URL || 'http://localhost:8000';

const nextConfig = {
  experimental: {
    typedRoutes: false
  },
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${backendInternalUrl}/:path*`
      }
    ];
  }
};

export default nextConfig;
