import type { NextConfig } from 'next';

const isGitHubPages = process.env.NEXT_PUBLIC_ORBIT_DEPLOY_TARGET === 'github-pages';
const configuredBasePath = (process.env.NEXT_PUBLIC_ORBIT_BASE_PATH || '').trim();
const normalizeBasePath = (value: string) => {
  if (!value || value === '/') return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
};
const basePath = configuredBasePath
  ? normalizeBasePath(configuredBasePath)
  : isGitHubPages
    ? '/Resonant-Orbit'
    : '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
