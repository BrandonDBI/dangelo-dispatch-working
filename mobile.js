(() => {
  'use strict';

  const MOBILE_MAX = 700;
  let mobileView = 'today';
  let incomingOpen = false;
  let enhancing = false;

  const style = document.createElement('style');
  style.textContent = `
    @media(max-width:${MOBILE_MAX}px){
      body{background:#f4f4f4!important}
      .topbar{min-height:66px!important;padding:8px 12px!important;display:grid!important;grid-template-columns:1fr auto;align-items:center!important;gap:8px!important;background:#231f20!important;border-bottom:3px solid #ed1c24!important}
      .topbar>div:first-child{display:flex!important;align-items:center!important;gap:10px!important;min-width:0}
      .topbar>div:first-child h1{font-size:16px!important;line-height:1!important;margin:0!important;color:#fff!important;white-space:nowrap}
      .topbar>div:first-child p{display:none!important}
      .mobileBrandLogo{width:84px;height:52px;object-fit:contain;flex:none;filter:drop-shadow(0 1px 1px rgba(0,0,0,.22))}
      .topbar .actions{margin:0!important;display:flex!important;justify-content:flex-end!important;gap:5px!important;flex-wrap:nowrap!important}
      .topbar .liveBadge{font-size:9px!important;padding:5px 7px!important;white-space:nowrap;background:#fff!important;color:#231f20!important;border:1px solid #fff!important}
      .topbar .roleBadge{font-size:9px!important;padding:5px 7px!important;white-space:nowrap;background:#ed1c24!important;color:#fff!important;border-color:#ed1c24!important}
      #signout{display:none!important}
      .mobileMenuButton{min-width:36px!important;width:36px!important;height:36px!important;min-height:36px!important;padding:0!important;border:1px solid rgba(255,255,255,.35)!important;background:#231f20!important;color:#fff!important;font-size:22px!important;line-height:1!important}
      .mobileMenuPanel{position:absolute;right:10px;top:58px;z-index:60;background:#fff;border:1px solid #d5dde5;border-radius:9px;padding:6px;box-shadow:0 10px 28px rgba(0,0,0,.22)}
      .mobileMenuPanel button{min-width:110px;color:#111827;background:#fff}

      .toolbar{padding:7px 10px 9px!important;background:#fff!important;border-bottom:1px solid #ddd!important}
      .toolbar>.actions:first-child{display:flex!important;justify-content:center!important;align-items:center!important;gap:7px!important}
      .toolbar>.actions:first-child button{width:38px!important;min-width:38px!important;height:38px!important;min-height:38px!important;padding:0!important;font-size:20px!important;border-color:#d7d7d7!important;color:#ed1c24!important;background:#fff!important}
      .toolbar>.actions:last-child{height:0!important;margin:0!important;overflow:visible!important;display:block!important}
      .toolbar .mobileHideOnPhone{display:none!important}
      .mobileDateNavLabel{flex:1;text-align:center;font-size:12px;font-weight:900;color:#444;letter-spacing:.15px;white-space:nowrap}
      .mobileViewTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:7px 0 0;width:100%}
      .mobileViewTabs button{min-height:40px;border:1px solid #d4d4d4;background:#fff;color:#333;border-radius:8px;font-weight:800}
      .mobileViewTabs button.active{background:#ed1c24;color:#fff;border-color:#ed1c24}
      .mobileFab{position:fixed!important;right:18px!important;bottom:24px!important;z-index:80!important;width:58px!important;height:58px!important;min-height:58px!important;border-radius:50%!important;padding:0!important;background:#ed1c24!important;color:#fff!important;border:3px solid #fff!important;box-shadow:0 8px 22px rgba(0,0,0,.30)!important;font-size:30px!important;line-height:1!important;overflow:hidden!important}

      .cell:before{content:attr(data-pretty-date)!important}
      .cell.mobileHidden,.crewName.mobileHidden{display:none!important}
      .dispatchLayout{display:flex!important;flex-direction:column!important;padding-top:7px!important}
      .scroller{order:1}
      .incoming{order:2;margin-top:10px;margin-bottom:78px!important}
      .incoming.mobileCollapsed .incomingBody{display:none}
      .incoming.mobileCollapsed{min-height:0!important}
      .incomingHead{cursor:pointer;background:#231f20!important;color:#fff!important;border-top:3px solid #ed1c24!important}
      .incomingHead .mobileIncomingCount{font-size:11px!important;opacity:.88;margin-top:3px}
      .incoming.mobileCollapsed .incomingHead{border-radius:10px!important}
      .incoming:not(.mobileCollapsed) .incomingHead{border-radius:10px 10px 0 0!important}

      .crewName{margin-top:9px!important;padding:10px 12px!important}
      .crewName strong{font-size:15px!important}
      .cell{padding-top:31px!important;min-height:52px!important}
      .jobCard{padding:10px 11px!important}
      .jobCard h3{font-size:13px!important}
      .jobCard p{font-size:11.5px!important}
      .missDigDates{font-weight:800!important;color:#555!important}
      .crewName.mobileEmptyCrew{padding:8px 12px!important}
      .cell.mobileEmptyCell{min-height:38px!important;padding:8px 48px 8px 12px!important;border-radius:0 0 10px 10px!important}
      .cell.mobileEmptyCell:before{display:none!important}
      .mobileEmptyLabel{font-size:11px;font-weight:700;color:#64748b}
      .cell.mobileEmptyCell .addCell{top:5px!important}
      footer{margin-bottom:76px!important}

      .loginPage{background:#231f20!important;min-height:100vh!important;padding:24px 16px!important}
      .loginCard{border-top:5px solid #ed1c24!important;box-shadow:0 18px 45px rgba(0,0,0,.35)!important}
      .loginCard .logo{width:auto!important;height:auto!important;background:transparent!important;margin:0 auto 10px!important;border-radius:0!important}
      .mobileLoginLogo{display:block;width:220px;max-width:78vw;height:auto;margin:0 auto 10px}
      .loginCard h1{color:#231f20!important}
      .loginCard .primary{background:#ed1c24!important;border-color:#ed1c24!important}
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

  function brandLogin(){
    const logo=document.querySelector('.loginCard .logo');
    if(!logo || logo.querySelector('.mobileLoginLogo')) return;
    logo.innerHTML='<img class="mobileLoginLogo" src="/dangelo-logo.svg" alt="D’Angelo Brothers Inc.">';
    const title=document.querySelector('.loginCard h1');
    if(title) title.textContent='Dispatch';
  }

  function compactHeader(){
    const topbar=document.querySelector('.topbar');
    if(!topbar) return;
    const left=topbar.querySelector('div:first-child');
    const title=topbar.querySelector('h1');
    if(left && !left.querySelector('.mobileBrandLogo')){
      const logo=document.createElement('img');
      logo.className='mobileBrandLogo';
      logo.src='/dangelo-logo.svg';
      logo.alt='D’Angelo Brothers Inc.';
      left.insertBefore(logo,title||left.firstChild);
    }
    if(title) title.textContent='Dispatch';
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
      if(visibleCells.length===1 && !visibleCells[0].querySelector('.jobCard,.scheduleTimeOffMarker')){
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
      brandLogin();
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
