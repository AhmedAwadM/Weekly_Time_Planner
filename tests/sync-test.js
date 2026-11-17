// Runs the REAL storage/sync code extracted verbatim from app.js against fake localStorage + fake file handles.
// Usage: node tests/sync-test.js   (extracts by the markers "// ===== Storage & file sync" and "function element("; keep them if you refactor)
const fs=require('fs');
const path=require('path');
const src=fs.readFileSync(process.argv[2]||path.join(__dirname,'..','src','js','app.js'),'utf8');
const core=src.slice(src.indexOf("  const DAYS = ["),src.indexOf("  // Local files can be opened"));
let chunk=src.slice(src.indexOf("  // ===== Storage & file sync"),src.indexOf("  function element(tag,cls,text)"));
chunk=chunk.replace('function openDialog(','function __realOpenDialog(');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ok=(c,m)=>{console.log((c?'PASS':'FAIL')+' - '+m);if(!c)process.exitCode=1;};
function makeFile(text){let t=text,mod=1;return{name:'planner-data.json',writes:0,
 async queryPermission(){return'granted'},async requestPermission(){return'granted'},
 async getFile(){const s=t;return{lastModified:mod,size:s.length,async text(){return s}}},
 async createWritable(){let b='';const self=this;return{async write(s){b+=s},async close(){t=b;mod++;self.writes++},async abort(){}}},
 external(s){t=s;mod++},get text(){return t}}}
const dataFile=tasks=>JSON.stringify({app:'weekly-time-planner-ar',version:3,tasks},null,2);
const T=(id,name,h=1)=>({id,name,priority:1,kind:'normal',mode:'duration',hours:{sun:h}});
async function boot(store,handle,answers=[]){
  const log={dialogs:[],toasts:[],answers};
  const mk=()=>{const f=function(){};const p=new Proxy(f,{get:(t,k)=>{if(k===Symbol.toPrimitive)return()=>'';if(k==='then')return undefined;if(k==='dataset')return{};return p;},set:()=>true,apply:()=>p});return p;};
  const cache={};const els=new Proxy({},{get:(o,k)=>cache[k]||(cache[k]=mk())});
  const ls={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
  const win={isSecureContext:true,showOpenFilePicker:async()=>[handle],showSaveFilePicker:async()=>handle};
  const body=`'use strict';
   const KEY='k';const HANDLE_DB_NAME='h',HANDLE_STORE='handles',HANDLE_SLOT='x';
   ${core}
   let storageWritable=true;
   const render=()=>{},resetEditor=()=>{editingId=null},clearError=()=>{},showError=()=>{};
   const element=()=>els.x;
   const document={getElementById:id=>els[id],createElement:()=>els.x,createTextNode:()=>els.x,addEventListener(){},removeEventListener(){},activeElement:null,body:els.x};
   const localStorage=ls,navigator={},window=win,location={protocol:'https:',pathname:'/p/'};
   async function openDialog(...a){log.dialogs.push(a);return log.answers.length?log.answers.shift():true;}
   ${chunk}
   return {get tasks(){return tasks},get rev(){return rev},get fileRev(){return fileRev},get state(){return fileState},
     persist,initializeDurableState,syncWithFile,linkFile,setHandle(h){fileHandle=h;fileState='ok'},getBackups,markLeader(v){isLeader=v}};`;
  const api=new Function('log','els','ls','win',body)(log,els,ls,win);
  await api.initializeDurableState();
  return {api,log};
}
const ids=a=>a.map(t=>t.id).join(',');
(async()=>{
  const store=new Map(), F=makeFile('');
  // S0 first link on an empty file seeds it
  let {api:A}=await boot(store,F);A.setHandle(F);await A.syncWithFile('startup');
  ok(JSON.parse(F.text).tasks.length===A.tasks.length&&F.writes===1,'S0 empty linked file is seeded with the current tasks');
  // S1 edits made while the file could not be written (pending) -> next start must NOT ask
  await A.persist([T('a','أ'),T('b','ب')],A.tasks,'تعديل مهمة');await sleep(400);   // not leader => write stays pending
  ok(A.rev>A.fileRev&&JSON.parse(F.text).tasks.length!==2,'S1 pending state: local is newer than the file');
  let B=await boot(store,F);B.api.setHandle(F);await B.api.syncWithFile('startup');
  ok(B.log.dialogs.length===0,'S1 reopen with pending edits: no "which copy?" dialog');
  ok(ids(JSON.parse(F.text).tasks.map(t=>t))==='a,b','S1 the pending edits were written to the file');
  // S2 file edited elsewhere, nothing unsaved here -> adopt silently (backup kept)
  F.external(dataFile([T('x','من برا')]));
  let C=await boot(store,F);C.api.setHandle(F);await C.api.syncWithFile('startup');
  ok(C.log.dialogs.length===0&&ids(C.api.tasks)==='x','S2 file edited elsewhere: adopted silently');
  ok((await C.api.getBackups()).some(b=>b.reason==='اعتماد ملف JSON'&&b.tasks.length===2),'S2 a backup of the replaced local data was kept');
  // S3 real conflict: both sides changed -> asks
  let D=await boot(store,F,[true]);D.api.setHandle(F);
  await D.api.persist([T('m','محلي')],D.api.tasks,'تعديل مهمة');F.external(dataFile([T('y','ملف1'),T('z','ملف2')]));
  await D.api.syncWithFile('startup');
  ok(D.log.dialogs.length===1&&ids(D.api.tasks)==='y,z','S3 both changed: asks once, "use file" applied');
  // S4 linking a different file that differs -> asks (mode link)
  let E=await boot(store,F,[false]);const G=makeFile(dataFile([T('q','أخرى')]));E.api.setHandle(G);
  await E.api.syncWithFile('link');
  ok(E.log.dialogs.length===1&&JSON.parse(G.text).tasks.length===2,'S4 link to a different file asks; "use local" writes local into it');
  // S5 corrupted browser data + healthy file => file rescues silently
  const s2=new Map([['k-state-v1','{broken'],['k','{broken']]);const H=makeFile(dataFile([T('g','سليمة')]));
  let I=await boot(s2,H);I.api.setHandle(H);await I.api.syncWithFile('startup');
  ok(ids(I.api.tasks)==='g'&&I.log.dialogs.length===0,'S5 unreadable browser data is rescued from the linked file without prompts');
  // S6 protected backups survive routine edits
  const s3=new Map();let J=await boot(s3,null);
  await J.api.persist([T('p1','1')],J.api.tasks,'حذف مهمة');
  for(let i=0;i<14;i++)await J.api.persist([T('p1','1'),T('e'+i,'e'+i)],J.api.tasks,'تعديل مهمة');
  const bk=await J.api.getBackups();
  ok(bk.some(b=>b.reason==='حذف مهمة')&&bk.filter(b=>b.reason==='تعديل مهمة').length===10,'S6 14 routine edits keep only 10 routine backups and the pre-delete snapshot is still there');
  console.log(process.exitCode?'SOME TESTS FAILED':'ALL TESTS PASSED');
})().catch(e=>{console.log('HARNESS ERROR',e.stack.split('\n').slice(0,5).join('\n'));process.exit(2)});
