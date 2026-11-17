import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    // Allow an isolated build directory for development smoke tests.
    distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
