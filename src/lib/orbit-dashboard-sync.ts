'use client';

import {
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeDashboardLayout,
  type DashboardWidgetPreference,
  type DashboardCustomPreset,
} from './dashboard-layout';

const SESSION = 'sb-cnorozrjugxpanpfmssa-auth-token';
const LAYOUT_PREFIX = 'arrow-orbit-dashboard-layout-v2:';
const PRESETS_PREFIX = 'arrow-orbit-dashboard-presets-v2:';
const RELAY_CACHE_OWNER = 'relay-dashboard-custom-presets-owner-v1';
const RELAY_PRESETS = 'relay-dashboard-custom-presets-v1';

type ArrowShell = {
  data?: (path: string, options?: { method?: string; headers?: Record<string, string>; body?: unknown; readOnly?: boolean }) => Promise<unknown>;
  openPanel?: (name: string, module?: string) => void;
  resolveHref?: (href: string) => string;
};
export function shell(): ArrowShell | undefined {
  return (window as Window & { ArrowOS?: ArrowShell }).ArrowOS;
}
export function accountId(): string | null {
  try {
    const saved = JSON.parse(localStorage.getItem(SESSION) || 'null') as { user?: { id?: unknown }; access_token?: unknown };
    return typeof saved?.user?.id === 'string' && typeof saved.access_token === 'string' ? saved.user.id : null;
  } catch { return null; }
}
export function verified(owner: string): boolean { return accountId() === owner; }
export async function request(owner: string, path: string, options?: Parameters<NonNullable<ArrowShell['data']>>[1]): Promise<unknown> {
  if (!verified(owner)) throw Error('Your ARROW session changed. Refresh the page.');
  // The shared shell loads after hydration; never use unauthenticated fallback requests.
  let api = shell()?.data;
  for (let i = 0; !api && i < 15; i++) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 250));
    api = shell()?.data;
  }
  if (!api) throw Error('ARROW data is unavailable. Refresh to reconnect.');
  const response = await api(path, options);
  if (!verified(owner)) throw Error('Your ARROW session changed. Refresh the page.');
  return response;
}
export type AccountLayout = { widgets: DashboardWidgetPreference[]; presets: DashboardCustomPreset[]; synced: boolean };
function readJson(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || 'null') as unknown; } catch { return null; }
}
function cleanPresets(value: unknown): DashboardCustomPreset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((candidate) => {
    if (!candidate || typeof candidate !== 'object') return [];
    const row = candidate as Partial<DashboardCustomPreset>;
    if (typeof row.id !== 'string' || typeof row.name !== 'string' || !Array.isArray(row.widgets)) return [];
    const name = row.name.trim().replace(/\s+/g, ' ').slice(0, 40);
    if (!name || !row.id) return [];
    return [{
      id: row.id,
      name,
      widgets: normalizeDashboardLayout(row.widgets),
      createdAt: typeof row.createdAt === 'string' ? row.createdAt : '',
      updatedAt: typeof row.updatedAt === 'string' ? row.updatedAt : '',
    }];
  }).slice(0, 24);
}
export function localLayout(owner: string): DashboardWidgetPreference[] {
  return normalizeDashboardLayout(readJson(LAYOUT_PREFIX + owner));
}
export function localPresets(owner: string): DashboardCustomPreset[] {
  return cleanPresets(readJson(PRESETS_PREFIX + owner));
}
export function writeLocalLayout(owner: string, layout: DashboardWidgetPreference[]): void {
  if (!verified(owner)) return;
  try { localStorage.setItem(LAYOUT_PREFIX + owner, JSON.stringify(normalizeDashboardLayout(layout))); } catch {}
}
export function writeLocalPresets(owner: string, presets: DashboardCustomPreset[]): void {
  if (!verified(owner)) return;
  try { localStorage.setItem(PRESETS_PREFIX + owner, JSON.stringify(cleanPresets(presets))); } catch {}
}
export function ownerSafeLegacyPresets(owner: string): DashboardCustomPreset[] {
  try {
    if (localStorage.getItem(RELAY_CACHE_OWNER) !== owner) return [];
    return cleanPresets(readJson(RELAY_PRESETS));
  } catch { return []; }
}
export async function hydrateAccount(owner: string): Promise<AccountLayout> {
  const existingLayout = readJson(LAYOUT_PREFIX + owner);
  const local = existingLayout ? normalizeDashboardLayout(existingLayout) : DEFAULT_DASHBOARD_LAYOUT.map((x) => ({ ...x }));
  const savedPresets = localPresets(owner);
  const cachedRelay = ownerSafeLegacyPresets(owner);
  const rows = await request(owner, '/rest/v1/user_ui_preferences?user_id=eq.' + encodeURIComponent(owner) + '&select=orbit_dashboard_layout,dashboard_presets');
  if (!Array.isArray(rows)) throw Error('The dashboard account record is unavailable.');
  const row = rows[0] as { orbit_dashboard_layout?: unknown; dashboard_presets?: unknown } | undefined;
  const remoteLayout = Array.isArray(row?.orbit_dashboard_layout) ? normalizeDashboardLayout(row.orbit_dashboard_layout) : null;
  const widgets = remoteLayout ?? local;
  const merged = new Map<string, DashboardCustomPreset>();
  // Relay's cloud presets are authoritative for existing preset IDs.
  for (const preset of [...savedPresets, ...cachedRelay, ...cleanPresets(row?.dashboard_presets)]) merged.set(preset.id, preset);
  const presets = [...merged.values()].slice(0, 24);
  writeLocalLayout(owner, widgets);
  writeLocalPresets(owner, presets);
  // Never automatically write unscoped Relay localStorage into an account.
  return { widgets, presets, synced: true };
}
export async function persistLayout(owner: string, value: DashboardWidgetPreference[]): Promise<void> {
  const layout = normalizeDashboardLayout(value);
  await request(owner, '/rest/v1/user_ui_preferences?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { user_id: owner, orbit_dashboard_layout: layout, updated_at: new Date().toISOString() },
  });
}
export async function persistPresets(owner: string, value: DashboardCustomPreset[]): Promise<void> {
  await request(owner, '/rest/v1/user_ui_preferences?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { user_id: owner, dashboard_presets: cleanPresets(value), updated_at: new Date().toISOString() },
  });
}
export type Task = { id: string; title: string; due_on: string; completed: boolean; position?: number };
export type CalEvent = { id: string; title: string; event_date: string; start_time: string | null; is_all_day: boolean };
export type Inbox = { id: string; title: string; body: string; link?: string | null; read_at?: string | null };
export type LiveDashboard = { tasks: Task[]; events: CalEvent[]; notifications: Inbox[]; errors: string[] };
const empty: LiveDashboard = { tasks: [], events: [], notifications: [], errors: [] };
export function emptyDashboard(): LiveDashboard { return { ...empty, errors: [] }; }
function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  return year + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}
export async function fetchDashboard(owner: string): Promise<LiveDashboard> {
  const today = dateKey();
  const requests = [
    '/rest/v1/todos?user_id=eq.' + encodeURIComponent(owner) + '&select=id,title,due_on,completed,position&order=due_on.asc,position.asc&limit=100',
    '/rest/v1/relay_calendar_events?user_id=eq.' + encodeURIComponent(owner) + '&event_date=gte.' + today + '&select=id,title,event_date,start_time,is_all_day&order=event_date.asc,start_time.asc&limit=60',
    '/rest/v1/notifications?user_id=eq.' + encodeURIComponent(owner) + '&select=id,title,body,link,read_at&order=created_at.desc&limit=15',
  ];
  const result = await Promise.allSettled(requests.map((path) => request(owner, path)));
  if (!verified(owner)) throw Error('Your ARROW account changed.');
  return {
    tasks: result[0].status === 'fulfilled' && Array.isArray(result[0].value) ? result[0].value as Task[] : [],
    events: result[1].status === 'fulfilled' && Array.isArray(result[1].value) ? result[1].value as CalEvent[] : [],
    notifications: result[2].status === 'fulfilled' && Array.isArray(result[2].value) ? result[2].value as Inbox[] : [],
    errors: result.flatMap((r, i) => r.status === 'rejected' ? ['Could not load ' + ['tasks', 'calendar', 'notifications'][i] + '.'] : []),
  };
}
export async function createTask(owner: string, title: string): Promise<void> {
  await request(owner, '/rest/v1/todos', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { user_id: owner, title, due_on: dateKey(), completed: false } });
}
export async function markTask(owner: string, id: string, completed: boolean): Promise<void> {
  await request(owner, '/rest/v1/todos?id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + encodeURIComponent(owner), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { completed } });
}
export async function createNote(owner: string, note: string): Promise<void> {
  // Relay notes are stored as structured blocks, not a plain string.
  await request(owner, '/rest/v1/notes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { user_id: owner, title: 'Quick Note', content: [{ id: crypto.randomUUID(), type: 'paragraph', text: note }] } });
}
export function widgetUrl(id: string): string {
  const shellHref = { overview:'/waypoint/', tasks:'/waypoint/?tab=today', calendar:'/waypoint/?tab=calendar', schoolschedule:'/waypoint/?tab=calendar', assignments:'/waypoint/?tab=today', chats:'/relay/chats/', askravin:'/ravin/', ravinbrief:'/ravin/', quicknote:'/relay/notes/', quicklinks:'/orbit/', focus:'/relay/focus/' } as Record<string,string>;
  const target = shellHref[id] || '/waypoint/';
  if (location.pathname.startsWith('/Resonant-Relay/')) {
    const betaPath = target.startsWith('/relay/') ? '/Resonant-Relay/' + target.slice('/relay/'.length) : '/Resonant-Relay/arrow' + target;
    return betaPath;
  }
  return shell()?.resolveHref?.(target) || target;
}
