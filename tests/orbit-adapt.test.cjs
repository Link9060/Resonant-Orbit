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
  assert.match(adapt, /aria-pressed=\{view===['"]orbit['"]\}/);
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
