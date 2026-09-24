import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

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

const arrowShellBase =
  process.env.NEXT_PUBLIC_ORBIT_DEPLOY_TARGET === 'github-pages'
    ? '/Resonant-Orbit'
    : '';

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href={`${arrowShellBase}/arrow-shell.css?v=20260924-71`} />
      </head>
      <body>
        {children}
        <Script
          src={`${arrowShellBase}/arrow-shell.js?v=20260924-71`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
