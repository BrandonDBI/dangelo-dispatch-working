(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  const periods = new Map();
  let loadTimer = null;

  function authHeaders(){
    let session = null;
    try { session = JSON.parse(localStorage.getItem('dangelo_session') || 'null'); } catch {}
    return {
      apikey: KEY,
      Authorization: `Bearer ${session?.access_token || KEY}`,
      'Content-Type': 'application/json'
    };
  }

  async function request(path, options={}){
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: {...authHeaders(), ...(options.headers || {})}
    });
    if(!res.ok) throw new Error(await res.text() || `Request failed (${res.status})`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function sortCell(cell){
    const cards = [...cell.children].filter(el => el.classList?.contains('jobCard'));
    if(cards.length < 2) return;

    const ranked = cards.map((card,index) => {
      const period = periods.get(Number(card.dataset.jobId)) || null;
      const rank = period === 'AM' ? 0 : period === 'PM' ? 2 : 1;
      return {card,index,rank};
    }).sort((a,b) => a.rank - b.rank || a.index - b.index);

    const anchor = cards[cards.length - 1].nextSibling;
    ranked.forEach(item => cell.insertBefore(item.card, anchor));
  }

  function sortBoard(){
    document.querySelectorAll('.dropCell[data-date]').forEach(sortCell);
  }

  async function loadPeriods(){
    if(!BASE || !KEY) return;
    try {
      const rows = await request('/rest/v1/jobs?select=id,schedule_period');
      periods.clear();
      (rows || []).forEach(row => periods.set(Number(row.id), row.schedule_period || null));
      sortBoard();
      enhanceModal();
    } catch(err){
      console.error('AM/PM load failed', err);
    }
  }

  function enhanceModal(){
    const modal = document.querySelector('.modal');
    const save = document.getElementById('saveJob');
    if(!modal || !save || document.getElementById('f_schedule_period')) return;

    const title = modal.querySelector('.modalTitle h2')?.textContent || '';
    if(title !== 'Edit job') return;

    const backdrop = document.getElementById('backdrop');
    const sourceCardId = Number(document.querySelector('.jobCard:hover')?.dataset.jobId) || null;
    let jobId = sourceCardId;

    if(!jobId){
      const name = document.getElementById('f_job_name')?.value || '';
      const matching = [...document.querySelectorAll('.jobCard')].find(card => card.querySelector('h3')?.textContent === name.toUpperCase());
      if(matching) jobId = Number(matching.dataset.jobId);
    }
    if(!jobId) return;

    const crewRow = document.getElementById('f_crew_id')?.closest('.three');
    if(!crewRow) return;

    const label = document.createElement('label');
    label.className = 'halfDayField';
    label.innerHTML = `Schedule period<select id="f_schedule_period"><option value="__NO_CHANGE__">No change</option><option value="ALL_DAY">All Day</option><option value="AM">AM</option><option value="PM">PM</option></select>`;
    crewRow.insertAdjacentElement('afterend', label);

    const select = document.getElementById('f_schedule_period');
    const existing = periods.get(jobId);
    select.value = existing === 'AM' || existing === 'PM' ? existing : '__NO_CHANGE__';

    save.addEventListener('click', async e => {
      const choice = select.value;
      if(choice === '__NO_CHANGE__') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      save.disabled = true;
      try {
        const next = choice === 'ALL_DAY' ? null : choice;
        await request(`/rest/v1/jobs?id=eq.${jobId}`, {
          method:'PATCH',
          headers:{Prefer:'return=minimal'},
          body:JSON.stringify({schedule_period:next})
        });
        periods.set(jobId,next);
        const originalSave = save.cloneNode(true);
        save.replaceWith(originalSave);
        originalSave.click();
      } catch(err){
        save.disabled = false;
        const box = document.getElementById('modalMessage');
        if(box) box.innerHTML = `<div class="message">Could not save AM/PM setting.</div>`;
        console.error('AM/PM save failed',err);
      }
    }, true);

    if(backdrop) backdrop.dataset.halfDayJobId = String(jobId);
  }

  const observer = new MutationObserver(() => {
    clearTimeout(loadTimer);
    loadTimer = setTimeout(() => {
      sortBoard();
      enhanceModal();
    },60);
  });
  observer.observe(document.getElementById('app') || document.body,{childList:true,subtree:true});

  loadPeriods();
  setInterval(() => { if(!document.hidden) loadPeriods(); },5000);
  window.addEventListener('focus',loadPeriods);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) loadPeriods(); });
})();