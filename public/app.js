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
  const [profile,setProfile]=useState("aurora");
  const [observations,setObservations]=useState([]);
  const [phenomenon,setPhenomenon]=useState("sunrise_sunset");
  const [rating,setRating]=useState(4);
  const [notes,setNotes]=useState("");
  const [saving,setSaving]=useState(false);
  const [message,setMessage]=useState("");

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
  useEffect(()=>{loadObservations();},[]);
  const day=data?.days.find(x=>x.date===selectedDate)||data?.days[0];
  const twilight=data?.twilight.find(x=>x.date===selectedDate)||data?.twilight[0];
  const halo=data?.halo;
  const locName=data?.location?.name||"Skywatch";
  const sunsetScore=day?.dusk?.colour??0;
  const haloScore=halo?.score??0;
  const scene = active==="halo" && haloScore>=50 ? "lunar" : active==="twilight" ? "twilight" : active==="sun" && sunsetScore>=55 ? "sunset" : (haloScore>=72 ? "lunar" : sunsetScore>=55 ? "sunset" : "twilight");
  const sceneLabel = scene==="sunset" ? "Sunset colours" : scene==="lunar" ? "Lunar atmosphere" : "Blue-hour atmosphere";
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
  <main className=${"shell theme-"+active+" profile-"+profile+" scene-"+scene}>
    <header className="topbar">
      <div className="brand"><div className="brand-mark">✳</div><div><div className="brand-name">SKYWATCH</div><div className="brand-sub">Atmospheric intelligence</div></div></div>
      <div className="top-meta">10.6° N · Kerala, India &nbsp; / &nbsp; Field edition 01</div>
    </header>

    <section className="hero">
      <div>
        <div className="eyebrow">Observe the changing sky</div>
        <h1>Read the sky.<br/><em>Anticipate the moment.</em></h1>
        <p className="hero-copy">A local forecast for colour, twilight and lunar optics. Every score is paired with the atmospheric signals behind it—and an honest measure of uncertainty.</p>
      </div>
      <div className="location-area">
        <div className="location-caption">Observation station</div>
        <div className="profile-picker"><span>Sky palette</span><div className="profile-options"><button className=${profile==="aurora"?"selected":""} onClick=${()=>setProfile("aurora")}><i className="swatch aurora"></i>Aurora</button><button className=${profile==="ember"?"selected":""} onClick=${()=>setProfile("ember")}><i className="swatch ember"></i>Ember</button><button className=${profile==="ocean"?"selected":""} onClick=${()=>setProfile("ocean")}><i className="swatch ocean"></i>Ocean</button><button className=${profile==="moon"?"selected":""} onClick=${()=>setProfile("moon")}><i className="swatch moon"></i>Moon</button></div></div><div className="scene-indicator"><i></i><span>Live atmosphere</span><strong>${sceneLabel}</strong><small>Changes with the selected forecast and module</small></div>
        <div className="location-switch">
          <button className=${location==="minalur"?"active":""} onClick=${()=>setLocation("minalur")}>Minalur</button>
          <button className=${location==="peruvanmala"?"active":""} onClick=${()=>setLocation("peruvanmala")}>Peruvanmala</button>
        </div>
      </div>
    </section>

    ${loading?html`<div className="loading">Reading the latest atmospheric forecast…</div>`:error?html`<div className="error">${error}<br/><button onClick=${()=>loadForecast(location)}>Try again</button></div>`:data?html`
      <div className="date-strip">
        ${data.days.map(d=>html`<button key=${d.date} className=${selectedDate===d.date?"active":""} onClick=${()=>setSelectedDate(d.date)}><strong>${d.isToday?"Today":d.label}</strong><span>${d.date}</span></button>`)}
      </div>

      <section className="module-grid">
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
          <div className="module-label">22° lunar halo conditions</div>
          <div className="module-score">${halo?.score??"—"}<small>/ 100</small></div>
          <div className="module-status">${halo?.label||"No estimate yet"}</div>
          <div className="module-meter"><span style=${{width:(halo?.score??0)+"%",background:"var(--pink)"}}></span></div>
        </button>
      </section>

      <section className="content-panel">
        ${active==="sun"?html`
          <div className="panel-heading">
            <div><div className="eyebrow">Module 01 · Solar colour</div><h2>${locName} · ${day?.label}</h2><p>Separate estimates for direct Sun visibility and colour potential. Colour can still develop after the solar disc disappears.</p></div>
            <div className="confidence">${day?.dusk.confidence??0}% confidence estimate</div>
          </div>
          <div className="detail-grid">
            <div className="detail-card">
              <h3>Sunrise and sunset · local time</h3>
              <div className="big-times">
                <div className="time-block sunrise"><span>Sunrise</span><strong>${fmtTime(day?.sunrise)}</strong></div>
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
              <div className="timepoint"><span>Astro begins</span><strong>${fmtTime(twilight?.morning.astro)}</strong><small>−18°</small></div>
              <div className="timepoint"><span>Nautical</span><strong>${fmtTime(twilight?.morning.nautical)}</strong><small>−12°</small></div>
              <div className="timepoint"><span>Civil</span><strong>${fmtTime(twilight?.morning.civil)}</strong><small>−6°</small></div>
              <div className="timepoint"><span>Blue hour</span><strong>${fmtTime(twilight?.morning.blueStart)}–${fmtTime(twilight?.morning.blueEnd)}</strong><small>−6° to −4°</small></div>
              <div className="timepoint"><span>Sunrise</span><strong>${fmtTime(twilight?.morning.sunrise)}</strong><small>−0.833°</small></div>
            </div></div>
            <div className="detail-card"><h3>Evening transitions</h3><div className="timeline">
              <div className="timepoint"><span>Golden starts</span><strong>${fmtTime(twilight?.evening.goldenStart)}</strong><small>+6°</small></div>
              <div className="timepoint"><span>Sunset</span><strong>${fmtTime(twilight?.evening.sunset)}</strong><small>−0.833°</small></div>
              <div className="timepoint"><span>Blue hour</span><strong>${fmtTime(twilight?.evening.blueStart)}–${fmtTime(twilight?.evening.blueEnd)}</strong><small>−4° to −6°</small></div>
              <div className="timepoint"><span>Nautical ends</span><strong>${fmtTime(twilight?.evening.nauticalEnd)}</strong><small>−12°</small></div>
              <div className="timepoint"><span>Astro ends</span><strong>${fmtTime(twilight?.evening.astroEnd)}</strong><small>−18°</small></div>
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
            <div className="confidence">${halo?.confidence??0}% confidence · conservative</div>
          </div>
          <div className="detail-grid">
            <div className="detail-card">
              <h3>Most favourable sampled moment</h3>
              <div className="big-times">
                <div className="time-block"><span>Local time</span><strong>${fmtTime(halo?.bestTime)}</strong></div>
                <div className="time-block"><span>Moon altitude</span><strong>${halo?.moonAltitude==null?"—":halo.moonAltitude+"°"}</strong></div>
              </div>
              <div className="metrics">
                <${Metric} label="Moon illumination" value=${(halo?.illumination??0)+"%"} sub="Approximate phase fraction"/>
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
          <div className="note"><span className="pill warn">Important limitation</span><br/>${halo?.caveat}</div>
        `}
      </section>
    `:null}

    <section className="content-panel journal">
      <div className="journal-intro"><div className="eyebrow">Field notes · Prediction versus observation</div><h2>Build your sky archive.</h2><p>Record what appeared in the sky. These observations will become the ground truth for evaluating and improving Skywatch's simple scoring rules over time.</p><span className="pill">Latest ${observations.length} entries shown</span>
        <div className="observation-list">
          ${observations.slice(0,5).map(o=>html`<div className="observation" key=${o.id}><div><strong>${o.location==="minalur"?"Minalur":"Peruvanmala"} · ${labelFor(o.phenomenon)}</strong><p>${"★".repeat(o.rating)}${"☆".repeat(5-o.rating)} ${o.notes||"No notes added"}</p></div><time>${fmtDateTime(o.observed_at)}</time></div>`)}
          ${observations.length===0?html`<div className="observation"><div><strong>No observations yet</strong><p>Your first field note will appear here.</p></div></div>`:null}
        </div>
      </div>
      <div>
        <div className="form-grid">
          <div className="field"><label>Phenomenon</label><select value=${phenomenon} onChange=${e=>setPhenomenon(e.target.value)}><option value="sunrise_sunset">Sunrise / sunset</option><option value="twilight">Twilight / blue hour</option><option value="lunar_halo">Lunar halo</option></select></div>
          <div className="field"><label>Location</label><select value=${location} onChange=${e=>setLocation(e.target.value)}><option value="minalur">Minalur</option><option value="peruvanmala">Peruvanmala</option></select></div>
          <div className="field full"><label>Observed quality · 1 poor to 5 exceptional</label><div className="rating">${[1,2,3,4,5].map(n=>html`<button type="button" className=${rating===n?"selected":""} onClick=${()=>setRating(n)}>${n} ★</button>`)}</div></div>
          <div className="field full"><label>What did you observe?</label><textarea value=${notes} onChange=${e=>setNotes(e.target.value)} placeholder="Cloud shape, colour, halo clarity, duration, direction…"></textarea></div>
          <div className="field full"><button className="save-button" disabled=${saving} onClick=${saveObservation}>${saving?"Saving…":"Save field observation"}</button>${message?html`<div className="form-message">${message}</div>`:null}</div>
        </div>
      </div>
    </section>

    <footer className="footer">
      <div>SKYWATCH · Minalur + Peruvanmala, Kerala<br/>Solar calculations: compact NOAA-style approximation · Times in IST</div>
      <div>Weather: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> · CC BY 4.0<br/>Forecast scores are heuristic estimates, not official warnings.</div>
    </footer>
  </main>`;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App}/>`);