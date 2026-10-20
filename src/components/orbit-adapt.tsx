'use client';

import { ArrowMarkIcon } from '@/components/orbit-icons';
import { useEffect, useState, type ReactNode } from 'react';

type Identity = 'core' | 'bloom' | 'haven' | 'atelier' | 'pulse';
type View = 'orbit' | 'widgets';
type WidgetId = 'overview' | 'tasks' | 'calendar' | 'chats' | 'quicklinks' | 'focus' | 'quicknote' | 'askravin';
type Size = 'small' | 'medium' | 'wide';
type Widget = { id: WidgetId; visible: boolean; size: Size };

const ADAPT_KEY = 'arrow_os_adapt_v1';
const LEGACY_LAYOUT_KEY = 'relay-dashboard-layout-v1';
const AUTH_KEY = 'sb-cnorozrjugxpanpfmssa-auth-token';
const IDENTITIES: Identity[] = ['core', 'bloom', 'haven', 'atelier', 'pulse'];
const WIDGETS: { id: WidgetId; label: string; description: string }[] = [
  { id: 'overview', label: 'My day', description: 'Jump into your plans and direction' },
  { id: 'tasks', label: 'Tasks', description: 'Open your shared ARROW tasks' },
  { id: 'calendar', label: 'Calendar', description: 'Check upcoming events' },
  { id: 'chats', label: 'Messages', description: 'Open conversations in Relay' },
  { id: 'quicklinks', label: 'Quick links', description: 'Your links across ARROW' },
  { id: 'focus', label: 'Focus', description: 'Open your focus timer' },
  { id: 'quicknote', label: 'Quick note', description: 'Capture something in ARROW' },
  { id: 'askravin', label: 'Ask RAVIN', description: 'Open the AI assistant' },
];
const DEFAULT: Widget[] = WIDGETS.map((item, index) => ({
  id: item.id, visible: index < 5, size: item.id === 'overview' ? 'wide' : 'medium',
}));

function identityFrom(value: string | null): Identity {
  return IDENTITIES.includes(value as Identity) ? value as Identity : 'core';
}
function readIdentity(): Identity {
  try { return identityFrom(localStorage.getItem(ADAPT_KEY)); } catch { return 'core'; }
}
function ownerId(): string {
  try {
    const session = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
    return typeof session?.user?.id === 'string' ? session.user.id : 'guest';
  } catch { return 'guest'; }
}
function keyFor(owner: string, kind: 'view' | 'layout'): string {
  return 'arrow-orbit-adapt-' + kind + '-v1:' + owner;
}
function normalizeLayout(value: unknown): Widget[] {
  if (!Array.isArray(value)) return DEFAULT.map((item) => ({ ...item }));
  const result: Widget[] = [];
  const seen = new Set<WidgetId>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Partial<Widget>;
    if (!WIDGETS.some((entry) => entry.id === item.id) || seen.has(item.id as WidgetId)) continue;
    const id = item.id as WidgetId;
    seen.add(id);
    result.push({ id, visible: item.visible !== false, size: ['small', 'medium', 'wide'].includes(item.size || '') ? item.size as Size : 'medium' });
  }
  for (const item of DEFAULT) if (!seen.has(item.id)) result.push({ ...item });
  return result;
}
function readLayout(owner: string): Widget[] {
  try { return normalizeLayout(JSON.parse(localStorage.getItem(keyFor(owner, 'layout')) || 'null')); }
  catch { return normalizeLayout(null); }
}
function readView(owner: string): View {
  try { return localStorage.getItem(keyFor(owner, 'view')) === 'widgets' ? 'widgets' : 'orbit'; }
  catch { return 'orbit'; }
}
function readLegacyLayout(): Widget[] | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(LEGACY_LAYOUT_KEY) || 'null');
    if (!Array.isArray(parsed)) return null;
    const mapped = parsed
      .filter((item): item is { id: string; visible?: boolean; cols?: number } => Boolean(item && typeof item.id === 'string'))
      .filter((item) => WIDGETS.some((widget) => widget.id === item.id))
      .map((item) => ({
        id: item.id as WidgetId,
        visible: item.visible !== false,
        size: item.cols && item.cols >= 8 ? 'wide' as Size : item.cols && item.cols <= 4 ? 'small' as Size : 'medium' as Size,
      }));
    return mapped.length ? normalizeLayout(mapped) : null;
  } catch { return null; }
}
type Shell = {
  openPanel?: (name: string, module?: string) => void;
  resolveHref?: (href: string) => string;
};
function openWidget(id: WidgetId) {
  const shell = (window as Window & { ArrowOS?: Shell }).ArrowOS;
  const panel = { tasks: 'tasks', calendar: 'calendar', quicklinks: 'links', focus: 'focus', quicknote: 'notes' } as Partial<Record<WidgetId, string>>;
  if (panel[id] && shell?.openPanel) { shell.openPanel(panel[id], 'orbit'); return; }
  const dest = id === 'chats' ? '/relay/chats/' : id === 'askravin' ? '/ravin/' : '/waypoint/';
  const beta = location.pathname.startsWith('/Resonant-Relay/');
  const fallback = beta ? id === 'chats' ? '/Resonant-Relay/chats/' : '/Resonant-Relay/arrow' + dest : dest;
  location.assign(shell?.resolveHref?.(dest) || fallback);
}

export function OrbitAdapt({ children, destinationCount, liveRouteCount }: {
  children: ReactNode;
  destinationCount: number;
  liveRouteCount: number;
}) {
  const [identity, setIdentity] = useState<Identity>('core');
  const [owner, setOwner] = useState('guest');
  const [view, setView] = useState<View>('orbit');
  const [layout, setLayout] = useState<Widget[]>(DEFAULT);
  const [editing, setEditing] = useState(false);
  const [importMessage, setImportMessage] = useState('');

  useEffect(() => {
    const sync = () => {
      const nextIdentity = readIdentity();
      setIdentity(nextIdentity);
      document.documentElement.dataset.arrowAdapt = nextIdentity;
      const nextOwner = ownerId();
      setOwner(nextOwner);
      setView(readView(nextOwner));
      setLayout(readLayout(nextOwner));
    };
    const syncIdentity = () => {
      const next = readIdentity();
      setIdentity(next);
      document.documentElement.dataset.arrowAdapt = next;
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('arrow:adaptchange', syncIdentity);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('arrow:adaptchange', syncIdentity);
    };
  }, []);

  function chooseView(next: View) {
    setView(next);
    setEditing(false);
    try { localStorage.setItem(keyFor(owner, 'view'), next); } catch { /* The view still works this session. */ }
  }
  function save(next: Widget[]) {
    const normalized = normalizeLayout(next);
    setLayout(normalized);
    try { localStorage.setItem(keyFor(owner, 'layout'), JSON.stringify(normalized)); } catch { /* The layout remains usable in memory. */ }
  }
  function move(id: WidgetId, amount: number) {
    const next = layout.map((widget) => ({ ...widget }));
    const index = next.findIndex((widget) => widget.id === id);
    const dest = index + amount;
    if (index < 0 || dest < 0 || dest >= next.length) return;
    [next[index], next[dest]] = [next[dest], next[index]];
    save(next);
  }
  function update(id: WidgetId, patch: Partial<Widget>) {
    save(layout.map((widget) => widget.id === id ? { ...widget, ...patch } : widget));
  }
  function importRelay() {
    const legacy = readLegacyLayout();
    if (!legacy) { setImportMessage('No compatible Relay widget layout was found on this device.'); return; }
    save(legacy);
    setImportMessage('Compatible layout choices imported. Other Relay widgets remain available in Relay during migration.');
  }

  return (
    <main className="orbit-app" data-orbit-adapt={identity} data-orbit-view={view}>
      <header className="orbit-header">
        <div className="suite-lockup" aria-label="ARROW Orbit">
          <span className="arrow-mark" aria-hidden="true"><ArrowMarkIcon size={18} /></span>
          <span className="suite-name">ARROW</span>
          <span className="suite-divider" />
          <span className="product-name">Orbit</span>
        </div>
        <div className="orbit-header-right">
          <div className="header-meta" aria-label="Orbit route summary">
            <span>{destinationCount} centers</span>
            <span>{liveRouteCount} available</span>
          </div>
          <div className="adapt-view-switch" role="group" aria-label="Orbit display">
            <button type="button" aria-pressed={view === 'orbit'} onClick={() => chooseView('orbit')}>Orbit</button>
            <button type="button" aria-pressed={view === 'widgets'} onClick={() => chooseView('widgets')}>Widgets</button>
          </div>
          <div data-arrow-os-shell data-module="orbit" suppressHydrationWarning />
        </div>
      </header>
      <section className="orbit-stage" aria-label="Orbit home">
        <div className="adapt-world-layer" aria-hidden={view !== 'orbit'} inert={view !== 'orbit'}>
          {children}
        </div>
        {view === 'widgets' && (
          <section className="adapt-dashboard" aria-label="Orbit widget dashboard">
            <div className="adapt-dashboard-inner">
              <div className="adapt-dashboard-heading">
                <div><span className="adapt-eyebrow">YOUR SPACE · {identity.toUpperCase()}</span><h1>Dashboard</h1><p>Everything important, in one place.</p></div>
                <button className="adapt-edit-button" type="button" aria-pressed={editing} onClick={() => setEditing((current) => !current)}>{editing ? 'Done editing' : 'Customize'}</button>
              </div>
              <div className="adapt-widget-grid">
                {layout.filter((widget) => widget.visible).map((widget) => {
                  const meta = WIDGETS.find((item) => item.id === widget.id)!;
                  return (
                    <article className={'adapt-widget adapt-widget-' + widget.size} key={widget.id}>
                      <div className="adapt-widget-top"><span>{meta.label}</span><span aria-hidden="true">✦</span></div>
                      <p>{meta.description}</p>
                      {editing ? (
                        <div className="adapt-widget-tools">
                          <button type="button" aria-label={'Move ' + meta.label + ' left'} onClick={() => move(widget.id, -1)}>←</button>
                          <button type="button" aria-label={'Move ' + meta.label + ' right'} onClick={() => move(widget.id, 1)}>→</button>
                          <select value={widget.size} aria-label={meta.label + ' widget size'} onChange={(event) => update(widget.id, { size: event.target.value as Size })}>
                            <option value="small">Small</option><option value="medium">Medium</option><option value="wide">Wide</option>
                          </select>
                          <button type="button" onClick={() => update(widget.id, { visible: false })}>Hide</button>
                        </div>
                      ) : <button className="adapt-widget-open" type="button" onClick={() => openWidget(widget.id)}>Open <span aria-hidden="true">↗</span></button>}
                    </article>
                  );
                })}
              </div>
              {editing && (
                <section className="adapt-widget-library" aria-label="Add and remove widgets">
                  <div className="adapt-widget-library-title"><h2>Widget library</h2><button type="button" onClick={() => save(DEFAULT)}>Reset layout</button></div>
                  <div className="adapt-widget-library-items">
                    {layout.map((widget) => {
                      const meta = WIDGETS.find((item) => item.id === widget.id)!;
                      return <button key={widget.id} type="button" aria-pressed={widget.visible} onClick={() => update(widget.id, { visible: !widget.visible })}>{widget.visible ? '✓ ' : '+ '}{meta.label}</button>;
                    })}
                  </div>
                  <button className="adapt-import-button" type="button" onClick={importRelay}>Import compatible Relay layout</button>
                  {importMessage && <p role="status">{importMessage}</p>}
                  <p>Layouts are currently saved on this device for the signed-in account. Cloud sync and remaining Relay widgets are part of the next migration stage.</p>
                </section>
              )}
              {!layout.some((widget) => widget.visible) && <p className="adapt-empty">Your dashboard is empty. Select Customize to add widgets.</p>}
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
