(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  let jobs = [];
  let crews = new Map();
  let loaded = false;

  const style = document.createElement('style');
  style.textContent = `
    .jobSearchLink{border:0!important;background:transparent!important;color:#777!important;padding:2px 4px!important;font-size:11px!important;font-weight:600!important;cursor:pointer;opacity:.75;margin-left:8px}
    .jobSearchLink:hover{opacity:1;color:#231f20!important}
    .jobSearchBackdrop{position:fixed;inset:0;z-index:10020;background:rgba(0,0,0,.18);display:flex;align-items:flex-end;justify-content:flex-end;padding:18px}
    .jobSearchPanel{width:min(500px,calc(100vw - 24px));max-height:min(660px,82vh);overflow:hidden;background:#fff;border:1px solid #ddd;border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.22);display:flex;flex-direction:column}
    .jobSearchHead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;border-bottom:1px solid #eee}
    .jobSearchHead strong{font-size:14px}.jobSearchHead span{display:block;font-size:10px;color:#888;font-weight:500;margin-top:2px}.jobSearchClose{border:0;background:transparent;font-size:20px;cursor:pointer;color:#666;padding:5px}
    .jobSearchBox{padding:12px 14px;border-bottom:1px solid #eee}.jobSearchBox input{width:100%;box-sizing:border-box;border:1px solid #ccc;border-radius:7px;padding:10px 11px;font:inherit;font-size:13px;outline:none}.jobSearchBox input:focus{border-color:#777}
    .jobSearchBody{overflow:auto;padding:0 14px 10px}.jobSearchEmpty{font-size:12px;color:#777;padding:18px 2px}
    .jobSearchItem{width:100%;text-align:left;border:0;border-top:1px solid #eee;background:#fff;padding:11px 2px;cursor:pointer;color:#231f20}.jobSearchItem:first-child{border-top:0}.jobSearchItem:hover{background:#fafafa}
    .jobSearchItem strong{display:block;font-size:12px;margin-bottom:3px}.jobSearchMeta{font-size:10px;color:#888;margin-bottom:4px}.jobSearchDetail{font-size:11px;color:#666;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .jobSearchCount{font-size:10px;color:#999;padding:8px 2px 3px}
    @media(max-width:700px){.jobSearchBackdrop{padding:10px}.jobSearchPanel{width:100%;max-height:75vh}.jobSearchLink{font-size:10px!important;margin-left:4px}}
  `;
  document.head.appendChild(style);

  function session(){ try { return JSON.parse(localStorage.getItem('dangelo_session') || 'null'); } catch { return null; } }
  function headers(){ return {apikey:KEY,Authorization:`Bearer ${session()?.access_token || KEY}`,'Content-Type':'application/json'}; }
  async function request(path){
    const res=await fetch(`${BASE}${path}`,{headers:headers()});
    const text=await res.text();
    if(!res.ok) throw new Error(text || `Request failed (${res.status})`);
    return text ? JSON.parse(text) : null;
  }
  function esc(value){return String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));}
  function fmtDate(value){
    if(!value) return 'Incoming';
    const d=new Date(`${value}T00:00:00`);
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  }
  function mondayIso(value){
    const d=new Date(`${value}T00:00:00`);
    const day=d.getDay();
    d.setDate(d.getDate()-((day+6)%7));
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function addDaysIso(value,n){
    const d=new Date(`${value}T00:00:00`);d.setDate(d.getDate()+n);
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function currentWeekIso(){
    const cell=document.querySelector('.dropCell[data-date]');
    return cell?.dataset.date ? mondayIso(cell.dataset.date) : null;
  }
  function weeksBetween(a,b){
    const da=new Date(`${a}T00:00:00`),db=new Date(`${b}T00:00:00`);
    return Math.round((db-da)/604800000);
  }

  async function loadSearchData(force=false){
    if(loaded&&!force)return;
    const [jobRows,crewRows]=await Promise.all([
      request('/rest/v1/jobs?select=id,job_name,address,customer,notes,job_number,miss_dig_number,start_date,end_date,crew_id,schedule_period&order=created_at.desc'),
      request('/rest/v1/crews?select=id,name')
    ]);
    jobs=jobRows||[];
    crews=new Map((crewRows||[]).map(c=>[Number(c.id),c.name]));
    loaded=true;
  }

  function searchable(job){
    return [job.job_name,job.address,job.customer,job.notes,job.job_number,job.miss_dig_number,job.id].filter(v=>v!==null&&v!==undefined).join(' ').toLowerCase();
  }

  function renderResults(body,query){
    const q=query.trim().toLowerCase();
    if(!q){body.innerHTML='<div class="jobSearchEmpty">Type a job name, customer, address, job number, notes, or Miss Dig number.</div>';return;}
    const matches=jobs.filter(j=>searchable(j).includes(q)).slice(0,50);
    if(!matches.length){body.innerHTML='<div class="jobSearchEmpty">No matching jobs found.</div>';return;}
    body.innerHTML=`<div class="jobSearchCount">${matches.length}${matches.length===50?'+' : ''} result${matches.length===1?'':'s'}</div>`+matches.map(job=>{
      const crew=job.crew_id ? (crews.get(Number(job.crew_id))||`Crew #${job.crew_id}`) : 'Incoming Jobs';
      const when=job.start_date ? `${fmtDate(job.start_date)}${job.end_date&&job.end_date!==job.start_date?` – ${fmtDate(job.end_date)}`:''}` : 'Incoming';
      const detail=[job.address,job.customer,job.job_number?`Job # ${job.job_number}`:'',job.notes].filter(Boolean).join(' · ');
      return `<button type="button" class="jobSearchItem" data-job-id="${job.id}"><strong>${esc(job.job_name||`Job #${job.id}`)}</strong><div class="jobSearchMeta">${esc(crew)} · ${esc(when)}${job.schedule_period?` · ${esc(job.schedule_period)}`:''}</div>${detail?`<div class="jobSearchDetail">${esc(detail)}</div>`:''}</button>`;
    }).join('');
    body.querySelectorAll('.jobSearchItem').forEach(btn=>btn.onclick=()=>jumpToJob(Number(btn.dataset.jobId)));
  }

  function closeSearch(){document.querySelector('.jobSearchBackdrop')?.remove();}

  function findVisibleCard(jobId){return document.querySelector(`.jobCard[data-job-id="${jobId}"]`);}

  function jumpToJob(jobId){
    const job=jobs.find(j=>Number(j.id)===jobId);if(!job)return;
    document.getElementById('tabSchedule')?.click();
    closeSearch();

    if(!job.start_date){
      requestAnimationFrame(()=>{
        const card=findVisibleCard(jobId);
        if(card){card.scrollIntoView({behavior:'smooth',block:'center'});setTimeout(()=>card.click(),180);}
      });
      return;
    }

    const current=currentWeekIso();
    const target=mondayIso(job.start_date);
    if(current){
      const diff=weeksBetween(current,target);
      const button=document.getElementById(diff>=0?'next':'prev');
      for(let i=0;i<Math.abs(diff);i++)button?.click();
    }
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      const card=findVisibleCard(jobId);
      if(card){card.scrollIntoView({behavior:'smooth',block:'center',inline:'center'});setTimeout(()=>card.click(),180);}
    }));
  }

  async function openSearch(){
    closeSearch();
    const backdrop=document.createElement('div');
    backdrop.className='jobSearchBackdrop';
    backdrop.innerHTML=`<div class="jobSearchPanel"><div class="jobSearchHead"><div><strong>Search jobs</strong><span>Find past, current, future, or incoming jobs</span></div><button class="jobSearchClose" type="button" aria-label="Close">×</button></div><div class="jobSearchBox"><input type="search" placeholder="Search jobs…" autocomplete="off" spellcheck="false"></div><div class="jobSearchBody"><div class="jobSearchEmpty">Loading jobs…</div></div></div>`;
    const input=backdrop.querySelector('input');
    const body=backdrop.querySelector('.jobSearchBody');
    backdrop.querySelector('.jobSearchClose').onclick=closeSearch;
    backdrop.onclick=e=>{if(e.target===backdrop)closeSearch();};
    input.oninput=()=>renderResults(body,input.value);
    document.body.appendChild(backdrop);
    setTimeout(()=>input.focus(),0);
    try{await loadSearchData(true);renderResults(body,input.value);}catch(err){console.error('Job search load failed',err);body.innerHTML='<div class="jobSearchEmpty">Could not load jobs.</div>';}
  }

  function ensureSearchLink(){
    const footer=document.querySelector('footer');
    if(!footer||footer.querySelector('.jobSearchLink'))return;
    const activity=footer.querySelector('.activityHistoryLink');
    const btn=document.createElement('button');
    btn.type='button';btn.className='jobSearchLink';btn.textContent='Search';btn.onclick=openSearch;
    if(activity)activity.insertAdjacentElement('beforebegin',btn);else footer.appendChild(btn);
  }

  const observer=new MutationObserver(ensureSearchLink);
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  ensureSearchLink();
})();