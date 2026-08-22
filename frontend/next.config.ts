import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  reactStrictMode: true,
  // SDK v16 uses ESM-only exports — Next.js needs to transpile it
  transpilePackages: ["@stellar/stellar-sdk", "@stellar/stellar-base"],
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "sodium-native": false,
        "require-addon": false,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
      };
    }
    return config;
  },
};

export default nextConfig;
