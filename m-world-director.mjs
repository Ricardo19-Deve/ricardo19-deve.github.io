import { validateDirectorInput, validateDirectorReply } from './m-world-director-protocol.mjs?v=29';

export const DIRECTOR_SESSION_LIMIT = 6;
export const DIRECTOR_MIN_INTERVAL = 65_000;
export const DIRECTOR_STORAGE_KEY = 'm-world-director-session-v1';
export const DIRECTOR_ENABLED_KEY = 'm-world-director-enabled-v1';
const HEALTH_BACKOFF = 300_000;
const fingerprint = snapshot => JSON.stringify({section:snapshot.section,language:snapshot.language,event:snapshot.event,targets:snapshot.targets,attentionId:snapshot.attentionId,recent:snapshot.recent});
function digest(value) { let hash=2166136261; for(const character of value) hash=Math.imul(hash^character.charCodeAt(0),16777619); return (hash>>>0).toString(16).padStart(8,'0'); }
export function directorEndpoint(value, base='https://ricardo19-deve.github.io/') {
  try {
    const url=new URL(value,base),local=['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if(!value || (url.protocol!=='https:' && !(local && url.protocol==='http:')) || url.username || url.password || url.search || url.hash || url.pathname!=='/api/m/direct') return null;
    return url.href;
  } catch { return null; }
}
function readSession(storage) {
  const raw=storage.getItem(DIRECTOR_STORAGE_KEY);
  if(!raw) return {attempts:0,lastAt:null,contexts:[]};
  const value=JSON.parse(raw);
  if(!Number.isInteger(value.attempts) || value.attempts<0 || value.attempts>DIRECTOR_SESSION_LIMIT
    || (value.lastAt!==null && (!Number.isFinite(value.lastAt) || value.lastAt<0))
    || !Array.isArray(value.contexts) || value.contexts.length>DIRECTOR_SESSION_LIMIT
    || !value.contexts.every(key=>typeof key==='string' && /^[0-9a-f]{8}$/u.test(key))) throw new Error('Invalid session accounting');
  return value;
}

/** Event-driven and headless: the existing world owner supplies sparse updates. */
export function createWorldDirector({endpoint='',healthEndpoint,fetchImpl=globalThis.fetch?.bind(globalThis),storage,now=Date.now,onIntent=()=>{},onStatus=()=>{}}={}) {
  const target=directorEndpoint(endpoint);
  let healthTarget=null;
  try { healthTarget=target ? new URL('/health',target).href : null; if(healthEndpoint && target) {const value=new URL(healthEndpoint);if(value.origin===new URL(target).origin && value.pathname==='/health' && !value.username && !value.password && !value.search && !value.hash)healthTarget=value.href;} } catch { /* Unconfigured stays local. */ }
  let enabled=true,available=null,source='local',lastDecision=null,reason='waiting',healthy=false,healthNextAt=0,operation=null,context=null,disposed=false,lastStatus='',storageReady=false;
  let session={attempts:0,lastAt:null,contexts:[]};
  try {
    storage ||= globalThis.sessionStorage;
    session=readSession(storage);
    const preference=storage.getItem(DIRECTOR_ENABLED_KEY);if(preference!==null)enabled=preference==='true';
    const saved=JSON.stringify(session);storage.setItem(DIRECTOR_STORAGE_KEY,saved);
    storageReady=storage.getItem(DIRECTOR_STORAGE_KEY)===saved;
  } catch { /* No persistent tab quota means no automatic requests. */ }
  function getStatus(){return {enabled,available,pending:operation!==null,attempts:session.attempts,limit:DIRECTOR_SESSION_LIMIT,nextAt:session.lastAt===null?0:session.lastAt+DIRECTOR_MIN_INTERVAL,source,lastDecision:lastDecision?{...lastDecision}:null,reason};}
  function publish(){const value=getStatus(),key=JSON.stringify(value);if(key!==lastStatus){lastStatus=key;onStatus(value);}return value;}
  function blocked(next=context){return disposed || !enabled || !next || next.hidden || next.reducedMotion || next.typing || next.reading || next.scrolling || next.busy;}
  function abort(){if(!operation)return;const previous=operation;operation=null;clearTimeout(previous.timer);previous.controller.abort();if(previous.kind==='health')healthNextAt=now()+1_000;source='local';}
  function unavailable(nextReason){healthy=false;available=false;reason=nextReason;source='local';healthNextAt=now()+HEALTH_BACKOFF;}
  function expire(op){if(operation!==op)return;operation=null;op.controller.abort();unavailable('unavailable');publish();}
  function startHealth(){
    const op={kind:'health',controller:new AbortController(),timer:null};operation=op;reason='checking';healthNextAt=now()+HEALTH_BACKOFF;
    op.timer=setTimeout(()=>expire(op),8_000);publish();
    Promise.resolve().then(()=>{if(operation!==op)return null;return fetchImpl(healthTarget,{method:'GET',signal:op.controller.signal,credentials:'omit',cache:'no-store'});}).then(async response=>{
      if(operation!==op || op.controller.signal.aborted)return;
      const body=response.ok?await response.json():null;
      if(operation!==op || op.controller.signal.aborted)return;
      healthy=Boolean(body?.configured===true && body?.director?.version===1 && body?.director?.enabled===true);available=healthy;reason=healthy?'ready':'unavailable';
      if(!healthy)healthNextAt=now()+HEALTH_BACKOFF;
    }).catch(()=>{if(operation===op)unavailable('unavailable');}).finally(()=>{clearTimeout(op.timer);if(operation===op){operation=null;publish();}});
  }
  function startDecision(snapshot,key){
    try {
      const persisted=readSession(storage);
      session={attempts:Math.max(session.attempts,persisted.attempts),lastAt:session.lastAt===null&&persisted.lastAt===null?null:Math.max(session.lastAt??0,persisted.lastAt??0),contexts:[...new Set([...session.contexts,...persisted.contexts])]};
      if(session.attempts>=DIRECTOR_SESSION_LIMIT || session.contexts.includes(key) || (session.lastAt!==null && now()<session.lastAt+DIRECTOR_MIN_INTERVAL)){reason='cooldown';publish();return;}
      const next={attempts:session.attempts+1,lastAt:now(),contexts:[...session.contexts,key]};
      const saved=JSON.stringify(next);storage.setItem(DIRECTOR_STORAGE_KEY,saved);
      if(storage.getItem(DIRECTOR_STORAGE_KEY)!==saved)throw new Error('Session accounting unavailable');
      session=next;
    } catch {storageReady=false;unavailable('storage-unavailable');publish();return;}
    const op={kind:'decision',controller:new AbortController(),timer:null,revision:snapshot.revision,key};operation=op;reason='thinking';
    op.timer=setTimeout(()=>expire(op),12_000);publish();
    Promise.resolve().then(()=>{if(operation!==op)return null;return fetchImpl(target,{method:'POST',credentials:'omit',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({snapshot}),signal:op.controller.signal});}).then(async response=>{
      if(operation!==op || op.controller.signal.aborted)return;
      if(!response.ok){unavailable(response.status===429?'rate-limited':'unavailable');return;}
      const decision=await response.json();
      if(operation!==op || op.controller.signal.aborted || blocked() || context.snapshot?.revision!==op.revision || digest(fingerprint(context.snapshot))!==op.key)return;
      if(!validateDirectorReply(decision,{snapshot})){reason='invalid-response';source='local';return;}
      lastDecision={...decision};const accepted=onIntent({...decision},structuredClone(snapshot));source=accepted===false?'local':'openai';reason=accepted===false?'unavailable-action':'ready';
    }).catch(()=>{if(operation===op)unavailable('unavailable');}).finally(()=>{clearTimeout(op.timer);if(operation===op){operation=null;publish();}});
  }
  function update(next={}){
    if(disposed)return getStatus();
    const valid=validateDirectorInput({snapshot:next.snapshot});context={...next,snapshot:valid?structuredClone(next.snapshot):null};
    const key=valid?digest(fingerprint(context.snapshot)):'';
    if(operation && (blocked() || !valid || (operation.kind==='decision' && (operation.revision!==context.snapshot.revision || operation.key!==key))))abort();
    if(blocked()){reason=enabled?'paused-for-visitor':'paused';return publish();}
    if(!valid){reason='waiting';return publish();}
    if(!target || !fetchImpl || !healthTarget){available=false;reason='unavailable';return publish();}
    if(!storageReady){available=false;reason='storage-unavailable';return publish();}
    if(operation)return publish();
    if(session.attempts>=DIRECTOR_SESSION_LIMIT){reason='session-limit';return publish();}
    if(!healthy){if(now()>=healthNextAt)startHealth();return publish();}
    if(session.contexts.includes(key)){reason='waiting-for-context';return publish();}
    if(session.lastAt!==null && now()<session.lastAt+DIRECTOR_MIN_INTERVAL){reason='cooldown';return publish();}
    startDecision(context.snapshot,key);return getStatus();
  }
  function setEnabled(value){enabled=Boolean(value);if(!enabled)abort();try{const saved=String(enabled);storage.setItem(DIRECTOR_ENABLED_KEY,saved);if(storage.getItem(DIRECTOR_ENABLED_KEY)!==saved)throw new Error('Preference unavailable');}catch{storageReady=false;unavailable('storage-unavailable');}reason=enabled?(storageReady?'waiting':'storage-unavailable'):'paused';return publish();}
  function dispose(){disposed=true;abort();}
  publish();return {update,setEnabled,getStatus,dispose};
}