import type { NextConfig } from "next";

// Only optimise images served from this project's Supabase Storage (product uploads).
// An open `hostname: '**'` would let anyone use the image optimiser as a proxy for any site.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : undefined;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }]
      : [],
  },
};

export default nextConfig;
