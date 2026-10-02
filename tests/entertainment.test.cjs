const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {JSDOM}=require('jsdom');
const React=require('react');

test('Flight pauses timers, supports keyboard steering, contains focus and restores it on close',async()=>{
  const dom=new JSDOM('<button id="launch">Play</button><div id="root"></div>',{url:'https://example.com/',pretendToBeVisual:true});
  const previous={window:global.window,document:global.document,HTMLElement:global.HTMLElement,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(global,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=require('react-dom/client');
  let hidden=false;Object.defineProperty(document,'hidden',{get:()=>hidden});
  dom.window.HTMLElement.prototype.getClientRects=()=>[{width:10,height:10}];
  const timers=new Map();let nextId=0;
  dom.window.setInterval=fn=>{const id=++nextId;timers.set(id,fn);return id;};dom.window.clearInterval=id=>timers.delete(id);
  const compiled=ts.transpileModule(fs.readFileSync('src/components/orbit-entertainment.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
  const exports={};const icon=()=>null;
  vm.runInNewContext(compiled,{exports,require:id=>id==='@/components/orbit-icons'?{ArrowMarkIcon:icon,CoreIcon:icon,PulseIcon:icon,TargetIcon:icon}:require(id),window:dom.window,document,HTMLElement:dom.window.HTMLElement,performance,console});
  const launch=document.querySelector('#launch');launch.focus();const root=createRoot(document.querySelector('#root'));
  const click=async button=>React.act(async()=>button.dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true})));
  try{
    await React.act(async()=>root.render(React.createElement(exports.EntertainmentOverlay,{gameId:'flight',onClose:()=>{}})));
    assert.equal(document.activeElement.getAttribute('aria-label'),'Close game');assert.equal(timers.size,1);
    const steering=document.querySelector('input[type="range"]');assert.ok(steering);
    const pause=[...document.querySelectorAll('button')].find(button=>button.textContent==='Pause');await click(pause);assert.equal(timers.size,0);assert.equal(steering.disabled,true);
    await click(pause);assert.equal(timers.size,1);
    hidden=true;await React.act(async()=>document.dispatchEvent(new dom.window.Event('visibilitychange')));assert.equal(timers.size,0);
    hidden=false;await React.act(async()=>document.dispatchEvent(new dom.window.Event('visibilitychange')));assert.equal(timers.size,1);
    steering.focus();document.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(document.activeElement.getAttribute('aria-label'),'Close game');
    await React.act(async()=>root.unmount());assert.equal(timers.size,0);assert.equal(document.activeElement,launch);
  }finally{if(document.querySelector('.ent-overlay'))await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,previous);}
});
