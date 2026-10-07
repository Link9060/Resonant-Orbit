const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { JSDOM } = require('jsdom');
const source = readFileSync(process.env.ARROW_SHELL_SOURCE || 'public/arrow-shell.js', 'utf8');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('reset preferences keeps account planning data and explains what it changes',async()=>{
  const f=await fixture('relay');try{
    f.w.ArrowOS.openPanel('settings','relay');
    const panel=f.w.document.querySelector('.arrow-os-panel');
    assert.match(panel.textContent,/Preferences on this device/);
    assert.doesNotMatch(panel.textContent,/cloud sync is not connected/);
    assert.match(panel.textContent,/Tasks, notes, calendar and plans are saved to your account/);
    panel.querySelector('[data-settings-action="reset"]').click();
    assert.ok(!f.w.__fetchCalls.some(call=>['DELETE','PATCH','PUT','POST'].includes(call.options.method)));
    assert.ok(f.w.localStorage.getItem('sb-cnorozrjugxpanpfmssa-auth-token'));
  }finally{f.close();}
});

test('Escape stays in a module when a local map or dialog handles it',async()=>{
  const f=await fixture('atlas','','enabled','https://enterarrow.com/atlas/');
  try{
    for(const html of ['<canvas data-arrow-escape-local></canvas>','<section role="dialog" aria-modal="true"><button>Close</button></section>']){
      f.w.document.querySelector('#app').innerHTML=html;
      const target=f.w.document.querySelector('#app button,#app canvas');
      let handled=false;target.addEventListener('keydown',event=>{handled=true;event.preventDefault();});
      target.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));
      assert.equal(handled,true);assert.equal(f.w.document.querySelector('.arrow-os-handoff'),null);
    }
  }finally{f.close();}
});

async function fixture(module = 'orbit', query = '', orbitAccess = 'enabled', baseUrl = 'https://link9060.github.io/test/') {
  const dom = new JSDOM(`<html><body><div data-arrow-os-shell data-module="${module}" data-orbit-access="${orbitAccess}"></div><div id="app"></div></body></html>`, {
    url: baseUrl + query, runScripts: 'outside-only', pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.confirm = () => true;
  w.localStorage.setItem('arrow_os_theme_v1', 'dark');
  w.localStorage.setItem('sb-cnorozrjugxpanpfmssa-auth-token', JSON.stringify({
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id: '00000000-0000-0000-0000-000000000001', email: 'test@example.com' }
  }));
  w.__fetchCalls = [];
  w.fetch = async (url, options = {}) => {
    w.__fetchCalls.push({ url: String(url), options });
    return {
      ok: true,
      status: (options.method || 'GET').toUpperCase() === 'DELETE' ? 204 : 200,
      async json() { return []; },
      async text() { return '[]'; }
    };
  };
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

for (const module of ['orbit', 'relay', 'atlas', 'ravin', 'waypoint']) {
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


test('public Relay can show ARROW controls while Orbit stays disabled', async () => {
  const f = await fixture('relay', '', 'disabled');
  try {
    const orbit = f.w.document.querySelector('.arrow-os-orbit');
    assert.ok(orbit);
    assert.equal(orbit.disabled, true);
    assert.equal(orbit.getAttribute('aria-disabled'), 'true');
    assert.ok(orbit.classList.contains('is-disabled'));
    assert.match(orbit.textContent, /Orbit/);
    orbit.click();
    await delay(20);
    assert.equal(f.w.document.querySelectorAll('.arrow-os-blackhole-departure').length, 0);
  } finally { f.close(); }
});

test('Escape from a non-Orbit center triggers the canonical return handoff', async () => {
  const f = await fixture('relay', '', 'enabled', 'https://enterarrow.com/relay/');
  try {
    f.w.dispatchEvent(new f.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await delay(20);
    assert.equal(f.w.document.querySelectorAll('.arrow-os-blackhole-departure').length, 1);
  } finally { f.close(); }
});

test('enterarrow.com settings exposes ARROW sign out', async () => {
  const f = await fixture('relay', '', 'enabled', 'https://enterarrow.com/relay/');
  try {
    f.w.ArrowOS.openPanel('settings', 'relay');
    assert.ok(f.w.document.querySelector('[data-settings-action="signout"]'));
  } finally { f.close(); }
});

test('shared center handoff API is available to every non-Orbit module', async () => {
  const f = await fixture('waypoint');
  try {
    assert.equal(typeof f.w.ArrowOS.launchToOrbit, 'function');
    const orbitButton = f.w.document.querySelector('.arrow-os-orbit');
    assert.ok(orbitButton);
  } finally { f.close(); }
});

test('Back to Orbit collapses the current center into a black-hole handoff', async () => {
  const f = await fixture('waypoint');
  try {
    const anchor = f.w.document.querySelector('.arrow-os-trigger');
    f.w.ArrowOS.launchToOrbit('waypoint', anchor);
    await delay(20);
    assert.equal(f.w.document.querySelectorAll('.arrow-os-blackhole-departure').length, 1);
    assert.equal(f.w.document.querySelectorAll('.arrow-os-particle-canvas').length, 1);
    assert.equal(f.w.document.querySelectorAll('.arrow-os-transition-particle').length, 0);
    assert.ok(f.w.document.documentElement.classList.contains('arrow-os-blackhole-active'));
  } finally { f.close(); }
});

test('arrival creates one overlay, even while app content changes', async () => {
  const f = await fixture('atlas', '?from=orbit');
  try {
    assert.equal(f.w.document.querySelectorAll('.arrow-os-center-arrival').length, 1);
    for (let i = 0; i < 10; i++) f.w.ArrowOS.mountAll();
    assert.equal(f.w.document.querySelectorAll('.arrow-os-center-arrival').length, 1);
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

test('calendar uses shared ARROW data and ignores legacy local HTML', async () => {
  const f = await fixture();
  try {
    f.w.localStorage.setItem('arrow_os_events_v1', JSON.stringify([{id:'legacy', title:'legacy', date:'<img src=x onerror=alert(1)>'}]));
    f.w.ArrowOS.openPanel('calendar', 'orbit');
    await delay(15);
    assert.equal(f.w.document.querySelectorAll('.arrow-os-panel img').length, 0);
    assert.ok(f.w.__fetchCalls.some(call => call.url.includes('/rest/v1/relay_calendar_events')));
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

test('a settings change in another tab preserves an unfinished shared task draft', async () => {
  const f = await fixture();
  try {
    f.w.ArrowOS.openPanel('tasks', 'orbit');
    await delay(15);
    const input = f.w.document.querySelector('.arrow-os-task-form input[type="text"]');
    assert.ok(input);
    input.value = 'Unfinished draft';
    f.w.dispatchEvent(new f.w.StorageEvent('storage', {key:'arrow_os_theme_v1',newValue:'light'}));
    assert.equal(f.w.document.querySelector('.arrow-os-task-form input[type="text"]').value, 'Unfinished draft');
  } finally { f.close(); }
});

test('RAVIN is available everywhere and carries the active surface', async () => {
  const f = await fixture('waypoint');
  try {
    f.w.ArrowOS.openPanel('ravin', 'waypoint');
    const panel = f.w.document.querySelector('.arrow-os-panel');
    assert.match(panel.textContent, /RAVIN/);
    assert.match(panel.textContent, /planning mode/i);
    const full = [...panel.querySelectorAll('a')].find(link => /Open full RAVIN/.test(link.textContent));
    assert.ok(full);
    assert.match(full.href, /surface=waypoint/);
    assert.match(full.href, /from=waypoint/);
  } finally { f.close(); }
});

test('tasks panel reads the canonical Supabase todos table', async () => {
  const f = await fixture('relay');
  try {
    f.w.ArrowOS.openPanel('tasks', 'relay');
    await delay(15);
    assert.ok(f.w.__fetchCalls.some(call => call.url.includes('/rest/v1/todos')));
    assert.doesNotMatch(f.w.document.querySelector('.arrow-os-panel').textContent, /Saved locally/);
  } finally { f.close(); }
});

test('Full motion overrides an OS reduced-motion preference',async()=>{const f=await fixture();try{f.w.matchMedia=()=>({matches:true,addEventListener(){}});f.w.ArrowOS.applyMotion('full',true);assert.equal(f.w.document.documentElement.dataset.arrowMotion,'full');f.w.ArrowOS.applyMotion('system',true);assert.equal(f.w.document.documentElement.dataset.arrowMotion,'reduce');}finally{f.close();}});
test('Support submits a location-scoped request through the existing RPC',async()=>{const f=await fixture('atlas');try{f.w.ArrowOS.openPanel('support','atlas');await delay(30);const form=f.w.document.querySelector('#arrow-support-form');form.querySelector('[name="subject"]').value='Map issue';form.querySelector('[name="description"]').value='Could not zoom';form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await delay(30);const call=f.w.__fetchCalls.find(c=>c.url.endsWith('/rpc/submit_staff_request'));assert.ok(call);const body=JSON.parse(call.options.body);assert.equal(body.p_metadata.module,'atlas');assert.equal(body.p_subject,'[atlas] Map issue');}finally{f.close();}});
test('Nonstaff users cannot see or call account controls',async()=>{const f=await fixture();try{f.w.ArrowOS.openPanel('moderation','orbit');await delay(30);assert.match(f.w.document.querySelector('.arrow-os-panel-body').textContent,/Staff access is required/);assert.ok(!f.w.__fetchCalls.some(c=>c.url.endsWith('/rpc/admin_list_users_v2')));}finally{f.close();}});

test('concurrent shared panels refresh an expired session once',async()=>{
  const f=await fixture();try{
    const key='sb-cnorozrjugxpanpfmssa-auth-token';const session=JSON.parse(f.w.localStorage.getItem(key));session.expires_at=1;f.w.localStorage.setItem(key,JSON.stringify(session));let refreshes=0;
    f.w.fetch=async(url)=>{const refresh=String(url).includes('/auth/v1/token');if(refresh){refreshes++;await delay(20);}return {ok:true,status:200,json:async()=>refresh?{...session,access_token:'fresh',expires_at:Math.floor(Date.now()/1000)+3600}:[],text:async()=>refresh?JSON.stringify({...session,access_token:'fresh',expires_at:Math.floor(Date.now()/1000)+3600}):'[]'};};
    await Promise.all([f.w.ArrowOS.data('/rest/v1/todos'),f.w.ArrowOS.data('/rest/v1/notes')]);assert.equal(refreshes,1);assert.equal(JSON.parse(f.w.localStorage.getItem(key)).access_token,'fresh');
  }finally{f.close();}
});
test('moderator controls expose project queues without owner account tools',async()=>{
 const f=await fixture();try{f.w.fetch=async(url)=>({ok:true,status:200,text:async()=>String(url).includes('/profiles?')?'[{"role":"moderator","banned_at":null}]':'[]',json:async()=>String(url).includes('/profiles?')?[{role:'moderator',banned_at:null}]:[]});f.w.ArrowOS.openPanel('moderation','orbit');await delay(30);assert.ok(f.w.document.querySelector('[data-queue="reports"]'));assert.ok(f.w.document.querySelector('[data-queue="email"]'));assert.equal(f.w.document.querySelector('[data-queue="users"]'),null);assert.equal(f.w.document.querySelector('[data-queue="audit"]'),null);}finally{f.close();}
});

test('Back restores controls after a center departure and permits another navigation',async()=>{
 const f=await fixture('orbit','','enabled','https://enterarrow.com/orbit/');try{
  f.w.HTMLCanvasElement.prototype.getContext=()=>null;
  f.w.ArrowOS.navigate('/waypoint/','orbit');await delay(25);
  assert.equal(f.w.document.querySelectorAll('.arrow-os-blackhole-departure').length,1);
  f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow',{persisted:true}));
  assert.equal(f.w.document.querySelectorAll('.arrow-os-handoff').length,0);
  assert.equal(f.w.document.querySelectorAll('.arrow-os-gravity-target').length,0);
  assert.equal(f.w.document.documentElement.classList.contains('arrow-os-blackhole-active'),false);
  f.w.ArrowOS.navigate('/atlas/','orbit');assert.equal(f.w.document.querySelectorAll('.arrow-os-blackhole-departure').length,1);
  f.w.dispatchEvent(new f.w.PageTransitionEvent('pageshow',{persisted:true}));
 }finally{f.close();}
});

test('beta navigation stays in beta for every module and preserves deep links',async()=>{
 const f=await fixture('relay','','enabled','https://link9060.github.io/Resonant-Relay/');try{
  for(const [input,expected] of [['/orbit/','/Resonant-Relay/arrow/orbit/'],['/waypoint/?tab=calendar&item=123','/Resonant-Relay/arrow/waypoint/?tab=calendar&item=123'],['/relay/notes/','/Resonant-Relay/notes/'],['https://enterarrow.com/ravin/?surface=atlas','/Resonant-Relay/arrow/ravin/?surface=atlas'],['https://link9060.github.io/Resonant-Field/','/Resonant-Relay/arrow/atlas/']])assert.equal(new URL(f.w.ArrowOS.resolveHref(input)).pathname+new URL(f.w.ArrowOS.resolveHref(input)).search,expected);
  assert.equal(f.w.ArrowOS.resolveHref('https://example.com/'),'https://example.com/');
 }finally{f.close();}
});

test('owner overview renders readable metrics and storage without raw account identifiers',async()=>{
  const f=await fixture('orbit');
  try{
    f.w.fetch=async url=>{
      const path=String(url);
      const data=path.includes('/profiles?')?[{role:'owner'}]:path.includes('owner_dashboard_stats')?{profiles:{total:19,active_7d:5},generated_at:'2026-10-02T00:00:00Z'}:path.includes('owner_storage_overview')?{file_total_bytes:1048576,top_users:[{id:'private-raw-id',display_name:'Test account',file_bytes:1024,total_bytes:2048}]}:[];
      return {ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data)};
    };
    f.w.ArrowOS.openPanel('moderation','orbit');await delay(30);
    f.w.document.querySelector('[data-queue="overview"]').click();await delay(30);
    const panel=f.w.document.querySelector('.arrow-os-panel');
    assert.match(panel.textContent,/Active this week/);
    assert.match(panel.textContent,/1 MB/);
    assert.match(panel.textContent,/Test account/);
    assert.doesNotMatch(panel.textContent,/private-raw-id|\{"|top_users/);
    assert.equal(panel.querySelectorAll('.arrow-staff-metric').length,3);
    assert.equal(panel.querySelectorAll('table tbody tr').length,1);
  }finally{f.close();}
});

test('shared calendar includes owned events, Relay plan instances and connected multi-day events without write signals',async()=>{
  const f=await fixture('orbit','','enabled','https://link9060.github.io/Resonant-Relay/arrow/orbit/');
  try{
    let signals=0;f.w.addEventListener('arrow:planning-changed',()=>signals++);
    const calls=[];
    f.w.fetch=async (url,options={})=>{
      calls.push(String(url));
      const path=String(url);
      const data=path.includes('relay_calendar_events')?[{id:'owned',title:'Shared event',event_date:'2026-10-02',start_time:'09:00',end_time:'10:00'}]:path.includes('group_members')?[{group_id:'group'}]:path.includes('/plans?')?[{id:'plan',name:'Group meeting',start_time:'11:00',end_time:'12:00',instances:[{id:'instance',occurs_on:'2026-10-02'}]}]:path.includes('calendar-hub')?{events:[{id:'provider',accountId:'calendar',summary:'Trip',start:'2026-10-02',end:'2026-10-04',isAllDay:true,htmlLink:'javascript:bad'}],accountErrors:[]}:[];
      return {ok:true,status:200,json:async()=>data,text:async()=>JSON.stringify(data)};
    };
    const result=await f.w.ArrowOS.loadCalendarSources();
    assert.equal(result.events.length,4);
    assert.equal(result.events.filter(e=>e.title==='Trip').length,2);
    assert.equal(result.events.find(e=>e.id==='owned').read_only,undefined);
    const plan=result.events.find(e=>e.id==='relay-plan-instance');
    assert.equal(plan.read_only,true);
    assert.equal(plan.source_href,'https://link9060.github.io/Resonant-Relay/planner/view/?id=plan');
    assert.ok(result.events.filter(e=>e.title==='Trip').every(e=>e.is_all_day&&e.source_href==='https://link9060.github.io/Resonant-Relay/calendar/'));
    assert.ok(calls.some(path=>path.includes('group_members?user_id=eq.00000000-0000-0000-0000-000000000001')));
    assert.equal(signals,0);
    assert.equal(result.warnings.length,0);
  }finally{f.close();}
});

test('Escape closes the shared panel before leaving a center',async()=>{
  const f=await fixture('relay','','enabled','https://enterarrow.com/relay/');
  try {f.w.ArrowOS.openPanel('appearance','relay');f.w.document.querySelector('[data-theme-choice="light"]').dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(f.w.document.querySelector('.arrow-os-panel').hidden,true);assert.equal(f.w.document.querySelector('.arrow-os-handoff'),null);}finally{f.close();}
});
test('custom color persists through reload and reaches center variables',async()=>{
  const f=await fixture('orbit');try{f.w.ArrowOS.applyAccent('#19a7c4',true);assert.equal(f.w.document.documentElement.dataset.arrowAccent,'custom');assert.equal(f.w.localStorage.getItem('arrow_os_custom_accent_v1'),'#19a7c4');assert.equal(f.w.document.documentElement.style.getPropertyValue('--rv-accent'),'25 167 196');f.w.ArrowOS.applyAccent('custom',false);assert.equal(f.w.document.documentElement.style.getPropertyValue('--arrow-accent-color'),'#19a7c4');}finally{f.close();}
});
test('failed task write reports the error, keeps the draft and re-enables submit',async()=>{
  const f=await fixture('relay');try{f.w.ArrowOS.openPanel('tasks','relay');await delay(30);f.w.fetch=async()=>({ok:false,status:500,json:async()=>({message:'Network error'})});const form=f.w.document.querySelector('.arrow-os-task-form');form.querySelector('input').value='Keep my draft';form.dispatchEvent(new f.w.Event('submit',{bubbles:true,cancelable:true}));await delay(30);assert.equal(form.querySelector('input').value,'Keep my draft');assert.equal(form.querySelector('button').disabled,false);assert.match(f.w.document.querySelector('[role="alert"]').textContent,/Network error/);}finally{f.close();}
});
test('settings exposes account, notification, help and legal destinations in beta',async()=>{
  const f=await fixture('orbit','','enabled','https://link9060.github.io/Resonant-Relay/arrow/orbit/');try{f.w.ArrowOS.openPanel('settings','orbit');const links=[...f.w.document.querySelectorAll('.arrow-os-settings-actions a')].map(a=>a.href);for(const path of ['profile/','profile/#notifications','help/','privacy/','terms/'])assert.ok(links.some(href=>href.endsWith('/Resonant-Relay/'+path)),path);}finally{f.close();}
});

test('hover tray survives the gap and cancels pending closure on reentry',async()=>{
 const f=await fixture();try{const root=f.w.document.querySelector('.arrow-os-root');root.dispatchEvent(new f.w.MouseEvent('mouseenter'));assert.equal(root.dataset.open,'true');root.dispatchEvent(new f.w.MouseEvent('mouseleave'));await delay(60);assert.equal(root.dataset.open,'true');root.dispatchEvent(new f.w.MouseEvent('mouseenter'));await delay(200);assert.equal(root.dataset.open,'true');root.dispatchEvent(new f.w.MouseEvent('mouseleave'));await delay(200);assert.equal(root.dataset.open,'false');}finally{f.close();}
});
test('Escape closes an open tray and focuses its trigger before any center navigation',async()=>{
 const f=await fixture('relay','','enabled','https://enterarrow.com/relay/');try{const root=f.w.document.querySelector('.arrow-os-root');root.dispatchEvent(new f.w.MouseEvent('mouseenter'));f.w.document.body.dispatchEvent(new f.w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));assert.equal(root.dataset.open,'false');assert.ok(root.contains(f.w.document.activeElement));assert.equal(f.w.document.querySelector('.arrow-os-handoff'),null);}finally{f.close();}
});


test('shared shell cannot restore a session after sign-out during refresh',async()=>{
  const f=await fixture('relay');
  try {
    const session=JSON.parse(f.w.localStorage.getItem('sb-cnorozrjugxpanpfmssa-auth-token'));session.expires_at=1;
    f.w.localStorage.setItem('sb-cnorozrjugxpanpfmssa-auth-token',JSON.stringify(session));
    let release;const pending=new Promise(resolve=>{release=resolve;});
    f.w.fetch=async()=>{await pending;return {ok:true,json:async()=>({...session,access_token:'fresh',refresh_token:'rotated'})};};
    const request=f.w.ArrowOS.data('/rest/v1/notes');
    f.w.localStorage.removeItem('sb-cnorozrjugxpanpfmssa-auth-token');release();
    await assert.rejects(request,/account changed/);assert.equal(f.w.localStorage.getItem('sb-cnorozrjugxpanpfmssa-auth-token'),null);
  }finally{f.close();}
});
test('shared shell discards a late private-data response after account switching',async()=>{
  const f=await fixture('relay');
  try {
    let release;const pending=new Promise(resolve=>{release=resolve;});
    f.w.fetch=async()=>{await pending;return {ok:true,status:200,text:async()=> '[{"title":"private"}]'};};
    const request=f.w.ArrowOS.data('/rest/v1/notes');
    f.w.localStorage.removeItem('sb-cnorozrjugxpanpfmssa-auth-token');release();
    await assert.rejects(request,/account changed/);
  }finally{f.close();}
});
