import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    // Allow an isolated build directory for development smoke tests.
    distDir: process.env.NEXT_DIST_DIR || ".next",
    experimental: {
        // proxy.ts runs on every request, and Next only buffers the first 10 MB
        // of a request body by default. A scan upload (5-10 phone photos) can be
        // larger, and anything over the limit is silently truncated.
        proxyClientMaxBodySize: "300mb",
    },
};

export default nextConfig;
