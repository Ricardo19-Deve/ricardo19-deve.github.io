/**
 * V67: a small public forecast for the PORTFOLIO location, Leiria, Portugal.
 * MET Norway Locationforecast 2.0 allows commercial reuse with CC BY 4.0
 * attribution. Forecasts are estimates, NOT direct local observations.
 *
 * No visitor location, user credentials, geolocation or new server services.
 * MET Norway non-Nordic forecasts must not be polled more than every 3 hours.
 */
export const M_WEATHER_SITE=Object.freeze({name:'Leiria',lat:39.74,lon:-8.81});
export const M_WEATHER_REFRESH_MS=3*60*60*1000;
export const M_WEATHER_MET_URL='https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=39.74&lon=-8.81';
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(n)?n:min));
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max?v:null;
const getTime=v=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?Z$/u.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):null;
const windDirection=v=>((v%360)+360)%360;
function conditionFrom(code,precipitation,cloud){
 if(/snow|sleet/iu.test(code))return 'snow';
 if(/rain|drizzle|thunder/iu.test(code)||precipitation>=.2)return 'rain';
 if(/cloudy/iu.test(code)&&!/partly/iu.test(code))return 'cloudy';
 if(/partlycloudy/iu.test(code))return 'partly-cloudy';
 return cloud>=70?'cloudy':cloud>=30?'partly-cloudy':'clear';
}
export function normalizeMetForecast(payload,{now=Date.now()}={}){
 const rows=payload?.properties?.timeseries;
 if(!Array.isArray(rows)||!rows.length)return null;
 let nearest=null,minDifference=Infinity;
 for(const row of rows.slice(0,18)){
  const at=getTime(row?.time);
  if(at===null)continue;
  const diff=Math.abs(now-at);
  if(diff<minDifference){nearest=row;minDifference=diff;}
 }
 if(!nearest||minDifference>4*3600000)return null;
 const instant=nearest.data?.instant?.details;
 const temp=finite(instant?.air_temperature,-50,60);
 const cloud=finite(instant?.cloud_area_fraction,0,100);
 const wind=finite(instant?.wind_speed,0,80); // m/s
 const direction=finite(instant?.wind_from_direction,0,360);
 if(temp===null||cloud===null||wind===null||direction===null)return null;
 const next=nearest.data?.next_1_hours;
 const rainMm=finite(next?.details?.precipitation_amount,0,100);
 const code=typeof next?.summary?.symbol_code==='string'&&next.summary.symbol_code.length<80
  ?next.summary.symbol_code:'';
 if(rainMm===null&&!code)return null;
 const condition=conditionFrom(code,rainMm??0,cloud);
 const rainy=condition==='rain',snowy=condition==='snow';
 const intensity=rainy||snowy?clamp(rainMm??.25,0,10):0;
 return {status:'ready',place:M_WEATHER_SITE.name,condition,precipitation:intensity,
  storm:/thunder/iu.test(code),cloud:cloud/100,windKmh:wind*3.6,
  windDirection:windDirection(direction),temperatureC:temp,
  isDay:!/_night$/iu.test(code),source:'MET Norway',
  forecastFor:new Date(getTime(nearest.time)).toISOString(),
  nearbyObservation:false,estimate:true};
}
export function weatherVisual(weather){
 if(!weather||weather.status!=='ready')return {rain:0,snow:0,cloud:0,wind:0,drift:0,umbrella:false,night:false};
 const rainy=weather.condition==='rain',snowy=weather.condition==='snow';
 const wind=clamp(weather.windKmh/60,0,1);
 // Weather bearing is the direction FROM which wind blows.
 const drift=-Math.sin(((weather.windDirection||0)*Math.PI)/180)*wind;
 return {rain:rainy?clamp(.25+(weather.precipitation||0)*.23,.25,.88):0,
  snow:snowy?clamp(.25+(weather.precipitation||0)*.1,.25,.8):0,
  cloud:clamp(weather.cloud??0,0,1),wind,drift,umbrella:rainy,night:weather.isDay===false};
}
/** An explicitly labelled preview, exclusively enabled behind m-debug=1. */
export function makeWeatherDemo(kind){
 if(!['rain','wind','cloud','sun','snow'].includes(kind))return null;
 const preset={
  rain:{condition:'rain',precipitation:2.5,cloud:.98,windKmh:35,windDirection:90,isDay:true},
  wind:{condition:'partly-cloudy',precipitation:0,cloud:.38,windKmh:58,windDirection:270,isDay:true},
  cloud:{condition:'cloudy',precipitation:0,cloud:.95,windKmh:12,windDirection:50,isDay:true},
  sun:{condition:'clear',precipitation:0,cloud:.02,windKmh:4,windDirection:0,isDay:true},
  snow:{condition:'snow',precipitation:.8,cloud:.9,windKmh:15,windDirection:30,isDay:true}
 }[kind];
 return {status:'ready',place:M_WEATHER_SITE.name,...preset,storm:false,
  temperatureC:12,forecastFor:null,source:'DEMO — não é tempo real',estimate:true};
}
async function loadForecast(fetchImpl,signal){
 // Simple cross-origin browser request: Origin identifies the portfolio.
 // Honor MET Norway HTTP cache and do not trigger CORS preflight.
 const response=await fetchImpl(M_WEATHER_MET_URL,{method:'GET',signal,
  credentials:'omit',cache:'default',redirect:'follow'});
 if(!response.ok)throw Error('MET Norway HTTP '+response.status);
 const len=Number(response.headers?.get?.('content-length'));
 if(Number.isFinite(len)&&len>1_500_000)throw Error('Forecast too large');
 return response.json();
}
export function createWeatherReader({fetchImpl=globalThis.fetch,now=()=>Date.now(),
 ttlMs=M_WEATHER_REFRESH_MS}={}){
 let cached=null,expiry=0,lastSuccessAt=0,pending=null;
 async function refresh(){
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),7000);
  try{
   const payload=await loadForecast(fetchImpl,ctrl.signal);
   const forecast=normalizeMetForecast(payload,{now:now()});
   if(forecast){cached=forecast;lastSuccessAt=now();}
   else if(now()-lastSuccessAt>4*60*60*1000)cached=null;
   expiry=now()+Math.max(3*60*60*1000,ttlMs);
   return cached;
  }catch{
   if(now()-lastSuccessAt>4*60*60*1000)cached=null;
   // Provider unavailable: bounded retry while avoiding aggressive polling.
   expiry=now()+15*60*1000;
   return cached;
  }finally{clearTimeout(timeout);}
 }
 async function get(){
  if(now()<expiry)return cached;
  if(pending)return pending;
  pending=refresh();
  try{return await pending;}finally{pending=null;}
 }
 return {get,snapshot:()=>cached};
}
