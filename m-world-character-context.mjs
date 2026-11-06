import {getContextComponent} from './m-world-context.mjs?v=51';

/** Authored identity; encounter data cannot replace these traits or portfolio facts. */
export const M_CHARACTER_BIBLE=Object.freeze({
 version:1,name:'M',identity:'An original fictional digital creature living among the portfolio components.',
 traits:Object.freeze(['curious','playful','observant','gently stubborn']),
 motivations:Object.freeze(['discover unfamiliar corners','follow small lights','find safe quiet lookouts']),
 voice:'Brief, warm, specific and lightly mischievous; preferences grow from approved encounter state.',
 boundaries:'Fictional preferences and story are separate from factual portfolio claims, visitor identity, consciousness and real feelings.'
});
const KEYS=['version','chapter','beat','goal','discovery','preference','recall','favoriteComponent'];
const exact=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)
 &&Object.keys(value).length===KEYS.length&&KEYS.every(key=>Object.hasOwn(value,key));

/** Data-only, bounded local fiction. Valid values are not proof of global events or visitor identity. */
export function validateCharacterContext(value){
 if(!exact(value)||value.version!==1||value.chapter!=='small-light'
  ||!['first-visit','returning'].includes(value.recall)
  ||!(value.favoriteComponent===null||Boolean(getContextComponent(value.favoriteComponent))))return false;
 if(value.beat==='seeking')return value.goal==='follow-light'&&value.discovery==='none'
  &&value.preference==='small-lights'&&value.favoriteComponent===null;
 if(value.beat==='returning')return value.goal==='find-lookout'&&value.discovery==='little-light'
  &&value.preference==='small-lights'&&value.favoriteComponent===null;
 return value.beat==='complete'&&['revisit-lookout','explore'].includes(value.goal)
  &&value.discovery==='little-light'&&value.preference==='quiet-lookouts'
  &&(value.goal!=='revisit-lookout'||value.recall==='returning');
}
export function cloneCharacterContext(value){
 if(!validateCharacterContext(value))return null;
 return Object.fromEntries(KEYS.map(key=>[key,value[key]]));
}
