const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const React=require('react');
const {JSDOM}=require('jsdom');
test('packaged Orbit lets the beta session guard run instead of redirecting to public',async()=>{
  const dom=new JSDOM('<div id="root"></div>',{url:'https://link9060.github.io/Resonant-Relay/arrow/orbit/'});
  const previous={window:global.window,document:global.document,IS_REACT_ACT_ENVIRONMENT:global.IS_REACT_ACT_ENVIRONMENT};
  Object.assign(global,{window:dom.window,document:dom.window.document,IS_REACT_ACT_ENVIRONMENT:true});
  const {createRoot}=require('react-dom/client');const root=createRoot(document.querySelector('#root'));
  const code=ts.transpileModule(fs.readFileSync('src/components/arrow-auth-gate.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020}}).outputText;
  try{
    for(const [pathname,allowed] of [['/Resonant-Relay/arrow/orbit/',true],['/Resonant-Orbit/',false]]){
      const redirects=[];const exports={};
      vm.runInNewContext(code,{exports,require,window:{location:{hostname:'link9060.github.io',pathname,search:'?panel=support',hash:'',replace:url=>redirects.push(url)}},localStorage:{getItem:()=>null},URL});
      await React.act(async()=>root.render(React.createElement(exports.ArrowAuthGate,null,React.createElement('p',null,'Orbit ready'))));
      assert.equal(document.querySelector('#root').textContent,allowed?'Orbit ready':'');
      assert.equal(redirects.length,allowed?0:1);
    }
  }finally{await React.act(async()=>root.unmount());dom.window.close();Object.assign(global,previous);}
});
