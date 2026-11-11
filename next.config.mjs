/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // 100 MiB на файл плюс запас для multipart/form-data.
    proxyClientMaxBodySize: '110mb',
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  serverExternalPackages: ['playwright'],
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/static/uploads/:path*',
      },
    ]
  },
}

export default nextConfig
