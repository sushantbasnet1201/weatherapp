const DEFAULT_LOCATION = 'Derby,GB';
const state = {
  unit: localStorage.getItem('weatherUnit') || 'metric',
  location: JSON.parse(localStorage.getItem('weatherLocation') || 'null'),
  lastCurrent: null,
  lastForecast: null,
  demo: false,
};

const $ = (id) => document.getElementById(id);
const els = {
  form:$('searchForm'), input:$('cityInput'), suggestions:$('suggestions'), refresh:$('refreshBtn'),
  cBtn:$('cBtn'), fBtn:$('fBtn'), toast:$('toast')
};

const weatherEmoji = (main, icon='') => {
  const night = icon.endsWith('n');
  const map = {Clear: night?'🌙':'☀️', Clouds:'☁️', Rain:'🌧️', Drizzle:'🌦️', Thunderstorm:'⛈️', Snow:'❄️', Mist:'🌫️', Fog:'🌫️', Haze:'🌫️', Smoke:'🌫️'};
  return map[main] || '🌤️';
};
const speedUnit = () => state.unit === 'metric' ? 'm/s' : 'mph';
const tempUnit = () => state.unit === 'metric' ? '°' : '°';
const capitalize = s => s ? s[0].toUpperCase()+s.slice(1) : '';
const fmtTime = (unix, tz=0) => new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',hour12:false,timeZone:'UTC'}).format(new Date((unix+tz)*1000));
const windDirection = deg => ['N','NE','E','SE','S','SW','W','NW'][Math.round((deg||0)/45)%8];
const visibilityLabel = m => m >= 10000 ? 'Excellent visibility' : m >= 6000 ? 'Good visibility' : m >= 3000 ? 'Moderate visibility' : 'Low visibility';
const comfortLabel = h => h < 30 ? 'Dry air' : h <= 60 ? 'Comfortable' : h <= 75 ? 'Humid' : 'Very humid';

function showToast(message){ els.toast.textContent=message; els.toast.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>els.toast.classList.remove('show'),2600); }
function setLoading(on=true){ document.body.classList.toggle('loading',on); if(on){ ['temperature','condition','description','windValue','humidityValue','pressureValue','visibilityValue'].forEach(id=>$(id).classList.add('skeleton')); } else document.querySelectorAll('.skeleton').forEach(x=>x.classList.remove('skeleton')); }

async function apiJSON(url){
  const r = await fetch(url);
  let body = {};
  try { body = await r.json(); } catch {}
  if (!r.ok) throw new Error(body.error || 'Weather service is unavailable right now.');
  return body;
}
async function geocode(query){
  return apiJSON(`/api/geocode?q=${encodeURIComponent(query)}`);
}
async function fetchWeather(lat,lon){
  const data = await apiJSON(`/api/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&units=${encodeURIComponent(state.unit)}`);
  return [data.current, data.forecast];
}

async function loadByQuery(query=DEFAULT_LOCATION){
  setLoading(true);
  try{
    const places=await geocode(query);
    if(!places.length) throw new Error(`No location found for “${query}”.`);
    const p=places[0]; state.location={lat:p.lat,lon:p.lon,name:p.name,state:p.state||'',country:p.country};
    localStorage.setItem('weatherLocation',JSON.stringify(state.location));
    await loadCoords(p.lat,p.lon,state.location);
  }catch(e){ showToast(e.message); setLoading(false); }
}
async function loadCoords(lat,lon,location=state.location){
  setLoading(true);
  try{
    const [current,forecast]=await fetchWeather(lat,lon); state.lastCurrent=current; state.lastForecast=forecast; state.demo=false;
    render(current,forecast,location); setLoading(false);
  }catch(e){ showToast(e.message); setLoading(false); if(!state.lastCurrent) loadDemo(); }
}

function render(current,forecast,location){
  const w=current.weather[0], night=w.icon.endsWith('n'), main=(w.main||'Clouds').toLowerCase();
  document.body.dataset.weather=main; document.body.dataset.night=night?'true':'false';
  $('cityName').textContent=location?.name||current.name||'Derby';
  $('locationMeta').textContent=[location?.state,location?.country||current.sys.country].filter(Boolean).join(', ');
  $('temperature').textContent=`${Math.round(current.main.temp)}${tempUnit()}`;
  $('feelsLike').textContent=`Feels like ${Math.round(current.main.feels_like)}${tempUnit()}`;
  $('condition').textContent=w.main; $('description').textContent=w.description;
  $('windValue').textContent=`${current.wind.speed.toFixed(1)} ${speedUnit()}`; $('windDir').textContent=`${windDirection(current.wind.deg)} • ${current.wind.deg||0}°`; if($('heroWind')) $('heroWind').textContent=`${current.wind.speed.toFixed(1)} ${speedUnit()}`;
  $('humidityValue').textContent=`${current.main.humidity}%`; $('dewText').textContent=comfortLabel(current.main.humidity); if($('heroHumidity')) $('heroHumidity').textContent=`${current.main.humidity}%`;
  $('pressureValue').textContent=`${current.main.pressure} hPa`; $('visibilityValue').textContent=`${((current.visibility||0)/1000).toFixed(1)} km`; $('visibilityText').textContent=visibilityLabel(current.visibility||0);
  $('sunrise').textContent=fmtTime(current.sys.sunrise,current.timezone); $('sunset').textContent=fmtTime(current.sys.sunset,current.timezone); $('cloudsValue').textContent=`${current.clouds.all}%`; $('gustValue').textContent=current.wind.gust?`${current.wind.gust.toFixed(1)} ${speedUnit()}`:'—';
  $('dateText').textContent=new Intl.DateTimeFormat('en-GB',{weekday:'long',day:'numeric',month:'long'}).format(new Date());
  $('updatedText').textContent=state.demo?'Demo preview':'Updated just now';
  renderHourly(forecast,current.timezone); renderDaily(forecast,current.timezone); renderTip(current,w); updateOrb(w.main,night);
}

function renderHourly(forecast,tz){
  $('hourlyTrack').innerHTML=forecast.list.slice(0,8).map((item,i)=>`<div class="hour-card"><span>${i===0?'Now':fmtTime(item.dt,tz)}</span><div class="weather-emoji">${weatherEmoji(item.weather[0].main,item.weather[0].icon)}</div><strong>${Math.round(item.main.temp)}°</strong><span>${Math.round((item.pop||0)*100)}% rain</span></div>`).join('');
}
function renderDaily(forecast,tz){
  const buckets={}; forecast.list.forEach(x=>{const key=new Date((x.dt+tz)*1000).toISOString().slice(0,10); (buckets[key]??=[]).push(x)});
  const days=Object.values(buckets).slice(0,5).map(items=>{
    const mid=items.reduce((a,b)=>Math.abs(new Date((a.dt+tz)*1000).getUTCHours()-12)<Math.abs(new Date((b.dt+tz)*1000).getUTCHours()-12)?a:b);
    return {dt:mid.dt,w:mid.weather[0],min:Math.min(...items.map(x=>x.main.temp_min)),max:Math.max(...items.map(x=>x.main.temp_max))};
  });
  $('forecastList').innerHTML=days.map((d,i)=>{const date=new Date((d.dt+tz)*1000);const day=i===0?'Today':new Intl.DateTimeFormat('en-GB',{weekday:'long',timeZone:'UTC'}).format(date);const dateText=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',timeZone:'UTC'}).format(date);return `<div class="forecast-row"><div class="forecast-day"><strong>${day}</strong><span>${dateText}</span></div><div class="forecast-condition"><span class="weather-emoji">${weatherEmoji(d.w.main,d.w.icon)}</span><span>${capitalize(d.w.description)}</span></div><div class="forecast-temp"><span>${Math.round(d.max)}°</span><span>${Math.round(d.min)}°</span></div></div>`}).join('');
}
function renderTip(current,w){
  let title='A balanced day',text='Conditions look fairly comfortable. Check the hourly cards before heading out.';
  if(['Rain','Drizzle','Thunderstorm'].includes(w.main)){title='Rain likely';text='Keep an umbrella or waterproof layer nearby, especially during the wetter forecast periods.'}
  else if(current.main.temp>=28){title='Warm conditions';text='It is on the warmer side. Hydrate well and limit long exposure during the hottest period.'}
  else if(current.main.temp<=5){title='Cold outside';text='A warm outer layer is a good idea, especially if wind picks up.'}
  else if(w.main==='Clear'){title='Clear skies';text='Visibility and sky conditions look favorable for outdoor plans.'}
  $('weatherTip').textContent=title; $('weatherTipText').textContent=text;
}
function updateOrb(main,night){ const orb=$('weatherOrb'); orb.className='weather-orb '+main.toLowerCase()+(night?' night':''); }

let suggestTimer;
els.input.addEventListener('input',()=>{ clearTimeout(suggestTimer); const q=els.input.value.trim(); if(q.length<2){els.suggestions.classList.remove('show');return;} suggestTimer=setTimeout(async()=>{try{const results=await geocode(q); els.suggestions.innerHTML=results.map((r,i)=>`<div class="suggestion" data-i="${i}"><span>${r.name}${r.state?`, ${r.state}`:''}</span><small>${r.country}</small></div>`).join(''); els.suggestions.classList.toggle('show',!!results.length); els.suggestions._results=results;}catch{}},350);});
els.suggestions.addEventListener('click',e=>{const row=e.target.closest('.suggestion'); if(!row)return; const r=els.suggestions._results[+row.dataset.i]; els.input.value=''; els.suggestions.classList.remove('show'); state.location={lat:r.lat,lon:r.lon,name:r.name,state:r.state||'',country:r.country};localStorage.setItem('weatherLocation',JSON.stringify(state.location));loadCoords(r.lat,r.lon,state.location);});
els.form.addEventListener('submit',e=>{e.preventDefault();const q=els.input.value.trim();if(q){els.suggestions.classList.remove('show');loadByQuery(q);els.input.blur();}});
els.refresh.addEventListener('click',()=>state.location?loadCoords(state.location.lat,state.location.lon,state.location):loadByQuery());
[els.cBtn,els.fBtn].forEach(btn=>btn.addEventListener('click',()=>{const unit=btn.dataset.unit;if(unit===state.unit)return;state.unit=unit;localStorage.setItem('weatherUnit',unit);updateUnitButtons();state.location?loadCoords(state.location.lat,state.location.lon,state.location):loadByQuery();}));
function updateUnitButtons(){els.cBtn.classList.toggle('active',state.unit==='metric');els.fBtn.classList.toggle('active',state.unit==='imperial');}
document.addEventListener('click',e=>{if(!els.form.contains(e.target))els.suggestions.classList.remove('show');});

function loadDemo(){
  state.demo=true;
  const current={name:'Derby',timezone:3600,weather:[{main:'Clouds',description:'broken clouds',icon:'04d'}],main:{temp:15.2,feels_like:14.4,humidity:73,pressure:1014},wind:{speed:4.1,deg:242,gust:7.2},visibility:10000,clouds:{all:68},sys:{country:'GB',sunrise:1790658157,sunset:1790700871}};
  const base=Math.floor(Date.now()/1000); const types=[['Clouds','broken clouds','04d'],['Clouds','scattered clouds','03d'],['Clear','clear sky','01d'],['Clouds','few clouds','02d'],['Rain','light rain','10d'],['Clouds','overcast clouds','04d'],['Clouds','broken clouds','04n'],['Clear','clear sky','01n']];
  const list=Array.from({length:40},(_,i)=>{const t=types[i%types.length];return{dt:base+i*10800,main:{temp:15+Math.sin(i/3)*3,temp_min:12+Math.sin(i/3)*2,temp_max:17+Math.sin(i/3)*3},weather:[{main:t[0],description:t[1],icon:t[2]}],pop:i%5===4?.55:.12};});
  render(current,{list}, {name:'Derby',state:'England',country:'GB'});setLoading(false);
}

updateUnitButtons();
if(state.location) loadCoords(state.location.lat,state.location.lon,state.location);
else loadByQuery(DEFAULT_LOCATION);

// Keyboard shortcut for fast city search.
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();els.input.focus();els.input.select();}});
