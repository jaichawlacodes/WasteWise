/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    eslint: {
        ignoreDuringBuilds: true,
    },
    env:{
        WEB3_AUTH_CLIENT_ID : process.env.WEB3_AUTH_CLIENT_ID,
    }
};

export default nextConfig;
