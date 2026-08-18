(() => {
  'use strict';

  const MOBILE_MAX = 700;
  let mobileView = 'today';
  let incomingOpen = false;
  let enhancing = false;

  const style = document.createElement('style');
  style.textContent = `
    @media(max-width:${MOBILE_MAX}px){
      .topbar{min-height:58px!important;padding:9px 12px!important;display:grid!important;grid-template-columns:1fr auto;align-items:center!important;gap:8px!important}
      .topbar>div:first-child h1{font-size:18px!important;line-height:1!important;margin:0!important}
      .topbar>div:first-child p{display:none!important}
      .topbar .actions{margin:0!important;display:flex!important;justify-content:flex-end!important;gap:5px!important;flex-wrap:nowrap!important}
      .topbar .liveBadge,.topbar .roleBadge{font-size:9px!important;padding:5px 7px!important;white-space:nowrap}
      #signout{display:none!important}
      .mobileMenuButton{min-width:36px!important;width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;border:1px solid rgba(255,255,255,.28)!important;background:rgba(255,255,255,.1)!important;color:#fff!important;font-size:22px!important;line-height:1!important}
      .mobileMenuPanel{position:absolute;right:10px;top:52px;z-index:60;background:#fff;border:1px solid #d5dde5;border-radius:9px;padding:6px;box-shadow:0 10px 28px rgba(15,23,42,.2)}
      .mobileMenuPanel button{min-width:110px;color:#111827;background:#fff}

      .toolbar{padding:7px 10px 9px!important}
      .toolbar>.actions:first-child{display:flex!important;justify-content:center!important;align-items:center!important;gap:7px!important}
      .toolbar>.actions:first-child button{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;font-size:20px!important}
      .toolbar>.actions:last-child{height:0!important;margin:0!important;overflow:visible!important;display:block!important}
      .toolbar .mobileHideOnPhone{display:none!important}
      .mobileDateNavLabel{flex:1;text-align:center;font-size:12px;font-weight:900;color:#475569;letter-spacing:.15px;white-space:nowrap}
      .mobileViewTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:7px 0 0;width:100%}
      .mobileViewTabs button{min-height:40px;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:8px;font-weight:800}
      .mobileViewTabs button.active{background:#06243a;color:#fff;border-color:#06243a}
      .mobileFab{position:fixed!important;right:18px!important;bottom:24px!important;z-index:80!important;width:58px!important;height:58px!important;min-height:58px!important;border-radius:50%!important;padding:0!important;background:#06243a!important;color:#fff!important;border:2px solid #fff!important;box-shadow:0 8px 22px rgba(15,23,42,.3)!important;font-size:30px!important;line-height:1!important;overflow:hidden!important}

      .cell:before{content:attr(data-pretty-date)!important}
      .cell.mobileHidden,.crewName.mobileHidden{display:none!important}
      .dispatchLayout{display:flex!important;flex-direction:column!important;padding-top:7px!important}
      .scroller{order:1}
      .incoming{order:2;margin-top:10px;margin-bottom:78px!important}
      .incoming.mobileCollapsed .incomingBody{display:none}
      .incoming.mobileCollapsed{min-height:0!important}
      .incomingHead{cursor:pointer}
      .incomingHead .mobileIncomingCount{font-size:11px!important;opacity:.88;margin-top:3px}
      .incoming.mobileCollapsed .incomingHead{border-radius:10px!important}
      .incoming:not(.mobileCollapsed) .incomingHead{border-radius:10px 10px 0 0!important}

      .crewName{margin-top:9px!important;padding:10px 12px!important}
      .crewName strong{font-size:15px!important}
      .cell{padding-top:31px!important;min-height:52px!important}
      .jobCard{padding:10px 11px!important}
      .jobCard h3{font-size:13px!important}
      .jobCard p{font-size:11.5px!important}
      .crewName.mobileEmptyCrew{padding:8px 12px!important}
      .cell.mobileEmptyCell{min-height:38px!important;padding:8px 48px 8px 12px!important;border-radius:0 0 10px 10px!important}
      .cell.mobileEmptyCell:before{display:none!important}
      .mobileEmptyLabel{font-size:11px;font-weight:700;color:#64748b}
      .cell.mobileEmptyCell .addCell{top:5px!important}
      footer{margin-bottom:76px!important}
    }
  `;
  document.head.appendChild(style);

  function isMobile(){ return window.innerWidth <= MOBILE_MAX; }
  function isoLocal(d){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function prettyDate(dateString){
    const d=new Date(`${dateString}T00:00:00`);
    return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
  }

  function compactHeader(){
    const topbar=document.querySelector('.topbar');
    if(!topbar) return;
    const title=topbar.querySelector('h1');
    if(title) title.textContent='D’Angelo Dispatch';
    const actions=topbar.querySelector('.actions');
    const signout=document.getElementById('signout');
    if(!actions||!signout) return;
    if(!document.getElementById('mobileMenuButton')){
      const menu=document.createElement('button');
      menu.id='mobileMenuButton';
      menu.className='mobileMenuButton';
      menu.type='button';
      menu.setAttribute('aria-label','Menu');
      menu.textContent='⋯';
      menu.onclick=e=>{
        e.stopPropagation();
        let panel=document.getElementById('mobileMenuPanel');
        if(panel){ panel.remove(); return; }
        panel=document.createElement('div');
        panel.id='mobileMenuPanel';
        panel.className='mobileMenuPanel';
        const out=document.createElement('button');
        out.type='button'; out.textContent='Sign out';
        out.onclick=()=>signout.click();
        panel.appendChild(out);
        topbar.appendChild(panel);
      };
      actions.appendChild(menu);
      document.addEventListener('click',e=>{
        const panel=document.getElementById('mobileMenuPanel');
        if(panel && !panel.contains(e.target) && e.target.id!=='mobileMenuButton') panel.remove();
      });
    }
  }

  function addTabs(toolbar){
    if(document.getElementById('mobileViewTabs')) return;
    const tabs=document.createElement('div');
    tabs.id='mobileViewTabs';
    tabs.className='mobileViewTabs';
    tabs.innerHTML=`<button data-mobile-view="today">Today</button><button data-mobile-view="tomorrow">Tomorrow</button><button data-mobile-view="week">Week</button>`;
    tabs.querySelectorAll('button').forEach(btn=>{
      btn.onclick=()=>{ mobileView=btn.dataset.mobileView; applyMobileView(); };
    });
    toolbar.appendChild(tabs);
  }

  function compactToolbar(){
    const toolbar=document.querySelector('.toolbar');
    if(!toolbar) return;
    addTabs(toolbar);
    const first=toolbar.querySelector('.actions:first-child');
    if(first && !first.querySelector('.mobileDateNavLabel')){
      const label=document.createElement('span');
      label.className='mobileDateNavLabel';
      const next=document.getElementById('next');
      if(next) first.insertBefore(label,next);
    }
    const weekend=document.getElementById('weekend');
    if(weekend) weekend.classList.add('mobileHideOnPhone');
    const today=document.getElementById('today');
    if(today) today.classList.add('mobileHideOnPhone');
    const range=toolbar.querySelector('.actions:first-child strong');
    if(range) range.classList.add('mobileHideOnPhone');
    const newJob=document.getElementById('newIncoming');
    if(newJob){
      newJob.classList.add('mobileFab');
      newJob.textContent='+';
      newJob.setAttribute('aria-label','New incoming job');
      newJob.title='New incoming job';
    }
  }

  function updateNavLabel(){
    const label=document.querySelector('.mobileDateNavLabel');
    if(!label) return;
    const today=new Date(); today.setHours(0,0,0,0);
    if(mobileView==='today') label.textContent=`TODAY · ${prettyDate(isoLocal(today))}`;
    else if(mobileView==='tomorrow') label.textContent=`TOMORROW · ${prettyDate(isoLocal(addDays(today,1)))}`;
    else {
      const monday=new Date(today); monday.setDate(today.getDate()-((today.getDay()+6)%7));
      label.textContent=`WEEK OF ${monday.toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase()}`;
    }
  }

  function compactIncoming(){
    const incoming=document.querySelector('.incoming');
    const head=incoming?.querySelector('.incomingHead');
    const body=incoming?.querySelector('.incomingBody');
    if(!incoming||!head||!body) return;
    const count=body.querySelectorAll('.jobCard').length;
    const textWrap=head.querySelector('div');
    if(textWrap){
      let countLine=textWrap.querySelector('.mobileIncomingCount');
      if(!countLine){ countLine=document.createElement('span'); countLine.className='mobileIncomingCount'; textWrap.appendChild(countLine); }
      countLine.textContent=`${count} incoming job${count===1?'':'s'} • tap to ${incomingOpen?'close':'open'}`;
      const old=textWrap.querySelector('span:not(.mobileIncomingCount)');
      if(old) old.style.display='none';
    }
    incoming.classList.toggle('mobileCollapsed',!incomingOpen);
    if(!head.dataset.mobileBound){
      head.dataset.mobileBound='1';
      head.addEventListener('click',e=>{
        if(e.target.closest('button')) return;
        incomingOpen=!incomingOpen;
        compactIncoming();
      });
    }
  }

  function markEmptyCrews(){
    document.querySelectorAll('.mobileEmptyLabel').forEach(x=>x.remove());
    document.querySelectorAll('.mobileEmptyCrew').forEach(x=>x.classList.remove('mobileEmptyCrew'));
    document.querySelectorAll('.mobileEmptyCell').forEach(x=>x.classList.remove('mobileEmptyCell'));
    if(mobileView==='week') return;
    document.querySelectorAll('.crewName:not(.mobileHidden)').forEach(name=>{
      let node=name.nextElementSibling;
      const visibleCells=[];
      while(node && !node.classList.contains('crewName')){
        if(node.classList.contains('cell') && !node.classList.contains('mobileHidden')) visibleCells.push(node);
        node=node.nextElementSibling;
      }
      if(visibleCells.length===1 && !visibleCells[0].querySelector('.jobCard')){
        const cell=visibleCells[0];
        name.classList.add('mobileEmptyCrew');
        cell.classList.add('mobileEmptyCell');
        const label=document.createElement('span');
        label.className='mobileEmptyLabel';
        label.textContent=`No jobs scheduled · ${prettyDate(cell.dataset.date)}`;
        cell.insertBefore(label,cell.firstChild);
      }
    });
  }

  function applyMobileView(){
    if(!isMobile()) return;
    const tabs=document.querySelectorAll('[data-mobile-view]');
    tabs.forEach(btn=>btn.classList.toggle('active',btn.dataset.mobileView===mobileView));

    const today=new Date(); today.setHours(0,0,0,0);
    const wanted=mobileView==='today'?isoLocal(today):mobileView==='tomorrow'?isoLocal(addDays(today,1)):null;

    document.querySelectorAll('.cell[data-date]').forEach(cell=>{
      cell.dataset.prettyDate=prettyDate(cell.dataset.date);
      const show=!wanted || cell.dataset.date===wanted;
      cell.classList.toggle('mobileHidden',!show);
    });

    document.querySelectorAll('.crewName').forEach(name=>{
      let node=name.nextElementSibling;
      let hasVisible=false;
      while(node && !node.classList.contains('crewName')){
        if(node.classList.contains('cell') && !node.classList.contains('mobileHidden')) hasVisible=true;
        node=node.nextElementSibling;
      }
      name.classList.toggle('mobileHidden',!hasVisible);
    });
    updateNavLabel();
    markEmptyCrews();
  }

  function enhance(){
    if(enhancing || !isMobile()) return;
    enhancing=true;
    try{
      compactHeader();
      compactToolbar();
      compactIncoming();
      applyMobileView();
    } finally { enhancing=false; }
  }

  const observer=new MutationObserver(()=>{ if(isMobile()) requestAnimationFrame(enhance); });
  observer.observe(document.getElementById('app'),{childList:true,subtree:true});
  window.addEventListener('resize',()=>{ if(isMobile()) enhance(); });
  enhance();
})();
