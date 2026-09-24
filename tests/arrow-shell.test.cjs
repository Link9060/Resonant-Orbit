const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
const source = readFileSync(process.env.ARROW_SHELL_SOURCE || 'public/arrow-shell.js', 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fixture(module = 'orbit', query = '') {
  const dom = new JSDOM(`<html><body><div data-arrow-os-shell data-module="${module}"></div><div id="app"></div></body></html>`, {
    url: 'https://link9060.github.io/test/' + query, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.confirm = () => true;
  w.localStorage.setItem('arrow_os_theme_v1', 'dark');
  // Cap runaway observer delivery so the old crash fails instead of hanging CI.
  const NativeObserver = w.MutationObserver;
  const observers = [];
  let deliveries = 0;
  w.MutationObserver = class extends NativeObserver {
    constructor(callback) {
      super((...args) => {
        if (++deliveries > 100) { observers.forEach(o => o.disconnect()); return; }
        callback(...args);
      });
      observers.push(this);
    }
  };
  let themes = 0;
  w.addEventListener('arrow:themechange', () => themes++);
  w.eval(source);
  await delay(50);
  return { w, dom, close: () => { observers.forEach(o => o.disconnect()); dom.window.close(); }, deliveries: () => deliveries, themes: () => themes };
}

for (const module of ['orbit', 'relay', 'atlas', 'ravin']) {
  test(`${module}: Appearance settles and retains focus while changing every setting`, async () => {
    const f = await fixture(module);
    try {
      f.w.ArrowOS.openPanel('appearance', module);
      await delay(50);
      assert.ok(f.deliveries() < 100, 'mutation feedback loop');
      for (const kind of ['theme', 'motion', 'experience', 'accent']) {
        for (const button of f.w.document.querySelectorAll(`[data-${kind}-choice]`)) {
          button.focus(); button.click();
          await delay(5);
          assert.equal(f.w.document.activeElement, button, 'choice lost keyboard focus');
          assert.equal(button.getAttribute('aria-pressed'), 'true');
        }
      }
      assert.ok(f.deliveries() < 100, 'appearance keeps causing DOM deliveries');
      const themes = f.themes();
      for (let i = 0; i < 100; i++) f.w.document.querySelector('#app').textContent = String(i);
      await delay(40);
      assert.equal(f.themes(), themes, 'unrelated app updates reapply theme');
    } finally { f.close(); }
  });
}

test('arrival creates one overlay, even while app content changes', async () => {
  const f = await fixture('atlas', '?from=orbit');
  try {
    assert.equal(f.w.document.querySelectorAll('.arrow-os-arrival').length, 1);
    for (let i = 0; i < 10; i++) f.w.ArrowOS.mountAll();
    assert.equal(f.w.document.querySelectorAll('.arrow-os-arrival').length, 1);
    assert.ok(f.deliveries() < 100);
  } finally { f.close(); }
});

test('route remount and duplicate script retain exactly one mounted control', async () => {
  const f = await fixture();
  try {
    f.w.document.querySelector('[data-arrow-os-shell]').remove();
    const mount = f.w.document.createElement('div');
    mount.setAttribute('data-arrow-os-shell', ''); mount.dataset.module = 'orbit';
    f.w.document.body.append(mount);
    await delay(50);
    f.w.eval(source);
    assert.equal(f.w.document.querySelectorAll('.arrow-os-root').length, 1);
    assert.equal(f.w.document.querySelectorAll('.arrow-os-trigger').length, 1);
  } finally { f.close(); }
});

test('calendar imported text is escaped and settings accepts malformed stored lists', async () => {
  const f = await fixture();
  try {
    f.w.localStorage.setItem('arrow_os_events_v1', JSON.stringify([{id:'test', title:'test', date:'<img src=x onerror=alert(1)>'}]));
    f.w.ArrowOS.openPanel('calendar', 'orbit');
    assert.equal(f.w.document.querySelectorAll('.arrow-os-panel img').length, 0);
    f.w.localStorage.setItem('arrow_os_tasks_v1', '{}');
    f.w.ArrowOS.openPanel('settings', 'orbit');
    assert.ok(!f.w.document.querySelector('.arrow-os-panel').textContent.includes('undefined tasks'));
  } finally { f.close(); }
});

test('reset restores accent and experience as well as theme and motion', async () => {
  const f = await fixture();
  try {
    f.w.ArrowOS.applyExperienceChoice('glass', true);
    f.w.ArrowOS.applyAccent('rose', true);
    f.w.ArrowOS.openPanel('settings', 'orbit');
    f.w.document.querySelector('[data-settings-action="reset"]').click();
    assert.equal(f.w.document.documentElement.dataset.arrowAccent, 'mono');
    assert.equal(f.w.document.documentElement.dataset.arrowExperience, 'balanced');
  } finally { f.close(); }
});

test('a settings change in another tab preserves an unfinished task', async () => {
  const f = await fixture();
  try {
    f.w.ArrowOS.openPanel('tasks', 'orbit');
    const input = f.w.document.querySelector('.arrow-os-task-form input');
    input.value = 'Unfinished draft';
    f.w.dispatchEvent(new f.w.StorageEvent('storage', {key:'arrow_os_theme_v1',newValue:'light'}));
    assert.equal(f.w.document.querySelector('.arrow-os-task-form input').value, 'Unfinished draft');
  } finally { f.close(); }
});
