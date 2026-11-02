const {useState,useEffect} = React;
const html = htm.bind(React.createElement);
const API = window.__HATCHABLE__?.api || "/api";

function fmtTime(d){
  if(!d)return "—";
  return new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date(d));
}
function fmtDateTime(d){
  if(!d)return "";
  return new Intl.DateTimeFormat("en-IN",{timeZone:"Asia/Kolkata",weekday:"short",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(d));
}
function scoreWord(n){return n>=75?"Strong potential":n>=55?"Worth watching":n>=35?"Limited potential":"Low potential"}
function cap(v){return v==null?"Not available":Math.round(v)+"%"}
function labelFor(k){return ({sunrise_sunset:"Sunrise / sunset",twilight:"Twilight / blue hour",lunar_halo:"Lunar halo"})[k]||k}
function cloudReasons(c){
  if(!c)return ["Cloud-layer data is unavailable for this time."];
  const out=[];
  if(c.high!=null)out.push("High cloud: "+Math.round(c.high)+"% — "+(c.high>=12&&c.high<=68?"some high-level texture may catch sunlight":"high-cloud cover is outside the model's preferred band"));
  if(c.low!=null)out.push("Low cloud: "+Math.round(c.low)+"% — "+(c.low<25?"relatively little low-level obstruction":"low cloud may hide the horizon or Moon"));
  if(c.visibility!=null)out.push("Visibility: "+(c.visibility/1000).toFixed(1)+" km");
  if(c.precip!=null)out.push("Precipitation probability: "+Math.round(c.precip)+"%");
  if(!out.length)out.push("The provider returned incomplete cloud data.");
  return out;
}
function Metric({label,value,sub}){return html`<div className="metric"><span>${label}</span><strong>${value}</strong><small>${sub||""}</small></div>`;}
function ReasonList({items}){return html`<div className="reason-list">${items.map((x,i)=>html`<div className="reason" key=${i}><i className="reason-dot"></i><span>${x}</span></div>`)}</div>`;}

function App(){
  const [location,setLocation]=useState("minalur");
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [selectedDate,setSelectedDate]=useState("");
  const [active,setActive]=useState("sun");
  const [appearance,setAppearance]=useState("adaptive");
  const [profile,setProfile]=useState("aurora");
  const [observations,setObservations]=useState([]);
  const [phenomenon,setPhenomenon]=useState("sunrise_sunset");
  const [rating,setRating]=useState(4);
  const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");
  const [locations,setLocations]=useState([]);
  const [locationsLoaded,setLocationsLoaded]=useState(false);
  const [showLocations,setShowLocations]=useState(false);
  const [editingLocation,setEditingLocation]=useState(null);
  const [locationBusy,setLocationBusy]=useState(false);
  const [locationMessage,setLocationMessage]=useState("");
  const emptyLocation={name:"",subtitle:"",latitude:"",longitude:"",elevation_m:"0",timezone:"Asia/Kolkata",is_favourite:false,is_primary:false,observation_notes:"",coordinates_verified:false};
  const [locationForm,setLocationForm]=useState(emptyLocation);

  async function loadLocations(includeArchived=true){
    try{
      const r=await fetch(API+"/locations"+(includeArchived?"?archived=true":""));
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Could not load locations");
      setLocations(j.locations||[]);
      const primary=(j.locations||[]).find(x=>x.is_primary&&!x.is_archived);
      if(!locationsLoaded&&primary){setLocation(primary.id);setLocationsLoaded(true);}
    }catch(e){setLocationMessage(e.message||"Could not load saved locations.");}
  }
  function startNewLocation(){
    setEditingLocation(null);
    setLocationForm({...emptyLocation});
    setLocationMessage("");
    setShowLocations(true);
  }
  function startEditLocation(loc){
    setEditingLocation(loc.id);
    setLocationForm({name:loc.name,subtitle:loc.subtitle||"",latitude:String(loc.latitude),longitude:String(loc.longitude),elevation_m:String(loc.elevation_m??0),timezone:loc.timezone||"Asia/Kolkata",is_favourite:Boolean(loc.is_favourite),is_primary:Boolean(loc.is_primary),observation_notes:loc.observation_notes||"",coordinates_verified:Boolean(loc.coordinates_verified)});
    setLocationMessage("");
  }
  async function saveLocation(){
    setLocationBusy(true);setLocationMessage("");
    try{
      const payload={...locationForm,latitude:Number(locationForm.latitude),longitude:Number(locationForm.longitude),elevation_m:Number(locationForm.elevation_m)};
      const r=await fetch(API+"/locations",{method:editingLocation?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(editingLocation?{...payload,id:editingLocation}:{...payload})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not save location");
      await loadLocations(true);setEditingLocation(null);setLocationForm({...emptyLocation});setLocationMessage("Location saved.");
      if(j.location?.id)setLocation(j.location.id);
    }catch(e){setLocationMessage(e.message||"Could not save location.");}
    finally{setLocationBusy(false);}
  }
  async function locationAction(id,action,value){
    setLocationBusy(true);setLocationMessage("");
    try{
      const r=await fetch(API+"/locations",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,action,value})});
      const j=await r.json();if(!r.ok)throw new Error(j.error||"Could not update location");
      await loadLocations(true);
      if(action==="primary"||action==="restore")setLocation(id);
      if(action==="archive"&&location===id){const primary=locations.find(x=>x.is_primary&&x.id!==id&&!x.is_archived);if(primary)setLocation(primary.id);}
    }catch(e){setLocationMessage(e.message||"Could not update location.");}
    finally{setLocationBusy(false);}
  }
  async function loadForecast(loc){
    setLoading(true);setError("");
    try{
      const r=await fetch(API+"/forecast?location="+loc);
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Forecast unavailable");
      setData(j);
      const today=j.days.find(x=>x.isToday)||j.days[0];
      setSelectedDate(today?.date||"");
    }catch(e){setError(e.message||"Could not load forecast");}
    finally{setLoading(false);}
  }
  async function loadObservations(){
    try{const r=await fetch(API+"/observations");if(r.ok){const j=await r.json();setObservations(j.observations||[]);}}catch(e){}
  }
  useEffect(()=>{loadForecast(location);},[location]);
  useEffect(()=>{loadLocations(true);loadObservations();},[]);
  const day=data?.days.find(x=>x.date===selectedDate)||data?.days[0];
  const twilight=data?.twilight.find(x=>x.date===selectedDate)||data?.twilight[0];
  const halo=data?.halo;
  const locName=data?.location?.name||"Skywatch";
  const localTime=(d)=>!d?"—":new Intl.DateTimeFormat("en-IN",{timeZone:data?.timezone||"Asia/Kolkata",hour:"2-digit",minute:"2-digit",hour12:true}).format(new Date(d));
  const sunsetScore=day?.dusk?.colour??0;
  const haloScore=halo?.score??0;
  const scene = active==="halo" && haloScore>=50 ? "lunar" : active==="twilight" ? "twilight" : active==="sun" && sunsetScore>=55 ? "sunset" : (haloScore>=72 ? "lunar" : sunsetScore>=55 ? "sunset" : "twilight");
  const sceneLabel = scene==="sunset" ? "Sunset colours" : scene==="lunar" ? "Lunar atmosphere" : "Blue-hour atmosphere";
  const localHour=Number(new Intl.DateTimeFormat("en-IN",{timeZone:data?.timezone||"Asia/Kolkata",hour:"2-digit",hourCycle:"h23"}).format(new Date()));
  const currentDay=data?.days.find(x=>x.isToday)||data?.days[0];
  const adaptiveMode=currentDay?.sunrise&&currentDay?.sunset&&new Date()>=new Date(currentDay.sunrise)&&new Date()<=new Date(currentDay.sunset)?"light":"dark";
  const appearanceMode=appearance==="adaptive"?adaptiveMode:appearance;
  async function saveObservation(){
    setSaving(true);setMessage("");
    try{
      const r=await fetch(API+"/observations",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({location,phenomenon,rating,notes})});
      const j=await r.json();
      if(!r.ok)throw new Error(j.error||"Could not save");
      setMessage("Observation saved to your journal.");
      setNotes("");
      await loadObservations();
    }catch(e){setMessage(e.message||"Could not save observation.");}
    finally{setSaving(false);}
  }

  return html`
  <main className=${"shell theme-"+active+" profile-"+profile+" scene-"+scene+" appearance-"+appearanceMode}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark">✳</div><div><div className="brand-name">SKYWATCH</div><div className="brand-sub">Atmospheric intelligence</div></div></div>
      <div className="header-location"><div className="station-select-wrap"><label htmlFor="header-location-select">OBSERVING FROM</label><select id="header-location-select" value=${location} onChange=${e=>setLocation(e.target.value)}>${locations.filter(x=>!x.is_archived).map(x=>html`<option value=${x.id}>${x.name}${x.is_primary?" · Primary":""}</option>`)}</select></div><div className="appearance-select-wrap"><label htmlFor="appearance-select">APPEARANCE</label><select id="appearance-select" value=${appearance} onChange=${e=>setAppearance(e.target.value)}><option value="adaptive">Adaptive</option><option value="dark">Dark</option><option value="light">Light</option></select></div><button className="manage-locations-button" onClick=${()=>{setShowLocations(true);setEditingLocation(null);setLocationMessage("");}}>Locations ↗</button></div>
    </header>
    ${showLocations?html`<section className="locations-screen"><button onClick=${()=>setShowLocations(false)}>Close location manager ×</button><h2>Your locations</h2><button onClick=${startNewLocation}>＋ Add location</button><div className="saved-locations-list">${locations.map(loc=>html`<article className="saved-location-card"><h3>${loc.name}</h3><p>${loc.subtitle} · ${Number(loc.latitude).toFixed(4)}° N · ${Number(loc.longitude).toFixed(4)}° E</p><p>Elevation ${loc.elevation_m} m · ${loc.timezone}</p><button onClick=${()=>setLocation(loc.id)}>Use</button><button onClick=${()=>locationAction(loc.id,"primary")}>Primary</button><button onClick=${()=>locationAction(loc.id,"favourite")}>Favourite</button><button onClick=${()=>startEditLocation(loc)}>Edit</button><button onClick=${()=>loc.is_archived?locationAction(loc.id,"restore"):locationAction(loc.id,"archive")}>${loc.is_archived?"Restore":"Archive"}</button></article>`)}</div><div className="location-editor"><h3>${editingLocation?"Edit location":"Add location"}</h3><label>Name<input value=${locationForm.name} onChange=${e=>setLocationForm({...locationForm,name:e.target.value})}/></label><label>Area<input value=${locationForm.subtitle} onChange=${e=>setLocationForm({...locationForm,subtitle:e.target.value})}/></label><label>Latitude<input type="number" value=${locationForm.latitude} onChange=${e=>setLocationForm({...locationForm,latitude:e.target.value})}/></label><label>Longitude<input type="number" value=${locationForm.longitude} onChange=${e=>setLocationForm({...locationForm,longitude:e.target.value})}/></label><label>Elevation (m)<input type="number" value=${locationForm.elevation_m} onChange=${e=>setLocationForm({...locationForm,elevation_m:e.target.value})}/></label><label>Time zone<input value=${locationForm.timezone} onChange=${e=>setLocationForm({...locationForm,timezone:e.target.value})}/></label><label>Observation notes<textarea value=${locationForm.observation_notes} onChange=${e=>setLocationForm({...locationForm,observation_notes:e.target.value})}/></label><label><input type="checkbox" checked=${locationForm.is_favourite} onChange=${e=>setLocationForm({...locationForm,is_favourite:e.target.checked})}/> Favourite</label><label><input type="checkbox" checked=${locationForm.is_primary} onChange=${e=>setLocationForm({...locationForm,is_primary:e.target.checked})}/> Primary</label><label><input type="checkbox" checked=${locationForm.coordinates_verified} onChange=${e=>setLocationForm({...locationForm,coordinates_verified:e.target.checked})}/> Coordinates verified</label><button disabled=${locationBusy} onClick=${saveLocation}>${locationBusy?"Saving…":editingLocation?"Save changes":"Add location"}</button><p>${locationMessage}</p></div></section>`:null}
    <nav className="main-nav" aria-label="Main navigation">
      <button className="nav-active" onClick=${()=>document.getElementById("today-section")?.scrollIntoView({behavior:"smooth"})}>Today</button>
      <button onClick=${()=>document.getElementById("explore-section")?.scrollIntoView({behavior:"smooth"})}>Explore</button>
      <button onClick=${()=>{setActive("twilight");document.getElementById("timeline-section")?.scrollIntoView({behavior:"smooth"});}}>Timeline</button>
      <button onClick=${()=>document.getElementById("journal-section")?.scrollIntoView({behavior:"smooth"})}>Journal</button>
      <button onClick=${()=>{document.getElementById("settings-section")?.scrollIntoView({behavior:"smooth"});setShowLocations(true);}}>Settings</button>
    </nav>

    <section className="today-heading" id="today-section"><div><div className="eyebrow">FIELD OBSERVATORY / ${new Intl.DateTimeFormat("en-IN",{timeZone:data?.timezone||"Asia/Kolkata",weekday:"long",day:"2-digit",month:"long"}).format(new Date())}</div><h1>The sky, <em>observed.</em></h1><p>Look closer. Know when. Understand why.</p></div><div className="station-meta"><span className="station-dot"></span><div><strong>${locations.find(x=>x.id===location)?.name||locName}</strong><small>${Number(locations.find(x=>x.id===location)?.latitude??data?.location?.lat??0).toFixed(4)}° N · ${Number(locations.find(x=>x.id===location)?.longitude??data?.location?.lon??0).toFixed(4)}° E</small></div><button onClick=${()=>setShowLocations(true)}>Change station</button></div></section>

    ${!loading&&!error&&data?html`<section className="sky-canvas"><div className="sky-canvas-copy"><div className="eyebrow">TODAY’S SKY OUTLOOK / ${locName}</div><div className="sky-canvas-title">${scoreWord(sunsetScore)}</div><p>${sunsetScore>=55?"Conditions may favour a colourful sunset. Watch the western horizon as the Sun approaches the horizon.":"A quieter sky is possible today. Recheck the cloud layers as sunset approaches."}</p><div className="canvas-tags"><span>WESTERN HORIZON</span><span>AFTERGLOW WATCH</span></div></div><div className="sky-canvas-score"><span>SUNSET COLOUR POTENTIAL</span><strong>${sunsetScore}<small>/100</small></strong><div className="sky-canvas-time">SUNSET · ${localTime(day?.sunset)}</div><div className="canvas-confidence">DATA CONFIDENCE · ${day?.dusk.confidence??0}%</div></div></section>`:null}

    ${loading?html`<div className="loading">Reading the latest atmospheric forecast…</div>`:error?html`<div className="error">${error}<br/><button onClick=${()=>loadForecast(location)}>Try again</button></div>`:data?html`
      <section className="next-events" id="timeline-section"><div className="section-kicker"><span>NEXT SKY EVENTS</span><span>LOCAL TIME · ${data?.timezone||"Asia/Kolkata"}</span></div><div className="event-row"><article className="event-item event-sunset"><div className="event-icon">☼</div><div><span>Sunset</span><strong>${localTime(day?.sunset)}</strong><small>Colour & afterglow window</small></div><b>01</b></article><article className="event-item event-blue"><div className="event-icon">◒</div><div><span>Blue hour</span><strong>${localTime(twilight?.evening.blueStart)}</strong><small>Twilight photography</small></div><b>02</b></article><article className="event-item event-moon"><div className="event-icon">☾</div><div><span>Lunar halo watch</span><strong>${localTime(halo?.bestTime)}</strong><small>${halo?.label||"No estimate"}</small></div><b>03</b></article></div></section>
      <div className="date-strip">
        ${data.days.map(d=>html`<button key=${d.date} className=${selectedDate===d.date?"active":""} onClick=${()=>setSelectedDate(d.date)}><strong>${d.isToday?"Today":d.label}</strong><span>${d.date}</span></button>`)}
      </div>

      <section className="module-grid" id="explore-section"><div className="section-kicker module-kicker"><span>THE THREE PHENOMENA</span><span>SELECT TO EXPLORE</span></div>
        <button className=${"module-card "+(active==="sun"?"active":"")} onClick=${()=>setActive("sun")}>
          <div className="module-top"><span className="module-icon">◉</span><span className="module-number">01 / SOLAR</span></div>
          <div className="module-label">Sunrise & sunset colour</div>
          <div className="module-score">${day?.dusk.colour??"—"}<small>/ 100</small></div>
          <div className="module-status">${scoreWord(day?.dusk.colour??0)}</div>
          <div className="module-meter"><span style=${{width:(day?.dusk.colour??0)+"%"}}></span></div>
        </button>
        <button className=${"module-card "+(active==="twilight"?"active":"")} onClick=${()=>setActive("twilight")}>
          <div className="module-top"><span className="module-icon">☾</span><span className="module-number">02 / TWILIGHT</span></div>
          <div className="module-label">Twilight & blue hour</div>
          <div className="module-score">${day?.dusk.confidence??"—"}<small>% data confidence</small></div>
          <div className="module-status">Blue-hour times calculated astronomically</div>
          <div className="module-meter"><span style=${{width:(day?.dusk.confidence??0)+"%",background:"var(--blue)"}}></span></div>
        </button>
        <button className=${"module-card "+(active==="halo"?"active":"")} onClick=${()=>setActive("halo")}>
          <div className="module-top"><span className="module-icon">◎</span><span className="module-number">03 / LUNAR OPTICS</span></div>
          <div className="module-label">22° lunar halo · viewing potential</div>
          <div className="module-score">${halo?.score??"—"}<small>/ 100</small></div>
          <div className="module-status">${halo?.label||"No estimate yet"}</div>
          <div className="module-meter"><span style=${{width:(halo?.score??0)+"%",background:"var(--pink)"}}></span></div>
        </button>
      </section>

      <section className="content-panel" id="explore-details">
        ${active==="sun"?html`
          <div className="panel-heading">
            <div><div className="eyebrow">Module 01 · Solar colour</div><h2>${locName} · ${day?.label}</h2><p>Separate estimates for direct Sun visibility and colour potential. Colour can still develop after the solar disc disappears.</p></div>
            <div className="confidence">${day?.dusk.confidence??0}% confidence estimate</div>
          </div>
          <div className="detail-grid">
            <div className="detail-card">
              <h3>Sunrise and sunset · local time</h3>
              <div className="big-times">
                <div className="time-block sunrise"><span>Sunrise</span><strong>${localTime(day?.sunrise)}</strong></div>
                <div className="time-block sunset"><span>Sunset</span><strong>${fmtTime(day?.sunset)}</strong></div>
              </div>
            </div>
            <div className="detail-card">
              <h3>What the atmosphere suggests · sunset</h3>
              <${ReasonList} items=${cloudReasons(day?.conditions.evening)}/>
            </div>
          </div>
          <div className="metrics">
            <${Metric} label="Sun visibility" value=${day?.dusk.visibility+"/100"} sub="Horizon obstruction proxy"/>
            <${Metric} label="Colour potential" value=${day?.dusk.colour+"/100"} sub="Golden · pink · peach"/>
            <${Metric} label="Afterglow potential" value=${day?.dusk.afterglow+"/100"} sub="Post-sunset colour"/>
            <${Metric} label="Dawn colour" value=${day?.dawn.colour+"/100"} sub="Eastern-sky estimate"/>
          </div>
          <div className="note">Confidence estimates are conservative and rule-based, not statistically calibrated. The current model samples forecast cloud layers at the location, not a full east/west horizon scan. Local terrain, distant cloud banks and aerosol optical depth can materially change the actual view. Treat this as a planning signal, not a guaranteed colourful sunset.</div>
        `:active==="twilight"?html`
          <div className="panel-heading">
            <div><div className="eyebrow">Module 02 · Light transitions</div><h2>Twilight and blue hour</h2><p>Solar timing is calculated from location and date. The visual blue-hour window is an operational photographic definition.</p></div>
            <div className="confidence">${day?.dusk.confidence??0}% confidence estimate</div>
          </div>
          <div className="detail-grid">
            <div className="detail-card"><h3>Morning transitions</h3><div className="timeline">
              <div className="timepoint"><span>Astro begins</span><strong>${localTime(twilight?.morning.astro)}</strong><small>−18°</small></div>
              <div className="timepoint"><span>Nautical</span><strong>${localTime(twilight?.morning.nautical)}</strong><small>−12°</small></div>
              <div className="timepoint"><span>Civil</span><strong>${localTime(twilight?.morning.civil)}</strong><small>−6°</small></div>
              <div className="timepoint"><span>Blue hour</span><strong>${localTime(twilight?.morning.blueStart)}–${localTime(twilight?.morning.blueEnd)}</strong><small>−6° to −4°</small></div>
              <div className="timepoint"><span>Sunrise</span><strong>${localTime(twilight?.morning.sunrise)}</strong><small>−0.833°</small></div>
            </div></div>
            <div className="detail-card"><h3>Evening transitions</h3><div className="timeline">
              <div className="timepoint"><span>Golden starts</span><strong>${localTime(twilight?.evening.goldenStart)}</strong><small>+6°</small></div>
              <div className="timepoint"><span>Sunset</span><strong>${localTime(twilight?.evening.sunset)}</strong><small>−0.833°</small></div>
              <div className="timepoint"><span>Blue hour</span><strong>${localTime(twilight?.evening.blueStart)}–${localTime(twilight?.evening.blueEnd)}</strong><small>−4° to −6°</small></div>
              <div className="timepoint"><span>Nautical ends</span><strong>${localTime(twilight?.evening.nauticalEnd)}</strong><small>−12°</small></div>
              <div className="timepoint"><span>Astro ends</span><strong>${localTime(twilight?.evening.astroEnd)}</strong><small>−18°</small></div>
            </div></div>
          </div>
          <div className="metrics">
            <${Metric} label="Civil twilight" value="0° → −6°" sub="Sun below horizon"/>
            <${Metric} label="Nautical twilight" value="−6° → −12°" sub="Horizon often visible at sea"/>
            <${Metric} label="Astronomical" value="−12° → −18°" sub="Dark-sky transition"/>
            <${Metric} label="Blue hour" value="−6° ↔ −4°" sub="Skywatch definition"/>
          </div>
          <div className="note">Golden hour is shown as the interval while the Sun is between +6° and the horizon. Blue hour is not a formal astronomical twilight class; cameras, humidity, aerosols and the local horizon shift its perceived start and end.</div>
        `:html`
          <div className="panel-heading">
            <div><div className="eyebrow">Module 03 · Ice-crystal optics</div><h2>Tonight's lunar halo watch</h2><p>Conditions for a possible 22° halo around the Moon. This is distinct from a lunar corona, which forms by diffraction in much smaller cloud droplets or particles.</p></div>
            <div className="confidence">${halo?.confidence??0}% data confidence · not event probability</div>
          </div>
          <div className="detail-grid">
            <div className="detail-card">
              <h3>Most favourable sampled moment</h3>
              <div className="big-times">
                <div className="time-block"><span>Local time</span><strong>${localTime(halo?.bestTime)}</strong></div>
                <div className="time-block"><span>Moon altitude</span><strong>${halo?.moonAltitude==null?"—":halo.moonAltitude+"°"}</strong></div>
              </div>
              <div className="metrics">
                <${Metric} label="Moon phase" value=${halo?.phase||"—"} sub=${(halo?.illumination??0)+"% illuminated"}/>
                <${Metric} label="Atmospheric formation" value=${(halo?.formationScore??0)+"/100"} sub="Cloud and altitude setup"/>
                <${Metric} label="Moonlight contribution" value=${(halo?.moonlightFactor??0)+"/100"} sub="Visibility-limiting factor"/>
                <${Metric} label="High cloud" value=${cap(halo?.clouds?.high)} sub="Possible ice-cloud proxy"/>
              </div>
            </div>
            <div className="detail-card"><h3>Signals behind this estimate</h3><${ReasonList} items=${halo?.clouds?cloudReasons(halo.clouds):["Moon altitude and cloud data are not sufficient to estimate tonight's viewing conditions."]}/></div>
          </div>
          <div className="metrics">
            <${Metric} label="Halo conditions" value=${(halo?.score??0)+"/100"} sub=${halo?.label||"—"}/>
            <${Metric} label="Moon visibility" value=${halo?.moonAltitude!=null&&halo.moonAltitude>10?"Possible":"Unfavourable"} sub="Altitude-based estimate"/>
            <${Metric} label="Cloud phase" value="Unknown" sub="No direct ice-phase data"/>
            <${Metric} label="Optical thickness" value="Unknown" sub="Not supplied by provider"/>
          </div>
          <div className="note"><span className="pill warn">How to read this score</span><br/>The viewing score combines cloud/altitude conditions with available moonlight. A halo can form around a crescent Moon, but it will be dimmer and harder to see. ${halo?.caveat}</div>
        `}
      </section>
    `:null}

    <section className="content-panel journal" id="journal-section"><div className="journal-heading"><div className="eyebrow">PERSONAL FIELD ARCHIVE</div><h2>What did the sky actually do?</h2><p>Predictions are only useful when compared with what you observe.</p></div>
      <div className="journal-intro"><div className="eyebrow">Field notes · Prediction versus observation</div><h2>Build your sky archive.</h2><p>Record what appeared in the sky. These observations will become the ground truth for evaluating and improving Skywatch's simple scoring rules over time.</p><span className="pill">Latest ${observations.length} entries shown</span>
        <div className="observation-list">
          ${observations.slice(0,5).map(o=>html`<div className="observation" key=${o.id}><div><strong>${locations.find(x=>x.id===o.location)?.name||o.location} · ${labelFor(o.phenomenon)}</strong><p>${"★".repeat(o.rating)}${"☆".repeat(5-o.rating)} ${o.notes||"No notes added"}</p></div><time>${fmtDateTime(o.observed_at)}</time></div>`)}
          ${observations.length===0?html`<div className="observation"><div><strong>No observations yet</strong><p>Your first field note will appear here.</p></div></div>`:null}
        </div>
      </div>
      <div>
        <div className="form-grid">
          <div className="field"><label>Phenomenon</label><select value=${phenomenon} onChange=${e=>setPhenomenon(e.target.value)}><option value="sunrise_sunset">Sunrise / sunset</option><option value="twilight">Twilight / blue hour</option><option value="lunar_halo">Lunar halo</option></select></div>
          <div className="field"><label>Location</label><select value=${location} onChange=${e=>setLocation(e.target.value)}>${locations.filter(x=>!x.is_archived).map(x=>html`<option value=${x.id}>${x.name}</option>`)}</select></div>
          <div className="field full"><label>Observed quality · 1 poor to 5 exceptional</label><div className="rating">${[1,2,3,4,5].map(n=>html`<button type="button" className=${rating===n?"selected":""} onClick=${()=>setRating(n)}>${n} ★</button>`)}</div></div>
          <div className="field full"><label>What did you observe?</label><textarea value=${notes} onChange=${e=>setNotes(e.target.value)} placeholder="Cloud shape, colour, halo clarity, duration, direction…"></textarea></div>
          <div className="field full"><button className="save-button" disabled=${saving} onClick=${saveObservation}>${saving?"Saving…":"Save field observation"}</button>${message?html`<div className="form-message">${message}</div>`:null}</div>
        </div>
      </div>
    </section>

    <footer className="footer">
      <div>SKYWATCH · ${locations.filter(x=>!x.is_archived).map(x=>x.name).join(" + ")}<br/>Solar calculations: compact NOAA-style approximation · Times in ${data?.timezone||"Asia/Kolkata"}</div>
      <div>Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · CC BY 4.0<br/>Forecast scores are heuristic estimates, not official warnings.</div>
    </footer>
  </main>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App}/>`);