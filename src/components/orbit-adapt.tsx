'use client';

import { ArrowMarkIcon } from '@/components/orbit-icons';
import { OrbitDashboard } from '@/components/orbit-dashboard';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

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
  const [selectedView, setSelectedView] = useState<View | 'staff'>('orbit');
  const [staffVisible,setStaffVisible] = useState(false);
  const [transition, setTransition] = useState<'idle'|'switching-to-dashboard'|'dashboard-enter'|'dashboard-exit'|'switching-to-orbit'|'switching-to-staff'>('idle');
  const timers = useRef<number[]>([]);
  const stageRef = useRef<HTMLElement>(null);
  const dashboardButtonRef = useRef<HTMLButtonElement>(null);
  const staffButtonRef = useRef<HTMLButtonElement>(null);
  const [origin, setOrigin] = useState({ x:'calc(100% - 173px)', y:'137px' });
  useEffect(() => {
    const sync = () => {
      const next=identity();
      setTheme(next);
      document.documentElement.dataset.arrowAdapt=next;
      const user=ownerId();
      setOwner(user);
      const remembered = savedView(user);
      setView(remembered);
      setSelectedView(remembered);
      setTransition('idle');
    };
    const themeOnly = (event: Event) => {
      const announced = (event as CustomEvent<{identity?: Identity}>).detail?.identity;
      const next=announced && OPTIONS.includes(announced) ? announced : identity();
      setTheme(next);
      if (document.documentElement.dataset.arrowAdapt !== next) document.documentElement.dataset.arrowAdapt=next;
    };
    sync();
    window.addEventListener('storage',sync);
    window.addEventListener('arrow:adaptchange',themeOnly);
    return () => { window.removeEventListener('storage',sync); window.removeEventListener('arrow:adaptchange',themeOnly); timers.current.forEach(window.clearTimeout); };
  },[]);
  useEffect(() => {
    let active=true;
    const timers:number[]=[];
    const discover=async(attempt=0)=>{
      const api=(window as Window & {ArrowOS?:{staffRole?:()=>Promise<string>}}).ArrowOS;
      if(!api?.staffRole){
        if(attempt<16)timers.push(window.setTimeout(()=>void discover(attempt+1),300));
        return;
      }
      try{
        const role=await api.staffRole();
        if(active)setStaffVisible(['owner','admin','moderator'].includes(role));
      }catch{if(active)setStaffVisible(false);}
    };
    void discover();
    const refresh=()=>void discover();
    window.addEventListener('focus',refresh);
    window.addEventListener('relay-role-preview-change',refresh);
    return()=>{active=false;timers.forEach(window.clearTimeout);window.removeEventListener('focus',refresh);window.removeEventListener('relay-role-preview-change',refresh);};
  },[]);
  function choose(next: View | 'staff') {
    if (transition !== 'idle' || view === next) return;
    if(next==='staff'){
      if(!staffVisible)return;
      setSelectedView('staff');setTransition('switching-to-staff');
      const api=(window as Window & {ArrowOS?:{resolveHref?:(s:string)=>string}}).ArrowOS;
      const href=api?.resolveHref?.('/orbit/staff/')||
        (location.pathname.startsWith('/Resonant-Relay/')?'/Resonant-Relay/arrow/orbit/staff/':'/staff/');
      const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||
        document.documentElement.dataset.arrowMotion==='reduce';
      window.setTimeout(()=>location.assign(href),reduced?0:460);
      return;
    }
    const button = dashboardButtonRef.current?.getBoundingClientRect();
    const stage = stageRef.current?.getBoundingClientRect();
    if (button && stage) setOrigin({
      x:(button.left + button.width/2 - stage.left) + 'px',
      y:(button.top + button.height/2 - stage.top) + 'px',
    });
    try { localStorage.setItem(viewKey(owner),next); } catch {}
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      document.documentElement.dataset.arrowMotion === 'reduce';
    if (reduced) { setView(next); setSelectedView(next); return; }
    const schedule = (ms: number, fn: () => void) => {
      timers.current.push(window.setTimeout(fn, ms));
    };
    if (next === 'widgets') {
      // The selector travels first; the dashboard opens from its final location.
      setSelectedView('widgets');
      setTransition('switching-to-dashboard');
      schedule(235, () => {
        setView('widgets');
        setTransition('dashboard-enter');
        schedule(490, () => setTransition('idle'));
      });
    } else {
      // Reverse the choreography: fold the dashboard away, then slide to Orbit.
      setTransition('dashboard-exit');
      schedule(420, () => {
        setView('orbit');
        setSelectedView('orbit');
        setTransition('switching-to-orbit');
        schedule(235, () => setTransition('idle'));
      });
    }
  }
  return (
    <main className="orbit-app" data-orbit-adapt={theme} data-orbit-view={view} data-orbit-selection={selectedView === 'widgets' ? 'dashboard' : selectedView === 'staff' ? 'staff' : 'orbit'} data-staff-visible={staffVisible ? 'true' : 'false'} data-orbit-transition={transition} style={{ '--orbit-dashboard-origin-x':origin.x, '--orbit-dashboard-origin-y':origin.y } as CSSProperties}>
      <header className="orbit-header">
        <div className="suite-lockup" aria-label="ARROW Orbit">
          <span className="arrow-mark" aria-hidden="true"><ArrowMarkIcon size={18}/></span>
          <span className="suite-name">ARROW</span><span className="suite-divider"/>
          <span className="product-name">Orbit</span>
        </div>
        <div className="orbit-header-right">
          <div className="header-meta" aria-label="Orbit route summary">
            {theme!=='core' && <span className="orbit-identity-label" aria-label={'Current ARROW identity: '+theme}>{theme}</span>}
            <span>{destinationCount} centers</span><span>{liveRouteCount} available</span>
          </div>
          <div className="adapt-view-switch" role="group" aria-label="Orbit display">
            {staffVisible && <button ref={staffButtonRef} type="button" aria-pressed={selectedView==='staff'} aria-disabled={transition!=='idle'} onClick={()=>choose('staff')}>Staff</button>}
            <button type="button" aria-pressed={selectedView==='orbit'} aria-disabled={transition!=='idle'} onClick={()=>choose('orbit')}>Orbit</button>
            <button ref={dashboardButtonRef} type="button" aria-pressed={selectedView==='widgets'} aria-disabled={transition!=='idle'} onClick={()=>choose('widgets')}>Dashboard</button>
          </div>
          <div data-arrow-os-shell data-module="orbit" suppressHydrationWarning/>
        </div>
      </header>
      <section ref={stageRef} className="orbit-stage" aria-label="Orbit home">
        <div className="adapt-world-layer" aria-hidden={view!=='orbit'} inert={view!=='orbit'}>{children}</div>
        {view==='widgets'&&<section className="adapt-dashboard" aria-label="Orbit dashboard"><OrbitDashboard/></section>}
      </section>
    </main>
  );
}
