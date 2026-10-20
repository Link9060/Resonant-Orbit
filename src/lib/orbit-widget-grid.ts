import type { DashboardWidgetId, DashboardWidgetPreference } from './dashboard-layout';

/** Twelve-column coordinate system. Positions survive account sync and presets. */
export const GRID_COLUMNS = 12;
export const MAX_GRID_ROWS = 100;
export type GridPoint = { x: number; y: number };
export type PlacedWidget = DashboardWidgetPreference & { x: number; y: number };
const inside = (x: number, y: number, cols: number, rows: number) =>
  Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 &&
  cols > 0 && rows > 0 && x + cols <= GRID_COLUMNS && y + rows <= MAX_GRID_ROWS;
export function overlaps(a: GridPoint & { cols: number; rows: number }, b: GridPoint & { cols: number; rows: number }): boolean {
  return a.x < b.x + b.cols && a.x + a.cols > b.x &&
    a.y < b.y + b.rows && a.y + a.rows > b.y;
}
export function placementFits(
  widgets: PlacedWidget[], id: DashboardWidgetId, point: GridPoint, cols: number, rows: number,
): boolean {
  return inside(point.x, point.y, cols, rows) &&
    !widgets.some(w => w.visible && w.id !== id && overlaps({ ...point, cols, rows }, w));
}
export function firstSpace(widgets: PlacedWidget[], id: DashboardWidgetId, cols: number, rows: number): GridPoint | null {
  for (let y = 0; y < MAX_GRID_ROWS; y++) {
    for (let x = 0; x <= GRID_COLUMNS - cols; x++) {
      if (placementFits(widgets, id, { x, y }, cols, rows)) return { x, y };
    }
  }
  return null;
}
/** Respect valid saved positions; reflow only old/overlapping/invalid entries. */
export function packDashboard(widgets: DashboardWidgetPreference[]): PlacedWidget[] {
  const occupied: PlacedWidget[] = [];
  const placed = new Map<DashboardWidgetId, PlacedWidget>();
  for (const item of widgets) {
    if (!item.visible) continue;
    const requested = { x: item.x, y: item.y };
    const hasPosition = typeof requested.x === 'number' && typeof requested.y === 'number';
    const origin = hasPosition && placementFits(occupied, item.id, { x: requested.x!, y: requested.y! }, item.cols, item.rows)
      ? { x: requested.x!, y: requested.y! }
      : firstSpace(occupied, item.id, item.cols, item.rows);
    if (!origin) continue;
    const result = { ...item, ...origin };
    occupied.push(result); placed.set(item.id, result);
  }
  return widgets.map(item => placed.get(item.id) ||
    ({ ...item, x: item.x ?? 0, y: item.y ?? 0 }));
}
export function placeWidget(
  widgets: DashboardWidgetPreference[], id: DashboardWidgetId, point: GridPoint,
  cols?: number, rows?: number,
): DashboardWidgetPreference[] | null {
  const packed = packDashboard(widgets);
  const item = packed.find(w => w.id === id);
  if (!item) return null;
  const width = cols ?? item.cols, height = rows ?? item.rows;
  if (!placementFits(packed, id, point, width, height)) return null;
  return packed.map(w => w.id === id ? { ...w, visible: true, cols: width, rows: height, ...point } : w);
}
export function autoPlaceWidget(
  widgets: DashboardWidgetPreference[], id: DashboardWidgetId, cols: number, rows: number,
): DashboardWidgetPreference[] | null {
  const packed = packDashboard(widgets);
  const point = firstSpace(packed, id, cols, rows);
  return point ? placeWidget(packed, id, point, cols, rows) : null;
}
export function gridRows(widgets: DashboardWidgetPreference[], padding = 5): number {
  return Math.min(MAX_GRID_ROWS, Math.max(12, ...packDashboard(widgets).filter(w => w.visible).map(w => w.y + w.rows + padding)));
}
export function highlightedCells(
  widgets: PlacedWidget[], id: DashboardWidgetId, point: GridPoint | null, cols: number, rows: number,
): { green: Set<string>; red: Set<string>; valid: boolean } {
  const green = new Set<string>(), red = new Set<string>();
  if (!point) return { green, red, valid: false };
  for (let y = point.y; y < point.y + rows; y++) for (let x = point.x; x < point.x + cols; x++) {
    const key = x + ':' + y;
    const conflict = x >= GRID_COLUMNS || y >= MAX_GRID_ROWS || x < 0 || y < 0 ||
      widgets.some(w => w.visible && w.id !== id && x >= w.x && x < w.x + w.cols && y >= w.y && y < w.y + w.rows);
    (conflict ? red : green).add(key);
  }
  return { green, red, valid: placementFits(widgets, id, point, cols, rows) };
}
