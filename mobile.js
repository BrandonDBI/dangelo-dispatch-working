(() => {
  'use strict';

  const MOBILE_MAX = 700;
  let mobileView = 'today';
  let incomingOpen = false;
  let enhancing = false;

  const style = document.createElement('style');
  style.textContent = `
    @media(max-width:${MOBILE_MAX}px){
      .mobileViewTabs{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin:8px 0 0;width:100%}
      .mobileViewTabs button{min-height:42px;border:1px solid #cbd5e1;background:#fff;color:#334155;border-radius:8px;font-weight:800}
      .mobileViewTabs button.active{background:#06243a;color:#fff;border-color:#06243a}
      .cell:before{content:attr(data-pretty-date)!important}
      .cell.mobileHidden,.crewName.mobileHidden{display:none!important}
      .dispatchLayout{display:flex!important;flex-direction:column!important}
      .scroller{order:1}
      .incoming{order:2;margin-top:12px;margin-bottom:0!important}
      .incoming.mobileCollapsed .incomingBody{display:none}
      .incoming.mobileCollapsed{min-height:0!important}
      .incomingHead{cursor:pointer}
      .incomingHead .mobileIncomingCount{font-size:11px!important;opacity:.88;margin-top:3px}
      .incoming.mobileCollapsed .incomingHead{border-radius:10px!important}
      .incoming:not(.mobileCollapsed) .incomingHead{border-radius:10px 10px 0 0!important}
      .toolbar .mobileHideOnPhone{display:none!important}
      .mobileDayTitle{font-size:13px;font-weight:800;text-align:center;color:#475569;margin:3px 0 0}
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
    const weekend=document.getElementById('weekend');
    if(weekend) weekend.classList.add('mobileHideOnPhone');
    const today=document.getElementById('today');
    if(today) today.classList.add('mobileHideOnPhone');
    const range=toolbar.querySelector('.actions:first-child strong');
    if(range) range.classList.add('mobileHideOnPhone');
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
  }

  function enhance(){
    if(enhancing || !isMobile()) return;
    enhancing=true;
    try{
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
