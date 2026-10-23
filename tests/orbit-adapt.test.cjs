const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = (name) => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

test('Orbit preserves the original world when the dashboard is opened', () => {
  const adapt = source('src/components/orbit-adapt.tsx');
  assert.match(adapt, /inert=\{view!==['"]orbit['"]\}/);
  assert.match(adapt, /\{children\}/);
  assert.match(adapt, /<OrbitDashboard\/>/);
  assert.match(adapt, /aria-pressed=\{selectedView===['"]orbit['"]\}/);
  assert.match(adapt, /Dashboard<\/button>/);
  assert.match(adapt, /dashboard-exit/);
});
test('shared widget identifiers and presets match Relay', () => {
  const sourceText = source('src/lib/dashboard-layout.ts');
  for (const widget of ['weather', 'tasks', 'calendar', 'chats', 'quicknote', 'focus', 'askravin', 'ravinbrief', 'schoolschedule']) {
    assert.ok(sourceText.includes("'" + widget + "'"), widget + ' is missing');
  }
  assert.match(sourceText, /export function normalizeDashboardLayout/);
  assert.match(sourceText, /export function applyDashboardPreset/);
});
test('account-scoped changes rely on authenticated ARROW shell and RLS', () => {
  const bridge = source('src/lib/orbit-dashboard-sync.ts');
  assert.match(bridge, /verified\(owner\)/);
  assert.match(bridge, /user_id=eq\./);
  assert.match(bridge, /orbit_dashboard_layout/);
  assert.match(bridge, /dashboard_presets/);
  assert.match(bridge, /resolution=merge-duplicates/);
  assert.doesNotMatch(bridge, /service_role/);
});
test('legacy Relay layouts are imported only with explicit consent', () => {
  const dashboard = source('src/components/orbit-dashboard.tsx');
  assert.match(dashboard, /window\.confirm\('Import this browser/);
  assert.match(dashboard, /importLegacy/);
  assert.match(dashboard, /updatePresets/);
});

test('day remaining uses a configurable active window independent of task momentum', () => {
  const dashboard = source('src/components/orbit-dashboard.tsx');
  assert.match(dashboard, /activeDay\(clockNow, dayWindow\)/);
  assert.match(dashboard, /08:00/);
  assert.match(dashboard, /22:00/);
  assert.match(dashboard, /case 'dayprogress': return/);
  assert.match(dashboard, /case 'momentum': return <Meter number=\{done\}/);
  assert.match(dashboard, /Active day start/);
  assert.match(dashboard, /Active day end/);
  assert.doesNotMatch(dashboard, /adapt-identity-intro/);
});
test('nested widget scrolling is disabled but the dashboard remains scrollable', () => {
  const styles = source('src/app/adapt.css');
  assert.match(styles, /\.orbit-app \.adapt-dashboard \{[\s\S]*?overflow-y:auto/);
  assert.match(styles, /\.orbit-app \.adapt-widget-content,[\s\S]*?overflow:hidden!important/);
  assert.match(styles, /orbit-dashboard-expand/);
  assert.match(styles, /orbit-dashboard-collapse/);
});
