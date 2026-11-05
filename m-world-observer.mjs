import { DIRECTOR_ACTIONS, DIRECTOR_EVENTS, DIRECTOR_KINDS, DIRECTOR_MAX_RECENT, DIRECTOR_MAX_TARGETS, DIRECTOR_SECTIONS, DIRECTOR_ZONES, validateDirectorInput } from './m-world-director-protocol.mjs?v=44';
const safeId=value=>typeof value==='string' && /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,63}$/u.test(value);
const cleanTitle=value=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/gu,' ').replace(/\s+/gu,' ').trim().slice(0,80):'';

/** Summarizes only known public component records supplied by the world owner. */
export function createWorldObserver({getComponents=()=>[]}={}) {
  let disposed=false;
  function capture({revision,section='none',language='en',event='idle',attentionId=null,recent=[]}={}) {
    if(disposed || !safeId(revision))return null;
    let records;
    try {records=getComponents();}catch{return null;}
    if(!Array.isArray(records))return null;
    const targets=[],ids=new Set();
    for(const record of records){
      if(targets.length>=DIRECTOR_MAX_TARGETS)break;
      if(!record || !safeId(record.id) || ids.has(record.id) || !DIRECTOR_KINDS.includes(record.kind) || !DIRECTOR_ZONES.includes(record.zone) || !Array.isArray(record.actions))continue;
      const title=cleanTitle(record.title),actions=[...new Set(record.actions.filter(action=>DIRECTOR_ACTIONS.includes(action)))];
      if(!title || !actions.length)continue;
      targets.push({id:record.id,kind:record.kind,title,actions,zone:record.zone});ids.add(record.id);
    }
    const snapshot={revision,section:DIRECTOR_SECTIONS.includes(section)?section:'none',language:language==='pt'?'pt':'en',event:DIRECTOR_EVENTS.includes(event)?event:'idle',attentionId:ids.has(attentionId)?attentionId:null,targets,recent:(Array.isArray(recent)?recent:[]).filter(item=>item && DIRECTOR_ACTIONS.includes(item.action) && (safeId(item.targetId) || (item.targetId===null && item.action==='rest'))).slice(-DIRECTOR_MAX_RECENT).map(item=>({targetId:item.targetId,action:item.action}))};
    return validateDirectorInput({snapshot})?snapshot:null;
  }
  return {capture,dispose(){disposed=true;}};
}