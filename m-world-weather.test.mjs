import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {M_WEATHER_SITE,M_WEATHER_MET_URL,M_WEATHER_REFRESH_MS,
 normalizeMetForecast,weatherVisual,createWeatherReader,makeWeatherDemo} from './m-world-weather.mjs';
import {weatherActorPose} from './m-world-weather-actor.mjs';
const now=Date.parse('2026-11-10T14:30:00Z');
const model=(change={},nextChange={},precipitation=.75)=>({properties:{timeseries:[{
 time:'2026-11-10T14:00:00Z',
 data:{instant:{details:{air_temperature:14.8,cloud_area_fraction:92,wind_speed:9,
   wind_from_direction:90,...change}},
 next_1_hours:{summary:{symbol_code:'rain',...nextChange},
  details:{precipitation_amount:precipitation}}
 }}]}});
const json=value=>new Response(JSON.stringify(value),{status:200,headers:{'content-type':'application/json'}});
test('V67 public forecast is fixed to Leiria and uses a commercially reusable meteorological institute',()=>{
 assert.deepEqual(M_WEATHER_SITE,{name:'Leiria',lat:39.74,lon:-8.81});
 assert.match(M_WEATHER_MET_URL,/api\.met\.no\/weatherapi\/locationforecast\/2\.0\/compact/);
 assert.doesNotMatch(M_WEATHER_MET_URL,/token|apikey|user|email|key=/i);
 assert.equal(M_WEATHER_REFRESH_MS,3*60*60*1000,'non-Nordic provider must not be polled too frequently');
});
test('V67 rain, wind and clouds use a labelled model forecast, never a claim of local observations',()=>{
 const rain=normalizeMetForecast(model(),{now});
 assert.equal(rain.status,'ready');
 assert.equal(rain.condition,'rain');assert.equal(rain.source,'MET Norway');
 assert.equal(rain.estimate,true);assert.equal(rain.nearbyObservation,false);
 assert.equal(rain.temperatureC,14.8);assert.equal(rain.cloud,.92);
 assert.equal(rain.windKmh,32.4);assert.equal(rain.windDirection,90);
 const v=weatherVisual(rain);
 assert.ok(v.rain>.25);assert.ok(v.cloud>.9);assert.ok(v.wind>.5);
 assert.equal(v.umbrella,true);assert.ok(v.drift<0,'easterly winds blow to the west');
});
test('V67 snowy, clear, night and cloudy forecasts choose the correct gentle effects',()=>{
 const snow=normalizeMetForecast(model({cloud_area_fraction:88},{symbol_code:'snow'}),{now});
 assert.equal(snow.condition,'snow');
 assert.ok(weatherVisual(snow).snow>.2);
 const clear=normalizeMetForecast(model({cloud_area_fraction:4},{symbol_code:'clearsky_night'},0),{now});
 assert.equal(clear.condition,'clear');assert.equal(weatherVisual(clear).night,true);
 assert.equal(weatherVisual(clear).umbrella,false);
 const clouds=normalizeMetForecast(model({cloud_area_fraction:80},{symbol_code:'cloudy'},0),{now});
 assert.equal(clouds.condition,'cloudy');
 assert.equal(weatherVisual(clouds).umbrella,false);
});
test('V67 rejects out-of-date or untrustworthy provider responses',()=>{
 const old=model();old.properties.timeseries[0].time='2026-11-01T12:00:00Z';
 assert.equal(normalizeMetForecast(old,{now}),null);
 assert.equal(normalizeMetForecast(model({air_temperature:-99}),{now}),null);
 assert.equal(normalizeMetForecast(model({wind_speed:999}),{now}),null);
 assert.equal(normalizeMetForecast({properties:{timeseries:[]}},{now}),null);
 assert.deepEqual(weatherVisual(null),{rain:0,snow:0,cloud:0,wind:0,drift:0,umbrella:false,night:false});
});
test('V67 request is anonymous, cache-aware, bounded and never more often than three hours',async()=>{
 let current=now,offline=false,calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url,options});
  if(offline)throw new TypeError('Provider offline');
  return json(model());
 };
 const reader=createWeatherReader({fetchImpl,now:()=>current});
 const initial=await reader.get();assert.equal(initial.condition,'rain');
 assert.equal((await reader.get()).condition,'rain');
 assert.equal(calls.length,1);
 assert.equal(calls[0].url,M_WEATHER_MET_URL);
 assert.equal(calls[0].options.credentials,'omit');
 assert.equal(calls[0].options.cache,'default');
 offline=true;current+=3*3600000+1000;
 assert.ok(await reader.get(),'temporary outage retains only a bounded already-verified forecast');
 current+=5*3600000;
 assert.equal(await reader.get(),null,'stale weather should disappear instead of pretending to rain');
 assert.equal(reader.snapshot(),null);
});
test('V67 M bends gently in wind, shelters in rain, but respects reading and resting',()=>{
 const rain=normalizeMetForecast(model(),{now});
 const affected=weatherActorPose(rain);
 assert.equal(affected.umbrella,true);assert.ok(affected.wind>0);
 assert.ok(Object.keys(affected.pose).some(x=>x.startsWith('Tail.')));
 assert.ok(affected.stageRoll!==0);
 for(const quiet of [{reading:true},{resting:true},{reducedMotion:true},{gesture:true}]){
  const still=weatherActorPose(rain,quiet);
  // An umbrella remains present while M moves or observes in the rain.
  assert.equal(still.umbrella,!Boolean(quiet.reducedMotion));assert.equal(still.stageRoll,0);
  assert.deepEqual(still.pose,{});
 }
 assert.equal(weatherActorPose(rain,{sleeping:true}).umbrella,false);
 assert.equal(weatherActorPose(null).umbrella,false);
});
test('V67 weather layers do not intercept navigation and provide CC BY 4.0 links',()=>{
 const sky=readFileSync(new URL('m-world-weather-stage.mjs',import.meta.url),'utf8');
 const actor=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 const controller=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.match(sky,/m-weather-sky\{position:fixed;inset:0;z-index:3;pointer-events:none/);
 assert.match(sky,/prefers-reduced-motion:reduce/);assert.match(sky,/doc\.hidden/);
 assert.match(sky,/cancelAnimationFrame/);
 assert.match(sky,/https:\/\/api\.met\.no\//);
 assert.match(sky,/https:\/\/creativecommons\.org\/licenses\/by\/4\.0\//);
 assert.match(actor,/umbrella\.visible/);assert.match(actor,/weatherActorPose/);
 assert.match(controller,/createWeatherReader/);assert.match(controller,/weather:currentWeather/);
 assert.match(controller,/clearInterval\(weatherTimer\);sky\.destroy\(\)/);
 assert.doesNotMatch(controller,/navigator\.geolocation|watchPosition/);
});
test('V67 explicitly debug-only demo is labelled and does not misrepresent live weather',()=>{
 const demo=makeWeatherDemo('rain');
 assert.equal(demo.condition,'rain');assert.equal(weatherVisual(demo).umbrella,true);
 assert.match(demo.source,/DEMO/);assert.match(demo.source,/não é tempo real/);
 assert.equal(makeWeatherDemo('hailstorm'),null);
 const script=readFileSync(new URL('scroll-buddy.js',import.meta.url),'utf8');
 assert.match(script,/const weatherDemo=debugEnabled\?makeWeatherDemo/);
 assert.match(script,/else if\(!debugEnabled\)void refreshWeather\(\)/);
});

test('V68 umbrella is proportionate, raised and tied to the original left paw without modifying M skeleton',()=>{
 const renderer=readFileSync(new URL('m-world-3d.mjs',import.meta.url),'utf8');
 assert.match(renderer,/umbrellaRadius=characterHeight\*\.30/);
 assert.match(renderer,/umbrellaHand=bones\.get\('Hand\.L'\)/);
 assert.match(renderer,/umbrellaHead=bones\.get\('Head'\)/);
 assert.match(renderer,/umbrellaHand\.getWorldPosition\(handWorld\)/);
 assert.match(renderer,/container\.worldToLocal\(handLocal\)/);
 assert.match(renderer,/umbrella\.position\.lerp\(handLocal,1-Math\.exp\(-12\*dt\)\)/);
 assert.match(renderer,/headLocal\.y-umbrella\.position\.y\+characterHeight\*\.16/);
 assert.match(renderer,/umbrellaCrown\.position\.set\(canopyOffsetX,crownY,canopyOffsetZ\)/);
 assert.match(renderer,/stem\.scale\.y=stemDirection\.length\(\)/);
 assert.match(renderer,/umbrellaRoll=-\.18\+weatherMotion\.umbrellaTilt/);
 assert.match(renderer,/radiusRatio:umbrellaRadius\/characterHeight/);
 assert.match(renderer,/crownClearanceRatio:umbrellaCrownClearance\/characterHeight/);
 assert.doesNotMatch(renderer,/\.add\(umbrella\).*bones|bones\.set\('Umbrella'/);
});
