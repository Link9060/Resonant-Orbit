import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Orbit · ARROW',
  description: 'The central navigation world for the ARROW suite.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
