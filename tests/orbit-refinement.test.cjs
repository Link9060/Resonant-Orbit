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
