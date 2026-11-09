/**
 * Cron-based LinkedIn sync, using only official member-authorized APIs.
 * Preferred: approved r_member_social Posts API. Fallback: existing EU DMA
 * MEMBER_SHARE_INFO snapshot (only rows marked explicitly PUBLIC).
 * Never scrape, publish or write unknown-audience/connection-only posts.
 */
import {createMemberPostsReader} from './member-posts.mjs';
import {createDMALiveReader} from './linkedin-live.mjs';
import {mergeVerifiedActivities} from './public-activity.mjs';
import {storeVerifiedPosts} from './verified-post-cache.mjs';
export const M_LINKEDIN_SYNC_CRON='15 2,5,8,11,14,17,20,23 * * *';

export async function refreshAutomaticLinkedIn(env,{fetchImpl=globalThis.fetch,now=()=>Date.now(),store=storeVerifiedPosts}={}){
 const official=createMemberPostsReader({
  token:env.LINKEDIN_MEMBER_SOCIAL_ACCESS_TOKEN||'',
  personUrn:env.LINKEDIN_MEMBER_PERSON_URN||'',fetchImpl,now
 });
 const dma=createDMALiveReader({token:env.LINKEDIN_DMA_ACCESS_TOKEN||'',fetchImpl,now});
 if(!official.enabled&&!dma.enabled)return {state:'not-configured',provider:'none',stored:false};
 let officialResult=null,dmaResult=null;
 // Keep the official API isolated from DMA: never reuse a DMA token as proof
 // of the restricted r_member_social scope.
 if(official.enabled)officialResult=await official.get();
 // The existing DMA is a separate allowed source, with its original
 // private-by-default visibility enforcement and fixed Member Shares domain.
 if(dma.enabled)dmaResult=await dma.get();
 const successes=[officialResult,dmaResult].filter(result=>result&&['ready','empty'].includes(result.status));
 if(!successes.length)return {state:'unavailable',provider:official.enabled?'official':'dma',stored:false};
 const merged=mergeVerifiedActivities(officialResult,dmaResult);
 // On an explicit empty/zero-public result, also replace the cache with
 // empty. Never keep previously verified content after sources clear it.
 const safe=merged.status==='ready'||merged.status==='empty'?merged:{status:'empty',posts:[],asOf:null};
 const stored=await store(env,safe);
 return {state:stored?'updated':'store-unavailable',provider:official.enabled?'official-and-dma':'dma',
  count:safe.posts.length,stored};
}
