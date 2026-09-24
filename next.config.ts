import type { NextConfig } from 'next';

const isGitHubPages = process.env.NEXT_PUBLIC_ORBIT_DEPLOY_TARGET === 'github-pages';
const basePath = isGitHubPages ? '/Resonant-Orbit' : '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
