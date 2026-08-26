(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  const app = document.getElementById('app');

  const state = {
    session: JSON.parse(localStorage.getItem('dangelo_session') || 'null'),
    role: 'viewer', crews: [], jobs: [], weekStart: mondayOf(new Date()), showWeekend: false,
    draft: null, poller: null, message: '', dataSignature: ''
  };

  function configured() {
    return BASE.startsWith('https://') && BASE.includes('.supabase.co') && KEY.length > 20 && !KEY.includes('PASTE_');
  }
  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }
  function mondayOf(d) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() - ((day + 6) % 7)); x.setHours(0,0,0,0); return x; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function iso(d){ return d.toISOString().slice(0,10); }
  function parseDate(s){ return new Date(`${s}T00:00:00`); }
  function fmtShort(d){ return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}); }
  function fmtCardDate(s){ return s ? parseDate(s).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'}) : ''; }
  function fmtHead(d){ return { day:d.toLocaleDateString('en-US',{weekday:'short'}).toUpperCase(), date:fmtShort(d) }; }
  function authHeaders(){ return { apikey:KEY, Authorization:`Bearer ${state.session?.access_token || KEY}`, 'Content-Type':'application/json' }; }

  async function request(path, options={}) {
    const res = await fetch(`${BASE}${path}`, { ...options, headers:{...authHeaders(), ...(options.headers||{})} });
    const text = await res.text();
    let body = null; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) throw new Error(body?.message || body?.error_description || body?.error || body || `Request failed (${res.status})`);
    return body;
  }

  async function login(email,password,signup=false){
    email = String(email || '').trim();
    const endpoint = signup ? '/auth/v1/signup' : '/auth/v1/token?grant_type=password';
    const data = await request(endpoint,{method:'POST',body:JSON.stringify({email,password})});
    if (signup && !data.access_token) return {needsConfirmation:true};
    localStorage.setItem('dangelo_last_email',email);
    state.session = data; localStorage.setItem('dangelo_session',JSON.stringify(data));
    await loadRole(); await loadData(); render(); startPolling(); return {};
  }
  async function logout(){ localStorage.removeItem('dangelo_session'); state.session=null; state.role='viewer'; stopPolling(); render(); }
  async function loadRole(){
    const rows = await request(`/rest/v1/profiles?id=eq.${encodeURIComponent(state.session.user.id)}&select=role`);
    state.role = rows?.[0]?.role || 'viewer';
  }
  async function loadData(){
    const [crews,jobs] = await Promise.all([
      request('/rest/v1/crews?select=*&order=sort_order.asc'),
      request('/rest/v1/jobs?select=*&order=created_at.asc')
    ]);
    const nextCrews=crews||[]; const nextJobs=jobs||[];
    const nextSignature=JSON.stringify([nextCrews,nextJobs]);
    const changed=nextSignature!==state.dataSignature;
    state.dataSignature=nextSignature;
    state.crews=nextCrews; state.jobs=nextJobs; state.message='';
    return changed;
  }
  function startPolling(){ stopPolling(); state.poller=setInterval(async()=>{ if(!state.draft){ try{const changed=await loadData();if(changed)renderBoardOnly();}catch(e){state.message=e.message;renderBoardOnly();} } },3000); }
  function stopPolling(){ if(state.poller) clearInterval(state.poller); state.poller=null; }

  function render(){
    if(!configured()) return renderConfigHelp();
    if(!state.session) return renderLogin();
    app.innerHTML = shellHtml(); bindShell(); renderBoardOnly();
  }
  function renderConfigHelp(){
    app.innerHTML=`<main class="loginPage"><div class="loginCard"><div class="logo">D</div><h1>Configuration needed</h1><p>Open <b>config.js</b> in GitHub and paste your Supabase Project URL and publishable/anon key.</p><div class="message">This app intentionally uses no Vercel environment variables and no secret service-role key.</div></div></main>`;
  }
  function renderLogin(){
    const rememberedEmail = localStorage.getItem('dangelo_last_email') || '';
    app.innerHTML=`<main class="loginPage"><form id="loginForm" class="loginCard"><div class="logo">D</div><h1>D’Angelo Schedule</h1><p>Crew-first dispatch board</p><label>Email<input id="email" type="email" value="${esc(rememberedEmail)}" autocomplete="username" required></label><label>Password<input id="password" type="password" minlength="6" autocomplete="current-password" required></label><div id="loginMessage"></div><button class="primary wide" type="submit">Sign in</button><button class="linkButton" id="signupButton" type="button">Create first account</button></form></main>`;
    document.getElementById('loginForm').onsubmit=async e=>{e.preventDefault();await doAuth(false)};
    document.getElementById('signupButton').onclick=async()=>doAuth(true);
    async function doAuth(signup){
      const box=document.getElementById('loginMessage'); box.innerHTML='';
      try{ const result=await login(document.getElementById('email').value,document.getElementById('password').value,signup); if(result.needsConfirmation) box.innerHTML='<div class="message">Account created. Check your email if confirmation is enabled, then sign in.</div>'; }
      catch(err){ box.innerHTML=`<div class="message">${esc(err.message)}</div>`; }
    }
  }
  function shellHtml(){
    const end=addDays(state.weekStart,6);
    return `<main><header class="topbar"><div><h1>D’Angelo Schedule</h1><p>Crew-first dispatch board</p></div><div class="actions"><span class="liveBadge">● Live</span><span class="roleBadge">${esc(state.role)}</span><button id="signout">Sign out</button></div></header><section class="toolbar"><div class="actions"><button id="prev">‹</button><button id="today">Today</button><button id="next">›</button><strong>${fmtShort(state.weekStart)} – ${fmtShort(end)}, ${end.getFullYear()}</strong></div><div class="actions"><button id="weekend">${state.showWeekend?'Hide Weekend':'Show Weekend'}</button>${state.role==='supervisor'?'<button class="primary" id="newIncoming">+ New incoming job</button>':''}</div></section><div id="message"></div><div id="board"></div><div id="modalRoot"></div></main>`;
  }
  function updateWeekRange(){
    const range=document.querySelector('.toolbar>.actions:first-child strong');
    if(!range)return;
    const end=addDays(state.weekStart,6);
    range.textContent=`${fmtShort(state.weekStart)} – ${fmtShort(end)}, ${end.getFullYear()}`;
  }
  function changeWeek(days){
    state.weekStart=addDays(state.weekStart,days);
    updateWeekRange();
    renderBoardOnly();
  }
  function bindShell(){
    document.getElementById('signout').onclick=logout;
    document.getElementById('prev').onclick=()=>changeWeek(-7);
    document.getElementById('next').onclick=()=>changeWeek(7);
    document.getElementById('today').onclick=()=>{state.weekStart=mondayOf(new Date());updateWeekRange();renderBoardOnly()};
    document.getElementById('weekend').onclick=()=>{state.showWeekend=!state.showWeekend;render()};
    const ni=document.getElementById('newIncoming'); if(ni) ni.onclick=()=>openModal(blankDraft());
  }
  function renderBoardOnly(){
    const board=document.getElementById('board'); if(!board)return;
    const previousScroller=board.querySelector('.scroller');
    const previousScrollLeft=previousScroller?.scrollLeft||0;
    const previousScrollTop=previousScroller?.scrollTop||0;
    const msg=document.getElementById('message'); if(msg) msg.innerHTML=state.message?`<div class="message">${esc(state.message)}</div>`:'';
    const days=Array.from({length:state.showWeekend?7:5},(_,i)=>addDays(state.weekStart,i));
    const incoming=state.jobs.filter(j=>!j.start_date);
    let html=`<section class="dispatchLayout"><aside class="incoming" id="incomingDrop"><div class="incomingHead"><div><strong>Incoming Jobs</strong><span>Drag into any crew/day cell</span></div>${state.role==='supervisor'?'<button id="incomingAdd">+</button>':''}</div><div class="incomingBody">${incoming.length?incoming.map(jobCardHtml).join(''):'<p class="empty">No incoming jobs.</p>'}</div></aside><div class="scroller"><div class="matrix" style="grid-template-columns:145px repeat(${days.length},minmax(190px,1fr))"><div class="corner">CREW</div>${days.map(d=>{const h=fmtHead(d);return `<div class="dayHead"><strong>${h.day}</strong><span>${h.date}</span></div>`}).join('')}`;
    state.crews.forEach((crew,index)=>{
      html+=`<div class="crewName ${index%2?'red':'gray'}"><strong>${esc(crew.name).toUpperCase()}</strong><span>CREW</span></div>`;
      days.forEach(day=>{
        const date=iso(day); const jobs=state.jobs.filter(j=>j.crew_id===crew.id&&occurs(j,date));
        html+=`<div class="cell dropCell" data-crew="${crew.id}" data-date="${date}">${jobs.map(jobCardHtml).join('')}${state.role==='supervisor'?`<button class="addCell" data-add-crew="${crew.id}" data-add-date="${date}">+</button>`:''}</div>`;
      });
    });
    html+=`</div></div></section><footer><span class="legend emergency">Emergency</span><span class="legend pressing">Pressing</span><span class="legend non">Non-Emergency</span><span class="dragHint">Drag jobs to move between days or crews</span></footer>`;
    board.innerHTML=html; bindBoard();
    const nextScroller=board.querySelector('.scroller');
    if(nextScroller){nextScroller.scrollLeft=previousScrollLeft;nextScroller.scrollTop=previousScrollTop;}
  }
  function occurs(job,date){ return job.start_date&&job.end_date&&date>=job.start_date&&date<=job.end_date; }
  function jobCardHtml(job){
    const missDigDates=(job.miss_dig_ready||job.miss_dig_expires)?`<p class="missDigDates">${job.miss_dig_ready?`Ready: ${esc(fmtCardDate(job.miss_dig_ready))}`:''}${job.miss_dig_ready&&job.miss_dig_expires?' · ':''}${job.miss_dig_expires?`Expires: ${esc(fmtCardDate(job.miss_dig_expires))}`:''}</p>`:'';
    return `<article class="jobCard ${job.priority}" draggable="${state.role==='supervisor'}" data-job-id="${job.id}"><h3>${esc(job.job_name)}</h3>${job.address?`<p>${esc(job.address)}</p>`:''}${job.miss_dig_number?`<p>Miss Dig: ${esc(job.miss_dig_number)}</p>${missDigDates}`:''}${!job.miss_dig_number?missDigDates:''}${job.job_number?`<p>D’Angelo Job #: ${esc(job.job_number)}</p>`:''}${job.notes?`<p class="notes">${esc(job.notes)}</p>`:''}</article>`;
  }
  function bindBoard(){
    document.querySelectorAll('.jobCard').forEach(el=>{
      el.onclick=()=>openModal({...state.jobs.find(j=>j.id===Number(el.dataset.jobId))});
      el.ondragstart=e=>{ if(state.role==='supervisor') e.dataTransfer.setData('job-id',el.dataset.jobId); };
    });
    document.querySelectorAll('.dropCell').forEach(cell=>{cell.ondragover=e=>{if(state.role==='supervisor')e.preventDefault()};cell.ondrop=async e=>{e.preventDefault();const job=state.jobs.find(j=>j.id===Number(e.dataTransfer.getData('job-id')));if(job)await moveJob(job,Number(cell.dataset.crew),cell.dataset.date)}});
    const incoming=document.getElementById('incomingDrop'); incoming.ondragover=e=>{if(state.role==='supervisor')e.preventDefault()};incoming.ondrop=async e=>{e.preventDefault();const job=state.jobs.find(j=>j.id===Number(e.dataTransfer.getData('job-id')));if(job)await updateJob(job.id,{crew_id:null,start_date:null,end_date:null})};
    const ia=document.getElementById('incomingAdd'); if(ia)ia.onclick=()=>openModal(blankDraft());
    document.querySelectorAll('[data-add-crew]').forEach(btn=>btn.onclick=()=>openModal({...blankDraft(),crew_id:Number(btn.dataset.addCrew),start_date:btn.dataset.addDate,end_date:btn.dataset.addDate}));
  }
  function blankDraft(){ return {job_name:'',address:'',miss_dig_number:'',miss_dig_ready:null,miss_dig_expires:null,job_number:'',notes:'',customer:'',customer_phone:'',job_type:'',permit_number:'',inspector:'',priority:'non_emergency',start_date:null,end_date:null,crew_id:null}; }
  async function moveJob(job,crewId,date){ const duration=job.start_date&&job.end_date?Math.round((parseDate(job.end_date)-parseDate(job.start_date))/86400000):0; await updateJob(job.id,{crew_id:crewId,start_date:date,end_date:iso(addDays(parseDate(date),duration))}); }
  async function updateJob(id,patch){ try{await request(`/rest/v1/jobs?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(patch)});await loadData();renderBoardOnly()}catch(e){state.message=e.message;renderBoardOnly()} }

  function openModal(draft){ state.draft=draft; const root=document.getElementById('modalRoot'); const canEdit=state.role==='supervisor';
    root.innerHTML=`<div class="backdrop" id="backdrop"><div class="modal"><div class="modalTitle"><div><h2>${draft.id?'Edit job':draft.start_date?'Add scheduled job':'Add incoming job'}</h2><p>Leave both dates blank to keep the job in Incoming.</p></div><button id="closeModal">×</button></div><div class="two"><label>Job name<input id="f_job_name" value="${esc(draft.job_name)}"></label><label>Address<input id="f_address" value="${esc(draft.address)}"></label></div><div class="two"><label>Miss Dig number<input id="f_miss_dig_number" value="${esc(draft.miss_dig_number)}"></label><label>D’Angelo Job #<input id="f_job_number" value="${esc(draft.job_number)}"></label></div><div class="two"><label>Miss Dig Ready<input id="f_miss_dig_ready" type="date" value="${draft.miss_dig_ready||''}"></label><label>Miss Dig Expires<input id="f_miss_dig_expires" type="date" value="${draft.miss_dig_expires||''}"></label></div><div class="two"><label>Customer<input id="f_customer" value="${esc(draft.customer)}"></label><label>Customer phone<input id="f_customer_phone" value="${esc(draft.customer_phone)}"></label></div><div class="two"><label>Job type<input id="f_job_type" value="${esc(draft.job_type)}"></label><label>Permit number<input id="f_permit_number" value="${esc(draft.permit_number)}"></label></div><div class="two"><label>Inspector<input id="f_inspector" value="${esc(draft.inspector)}"></label><label>Priority<select id="f_priority"><option value="emergency">Emergency</option><option value="pressing">Pressing</option><option value="non_emergency">Non-Emergency</option></select></label></div><div class="three"><label>Start date<input id="f_start_date" type="date" value="${draft.start_date||''}"></label><label>End date<input id="f_end_date" type="date" value="${draft.end_date||''}"></label><label>Crew<select id="f_crew_id"><option value="">Incoming / no crew</option>${state.crews.map(c=>`<option value="${c.id}" ${draft.crew_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label></div><label>Notes<textarea id="f_notes" rows="5">${esc(draft.notes)}</textarea></label><div id="modalMessage"></div><div class="modalActions">${canEdit&&draft.id?'<button class="danger" id="deleteJob">Delete</button><button id="duplicateJob">Duplicate</button>':''}<span></span><button id="cancelModal">Cancel</button>${canEdit?'<button class="primary" id="saveJob">Save job</button>':''}</div></div></div>`;
    document.getElementById('f_priority').value=draft.priority||'non_emergency';
    if(!canEdit) root.querySelectorAll('input,textarea,select').forEach(x=>x.disabled=true);
    const close=()=>{state.draft=null;root.innerHTML=''}; document.getElementById('closeModal').onclick=close; document.getElementById('cancelModal').onclick=close; document.getElementById('backdrop').onclick=e=>{if(e.target.id==='backdrop')close()};
    if(canEdit){
      document.getElementById('saveJob').onclick=saveModal;
      if(draft.id){document.getElementById('deleteJob').onclick=async()=>{if(confirm('Delete this job?')){await request(`/rest/v1/jobs?id=eq.${draft.id}`,{method:'DELETE'});close();await loadData();renderBoardOnly()}};document.getElementById('duplicateJob').onclick=()=>{const copy={...collectModal()};delete copy.id;openModal(copy)}}
    }
    function collectModal(){ const val=id=>document.getElementById(id).value; return {...draft,job_name:val('f_job_name').trim(),address:val('f_address').trim()||null,miss_dig_number:val('f_miss_dig_number').trim()||null,miss_dig_ready:val('f_miss_dig_ready')||null,miss_dig_expires:val('f_miss_dig_expires')||null,job_number:val('f_job_number').trim()||null,customer:val('f_customer').trim()||null,customer_phone:val('f_customer_phone').trim()||null,job_type:val('f_job_type').trim()||null,permit_number:val('f_permit_number').trim()||null,inspector:val('f_inspector').trim()||null,priority:val('f_priority'),start_date:val('f_start_date')||null,end_date:val('f_end_date')||null,crew_id:val('f_crew_id')?Number(val('f_crew_id')):null,notes:val('f_notes').trim()||null}; }
    async function saveModal(){ const data=collectModal(); const box=document.getElementById('modalMessage'); if(!data.job_name)return box.innerHTML='<div class="message">Enter a job name.</div>';if((data.start_date&&!data.end_date)||(!data.start_date&&data.end_date))return box.innerHTML='<div class="message">Use both dates or leave both blank.</div>';if(data.start_date&&data.end_date<data.start_date)return box.innerHTML='<div class="message">End date cannot be before start date.</div>';if(data.miss_dig_ready&&data.miss_dig_expires&&data.miss_dig_expires<data.miss_dig_ready)return box.innerHTML='<div class="message">Miss Dig expiration cannot be before the ready date.</div>';try{if(data.id){const id=data.id;delete data.id;await request(`/rest/v1/jobs?id=eq.${id}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(data)})}else{delete data.id;await request('/rest/v1/jobs',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify(data)})}close();await loadData();renderBoardOnly()}catch(e){box.innerHTML=`<div class="message">${esc(e.message)}</div>`}}
  }

  async function boot(){
    if(state.session?.access_token){ try{await loadRole();await loadData();startPolling()}catch{localStorage.removeItem('dangelo_session');state.session=null} }
    render();
  }
  boot();
})();