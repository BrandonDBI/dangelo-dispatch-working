(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  let copiedJob = null;
  let menu = null;
  let guardUntil = 0;

  function isSupervisor() {
    return document.querySelector('.roleBadge')?.textContent?.trim().toLowerCase() === 'supervisor';
  }

  function session() {
    try { return JSON.parse(localStorage.getItem('dangelo_session') || 'null'); } catch { return null; }
  }

  function headers(extra = {}) {
    return {
      apikey: KEY,
      Authorization: `Bearer ${session()?.access_token || KEY}`,
      'Content-Type': 'application/json',
      ...extra
    };
  }

  async function request(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
      ...options,
      headers: headers(options.headers || {})
    });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) throw new Error(body?.message || body?.error || body || `Request failed (${res.status})`);
    return body;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  function fmtCardDate(s) {
    return s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-US',{month:'numeric',day:'numeric',year:'2-digit'}) : '';
  }

  function closeMenu() {
    if (menu) menu.remove();
    menu = null;
  }

  function showToast(message) {
    let toast = document.getElementById('jobCopyPasteToast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'jobCopyPasteToast';
      Object.assign(toast.style, {
        position: 'fixed', right: '18px', bottom: '18px', zIndex: '10001',
        background: '#231f20', color: '#fff', padding: '10px 14px',
        borderRadius: '8px', boxShadow: '0 6px 24px rgba(0,0,0,.22)',
        fontSize: '14px', fontWeight: '700', pointerEvents: 'none', opacity: '0',
        transition: 'opacity .15s ease'
      });
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => { toast.style.opacity = '0'; }, 1800);
  }

  function showMenu(x, y, items) {
    closeMenu();
    menu = document.createElement('div');
    menu.className = 'jobCopyPasteMenu';
    Object.assign(menu.style, {
      position: 'fixed', left: `${x}px`, top: `${y}px`, zIndex: '12001',
      minWidth: '170px', background: '#fff', border: '1px solid #d9d9d9',
      borderRadius: '8px', boxShadow: '0 10px 30px rgba(0,0,0,.18)',
      padding: '5px', fontFamily: 'inherit'
    });
    items.forEach(item => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = item.label;
      Object.assign(button.style, {
        display: 'block', width: '100%', border: '0', background: 'transparent',
        textAlign: 'left', padding: '9px 10px', borderRadius: '6px',
        fontSize: '14px', fontWeight: '700', cursor: 'pointer', color: '#231f20'
      });
      button.onmouseenter = () => { button.style.background = '#f2f2f2'; };
      button.onmouseleave = () => { button.style.background = 'transparent'; };
      button.onclick = async e => {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        try { await item.action(); } catch (err) { showToast(err.message || 'Could not complete action'); }
      };
      menu.appendChild(button);
    });
    document.body.appendChild(menu);
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) menu.style.left = `${Math.max(8, window.innerWidth - rect.width - 8)}px`;
    if (rect.bottom > window.innerHeight - 8) menu.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
  }

  async function copyJobById(id) {
    const rows = await request(`/rest/v1/jobs?id=eq.${encodeURIComponent(id)}&select=*`);
    if (!rows?.[0]) throw new Error('Job not found');
    copiedJob = { ...rows[0] };
    showToast(`Copied: ${copiedJob.job_name || 'job'}`);
  }

  function cleanCopy(job) {
    const copy = { ...job };
    delete copy.id;
    delete copy.created_at;
    delete copy.updated_at;
    delete copy.sort_order;
    return copy;
  }

  function durationDays(job) {
    if (!job.start_date || !job.end_date) return 0;
    const a = new Date(`${job.start_date}T00:00:00`);
    const b = new Date(`${job.end_date}T00:00:00`);
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  function addDays(dateString, days) {
    const d = new Date(`${dateString}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function optimisticCard(job) {
    const missDigDates=(job.miss_dig_ready||job.miss_dig_expires)?`<p class="missDigDates">${job.miss_dig_ready?`Ready: ${esc(fmtCardDate(job.miss_dig_ready))}`:''}${job.miss_dig_ready&&job.miss_dig_expires?' · ':''}${job.miss_dig_expires?`Expires: ${esc(fmtCardDate(job.miss_dig_expires))}`:''}</p>`:'';
    const wrap=document.createElement('div');
    wrap.innerHTML=`<article class="jobCard ${esc(job.priority||'non_emergency')}" data-optimistic-paste="1" style="opacity:.88"><h3>${esc(job.job_name)}</h3>${job.address?`<p>${esc(job.address)}</p>`:''}${job.miss_dig_number?`<p>Miss Dig: ${esc(job.miss_dig_number)}</p>${missDigDates}`:''}${!job.miss_dig_number?missDigDates:''}${job.job_number?`<p>D’Angelo Job #: ${esc(job.job_number)}</p>`:''}${job.notes?`<p class="notes">${esc(job.notes)}</p>`:''}</article>`;
    return wrap.firstElementChild;
  }

  function showOptimisticPaste(job, crewId, date) {
    const card=optimisticCard(job);
    if(date){
      const cell=document.querySelector(`.dropCell[data-crew="${CSS.escape(String(crewId))}"][data-date="${CSS.escape(date)}"]`);
      if(!cell) return null;
      const addButton=cell.querySelector('.addCell');
      if(addButton) cell.insertBefore(card,addButton); else cell.appendChild(card);
      return card;
    }
    const body=document.querySelector('#incomingDrop .incomingBody');
    if(!body) return null;
    const empty=body.querySelector('.empty'); if(empty) empty.remove();
    body.appendChild(card);
    return card;
  }

  async function pasteInto(crewId, date) {
    if (!copiedJob) return showToast('Copy a job first');
    const copy = cleanCopy(copiedJob);
    const duration = durationDays(copiedJob);
    if (date) {
      copy.crew_id = Number(crewId);
      copy.start_date = date;
      copy.end_date = addDays(date, duration);
    } else {
      copy.crew_id = null;
      copy.start_date = null;
      copy.end_date = null;
    }

    const optimistic=showOptimisticPaste(copy,crewId,date);
    showToast(`Pasted: ${copy.job_name || 'job'}`);

    try {
      await request('/rest/v1/jobs', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(copy)
      });
    } catch (err) {
      optimistic?.remove();
      throw err;
    }
  }

  function markContextGesture(e) {
    if (!isSupervisor()) return;
    const target = e.target.closest?.('.jobCard, .dropCell, #incomingDrop');
    if (!target) return;
    if (e.button === 2 || (e.button === 0 && e.ctrlKey)) guardUntil = Date.now() + 1200;
  }

  document.addEventListener('pointerdown', markContextGesture, true);
  document.addEventListener('mousedown', markContextGesture, true);

  document.addEventListener('contextmenu', e => {
    if (!isSupervisor()) return;

    const jobCard = e.target.closest('.jobCard');
    if (jobCard && !jobCard.hasAttribute('data-optimistic-paste')) {
      e.preventDefault();
      e.stopPropagation();
      guardUntil = Date.now() + 1200;
      const id = jobCard.dataset.jobId;
      showMenu(e.clientX, e.clientY, [
        { label: 'Copy job', action: () => copyJobById(id) }
      ]);
      return;
    }

    const cell = e.target.closest('.dropCell');
    if (cell && copiedJob) {
      e.preventDefault();
      e.stopPropagation();
      guardUntil = Date.now() + 1200;
      showMenu(e.clientX, e.clientY, [
        { label: 'Paste job here', action: () => pasteInto(cell.dataset.crew, cell.dataset.date) }
      ]);
      return;
    }

    const incoming = e.target.closest('#incomingDrop');
    if (incoming && copiedJob) {
      e.preventDefault();
      e.stopPropagation();
      guardUntil = Date.now() + 1200;
      showMenu(e.clientX, e.clientY, [
        { label: 'Paste job to Incoming', action: () => pasteInto(null, null) }
      ]);
    }
  }, true);

  document.addEventListener('click', e => {
    if (e.target.closest?.('.jobCopyPasteMenu')) return;
    if (Date.now() < guardUntil) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    closeMenu();
  }, true);

  window.addEventListener('blur', closeMenu);
  window.addEventListener('resize', closeMenu);
})();