'use client';

import { ArrowMarkIcon } from '@/components/orbit-icons';
import { OrbitDashboard } from '@/components/orbit-dashboard';
import { useEffect, useState, type ReactNode } from 'react';

type Identity = 'core' | 'bloom' | 'haven' | 'atelier' | 'pulse';
type View = 'orbit' | 'widgets';
const IDENTITY_KEY = 'arrow_os_adapt_v1';
const SESSION = 'sb-cnorozrjugxpanpfmssa-auth-token';
const OPTIONS: Identity[] = ['core','bloom','haven','atelier','pulse'];
function identity(): Identity {
  try { const value=localStorage.getItem(IDENTITY_KEY) as Identity; return OPTIONS.includes(value)?value:'core'; }
  catch { return 'core'; }
}
function ownerId(): string {
  try {
    const session=JSON.parse(localStorage.getItem(SESSION)||'null') as { user?: { id?: string }; access_token?: string };
    return session?.access_token && session.user?.id || 'guest';
  } catch { return 'guest'; }
}
function viewKey(owner: string): string { return 'arrow-orbit-adapt-view-v1:'+owner; }
function savedView(owner: string): View {
  try { return localStorage.getItem(viewKey(owner))==='widgets'?'widgets':'orbit'; } catch { return 'orbit'; }
}

export function OrbitAdapt({ children, destinationCount, liveRouteCount }: {
  children: ReactNode; destinationCount: number; liveRouteCount: number;
}) {
  const [theme, setTheme] = useState<Identity>('core');
  const [view, setView] = useState<View>('orbit');
  const [owner, setOwner] = useState('guest');
  useEffect(() => {
    const sync = () => {
      const next=identity();
      setTheme(next);
      document.documentElement.dataset.arrowAdapt=next;
      const user=ownerId();
      setOwner(user);
      setView(savedView(user));
    };
    const themeOnly = () => {
      const next=identity();
      setTheme(next);
      document.documentElement.dataset.arrowAdapt=next;
    };
    sync();
    window.addEventListener('storage',sync);
    window.addEventListener('arrow:adaptchange',themeOnly);
    return () => { window.removeEventListener('storage',sync); window.removeEventListener('arrow:adaptchange',themeOnly); };
  },[]);
  function choose(next: View) {
    setView(next);
    try { localStorage.setItem(viewKey(owner),next); } catch {}
  }
  return (
    <main className="orbit-app" data-orbit-adapt={theme} data-orbit-view={view}>
      <header className="orbit-header">
        <div className="suite-lockup" aria-label="ARROW Orbit">
          <span className="arrow-mark" aria-hidden="true"><ArrowMarkIcon size={18}/></span>
          <span className="suite-name">ARROW</span><span className="suite-divider"/>
          <span className="product-name">Orbit</span>
        </div>
        <div className="orbit-header-right">
          <div className="header-meta" aria-label="Orbit route summary">
            <span>{destinationCount} centers</span><span>{liveRouteCount} available</span>
          </div>
          <div className="adapt-view-switch" role="group" aria-label="Orbit display">
            <button type="button" aria-pressed={view==='orbit'} onClick={()=>choose('orbit')}>Orbit</button>
            <button type="button" aria-pressed={view==='widgets'} onClick={()=>choose('widgets')}>Widgets</button>
          </div>
          <div data-arrow-os-shell data-module="orbit" suppressHydrationWarning/>
        </div>
      </header>
      <section className="orbit-stage" aria-label="Orbit home">
        <div className="adapt-world-layer" aria-hidden={view!=='orbit'} inert={view!=='orbit'}>{children}</div>
        {view==='widgets'&&<section className="adapt-dashboard" aria-label="Orbit widget dashboard"><OrbitDashboard/></section>}
      </section>
    </main>
  );
}
