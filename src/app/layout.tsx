import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import './entertainment.css';

export const metadata: Metadata = {
  title: 'Orbit · ARROW',
  description: 'The central navigation world for the ARROW suite.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#050505',
};

const configuredBasePath = (process.env.NEXT_PUBLIC_ORBIT_BASE_PATH || '').trim();
const normalizeBasePath = (value: string) => {
  if (!value || value === '/') return '';
  return `/${value.replace(/^\/+|\/+$/g, '')}`;
};

const arrowShellBase = configuredBasePath
  ? normalizeBasePath(configuredBasePath)
  : process.env.NEXT_PUBLIC_ORBIT_DEPLOY_TARGET === 'github-pages'
    ? '/Resonant-Orbit'
    : '';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href={`/arrow-shell.css?v=20261001`} />
      </head>
      <body>
        <Script src="/arrow-auth-guard.js?v=auth-v2" strategy="beforeInteractive" />
        {children}
        <Script
          src={`/arrow-shell.js?v=20261001`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
