const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsObject = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/lib/arrow-map.ts','utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject,URL,URLSearchParams});
const {resolveArrowHref} = exportsObject;
for (const module of ['relay','waypoint','ravin','atlas','orbit']) {
  test(`beta opens ${module} before the shared shell initializes`, () => {
    const target = new URL(resolveArrowHref(`/${module}/?tab=test#focus`,'https://link9060.github.io/Resonant-Relay/arrow/orbit/'));
    assert.equal(target.pathname,module==='relay'?'/Resonant-Relay/':`/Resonant-Relay/arrow/${module}/`);
    assert.equal(target.search,'?tab=test');
    assert.equal(target.hash,'#focus');
  });
  test(`hosted ${module} links remain on the ARROW origin`, () => {
    assert.equal(resolveArrowHref(`/${module}/`,'https://enterarrow.com/orbit/'),`https://enterarrow.com/${module}/`);
  });
}
test('external and already scoped links retain their destinations', () => {
  const current='https://link9060.github.io/Resonant-Relay/arrow/orbit/';
  assert.equal(resolveArrowHref('https://example.org/relay/',current),'https://example.org/relay/');
  assert.equal(resolveArrowHref('/Resonant-Relay/chats/view/?id=abc',current),'https://link9060.github.io/Resonant-Relay/chats/view/?id=abc');
});
