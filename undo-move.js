(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  let pending = null;
  let toastTimer = null;

  const style = document.createElement('style');
  style.textContent = `
    .undoMoveToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;background:#231f20;color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:13px;font-weight:700}
    .undoMoveToast button{border:1px solid rgba(255,255,255,.35);background:#fff;color:#231f20;border-radius:6px;padding:6px 10px;font-weight:800;cursor:pointer}
    @media(max-width:700px){.undoMoveToast{left:12px;right:12px;bottom:14px;transform:none;justify-content:space-between}}
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

  function hideToast(){
    document.querySelector('.undoMoveToast')?.remove();
    clearTimeout(toastTimer);
  }

  function showToast(before,after){
    hideToast();
    const toast = document.createElement('div');
    toast.className='undoMoveToast';
    toast.innerHTML=`<span>${before.job_name || 'Job'} moved</span><button type="button">Undo</button>`;
    toast.querySelector('button').onclick=async()=>{
      toast.querySelector('button').disabled=true;
      try{
        await request(`/rest/v1/jobs?id=eq.${before.id}`,{
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({crew_id:before.crew_id,start_date:before.start_date,end_date:before.end_date})
        });
        hideToast();
        window.location.reload();
      }catch(err){
        console.error('Undo move failed',err);
        toast.querySelector('button').disabled=false;
      }
    };
    document.body.appendChild(toast);
    toastTimer=setTimeout(hideToast,12000);
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
        if(after && !samePosition(current.before,after)) showToast(current.before,after);
      }catch(err){ console.error('Move verification failed',err); }
    },500);
  },true);
})();