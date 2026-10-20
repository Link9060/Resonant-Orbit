/* eslint-disable @typescript-eslint/no-require-imports */
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ts=require('typescript');
const root=path.join(__dirname,'..');
function load(sourcePath) {
  const filename=path.join(root,sourcePath);
  const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
  }).outputText;
  const module={exports:{}};
  new Function('module','exports',code)(module,module.exports);
  return module.exports;
}
const grid=load('src/lib/orbit-widget-grid.ts');
const block=(id,x,y,cols=4,rows=2,visible=true)=>({id,x,y,cols,rows,size:'custom',visible});
test('twelve-column placement marks open cells green and overlap cells red',()=>{
 const layout=[block('tasks',0,0)];
 const green=grid.highlightedCells(layout,'weather',{x:4,y:0},4,2);
 assert.equal(green.valid,true);
 assert.equal(green.green.size,8);
 assert.equal(green.red.size,0);
 const red=grid.highlightedCells(layout,'weather',{x:2,y:0},4,2);
 assert.equal(red.valid,false);
 assert.equal(red.red.size,4);
 assert.equal(red.green.size,4);
});
test('placements never overwrite a visible widget or escape grid bounds',()=>{
 const layout=[block('tasks',0,0),block('weather',4,0)];
 assert.equal(grid.placeWidget(layout,'weather',{x:2,y:0}),null);
 assert.equal(grid.placeWidget(layout,'weather',{x:10,y:0}),null);
 const updated=grid.placeWidget(layout,'weather',{x:8,y:0});
 assert.equal(updated.find(x=>x.id==='weather').x,8);
 assert.equal(updated.find(x=>x.id==='tasks').x,0);
});
test('legacy layouts are packed without overlap while valid saved coordinates persist',()=>{
 const old=[block('tasks',0,0),{...block('weather',0,0),x:undefined,y:undefined},{...block('calendar',0,0),x:undefined,y:undefined}];
 const packed=grid.packDashboard(old);
 assert.deepEqual(packed.map(x=>[x.x,x.y]),[[0,0],[4,0],[8,0]]);
 const restored=grid.packDashboard(packed);
 assert.deepEqual(restored.map(x=>[x.x,x.y]),packed.map(x=>[x.x,x.y]));
});
test('hidden widgets do not block available space and can be placed',()=>{
 const items=[block('tasks',0,0),block('weather',0,0,4,2,false)];
 const placed=grid.placeWidget(items,'weather',{x:0,y:2});
 assert.ok(placed);
 assert.equal(placed.find(w=>w.id==='weather').visible,true);
 assert.equal(placed.find(w=>w.id==='weather').y,2);
});
test('Orbit gallery offers suggestions, previews, size selection and direct placement',()=>{
 const src=fs.readFileSync(path.join(root,'src/components/orbit-widget-studio.tsx'),'utf8');
 for(const word of ['Recommended','Search widgets','Choose widget size','Add Widget','Auto place','placementFits','orbit-grid-cell',"'blocked'","'available'"]) assert.ok(src.includes(word),word);
});


test('custom sizes clamp to twelve columns and six rows and select adaptive layouts',()=>{
 assert.deepEqual(grid.previewFootprint(13,9),{cols:12,rows:6});
 assert.deepEqual(grid.previewFootprint(0,-5),{cols:2,rows:1});
 assert.equal(grid.widgetLayoutKind(3,1),'compact');
 assert.equal(grid.widgetLayoutKind(9,2),'wide');
 assert.equal(grid.widgetLayoutKind(9,4),'expanded');
 assert.equal(grid.widgetLayoutKind(4,5),'tall');
 assert.equal(grid.widgetLayoutKind(6,2),'standard');
});
test('custom dimensions require an open footprint, not just a free starting cell',()=>{
 const layout=[block('tasks',4,1,5,3),block('weather',0,0,3,3)];
 assert.equal(grid.placeWidget(layout,'weather',{x:3,y:0},6,4),null);
 const moved=grid.placeWidget(layout,'weather',{x:0,y:5},11,6);
 assert.ok(moved);
 assert.equal(moved.find(w=>w.id==='weather').cols,11);
 assert.equal(moved.find(w=>w.id==='weather').rows,6);
});
test('edit mode and gallery reuse real live content instead of placeholder mocks',()=>{
 const src=fs.readFileSync(path.join(root,'src/components/orbit-widget-studio.tsx'),'utf8');
 assert.ok(src.includes('renderWidget(item.id,item.cols,item.rows)'));
 assert.ok(src.includes('renderWidget(preview.id,preview.cols,preview.rows)'));
 assert.ok(src.includes("aria-label=\"Custom widget width in grid columns\""));
 assert.ok(src.includes("aria-label=\"Custom widget height in grid rows\""));
 assert.ok(src.includes("layout={widgetLayoutKind"));
 assert.ok(src.includes("setDragging({ id:item.id"));
 assert.ok(src.includes("highlightedCells(packed, candidate.id"));
 assert.ok(src.includes("commit({x,y},dragging)"));
});
