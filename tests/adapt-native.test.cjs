/* eslint-disable @typescript-eslint/no-require-imports */
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const React=require('react');
const { renderToStaticMarkup }=require('react-dom/server');

const filename=path.join(__dirname,'../src/components/adapt-native-ui.tsx');
const source=fs.readFileSync(filename,'utf8');
const compiled=ts.transpileModule(source,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,
    jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  fileName:filename,reportDiagnostics:true,
});
const mod={exports:{}};
new Function('require','module','exports',compiled.outputText)(require,mod,mod.exports);
const ui=mod.exports;
const identities=['core','bloom','haven','atelier','pulse'];
const card=(identity)=>renderToStaticMarkup(React.createElement(ui.NativeWidgetFrame,{
  identity,id:'tasks',title:'Tasks',subtitle:'Organize today',number:2,
  layout:'standard',editing:false,preview:false,
},React.createElement('span',{'data-test':'shared-content'},'4 shared tasks')));
test('all five identities use the same child data but different DOM composition',()=>{
 const html=identities.map(card);
 assert.equal(new Set(html).size,5);
 for(let i=0;i<identities.length;i++) {
  assert.match(html[i],/4 shared tasks/);
  assert.match(html[i],new RegExp('data-native-identity="'+identities[i]+'"'));
  assert.match(html[i],/data-test="shared-content"/);
 }
});
test('Core keeps existing ARROW widget header and does not add new identity chrome',()=>{
 const html=card('core');
 assert.match(html,/class="adapt-widget-top"/);
 assert.doesNotMatch(html,/native-bloom-ornament|native-haven-margin|native-atelier-mast-rule|native-pulse-trace/);
 assert.match(html,/<strong>Tasks<\/strong>/);
});
test('Bloom, Haven, Atelier and Pulse each provide independent structural regions',()=>{
 assert.match(card('bloom'),/native-bloom-ornament/);
 assert.match(card('bloom'),/native-bloom-icon/);
 assert.match(card('haven'),/native-haven-index/);
 assert.match(card('haven'),/native-haven-footer/);
 assert.match(card('atelier'),/native-atelier-index/);
 assert.match(card('atelier'),/native-atelier-footer/);
 assert.match(card('pulse'),/native-pulse-live/);
 assert.match(card('pulse'),/native-pulse-trace/);
});
test('Preview is inert and never makes live widget actions clickable',()=>{
 const markup=renderToStaticMarkup(React.createElement(ui.NativeWidgetFrame,{
  identity:'bloom',id:'tasks',title:'Tasks',layout:'standard',preview:true,
},React.createElement('button',null,'Complete task')));
 assert.match(markup,/data-native-preview="true"/);
 assert.match(markup,/\sinert=""/);
 assert.match(markup,/aria-hidden="true"/);
});
test('identity normalizer rejects unknown values',()=>{
 assert.equal(ui.normalizeIdentity('pulse'),'pulse');
 assert.equal(ui.normalizeIdentity('A random theme'),'core');
 assert.equal(ui.normalizeIdentity(null),'core');
});
test('gallery rows compose differently but preserve accessible button semantics',()=>{
 const dom=identities.map(identity=>renderToStaticMarkup(React.createElement(ui.NativeGalleryRow,{
  identity,icon:'✓',title:'Tasks',subtitle:'Organize today',active:false,onClick:()=>{},
 })));
 assert.equal(new Set(dom).size,5);
 dom.forEach(value=>{assert.match(value,/<button type="button"/);assert.match(value,/Tasks/);});
});
test('Orbit studio reuses native components for both dashboard and live preview',()=>{
 const studio=fs.readFileSync(path.join(__dirname,'../src/components/orbit-widget-studio.tsx'),'utf8');
 assert.match(studio,/NativeWidgetFrame key=\{item\.id\}/);
 assert.match(studio,/NativeWidgetFrame identity=\{identity\}/);
 assert.match(studio,/NativeGalleryRow key=\{id\}/);
 assert.match(studio,/useAdaptIdentity\(\)/);
 assert.match(studio,/renderWidget\(preview\.id,preview\.cols,preview\.rows\)/);
});
