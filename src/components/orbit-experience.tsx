'use client';

import { useEffect, useState } from 'react';
import { ARROW_DESTINATIONS } from '@/lib/arrow-map';

type WidgetId = 'navigation' | 'tasks' | 'notes' | 'calendar' | 'activity' | 'relay' | 'ravin' | 'waypoint' | 'atlas';
const STORAGE = 'arrow_orbit_widgets_v1';
const VIEW = 'arrow_orbit_view_v1';
const ALL: { id: WidgetId; label: string }[] = [
  { id: 'navigation', label: 'Destinations' },
  { id: 'tasks', label: 'Tasks' },
  { id: 'notes', label: 'Quick notes' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'activity', label: 'Activity' },
  { id: 'relay', label: 'Relay' },
  { id: 'ravin', label: 'RAVIN' },
  { id: 'waypoint', label: 'Waypoint' },
  { id: 'atlas', label: 'Atlas' },
];
function readWidgets(): WidgetId[] {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (Array.isArray(value)) {
      const items = value.filter((id): id is WidgetId => ALL.some(item => item.id === id));
      if (items.length) return [...new Set(items)];
    }
  } catch {}
  return ['navigation', 'tasks', 'notes', 'calendar', 'activity'];
}
function getList(key: string): Record<string, unknown>[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function openPanel(panel: string) {
  const arrow = (window as typeof window & { ArrowOS?: { openPanel: (name: string, module: string) => void } }).ArrowOS;
  arrow?.openPanel(panel, 'orbit');
}
export function OrbitExperience({ children }: { children: React.ReactNode }) {
  const [view, setView] = useState<'world' | 'dashboard'>('world');
  const [widgets, setWidgets] = useState<WidgetId[]>(ALL.map(item => item.id));
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [tasks, setTasks] = useState<Record<string, unknown>[]>([]);
  const [events, setEvents] = useState<Record<string, unknown>[]>([]);
  const [identity, setIdentity] = useState('core');
  const [presetName, setPresetName] = useState('');
  const [presets, setPresets] = useState<Record<string,WidgetId[]>>({});
  const [layoutSize, setLayoutSize] = useState<'comfortable' | 'compact'>('comfortable');
  useEffect(() => {
    const sync = () => {
      setWidgets(readWidgets());
      try { const saved = JSON.parse(localStorage.getItem('arrow_orbit_presets_v1') || '{}'); setPresets(saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {}); } catch { setPresets({}); }
      setLayoutSize(localStorage.getItem('arrow_orbit_density_v1') === 'compact' ? 'compact' : 'comfortable');
      setNotes(localStorage.getItem('arrow_os_notes_v1') || '');
      setTasks(getList('arrow_os_tasks_v1'));
      setEvents(getList('arrow_os_events_v1'));
      setIdentity(document.documentElement.dataset.arrowIdentity || 'core');
    };
    const requested = new URLSearchParams(window.location.search).get('view');
    setView(requested === 'dashboard' || (requested !== 'world' && localStorage.getItem(VIEW) === 'dashboard') ? 'dashboard' : 'world');
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('arrow-os:datachange', sync);
    window.addEventListener('arrow:identitychange', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('arrow-os:datachange', sync);
      window.removeEventListener('arrow:identitychange', sync);
    };
  }, []);
  const toggle = (next: 'world' | 'dashboard') => {
    setView(next);
    localStorage.setItem(VIEW, next);
  };
  const saveWidgets = (next: WidgetId[]) => {
    setWidgets(next);
    localStorage.setItem(STORAGE, JSON.stringify(next));
  };
  const move = (id: WidgetId, amount: number) => {
    const next = [...widgets];
    const index = next.indexOf(id);
    const destination = index + amount;
    if (destination < 0 || destination >= next.length) return;
    [next[index], next[destination]] = [next[destination], next[index]];
    saveWidgets(next);
  };
  const savePreset = () => {
    const name = presetName.trim().slice(0,40);
    if (!name) return;
    const next = { ...presets, [name]: [...widgets] };
    setPresets(next);
    localStorage.setItem('arrow_orbit_presets_v1', JSON.stringify(next));
    setPresetName('');
  };
  const widget = (id: WidgetId) => {
    if (id === 'relay' || id === 'ravin' || id === 'waypoint' || id === 'atlas') {
      const target = ARROW_DESTINATIONS.find(destination => destination.id === id);
      return <><p>{target?.description}</p><a className="adapt-module-link" href={target?.href || '#'}>Open {target?.name} ↗</a></>;
    }
    if (id === 'navigation') return <div className="adapt-destination-grid">{ARROW_DESTINATIONS.map(destination => <a key={destination.id} href={destination.href || '#'} aria-disabled={!destination.href} onClick={event => { if (!destination.href) event.preventDefault(); }}><strong>{destination.name}</strong><span>{destination.description}</span></a>)}</div>;
    if (id === 'tasks') return <><strong>{tasks.filter(task => !task.done).length} open tasks</strong><ul>{tasks.filter(task => !task.done).slice(0,5).map((task,index) => <li key={String(task.id || index)}>{String(task.text || task.title || 'Task')}</li>)}</ul><button onClick={() => openPanel('tasks')}>Manage tasks</button></>;
    if (id === 'notes') return <><p className="adapt-notes-preview">{notes.trim() || 'No notes yet. Capture an idea in the ARROW panel.'}</p><button onClick={() => openPanel('notes')}>Open notes</button></>;
    if (id === 'calendar') return <><strong>{events.length} saved events</strong><ul>{events.slice(0,4).map((event,index) => <li key={String(event.id || index)}>{String(event.title || 'Event')}</li>)}</ul><button onClick={() => openPanel('calendar')}>Open calendar</button></>;
    return <><p>Your ARROW workspace, collected in one place.</p><button onClick={() => openPanel('focus')}>Start focus session</button></>;
  };
  return <div className="adapt-orbit-shell" data-adapt-identity={identity} data-density={layoutSize}>
    <nav className="adapt-view-switch" aria-label="Orbit layout">
      <button aria-pressed={view === 'world'} onClick={() => toggle('world')}>Immersive Orbit</button>
      <button aria-pressed={view === 'dashboard'} onClick={() => toggle('dashboard')}>Dashboard</button>
    </nav>
    <div hidden={view !== 'world'} className="adapt-world-container">{children}</div>
    {view === 'dashboard' && <section className="adapt-dashboard" aria-label="Customizable Orbit dashboard">
      <header className="adapt-dashboard-header"><div><small>ARROW / ORBIT</small><h1>Your workspace</h1><p>All your destinations and essentials in one place.</p></div><button onClick={() => setEditing(!editing)} aria-pressed={editing}>{editing ? 'Done editing' : 'Customize widgets'}</button></header>
      {editing && <div className="adapt-dashboard-editor"><div className="adapt-preset-controls"><label>Density <select value={layoutSize} onChange={event => { const next = event.target.value === 'compact' ? 'compact' : 'comfortable'; setLayoutSize(next); localStorage.setItem('arrow_orbit_density_v1',next); }}><option value="comfortable">Comfortable</option><option value="compact">Compact</option></select></label><label>Save layout <input value={presetName} maxLength={40} onChange={event => setPresetName(event.target.value)} placeholder="Preset name" /></label><button onClick={savePreset} disabled={!presetName.trim()}>Save preset</button><label>Load preset <select value="" onChange={event => { if (presets[event.target.value]) saveWidgets(presets[event.target.value]); }}><option value="">Choose saved layout</option>{Object.keys(presets).map(name => <option key={name} value={name}>{name}</option>)}</select></label></div></div>}
      {editing && <div className="adapt-widget-options" aria-label="Select dashboard widgets">{ALL.map(item => <label key={item.id}><input type="checkbox" checked={widgets.includes(item.id)} onChange={event => saveWidgets(event.target.checked ? [...widgets,item.id] : widgets.filter(id => id !== item.id))}/>{item.label}</label>)}</div>}
      <div className="adapt-widget-grid">{widgets.map(id => <article key={id} className={'adapt-widget adapt-widget-'+id}><header><h2>{ALL.find(item => item.id === id)?.label}</h2>{editing && <div><button aria-label={'Move '+id+' left'} onClick={() => move(id,-1)}>←</button><button aria-label={'Move '+id+' right'} onClick={() => move(id,1)}>→</button></div>}</header>{widget(id)}</article>)}</div>
    </section>}
  </div>;
}
