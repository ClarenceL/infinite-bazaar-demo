/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
      },
    ],
    dangerouslyAllowSVG: true,
  },
  // Disable built-in ESLint during builds as we're using Biome instead
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Redirect /account-settings to Clerk account portal
  async redirects() {
    return [
      {
        source: "/account-settings/:path*",
        destination: process.env.NEXT_PUBLIC_CLERK_ACCOUNT_PORTAL || "https://accounts.clerk.dev",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
