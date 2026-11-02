export const LOCATIONS = {
  minalur: { id: "minalur", name: "Minalur", subtitle: "Wadakkanchery, Thrissur", lat: 10.6250, lon: 76.2167, elevation: 25 },
  peruvanmala: { id: "peruvanmala", name: "Peruvanmala", subtitle: "Thalakkottukara, Kechery", lat: 10.6219, lon: 76.1352, elevation: 100 }
};

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const IST = "Asia/Kolkata";

function dayOfYear(dateString) {
  const [y,m,d] = dateString.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000);
}

function solarTerms(dateString) {
  const n = dayOfYear(dateString);
  const g = 2 * Math.PI / 365 * (n - 1);
  const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2*g) - 0.040849 * Math.sin(2*g));
  const dec = 0.006918 - 0.399912*Math.cos(g) + 0.070257*Math.sin(g) - 0.006758*Math.cos(2*g) + 0.000907*Math.sin(2*g) - 0.002697*Math.cos(3*g) + 0.00148*Math.sin(3*g);
  return { eq, dec };
}

export function solarEvent(dateString, lat, lon, altitude = -0.833, evening = false) {
  const { eq, dec } = solarTerms(dateString);
  const phi = lat * RAD;
  const h = altitude * RAD;
  const cosH = (Math.sin(h) - Math.sin(phi)*Math.sin(dec)) / (Math.cos(phi)*Math.cos(dec));
  if (cosH < -1 || cosH > 1) return null;
  const hourAngle = Math.acos(cosH) * DEG;
  const utcMinutes = 720 - 4 * (lon + (evening ? -hourAngle : hourAngle)) - eq;
  const [y,m,d] = dateString.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + utcMinutes * 60000);
}

export function fmtTime(date) {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "2-digit", minute: "2-digit", hour12: true }).format(date);
}

export function fmtDate(dateString) {
  const [y,m,d] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { timeZone: IST, weekday: "short", day: "numeric", month: "short" }).format(new Date(Date.UTC(y,m-1,d,12)));
}

export function localDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: IST, year:"numeric", month:"2-digit", day:"2-digit" }).formatToParts(date);
  const p = Object.fromEntries(parts.map(x => [x.type,x.value]));
  return p.year + "-" + p.month + "-" + p.day;
}

export function fromLocalISO(s) {
  const [date, time = "00:00"] = s.split("T");
  const [y,m,d] = date.split("-").map(Number);
  const [h,min] = time.split(":").map(Number);
  return new Date(Date.UTC(y,m-1,d,h,min) - 330*60000);
}

function julianDay(date) { return date.getTime() / 86400000 + 2440587.5; }

function moonEquatorial(date) {
  const jd = julianDay(date);
  const d = jd - 2451545.0;
  const L = (218.316 + 13.176396*d) % 360;
  const M = (134.963 + 13.064993*d) * RAD;
  const F = (93.272 + 13.229350*d) * RAD;
  const D = (297.850 + 12.190749*d) * RAD;
  const lon = (L + 6.289*Math.sin(M) + 1.274*Math.sin(2*D-M) + 0.658*Math.sin(2*D) + 0.214*Math.sin(2*M) - 0.186*Math.sin(0.5*RAD*d)) * RAD;
  const lat = (5.128*Math.sin(F) + 0.280*Math.sin(M+F) + 0.277*Math.sin(M-F) + 0.173*Math.sin(2*D-F)) * RAD;
  const eps = (23.439 - 0.0000004*d) * RAD;
  const ra = Math.atan2(Math.sin(lon)*Math.cos(eps) - Math.tan(lat)*Math.sin(eps), Math.cos(lon));
  const dec = Math.asin(Math.sin(lat)*Math.cos(eps) + Math.cos(lat)*Math.sin(eps)*Math.sin(lon));
  return { ra, dec };
}

export function moonIllumination(date = new Date()) {
  const phase = ((julianDay(date) - 2451550.1) / 29.530588853 % 1 + 1) % 1;
  return Math.round((1 - Math.cos(2*Math.PI*phase)) * 50);
}

export function moonAltitude(date, lat, lon) {
  const { ra, dec } = moonEquatorial(date);
  const jd = julianDay(date);
  const t = (jd - 2451545.0) / 36525;
  let gmst = 280.46061837 + 360.98564736629*(jd-2451545) + 0.000387933*t*t - t*t*t/38710000;
  gmst = ((gmst % 360) + 360) % 360;
  let ha = (gmst + lon)*RAD - ra;
  while (ha > Math.PI) ha -= 2*Math.PI;
  while (ha < -Math.PI) ha += 2*Math.PI;
  const phi = lat*RAD;
  return Math.asin(Math.sin(phi)*Math.sin(dec) + Math.cos(phi)*Math.cos(dec)*Math.cos(ha))*DEG;
}

function clamp(n, lo=0, hi=100) { return Math.max(lo, Math.min(hi, n)); }
function idealBand(v, low, high) {
  if (v == null) return null;
  if (v >= low && v <= high) return 100;
  const dist = v < low ? low-v : v-high;
  return clamp(100 - dist*2.2);
}
function atOrNearest(hourly, key, targetDate) {
  const arr = hourly[key];
  if (!arr || !arr.length) return null;
  const target = targetDate.getTime();
  let best = -1, delta = Infinity;
  for (let i=0;i<hourly.time.length;i++) {
    const dt = Math.abs(fromLocalISO(hourly.time[i]).getTime()-target);
    if (dt < delta) { delta=dt; best=i; }
  }
  return best >= 0 ? arr[best] : null;
}
function cloudSnapshot(hourly, date) {
  return {
    total: atOrNearest(hourly,"cloud_cover",date),
    low: atOrNearest(hourly,"cloud_cover_low",date),
    mid: atOrNearest(hourly,"cloud_cover_mid",date),
    high: atOrNearest(hourly,"cloud_cover_high",date),
    visibility: atOrNearest(hourly,"visibility",date),
    humidity: atOrNearest(hourly,"relative_humidity_2m",date),
    wind: atOrNearest(hourly,"wind_speed_10m",date),
    precip: atOrNearest(hourly,"precipitation_probability",date)
  };
}
function confidenceFrom(dataPresent, leadDays, proxyPenalty=0) {
  const base = dataPresent >= 6 ? 78 : dataPresent >= 4 ? 62 : 42;
  return clamp(Math.round(base - leadDays*8 - proxyPenalty), 15, 85);
}
function colorScore(s) {
  const high = idealBand(s.high, 12, 65);
  const mid = idealBand(s.mid, 5, 45);
  const low = s.low == null ? null : clamp(100-s.low*1.35);
  const visibility = s.visibility == null ? null : clamp((s.visibility-3000)/170);
  const rain = s.precip == null ? null : clamp(100-s.precip*1.8);
  const parts = [[high,0.29],[mid,0.14],[low,0.25],[visibility,0.17],[rain,0.15]].filter(x=>x[0]!=null);
  return Math.round(parts.reduce((a,x)=>a+x[0]*x[1],0) / parts.reduce((a,x)=>a+x[1],0));
}
function visibilityScore(s) {
  const total = s.total == null ? 50 : clamp(100-s.total*0.8);
  const low = s.low == null ? 50 : clamp(100-s.low*1.1);
  return Math.round(total*0.45+low*0.55);
}
function scoreLabel(score) {
  return score >= 75 ? "Strong potential" : score >= 55 ? "Worth watching" : score >= 35 ? "Limited potential" : "Low potential";
}
function nearestForecastDate(hourly, target) {
  const snap = cloudSnapshot(hourly,target);
  const available = Object.values(snap).filter(v=>v!=null).length;
  return { snap, available };
}
function addMinutes(d, mins) { return new Date(d.getTime()+mins*60000); }

export function buildForecast(locationId, weather, now = new Date()) {
  const loc = LOCATIONS[locationId] || LOCATIONS.minalur;
  const daily = weather.daily;
  const hourly = weather.hourly;
  const today = localDateString(now);
  const days = [];
  for (let i=0;i<daily.time.length;i++) {
    const date = daily.time[i];
    const sunrise = solarEvent(date,loc.lat,loc.lon,-0.833,false);
    const sunset = solarEvent(date,loc.lat,loc.lon,-0.833,true);
    const sunriseSnap = nearestForecastDate(hourly, addMinutes(sunrise || now,-15));
    const sunsetSnap = nearestForecastDate(hourly, addMinutes(sunset || now,-15));
    const morningCloud = sunriseSnap.snap;
    const eveningCloud = sunsetSnap.snap;
    const leadDays = Math.max(0,Math.round((fromLocalISO(date+"T12:00").getTime()-now.getTime())/86400000));
    const dawn = {
      visibility: visibilityScore(morningCloud),
      colour: colorScore(morningCloud),
      afterglow: null,
      confidence: confidenceFrom(sunriseSnap.available,leadDays)
    };
    const dusk = {
      visibility: visibilityScore(eveningCloud),
      colour: colorScore(eveningCloud),
      afterglow: Math.round((idealBand(eveningCloud.high,18,68) ?? 45)*0.55 + (eveningCloud.low==null?45:clamp(100-eveningCloud.low*1.25))*0.30 + (eveningCloud.precip==null?50:clamp(100-eveningCloud.precip*2))*0.15),
      confidence: confidenceFrom(sunsetSnap.available,leadDays)
    };
    days.push({
      date, label: fmtDate(date), sunrise, sunset, dawn, dusk,
      conditions: { morning:morningCloud, evening:eveningCloud },
      isToday: date === today
    });
  }

  const twilight = days.slice(0,3).map(day => {
    const d=day.date;
    const event = (alt, eve) => solarEvent(d,loc.lat,loc.lon,alt,eve);
    return {
      date:d,label:day.label,
      morning:{ astro:event(-18,false), nautical:event(-12,false), civil:event(-6,false), blueStart:event(-6,false), blueEnd:event(-4,false), sunrise:event(-0.833,false), goldenEnd:event(6,false) },
      evening:{ goldenStart:event(6,true), sunset:event(-0.833,true), blueStart:event(-4,true), blueEnd:event(-6,true), civilEnd:event(-6,true), nauticalEnd:event(-12,true), astroEnd:event(-18,true) },
      eveningCloud:day.conditions.evening
    };
  });

  const tonight = now;
  let bestMoon = null;
  const start = fromLocalISO(today+"T18:00");
  for (let mins=0;mins<=600;mins+=20) {
    const t=addMinutes(start,mins);
    const alt=moonAltitude(t,loc.lat,loc.lon);
    if (alt < 8) continue;
    const s=nearestForecastDate(hourly,t).snap;
    const illum=moonIllumination(t);
    const cirrus=idealBand(s.high,12,68);
    const obstruction=s.low==null?50:clamp(100-s.low*1.3);
    const moonFactor=clamp((alt-5)*3.2);
    const lightFactor=clamp((illum-5)*1.4);
    const cloudFactor=cirrus==null?45:cirrus;
    const score=Math.round(clamp(cloudFactor*0.43+obstruction*0.25+moonFactor*0.20+lightFactor*0.12));
    const candidate={time:t,altitude:Math.round(alt),illumination:illum,score,clouds:s};
    if (!bestMoon || candidate.score>bestMoon.score) bestMoon=candidate;
  }
  const haloConfidence=bestMoon ? confidenceFrom(Object.values(bestMoon.clouds).filter(v=>v!=null).length,0,28) : 25;
  const halo = {
    score:bestMoon?.score ?? 0,
    label:scoreLabel(bestMoon?.score ?? 0),
    bestTime:bestMoon?.time ?? null,
    moonAltitude:bestMoon?.altitude ?? null,
    illumination:bestMoon?.illumination ?? moonIllumination(now),
    clouds:bestMoon?.clouds ?? null,
    confidence:haloConfidence,
    caveat:"High-cloud cover is only a cirrus proxy. Open-Meteo does not provide local ice-crystal phase or cloud optical thickness here; this is a watch-for-conditions estimate, not a halo detection."
  };

  return {
    location:loc,
    generatedAt:new Date().toISOString(),
    timezone:"Asia/Kolkata",
    provider:"Open-Meteo",
    providerAttribution:"Weather data by Open-Meteo",
    days,
    twilight,
    halo,
    methodology:{
      solar:"Solar event times use a compact NOAA-style equation-of-time and declination calculation. Civil, nautical and astronomical twilight use sun-centre altitude thresholds of -6°, -12° and -18°.",
      blueHour:"Skywatch operational definition: sun altitude between -6° and -4°. Actual photographic blue hour varies with atmosphere, horizon and camera exposure.",
      colour:"Heuristic score using forecast high/mid cloud, low-cloud obstruction, visibility and precipitation probability. It is not a radiative-transfer or horizon-resolved model.",
      halo:"Heuristic score combining moon elevation and illumination with forecast high-cloud cover and lower-cloud obstruction. Cloud ice phase and optical thickness are not observed."
    }
  };
}