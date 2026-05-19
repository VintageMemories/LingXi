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
                    destination: 'http://127.0.0.1:8000/api/chat',
                },
                {
                    source: '/api/domains',
                    destination: 'http://127.0.0.1:8000/api/domains',
                },
                {
                    source: '/api/health',
                    destination: 'http://127.0.0.1:8000/api/health',
                },
            ],
        };
    },
};

export default nextConfig;