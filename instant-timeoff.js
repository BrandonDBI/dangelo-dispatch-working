(() => {
  'use strict';

  const cfg=window.DANGELO_CONFIG||{};
  const BASE=String(cfg.SUPABASE_URL||'').replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
  const KEY=String(cfg.SUPABASE_ANON_KEY||'');
  let entries=[];
  let queued=false;
  let refreshTimer=null;

  function session(){try{return JSON.parse(localStorage.getItem('dangelo_session')||'null')}catch{return null}}
  function headers(){return{apikey:KEY,Authorization:`Bearer ${session()?.access_token||KEY}`,'Content-Type':'application/json'}}
  async function req(path){const res=await fetch(`${BASE}${path}`,{headers:headers()});const text=await res.text();if(!res.ok)throw new Error(text||`Request failed (${res.status})`);return text?JSON.parse(text):null}
  function esc(v){return String(v??'').replace(/[&<>'\"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','\"':'&quot;'}[ch]||ch))}
  function overlaps(e,date){return e.start_date<=date&&e.end_date>=date}

  function paint(){
    queued=false;
    const cells=Array.from(document.querySelectorAll('.dropCell[data-crew][data-date]'));
    if(!cells.length)return;
    cells.forEach(cell=>{
      const crewId=Number(cell.dataset.crew),date=cell.dataset.date;
      cell.querySelectorAll('.scheduleTimeOffMarker').forEach(el=>el.remove());
      entries.filter(e=>Number(e.crew_id)===crewId&&overlaps(e,date)).forEach(e=>{
        const marker=document.createElement('div');
        marker.className='scheduleTimeOffMarker';
        marker.innerHTML=`<strong>${esc(e.employee_name||'Employee')} — OFF</strong>${e.note?`<span>${esc(e.note)}</span>`:''}`;
        const addButton=cell.querySelector('.addCell');
        if(addButton)cell.insertBefore(marker,addButton);else cell.appendChild(marker);
      });
    });
  }

  function queuePaint(){if(queued)return;queued=true;requestAnimationFrame(paint)}

  async function refresh(){
    if(!BASE||!KEY)return;
    try{
      const rows=await req('/rest/v1/time_off_entries?select=id,employee_name,crew_id,start_date,end_date,note&crew_id=not.is.null&order=start_date.asc');
      entries=rows||[];
      queuePaint();
    }catch(err){console.error('Instant time off preload failed',err)}
  }

  const observer=new MutationObserver(queuePaint);
  const app=document.getElementById('app');
  if(app)observer.observe(app,{childList:true,subtree:true});

  refresh();
  refreshTimer=setInterval(()=>{if(!document.hidden)refresh()},3000);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh()});
})();