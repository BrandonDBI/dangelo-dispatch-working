(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  let draggedIncomingId = null;
  let syncTimer = null;
  let syncing = false;

  const style = document.createElement('style');
  style.textContent = `
    .incomingBody .jobCard{position:relative}
    .incomingBody .jobCard.incomingDragging{opacity:.52;outline:2px dashed #64748b;outline-offset:2px}
    .incomingDragGrip{float:right;width:30px;height:30px;min-height:30px;padding:0;margin:-2px -2px 4px 7px;border:0;background:transparent;color:#64748b;font-size:20px;line-height:1;cursor:grab;touch-action:none;user-select:none}
    .incomingDragGrip:active{cursor:grabbing}
    .incomingSortSaving:after{content:'Saving order…';display:block;padding:4px 7px 8px;color:#64748b;font-size:10px;font-weight:700}
    @media(max-width:700px){
      .incomingDragGrip{width:38px;height:38px;min-height:38px;margin:-4px -4px 4px 8px;font-size:23px}
    }
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

  function scheduleSync(){
    clearTimeout(syncTimer);
    syncTimer = setTimeout(syncIncomingOrder, 120);
  }

  async function syncIncomingOrder(){
    if(syncing || !document.querySelector('.incomingBody') || !BASE || !KEY) return;
    syncing = true;
    try {
      const jobs = await request('/rest/v1/jobs?select=id,incoming_sort_order,created_at&start_date=is.null&order=incoming_sort_order.asc.nullslast,created_at.asc,id.asc');
      const body = document.querySelector('.incomingBody');
      if(!body) return;
      const currentCards = [...body.querySelectorAll('.jobCard')];
      const currentIds = currentCards.map(card => Number(card.dataset.jobId));
      const desiredIds = (jobs || []).map(job => Number(job.id)).filter(id => currentIds.includes(id));
      const orderChanged = currentIds.length === desiredIds.length && currentIds.some((id, index) => id !== desiredIds[index]);
      if(orderChanged){
        const cards = new Map(currentCards.map(card => [Number(card.dataset.jobId), card]));
        desiredIds.forEach(id => {
          const card = cards.get(id);
          if(card) body.appendChild(card);
        });
      }
      enhanceIncomingCards(body);
    } catch(err) {
      console.error('Incoming job order sync failed', err);
    } finally {
      syncing = false;
    }
  }

  function enhanceIncomingCards(body){
    if(!isSupervisor()) return;
    body.querySelectorAll('.jobCard').forEach(card => {
      if(card.querySelector('.incomingDragGrip')) return;
      const grip = document.createElement('button');
      grip.type = 'button';
      grip.className = 'incomingDragGrip';
      grip.setAttribute('aria-label', 'Drag to reorder incoming job');
      grip.title = 'Drag to reorder';
      grip.textContent = '⠿';
      card.insertBefore(grip, card.firstChild);
      bindPointerReorder(grip, card, body);
    });
  }

  function bindPointerReorder(grip, card, body){
    let active = false;
    let moved = false;
    const finish = async e => {
      if(!active) return;
      active = false;
      card.classList.remove('incomingDragging');
      try { grip.releasePointerCapture(e.pointerId); } catch {}
      if(moved) await saveDomOrder(body);
    };

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
      card.classList.add('incomingDragging');
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointermove', e => {
      if(!active) return;
      e.preventDefault();
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.incomingBody .jobCard');
      if(!under || under === card || under.parentElement !== body) return;
      const rect = under.getBoundingClientRect();
      const before = e.clientY < rect.top + rect.height / 2;
      body.insertBefore(card, before ? under : under.nextSibling);
      moved = true;
    });
    grip.addEventListener('pointerup', finish);
    grip.addEventListener('pointercancel', finish);
  }

  async function saveDomOrder(body){
    if(!isSupervisor()) return;
    const ids = [...body.querySelectorAll('.jobCard')].map(card => Number(card.dataset.jobId));
    if(!ids.length) return;
    body.classList.add('incomingSortSaving');
    try {
      await Promise.all(ids.map((id, index) => request(`/rest/v1/jobs?id=eq.${id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ incoming_sort_order: index + 1 })
      })));
    } catch(err) {
      console.error('Incoming job order save failed', err);
      scheduleSync();
    } finally {
      body.classList.remove('incomingSortSaving');
    }
  }

  document.addEventListener('dragstart', e => {
    if(!isSupervisor()) return;
    const card = e.target.closest?.('.jobCard');
    const body = card?.closest('.incomingBody');
    draggedIncomingId = body ? Number(card.dataset.jobId) : null;
    if(draggedIncomingId) card.classList.add('incomingDragging');
  }, true);

  document.addEventListener('dragover', e => {
    if(!draggedIncomingId || !isSupervisor()) return;
    const body = e.target.closest?.('.incomingBody');
    if(!body) return;
    e.preventDefault();
    e.stopPropagation();
    const dragged = body.querySelector(`.jobCard[data-job-id="${draggedIncomingId}"]`);
    const target = e.target.closest('.jobCard');
    if(!dragged || !target || target === dragged || target.parentElement !== body) return;
    const rect = target.getBoundingClientRect();
    body.insertBefore(dragged, e.clientY < rect.top + rect.height / 2 ? target : target.nextSibling);
  }, true);

  document.addEventListener('drop', async e => {
    if(!draggedIncomingId || !isSupervisor()) return;
    const body = e.target.closest?.('.incomingBody');
    if(!body) return;
    e.preventDefault();
    e.stopPropagation();
    await saveDomOrder(body);
    body.querySelectorAll('.incomingDragging').forEach(x => x.classList.remove('incomingDragging'));
    draggedIncomingId = null;
  }, true);

  document.addEventListener('dragend', () => {
    document.querySelectorAll('.incomingDragging').forEach(x => x.classList.remove('incomingDragging'));
    draggedIncomingId = null;
  }, true);

  const observer = new MutationObserver(() => {
    const body = document.querySelector('.incomingBody');
    if(body) enhanceIncomingCards(body);
    scheduleSync();
  });
  observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
  scheduleSync();
})();
