(() => {
  'use strict';

  const cfg = window.DANGELO_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const KEY = String(cfg.SUPABASE_ANON_KEY || '');
  let copiedJob = null;
  let menu = null;

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
      position: 'fixed', left: `${x}px`, top: `${y}px`, zIndex: '10000',
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
        fontSize: '14px', cursor: 'pointer', color: '#231f20'
      });
      button.onmouseenter = () => { button.style.background = '#f2f2f2'; };
      button.onmouseleave = () => { button.style.background = 'transparent'; };
      button.onclick = async () => {
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
    await request('/rest/v1/jobs', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(copy)
    });
    showToast(`Pasted: ${copy.job_name || 'job'}`);
  }

  document.addEventListener('contextmenu', e => {
    if (!isSupervisor()) return;

    const jobCard = e.target.closest('.jobCard');
    if (jobCard) {
      e.preventDefault();
      e.stopPropagation();
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
      showMenu(e.clientX, e.clientY, [
        { label: 'Paste job here', action: () => pasteInto(cell.dataset.crew, cell.dataset.date) }
      ]);
      return;
    }

    const incoming = e.target.closest('#incomingDrop');
    if (incoming && copiedJob) {
      e.preventDefault();
      e.stopPropagation();
      showMenu(e.clientX, e.clientY, [
        { label: 'Paste job to Incoming', action: () => pasteInto(null, null) }
      ]);
    }
  }, true);

  document.addEventListener('click', closeMenu, true);
  window.addEventListener('blur', closeMenu);
})();