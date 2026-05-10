import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true
  },
  transpilePackages: [
    "@stacks/auth",
    "@stacks/common",
    "@stacks/connect",
    "@stacks/network",
    "@stacks/storage",
    "@stacks/transactions"
  ],
  turbopack: {
    // Pin the workspace root to this package so Next.js doesn't walk up
    // to the monorepo root and get confused by multiple lockfiles.
    root: __dirname,
  },
};

export default nextConfig;


