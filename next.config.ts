import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    typescript: {
        ignoreBuildErrors: false,
    },
    reactStrictMode: true,
    async rewrites() {
        return {
            beforeFiles: [
                {
                    source: '/api/sessions/:path*',
                    destination: '/api/sessions/:path*',
                },
            ],
            fallback: [
                {
                    source: '/api/chat',
                    destination: 'http://localhost:8000/api/chat',
                },
            ],
        };
    },
};

export default nextConfig;