(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  const HISTORY_KEY = 'dangelo_move_history_v1';
  const HISTORY_LIMIT = 20;
  let pending = null;
  let toastTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .undoMoveToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;background:#231f20;color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:13px;font-weight:700}
    .undoMoveToast button{border:1px solid rgba(255,255,255,.35);background:#fff;color:#231f20;border-radius:6px;padding:6px 10px;font-weight:800;cursor:pointer}
    .moveHistoryLink{margin-left:auto;border:0!important;background:transparent!important;color:#777!important;padding:2px 4px!important;font-size:11px!important;font-weight:600!important;cursor:pointer;opacity:.75}
    .moveHistoryLink:hover{opacity:1;color:#231f20!important}
    .moveHistoryBackdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.18);display:flex;align-items:flex-end;justify-content:flex-end;padding:18px}
    .moveHistoryPanel{width:min(420px,calc(100vw - 24px));max-height:min(520px,75vh);overflow:auto;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.22);padding:14px}
    .moveHistoryHead{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px}
    .moveHistoryHead strong{font-size:14px}.moveHistoryHead button{border:0;background:transparent;font-size:20px;cursor:pointer;color:#666}
    .moveHistoryEmpty{font-size:12px;color:#777;padding:12px 2px}
    .moveHistoryItem{display:grid;grid-template-columns:1fr auto;gap:10px;padding:10px 0;border-top:1px solid #eee}
    .moveHistoryItem:first-of-type{border-top:0}.moveHistoryItem strong{display:block;font-size:12px;margin-bottom:3px}.moveHistoryItem span{display:block;font-size:11px;color:#777;line-height:1.35}
    .moveHistoryItem button{align-self:center;border:1px solid #ccc;background:#fff;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer}
    @media(max-width:700px){.undoMoveToast{left:12px;right:12px;bottom:14px;transform:none;justify-content:space-between}.moveHistoryBackdrop{padding:10px}.moveHistoryPanel{width:100%;max-height:70vh}.moveHistoryLink{font-size:10px!important}}
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

  async function snapshotJob(jobId){
    const rows = await request(`/rest/v1/jobs?id=eq.${jobId}&select=id,job_name,crew_id,start_date,end_date`);
    const job = rows?.[0];
    if(!job) return null;
    return {...job};
  }

  function samePosition(a,b){
    return a && b && a.crew_id===b.crew_id && a.start_date===b.start_date && a.end_date===b.end_date;
  }

  function readHistory(){
    try {
      const value = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function writeHistory(items){
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0,HISTORY_LIMIT))); } catch {}
  }

  function recordMove(before,after){
    const history = readHistory();
    history.unshift({before,after,moved_at:new Date().toISOString()});
    writeHistory(history);
    ensureHistoryLink();
  }

  function fmtDate(value){
    if(!value) return 'Incoming';
    const d = new Date(`${value}T00:00:00`);
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  function describePosition(pos){
    if(!pos?.start_date) return 'Incoming Jobs';
    const crew = pos.crew_id ? `Crew #${pos.crew_id}` : 'No crew';
    const dates = pos.end_date && pos.end_date!==pos.start_date ? `${fmtDate(pos.start_date)}–${fmtDate(pos.end_date)}` : fmtDate(pos.start_date);
    return `${crew} · ${dates}`;
  }

  function hideToast(){
    document.querySelector('.undoMoveToast')?.remove();
    clearTimeout(toastTimer);
  }

  async function restorePosition(before,button){
    if(button) button.disabled=true;
    try{
      await request(`/rest/v1/jobs?id=eq.${before.id}`,{
        method:'PATCH',
        headers:{Prefer:'return=minimal'},
        body:JSON.stringify({crew_id:before.crew_id,start_date:before.start_date,end_date:before.end_date})
      });
      window.location.reload();
    }catch(err){
      console.error('Undo move failed',err);
      if(button) button.disabled=false;
    }
  }

  function showToast(before,after){
    hideToast();
    const toast = document.createElement('div');
    toast.className='undoMoveToast';
    toast.innerHTML=`<span>${before.job_name || 'Job'} moved</span><button type="button">Undo</button>`;
    toast.querySelector('button').onclick=()=>restorePosition(before,toast.querySelector('button'));
    document.body.appendChild(toast);
    toastTimer=setTimeout(hideToast,12000);
  }

  function closeHistory(){ document.querySelector('.moveHistoryBackdrop')?.remove(); }

  function openHistory(){
    closeHistory();
    const history = readHistory();
    const backdrop = document.createElement('div');
    backdrop.className='moveHistoryBackdrop';
    backdrop.innerHTML=`<div class="moveHistoryPanel"><div class="moveHistoryHead"><strong>Recent job moves</strong><button type="button" aria-label="Close">×</button></div><div class="moveHistoryBody"></div></div>`;
    backdrop.querySelector('.moveHistoryHead button').onclick=closeHistory;
    backdrop.onclick=e=>{if(e.target===backdrop)closeHistory()};
    const body=backdrop.querySelector('.moveHistoryBody');
    if(!history.length){
      body.innerHTML='<div class="moveHistoryEmpty">No moves saved yet.</div>';
    }else{
      history.forEach(item=>{
        const row=document.createElement('div');
        row.className='moveHistoryItem';
        row.innerHTML=`<div><strong>${item.before?.job_name || 'Job'}</strong><span>From: ${describePosition(item.before)}</span><span>To: ${describePosition(item.after)}</span></div><button type="button">Restore</button>`;
        row.querySelector('button').onclick=()=>restorePosition(item.before,row.querySelector('button'));
        body.appendChild(row);
      });
    }
    document.body.appendChild(backdrop);
  }

  function ensureHistoryLink(){
    const footer=document.querySelector('footer');
    if(!footer || footer.querySelector('.moveHistoryLink')) return;
    const role=(document.querySelector('.roleBadge')?.textContent || '').trim().toLowerCase();
    if(role!=='supervisor') return;
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='moveHistoryLink';
    btn.textContent='↶ Undo history';
    btn.onclick=openHistory;
    footer.appendChild(btn);
  }

  document.addEventListener('dragstart',async e=>{
    const card=e.target.closest?.('.jobCard[data-job-id]');
    if(!card) return;
    const jobId=Number(card.dataset.jobId);
    try{
      const before=await snapshotJob(jobId);
      if(before) pending={jobId,before};
    }catch(err){ console.error('Move snapshot failed',err); }
  },true);

  document.addEventListener('dragend',e=>{
    if(!pending) return;
    const current={...pending};
    pending=null;
    setTimeout(async()=>{
      try{
        const after=await snapshotJob(current.jobId);
        if(after && !samePosition(current.before,after)){
          recordMove(current.before,after);
          showToast(current.before,after);
        }
      }catch(err){ console.error('Move verification failed',err); }
    },500);
  },true);

  const observer=new MutationObserver(()=>ensureHistoryLink());
  observer.observe(document.getElementById('app') || document.body,{childList:true,subtree:true});
  ensureHistoryLink();
})();