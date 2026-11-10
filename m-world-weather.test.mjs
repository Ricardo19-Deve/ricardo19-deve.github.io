import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {M_WEATHER_SITE,M_WEATHER_MODEL_URL,M_WEATHER_IPMA_URL,
 normalizeModelWeather,nearestIpmaObservation,combineWeather,weatherVisual,
 createWeatherReader,makeWeatherDemo} from './m-world-weather.mjs';
import {weatherActorPose} from './m-world-weather-actor.mjs';

const now=Date.parse('2026-11-10T14:30:00Z');
const model=(change={})=>({
 current:{time:'2026-11-10T14:15',temperature_2m:14.8,precipitation:.65,
  rain:.55,showers:.1,snowfall:0,weather_code:61,cloud_cover:92,
  wind_speed_10m:32,wind_direction_10m:90,is_day:1,...change}
});
const observation=(change={})=>({
 type:'FeatureCollection',features:[{
  geometry:{type:'Point',coordinates:[-8.803,39.745]},
  properties:{time:'2026-11-10T14:00:00',localEstacao:'Leiria (teste)',
   temperatura:13.5,intensidadeVentoKM:35,precAcumulada:.3,
   descDirVento:'E',...change}
 }]
});
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
test('V67 uses one fixed Portuguese portfolio location and anonymous public meteorological endpoints',()=>{
 assert.equal(M_WEATHER_SITE.name,'Leiria');
 assert.equal(M_WEATHER_SITE.lat,39.7444);
 assert.match(M_WEATHER_IPMA_URL,/api\.ipma\.pt\/open-data\/observation/);
 assert.match(M_WEATHER_MODEL_URL,/api\.open-meteo\.com\/v1\/forecast/);
 assert.match(M_WEATHER_MODEL_URL,/current=temperature_2m/);
 assert.doesNotMatch(M_WEATHER_MODEL_URL,/apikey|token|user|email|key=/i);
});
test('V67 normalizes rain, cloud, wind, direction and night without fabricating a live observation',()=>{
 const rain=normalizeModelWeather(model(),{now});
 assert.equal(rain.status,'ready');assert.equal(rain.condition,'rain');
 assert.equal(rain.cloud,.92);assert.equal(rain.windKmh,32);
 assert.equal(rain.windDirection,90);assert.equal(rain.precipitation,.65);
 assert.equal(rain.source,'Open-Meteo');
 const v=weatherVisual(rain);
 assert.ok(v.rain>.25);assert.ok(v.cloud>.9);assert.ok(v.wind>.5);
 assert.equal(v.umbrella,true);assert.ok(v.drift<0,'easterly winds blow to the west');
 const snow=normalizeModelWeather(model({weather_code:73,precipitation:0,rain:0,showers:0,snowfall:.7,is_day:0}),{now});
 assert.equal(snow.condition,'snow');
 assert.ok(weatherVisual(snow).snow>.2);assert.equal(weatherVisual(snow).night,true);
 const clear=normalizeModelWeather(model({weather_code:0,precipitation:0,rain:0,showers:0,cloud_cover:6}),{now});
 assert.equal(clear.condition,'clear');assert.equal(weatherVisual(clear).umbrella,false);
});
test('V67 rejects stale or malformed weather instead of showing invented rain',()=>{
 assert.equal(normalizeModelWeather(model({time:'2026-11-01T12:00'}),{now}),null);
 assert.equal(normalizeModelWeather(model({cloud_cover:-99}),{now}),null);
 assert.equal(normalizeModelWeather(model({wind_speed_10m:999}),{now}),null);
 assert.equal(normalizeModelWeather({current:{}},{now}),null);
 assert.deepEqual(weatherVisual(null),{rain:0,snow:0,cloud:0,wind:0,drift:0,umbrella:false,night:false});
});
test('V67 nearest IPMA observations must be recent, local and reject -99 missing measurements',()=>{
 const close=nearestIpmaObservation(observation(),{now});
 assert.ok(close.distanceKm<3);
 assert.equal(close.temperatureC,13.5);
 assert.equal(close.windKmh,35);
 const joined=combineWeather(normalizeModelWeather(model(),{now}),close);
 assert.equal(joined.windKmh,35);assert.equal(joined.temperatureC,13.5);
 assert.equal(joined.source,'IPMA + Open-Meteo');
 assert.equal(joined.condition,'rain');
 assert.equal(nearestIpmaObservation(observation({time:'2026-11-08T10:00:00'}),{now}),null);
 assert.equal(nearestIpmaObservation({features:[{geometry:{coordinates:[-14,48]},
  properties:{time:'2026-11-10T14:00:00',precAcumulada:3}}]},{now}),null);
 const missing=nearestIpmaObservation(observation({temperatura:-99,intensidadeVentoKM:-99,precAcumulada:-99}),{now});
 assert.equal(missing,null);
});
test('V67 weather reader caches requests, uses public sources only and fails neutral after extended outage',async()=>{
 let current=now,failed=false,calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});
  if(failed)throw new TypeError('Provider offline');
  return json(url===M_WEATHER_MODEL_URL?model():observation());
 };
 const reader=createWeatherReader({fetchImpl,now:()=>current,ttlMs:60000});
 const first=await reader.get();
 assert.equal(first.condition,'rain');assert.equal(first.source,'IPMA + Open-Meteo');
 assert.equal((await reader.get()).condition,'rain');
 assert.equal(calls.length,2);
 assert.ok(calls.every(c=>c.options.credentials==='omit'));
 failed=true;current+=2*60*60*1000;
 assert.equal(await reader.get(),null);
 assert.equal(reader.snapshot(),null);
});
test('V67 M reacts to wind, shelters under rain and respects resting/typing/reduced-motion',()=>{
 const rain=normalizeModelWeather(model(),{now});
 const normal=weatherActorPose(rain);
 assert.equal(normal.umbrella,true);assert.ok(normal.wind>0);
 assert.ok(Object.keys(normal.pose).some(k=>k.startsWith('Tail.')));
 assert.ok(normal.stageRoll!==0);
 for(const quiet of [{reading:true},{resting:true},{reducedMotion:true},{gesture:true}]){
  const still=weatherActorPose(rain,quiet);
  assert.equal(still.umbrella,false);assert.equal(still.stageRoll,0);
  assert.deepEqual(still.pose,{});
 }
 assert.equal(weatherActorPose(null).umbrella,false);
});
test('V67 weather canvas is non-interactive, reduced-motion-safe, and avoids a new server/API secret',()=>{
 const sky=readFileSync(new URL('m-world-weather-stage.mjs',import.meta.url),'utf8');
 const actor=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 const controller=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.match(sky,/pointer-events:none/);
 assert.match(sky,/prefers-reduced-motion:reduce/);
 assert.match(sky,/doc\.hidden/);
 assert.match(sky,/cancelAnimationFrame/);
 assert.match(actor,/umbrella\.visible/);
 assert.match(actor,/weatherActorPose/);
 assert.match(controller,/createWeatherReader/);
 assert.match(controller,/weather:currentWeather/);
 assert.match(controller,/clearInterval\(weatherTimer\);sky\.destroy\(\)/);
 assert.doesNotMatch(controller,/navigator\.geolocation|watchPosition/);
});

test('V67 debug-only weather demonstration is distinctly labelled and never mistaken for live meteorology',()=>{
 const demo=makeWeatherDemo('rain');
 assert.equal(demo.condition,'rain');
 assert.equal(weatherVisual(demo).umbrella,true);
 assert.match(demo.source,/DEMO/);
 assert.match(demo.source,/não é tempo real/);
 assert.equal(makeWeatherDemo('hailstorm'),null);
 const script=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.match(script,/const weatherDemo=debugEnabled\?makeWeatherDemo/);
 assert.match(script,/else if\(!debugEnabled\)void refreshWeather\(\)/);
});
