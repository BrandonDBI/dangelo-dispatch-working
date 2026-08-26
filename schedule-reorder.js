(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  let savedOrders = new Map();
  let saving = false;

  const style = document.createElement('style');
  style.textContent = `
    .dropCell .jobCard{position:relative}
    .dropCell .jobCard.scheduleSorting{opacity:.52;outline:2px dashed #64748b;outline-offset:2px}
    .scheduleDragGrip{float:right;width:28px;height:28px;min-height:28px;padding:0;margin:-2px -2px 4px 7px;border:0;background:transparent;color:#64748b;font-size:19px;line-height:1;cursor:grab;touch-action:none;user-select:none}
    .scheduleDragGrip:active{cursor:grabbing}
    .dropCell.scheduleSortSaving:after{content:'Saving order…';display:block;padding:3px 5px;color:#64748b;font-size:9px;font-weight:700}
    @media(max-width:700px){.scheduleDragGrip{width:36px;height:36px;min-height:36px;margin:-4px -4px 4px 8px;font-size:22px}}
  `;
  document.head.appendChild(style);

  function isSupervisor(){
    return (document.querySelector('.roleBadge')?.textContent || '').trim().toLowerCase() === 'supervisor';
  }

  function authHeaders(){
    let session = null;
    try { session = JSON.parse(localStorage.getItem('dangelo_session') || 'null'); } catch {}
    return {
      apikey: KEY,
      Authorization: `Bearer ${session?.access_token || KEY}`,
      'Content-Type': 'application/json'
    };
  }

  async function request(path, options = {}){
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: { ...authHeaders(), ...(options.headers || {}) }
    });
    if(!res.ok){
      const text = await res.text();
      throw new Error(text || `Request failed (${res.status})`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  function jobCards(cell){
    return [...cell.children].filter(el => el.classList?.contains('jobCard'));
  }

  function applySavedOrder(cell){
    if(!cell || cell.querySelector('.scheduleSorting')) return;
    const cards = jobCards(cell);
    if(cards.length < 2) return;
    const sorted = [...cards].sort((a,b) => {
      const aId = Number(a.dataset.jobId), bId = Number(b.dataset.jobId);
      const aOrder = savedOrders.get(aId), bOrder = savedOrders.get(bId);
      if(aOrder == null && bOrder == null) return 0;
      if(aOrder == null) return 1;
      if(bOrder == null) return -1;
      return aOrder - bOrder;
    });
    const changed = cards.some((card,i) => card !== sorted[i]);
    if(!changed) return;
    const firstNonJob = [...cell.children].find(el => !el.classList?.contains('jobCard')) || null;
    sorted.forEach(card => cell.insertBefore(card, firstNonJob));
  }

  function enhanceCell(cell){
    if(!cell) return;
    applySavedOrder(cell);
    if(!isSupervisor()) return;
    jobCards(cell).forEach(card => {
      if(card.querySelector('.scheduleDragGrip')) return;
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'scheduleDragGrip';
      grip.setAttribute('aria-label','Drag to reorder job within this day');
      grip.title = 'Drag to reorder within this day';
      grip.textContent = '⠿';
      card.insertBefore(grip, card.firstChild);
      bindPointerReorder(grip, card, cell);
    });
  }

  function bindPointerReorder(grip, card, cell){
    let active = false;
    let moved = false;

    grip.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
    });

    grip.addEventListener('pointerdown', e => {
      if(!isSupervisor()) return;
      active = true;
      moved = false;
      e.preventDefault();
      e.stopPropagation();
      card.classList.add('scheduleSorting');
      grip.setPointerCapture(e.pointerId);
    });

    grip.addEventListener('pointermove', e => {
      if(!active) return;
      e.preventDefault();
      const target = document.elementFromPoint(e.clientX,e.clientY)?.closest('.dropCell .jobCard');
      if(!target || target === card || target.parentElement !== cell) return;
      const rect = target.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      cell.insertBefore(card, before ? target : target.nextSibling);
      moved = true;
    });

    const finish = async e => {
      if(!active) return;
      active = false;
      card.classList.remove('scheduleSorting');
      try { grip.releasePointerCapture(e.pointerId); } catch {}
      if(moved) await saveCellOrder(cell);
    };

    grip.addEventListener('pointerup', finish);
    grip.addEventListener('pointercancel', finish);
  }

  async function saveCellOrder(cell){
    if(!isSupervisor() || saving) return;
    const ids = jobCards(cell).map(card => Number(card.dataset.jobId));
    if(ids.length < 2) return;
    saving = true;
    cell.classList.add('scheduleSortSaving');
    ids.forEach((id,index) => savedOrders.set(id,index+1));
    try {
      await Promise.all(ids.map((id,index) => request(`/rest/v1/jobs?id=eq.${id}`, {
        method:'PATCH',
        headers:{Prefer:'return=minimal'},
        body:JSON.stringify({incoming_sort_order:index+1})
      })));
    } catch(err){
      console.error('Schedule job order save failed',err);
    } finally {
      saving = false;
      cell.classList.remove('scheduleSortSaving');
    }
  }

  async function loadSavedOrders(){
    if(!BASE || !KEY || saving) return;
    try {
      const jobs = await request('/rest/v1/jobs?select=id,incoming_sort_order&start_date=not.is.null');
      savedOrders = new Map((jobs || []).filter(j => j.incoming_sort_order != null).map(j => [Number(j.id),Number(j.incoming_sort_order)]));
      document.querySelectorAll('.dropCell[data-date]').forEach(enhanceCell);
    } catch(err){
      console.error('Schedule job order load failed',err);
    }
  }

  const observer = new MutationObserver(() => {
    document.querySelectorAll('.dropCell[data-date]').forEach(enhanceCell);
  });
  observer.observe(document.getElementById('app') || document.body,{childList:true,subtree:true});

  loadSavedOrders();
  setInterval(() => { if(!document.hidden) loadSavedOrders(); },5000);
  window.addEventListener('focus',loadSavedOrders);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) loadSavedOrders(); });
})();