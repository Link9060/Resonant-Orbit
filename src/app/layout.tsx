import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';
import './entertainment.css';
import './orbit-refinement.css';

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

const arrowShellBase = process.env.NEXT_PUBLIC_ARROW_SHELL_BASE || (configuredBasePath
  ? normalizeBasePath(configuredBasePath)
  : process.env.NEXT_PUBLIC_ORBIT_DEPLOY_TARGET === 'github-pages'
    ? '/Resonant-Orbit'
    : '');

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`(()=>{try{const c=localStorage.getItem('arrow_os_theme_v1')||'system';const t=c==='system'?(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):c;if(t==='light'||t==='dark'){document.documentElement.dataset.arrowTheme=t;document.documentElement.dataset.theme=t;document.documentElement.classList.toggle('dark',t==='dark');document.documentElement.style.colorScheme=t;}}catch{}})();`}}/>
        <link rel="stylesheet" href={`${arrowShellBase}/arrow-shell.css?v=review-20261006`} />
      </head>
      <body>
        {!arrowShellBase.startsWith("/Resonant-Relay/arrow") && <Script src="/arrow-auth-guard.js?v=auth-v2" strategy="beforeInteractive" />}
        {children}
        <Script
          src={`${arrowShellBase}/arrow-shell.js?v=review-20261006`}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
