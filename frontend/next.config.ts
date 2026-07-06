import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // sodium-native and require-addon are Node.js-only native modules.
      // Tell webpack to ignore them on the client bundle.
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
