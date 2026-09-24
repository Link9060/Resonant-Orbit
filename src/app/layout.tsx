import type { Metadata, Viewport } from 'next';
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/Resonant-Orbit/arrow-shell.css?v=20260924-50" />
        <script defer src="/Resonant-Orbit/arrow-shell.js?v=20260924-50" />
      </head>
      <body>{children}</body>
    </html>
  );
}
