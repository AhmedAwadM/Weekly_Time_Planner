(() => {
  'use strict';
  // Keep the original storage key so existing v1 tasks are preserved automatically.
  const KEY = 'my-weekly-time-planner-ar-v1';
  const VIEW_KEY = KEY + '-view';
  const PARALLEL_VIEW_KEY = KEY + '-parallel-visible';
  const HANDLE_DB_NAME = KEY + '-file-handles';
  const HANDLE_STORE = 'handles';
  const HANDLE_SLOT = 'last-json';
  const DAYS = [
    {id:'sun',name:'الأحد',short:'أحد'}, {id:'mon',name:'الاثنين',short:'اثنين'},
    {id:'tue',name:'الثلاثاء',short:'ثلاثاء'}, {id:'wed',name:'الأربعاء',short:'أربعاء'},
    {id:'thu',name:'الخميس',short:'خميس'}, {id:'fri',name:'الجمعة',short:'جمعة'},
    {id:'sat',name:'السبت',short:'سبت'}
  ];
  const PRIORITIES = [
    {color:'#c52d46',title:'قصوى'}, {color:'#ed8848',title:'عالية جدًا'},
    {color:'#e8b648',title:'عالية'}, {color:'#35a892',title:'متوسطة'},
    {color:'#598bd7',title:'منخفضة'}, {color:'#939eb4',title:'منخفضة جدًا'}
  ];
  const DAY_IDS = new Set(DAYS.map(d=>d.id));
  const $ = id => document.getElementById(id);
  const allDayIds = DAYS.map(day=>day.id);
  const demo = [
    {id:'default-dhikr',name:'ذكر',priority:1,kind:'parallel',mode:'parallel',parallelMode:'allDay',days:allDayIds,hours:Object.fromEntries(allDayIds.map(day=>[day,0]))},
    {id:'default-prayers',name:'صلوات',priority:0,kind:'parallel',mode:'parallel',parallelMode:'allDay',days:allDayIds,hours:Object.fromEntries(allDayIds.map(day=>[day,0]))},
    {id:'default-wird',name:'ورد',priority:0,kind:'normal',mode:'duration',hours:Object.fromEntries(allDayIds.map(day=>[day,1]))},
    {id:'default-work',name:'عمل',priority:2,kind:'normal',mode:'duration',hours:{sun:8,mon:8,tue:8,wed:8,thu:8}}
  ];
  const pad = n => String(n).padStart(2,'0');
  function toMinutes(s) {
    if(typeof s !== 'string' || !/^\d{2}:\d{2}$/.test(s)) return NaN;
    const [h,m] = s.split(':').map(Number);
    if(h>23 || m>59) return NaN;
    return h*60+m;
  }
  function getRange(start,end) {
    const s = toMinutes(start),e = toMinutes(end);
    if(!Number.isFinite(s) || !Number.isFinite(e) || s===e) return null;
    return {start:s,end:e,minutes:(e-s+1440)%1440};
  }
  function normalizeTasks(list) {
    if(!Array.isArray(list) || list.length>500) throw new Error('صيغة المهام غير صحيحة');
    const seen=new Set();
    return list.map((task,index)=>{
      if(!task || typeof task!=='object' || typeof task.name!=='string' || !task.name.trim() || task.name.length>55)
        throw new Error('اسم إحدى المهام غير صحيح');
      const priority=Number(task.priority);
      if(!Number.isInteger(priority) || priority<0 || priority>5) throw new Error('درجة أهمية غير صحيحة');
      let id=typeof task.id==='string' && task.id.trim() && task.id.length<100 ? task.id.trim() : 'import-'+index;
      const baseId=id;let suffix=1;
      while(seen.has(id))id=baseId.slice(0,80)+'-'+index+'-'+suffix++;
      seen.add(id);
      // All older v1/v2 files are normal tasks by default.
      const kind=task.kind==='parallel'||task.mode==='parallel'?'parallel':'normal';
      if(kind==='parallel') {
        const parallelMode=task.parallelMode||'allDay';
        if(!['allDay','timed','linked'].includes(parallelMode)) throw new Error('نوع المهمة المتوازية غير معروف');
        const days=task.days;
        if(!Array.isArray(days) || days.length===0 || days.length>7 || new Set(days).size!==days.length || days.some(d=>!DAY_IDS.has(d)))
          throw new Error('أيام المهمة المتوازية غير صحيحة');
        const hours={},times={};
        for(const day of days) {
          if(parallelMode==='timed') {
            const interval=task.times?.[day],range=interval && getRange(interval.start,interval.end);
            if(!range) throw new Error('مواعيد المهمة المتوازية غير صحيحة');
            times[day]={start:interval.start,end:interval.end};
            hours[day]=range.minutes/60;
          } else hours[day]=0;
        }
        const linkedTaskId=parallelMode==='linked' ? task.linkedTaskId : undefined;
        if(parallelMode==='linked' && (typeof linkedTaskId!=='string'||!linkedTaskId.trim()))
          throw new Error('المهمة الأساسية المرتبطة غير صحيحة');
        return {id,name:task.name.trim(),priority,kind,mode:'parallel',parallelMode,days,hours,
          ...(parallelMode==='timed'?{times}:{}),...(parallelMode==='linked'?{linkedTaskId}:{})};
      }
      const mode=task.mode==null?'duration':task.mode;
      if(mode!=='duration' && mode!=='timed') throw new Error('طريقة الوقت غير معروفة');
      const hours={};const times={};
      if(mode==='duration') {
        if(!task.hours || typeof task.hours!=='object' || Array.isArray(task.hours)) throw new Error('أيام إحدى المهام غير صحيحة');
        for(const [day,value] of Object.entries(task.hours)) {
          if(!DAY_IDS.has(day)) throw new Error('اسم يوم غير صحيح');
          const h=Number(value);
          if(!Number.isFinite(h) || h<=0 || h>24) throw new Error('عدد ساعات خارج النطاق');
          hours[day]=h;
        }
      } else {
        if(!task.times || typeof task.times!=='object' || Array.isArray(task.times)) throw new Error('مواعيد مهمة غير صحيحة');
        for(const [day,value] of Object.entries(task.times)) {
          if(!DAY_IDS.has(day) || !value || typeof value!=='object') throw new Error('اسم يوم أو موعد غير صحيح');
          const r=getRange(value.start,value.end);
          if(!r) throw new Error('وقت بداية أو نهاية غير صحيح، أو مدة صفر');
          times[day]={start:value.start,end:value.end};hours[day]=r.minutes/60;
        }
      }
      if(!Object.keys(hours).length) throw new Error('مهمة بدون أيام');
      return {id,name:task.name.trim(),priority,kind,mode,hours,...(mode==='timed'?{times}:{})};
    });
  }
  // Local files can be opened via file:// or content://; storage support varies by browser.
  // Keep the app usable when persistent storage is blocked, with an explicit warning.
  let storageWritable=false;
  try {
    const probe=KEY+'-storage-test';
    localStorage.setItem(probe,'1');
    storageWritable=localStorage.getItem(probe)==='1';
    localStorage.removeItem(probe);
  } catch (e) { storageWritable=false; }
  // ===== Storage & file sync (v3.6) =====
  // IndexedDB is the transactional source of truth when available. localStorage is
  // maintained as a compatibility mirror and as a fallback for restricted browsers.
  const REV_KEY=KEY+'-rev',FILEREV_KEY=KEY+'-file-rev',LINK_KEY=KEY+'-link-bump';
  const STATE_KEY=KEY+'-state-v1',REPLACED_KEY=KEY+'-replaced-backup',FALLBACK_BACKUPS_KEY=KEY+'-backups-fallback';
  const LOCK_NAME=KEY+'-file-writer',STATE_LOCK=KEY+'-state-writer';
  const STATE_STORE='state',BACKUP_STORE='backups',STATE_SLOT='current';
  const MAX_BACKUPS=10,MAX_FILE_BYTES=5*1024*1024;
  const lsGet=k=>{try{return localStorage.getItem(k);}catch(e){return null;}};
  const lsSet=(k,v)=>{try{localStorage.setItem(k,v);return true;}catch(e){return false;}};
  const numKey=k=>{const n=Number(lsGet(k));return Number.isSafeInteger(n)&&n>=0?n:0;};
  const canon=v=>JSON.stringify(v,(k,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.keys(x).sort().reduce((o,key)=>(o[key]=x[key],o),{}):x);
  const fileName=()=>(fileHandle&&fileHandle.name)||'planner-data.json';
  const pickerTypes=[{description:'مخطط وقتي JSON',accept:{'application/json':['.json']}}];
  const supportsFile=window.isSecureContext&&typeof window.showOpenFilePicker==='function'&&typeof window.showSaveFilePicker==='function';
  const isBrave=!!navigator.brave;
  let tasks=[],storageLoadFailed=false,browserOk=storageWritable,atRisk=!storageWritable,exportedSinceRisk=false;
  let rev=numKey(REV_KEY),fileRev=numKey(FILEREV_KEY);
  let fileHandle=null,fileState='none',fileSnapshot=null,fileErrorSnapshot=null,fileErr='',isLeader=false,syncing=false,busy=false,reconnecting=false;
  let durableStateAvailable=false,dataReady=false,backupCount=0,unreadableRaw=null,storageErr='';
  let handleRemembered=false,stateChannel=null;
  let writeTimer=0,writeChain=Promise.resolve();

  function readLocalState() {
    try {
      const envelopeRaw=localStorage.getItem(STATE_KEY);
      if(envelopeRaw) {
        try {
          const envelope=JSON.parse(envelopeRaw);
          if(!envelope||envelope.schema!==1||!Number.isSafeInteger(envelope.revision)||envelope.revision<0)
            throw new Error('بيانات المراجعة المحلية غير صحيحة');
          return {revision:envelope.revision,tasks:normalizeTasks(envelope.tasks),updatedAt:envelope.updatedAt||null};
        } catch(envelopeError) {
          const legacy=localStorage.getItem(KEY);
          if(legacy===null)throw envelopeError;
          return {revision:numKey(REV_KEY),tasks:normalizeTasks(JSON.parse(legacy)),updatedAt:null};
        }
      }
      const raw=localStorage.getItem(KEY);
      if(raw===null)return {revision:numKey(REV_KEY),tasks:normalizeTasks(demo),updatedAt:null};
      return {revision:numKey(REV_KEY),tasks:normalizeTasks(JSON.parse(raw)),updatedAt:null};
    } catch(e) { return null; }
  }
  try {
    const envelopeRaw=localStorage.getItem(STATE_KEY);
    if(envelopeRaw) {
      try {
        const envelope=JSON.parse(envelopeRaw);
        if(!envelope||envelope.schema!==1||!Number.isSafeInteger(envelope.revision)||envelope.revision<0)
          throw new Error('بيانات المراجعة المحلية غير صحيحة');
        tasks=normalizeTasks(envelope.tasks);rev=envelope.revision;
      } catch(envelopeError) {
        const legacy=localStorage.getItem(KEY);
        if(legacy===null){unreadableRaw=envelopeRaw;throw envelopeError;}
        try {tasks=normalizeTasks(JSON.parse(legacy));rev=numKey(REV_KEY);unreadableRaw=envelopeRaw;}
        catch(legacyError){unreadableRaw=JSON.stringify({stateEnvelopeRaw:envelopeRaw,legacyTasksRaw:legacy},null,2);throw legacyError;}
      }
    } else {
      const stored=localStorage.getItem(KEY);
      if(stored===null)tasks=normalizeTasks(demo);
      else {
        try {tasks=normalizeTasks(JSON.parse(stored));}
        catch(e) {
          storageLoadFailed=true;tasks=[];unreadableRaw=stored;
          console.warn('Saved planner data is unreadable and was left untouched:',e);
        }
      }
    }
  } catch(e) {
    // Preserve the original raw data whenever it can still be read.
    if(unreadableRaw===null)try {unreadableRaw=localStorage.getItem(STATE_KEY)??localStorage.getItem(KEY);}catch(_){}
    if(unreadableRaw!==null){storageLoadFailed=true;tasks=[];}
    else {tasks=normalizeTasks(demo);browserOk=false;atRisk=true;}
  }

  let parallelVisible=true;
  try {if(localStorage.getItem(PARALLEL_VIEW_KEY)==='false')parallelVisible=false;}catch(e){}
  let viewMode='duration';
  try {if(localStorage.getItem(VIEW_KEY)==='timeline') viewMode='timeline';} catch(e) {}
  let editingId=null;
  let selectedPriority=0;
  let timingMode='duration';
  let taskKind='normal';
  let parallelMode='allDay';
  const selectedDays=new Set(['sun','mon','tue','wed','thu']);
  let formHours=Object.fromEntries(DAYS.map(d=>[d.id,2]));
  let formTimes=Object.fromEntries(DAYS.map(d=>[d.id,{start:'09:00',end:'11:00'}]));
  let toastTimeout;
  const sum=vals=>vals.reduce((a,b)=>a+b,0);
  function formatHours(n) {
    const v=Math.round(n*100)/100;
    return (Number.isInteger(v)?String(v):String(v).replace(/0+$/,'').replace(/\.$/,''))+' س';
  }
  function notify(message,action) {
    const node=$('toast');node.replaceChildren(document.createTextNode(message));
    node.classList.toggle('has-action',!!action);
    if(action) {
      const b=element('button','toast-action',action.label);b.type='button';
      b.addEventListener('click',()=>{node.classList.remove('show');action.run();});node.append(b);
    }
    node.classList.add('show');
    clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.classList.remove('show'),action?8000:2600);
  }
  function makeDataFile(taskList=tasks) {
    return {app:'weekly-time-planner-ar',version:3,exportedAt:new Date().toISOString(),tasks:taskList};
  }
  function parseDataFile(raw) {
    if(typeof raw!=='string'||new Blob([raw]).size>MAX_FILE_BYTES)throw new Error('حجم ملف JSON أكبر من 5MB');
    const p=JSON.parse(raw);
    if(!p||p.app!=='weekly-time-planner-ar'||![1,2,3].includes(p.version)||!Array.isArray(p.tasks))
      throw new Error('ملف JSON غير متوافق مع مخطط وقتي');
    return normalizeTasks(p.tasks);
  }
  function openHandleDatabase() {
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window))return reject(new Error('التخزين الدائم غير متاح في هذا المتصفح'));
      const request=indexedDB.open(HANDLE_DB_NAME,2);
      request.onupgradeneeded=()=>{
        const db=request.result;
        if(!db.objectStoreNames.contains(HANDLE_STORE))db.createObjectStore(HANDLE_STORE);
        if(!db.objectStoreNames.contains(STATE_STORE))db.createObjectStore(STATE_STORE);
        if(!db.objectStoreNames.contains(BACKUP_STORE))db.createObjectStore(BACKUP_STORE,{keyPath:'id',autoIncrement:true});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('تعذّر فتح مساحة التخزين الدائم'));
      request.onblocked=()=>reject(new Error('ترقية مساحة التخزين مشغولة بنافذة أخرى'));
    });
  }
  async function readDurableState() {
    const db=await openHandleDatabase();
    try {return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STATE_STORE,'readonly'),request=tx.objectStore(STATE_STORE).get(STATE_SLOT);
      request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('تعذّرت قراءة بيانات البرنامج'));
      tx.onabort=()=>reject(tx.error||new Error('تعذّرت قراءة بيانات البرنامج'));
    });} finally {db.close();}
  }
  async function seedDurableState(record) {
    const db=await openHandleDatabase();
    try {return await new Promise((resolve,reject)=>{
      const tx=db.transaction(STATE_STORE,'readwrite'),store=tx.objectStore(STATE_STORE),request=store.get(STATE_SLOT);
      let selected=null;
      request.onsuccess=()=>{
        const current=request.result||null;
        if(!current||record.revision>current.revision){selected=record;store.put(record,STATE_SLOT);}
        else selected=current;
      };
      tx.oncomplete=()=>resolve(selected);tx.onerror=()=>reject(tx.error||new Error('تعذّر تهيئة التخزين الدائم'));
      tx.onabort=()=>reject(tx.error||new Error('تعذّر تهيئة التخزين الدائم'));
    });} finally {db.close();}
  }
  async function mirrorState(record) {
    const envelope={schema:1,revision:record.revision,updatedAt:record.updatedAt||new Date().toISOString(),tasks:record.tasks};
    const ok=lsSet(STATE_KEY,JSON.stringify(envelope));
    if(ok){lsSet(KEY,JSON.stringify(record.tasks));lsSet(REV_KEY,String(record.revision));}
    return ok;
  }
  async function initializeDurableState() {
    try {
      const local=readLocalState();
      let durable=await readDurableState();
      if(!durable) {
        if(storageLoadFailed) {
          durableStateAvailable=true;
          if(unreadableRaw!==null)await saveRawBackup(unreadableRaw,'بيانات متصفح غير قابلة للقراءة');
          dataReady=true;backupCount=await countBackups();updateStorageStatus();return;
        }
        durable={revision:local?.revision??rev,tasks:local?.tasks??tasks,updatedAt:new Date().toISOString()};
        durable=await seedDurableState(durable);
      } else if(local&&local.revision>durable.revision) {
        durable=await seedDurableState({...local,updatedAt:new Date().toISOString()});
      }
      if(durable&&Array.isArray(durable.tasks)) {
        tasks=normalizeTasks(durable.tasks);rev=Number(durable.revision)||0;storageLoadFailed=false;
        durableStateAvailable=true;
        await mirrorState(durable);
      }
      if(unreadableRaw!==null)await saveRawBackup(unreadableRaw,'بيانات متصفح غير قابلة للقراءة');
      backupCount=await countBackups();
    } catch(e) {
      durableStateAvailable=false;
      const local=readLocalState();
      if(local&&!storageLoadFailed){tasks=local.tasks;rev=local.revision;browserOk=true;}
      else if(storageLoadFailed&&unreadableRaw!==null)lsSet(REPLACED_KEY,JSON.stringify({reason:'بيانات متصفح غير قابلة للقراءة',at:new Date().toISOString(),raw:unreadableRaw}));
      console.warn('IndexedDB unavailable; using localStorage fallback:',e);
    }
    dataReady=true;
    browserOk=durableStateAvailable||!!lsGet(STATE_KEY)||storageWritable;
    atRisk=!durableStateAvailable&&!browserOk;
    updateStorageStatus();render();
  }
  function readFallbackBackups() {
    try {
      const value=JSON.parse(lsGet(FALLBACK_BACKUPS_KEY)||'[]');
      return Array.isArray(value)?value.filter(item=>item&&typeof item==='object'):[];
    } catch(e){return [];}
  }
  function appendFallbackBackup(record) {
    const list=readFallbackBackups();
    list.unshift({...record,id:record.id||('fallback-'+Date.now()+'-'+Math.random().toString(36).slice(2,7))});
    while(list.length>MAX_BACKUPS)list.pop();
    let serialized=JSON.stringify(list);
    while(list.length>1&&serialized.length>3*1024*1024){list.pop();serialized=JSON.stringify(list);}
    if(serialized.length>3*1024*1024)return false;
    const ok=lsSet(FALLBACK_BACKUPS_KEY,serialized);
    if(ok)backupCount=list.length;
    return ok;
  }
  async function countBackups() {
    try {const db=await openHandleDatabase();try{return await new Promise((resolve,reject)=>{
      const tx=db.transaction(BACKUP_STORE,'readonly'),req=tx.objectStore(BACKUP_STORE).count();
      req.onsuccess=()=>resolve((req.result||0)+readFallbackBackups().length);req.onerror=()=>reject(req.error);
    });}finally{db.close();}}catch(e){return readFallbackBackups().length+(lsGet(REPLACED_KEY)?1:0);}
  }
  async function getBackups() {
    let durable=[];
    try {const db=await openHandleDatabase();try{durable=await new Promise((resolve,reject)=>{
      const tx=db.transaction(BACKUP_STORE,'readonly'),req=tx.objectStore(BACKUP_STORE).getAll();
      req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
    });}finally{db.close();}}catch(e){}
    const fallback=readFallbackBackups();
    let legacy=null;try{legacy=JSON.parse(lsGet(REPLACED_KEY)||'null');}catch(e){}
    if(legacy)fallback.push({id:'legacy-fallback',createdAt:Date.parse(legacy.at)||Date.now(),reason:legacy.reason,tasks:legacy.tasks,raw:legacy.raw});
    const seen=new Set(durable.map(item=>item.id));
    return [...durable,...fallback.filter(item=>!seen.has(item.id))].sort((a,b)=>b.createdAt-a.createdAt).slice(0,MAX_BACKUPS);
  }
  async function saveRawBackup(raw,reason,parsedTasks=null) {
    const record={createdAt:Date.now(),reason,tasks:Array.isArray(parsedTasks)?parsedTasks:null,raw:String(raw)};
    try {
      const db=await openHandleDatabase();
      try {await new Promise((resolve,reject)=>{
        const tx=db.transaction(BACKUP_STORE,'readwrite'),store=tx.objectStore(BACKUP_STORE);
        store.add(record);const keys=store.getAllKeys();keys.onsuccess=()=>{
          const sorted=keys.result.sort((a,b)=>a-b);sorted.slice(0,Math.max(0,sorted.length-MAX_BACKUPS)).forEach(key=>store.delete(key));
        };
        tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('تعذّر حفظ النسخة الخام'));tx.onabort=()=>reject(tx.error||new Error('تعذّر حفظ النسخة الخام'));
      });} finally {db.close();}
      backupCount=await countBackups();updateStorageStatus();return true;
    } catch(e) {
      const fallbackRecord={createdAt:Date.now(),reason,tasks:Array.isArray(parsedTasks)?parsedTasks:null,raw:String(raw)};
      const ok=appendFallbackBackup(fallbackRecord)||lsSet(REPLACED_KEY,JSON.stringify({reason,at:new Date().toISOString(),raw:String(raw),...(parsedTasks?{tasks:parsedTasks}:{})}));
      if(ok){backupCount=Math.max(backupCount,1);updateStorageStatus();}return ok;
    }
  }
  async function commitDurableState(nextTasks,expectedRevision,beforeTasks,reason) {
    const db=await openHandleDatabase();
    try {return await new Promise((resolve,reject)=>{
      const tx=db.transaction([STATE_STORE,BACKUP_STORE],'readwrite');
      const stateStore=tx.objectStore(STATE_STORE),backupStore=tx.objectStore(BACKUP_STORE);
      const request=stateStore.get(STATE_SLOT);let result=null,conflict=false;
      request.onsuccess=()=>{
        const current=request.result||{revision:0,tasks:[]};
        if(current.revision!==expectedRevision){conflict=true;result={ok:false,latest:current};tx.abort();return;}
        if(Array.isArray(beforeTasks)) {
          backupStore.add({createdAt:Date.now(),reason:reason||'تعديل',tasks:beforeTasks});
          const keys=backupStore.getAllKeys();keys.onsuccess=()=>{
            const sorted=keys.result.sort((a,b)=>a-b);
            sorted.slice(0,Math.max(0,sorted.length-MAX_BACKUPS)).forEach(key=>backupStore.delete(key));
          };
        }
        result={ok:true,record:{revision:current.revision+1,tasks:nextTasks,updatedAt:new Date().toISOString()}};
        stateStore.put(result.record,STATE_SLOT);
      };
      tx.oncomplete=()=>resolve(result||{ok:false,latest:null});
      tx.onerror=()=>{if(!conflict)reject(tx.error||new Error('فشل حفظ البيانات في التخزين الدائم'));};
      tx.onabort=()=>{if(conflict)resolve(result);else reject(tx.error||new Error('تم إلغاء عملية حفظ البيانات'));};
    });} finally {db.close();}
  }
  function applyStateRecord(record) {
    if(!record||!Array.isArray(record.tasks))return false;
    const next=normalizeTasks(record.tasks);
    if(editingId&&!next.some(t=>t.id===editingId)){resetEditor();notify('المهمة التي كنت تعدّلها تغيّرت في نافذة أخرى');}
    tasks=next;rev=Number(record.revision)||0;storageLoadFailed=false;
    render();updateStorageStatus();return true;
  }
  async function persist(nextList,beforeList,reason='تعديل',{recover=false,skipFileWrite=false}={}) {
    if(!dataReady){showError('جارٍ تجهيز التخزين المحلي. حاول مرة أخرى بعد لحظات.');return false;}
    if(storageLoadFailed&&!recover){showError('بياناتك المحفوظة غير قابلة للقراءة؛ تم إيقاف التعديل لحمايتها. استورد نسخة سليمة أو استخدم إعادة الضبط بعد التأكيد.');return false;}
    const next=normalizeTasks(nextList);
    const expected=rev;let committed=false;
    if(durableStateAvailable) {
      try {
        const result=await commitDurableState(next,expected,beforeList,reason);
        if(!result?.ok) {
          if(result?.latest) {applyStateRecord(result.latest);await mirrorState(result.latest);}
          notify('تم تحديث البيانات من نافذة أخرى؛ لم يتم تطبيق تعديلك لتجنب فقدان أي بيانات. أعد المحاولة على أحدث نسخة.');
          return false;
        }
        rev=result.record.revision;tasks=next;committed=true;
        backupCount=Array.isArray(beforeList)?Math.min(MAX_BACKUPS,backupCount+1):backupCount;
        await mirrorState(result.record);
      } catch(e) {
        storageErr='فشل التخزين الدائم: '+(e.message||'خطأ غير معروف');exportedSinceRisk=false;
        showError('لم يتم حفظ التعديل بأمان: '+storageErr);
        updateStorageStatus();return false;
      }
    } else {
      const applyFallback=async()=>{
        const latest=readLocalState();
        if(latest&&latest.revision>rev){applyStateRecord(latest);return false;}
        const record={revision:Math.max(rev,latest?.revision||0)+1,tasks:next,updatedAt:new Date().toISOString()};
        const envelope={schema:1,...record};
        if(Array.isArray(beforeList)) {
          const ok=appendFallbackBackup({createdAt:Date.now(),reason:reason||'تعديل',tasks:beforeList});
          if(!ok)throw new Error('تعذّر إنشاء نسخة احتياطية قبل استبدال البيانات؛ لم يتم تنفيذ العملية');
        }
        if(!lsSet(STATE_KEY,JSON.stringify(envelope)))throw new Error('المتصفح لا يسمح بحفظ البيانات المحلية');
        rev=record.revision;tasks=next;committed=true;
        lsSet(KEY,JSON.stringify(next));lsSet(REV_KEY,String(rev));
        return true;
      };
      try {
        const result=navigator.locks?.request
          ?await navigator.locks.request(STATE_LOCK,{mode:'exclusive'},applyFallback)
          :await applyFallback();
        if(!result){notify('تم تحديث البيانات من نافذة أخرى؛ أعد المحاولة على أحدث نسخة.');return false;}
      } catch(e) {
        atRisk=true;browserOk=false;exportedSinceRisk=false;storageErr='تعذّر حفظ البيانات: '+(e.message||'مساحة التخزين غير متاحة');showError(storageErr);updateStorageStatus();return false;
      }
    }
    if(!committed)return false;
    storageLoadFailed=false;browserOk=true;atRisk=false;exportedSinceRisk=false;storageErr='';
    if(stateChannel)try{stateChannel.postMessage({type:'state-updated',revision:rev});}catch(e){}
    if(fileHandle&&!skipFileWrite)scheduleFileWrite();
    updateStorageStatus();return true;
  }
  function downloadReplaced() {
    let b=null;try{b=JSON.parse(lsGet(REPLACED_KEY)||'null');}catch(e){}
    if(!b) {
      const fallback=readFallbackBackups();
      b=fallback.find(item=>item.raw!==undefined)||fallback[0]||null;
    }
    if(!b)return;
    const raw=b.raw!==undefined;
    downloadText(raw?'weekly-planner-unreadable-data.json':'weekly-planner-replaced-copy.json',
      raw?b.raw:JSON.stringify({app:'weekly-time-planner-ar',version:3,exportedAt:b.at||new Date(b.createdAt).toISOString(),tasks:b.tasks},null,2));
  }
  function folderHint() {
    if(location.protocol!=='file:')return '';
    try {return 'عشان الملف يبقى جنب الـHTML اختار مجلده: '+decodeURIComponent(location.pathname.replace(/[^/]*$/,''));}catch(e){return '';}
  }
  function noFileHint() {
    if(supportsFile)return 'اربط ملف JSON من قائمة «البيانات» عشان تتحفظ تعديلاتك جنب الـHTML. '+folderHint();
    if(isBrave)return 'Brave بيقفل ربط الملفات افتراضيًا: افتح brave://flags/#file-system-access-api وفعّله إذا كان متاحًا. الحفظ المحلي والنسخ الاحتياطية يظلان متاحين.';
    return 'الحفظ المحلي يتم تلقائيًا. استخدم النسخ الاحتياطية أو تصدير/استيراد JSON للنقل بين الأجهزة.';
  }
  function computeStatus() {
    const name=fileName();
    if(!dataReady)return ['busy','جارٍ تحميل البيانات…','يتم التحقق من النسخة المحفوظة قبل تفعيل التعديلات.'];
    if(storageLoadFailed)return ['bad','بيانات المتصفح تالفة','لم يتم تعديل الأصل. نزّل النسخة الخام أو اربط ملف JSON سليمًا أو استورد نسخة احتياطية.'];
    if(storageErr){const safe=durableStateAvailable||browserOk;return [safe?'warn':'bad','تعذّر حفظ آخر تعديل',storageErr+' — لم يتم تطبيق التعديل، '+(safe?'النسخة السابقة ما زالت محفوظة.':'صدّر البيانات الحالية فورًا؛ التخزين المحلي غير متاح.')];}
    if(fileState==='needs')return ['warn','اضغط لتفعيل الحفظ في «'+name+'»','المتصفح يحتاج إذن الوصول للملف بعد فتح الصفحة. بياناتك محفوظة محليًا حتى تمنح الإذن.'];
    if(fileState==='error')return [durableStateAvailable||browserOk?'warn':'bad','تعذّر الحفظ في الملف',fileErr+' — بياناتك الحالية محفوظة '+(durableStateAvailable?'في التخزين المحلي الدائم.':'في المتصفح إن كانت المساحة متاحة.')];
    if(fileHandle&&(fileState==='saving'||rev>fileRev))return ['busy','جارٍ الحفظ…','يتم كتابة آخر تعديل في «'+name+'».'];
    if(fileHandle&&fileState==='ok')return ['ok','محفوظ في «'+name+'»','آخر نسخة مكتوبة في الملف، مع وجود نسخة محلية احتياطية ومزامنة بين النوافذ.'];
    if(durableStateAvailable)return ['ok','محفوظ محليًا','الحفظ التلقائي والنسخ الاحتياطية يعملان باستخدام IndexedDB. '+noFileHint()];
    if(browserOk)return ['idle','محفوظ في المتصفح',noFileHint()];
    return ['bad','غير محفوظ','المتصفح يمنع الحفظ المحلي. صدّر نسخة JSON قبل إغلاق الصفحة.'];
  }
  function updateStorageStatus() {
    const chip=$('saveChip');if(!chip)return;
    const [kind,label,detail]=computeStatus();
    chip.dataset.kind=kind;$('saveChipText').textContent=label;chip.title=detail;
    $('storageStatus').textContent=label;$('fileSaveHint').textContent=detail;
    $('saveStatusBox').classList.toggle('status-warning',kind==='bad'||kind==='warn');
    $('saveStatusBox').classList.toggle('status-saved',kind==='ok');
    $('localNotice').classList.toggle('warn',kind==='bad');
    $('localNoticeText').textContent=kind==='bad'?detail:'';
    $('linkDataFileBtn').hidden=false;
    $('linkDataFileBtn').disabled=storageLoadFailed||!dataReady;
    $('linkDataFileBtn').textContent='ربط بملف الحفظ';
  }
  function scheduleFileWrite() {
    if(!fileHandle||fileState==='needs'||!dataReady)return;
    clearTimeout(writeTimer);writeTimer=setTimeout(()=>writeFile(),300);
  }
  function writeFile(force) {
    writeChain=writeChain.then(()=>doWrite(force)).catch(e=>{console.warn(e);fileState='error';fileErr=e.message||'تعذّر الحفظ في الملف';updateStorageStatus();});
    return writeChain;
  }
  async function saveRawExternal(raw,reason,incoming=null) {
    const ok=await saveRawBackup(raw,reason,incoming);
    if(!ok)downloadText('weekly-planner-external-file-backup.json',raw);
    return ok;
  }
  async function handleInvalidExternalFile(raw,error) {
    const backedUp=await saveRawExternal(raw,'ملف خارجي غير صالح');
    const detail=backedUp?'تم حفظ نسخة من محتوى الملف غير الصالح في النسخ الاحتياطية.':'تعذّر حفظ النسخة محليًا؛ تم طلب تنزيل نسخة من الملف قبل الاستبدال.';
    return openDialog('تم تعديل ملف «'+fileName()+'» خارج البرنامج، لكن محتواه لم يعد JSON صالحًا ('+(error.message||'خطأ في القراءة')+'). لن نكتب فوقه دون موافقتك. '+detail,'استبدال الملف بالبيانات الحالية','إلغاء',true,true);
  }
  async function askConflict(incoming,raw) {
    const useFile=await openDialog('ملف «'+fileName()+'» يحتوي على '+incoming.length+' مهمة، بينما النسخة المحلية تحتوي على '+tasks.length+' مهمة. اختر النسخة التي تريد اعتمادها. سيتم الاحتفاظ بالنسخة الأخرى في النسخ الاحتياطية.','استخدم الملف','استخدم النسخة المحلية',false,true);
    if(!useFile) {
      const saved=await saveRawExternal(raw,'ملف خارجي قبل استبداله',incoming);
      if(!saved) {
        const proceed=await openDialog('لم نتمكن من حفظ النسخة الخارجية داخل مخزن النسخ الاحتياطية. تم طلب تنزيلها كملف مستقل. هل تريد المتابعة واستبدال الملف؟','استبدال بعد التنزيل','إلغاء',true,true);
        return proceed?false:null;
      }
    }
    return useFile;
  }
  async function doWrite(force) {
    if(!fileHandle||fileState==='needs'||storageLoadFailed||(!isLeader&&!force))return;
    if(syncing&&!force){scheduleFileWrite();return;}
    const target=rev,snapshotTasks=tasks;
    const payload=JSON.stringify(makeDataFile(snapshotTasks),null,2);
    fileState='saving';updateStorageStatus();
    try {
      const cur=await fileHandle.getFile();
      if(cur.size>MAX_FILE_BYTES)throw new Error('حجم ملف JSON أكبر من 5MB؛ أوقفنا الكتابة لحمايته');
      const raw=await cur.text();
      if(fileSnapshot!==null&&raw!==fileSnapshot) {
        let incoming=null,parseError=null;
        if(raw.trim())try{incoming=parseDataFile(raw);}catch(e){parseError=e;}
        else parseError=new Error('الملف أصبح فارغًا');
        if(parseError) {
          const overwrite=await handleInvalidExternalFile(raw,parseError);
          if(!overwrite){fileState='error';fileErrorSnapshot=raw;fileErr='تم إيقاف الحفظ لأن الملف الخارجي غير صالح ولم توافق على استبداله';return;}
          fileErrorSnapshot=null;fileSnapshot=raw;
        } else if(incoming&&canon(incoming)!==canon(snapshotTasks)) {
          const choice=await askConflict(incoming,raw);
          if(choice===null){fileState='error';fileErrorSnapshot=raw;fileErr='تم إيقاف الحفظ لحماية النسخة الخارجية';return;}
          if(choice===true) {
            const adopted=await persist(incoming,tasks,'اعتماد ملف JSON',{recover:storageLoadFailed,skipFileWrite:true});
            if(adopted){if(editingId&&!tasks.some(t=>t.id===editingId))resetEditor();render();fileErrorSnapshot=null;fileSnapshot=raw;fileRev=rev;lsSet(FILEREV_KEY,String(rev));fileState='ok';fileErr='';return;}
            return;
          }
          fileErrorSnapshot=null;fileSnapshot=raw;
        }
      }
      if(rev!==target){scheduleFileWrite();return;}
      const w=await fileHandle.createWritable();
      try {await w.write(payload);await w.close();}
      catch(e) {try{await w.abort();}catch(_){}throw e;}
      fileErrorSnapshot=null;fileSnapshot=payload;fileRev=target;
      lsSet(FILEREV_KEY,String(target));fileState='ok';fileErr='';
      if(rev>target)scheduleFileWrite();
    } catch(e) {
      const denied=e&&e.name==='NotAllowedError';
      fileState=denied?'needs':'error';
      fileErr=denied?'انتهى إذن الوصول للملف':((e&&e.message)||'تعذّر كتابة الملف');
      if(denied)armReconnect();
    } finally {updateStorageStatus();}
  }
  async function syncWithFile(mode) {
    if(!fileHandle||fileState==='needs'||syncing)return;
    syncing=true;
    try {
      const file=await fileHandle.getFile();
      if(file.size>MAX_FILE_BYTES)throw new Error('حجم ملف JSON أكبر من 5MB');
      const raw=await file.text();
      if(!raw.trim()) {fileSnapshot=raw;await writeFile(true);return;}
      let incoming;
      try {incoming=parseDataFile(raw);}
      catch(e) {
        const overwrite=await handleInvalidExternalFile(raw,e);
        if(overwrite){fileErrorSnapshot=null;fileSnapshot=raw;await writeFile(true);}
        else {fileState='error';fileErrorSnapshot=raw;fileErr='ملف JSON غير صالح؛ لم يتم استبداله';}
        return;
      }
      if(canon(incoming)===canon(tasks)) {
        fileErrorSnapshot=null;fileSnapshot=raw;fileRev=rev;lsSet(FILEREV_KEY,String(rev));fileState='ok';fileErr='';return;
      }
      const useFile=storageLoadFailed?true:await askConflict(incoming,raw);
      if(useFile===null){fileState='error';fileErrorSnapshot=raw;fileErr='تم إيقاف المزامنة لحماية الملف الخارجي';return;}
      fileErrorSnapshot=null;fileSnapshot=raw;
      if(useFile) {
        const adopted=await persist(incoming,tasks,'اعتماد ملف JSON',{recover:storageLoadFailed,skipFileWrite:true});
        if(adopted){if(editingId&&!tasks.some(t=>t.id===editingId))resetEditor();render();fileErrorSnapshot=null;fileRev=rev;lsSet(FILEREV_KEY,String(rev));fileState='ok';fileErr='';}
      } else await writeFile(true);
    } catch(e) {
      fileState='error';fileErr=(e&&e.message)||'تعذّرت قراءة الملف';
    } finally {syncing=false;updateStorageStatus();}
  }
  async function adoptFromStorage() {
    if(durableStateAvailable) {
      try {
        const latest=await readDurableState();
        if(latest&&latest.revision>rev){applyStateRecord(latest);await mirrorState(latest);if(fileHandle&&isLeader&&rev>fileRev)writeFile();}
      } catch(e){console.warn('Could not adopt durable state:',e);}
      return;
    }
    const latest=readLocalState();
    if(!latest||latest.revision<=rev)return;
    applyStateRecord(latest);fileRev=numKey(FILEREV_KEY);
    if(fileHandle&&isLeader&&rev>fileRev)writeFile();
  }
  function becomeLeader() {
    const lead=()=>{isLeader=true;if(fileHandle&&fileState==='ok')syncWithFile('startup');};
    if(navigator.locks&&navigator.locks.request)
      navigator.locks.request(LOCK_NAME,()=>{lead();return new Promise(()=>{});}).catch(()=>{isLeader=true;});
    else isLeader=true;
  }
  async function checkExternal() {
    if(!fileHandle||syncing)return;
    const recoveringRejectedFile=fileState==='error'&&fileErrorSnapshot!==null;
    if(!recoveringRejectedFile&&(rev>fileRev||fileState!=='ok'))return;
    try {
      const file=await fileHandle.getFile();
      if(file.size>MAX_FILE_BYTES)throw new Error('حجم ملف JSON أكبر من 5MB');
      const raw=await file.text();
      if(recoveringRejectedFile) {
        if(raw===fileErrorSnapshot)return;
        fileState='ok';fileErrorSnapshot=null;
        await syncWithFile('poll');return;
      }
      if(fileSnapshot!==null&&raw!==fileSnapshot)await syncWithFile('poll');
    } catch(e) {fileState='error';fileErr=e.message||'تعذّر فحص الملف الخارجي';updateStorageStatus();}
  }
  async function rememberFileHandle(handle) {
    const db=await openHandleDatabase();
    try {await new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readwrite');tx.objectStore(HANDLE_STORE).put(handle,HANDLE_SLOT);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('تعذّر تذكّر الملف'));tx.onabort=()=>reject(tx.error||new Error('تعذّر تذكّر الملف'));
    });handleRemembered=true;return true;} finally {db.close();}
  }
  async function getRememberedFileHandle() {
    const db=await openHandleDatabase();
    try {return await new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readonly'),request=tx.objectStore(HANDLE_STORE).get(HANDLE_SLOT);
      request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||new Error('تعذّر قراءة الملف السابق'));
    });} finally {db.close();}
  }
  async function forgetRememberedFileHandle() {
    try {const db=await openHandleDatabase();try{await new Promise((resolve,reject)=>{
      const tx=db.transaction(HANDLE_STORE,'readwrite');tx.objectStore(HANDLE_STORE).delete(HANDLE_SLOT);
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('تعذّر نسيان الملف'));tx.onabort=()=>reject(tx.error||new Error('تعذّر نسيان الملف'));
    });}finally{db.close();}}catch(e){console.warn('Could not clear remembered file handle:',e);}
    handleRemembered=false;
  }
  function armReconnect() {
    // Permission is requested only when the user explicitly clicks the save-status chip.
  }
  async function reconnect() {
    if(!fileHandle||reconnecting)return;reconnecting=true;
    try {
      if(await fileHandle.requestPermission({mode:'readwrite'})==='granted'){fileState='ok';updateStorageStatus();await syncWithFile('startup');}
    } catch(e){console.warn(e);} finally {reconnecting=false;updateStorageStatus();}
  }
  async function initFile() {
    if(!supportsFile){updateStorageStatus();return;}
    try {
      const h=await getRememberedFileHandle();
      if(!h){fileHandle=null;fileState='none';updateStorageStatus();return;}
      fileHandle=h;
      if(await h.queryPermission({mode:'readwrite'})==='granted'){fileState='ok';await syncWithFile('startup');}
      else {fileState='needs';armReconnect();}
    } catch(e){
      console.warn('Could not restore the JSON file link:',e);
      if(!fileHandle){fileState='none';fileErr='';}
      else {fileState='error';fileErr='تعذّر استعادة ربط ملف JSON: '+(e.message||'خطأ غير معروف');}
    }
    updateStorageStatus();
  }
  async function chooseSaveFileMode() {
    if(!supportsFile) {
      await openDialog('المتصفح الحالي لا يدعم ربط ملف JSON للحفظ المباشر. يمكنك استخدام «استيراد» و«تصدير» لنقل بياناتك يدويًا.','حسنًا',null,false);
      return null;
    }
    return new Promise(resolve=>{
      const previous=document.activeElement;
      const overlay=element('div','dialog-backdrop');
      const box=element('div','dialog-box');
      box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
      const heading=element('h3','','ربط ملف الحفظ');
      heading.style.margin='0 0 8px';
      heading.style.fontSize='18px';
      heading.style.color='var(--ink)';
      const note=element('p','dialog-text','اختر ملف JSON موجودًا، أو أنشئ ملفًا جديدًا. بعد الربط سيحفظ البرنامج تعديلات هذه الجلسة فيه تلقائيًا.');
      const actions=element('div','dialog-actions');
      const existing=makeButton('اختيار ملف موجود','btn primary',()=>finish(false));
      const create=makeButton('إنشاء ملف جديد','btn',()=>finish(true));
      const cancel=makeButton('إلغاء','btn',()=>finish(null));
      actions.append(existing,create,cancel);
      box.append(heading,note,actions);
      overlay.append(box);
      function finish(value) {
        document.removeEventListener('keydown',onKey,true);
        overlay.remove();
        if(previous&&previous.focus)previous.focus({preventScroll:true});
        resolve(value);
      }
      function onKey(event) {
        if(event.key==='Escape'){event.preventDefault();finish(null);}
        if(event.key==='Tab') {
          const buttons=[existing,create,cancel],index=buttons.indexOf(document.activeElement);
          event.preventDefault();
          buttons[(index+(event.shiftKey?-1:1)+buttons.length)%buttons.length].focus();
        }
      }
      overlay.addEventListener('click',event=>{if(event.target===overlay)finish(null);});
      document.addEventListener('keydown',onKey,true);
      document.body.append(overlay);
      existing.focus();
    });
  }
  async function connectSaveFile() {
    const create=await chooseSaveFileMode();
    if(create!==null)await linkFile(create);
  }
  async function linkFile(create) {
    if(!supportsFile||busy||!dataReady)return;busy=true;
    try {
      const handle=create?await window.showSaveFilePicker({suggestedName:'planner-data.json',types:pickerTypes})
        :(await window.showOpenFilePicker({multiple:false,types:pickerTypes}))[0];
      if(!handle)return;
      fileHandle=handle;fileState='ok';fileSnapshot=null;fileErrorSnapshot=null;
      try{await rememberFileHandle(handle);}catch(e){handleRemembered=false;console.warn('Could not remember the file handle:',e);}
      await syncWithFile('link');
      lsSet(LINK_KEY,String(Date.now()));
      if(fileState==='ok')notify(handleRemembered?'تم ربط الملف وحفظه للفتح القادم.':'تم ربط الملف لهذه الجلسة؛ لم يتمكن المتصفح من تذكّر الربط.');
    } catch(e) {
      if(!e||e.name!=='AbortError')await openDialog('تعذّر ربط الملف: '+((e&&e.message)||'راجع إذن الوصول.'),'حسنًا',null,false);
    } finally {busy=false;updateStorageStatus();}
  }
  async function unlinkFile() {
    fileHandle=null;fileState='none';fileSnapshot=null;fileErrorSnapshot=null;fileErr='';
    await forgetRememberedFileHandle();lsSet(LINK_KEY,String(Date.now()));
    updateStorageStatus();notify('تم فصل الملف. الحفظ المحلي مستمر.');
  }
  async function showBackupsDialog() {
    const backups=await getBackups();
    const overlay=element('div','dialog-backdrop'),box=element('div','dialog-box backup-dialog');
    box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');
    const heading=element('h3','','النسخ الاحتياطية');
    const note=element('p','dialog-text','يحتفظ البرنامج بآخر 10 نسخ قبل التعديلات والاستيراد والحذف والاستعادة، حسب مساحة التخزين المتاحة.');
    const list=element('div','backup-list');
    if(!backups.length)list.append(element('div','backup-empty','لا توجد نسخ احتياطية حتى الآن.'));
    backups.forEach(record=>{
      const row=element('div','backup-item'),meta=element('div','backup-meta');
      const date=new Date(record.createdAt||Date.now()).toLocaleString('ar-EG');
      const count=record.raw!==undefined?'نسخة خام من ملف JSON'+(Array.isArray(record.tasks)?' · '+record.tasks.length+' مهمة قابلة للاستعادة':''):(Array.isArray(record.tasks)?record.tasks.length+' مهمة':'نسخة احتياطية');
      meta.append(element('strong','',date),element('span','',(record.reason||'نسخة احتياطية')+' · '+count));
      const actions=element('div','backup-actions');
      actions.append(makeButton('تنزيل','btn',()=>downloadBackup(record)));
      if(Array.isArray(record.tasks))actions.append(makeButton('استعادة','btn primary',async()=>{
        closeOverlay();
        if(!await openDialog('استعادة هذه النسخة ستستبدل المهام الحالية. سيتم حفظ الحالة الحالية كنسخة احتياطية أولًا. هل تريد المتابعة؟','استعادة النسخة','إلغاء',true))return;
        const before=tasks;
        if(await persist(record.tasks,before,'استعادة نسخة احتياطية',{recover:storageLoadFailed})){resetEditor();render();notify('تمت استعادة النسخة الاحتياطية.');}
      }));
      row.append(meta,actions);list.append(row);
    });
    const onKey=e=>{if(e.key==='Escape'&&overlay.isConnected)closeOverlay();};
    function closeOverlay(){overlay.remove();document.removeEventListener('keydown',onKey);}
    const close=makeButton('إغلاق','btn backup-close',closeOverlay);
    box.append(heading,note,list,close);overlay.append(box);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeOverlay();});
    document.addEventListener('keydown',onKey);
    document.body.append(overlay);close.focus();
  }
  function downloadBackup(record) {
    if(record.raw!==undefined)downloadText('weekly-planner-raw-backup.json',record.raw);
    else downloadText('weekly-planner-backup-'+(record.id||'latest')+'.json',JSON.stringify(makeDataFile(record.tasks||[]),null,2));
  }
  // In-app dialogs replace confirm()/alert(), which some mobile browsers and file viewers block.
  function openDialog(message,okText,cancelText,danger,sticky) {
    return new Promise(resolve=>{
      const prev=document.activeElement;
      const overlay=element('div','dialog-backdrop'),box=element('div','dialog-box');
      box.setAttribute('role','alertdialog');box.setAttribute('aria-modal','true');
      const text=element('p','dialog-text',message);text.id='dialogText';box.setAttribute('aria-describedby','dialogText');
      const actions=element('div','dialog-actions');
      const onKey=e=>{
        if(e.key==='Escape'){e.preventDefault();if(!sticky)finish(false);}
        else if(e.key==='Tab'){
          const items=[...actions.querySelectorAll('button')],i=items.indexOf(document.activeElement);
          e.preventDefault();items[(i+(e.shiftKey?-1:1)+items.length)%items.length].focus();
        }
      };
      function finish(value) {
        document.removeEventListener('keydown',onKey,true);overlay.remove();
        if(prev&&prev.focus)prev.focus({preventScroll:true});
        resolve(value);
      }
      const ok=makeButton(okText,'btn primary'+(danger?' danger':''),()=>finish(true));
      const cancel=cancelText?makeButton(cancelText,'btn',()=>finish(false)):null;
      actions.append(ok);if(cancel)actions.append(cancel);
      box.append(text,actions);overlay.append(box);
      overlay.addEventListener('click',e=>{if(e.target===overlay&&!sticky)finish(false);});
      document.addEventListener('keydown',onKey,true);
      document.body.append(overlay);
      (danger&&cancel?cancel:ok).focus();
    });
  }
  function downloadText(name,text) {
    const blob=new Blob([text],{type:'application/json;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function element(tag,cls,text) {
    const e=document.createElement(tag);
    if(cls)e.className=cls;
    if(text!==undefined)e.textContent=text;
    return e;
  }
  function makeButton(text,cls,handler) {
    const b=element('button',cls,text);b.type='button';b.addEventListener('click',handler);return b;
  }
  function renderPriorityPicker() {
    const container=$('priorityChoices');container.replaceChildren();
    PRIORITIES.forEach((p,i)=>{
      const label=element('label','prio-option'+(selectedPriority===i?' selected':''));
      label.dataset.p=i;label.style.background=p.color;label.style.color=i===0?'#ffffff':'#111827';label.style.textShadow=i===0?'0 1px 1px rgba(0,0,0,.18)':'none';label.title=`${i}: ${p.title}`;
      const input=document.createElement('input');input.type='radio';input.name='priority';input.value=String(i);input.checked=selectedPriority===i;
      input.addEventListener('change',()=>{selectedPriority=i;renderPriorityPicker();});
      label.append(input,document.createTextNode(String(i)));container.append(label);
    });
  }
  function renderDayPicker() {
    const container=$('dayChoices');container.replaceChildren();
    DAYS.forEach(day=>{
      const checked=selectedDays.has(day.id);
      const label=element('label','day-toggle'+(checked?' selected':''));
      const input=document.createElement('input');input.type='checkbox';input.value=day.id;input.checked=checked;
      input.addEventListener('change',()=>{
        if(input.checked)selectedDays.add(day.id);else selectedDays.delete(day.id);
        renderDayPicker();renderHourRows();renderTimeRows();
      });
      label.append(input,document.createTextNode(day.short));container.append(label);
    });
  }
  function renderHourRows() {
    const container=$('hourRows');container.replaceChildren();
    for(const day of DAYS){
      if(!selectedDays.has(day.id))continue;
      const row=element('div','hour-row');const label=element('label','',day.name);
      const input=document.createElement('input');input.id='hrs-'+day.id;label.htmlFor=input.id;
      input.type='number';input.min='0.25';input.max='24';input.step='0.25';input.inputMode='decimal';
      input.value=String(formHours[day.id]??2);
      input.setAttribute('aria-label',`عدد ساعات ${day.name}`);
      input.addEventListener('input',()=>{formHours[day.id]=input.value;});
      row.append(label,input);container.append(row);
    }
    if(!selectedDays.size)container.append(element('div','helper','اختر يومًا واحدًا على الأقل.'));
  }
  function renderTimeRows() {
    const container=$('timeRows');container.replaceChildren();
    for(const day of DAYS) {
      if(!selectedDays.has(day.id))continue;
      const row=element('div','time-row');const name=element('span','day-name',day.name);
      const start=document.createElement('input');start.type='time';start.className='time-input';
      start.id='start-'+day.id;start.value=formTimes[day.id]?.start||'09:00';
      start.setAttribute('aria-label',`بداية المهمة يوم ${day.name}`);
      const end=document.createElement('input');end.type='time';end.className='time-input';
      end.id='end-'+day.id;end.value=formTimes[day.id]?.end||'11:00';
      end.setAttribute('aria-label',`نهاية المهمة يوم ${day.name}`);
      const calc=element('span','calculated');
      const update=()=>{
        formTimes[day.id]={start:start.value,end:end.value};
        const r=getRange(start.value,end.value);
        calc.textContent=r?formatHours(r.minutes/60):'—';
        calc.title=r && r.end<r.start?'تنتهي في اليوم التالي':'';
      };
      start.addEventListener('input',update);end.addEventListener('input',update);update();
      row.append(name,start,end,calc);container.append(row);
    }
    if(!selectedDays.size)container.append(element('div','helper','اختر يومًا واحدًا على الأقل.'));
  }
  function setDays(dayIds) {
    selectedDays.clear();dayIds.forEach(d=>selectedDays.add(d));
    renderDayPicker();renderHourRows();renderTimeRows();
  }
  function renderLinkedTaskOptions(selectedId='') {
    const picker=$('linkedTaskSelect'),current=selectedId||picker.value;
    picker.replaceChildren();
    const initial=element('option','', 'اختار مهمة أساسية');initial.value='';picker.append(initial);
    tasks.filter(task=>task.kind!=='parallel' && task.id!==editingId).forEach(task=>{
      const option=element('option','',task.name);option.value=task.id;picker.append(option);
    });
    picker.value=[...picker.options].some(option=>option.value===current)?current:'';
  }
  function syncEditorModes() {
    $('normalModeField').hidden=taskKind==='parallel';
    $('parallelModeField').hidden=taskKind!=='parallel';
    $('linkedTaskField').hidden=taskKind!=='parallel'||parallelMode!=='linked';
    $('durationFields').hidden=taskKind==='parallel'||timingMode!=='duration';
    $('timedFields').hidden=taskKind==='parallel'?parallelMode!=='timed':timingMode!=='timed';
    for(const label of $('kindChoices').querySelectorAll('.mode-choice')) {
      const radio=label.querySelector('input');radio.checked=radio.value===taskKind;
      label.classList.toggle('selected',radio.checked);
    }
    for(const label of $('modeChoices').querySelectorAll('.mode-choice')) {
      const radio=label.querySelector('input');radio.checked=radio.value===timingMode;
      label.classList.toggle('selected',radio.checked);
    }
    for(const label of $('parallelModeChoices').querySelectorAll('.mode-choice')) {
      const radio=label.querySelector('input');radio.checked=radio.value===parallelMode;
      label.classList.toggle('selected',radio.checked);
    }
    $('parallelModeHint').textContent=parallelMode==='allDay'
      ?'المهمة بتظهر في عمود رأسي مستقل على مدار اليوم، ولا تُخصم أي ساعات.'
      :parallelMode==='timed'
      ?'حدد بداية ونهاية لكل يوم. تظهر بجوار الجدول في نفس موضع الوقت دون احتساب ساعات إضافية.'
      :'اختار مهمة أساسية؛ لو ليها مواعيد هتتبعها تلقائيًا، ولو مدة فقط هتظهر بدون موضع زمني محدد.';
    clearError();
  }
  function setTimingMode(mode) {timingMode=mode;syncEditorModes();}
  function setTaskKind(kind) {
    taskKind=kind;
    if(kind==='parallel') renderLinkedTaskOptions();
    syncEditorModes();
  }
  function setParallelMode(mode) {parallelMode=mode;syncEditorModes();}
  function showError(message){const e=$('formError');e.textContent=message;e.classList.add('visible');}
  function clearError(){const e=$('formError');e.textContent='';e.classList.remove('visible');}
  function resetEditor() {
    editingId=null;$('taskName').value='';selectedPriority=0;
    formHours=Object.fromEntries(DAYS.map(d=>[d.id,2]));$('bulkHours').value='2';
    formTimes=Object.fromEntries(DAYS.map(d=>[d.id,{start:'09:00',end:'11:00'}]));
    $('bulkStart').value='09:00';$('bulkEnd').value='11:00';
    parallelMode='allDay';taskKind='normal';
    setDays(['sun','mon','tue','wed','thu']);renderPriorityPicker();setTimingMode('duration');clearError();
    renderLinkedTaskOptions();
    $('formHeading').textContent='إضافة مهمة جديدة';$('saveTaskBtn').textContent='+ إضافة المهمة';
    $('cancelEditBtn').hidden=true;$('deleteTaskBtn').hidden=true;
  }
  function editTask(id) {
    const t=tasks.find(t=>t.id===id);if(!t)return;
    editingId=t.id;$('taskName').value=t.name;selectedPriority=t.priority;
    formHours=Object.fromEntries(DAYS.map(d=>[d.id,t.hours[d.id]??2]));
    formTimes=Object.fromEntries(DAYS.map(d=>[d.id,t.times?.[d.id]?{...t.times[d.id]}:{start:'09:00',end:'11:00'}]));
    setDays(t.kind==='parallel'?t.days:Object.keys(t.hours));renderPriorityPicker();
    taskKind=t.kind==='parallel'?'parallel':'normal';
    parallelMode=t.kind==='parallel'?t.parallelMode:'allDay';
    timingMode=t.kind==='parallel'?'duration':t.mode;
    renderLinkedTaskOptions(t.linkedTaskId||'');syncEditorModes();
    $('formHeading').textContent='تعديل المهمة';$('saveTaskBtn').textContent='حفظ التعديل';
    $('cancelEditBtn').hidden=false;$('deleteTaskBtn').hidden=false;clearError();
    $('editorPanel').scrollIntoView({behavior:'smooth',block:'start'});
    $('taskName').focus({preventScroll:true});
  }
  function newId(){return 'task-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9);}
  async function saveForm(event) {
    event.preventDefault();clearError();
    if(!dataReady)return showError('جارٍ تجهيز التخزين المحلي. حاول مرة أخرى بعد لحظات.');
    if(storageLoadFailed)return showError('تعذّر قراءة بياناتك المحفوظة، لذلك أوقفنا أي تعديل لحمايتها. استورد نسخة احتياطية سليمة أو اختر «إعادة ضبط» بعد التأكيد.');
    const name=$('taskName').value.trim();
    if(!name)return showError('اكتب اسم المهمة أولًا.');
    if(!selectedDays.size)return showError('اختار يومًا واحدًا على الأقل.');
    if(!editingId && tasks.length>=500)return showError('وصلت للحد الأقصى (500 مهمة). عدّل أو احذف مهمة موجودة قبل إضافة مهمة جديدة.');
    if(name.length>55)return showError('اسم المهمة يجب ألا يتجاوز 55 حرفًا.');
    const hours={},times={},before=tasks;
    if(taskKind==='parallel') {
      const days=DAYS.map(d=>d.id).filter(d=>selectedDays.has(d));
      if(parallelMode==='linked') {
        const target=$('linkedTaskSelect').value;
        if(!target || !tasks.some(t=>t.id===target && t.kind!=='parallel'))
          return showError('اختار مهمة أساسية موجودة للربط بها.');
      }
      for(const day of days) {
        if(parallelMode==='timed') {
          const start=$('start-'+day).value,end=$('end-'+day).value,r=getRange(start,end);
          if(!r)return showError('راجع مواعيد المهمة المتوازية.');
          times[day]={start,end};hours[day]=r.minutes/60;
        } else hours[day]=0;
      }
      const entry={id:editingId||newId(),name,priority:selectedPriority,kind:'parallel',mode:'parallel',
        parallelMode,days,hours,...(parallelMode==='timed'?{times}:{}),
        ...(parallelMode==='linked'?{linkedTaskId:$('linkedTaskSelect').value}:{})};
      if(editingId&&entry.kind==='parallel'&&before.some(t=>t.kind==='parallel'&&t.parallelMode==='linked'&&t.linkedTaskId===editingId))
        return showError('لا يمكن تحويل هذه المهمة إلى متوازية؛ توجد مهام أخرى مرتبطة بها. عدّل ارتباط المهام التابعة أولًا.');
      const next=editingId?before.map(t=>t.id===editingId?entry:t):[...before,entry];
      if(!await persist(next,before,editingId?'تعديل مهمة':'إضافة مهمة'))return;
    } else {
      for(const day of selectedDays) {
        if(timingMode==='duration') {
          const input=$('hrs-'+day),h=Number(input.value);
          if(!input.value || !Number.isFinite(h) || h<=0 || h>24)
            return showError('الساعات لكل يوم لازم تكون أكبر من 0 ولحد 24 ساعة.');
          hours[day]=h;
        } else {
          const start=$('start-'+day).value,end=$('end-'+day).value,r=getRange(start,end);
          if(!r)return showError('راجع مواعيد البداية والنهاية: لازم يكونوا مختلفين وصحيحين.');
          times[day]={start,end};hours[day]=r.minutes/60;
        }
      }
      const entry={id:editingId||newId(),name,priority:selectedPriority,kind:'normal',mode:timingMode,hours,
        ...(timingMode==='timed'?{times}:{})};
      const next=editingId?before.map(t=>t.id===editingId?entry:t):[...before,entry];
      if(!await persist(next,before,editingId?'تعديل مهمة':'إضافة مهمة'))return;
    }
    const wasEditing=!!editingId;
    render();resetEditor();notify(wasEditing?'تم تعديل المهمة':'تمت إضافة المهمة');
  }
  function renderLegend() {
    const container=$('legend');container.replaceChildren();
    PRIORITIES.forEach((p,i)=>{
      const item=element('div','legend-item');const chip=element('span','legend-chip',String(i));chip.style.background=p.color;chip.style.color=i===0?'#ffffff':'#111827';chip.style.textShadow=i===0?'0 1px 1px rgba(0,0,0,.18)':'none';chip.style.color=i===0?'#ffffff':'#111827';chip.style.textShadow=i===0?'0 1px 1px rgba(0,0,0,.18)':'none';
      const detail=element('span','legend-text');detail.append(element('strong','',p.title),element('span','',`الأولوية ${i}`));
      item.append(chip,detail);container.append(item);
    });
  }
  // Expand time-specific tasks into calendar-day segments. Overnight ranges roll to the next day,
  // including Saturday night into Sunday morning, because the plan repeats weekly.
  function timedSegments() {
    const result=[];
    for(const task of tasks) {
      if(task.mode!=='timed')continue;
      for(const [day,interval] of Object.entries(task.times)) {
        const r=getRange(interval.start,interval.end);if(!r)continue;
        const end=r.start+r.minutes;
        result.push({day,task,start:r.start,end:Math.min(1440,end),origin:day,range:`${interval.start}–${interval.end}`});
        if(end>1440) {
          const idx=DAYS.findIndex(d=>d.id===day);
          result.push({day:DAYS[(idx+1)%7].id,task,start:0,end:end-1440,origin:day,range:`${interval.start}–${interval.end}`});
        }
      }
    }
    return result;
  }
  function segmentsOverlap(segments) {
    const sorted=[...segments].sort((a,b)=>a.start-b.start||a.end-b.end);
    let maxEnd=-1;
    for(const segment of sorted){if(segment.start<maxEnd)return true;maxEnd=Math.max(maxEnd,segment.end);}
    return false;
  }
  function getDayData(day,allSegments) {
    const fixed=allSegments.filter(s=>s.day===day);
    const floating=tasks.filter(t=>t.mode==='duration' && t.hours[day]>0);
    const timedHours=sum(fixed.map(s=>(s.end-s.start)/60));
    const floatingHours=sum(floating.map(t=>t.hours[day]));
    return {fixed,floating,total:timedHours+floatingHours,conflict:segmentsOverlap(fixed)};
  }
  // Side lanes for parallel tasks. A cross-midnight segment is displayed on both days.
  // Linked tasks inherit real times from a timed base task, or a soft all-day lane
  // when their base task has a duration but no specific clock position.
  function nextDayId(day) {return DAYS[(DAYS.findIndex(d=>d.id===day)+1)%7].id;}
  function splitParallelInterval(out,task,origin,start,end,label,soft=false) {
    out.push({day:origin,task,start,end:Math.min(1440,end),label,soft});
    if(end>1440)out.push({day:nextDayId(origin),task,start:0,end:end-1440,label,soft});
  }
  function allParallelSegments(normalSegments) {
    const result=[];
    for(const task of tasks) {
      if(task.kind!=='parallel')continue;
      if(task.parallelMode==='allDay') {
        for(const day of task.days)
          result.push({day,task,start:0,end:1440,label:'طوال اليوم',soft:true});
      } else if(task.parallelMode==='timed') {
        for(const day of task.days) {
          const range=getRange(task.times[day].start,task.times[day].end);
          if(range)splitParallelInterval(result,task,day,range.start,range.start+range.minutes,
            task.times[day].start+'–'+task.times[day].end);
        }
      } else if(task.parallelMode==='linked') {
        const base=tasks.find(t=>t.id===task.linkedTaskId && t.kind!=='parallel');
        if(!base)continue;
        if(base.mode==='timed') {
          normalSegments.filter(seg=>task.days.includes(seg.origin) && seg.task.id===base.id)
            .forEach(seg=>result.push({day:seg.day,task,start:seg.start,end:seg.end,
              label:'مع '+base.name+' · '+seg.range,soft:false}));
        } else {
          for(const day of task.days) if(base.hours[day]>0)
            result.push({day,task,start:0,end:1440,label:'مع '+base.name+' · بدون موعد',soft:true});
        }
      }
    }
    return result;
  }
  function getParallelLanes(day,parallelSegments) {
    const lanes=new Map();
    for(const seg of parallelSegments) if(seg.day===day) {
      if(!lanes.has(seg.task.id))lanes.set(seg.task.id,{task:seg.task,segments:[]});
      lanes.get(seg.task.id).segments.push(seg);
    }
    return [...lanes.values()].sort((a,b)=>a.task.priority-b.task.priority||a.task.name.localeCompare(b.task.name,'ar'));
  }
  function renderParallelLane(entry,height) {
    const lane=element('div','parallel-lane');
    const head=makeButton('','lane-head',()=>editTask(entry.task.id));
    head.title=entry.task.name+' · مهمة متوازية · اضغط للتعديل';
    const dot=element('span','lane-dot');dot.style.background=PRIORITIES[entry.task.priority].color;
    head.append(dot,element('span','lane-name',entry.task.name));lane.append(head);
    const track=element('div','parallel-lane-track');track.style.height=height+'px';
    for(const seg of entry.segments) {
      const h=(seg.end-seg.start)/60,short=seg.end-seg.start<60;
      const block=makeButton('','parallel-block'+(seg.soft?' soft':'')+(short?' short':''),()=>editTask(entry.task.id));
      const color=PRIORITIES[entry.task.priority].color;
      block.style.setProperty('--lane-color',color);
      block.style.background=color+'2b';
      block.style.top=(seg.start/1440*100)+'%';block.style.height=((seg.end-seg.start)/1440*100)+'%';
      if(!short)block.append(element('span','task-title',entry.task.name),element('span','task-meta',seg.label));
      block.title=entry.task.name+' | '+seg.label+' | مهمة متوازية (لا تُحسب)';
      block.setAttribute('aria-label',block.title+'، اضغط للتعديل');
      track.append(block);
    }
    lane.append(track);
    return lane;
  }
  function setView(mode) {
    viewMode=mode;
    try{localStorage.setItem(VIEW_KEY,mode);}catch(e){}
    $('durationViewBtn').classList.toggle('active',mode==='duration');
    $('timelineViewBtn').classList.toggle('active',mode==='timeline');
    $('durationViewBtn').setAttribute('aria-pressed',String(mode==='duration'));
    $('timelineViewBtn').setAttribute('aria-pressed',String(mode==='timeline'));
    $('boardDescription').textContent=mode==='duration'
      ?'كل يوم في بطاقة مستقلة، مع توزيع بصري واضح للمهام الأساسية والمتوازية.'
      :'كل يوم يظهر أسفل الآخر مع محاذاة حسب الساعة لقراءة أدق لمواعيد المهام.';
    renderWeek();
  }
  function addBlockText(block,name,h,info='') {
    block.append(element('span','task-title',name),element('span','task-meta',`${formatHours(h)}${info?' · '+info:''}`));
  }
  function renderDistribution(track,day,data) {
    const entryMap=new Map();
    data.floating.forEach(task=>entryMap.set(task.id,{task,h:task.hours[day]}));
    data.fixed.forEach(segment=>{
      if(!entryMap.has(segment.task.id))entryMap.set(segment.task.id,{task:segment.task,h:0,ranges:[]});
      const item=entryMap.get(segment.task.id);
      item.h+=(segment.end-segment.start)/60;
      if(!item.ranges)item.ranges=[];
      item.ranges.push(segment.range);
    });
    const entries=[...entryMap.values()].sort((a,b)=>a.task.priority-b.task.priority || a.task.name.localeCompare(b.task.name,'ar'));
    // Reserve enough visual height for short task labels, without modifying their actual hours.
    // All days share the same track height, computed in renderWeek().
    entries.forEach(({task,h,ranges})=>{
      const block=element('button','task-block'+(h<1?' compact':''));
      block.type='button';block.dataset.priority=String(task.priority);
      block.style.background=PRIORITIES[task.priority].color;
      block.style.color=task.priority===0?'#ffffff':'#111827';
      block.style.textShadow=task.priority===0?'0 1px 1px rgba(0,0,0,.18)':'none';
      block.style.flex=`${h} 1 0px`;
      const clockInfo=ranges?.length?[...new Set(ranges)].join('، '):'';
      addBlockText(block,task.name,h,clockInfo||`أولوية ${task.priority}`);
      block.title=`${task.name} | ${formatHours(h)} | أولوية ${task.priority}${clockInfo?' | '+clockInfo:''}`;
      block.setAttribute('aria-label',block.title+'، اضغط للتعديل');
      block.addEventListener('click',()=>editTask(task.id));track.append(block);
    });
    const left=Math.max(0,24-data.total);
    if(left>0) {
      const free=element('div','free-block'+(left<1?' compact':''));
      free.style.flex=`${left} 1 0px`;
      free.append(element('span','free-label',`متاح ${formatHours(left)}`));track.append(free);
    }
  }
  function layoutLanes(segments) {
    const ordered=[...segments].sort((a,b)=>a.start-b.start||a.end-b.end);
    const groups=[];let current=[],groupEnd=-1;
    for(const s of ordered){
      if(current.length && s.start>=groupEnd){groups.push(current);current=[];groupEnd=-1;}
      current.push(s);groupEnd=Math.max(groupEnd,s.end);
    }
    if(current.length)groups.push(current);
    const mapped=[];
    for(const group of groups){
      const lanes=[];
      const items=group.map(s=>{
        let idx=lanes.findIndex(end=>end<=s.start);
        if(idx===-1){idx=lanes.length;lanes.push(s.end);}else lanes[idx]=s.end;
        return {...s,lane:idx};
      });
      items.forEach(item=>mapped.push({...item,laneCount:lanes.length}));
    }
    return mapped;
  }
  function renderTimeline(track,data) {
    for(let hour=0;hour<=22;hour+=2) {
      const tick=element('div','time-tick');tick.style.top=`${hour/24*100}%`;
      tick.append(element('span','',`${pad(hour)}:00`));track.append(tick);
    }
    for(const segment of layoutLanes(data.fixed)) {
      const h=(segment.end-segment.start)/60;
      const block=element('button','timed-block'+(h<1?' compact':''));block.type='button';
      block.dataset.priority=String(segment.task.priority);
      block.style.background=PRIORITIES[segment.task.priority].color;
      block.style.color=segment.task.priority===0?'#ffffff':'#111827';
      block.style.textShadow=segment.task.priority===0?'0 1px 1px rgba(0,0,0,.18)':'none';
      block.style.top=`${segment.start/1440*100}%`;
      block.style.height=`${(segment.end-segment.start)/1440*100}%`;
      block.style.left=`calc(${segment.lane/segment.laneCount*100}% + 2px)`;
      block.style.width=`calc(${100/segment.laneCount}% - 4px)`;
      const displayedEnd=segment.end===1440?'24:00':`${pad(Math.floor(segment.end/60))}:${pad(segment.end%60)}`;
      const displayedStart=`${pad(Math.floor(segment.start/60))}:${pad(segment.start%60)}`;
      const timeLabel=`${displayedStart}–${displayedEnd}`;
      addBlockText(block,segment.task.name,h,timeLabel);
      block.title=`${segment.task.name} | ${timeLabel} | ${formatHours(h)} | أولوية ${segment.task.priority}`;
      block.setAttribute('aria-label',block.title+'، اضغط للتعديل');
      block.addEventListener('click',()=>editTask(segment.task.id));track.append(block);
    }
  }
  function renderWeek() {
    const week=$('weekView');week.replaceChildren();
    week.classList.toggle('timeline-view',viewMode==='timeline');
    const allSegments=timedSegments();
    const parallelSegments=allParallelSegments(allSegments);
    const lanesByDay=DAYS.map(day=>getParallelLanes(day.id,parallelSegments));
    const hasParallelTasks=tasks.some(t=>t.kind==='parallel');
    const hasParallel=hasParallelTasks && parallelVisible;
    $('parallelBoardNote').hidden=!hasParallel;
    const visibilityButton=$('parallelToggleBtn');
    visibilityButton.hidden=!hasParallelTasks;
    visibilityButton.textContent=parallelVisible?'⇉ إخفاء الأعمدة المتوازية':'⇉ إظهار الأعمدة المتوازية';
    visibilityButton.setAttribute('aria-pressed',String(parallelVisible));
    // Always stack the seven day cards vertically. Parallel tasks expand only
    // the lanes inside their own day card, never the week grid itself.
    week.style.removeProperty('grid-template-columns');
    week.style.removeProperty('min-width');
    // Keep equal chart heights across all seven days. Expand only when there
    // are many tasks, so even 15-minute entries can display their names.
    const weekData=DAYS.map(day=>getDayData(day.id,allSegments));
    const maxBlocks=Math.max(0,...weekData.map(data=>new Set([
      ...data.floating.map(t=>t.id),...data.fixed.map(s=>s.task.id)
    ]).size));
    const distributionTrackHeight=Math.max(480,maxBlocks*52+35);
    for(const day of DAYS) {
      const dayIndex=DAYS.indexOf(day),parallelLanes=parallelVisible?lanesByDay[dayIndex]:[];
      const data=weekData[dayIndex];
      const left=Math.max(0,24-data.total),over=data.total>24+1e-9;
      const column=element('article','day-column');const header=element('div','day-header');
      if(dayIndex===new Date().getDay())column.classList.add('today');
      header.append(element('div','day-title',day.name),element('div','day-budget',`${formatHours(data.total)} / 24`));
      const status=element('div','day-spare'+(over?' overbooked':data.conflict?' conflicted':''));
      status.textContent=over?`⚠ تجاوز بـ ${formatHours(data.total-24)}`:data.conflict?`⚠ تداخل مواعيد · متاح ${formatHours(left)}`:`متاح ${formatHours(left)}`;
      header.append(status);column.append(header);
      const track=element('div','day-track');
      if(viewMode==='duration') {
        track.style.height=distributionTrackHeight+'px';
        renderDistribution(track,day.id,data);
      }
      else renderTimeline(track,data);
      if(hasParallel) {
        const lanes=element('div','day-lanes');
        const main=element('div','primary-lane');
        main.append(element('div','lane-head','أساسي · يُحسب'));
        main.append(track);lanes.append(main);
        for(const entry of parallelLanes) lanes.append(renderParallelLane(entry,viewMode==='timeline'?720:distributionTrackHeight));
        column.append(lanes);
      } else column.append(track);
      if(viewMode==='timeline') {
        // Time blocks below one hour are necessarily too short to hold a label
        // on a strict 24-hour clock. Repeat them here as legible edit buttons.
        const shortSegments=data.fixed.filter(segment=>segment.end-segment.start<60)
          .sort((a,b)=>a.start-b.start);
        if(shortSegments.length) {
          const shortList=element('div','short-task-list');
          shortList.append(element('div','short-task-list-title','مهام قصيرة (أقل من ساعة)'));
          for(const segment of shortSegments) {
            const h=(segment.end-segment.start)/60;
            const displayTime=minutes=>minutes===1440?'24:00':pad(Math.floor(minutes/60))+':'+pad(minutes%60);
            const timeLabel=displayTime(segment.start)+' – '+displayTime(segment.end);
            const entry=makeButton('','short-task-entry',()=>editTask(segment.task.id));
            entry.style.borderRightColor=PRIORITIES[segment.task.priority].color;
            entry.append(element('span','short-task-entry-name',segment.task.name),
                         element('span','short-task-entry-time',timeLabel+' · '+formatHours(h)));
            entry.setAttribute('aria-label',segment.task.name+'، '+timeLabel+'، اضغط للتعديل');
            shortList.append(entry);
          }
          column.append(shortList);
        }
        const floating=element('div','unscheduled');
        floating.append(element('div','unscheduled-title','بدون موعد محدد'));
        if(!data.floating.length)floating.append(element('div','day-spare','لا توجد مهام'));
        else data.floating.sort((a,b)=>a.priority-b.priority).forEach(task=>{
          const item=makeButton('','floating-task',()=>editTask(task.id));
          item.style.borderRightColor=PRIORITIES[task.priority].color;
          item.append(element('span','floating-name',task.name),element('span','floating-hours',formatHours(task.hours[day.id])));
          item.title=`${task.name} | ${formatHours(task.hours[day.id])} | أولوية ${task.priority}`;
          floating.append(item);
        });
        column.append(floating);
      }
      if(parallelLanes.length) {
        const info=element('div','parallel-summary');
        info.append(element('strong','', '⇉ بالتوازي (لا يُحسب): '));
        parallelLanes.forEach((entry,index)=>{
          if(index) info.append(document.createTextNode(' · '));
          const shortInfo=entry.segments.map(seg=>seg.label).filter((val,index,arr)=>arr.indexOf(val)===index).join('، ');
          info.append(makeButton(entry.task.name+(viewMode==='timeline'&&shortInfo?' ('+shortInfo+')':''),'',()=>editTask(entry.task.id)));
        });
        column.append(info);
      }
      const taskIds=new Set([...data.floating.map(t=>t.id),...data.fixed.map(s=>s.task.id)]);
      const parallelCount=parallelLanes.length;
      const footerText=parallelCount?`${taskIds.size} أساسية · ${parallelCount} متوازية`:`${taskIds.size} ${taskIds.size===1?'مهمة':'مهام'}`;
      column.append(element('div','day-footer',footerText));
      week.append(column);
    }
  }
  function renderStats() {
    const allSegments=timedSegments(),datas=DAYS.map(d=>getDayData(d.id,allSegments));
    const totals=datas.map(d=>d.total),booked=sum(totals),free=sum(totals.map(t=>Math.max(0,24-t)));
    const busiest=Math.max(...totals),index=totals.indexOf(busiest);
    $('statBooked').textContent=formatHours(booked);
    $('statFree').textContent=formatHours(free);
    $('statBusy').textContent=busiest?DAYS[index].name:'—';
    $('statBusySub').textContent=busiest?`${formatHours(busiest)} محجوزة من 24`:'لا توجد مهام بعد';
    $('statTasks').textContent=String(tasks.length);
    const overflow=totals.filter(v=>v>24+1e-9).length;
    const conflicts=datas.filter(d=>d.conflict).length;
    const parallelCount=tasks.filter(t=>t.kind==='parallel').length;
    $('statTasksSub').textContent=overflow?`⚠ تجاوز 24 ساعة في ${overflow} يوم`:conflicts?`⚠ تداخل مواعيد في ${conflicts} يوم`:`${tasks.length-parallelCount} أساسية · ${parallelCount} متوازية`;
  }
  function renderList() {
    const list=$('taskList');list.replaceChildren();$('taskCount').textContent=tasks.length+' مهام';
    if(!tasks.length){list.append(element('div','empty','مفيش مهام لسه. ابدأ بإضافة أول مهمة.'));return;}
    [...tasks].sort((a,b)=>a.priority-b.priority).forEach(task=>{
      const item=element('div','task-item'),mark=element('div','task-color');mark.style.background=PRIORITIES[task.priority].color;
      const content=element('div');
      const name=element('div','task-name',task.name);
      if(task.kind==='parallel')name.append(document.createTextNode(' '),element('span','parallel-pill','⇉ متوازية'));
      content.append(name);
      if(task.kind==='parallel') {
        let modeText='طوال اليوم';
        if(task.parallelMode==='timed')modeText='بمواعيد محددة';
        if(task.parallelMode==='linked') {
          const base=tasks.find(t=>t.id===task.linkedTaskId && t.kind!=='parallel');
          modeText=base?'مرتبطة بـ '+base.name:'⚠ المهمة الأساسية المرتبطة غير موجودة';
        }
        content.append(element('div','task-desc',`أولوية ${task.priority} · ${task.days.length} أيام · ${modeText} · لا تخصم ساعات`));
      } else {
        const weekly=sum(Object.values(task.hours));
        content.append(element('div','task-desc',`أولوية ${task.priority} · ${Object.keys(task.hours).length} أيام · ${formatHours(weekly)} أسبوعيًا · ${task.mode==='timed'?'بمواعيد محددة':'مدة فقط'}`));
      }
      item.append(mark,content,makeButton('تعديل','task-edit',()=>editTask(task.id)));list.append(item);
    });
  }
  function renderStatsChart() {
    const allSegments=timedSegments(),totals=DAYS.map(d=>getDayData(d.id,allSegments).total);
    const booked=sum(totals),over=totals.some(v=>v>24+1e-9);
    const C=2*Math.PI*48,b=C*Math.min(1,booked/168);
    const arcB=$('donutBooked'),arcF=$('donutFree');
    arcB.setAttribute('stroke-dasharray',b+' '+C);
    arcF.setAttribute('stroke-dasharray',(C-b)+' '+C);arcF.setAttribute('stroke-dashoffset',String(-b));
    arcB.classList.toggle('over',over);
    const pct=Math.round(booked/168*100);
    $('donutPct').textContent=pct+'%';
    $('statsDonut').setAttribute('aria-label','الساعات المحجوزة '+formatHours(booked)+' من 168 ساعة، '+pct+'%');
  }
  function render(){renderStats();renderStatsChart();renderWeek();renderList();}
  $('taskForm').addEventListener('submit',saveForm);
  $('kindChoices').addEventListener('change',event=>{if(event.target.name==='taskKind')setTaskKind(event.target.value);});
  $('parallelModeChoices').addEventListener('change',event=>{if(event.target.name==='parallelMode')setParallelMode(event.target.value);});
  $('modeChoices').addEventListener('change',event=>{
    if(event.target.name==='timingMode')setTimingMode(event.target.value);
  });
  $('applyHoursBtn').addEventListener('click',()=>{
    const input=$('bulkHours'),h=Number(input.value);
    if(!input.value||!Number.isFinite(h)||h<=0||h>24){showError('أدخل ساعات صحيحة من 0.25 إلى 24.');return;}
    selectedDays.forEach(day=>formHours[day]=h);renderHourRows();clearError();notify('تم تطبيق الساعات');
  });
  $('applyTimesBtn').addEventListener('click',()=>{
    const start=$('bulkStart').value,end=$('bulkEnd').value;
    if(!getRange(start,end)){showError('راجع مواعيد البداية والنهاية.');return;}
    selectedDays.forEach(day=>formTimes[day]={start,end});
    renderTimeRows();clearError();notify('تم تطبيق المواعيد');
  });
  $('weekdaysBtn').addEventListener('click',()=>setDays(['sun','mon','tue','wed','thu']));
  $('allDaysBtn').addEventListener('click',()=>setDays(DAYS.map(d=>d.id)));
  $('clearDaysBtn').addEventListener('click',()=>setDays([]));
  $('durationViewBtn').addEventListener('click',()=>setView('duration'));
  $('timelineViewBtn').addEventListener('click',()=>setView('timeline'));
  $('parallelToggleBtn').addEventListener('click',()=>{
    parallelVisible=!parallelVisible;
    try{localStorage.setItem(PARALLEL_VIEW_KEY,String(parallelVisible));}catch(e){}
    renderWeek();
  });
  $('cancelEditBtn').addEventListener('click',resetEditor);
  function undoable(message,before) {
    if(!before)return notify(message);
    notify(message,{label:'تراجع',run:async()=>{
      const current=tasks;
      if(await persist(before,current,'تراجع عن عملية')){resetEditor();render();notify('تم التراجع');}
    }});
  }
  const fileNote=()=>fileHandle?' وهتتكتب كمان في ملف «'+fileName()+'».':'';
  $('deleteTaskBtn').addEventListener('click',async()=>{
    if(!dataReady||!editingId)return;
    const id=editingId,task=tasks.find(t=>t.id===id);if(!task)return;
    const dependents=tasks.filter(t=>t.kind==='parallel'&&t.parallelMode==='linked'&&t.linkedTaskId===id);
    const message=dependents.length
      ?`حذف المهمة «${task.name}» سيؤدي أيضًا إلى حذف ${dependents.length} مهمة متوازية مرتبطة بها حتى لا تظل ارتباطات مكسورة. هل تريد المتابعة؟`+fileNote()
      :`حذف المهمة «${task.name}»؟`+fileNote();
    if(!await openDialog(message,dependents.length?'حذف المهمة والمرتبطات':'حذف','إلغاء',true))return;
    const before=tasks,removeIds=new Set([id,...dependents.map(t=>t.id)]),next=tasks.filter(t=>!removeIds.has(t.id));
    if(!await persist(next,before,'حذف مهمة'))return;
    resetEditor();render();undoable('تم حذف المهمة',before);
  });
  $('resetBtn').addEventListener('click',async()=>{
    if(!dataReady)return;
    if(!await openDialog('هل تريد حذف كل المهام الحالية وإرجاع المهام الافتراضية؟'+fileNote(),'إعادة ضبط','إلغاء',true))return;
    const before=tasks;
    if(!await persist(normalizeTasks(demo),before,'إعادة ضبط',{recover:storageLoadFailed}))return;
    resetEditor();render();clearError();undoable('تمت استعادة المهام الافتراضية',before);
  });
  $('exportBtn').addEventListener('click',async()=>{
    if(storageLoadFailed){await openDialog('بيانات المتصفح مش قابلة للقراءة فمفيش نسخة سليمة تتصدّر. نزّل النسخة الخام من قائمة «النسخ الاحتياطية»، أو اربط/استورد ملفًا سليمًا.','حسنًا',null,false);return;}
    downloadText('weekly-time-planner-backup-v3.json',JSON.stringify(makeDataFile(),null,2));
    exportedSinceRisk=true;notify('تم تجهيز نسخة JSON للتنزيل');
  });
  $('linkDataFileBtn').addEventListener('click',connectSaveFile);
  $('importBtn').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try {
      if(file.size>MAX_FILE_BYTES)throw new Error('حجم الملف أكبر من 5MB');
      const imported=parseDataFile(await file.text());
      if(!await openDialog(`استبدال مهامك الحالية بـ ${imported.length} مهمة من الملف؟ سيتم حفظ النسخة الحالية ضمن النسخ الاحتياطية.`+fileNote(),'استبدال','إلغاء',true))return;
      const before=tasks;
      if(!await persist(imported,before,'استيراد ملف JSON',{recover:storageLoadFailed}))return;
      resetEditor();render();clearError();undoable('تم استيراد المهام',before);
    } catch(e) {await openDialog('تعذر الاستيراد: '+e.message,'حسنًا',null,false);}
    finally {event.target.value='';}
  });
  // Header: save-state chip + data menu
  const menu=$('dataMenu'),menuBtn=$('dataMenuBtn');
  const setMenu=open=>{menu.hidden=!open;menuBtn.setAttribute('aria-expanded',String(open));};
  menuBtn.addEventListener('click',e=>{e.stopPropagation();setMenu(menu.hidden);});
  menu.addEventListener('click',e=>{if(e.target.closest('button'))setMenu(false);});
  document.addEventListener('click',e=>{if(!menu.hidden&&!menu.contains(e.target))setMenu(false);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!menu.hidden){setMenu(false);menuBtn.focus();}});
  $('saveChip').addEventListener('click',e=>{e.stopPropagation();if(fileState==='needs')reconnect();else if(fileHandle&&fileState==='error'){fileState='ok';fileErrorSnapshot=null;syncWithFile('startup');}else setMenu(menu.hidden);});
  $('fabAdd').addEventListener('click',()=>{$('editorPanel').scrollIntoView({behavior:'smooth',block:'start'});$('taskName').focus({preventScroll:true});});
  // Keep every open tab on the same data
  window.addEventListener('storage',e=>{
    if(e.storageArea!==localStorage)return;
    if(e.key===STATE_KEY||e.key===KEY||e.key===REV_KEY)adoptFromStorage();
    else if(e.key===FILEREV_KEY){fileRev=numKey(FILEREV_KEY);updateStorageStatus();}
    else if(e.key===LINK_KEY)initFile();
    else if(e.key===REPLACED_KEY)updateStorageStatus();
  });
  try {
    if('BroadcastChannel' in window) {
      stateChannel=new BroadcastChannel(KEY+'-state-channel');
      stateChannel.onmessage=e=>{if(e.data?.type==='state-updated'&&e.data.revision>rev)adoptFromStorage();};
    }
  } catch(e){stateChannel=null;}
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='visible'){adoptFromStorage();if(isLeader)checkExternal();}
    else if(fileHandle&&isLeader&&rev>fileRev)writeFile();
  });
  window.addEventListener('focus',()=>{adoptFromStorage();if(isLeader)checkExternal();});
  setInterval(()=>{if(isLeader&&document.visibilityState==='visible')checkExternal();},8000);
  window.addEventListener('pagehide',()=>{if(stateChannel)stateChannel.close();});
  window.addEventListener('beforeunload',e=>{
    const safeInFile=fileHandle&&fileState==='ok'&&rev<=fileRev;
    const unsafe=!!storageErr||(atRisk&&!exportedSinceRisk&&!safeInFile)||(fileHandle&&(fileState==='saving'||(rev>fileRev&&fileState!=='ok')));
    if(unsafe){e.preventDefault();e.returnValue='';}
  });
  async function offerUnreadable() {
    if(!storageLoadFailed)return;
    if(await openDialog('بياناتك المحفوظة في المتصفح غير قابلة للقراءة. لم نعدّل الأصل، وتم الاحتفاظ بنسخة خام إن أمكن. هل تريد تنزيلها الآن؟','تنزيل النسخة الأصلية','لاحقًا',false)){if(unreadableRaw!==null)downloadText('weekly-planner-unreadable-data.json',unreadableRaw);else downloadReplaced();}
  }
  updateStorageStatus();
  renderPriorityPicker();renderDayPicker();renderHourRows();renderTimeRows();renderLegend();
  setTaskKind('normal');setTimingMode('duration');setView(viewMode);
  render();
  initializeDurableState().then(()=>{
    becomeLeader();
    initFile().then(offerUnreadable);
  }).catch(e=>{dataReady=true;console.error(e);updateStorageStatus();});
})();
