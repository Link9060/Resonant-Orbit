const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const ts=require('typescript'),React=require('react'),{JSDOM}=require('jsdom');
function loader(globals){const cache=new Map();return function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText;vm.runInNewContext(code,{exports,setTimeout,clearTimeout,setInterval,clearInterval,...globals,require:id=>{if(id.startsWith('@/')||id.startsWith('.')){let target=id.startsWith('@/')?path.resolve('src',id.slice(2)):path.resolve(path.dirname(file),id);if(!/\.[jt]sx?$/.test(target))target+=fs.existsSync(target+'.tsx')?'.tsx':'.ts';return load(target);}return require(id);}});return exports;};}

test('entertainment swaps only after the existing sphere has collapsed and finishes reformed',()=>{
 const model=loader({})('src/lib/entertainment-transition.ts');
 assert.equal(model.entertainmentFrame(0).collapse,0);
 assert.equal(model.entertainmentFrame(model.ENTERTAINMENT_SWAP_MS).collapse,1);
 assert.equal(model.entertainmentFrame(model.ENTERTAINMENT_DURATION_MS).collapse,0);
 assert.equal(model.entertainmentFrame(model.ENTERTAINMENT_DURATION_MS).complete,true);
});

test('particle collapse reuses the same dots and preserves a bounded center',()=>{
 const {createCloudRenderer}=loader({})('src/lib/particle-renderer.ts');const renderer=createCloudRenderer(true,{density:.35});
 let points=[];const ctx={canvas:{height:800},getTransform:()=>({d:1}),fillRect:(x,y)=>points.push([x,y])};
 renderer(ctx,400,400,800,0,true,{collapse:0,reduceMotion:true});const count=points.length;assert.ok(count>100);
 points=[];renderer(ctx,400,400,800,0,true,{collapse:1,reduceMotion:true});assert.equal(points.length,count);
 assert.ok(points.every(([x,y])=>Math.abs(x-400)<3&&Math.abs(y-400)<3));
});

test('ship pulses without starting a game; staged mode swap, previews and Escape remain isolated',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://link9060.github.io/Resonant-Relay/arrow/orbit/',pretendToBeVisual:true});const w=dom.window;
 const keys=['window','document','HTMLElement','HTMLButtonElement','Element','location','navigator','ResizeObserver','IS_REACT_ACT_ENVIRONMENT'];const previous=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(global,k)]));
 const timers=new Map();let next=0;w.setTimeout=(fn,ms)=>{const id=++next;timers.set(id,{fn,ms});return id;};w.clearTimeout=id=>timers.delete(id);w.requestAnimationFrame=()=>1;w.cancelAnimationFrame=()=>{};
 w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){}});
 w.ResizeObserver=class{observe(){}disconnect(){}};
 w.HTMLCanvasElement.prototype.getContext=function(){return new Proxy({canvas:this,getTransform:()=>({d:1})},{get:(o,k)=>k in o?o[k]:()=>{}});};
 w.ArrowOS={data:async()=>[],nextMove:async()=>({next:null,source:'test'}),staffRole:async()=>'user'};
 w.localStorage.setItem('orbit-command-onboarding-v1','1');
 w.document.documentElement.dataset.arrowMotion='full';
 for(const [k,v] of Object.entries({window:w,document:w.document,HTMLElement:w.HTMLElement,HTMLButtonElement:w.HTMLButtonElement,Element:w.Element,location:w.location,navigator:w.navigator,ResizeObserver:w.ResizeObserver,IS_REACT_ACT_ENVIRONMENT:true}))Object.defineProperty(global,k,{configurable:true,writable:true,value:v});
 const globals={window:w,document:w.document,HTMLElement:w.HTMLElement,HTMLButtonElement:w.HTMLButtonElement,Element:w.Element,ResizeObserver:w.ResizeObserver,location:w.location,navigator:w.navigator,performance,URL,URLSearchParams,localStorage:w.localStorage,console};
 const {OrbitWorld}=loader(globals)('src/components/orbit-world.tsx');const {createRoot}=require('react-dom/client');const root=createRoot(w.document.querySelector('#root'));
 const act=React.act;const click=async(element,event='click')=>act(async()=>element.dispatchEvent(new w.MouseEvent(event,{bubbles:true,cancelable:true})));
 const fire=async ms=>{const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,'Missing timer '+ms);timers.delete(entry[0]);await act(async()=>entry[1].fn());};
 try{
  await act(async()=>root.render(React.createElement(OrbitWorld)));
  assert.equal(w.document.querySelector('.command-recent'),null);
  const ship=w.document.querySelector('.orbit-ship-control');assert.equal(ship.getAttribute('aria-label'),'Pulse the ARROW ship');
  await click(ship);assert.ok(w.document.querySelector('.ship-glyph.is-pulsing'));assert.equal(w.document.querySelector('.ent-preview-backdrop'),null);assert.ok(!w.document.querySelector('.world-shell').classList.contains('entertainment-mode'));
  await click(w.document.querySelector('.orbit-core-label'),'dblclick');
  assert.ok(w.document.querySelector('.world-shell').classList.contains('entertainment-entering'));assert.ok(!w.document.querySelector('.world-shell').classList.contains('entertainment-mode'));assert.equal(ship.disabled,true);
  await fire(1050);assert.ok(w.document.querySelector('.world-shell').classList.contains('entertainment-mode'));
  await fire(2400);assert.ok(!w.document.querySelector('.world-shell').classList.contains('entertainment-entering'));
  await click(w.document.querySelector('.destination-node[data-center="atlas"]'));
  assert.match(w.document.querySelector('.ent-preview-backdrop').textContent,/proper game/);assert.equal(w.document.querySelector('.flight-field'),null);
  await act(async()=>w.document.querySelector('.ent-preview-backdrop').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  assert.equal(w.document.querySelector('.ent-preview-backdrop'),null);
  await act(async()=>w.document.body.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true})));
  assert.ok(w.document.querySelector('.world-shell').classList.contains('entertainment-leaving'));
  await fire(1050);await fire(2400);assert.ok(!w.document.querySelector('.world-shell').classList.contains('entertainment-mode'));
 }finally{await act(async()=>root.unmount());dom.window.close();for(const k of keys){if(previous[k])Object.defineProperty(global,k,previous[k]);else delete global[k];}}
});

test('Orbit staff entry follows experience previews and shared workspace actions use the shared shell',async()=>{
 const dom=new JSDOM('<div id="root"></div>',{url:'https://example.test/orbit/',pretendToBeVisual:true});const w=dom.window;const keys=['window','document','HTMLElement','Element','navigator','IS_REACT_ACT_ENVIRONMENT'];const previous=Object.fromEntries(keys.map(k=>[k,Object.getOwnPropertyDescriptor(global,k)]));let role='owner';const opened=[];w.matchMedia=()=>({matches:false});w.ArrowOS={staffRole:async()=>role,openPanel:(...args)=>opened.push(args),navigate:(...args)=>opened.push(args)};
 for(const key of keys)Object.defineProperty(global,key,{configurable:true,value:key==='IS_REACT_ACT_ENVIRONMENT'?true:w[key]});
 const {createRoot}=require('react-dom/client');const root=createRoot(w.document.getElementById('root'));const {OrbitCommandPanel}=loader({window:w,document:w.document,localStorage:w.localStorage})('src/components/orbit-command-panel.tsx');
 try{
  await React.act(async()=>{root.render(React.createElement(OrbitCommandPanel,{statuses:{},relayOnlyAccess:false,onOpenNavigator(){},onFocusDestination(){},onOpenModule(){},onQuickCapture(){},onReplayIntro(){}}));await new Promise(resolve=>setTimeout(resolve,0));});
  const button=label=>[...w.document.querySelectorAll('button')].find(node=>node.textContent.trim()===label);
  assert.ok(button('Staff control'));
  await React.act(async()=>{role='user';w.dispatchEvent(new w.CustomEvent('relay-role-preview-change'));});assert.equal(button('Staff control'),undefined);
  await React.act(async()=>{role='moderator';w.dispatchEvent(new w.CustomEvent('relay-role-preview-change'));});assert.ok(button('Staff control'));
  await React.act(async()=>{button('Notes').click();button('To-dos').click();button('Calendar').click();button('Contacts ↗').click();});assert.deepEqual(opened.map(call=>call[0]),['notes','tasks','calendar','/relay/contacts/']);
 }finally{await React.act(async()=>root.unmount());dom.window.close();for(const key of keys){if(previous[key])Object.defineProperty(global,key,previous[key]);else delete global[key];}}
});

test('light Orbit paints visibly dark identity-colored dots without CSS inversion',()=>{
 const {createCloudRenderer}=loader({})('src/lib/particle-renderer.ts');
 const renderer=createCloudRenderer(true,{density:.35});
 const colors=[];
 const ctx={canvas:{height:800},getTransform:()=>({d:1}),fillRect(){colors.push(this.fillStyle);}};
 for(const pigment of ['#894473','#466852','#34332f','#57429b']){
   colors.length=0;
   renderer(ctx,400,400,800,0,false,{particleColor:pigment,reduceMotion:true});
   assert.ok(colors.length>100);
   assert.ok(colors.every(color=>color===pigment),pigment+' should be visible on the light background');
 }
 const css=fs.readFileSync('src/app/adapt.css','utf8');
 assert.doesNotMatch(css,/filter:invert\(/,'light-mode particle canvas must never be inverted');
 for(const identity of ['bloom','haven','atelier','pulse']){
   assert.ok(css.includes('data-arrow-theme="light"] .orbit-app[data-orbit-adapt="'+identity+'"] { --orbit-dot-ink:'),
     identity+' must define a dark light-mode dot pigment');
 }
});

test('incoming black hole uses per-identity colors, including the release particles',()=>{
 const css=fs.readFileSync('src/app/adapt.css','utf8');
 const world=fs.readFileSync('src/components/orbit-world.tsx','utf8');
 for(const identity of ['bloom','haven','atelier','pulse']){
   assert.ok(css.includes('.orbit-app[data-orbit-adapt="'+identity+'"] {\n  --orbit-bh-primary:'),
     identity+' needs a distinctive dark black-hole palette');
   assert.ok(css.includes('data-arrow-theme="light"] .orbit-app[data-orbit-adapt="'+identity+'"] {\n  --orbit-bh-primary:'),
     identity+' needs an individual light black-hole palette');
 }
 for(const part of ['incoming-bh-halo','incoming-bh-disk-main','incoming-bh-photon-ring','incoming-bh-core']){
   assert.ok(css.includes('.orbit-app[data-orbit-adapt] .'+part),part+' must use the themed palette');
 }
 assert.match(world,/orbit-bh-particle-rgb/);
 assert.match(world,/isLight \? 'source-over' : 'lighter'/);
});
