const fs=require('fs'),vm=require('vm'),path=require('path');
// Usage: node tests/sw-test.js
const code=fs.readFileSync(path.join(__dirname,'..','service-worker.js'),'utf8');
const V=code.match(/const VERSION = "([^"]+)"/)[1];
const ok=(c,m)=>{console.log((c?'PASS':'FAIL')+' - '+m);if(!c)process.exitCode=1;};
const store=new Map(),handlers={};let online=true,net={};
const caches={_c:new Map(),async open(n){if(!this._c.has(n))this._c.set(n,new Map());const m=this._c.get(n);return{async addAll(rs){for(const r of rs)m.set(r.url,{body:'shell:'+r.url,ok:true})},async put(r,res){m.set(r.url,res)}}},
  async keys(){return[...this._c.keys()]},async delete(k){return this._c.delete(k)},
  async match(r){const url=typeof r==='string'?r:(r.url||String(r));for(const m of this._c.values())if(m.has(url))return m.get(url);return undefined}};
class Req{constructor(u,o={}){this.url=String(u);this.method='GET';this.mode=o.mode||'cors';this.cache=o.cache}}
const self={registration:{scope:'https://u.github.io/App/'},location:{origin:'https://u.github.io'},clients:{claim(){}},skipWaiting(){},addEventListener:(t,f)=>handlers[t]=f};
const ctx={self,caches,Request:Req,URL,Response:class{constructor(b,o){this.body=b;this.status=o?.status;this.ok=false}},Promise,
  fetch:async(r,o)=>{if(!online)throw new Error('offline');ctx.lastInit=o;return{ok:true,type:'basic',body:'net:'+r.url,clone(){return this}}}};
vm.createContext(ctx);vm.runInContext(code,ctx);
const run=async(url,mode)=>{let p;const waits=[];handlers.fetch({request:new Req(url,{mode}),respondWith:x=>p=x,waitUntil:x=>waits.push(x)});const r=await p;await Promise.all(waits);return r;};
(async()=>{
  const w=[];handlers.install({waitUntil:x=>w.push(x)});await Promise.all(w);
  const shell=[...caches._c.values()][0];
  ok([...shell.keys()].includes('https://u.github.io/App/src/js/app.js?v='+V),'install precaches the versioned JS URL');
  let r=await run('https://u.github.io/App/src/js/app.js?v='+V,'cors');
  ok(r.body.startsWith('net:')&&ctx.lastInit.cache==='no-cache','online: JS comes from the network (revalidated), not a stale cache');
  online=false;
  r=await run('https://u.github.io/App/src/js/app.js?v='+V,'cors');
  ok(r.body.startsWith('net:'),'offline: the copy saved on the last online visit is served');
  r=await run('https://u.github.io/App/index.html?x=1','navigate');
  ok(r.body==='shell:https://u.github.io/App/index.html','offline navigation falls back to the cached index.html');
  r=await run('https://u.github.io/App/nope.png','cors');
  ok(r.status===503,'offline unknown file: clean 503');
  const act=[];caches._c.set('weekly-time-planner-v0.0.1',new Map());handlers.activate({waitUntil:x=>act.push(x)});await Promise.all(act);
  ok(!caches._c.has('weekly-time-planner-v0.0.1')&&caches._c.has('weekly-time-planner-v'+V),'activation deletes the old release cache');
})();
