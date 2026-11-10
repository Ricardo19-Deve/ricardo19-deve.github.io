/**
 * V67 live weather for the PORTFOLIO location (Leiria, Portugal).
 * Never geolocates visitors or invents weather when the sources are stale.
 *
 * IPMA: hourly nearby station observations (precipitation/wind/temperature).
 * Open-Meteo: model-derived current cloud/precipitation/wind conditions.
 * Both are public, anonymous endpoints; no API keys, cookies or new Worker.
 */
export const M_WEATHER_SITE=Object.freeze({name:'Leiria',lat:39.7444,lon:-8.8072});
export const M_WEATHER_REFRESH_MS=20*60*1000;
export const M_WEATHER_IPMA_URL='https://api.ipma.pt/open-data/observation/meteorology/stations/obs-surface.geojson';
export const M_WEATHER_MODEL_URL='https://api.open-meteo.com/v1/forecast?latitude=39.7444&longitude=-8.8072&current=temperature_2m,precipitation,rain,showers,snowfall,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,is_day&timezone=GMT&forecast_days=1';
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number.isFinite(n)?n:min));
const finite=(value,min,max)=>typeof value==='number'&&Number.isFinite(value)&&value>=min&&value<=max?value:null;
const degrees=(d)=>((d%360)+360)%360;
const validTime=(raw)=>{
 if(typeof raw!=='string'||!/^20\d\d-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:Z)?$/u.test(raw))return null;
 const ms=Date.parse(raw.endsWith('Z')?raw:raw+'Z');
 return Number.isFinite(ms)?ms:null;
};
const RAIN_CODES=new Set([51,53,55,56,57,61,63,65,66,67,80,81,82,95,96,99]);
const SNOW_CODES=new Set([71,73,75,77,85,86]);
const STORM_CODES=new Set([95,96,99]);
const differenceHours=(at,now)=>Math.abs(now-at)/3600000;
export function normalizeModelWeather(payload,{now=Date.now()}={}){
 const c=payload?.current;
 const observed=validTime(c?.time);
 if(!c||observed===null||differenceHours(observed,now)>3)return null;
 const temperature=finite(c.temperature_2m,-50,60),windKmh=finite(c.wind_speed_10m,0,250);
 const windDirection=finite(c.wind_direction_10m,0,360),cloud=finite(c.cloud_cover,0,100);
 const rate=finite(c.precipitation,0,100),rain=finite(c.rain,0,100),showers=finite(c.showers,0,100),snow=finite(c.snowfall,0,100);
 const code=Number.isInteger(c.weather_code)&&c.weather_code>=0&&c.weather_code<=99?c.weather_code:null;
 if(temperature===null||windKmh===null||cloud===null||code===null)return null;
 const snowy=SNOW_CODES.has(code)||(snow??0)>.05;
 const raining=!snowy&&(RAIN_CODES.has(code)||(rate??0)>=.15||(rain??0)>=.15||(showers??0)>=.15);
 const storm=STORM_CODES.has(code);
 const precipitation=clamp(Math.max(rate??0,rain??0,showers??0,snow??0),0,10);
 return {
  status:'ready',place:M_WEATHER_SITE.name,condition:snowy?'snow':raining?'rain':cloud>=70?'cloudy':cloud>=30?'partly-cloudy':'clear',
  precipitation,storm,cloud:cloud/100,windKmh,windDirection:degrees(windDirection??0),
  temperatureC:temperature,isDay:c.is_day!==0,source:'Open-Meteo',
  observedAt:new Date(observed).toISOString(),nearbyObservation:false
 };
}
const radians=d=>d*Math.PI/180;
const distanceKm=(a,b,c,d)=>{
 const dlat=radians(c-a),dlon=radians(d-b),v=Math.sin(dlat/2)**2+Math.cos(radians(a))*Math.cos(radians(c))*Math.sin(dlon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(Math.min(1,v)));
};
export function nearestIpmaObservation(payload,{now=Date.now(),lat=M_WEATHER_SITE.lat,lon=M_WEATHER_SITE.lon}={}){
 if(!Array.isArray(payload?.features))return null;
 let best=null;
 for(const feature of payload.features.slice(0,600)){
  const [longitude,latitude]=feature?.geometry?.coordinates||[];
  if(finite(latitude,-90,90)===null||finite(longitude,-180,180)===null)continue;
  const p=feature.properties;
  const stationAt=validTime(p?.time);
  if(stationAt===null||stationAt>now+10*60*1000||now-stationAt>2.5*3600000)continue;
  const km=distanceKm(lat,lon,latitude,longitude);
  if(km>45||(best&&km>=best.distanceKm))continue;
  const temperatureC=finite(p.temperatura,-50,60);
  const windKmh=finite(p.intensidadeVentoKM,0,250);
  const precipitation=finite(p.precAcumulada,0,100);
  // IPMA uses -99 as missing observation; reject it instead of treating as 0.
  if(temperatureC===null&&windKmh===null&&precipitation===null)continue;
  const directions={N:0,NE:45,E:90,SE:135,S:180,SW:225,W:270,NW:315};
  const direction=directions[p.descDirVento]??null;
  best={distanceKm:Math.round(km*10)/10,station:String(p.localEstacao||'estação próxima').slice(0,65),
   observedAt:new Date(stationAt).toISOString(),temperatureC,windKmh,
   windDirection:direction,precipitation};
 }
 return best;
}
export function combineWeather(model,observed){
 if(!model&&!observed)return null;
 if(!observed)return model;
 const close=observed.distanceKm<=25;
 if(!model){
  // Observations show cumulative nearby rainfall, NOT necessarily that
  // rain is falling at the website's location at this exact minute.
  const raining=observed.distanceKm<=10&&(observed.precipitation??0)>=.2;
  if(!raining&&observed.windKmh===null)return null;
  return {status:'ready',place:M_WEATHER_SITE.name,condition:raining?'rain':'unknown',
   precipitation:raining?observed.precipitation:0,storm:false,cloud:0,
   windKmh:observed.windKmh??0,windDirection:observed.windDirection??0,
   temperatureC:observed.temperatureC,isDay:true,source:'IPMA',
   observedAt:observed.observedAt,nearbyObservation:true};
 }
 // Keep high-resolution cloud and local rain estimates from the model,
 // supplement only measured wind and temperature at reasonably close stations.
 return {...model,windKmh:close&&observed.windKmh!==null?observed.windKmh:model.windKmh,
  windDirection:close&&observed.windDirection!==null?observed.windDirection:model.windDirection,
  temperatureC:close&&observed.temperatureC!==null?observed.temperatureC:model.temperatureC,
  source:close?'IPMA + Open-Meteo':model.source,nearbyObservation:close};
}
export function weatherVisual(weather){
 if(!weather||weather.status!=='ready')return {rain:0,snow:0,cloud:0,wind:0,drift:0,umbrella:false,night:false};
 const rainy=weather.condition==='rain',snowy=weather.condition==='snow';
 const wind=clamp(weather.windKmh/60,0,1);
 // Meteorological wind is the direction FROM which it blows.
 const drift=-Math.sin(radians(weather.windDirection??0))*wind;
 return {
  rain:rainy?clamp(.25+(weather.precipitation||0)*.23,.25,.88):0,
  snow:snowy?clamp(.25+(weather.precipitation||0)*.1,.25,.8):0,
  cloud:clamp(weather.cloud??0,0,1),wind,drift,
  umbrella:rainy,night:weather.isDay===false
 };
}
async function responseJson(fetchImpl,url,signal){
 const response=await fetchImpl(url,{method:'GET',signal,credentials:'omit',cache:'no-store',redirect:'follow'});
 if(!response.ok)throw Error('Weather provider HTTP '+response.status);
 const length=Number(response.headers?.get?.('content-length'));
 if(Number.isFinite(length)&&length>1_000_000)throw Error('Weather response too large');
 return response.json();
}
export function createWeatherReader({fetchImpl=globalThis.fetch,now=()=>Date.now(),ttlMs=M_WEATHER_REFRESH_MS}={}){
 let cached=null,expiry=0,inflight=null;
 async function refresh(){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),7000);
  try{
   const [model,ipma]=await Promise.allSettled([
    responseJson(fetchImpl,M_WEATHER_MODEL_URL,controller.signal),
    responseJson(fetchImpl,M_WEATHER_IPMA_URL,controller.signal)
   ]);
   const normalized=model.status==='fulfilled'?normalizeModelWeather(model.value,{now:now()}):null;
   const nearest=ipma.status==='fulfilled'?nearestIpmaObservation(ipma.value,{now:now()}):null;
   const result=combineWeather(normalized,nearest);
   if(result)cached=result;
   expiry=now()+Math.max(60_000,ttlMs);
   return result||cached;
  }catch{return cached;}finally{clearTimeout(timeout);}
 }
 async function get(){
  if(now()<expiry)return cached;
  if(inflight)return inflight;
  inflight=refresh();
  try{return await inflight;}finally{inflight=null;}
 }
 return {get,snapshot:()=>cached};
}
