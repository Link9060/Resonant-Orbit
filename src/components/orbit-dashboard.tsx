'use client';

import {
  applyDashboardPreset, DEFAULT_DASHBOARD_LAYOUT, DASHBOARD_PRESETS, normalizeDashboardLayout,
  type DashboardWidgetId, type DashboardWidgetPreference, type DashboardCustomPreset,
  type DashboardPresetId,
} from '@/lib/dashboard-layout';
import { packDashboard } from '@/lib/orbit-widget-grid';
import { OrbitWidgetStudio } from '@/components/orbit-widget-studio';
import {
  accountId, verified, localLayout, localPresets, writeLocalLayout, writeLocalPresets,
  hydrateAccount, persistLayout, persistPresets, fetchDashboard, emptyDashboard,
  createTask, markTask, createNote, widgetUrl, shell,
  type LiveDashboard, type Task,
} from '@/lib/orbit-dashboard-sync';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

const META: Record<DashboardWidgetId, { title: string; subtitle: string }> = {
  overview: { title: 'Daily overview', subtitle: 'Your day at a glance' },
  weather: { title: 'Weather', subtitle: 'Conditions at your chosen ZIP' },
  tasks: { title: 'To-Do', subtitle: 'Today’s tasks' },
  calendar: { title: 'Next Up', subtitle: 'Upcoming calendar items' },
  today: { title: 'Today', subtitle: 'Your daily timeline' },
  chats: { title: 'Chats', subtitle: 'Recent message activity' },
  quicknote: { title: 'Quick Note', subtitle: 'Capture a thought' },
  focus: { title: 'Focus', subtitle: 'A lightweight focus timer' },
  nowplaying: { title: 'Now Playing', subtitle: 'Music integration pending' },
  pinnedpeople: { title: 'Pinned People', subtitle: 'Connection integration pending' },
  quicklinks: { title: 'Quick Actions', subtitle: 'Open your ARROW modules' },
  dayprogress: { title: 'Day remaining', subtitle: 'Time left in your active day' },
  schoolschedule: { title: 'School Schedule', subtitle: 'Shared calendar items' },
  assignments: { title: 'Assignments', subtitle: 'Upcoming dated tasks' },
  momentum: { title: 'Momentum', subtitle: 'Task progress' },
  sun: { title: 'Sunrise / Sunset', subtitle: 'Sun times for your ZIP' },
  countdowns: { title: 'Countdowns', subtitle: 'Next calendar event' },
  recentfiles: { title: 'Recent Files', subtitle: 'File integration pending' },
  ravinbrief: { title: 'Daily Brief', subtitle: 'A snapshot of ARROW data' },
  askravin: { title: 'RAVIN', subtitle: 'Start an AI conversation' },
};
const KEYS = { legacy: 'relay-dashboard-layout-v1', legacyOwner: 'relay-dashboard-custom-presets-owner-v1', weather: 'relay-dashboard-weather-zip-v1' };
const DEFAULT = DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));

type Weather = { temp: number; hi: number; lo: number; precip: number; sunrise: string; sunset: string; unit: string; location: string };
function localDay(): string {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
}
function clock(time: string | null | undefined): string {
  if (!time) return 'All day';
  const parts = time.split(':').map(Number);
  const date = new Date(); date.setHours(parts[0] || 0, parts[1] || 0, 0);
  return date.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' });
}
function open(id: string) {
  if (id === 'quicklinks') { shell()?.openPanel?.('links', 'orbit'); return; }
  if (id === 'focus') { shell()?.openPanel?.('focus', 'orbit'); return; }
  window.location.assign(widgetUrl(id));
}
function ShortLink({ id, label }: { id: string; label: string }) {
  return <a className="adapt-dashboard-link" href={widgetUrl(id)}>{label} ↗</a>;
}
function Meter({ number, total }: { number: number; total: number }) {
  const percentage = total ? Math.round(100 * number / total) : 0;
  return <div className="adapt-meter"><div className="adapt-meter-top"><strong>{percentage}%</strong><span>{number}/{total} completed</span></div><div className="adapt-meter-track"><i style={{ width: percentage + '%' }} /></div></div>;
}

type DayWindow = { start: string; end: string };
const DEFAULT_DAY_WINDOW: DayWindow = { start:'08:00', end:'22:00' };
function validDayWindow(value: unknown): DayWindow {
  const candidate = value as Partial<DayWindow> | null;
  const valid = (time: unknown) => typeof time === 'string' && /^([01]\\d|2[0-3]):[0-5]\\d$/.test(time);
  if (!valid(candidate?.start) || !valid(candidate?.end)) return DEFAULT_DAY_WINDOW;
  const start = candidate!.start!;
  const end = candidate!.end!;
  return start < end ? { start, end } : DEFAULT_DAY_WINDOW;
}
function activeDay(now: Date, window: DayWindow) {
  const minutes = now.getHours()*60 + now.getMinutes();
  const toMinutes = (value: string) => Number(value.slice(0,2))*60 + Number(value.slice(3));
  const start = toMinutes(window.start), end = toMinutes(window.end);
  const remaining = Math.max(0, end - Math.max(start, minutes));
  const percent = minutes <= start ? 100 : minutes >= end ? 0 : Math.round(100 * remaining/(end-start));
  return { remaining, percent, sleeping: minutes < start || minutes >= end, beforeStart:minutes < start };
}
function timeLabel(minutes: number) {
  const hours = Math.floor(minutes / 60), mins = minutes % 60;
  return hours ? `${hours}h ${mins ? mins+'m' : ''}`.trim() : `${mins}m`;
}

function useWeather() {
  const [zip, setZip] = useState('');
  const [draft, setDraft] = useState('');
  const [weather, setWeather] = useState<Weather | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    try { const stored = localStorage.getItem(KEYS.weather) || ''; setZip(stored); setDraft(stored); } catch {}
  }, []);
  const load = useCallback(async (value: string) => {
    const next = value.replace(/\D/g, '').slice(0, 5);
    if (!/^\d{5}$/.test(next)) { setError('Enter a five-digit US ZIP code.'); return; }
    setLoading(true); setError('');
    try {
      const zipResponse = await fetch('https://api.zippopotam.us/us/' + encodeURIComponent(next));
      if (!zipResponse.ok) throw Error('ZIP lookup failed');
      const data = await zipResponse.json() as { places?: Array<{ latitude: string; longitude: string; 'place name': string }> };
      const place = data.places?.[0];
      if (!place) throw Error('ZIP not found');
      const params = new URLSearchParams({
        latitude:place.latitude, longitude:place.longitude,
        current:'temperature_2m',
        daily:'temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
        timezone:'auto', forecast_days:'1',
        temperature_unit:'fahrenheit',
      });
      const response = await fetch('https://api.open-meteo.com/v1/forecast?' + params);
      if (!response.ok) throw Error('Weather request failed');
      const w = await response.json() as { current?: { temperature_2m?: number }; daily?: { temperature_2m_max?: number[]; temperature_2m_min?: number[]; precipitation_probability_max?: number[]; sunrise?: string[]; sunset?: string[] } };
      setWeather({ temp: w.current?.temperature_2m ?? 0, hi:w.daily?.temperature_2m_max?.[0] ?? 0,
        lo:w.daily?.temperature_2m_min?.[0] ?? 0, precip:w.daily?.precipitation_probability_max?.[0] ?? 0,
        sunrise:w.daily?.sunrise?.[0] || '', sunset:w.daily?.sunset?.[0] || '',
        unit:'°F', location:place['place name'] || 'ZIP ' + next });
      setZip(next);
      try { localStorage.setItem(KEYS.weather, next); } catch {}
    } catch { setError('Weather could not load. Check your ZIP or connection.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (/^\d{5}$/.test(zip)) void load(zip); }, [zip, load]);
  return { draft, setDraft, weather, loading, error, load };
}

export function OrbitDashboard() {
  const [owner, setOwner] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<DashboardWidgetPreference[]>(DEFAULT);
  const [presets, setPresets] = useState<DashboardCustomPreset[]>([]);
  const [ready, setReady] = useState(false);
  const [syncMessage, setSyncMessage] = useState('Connecting your dashboard…');
  const [editing, setEditing] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [data, setData] = useState<LiveDashboard>(emptyDashboard());
  const [busy, setBusy] = useState(false);
  const [taskDraft, setTaskDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [prompt, setPrompt] = useState('');
  const [focusSeconds, setFocusSeconds] = useState(25 * 60);
  const [focusRunning, setFocusRunning] = useState(false);
  const [dayWindow, setDayWindow] = useState<DayWindow>(DEFAULT_DAY_WINDOW);
  const [daySettingsOpen, setDaySettingsOpen] = useState(false);
  const [dayWindowError, setDayWindowError] = useState('');
  const [clockNow, setClockNow] = useState(() => new Date());
  const version = useRef(0);
  const saveTimer = useRef<number | null>(null);
  const weather = useWeather();
  useEffect(() => {
    const timer = window.setInterval(() => setClockNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try { setDayWindow(validDayWindow(JSON.parse(localStorage.getItem('arrow-orbit-day-window-v1:'+owner) || 'null'))); }
    catch { setDayWindow(DEFAULT_DAY_WINDOW); }
  }, [owner]);

  useEffect(() => {
    let mounted = true;
    const sync = () => {
      const next = accountId();
      if (next !== owner) {
        version.current++;
        setOwner(next); setReady(false); setData(emptyDashboard()); setEditing(false);
        setWidgets(next ? localLayout(next) : DEFAULT);
        setPresets(next ? localPresets(next) : []);
        setSyncMessage(next ? 'Connecting your dashboard…' : 'Sign in to sync widgets.');
      }
    };
    sync();
    const refreshAuth = () => sync();
    window.addEventListener('storage', refreshAuth);
    window.addEventListener('focus', refreshAuth);
    return () => { mounted = false; void mounted; window.removeEventListener('storage', refreshAuth); window.removeEventListener('focus', refreshAuth); };
  }, [owner]);
  useEffect(() => {
    if (!owner) return;
    let active = true;
    const token = ++version.current;
    void (async () => {
      try {
        const prefs = await hydrateAccount(owner);
        if (!active || version.current !== token || !verified(owner)) return;
        setWidgets(packDashboard(prefs.widgets)); setPresets(prefs.presets); setSyncMessage('Saved to your ARROW account');
      } catch {
        if (!active || version.current !== token) return;
        setSyncMessage('Cloud layout unavailable. Edits will be saved on this device.');
      } finally {
        if (active && version.current === token) setReady(true);
      }
    })();
    return () => { active = false; if (saveTimer.current !== null) window.clearTimeout(saveTimer.current); };
  }, [owner]);

  const refresh = useCallback(async () => {
    if (!owner || !verified(owner)) return;
    try { const result = await fetchDashboard(owner); if (verified(owner)) setData(result); }
    catch { if (verified(owner)) setData({ ...emptyDashboard(), errors:['Dashboard data is temporarily unavailable.'] }); }
  }, [owner]);
  useEffect(() => {
    if (!owner) return;
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    const onRefresh = () => void refresh();
    window.addEventListener('arrow:planning-changed', onRefresh);
    window.addEventListener('focus', onRefresh);
    window.addEventListener('online', onRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('arrow:planning-changed', onRefresh);
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('online', onRefresh);
    };
  }, [owner, refresh]);
  useEffect(() => {
    if (!focusRunning) return;
    const timer = window.setInterval(() => setFocusSeconds((x) => { if (x <= 1) { setFocusRunning(false); return 0; } return x-1; }), 1000);
    return () => window.clearInterval(timer);
  }, [focusRunning]);

  function updateLayout(next: DashboardWidgetPreference[]) {
    if (!owner || !ready || !verified(owner)) return;
    const normalized = packDashboard(normalizeDashboardLayout(next));
    setWidgets(normalized);
    writeLocalLayout(owner, normalized);
    setSyncMessage('Saving dashboard…');
    if (saveTimer.current !== null) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void persistLayout(owner, normalized).then(() => { if (verified(owner)) setSyncMessage('Saved to your ARROW account'); })
        .catch(() => { if (verified(owner)) setSyncMessage('Cloud save failed. This device kept your changes.'); });
    }, 500);
  }
  async function updatePresets(next: DashboardCustomPreset[]) {
    if (!owner || !ready || !verified(owner)) return;
    const safe = next.slice(0, 24);
    setPresets(safe); writeLocalPresets(owner, safe);
    setSyncMessage('Saving presets…');
    try { await persistPresets(owner, safe); if (verified(owner)) setSyncMessage('Presets saved to your ARROW account'); }
    catch { if (verified(owner)) setSyncMessage('Preset cloud save failed. This device kept your changes.'); }
  }
  function preset(type: DashboardPresetId) { updateLayout(packDashboard(applyDashboardPreset(widgets, type))); }
  async function savePreset(e: FormEvent) {
    e.preventDefault();
    if (!presetName.trim()) return;
    const name = presetName.trim().replace(/\s+/g, ' ').slice(0, 40);
    const now = new Date().toISOString();
    const previous = presets.find((item) => item.name.toLowerCase() === name.toLowerCase());
    const entry: DashboardCustomPreset = { id: previous?.id || crypto.randomUUID(), name, widgets:normalizeDashboardLayout(widgets), createdAt:previous?.createdAt || now, updatedAt:now };
    await updatePresets([entry, ...presets.filter((item) => item.id !== previous?.id)].slice(0, 24));
    setPresetName('');
  }
  function importLegacy() {
    if (!owner || !ready) return;
    try {
      const raw = JSON.parse(localStorage.getItem(KEYS.legacy) || 'null') as unknown;
      if (!Array.isArray(raw)) { setSyncMessage('No Relay layout was found on this device. Your cloud presets remain available.'); return; }
      // The original Relay active layout was unscoped. Import only with explicit user action.
      if (!window.confirm('Import this browser’s old Relay widget arrangement? It may belong to another account that used this device. Your current Orbit layout will be replaced, but saved presets remain.')) return;
      updateLayout(normalizeDashboardLayout(raw));
      setSyncMessage('Relay layout imported into Orbit.');
    } catch { setSyncMessage('Could not read the legacy Relay layout.'); }
  }
  async function action(job: () => Promise<void>) {
    if (!owner || busy || !verified(owner)) return;
    setBusy(true);
    try { await job(); await refresh(); }
    catch { setSyncMessage('Action failed. Your previous data was not deleted.'); }
    finally { setBusy(false); }
  }
  const today = localDay();
  const todaysTasks = data.tasks.filter((task) => task.due_on === today);
  const done = todaysTasks.filter((task) => task.completed).length;
  const future = data.tasks.filter((task) => task.due_on > today && !task.completed);
  const unread = data.notifications.filter((item) => !item.read_at);
  const next = data.events.find((event) => event.event_date >= today);
  const summary = { tasks: todaysTasks.length, done, next:next?.title || 'Nothing scheduled', unread:unread.length };
  const timeRemaining = activeDay(clockNow, dayWindow);

  function taskList(items: Task[], maxItems = 6) {
    return items.length ? <ul className="adapt-data-list">{items.slice(0, maxItems).map((task) => <li key={task.id}>
      <label><input type="checkbox" checked={task.completed} disabled={busy} onChange={(event) => void action(() => markTask(owner!, task.id, event.target.checked))}/><span>{task.title}</span></label>
    </li>)}</ul> : <p className="adapt-small-muted">No tasks here yet.</p>;
  }
  function content(id: DashboardWidgetId, cols = 6, rows = 2): ReactNode {
    const compact = cols <= 3 || rows === 1;
    const expansive = cols >= 8 && rows >= 3;
    const count = compact ? 1 : rows >= 4 ? 6 : cols >= 8 ? 4 : 2;
    switch (id) {
      case 'overview': return <div className="adapt-metrics"><Metric value={String(summary.tasks-summary.done)} label="Tasks left"/>{!compact && <Metric value={String(summary.unread)} label="Unread messages"/>}{(cols>=8 || expansive) && <Metric value={String(data.events.length)} label="Upcoming events"/>}{rows>=3 && <p>Next: {summary.next}</p>}</div>;
      case 'tasks': return <>{compact ? <div className="adapt-feature-number">{todaysTasks.length-done}<small> left today</small></div> : <form className="adapt-input-form" onSubmit={(e) => { e.preventDefault(); const title=taskDraft.trim(); if (!title) return; void action(async()=>{await createTask(owner!,title);setTaskDraft('');}); }}><input aria-label="New task" maxLength={220} value={taskDraft} onChange={(e)=>setTaskDraft(e.target.value)} placeholder="Add today's task"/><button disabled={busy || !taskDraft.trim()}>Add</button></form>}{!compact && taskList(todaysTasks,count)}{rows>=2 && <ShortLink id="tasks" label="Open tasks"/>}</>;
      case 'calendar':
      case 'schoolschedule': return <>{data.events.length?<ul className="adapt-data-list">{data.events.slice(0,count).map((event) => <li key={event.id}><strong>{event.title}</strong><small>{event.event_date} · {event.is_all_day?'All day':clock(event.start_time)}</small></li>)}</ul>:<p className="adapt-small-muted">No upcoming events in your shared calendar.</p>}<ShortLink id="calendar" label="Open calendar"/></>;
      case 'today': return <><p className="adapt-small-muted">{today} · {data.events.filter(e=>e.event_date===today).length} events</p>{!compact && taskList(todaysTasks,count)}{rows>=2 && <ShortLink id="calendar" label="See calendar"/>}</>;
      case 'chats': return <><p className="adapt-feature-number">{unread.length} <small>unread alerts</small></p><ul className="adapt-data-list">{data.notifications.slice(0,compact?0:count).map((item)=><li key={item.id}><strong>{item.title}</strong><small>{item.body}</small></li>)}</ul><ShortLink id="chats" label="Open messages"/></>;
      case 'quicknote': return compact ? <ShortLink id="quicknote" label="Capture a note"/> : <form className="adapt-note-form" onSubmit={(e)=>{e.preventDefault();const note=noteDraft.trim();if(!note)return;void action(async()=>{await createNote(owner!,note);setNoteDraft('');});}}><textarea aria-label="Quick note" value={noteDraft} onChange={e=>setNoteDraft(e.target.value)} maxLength={5000} placeholder="Capture an idea…"/><button disabled={!noteDraft.trim() || busy}>Save to Relay Notes</button></form>;
      case 'focus': return <><div className="adapt-feature-number">{String(Math.floor(focusSeconds/60)).padStart(2,'0')}:{String(focusSeconds%60).padStart(2,'0')}</div><div className="adapt-widget-actions"><button onClick={()=>setFocusRunning(v=>!v)}>{focusRunning?'Pause':'Start'}</button><button onClick={()=>{setFocusRunning(false);setFocusSeconds(25*60);}}>Reset</button></div><p className="adapt-small-muted">Timer runs while this page remains open.</p></>;
      case 'weather':
      case 'sun': return <>{weather.weather ? id==='sun'?<div className="adapt-metrics"><Metric value={clock(weather.weather.sunrise.split('T')[1])} label="Sunrise"/><Metric value={clock(weather.weather.sunset.split('T')[1])} label="Sunset"/></div>:<div className="adapt-weather"><span>{Math.round(weather.weather.temp)}{weather.weather.unit}</span><p>{weather.weather.location} · H {Math.round(weather.weather.hi)}° · L {Math.round(weather.weather.lo)}° · Rain {weather.weather.precip}%</p></div>:<p className="adapt-small-muted">Choose a ZIP to show local conditions.</p>}<form className="adapt-input-form" onSubmit={e=>{e.preventDefault();void weather.load(weather.draft);}}><input inputMode="numeric" aria-label="Weather ZIP code" maxLength={5} value={weather.draft} onChange={e=>weather.setDraft(e.target.value.replace(/\D/g,''))} placeholder="ZIP code"/><button disabled={weather.loading}>{weather.loading?'Loading':'Apply'}</button></form>{weather.error&&<p role="alert" className="adapt-small-muted">{weather.error}</p>}</>;
      case 'quicklinks': return <div className="adapt-quicklinks">{[['waypoint','Waypoint'],['chats','Relay'],['askravin','RAVIN'],['calendar','Calendar']].map(([target,label])=><ShortLink key={target} id={target} label={label}/>)}</div>;
      case 'dayprogress': return <div className="adapt-daytime">
        <div className="adapt-meter"><div className="adapt-meter-top">
          <strong>{timeRemaining.sleeping ? 'Rest time' : timeRemaining.percent+'% left'}</strong>
          <span>{timeRemaining.sleeping ? (timeRemaining.beforeStart ? 'Your day starts at '+clock(dayWindow.start) : 'Time to wind down') : timeLabel(timeRemaining.remaining)+' remaining'}</span>
        </div><div className="adapt-meter-track"><i style={{ width: timeRemaining.percent + '%' }} /></div></div>
        {!compact && <small className="adapt-daytime-hours">{clock(dayWindow.start)} – {clock(dayWindow.end)}</small>}
        <button type="button" className="adapt-daytime-settings" aria-label="Adjust active-day hours" onClick={()=>{setDayWindowError('');setDaySettingsOpen(true);}}>Adjust hours</button>
      </div>;
      case 'momentum': return <Meter number={done} total={todaysTasks.length}/>;
      case 'assignments': return <>{taskList(future,count)}{rows>=2 && <ShortLink id="tasks" label="View all tasks"/>}</>;
      case 'countdowns': return <>{next ? <><strong>{next.title}</strong><p>{next.event_date} · {clock(next.start_time)}</p></>:<p className="adapt-small-muted">No upcoming scheduled events.</p>}<ShortLink id="calendar" label="Open calendar"/></>;
      case 'ravinbrief': return <><div className="adapt-metrics"><Metric value={String(summary.tasks-summary.done)} label="Tasks left"/><Metric value={String(summary.unread)} label="Unread"/><Metric value={String(data.events.length)} label="Events"/></div><ShortLink id="ravinbrief" label="Open RAVIN"/></>;
      case 'askravin': return compact ? <ShortLink id="askravin" label="Ask RAVIN"/> : <form className="adapt-note-form" onSubmit={e=>{e.preventDefault();if(!prompt.trim())return;window.location.assign(widgetUrl('askravin')+'?'+new URLSearchParams({from:'orbit',surface:'orbit',prompt:prompt.trim()}));}}><textarea maxLength={4000} value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask RAVIN…" aria-label="Ask RAVIN"/><button disabled={!prompt.trim()}>Continue in RAVIN ↗</button></form>;
      default: return <p className="adapt-small-muted">This widget is awaiting its integration.</p>;
    }
  }
  return <div className="adapt-dashboard-inner">
    <header className="adapt-dashboard-heading">
      <div><span className="adapt-eyebrow">ARROW / OVERVIEW</span><h1>Dashboard</h1></div>
      <button type="button" className="adapt-edit-button" disabled={!owner || !ready} aria-pressed={editing} onClick={()=>setEditing(value=>!value)}>{editing?'Done':'Customize'}</button>
    </header>
    <p role="status" className="adapt-sync-status">{syncMessage}</p>
    {daySettingsOpen && <div className="adapt-daytime-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setDaySettingsOpen(false);}}>
      <form className="adapt-daytime-dialog" role="dialog" aria-modal="true" aria-label="Set active-day hours" onSubmit={event=>{
        event.preventDefault();
        if(dayWindow.start>=dayWindow.end){setDayWindowError('End time must be after start time.');return;}
        try { localStorage.setItem('arrow-orbit-day-window-v1:'+owner,JSON.stringify(dayWindow)); } catch {}
        setDayWindowError('');setDaySettingsOpen(false);
      }}>
        <h2>Your active day</h2><p>Choose when your day starts and when you wind down. Outside these hours the widget shows rest time.</p>
        <label>Start <input type="time" aria-label="Active day start" required value={dayWindow.start} onChange={e=>setDayWindow(v=>({...v,start:e.target.value}))}/></label>
        <label>End <input type="time" aria-label="Active day end" required value={dayWindow.end} onChange={e=>setDayWindow(v=>({...v,end:e.target.value}))}/></label>
        {dayWindowError&&<p role="alert">{dayWindowError}</p>}
        <div className="adapt-widget-actions"><button type="button" onClick={()=>{setDaySettingsOpen(false);setDayWindowError('');}}>Cancel</button><button type="submit">Save hours</button></div>
      </form>
    </div>}
    {data.errors.length>0 && <p role="status" className="adapt-data-errors">{data.errors.join(' ')}</p>}
    <OrbitWidgetStudio
      widgets={widgets} meta={META} editing={editing} onEdit={setEditing}
      disabled={!owner || !ready} onChange={updateLayout} renderWidget={content}
      extra={<section className="adapt-widget-library orbit-studio-presets" aria-label="Layout presets">
        <div className="adapt-widget-library-title">
          <h2>Layouts</h2>
          <button type="button" onClick={()=>updateLayout(DEFAULT)}>Reset layout</button>
        </div>
        <p>Choose a starting arrangement or save your own. Widget locations and sizes are included in saved layouts.</p>
        <div className="adapt-widget-library-items">{DASHBOARD_PRESETS.map(item=><button type="button" key={item.id} onClick={()=>preset(item.id)}>{item.name}</button>)}</div>
        <h3>Your saved layouts</h3>
        <form className="adapt-input-form" onSubmit={e=>void savePreset(e)}>
          <input maxLength={40} aria-label="Preset name" placeholder="Name this layout" value={presetName} onChange={e=>setPresetName(e.target.value)}/>
          <button type="submit" disabled={!presetName.trim() || presets.length>=24}>Save</button>
        </form>
        <div className="adapt-widget-library-items">{presets.map(entry=><div className="adapt-preset" key={entry.id}>
          <button type="button" onClick={()=>updateLayout(entry.widgets)}>{entry.name}</button>
          <button type="button" aria-label={'Delete '+entry.name+' preset'} onClick={()=>{if(window.confirm('Delete preset '+entry.name+'?'))void updatePresets(presets.filter(item=>item.id!==entry.id));}}>×</button>
        </div>)}</div>
        <button type="button" className="adapt-import-button" onClick={importLegacy}>Import an older Relay layout</button>
        <p>Existing Relay presets are preserved. Locations sync with your signed-in ARROW account.</p>
      </section>}
    />
  </div>;
}
function Metric({value,label}:{value:string;label:string}) { return <div className="adapt-metric"><strong>{value}</strong><span>{label}</span></div>; }
