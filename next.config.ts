import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/iol/:path*",
        destination: "https://api.invertironline.com/:path*",
      },
      {
        source: "/api/yahoo/:path*",
        destination: "https://query1.finance.yahoo.com/:path*",
      },
    ];
  },
};

export default nextConfig;
