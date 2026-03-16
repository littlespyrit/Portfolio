import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: 'export',
    distDir: 'out',
    transpilePackages: ['phaser'],
};

export default nextConfig;