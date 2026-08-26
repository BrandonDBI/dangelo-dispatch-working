(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  const jobs = new Map();
  const exclusions = new Set();
  let guardJobId = null;
  let guardUntil = 0;
  let applyTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .singleDayMenu{position:fixed;z-index:12000;min-width:205px;background:#fff;border:1px solid #d9d9d9;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:5px}
    .singleDayMenu button{width:100%;border:0;background:transparent;text-align:left;padding:9px 10px;border-radius:5px;font:inherit;font-size:12px;font-weight:700;color:#7a1d1d;cursor:pointer}
    .singleDayMenu button:hover{background:#f5f5f5}
  `;
  document.head.appendChild(style);

  function authHeaders(){
    let session = null;
    try { session = JSON.parse(localStorage.getItem('dangelo_session') || 'null'); } catch {}
    return {apikey:KEY,Authorization:`Bearer ${session?.access_token || KEY}`,'Content-Type':'application/json'};
  }

  async function request(path,options={}){
    const res = await fetch(`${BASE}${path}`,{...options,headers:{...authHeaders(),...(options.headers||{})}});
    const text = await res.text();
    if(!res.ok) throw new Error(text || `Request failed (${res.status})`);
    return text ? JSON.parse(text) : null;
  }

  function isSupervisor(){
    return (document.querySelector('.roleBadge')?.textContent || '').trim().toLowerCase() === 'supervisor';
  }

  function key(jobId,date){ return `${jobId}|${date}`; }
  function closeMenu(){ document.querySelector('.singleDayMenu')?.remove(); }

  function fmtDate(date){
    return new Date(`${date}T00:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  }

  function applyExclusions(){
    document.querySelectorAll('.dropCell[data-date]').forEach(cell=>{
      const date=cell.dataset.date;
      cell.querySelectorAll('.jobCard[data-job-id]').forEach(card=>{
        if(exclusions.has(key(Number(card.dataset.jobId),date))) card.remove();
      });
    });
  }

  async function loadData(){
    if(!BASE || !KEY) return;
    try{
      const [jobRows,excludedRows]=await Promise.all([
        request('/rest/v1/jobs?select=id,start_date,end_date'),
        request('/rest/v1/job_date_exclusions?select=job_id,excluded_date')
      ]);
      jobs.clear();
      (jobRows||[]).forEach(job=>jobs.set(Number(job.id),job));
      exclusions.clear();
      (excludedRows||[]).forEach(row=>exclusions.add(key(Number(row.job_id),row.excluded_date)));
      applyExclusions();
    }catch(err){
      console.error('Single-day schedule load failed',err);
    }
  }

  async function removeDate(jobId,date,button){
    button.disabled=true;
    try{
      await request('/rest/v1/job_date_exclusions',{
        method:'POST',
        headers:{Prefer:'return=minimal'},
        body:JSON.stringify({job_id:jobId,excluded_date:date})
      });
      exclusions.add(key(jobId,date));
      closeMenu();
      applyExclusions();
    }catch(err){
      console.error('Remove single day failed',err);
      button.disabled=false;
    }
  }

  function markContextGesture(e){
    const card=e.target.closest?.('.dropCell[data-date] .jobCard[data-job-id]');
    if(!card || !isSupervisor()) return;
    if(e.button===2 || (e.button===0 && e.ctrlKey)){
      guardJobId=Number(card.dataset.jobId);
      guardUntil=Date.now()+1200;
    }
  }

  document.addEventListener('pointerdown',markContextGesture,true);
  document.addEventListener('mousedown',markContextGesture,true);

  document.addEventListener('click',e=>{
    const card=e.target.closest?.('.jobCard[data-job-id]');
    if(card && Number(card.dataset.jobId)===guardJobId && Date.now()<guardUntil){
      e.preventDefault();
      e.stopImmediatePropagation();
      guardJobId=null;
      guardUntil=0;
      return;
    }
    if(!e.target.closest('.singleDayMenu')) closeMenu();
  },true);

  document.addEventListener('contextmenu',e=>{
    const card=e.target.closest?.('.dropCell[data-date] .jobCard[data-job-id]');
    if(!card || !isSupervisor()) return;

    const cell=card.closest('.dropCell[data-date]');
    const jobId=Number(card.dataset.jobId);
    const date=cell.dataset.date;
    const job=jobs.get(jobId);
    if(!job?.start_date || !job?.end_date || job.start_date===job.end_date) return;
    if(exclusions.has(key(jobId,date))) return;

    e.preventDefault();
    e.stopImmediatePropagation();
    guardJobId=jobId;
    guardUntil=Date.now()+1200;
    closeMenu();

    const menu=document.createElement('div');
    menu.className='singleDayMenu';
    menu.style.left=`${Math.max(8,Math.min(e.clientX,window.innerWidth-220))}px`;
    menu.style.top=`${Math.max(8,Math.min(e.clientY,window.innerHeight-70))}px`;
    menu.innerHTML=`<button type="button">Remove ${fmtDate(date)} only</button>`;
    const button=menu.querySelector('button');
    button.onclick=()=>removeDate(jobId,date,button);
    document.body.appendChild(menu);
  },true);

  window.addEventListener('blur',closeMenu);
  window.addEventListener('resize',closeMenu);

  const observer=new MutationObserver(()=>{
    clearTimeout(applyTimer);
    applyTimer=setTimeout(applyExclusions,30);
  });
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});

  loadData();
  setInterval(()=>{ if(!document.hidden) loadData(); },4000);
  window.addEventListener('focus',loadData);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) loadData(); });
})();