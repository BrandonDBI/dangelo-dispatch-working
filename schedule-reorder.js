(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  let savedOrders = new Map();
  let saving = false;
  let activeSort = null;

  const style = document.createElement('style');
  style.textContent = `
    .dropCell .jobCard{position:relative}
    .dropCell .jobCard.scheduleSorting{opacity:.58;outline:2px dashed #64748b;outline-offset:2px;z-index:5}
    .scheduleDragGrip{float:right;width:30px;height:30px;min-height:30px;padding:0;margin:-2px -2px 4px 7px;border:1px solid #cbd5e1;border-radius:5px;background:#fff;color:#475569;font-size:19px;line-height:1;cursor:grab;touch-action:none;user-select:none;position:relative;z-index:10}
    .scheduleDragGrip:hover{background:#f1f5f9}
    .scheduleDragGrip:active{cursor:grabbing;background:#e2e8f0}
    .dropCell.scheduleSortSaving:after{content:'Saving order…';display:block;padding:3px 5px;color:#64748b;font-size:9px;font-weight:700}
    @media(max-width:700px){.scheduleDragGrip{width:38px;height:38px;min-height:38px;margin:-4px -4px 4px 8px;font-size:22px}}
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
    if(!cell || activeSort?.cell === cell) return;
    const cards = jobCards(cell);
    if(cards.length < 2) return;
    const sorted = [...cards].sort((a,b) => {
      const aOrder = savedOrders.get(Number(a.dataset.jobId));
      const bOrder = savedOrders.get(Number(b.dataset.jobId));
      if(aOrder == null && bOrder == null) return 0;
      if(aOrder == null) return 1;
      if(bOrder == null) return -1;
      return aOrder - bOrder;
    });
    if(!cards.some((card,i) => card !== sorted[i])) return;
    const anchor = cards[cards.length - 1].nextSibling;
    sorted.forEach(card => cell.insertBefore(card, anchor));
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
      grip.setAttribute('aria-label','Drag to reorder this job within the same day');
      grip.title = 'Drag to reorder within this cell';
      grip.textContent = '↕';
      card.insertBefore(grip, card.firstChild);

      grip.addEventListener('click', e => {
        e.preventDefault();
        e.stopPropagation();
      });
      grip.addEventListener('pointerdown', e => startSort(e, grip, card, cell));
    });
  }

  function startSort(e, grip, card, cell){
    if(!isSupervisor()) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const wasDraggable = card.draggable;
    card.draggable = false;
    card.setAttribute('draggable','false');
    card.classList.add('scheduleSorting');
    activeSort = { grip, card, cell, pointerId:e.pointerId, moved:false, wasDraggable };

    try { grip.setPointerCapture(e.pointerId); } catch {}
  }

  function moveSort(e){
    if(!activeSort || e.pointerId !== activeSort.pointerId) return;
    e.preventDefault();
    const {card,cell} = activeSort;
    const candidates = jobCards(cell).filter(x => x !== card);
    if(!candidates.length) return;

    let target = null;
    for(const candidate of candidates){
      const r = candidate.getBoundingClientRect();
      if(e.clientY >= r.top && e.clientY <= r.bottom){ target = candidate; break; }
    }

    if(target){
      const r = target.getBoundingClientRect();
      const before = e.clientY < r.top + r.height/2;
      const nextPosition = before ? target : target.nextSibling;
      if(nextPosition !== card && card.nextSibling !== nextPosition){
        cell.insertBefore(card,nextPosition);
        activeSort.moved = true;
      }
      return;
    }

    const first = candidates[0].getBoundingClientRect();
    const last = candidates[candidates.length-1].getBoundingClientRect();
    if(e.clientY < first.top){
      cell.insertBefore(card,candidates[0]);
      activeSort.moved = true;
    } else if(e.clientY > last.bottom){
      cell.insertBefore(card,candidates[candidates.length-1].nextSibling);
      activeSort.moved = true;
    }
  }

  async function finishSort(e){
    if(!activeSort || (e.pointerId != null && e.pointerId !== activeSort.pointerId)) return;
    const sort = activeSort;
    activeSort = null;
    sort.card.classList.remove('scheduleSorting');
    sort.card.draggable = sort.wasDraggable;
    sort.card.setAttribute('draggable', String(sort.wasDraggable));
    try { sort.grip.releasePointerCapture(sort.pointerId); } catch {}
    if(sort.moved) await saveCellOrder(sort.cell);
  }

  document.addEventListener('pointermove', moveSort, {capture:true, passive:false});
  document.addEventListener('pointerup', finishSort, true);
  document.addEventListener('pointercancel', finishSort, true);

  document.addEventListener('dragstart', e => {
    if(activeSort){
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);

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
    if(!BASE || !KEY || saving || activeSort) return;
    try {
      const jobs = await request('/rest/v1/jobs?select=id,incoming_sort_order&start_date=not.is.null');
      savedOrders = new Map((jobs || []).filter(j => j.incoming_sort_order != null).map(j => [Number(j.id),Number(j.incoming_sort_order)]));
      document.querySelectorAll('.dropCell[data-date]').forEach(enhanceCell);
    } catch(err){
      console.error('Schedule job order load failed',err);
    }
  }

  const observer = new MutationObserver(() => {
    if(activeSort) return;
    document.querySelectorAll('.dropCell[data-date]').forEach(enhanceCell);
  });
  observer.observe(document.getElementById('app') || document.body,{childList:true,subtree:true});

  loadSavedOrders();
  setInterval(() => { if(!document.hidden) loadSavedOrders(); },5000);
  window.addEventListener('focus',loadSavedOrders);
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) loadSavedOrders(); });
})();