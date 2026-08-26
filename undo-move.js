(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  let pending = null;
  let toastTimer = null;
  let crewNames = new Map();

  const style = document.createElement('style');
  style.textContent = `
    .undoMoveToast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:9999;display:flex;align-items:center;gap:12px;background:#231f20;color:#fff;padding:10px 14px;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.25);font-size:13px;font-weight:700}
    .undoMoveToast button{border:1px solid rgba(255,255,255,.35);background:#fff;color:#231f20;border-radius:6px;padding:6px 10px;font-weight:800;cursor:pointer}
    .activityHistoryLink{margin-left:auto;border:0!important;background:transparent!important;color:#777!important;padding:2px 4px!important;font-size:11px!important;font-weight:600!important;cursor:pointer;opacity:.75}
    .activityHistoryLink:hover{opacity:1;color:#231f20!important}
    .activityBackdrop{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.18);display:flex;align-items:flex-end;justify-content:flex-end;padding:18px}
    .activityPanel{width:min(470px,calc(100vw - 24px));max-height:min(620px,80vh);overflow:hidden;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.22);display:flex;flex-direction:column}
    .activityHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-bottom:1px solid #eee}
    .activityHead strong{font-size:14px}.activityHead span{display:block;font-size:10px;color:#888;font-weight:500;margin-top:2px}
    .activityHeadActions{display:flex;gap:4px}.activityHead button{border:0;background:transparent;font-size:12px;cursor:pointer;color:#666;padding:5px}.activityHead .activityClose{font-size:20px}
    .activityBody{overflow:auto;padding:0 14px 10px}
    .activityEmpty{font-size:12px;color:#777;padding:18px 2px}
    .activityItem{display:grid;grid-template-columns:1fr auto;gap:10px;padding:11px 0;border-top:1px solid #eee}
    .activityItem:first-child{border-top:0}.activityItem strong{display:block;font-size:12px;margin-bottom:3px}.activityMeta{font-size:10px;color:#888;margin-bottom:4px}.activityDetail{font-size:11px;color:#666;line-height:1.4}
    .activityRestore{align-self:center;border:1px solid #ccc;background:#fff;border-radius:6px;padding:5px 8px;font-size:11px;font-weight:700;cursor:pointer}.activityRestore:disabled{opacity:.45}
    @media(max-width:700px){.undoMoveToast{left:12px;right:12px;bottom:14px;transform:none;justify-content:space-between}.activityBackdrop{padding:10px}.activityPanel{width:100%;max-height:75vh}.activityHistoryLink{font-size:10px!important}}
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
    const rows = await request(`/rest/v1/jobs?id=eq.${jobId}&select=*`);
    return rows?.[0] ? {...rows[0]} : null;
  }

  function samePosition(a,b){
    return a && b && a.crew_id===b.crew_id && a.start_date===b.start_date && a.end_date===b.end_date;
  }

  function fmtDate(value){
    if(!value) return '';
    const d = new Date(`${value}T00:00:00`);
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'});
  }

  function fmtWhen(value){
    const d=new Date(value);
    return d.toLocaleString('en-US',{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'});
  }

  function crewName(id){ return id ? (crewNames.get(Number(id)) || `Crew #${id}`) : 'No crew'; }

  function describePosition(pos){
    if(!pos?.start_date) return 'Incoming Jobs';
    const dates=pos.end_date&&pos.end_date!==pos.start_date?`${fmtDate(pos.start_date)}–${fmtDate(pos.end_date)}`:fmtDate(pos.start_date);
    return `${crewName(pos.crew_id)} · ${dates}`;
  }

  function periodName(v){ return v==='AM'?'AM':v==='PM'?'PM':'All Day'; }

  function activityDetail(item){
    const before=item.before_data||{};
    const after=item.after_data||{};
    if(item.action==='moved'||item.action==='moved_to_incoming') return `${describePosition(before)} → ${describePosition(after)}`;
    if(item.action==='schedule_period_changed') return `${periodName(before.schedule_period)} → ${periodName(after.schedule_period)}`;
    if(item.action==='created') return after.start_date ? describePosition(after) : 'Added to Incoming Jobs';
    if(item.action==='deleted') return before.start_date ? `Was at ${describePosition(before)}` : 'Was in Incoming Jobs';
    if(item.action==='incoming_reordered') return 'Incoming Jobs order changed';
    if(item.action==='time_off_created'||item.action==='time_off_edited'||item.action==='time_off_deleted'){
      const data=item.action==='time_off_deleted'?before:after;
      const dates=data?.start_date ? (data.end_date&&data.end_date!==data.start_date?`${fmtDate(data.start_date)}–${fmtDate(data.end_date)}`:fmtDate(data.start_date)) : '';
      return dates || 'Time off updated';
    }
    if(item.action==='edited'){
      const labels={job_name:'job name',address:'address',miss_dig_number:'Miss Dig',job_number:'job #',notes:'notes',customer:'customer',customer_phone:'phone',job_type:'job type',permit_number:'permit',inspector:'inspector',priority:'priority',miss_dig_ready:'Miss Dig ready',miss_dig_expires:'Miss Dig expires'};
      const changed=Object.keys(labels).filter(k=>JSON.stringify(before[k]??null)!==JSON.stringify(after[k]??null)).map(k=>labels[k]);
      return changed.length ? `Changed: ${changed.slice(0,4).join(', ')}${changed.length>4?'…':''}` : 'Job details changed';
    }
    return '';
  }

  function hideToast(){
    document.querySelector('.undoMoveToast')?.remove();
    clearTimeout(toastTimer);
  }

  async function restorePosition(before,button){
    if(button) button.disabled=true;
    try{
      await request(`/rest/v1/jobs?id=eq.${before.id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({crew_id:before.crew_id,start_date:before.start_date,end_date:before.end_date})});
      window.location.reload();
    }catch(err){console.error('Undo move failed',err);if(button)button.disabled=false;}
  }

  function showToast(before){
    hideToast();
    const toast=document.createElement('div');
    toast.className='undoMoveToast';
    toast.innerHTML=`<span>${before.job_name||'Job'} moved</span><button type="button">Undo</button>`;
    toast.querySelector('button').onclick=()=>restorePosition(before,toast.querySelector('button'));
    document.body.appendChild(toast);
    toastTimer=setTimeout(hideToast,12000);
  }

  function closeActivity(){ document.querySelector('.activityBackdrop')?.remove(); }

  function cleanJobPayload(data){
    const allowed=['job_name','address','miss_dig_number','job_number','notes','customer','customer_phone','job_type','permit_number','inspector','priority','start_date','end_date','crew_id','miss_dig_ready','miss_dig_expires','incoming_sort_order','schedule_period'];
    return Object.fromEntries(allowed.filter(k=>Object.prototype.hasOwnProperty.call(data||{},k)).map(k=>[k,data[k]]));
  }

  async function restoreActivity(item,button){
    button.disabled=true;
    try{
      if(item.entity_type!=='job'||!item.before_data) throw new Error('This activity cannot be restored.');
      if(item.action==='deleted'){
        const payload={id:item.before_data.id,...cleanJobPayload(item.before_data)};
        await request('/rest/v1/jobs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(payload)});
      }else{
        await request(`/rest/v1/jobs?id=eq.${item.entity_id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(cleanJobPayload(item.before_data))});
      }
      window.location.reload();
    }catch(err){console.error('Activity restore failed',err);button.disabled=false;alert('Could not restore this activity.');}
  }

  async function loadCrews(){
    try{
      const rows=await request('/rest/v1/crews?select=id,name');
      crewNames=new Map((rows||[]).map(r=>[Number(r.id),r.name]));
    }catch{}
  }

  async function renderActivityBody(body){
    body.innerHTML='<div class="activityEmpty">Loading activity…</div>';
    try{
      await loadCrews();
      const items=await request('/rest/v1/activity_log?select=id,created_at,actor_email,entity_type,entity_id,action,summary,before_data,after_data&order=created_at.desc&limit=60');
      body.innerHTML='';
      if(!items?.length){body.innerHTML='<div class="activityEmpty">No activity recorded yet.</div>';return;}
      items.forEach(item=>{
        const row=document.createElement('div');
        row.className='activityItem';
        const who=item.actor_email ? item.actor_email.split('@')[0] : 'System';
        const canRestore=item.entity_type==='job'&&!!item.before_data&&item.action!=='created'&&item.action!=='incoming_reordered';
        row.innerHTML=`<div><strong>${item.summary||'Activity'}</strong><div class="activityMeta">${who} · ${fmtWhen(item.created_at)}</div><div class="activityDetail">${activityDetail(item)}</div></div>${canRestore?'<button class="activityRestore" type="button">Restore</button>':''}`;
        const restore=row.querySelector('.activityRestore');
        if(restore)restore.onclick=()=>restoreActivity(item,restore);
        body.appendChild(row);
      });
    }catch(err){
      console.error('Activity load failed',err);
      body.innerHTML='<div class="activityEmpty">Could not load activity.</div>';
    }
  }

  function openActivity(){
    closeActivity();
    const backdrop=document.createElement('div');
    backdrop.className='activityBackdrop';
    backdrop.innerHTML=`<div class="activityPanel"><div class="activityHead"><div><strong>Activity</strong><span>Recent schedule changes across devices</span></div><div class="activityHeadActions"><button class="activityRefresh" type="button">Refresh</button><button class="activityClose" type="button" aria-label="Close">×</button></div></div><div class="activityBody"></div></div>`;
    backdrop.querySelector('.activityClose').onclick=closeActivity;
    backdrop.querySelector('.activityRefresh').onclick=()=>renderActivityBody(backdrop.querySelector('.activityBody'));
    backdrop.onclick=e=>{if(e.target===backdrop)closeActivity()};
    document.body.appendChild(backdrop);
    renderActivityBody(backdrop.querySelector('.activityBody'));
  }

  function ensureActivityLink(){
    const footer=document.querySelector('footer');
    if(!footer||footer.querySelector('.activityHistoryLink'))return;
    const role=(document.querySelector('.roleBadge')?.textContent||'').trim().toLowerCase();
    if(role!=='supervisor')return;
    const old=footer.querySelector('.moveHistoryLink'); if(old)old.remove();
    const btn=document.createElement('button');
    btn.type='button';btn.className='activityHistoryLink';btn.textContent='Activity';btn.onclick=openActivity;
    footer.appendChild(btn);
  }

  document.addEventListener('dragstart',async e=>{
    const card=e.target.closest?.('.jobCard[data-job-id]');
    if(!card)return;
    const jobId=Number(card.dataset.jobId);
    try{const before=await snapshotJob(jobId);if(before)pending={jobId,before};}catch(err){console.error('Move snapshot failed',err);}
  },true);

  document.addEventListener('dragend',()=>{
    if(!pending)return;
    const current={...pending};pending=null;
    setTimeout(async()=>{
      try{const after=await snapshotJob(current.jobId);if(after&&!samePosition(current.before,after))showToast(current.before);}catch(err){console.error('Move verification failed',err);}
    },500);
  },true);

  const observer=new MutationObserver(()=>ensureActivityLink());
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  ensureActivityLink();
})();