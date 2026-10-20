'use client';

export type DashboardWidgetId =
  | 'overview'
  | 'weather'
  | 'tasks'
  | 'calendar'
  | 'today'
  | 'chats'
  | 'quicknote'
  | 'focus'
  | 'nowplaying'
  | 'pinnedpeople'
  | 'quicklinks'
  | 'dayprogress'
  | 'schoolschedule'
  | 'assignments'
  | 'momentum'
  | 'sun'
  | 'countdowns'
  | 'recentfiles'
  | 'ravinbrief'
  | 'askravin';

export type DashboardWidgetSize =
  | 'extra-small'
  | 'small'
  | 'skinny'
  | 'medium'
  | 'tall'
  | 'extra-tall'
  | 'wide'
  | 'extra-wide'
  | 'large'
  | 'custom';

export type DashboardWidgetPreference = {
  id: DashboardWidgetId;
  size: DashboardWidgetSize;
  visible: boolean;
  cols: number;
  rows: number;
  /** Grid column, zero-based. Optional for compatibility with old Relay layouts. */
  x?: number;
  /** Grid row, zero-based. Optional for compatibility with old Relay layouts. */
  y?: number;
};

export type DashboardPresetId = 'balanced' | 'school' | 'focus' | 'communication' | 'blank';

export type DashboardCustomPreset = {
  id: string;
  name: string;
  widgets: DashboardWidgetPreference[];
  createdAt: string;
  updatedAt: string;
};

export const DASHBOARD_LAYOUT_KEY = 'relay-dashboard-layout-v1'; // Retained for compatible manual migration.
export const DASHBOARD_LAYOUT_EVENT = 'relay-dashboard-layout-change';
export const DASHBOARD_CUSTOM_PRESETS_KEY = 'relay-dashboard-custom-presets-v1';
export const DASHBOARD_CUSTOM_PRESETS_EVENT = 'relay-dashboard-custom-presets-change';

export const DASHBOARD_SIZE_PRESETS: Record<Exclude<DashboardWidgetSize, 'custom'>, { label: string; cols: number; rows: number }> = {
  'extra-small': { label: 'Extra small', cols: 3, rows: 1 },
  small: { label: 'Small', cols: 4, rows: 2 },
  skinny: { label: 'Skinny', cols: 3, rows: 3 },
  medium: { label: 'Medium', cols: 6, rows: 2 },
  tall: { label: 'Tall', cols: 4, rows: 4 },
  'extra-tall': { label: 'Extra tall', cols: 5, rows: 5 },
  wide: { label: 'Wide', cols: 8, rows: 2 },
  'extra-wide': { label: 'Extra wide', cols: 12, rows: 2 },
  large: { label: 'Large', cols: 8, rows: 4 },
};

const widget = (id: DashboardWidgetId, size: Exclude<DashboardWidgetSize, 'custom'>, visible: boolean): DashboardWidgetPreference => ({
  id,
  size,
  visible,
  cols: DASHBOARD_SIZE_PRESETS[size].cols,
  rows: DASHBOARD_SIZE_PRESETS[size].rows,
});

// Only widgets with a real data source or working interaction belong in the
// library. Placeholder IDs remain in the type for saved-layout compatibility,
// but normalizeDashboardLayout drops them until their integrations exist.
export const DEFAULT_DASHBOARD_LAYOUT: DashboardWidgetPreference[] = [
  widget('overview', 'extra-wide', true),
  widget('weather', 'medium', false),
  widget('askravin', 'medium', true),
  widget('tasks', 'medium', true),
  widget('calendar', 'medium', true),
  widget('chats', 'wide', true),
  widget('quicklinks', 'extra-wide', false),
  widget('today', 'extra-wide', false),
  widget('quicknote', 'medium', true),
  widget('focus', 'small', false),
  widget('dayprogress', 'extra-small', false),
  widget('schoolschedule', 'medium', false),
  widget('assignments', 'medium', false),
  widget('momentum', 'extra-small', false),
  widget('sun', 'small', false),
  widget('countdowns', 'medium', false),
  widget('ravinbrief', 'extra-wide', false),
];

export const DASHBOARD_PRESETS: Array<{ id: DashboardPresetId; name: string; description: string }> = [
  { id: 'balanced', name: 'Balanced', description: 'Weather, RAVIN, tasks, calendar, and chats.' },
  { id: 'school', name: 'School', description: 'Schedule, assignments, tasks, countdowns, and weather.' },
  { id: 'focus', name: 'Focus', description: 'Tasks, focus timer, next up, quick note, and day progress.' },
  { id: 'communication', name: 'Communication', description: 'Chats and RAVIN together.' },
  { id: 'blank', name: 'Blank Canvas', description: 'Hide everything and build the dashboard yourself.' },
];

const validIds = new Set<DashboardWidgetId>(DEFAULT_DASHBOARD_LAYOUT.map((item) => item.id));
const validSizes = new Set<DashboardWidgetSize>([...Object.keys(DASHBOARD_SIZE_PRESETS) as DashboardWidgetSize[], 'custom']);

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function dimensionsForLegacySize(size: string | undefined) {
  if (size === 'small') return DASHBOARD_SIZE_PRESETS.small;
  if (size === 'wide') return DASHBOARD_SIZE_PRESETS['extra-wide'];
  return DASHBOARD_SIZE_PRESETS.medium;
}

function cleanPresetName(name: string) {
  return name.trim().replace(/\s+/g, ' ').slice(0, 40);
}

function createPresetId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function closestDashboardSize(cols: number, rows: number): DashboardWidgetSize {
  const exact = Object.entries(DASHBOARD_SIZE_PRESETS).find(([, value]) => value.cols === cols && value.rows === rows);
  return exact ? exact[0] as DashboardWidgetSize : 'custom';
}

export function resizeDashboardWidget(widgetValue: DashboardWidgetPreference, cols: number, rows: number): DashboardWidgetPreference {
  const nextCols = clamp(cols, 2, 12);
  const nextRows = clamp(rows, 1, 6);
  return { ...widgetValue, cols: nextCols, rows: nextRows, size: closestDashboardSize(nextCols, nextRows) };
}

export function applyDashboardSize(widgetValue: DashboardWidgetPreference, size: Exclude<DashboardWidgetSize, 'custom'>): DashboardWidgetPreference {
  const dimensions = DASHBOARD_SIZE_PRESETS[size];
  return { ...widgetValue, size, cols: dimensions.cols, rows: dimensions.rows };
}

export function normalizeDashboardLayout(value: unknown): DashboardWidgetPreference[] {
  if (!Array.isArray(value)) return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  const seen = new Set<DashboardWidgetId>();
  const normalized: DashboardWidgetPreference[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as { id?: string; size?: string; visible?: unknown; cols?: unknown; rows?: unknown; x?: unknown; y?: unknown };
    const id = item.id as DashboardWidgetId;
    if (!validIds.has(id) || seen.has(id)) continue;
    seen.add(id);
    const legacy = dimensionsForLegacySize(item.size);
    const cols = typeof item.cols === 'number' ? clamp(item.cols, 2, 12) : legacy.cols;
    const rows = typeof item.rows === 'number' ? clamp(item.rows, 1, 6) : legacy.rows;
    const requestedSize = item.size as DashboardWidgetSize;
    normalized.push({
      id,
      cols,
      rows,
      size: validSizes.has(requestedSize) && requestedSize !== 'custom' && DASHBOARD_SIZE_PRESETS[requestedSize as Exclude<DashboardWidgetSize, 'custom'>]?.cols === cols && DASHBOARD_SIZE_PRESETS[requestedSize as Exclude<DashboardWidgetSize, 'custom'>]?.rows === rows
        ? requestedSize
        : closestDashboardSize(cols, rows),
      visible: item.visible !== false,
      ...(typeof item.x === 'number' && Number.isFinite(item.x) ? { x: clamp(item.x, 0, 11) } : {}),
      ...(typeof item.y === 'number' && Number.isFinite(item.y) ? { y: clamp(item.y, 0, 100) } : {}),
    });
  }
  for (const item of DEFAULT_DASHBOARD_LAYOUT) {
    if (!seen.has(item.id)) normalized.push({ ...item });
  }
  return normalized;
}

function normalizeCustomPreset(value: unknown): DashboardCustomPreset | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as { id?: unknown; name?: unknown; widgets?: unknown; createdAt?: unknown; updatedAt?: unknown };
  if (typeof raw.id !== 'string' || !raw.id.trim()) return null;
  if (typeof raw.name !== 'string') return null;
  const name = cleanPresetName(raw.name);
  if (!name) return null;
  if (!Array.isArray(raw.widgets)) return null;
  const now = new Date().toISOString();
  const createdAt = typeof raw.createdAt === 'string' && raw.createdAt ? raw.createdAt : now;
  const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt ? raw.updatedAt : createdAt;
  return {
    id: raw.id,
    name,
    widgets: normalizeDashboardLayout(raw.widgets),
    createdAt,
    updatedAt,
  };
}

export function readDashboardLayout(): DashboardWidgetPreference[] {
  if (typeof window === 'undefined') return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  try {
    const raw = window.localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    return raw ? normalizeDashboardLayout(JSON.parse(raw)) : DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  } catch {
    return DEFAULT_DASHBOARD_LAYOUT.map((item) => ({ ...item }));
  }
}

export function saveDashboardLayout(layout: DashboardWidgetPreference[]) {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizeDashboardLayout(layout);
    window.localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(DASHBOARD_LAYOUT_EVENT, { detail: normalized }));
  } catch {
    // Storage can be unavailable in strict/private contexts.
  }
}

export function resetDashboardLayout() {
  saveDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
}

export function readCustomDashboardPresets(): DashboardCustomPreset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DASHBOARD_CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(normalizeCustomPreset)
      .filter((preset): preset is DashboardCustomPreset => Boolean(preset))
      .slice(0, 24);
  } catch {
    return [];
  }
}

function writeCustomDashboardPresets(presets: DashboardCustomPreset[]) {
  const normalized = presets
    .map(normalizeCustomPreset)
    .filter((preset): preset is DashboardCustomPreset => Boolean(preset))
    .slice(0, 24);
  if (typeof window === 'undefined') return normalized;
  try {
    window.localStorage.setItem(DASHBOARD_CUSTOM_PRESETS_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(DASHBOARD_CUSTOM_PRESETS_EVENT, { detail: normalized }));
  } catch {
    // Storage can be unavailable in strict/private contexts.
  }
  return normalized;
}

export function saveCustomDashboardPreset(name: string, layout: DashboardWidgetPreference[]) {
  const cleanName = cleanPresetName(name);
  if (!cleanName) return null;
  const current = readCustomDashboardPresets();
  const now = new Date().toISOString();
  const existingIndex = current.findIndex((preset) => preset.name.toLowerCase() === cleanName.toLowerCase());
  const existing = existingIndex >= 0 ? current[existingIndex] : null;
  const preset: DashboardCustomPreset = {
    id: existing?.id ?? createPresetId(),
    name: cleanName,
    widgets: normalizeDashboardLayout(layout),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = [...current];
  if (existingIndex >= 0) next.splice(existingIndex, 1, preset);
  else next.unshift(preset);
  return { preset, presets: writeCustomDashboardPresets(next), updated: existingIndex >= 0 };
}

export function deleteCustomDashboardPreset(id: string) {
  return writeCustomDashboardPresets(readCustomDashboardPresets().filter((preset) => preset.id !== id));
}

export function dashboardSpan(value: DashboardWidgetPreference | DashboardWidgetSize) {
  if (typeof value !== 'string') return value.cols;
  if (value === 'custom') return 6;
  return DASHBOARD_SIZE_PRESETS[value].cols;
}

export function dashboardRowSpan(value: DashboardWidgetPreference | DashboardWidgetSize) {
  if (typeof value !== 'string') return value.rows;
  if (value === 'custom') return 2;
  return DASHBOARD_SIZE_PRESETS[value].rows;
}

function setVisible(layout: DashboardWidgetPreference[], visible: DashboardWidgetId[], order: DashboardWidgetId[], sizes: Partial<Record<DashboardWidgetId, Exclude<DashboardWidgetSize, 'custom'>>>) {
  const byId = new Map(layout.map((item) => [item.id, { ...item }]));
  for (const item of byId.values()) item.visible = visible.includes(item.id);
  for (const [id, size] of Object.entries(sizes) as Array<[DashboardWidgetId, Exclude<DashboardWidgetSize, 'custom'>]>) {
    const current = byId.get(id);
    if (current) byId.set(id, applyDashboardSize(current, size));
  }
  const ordered = order.map((id) => byId.get(id)).filter(Boolean) as DashboardWidgetPreference[];
  for (const item of byId.values()) if (!order.includes(item.id)) ordered.push(item);
  return normalizeDashboardLayout(ordered);
}

export function applyDashboardPreset(layout: DashboardWidgetPreference[], preset: DashboardPresetId): DashboardWidgetPreference[] {
  if (preset === 'blank') return layout.map((item) => ({ ...item, visible: false }));
  if (preset === 'school') return setVisible(layout,
    ['weather', 'schoolschedule', 'assignments', 'tasks', 'countdowns', 'calendar', 'askravin'],
    ['weather', 'schoolschedule', 'assignments', 'tasks', 'countdowns', 'calendar', 'askravin'],
    { weather: 'small', schoolschedule: 'wide', assignments: 'medium', tasks: 'medium', countdowns: 'small', calendar: 'medium', askravin: 'medium' });
  if (preset === 'focus') return setVisible(layout,
    ['tasks', 'focus', 'calendar', 'quicknote', 'dayprogress', 'weather'],
    ['tasks', 'focus', 'calendar', 'quicknote', 'dayprogress', 'weather'],
    { tasks: 'medium', focus: 'small', calendar: 'medium', quicknote: 'medium', dayprogress: 'extra-small', weather: 'small' });
  if (preset === 'communication') return setVisible(layout,
    ['chats', 'askravin', 'ravinbrief'],
    ['askravin', 'chats', 'ravinbrief'],
    { askravin: 'wide', chats: 'medium', ravinbrief: 'extra-wide' });
  return setVisible(layout,
    ['overview', 'weather', 'askravin', 'tasks', 'calendar', 'chats', 'quicklinks'],
    ['overview', 'weather', 'askravin', 'tasks', 'calendar', 'chats', 'quicklinks'],
    { overview: 'extra-wide', weather: 'medium', askravin: 'medium', tasks: 'medium', calendar: 'medium', chats: 'medium', quicklinks: 'extra-wide' });
}
