(() => {
  'use strict';

  const MOBILE_MAX=700;
  let mode='day';
  let selectedDate=todayIso();
  let binding=false;

  const style=document.createElement('style');
  style.textContent=`@media(max-width:${MOBILE_MAX}px){
    .mobileViewTabs{grid-template-columns:repeat(2,1fr)!important}
    .mobileViewTabs [data-mobile-view="tomorrow"]{display:none!important}
  }`;
  document.head.appendChild(style);

  function isMobile(){return window.innerWidth<=MOBILE_MAX;}
  function localDate(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}
  function iso(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
  function parse(s){return new Date(`${s}T00:00:00`);}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
  function todayIso(){return iso(localDate(new Date()));}
  function pretty(s){return parse(s).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();}
  function boardDates(){return [...new Set(Array.from(document.querySelectorAll('.cell[data-date]')).map(c=>c.dataset.date).filter(Boolean))].sort();}
  function weekendShown(){const dates=boardDates();return dates.length>5||dates.some(d=>{const n=parse(d).getDay();return n===0||n===6;});}
  function nextSelectable(date,dir){let d=addDays(parse(date),dir);if(!weekendShown()){while(d.getDay()===0||d.getDay()===6)d=addDays(d,dir);}return iso(d);}

  function normalizeTabs(){
    const tabs=document.getElementById('mobileViewTabs');
    if(!tabs)return;
    const day=tabs.querySelector('[data-mobile-view="today"]');
    const tomorrow=tabs.querySelector('[data-mobile-view="tomorrow"]');
    const week=tabs.querySelector('[data-mobile-view="week"]');
    if(day){day.textContent='Day';day.dataset.mobileMode='day';}
    if(tomorrow)tomorrow.style.display='none';
    if(week){week.textContent='Week';week.dataset.mobileMode='week';}
    [day,week].filter(Boolean).forEach(btn=>btn.classList.toggle('active',btn.dataset.mobileMode===mode));
  }

  function markEmptyCrews(){
    document.querySelectorAll('.mobileEmptyLabel').forEach(x=>x.remove());
    document.querySelectorAll('.mobileEmptyCrew').forEach(x=>x.classList.remove('mobileEmptyCrew'));
    document.querySelectorAll('.mobileEmptyCell').forEach(x=>x.classList.remove('mobileEmptyCell'));
    if(mode==='week')return;
    document.querySelectorAll('.crewName:not(.mobileHidden)').forEach(name=>{
      let node=name.nextElementSibling;
      const visible=[];
      while(node&&!node.classList.contains('crewName')){
        if(node.classList.contains('cell')&&!node.classList.contains('mobileHidden'))visible.push(node);
        node=node.nextElementSibling;
      }
      if(visible.length===1&&!visible[0].querySelector('.jobCard,.scheduleTimeOffMarker')){
        const cell=visible[0];
        name.classList.add('mobileEmptyCrew');
        cell.classList.add('mobileEmptyCell');
        const label=document.createElement('span');
        label.className='mobileEmptyLabel';
        label.textContent=`No jobs scheduled · ${pretty(cell.dataset.date)}`;
        cell.insertBefore(label,cell.firstChild);
      }
    });
  }

  function paintDay(){
    if(!isMobile()||mode!=='day'||!selectedDate)return;
    normalizeTabs();
    document.querySelectorAll('.cell[data-date]').forEach(cell=>{
      cell.dataset.prettyDate=pretty(cell.dataset.date);
      cell.classList.toggle('mobileHidden',cell.dataset.date!==selectedDate);
    });
    document.querySelectorAll('.crewName').forEach(name=>{
      let node=name.nextElementSibling,visible=false;
      while(node&&!node.classList.contains('crewName')){
        if(node.classList.contains('cell')&&!node.classList.contains('mobileHidden'))visible=true;
        node=node.nextElementSibling;
      }
      name.classList.toggle('mobileHidden',!visible);
    });
    const label=document.querySelector('.mobileDateNavLabel');
    if(label)label.textContent=selectedDate===todayIso()?`TODAY · ${pretty(selectedDate)}`:pretty(selectedDate);
    markEmptyCrews();
    window.DANGELO_TIME_OFF_REFRESH?.();
  }

  function paintWeek(){
    if(!isMobile()||mode!=='week')return;
    normalizeTabs();
    document.querySelectorAll('.cell[data-date]').forEach(cell=>{
      cell.dataset.prettyDate=pretty(cell.dataset.date);
      cell.classList.remove('mobileHidden');
    });
    document.querySelectorAll('.crewName').forEach(name=>name.classList.remove('mobileHidden'));
  }

  function settle(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      normalizeTabs();
      if(mode==='day')paintDay();else paintWeek();
    }));
  }

  function moveDay(dir,coreHandler,button,event){
    if(mode==='week'){
      coreHandler?.call(button,event);
      return;
    }
    selectedDate=nextSelectable(selectedDate||todayIso(),dir);
    const dates=boardDates();
    if(dates.includes(selectedDate)){
      paintDay();
      return;
    }
    coreHandler?.call(button,event);
    settle();
  }

  function bindArrow(id,dir){
    const btn=document.getElementById(id);
    if(!btn||btn.dataset.mobileDayNavBound==='1')return;
    const coreHandler=btn.onclick;
    btn.dataset.mobileDayNavBound='1';
    btn.addEventListener('click',e=>{
      if(!isMobile())return;
      e.preventDefault();
      e.stopImmediatePropagation();
      moveDay(dir,coreHandler,btn,e);
    },true);
  }

  function bindTabs(){
    normalizeTabs();
    const day=document.querySelector('[data-mobile-mode="day"]');
    const week=document.querySelector('[data-mobile-mode="week"]');
    if(day&&day.dataset.mobileCleanTabBound!=='1'){
      day.dataset.mobileCleanTabBound='1';
      day.addEventListener('click',e=>{
        if(!isMobile())return;
        e.preventDefault();
        e.stopImmediatePropagation();
        mode='day';
        if(!selectedDate)selectedDate=todayIso();
        settle();
      },true);
    }
    if(week&&week.dataset.mobileCleanTabBound!=='1'){
      week.dataset.mobileCleanTabBound='1';
      week.addEventListener('click',e=>{
        if(!isMobile())return;
        e.preventDefault();
        e.stopImmediatePropagation();
        mode='week';
        settle();
      },true);
    }
  }

  function enhance(){
    if(binding||!isMobile())return;
    binding=true;
    try{
      bindArrow('prev',-1);
      bindArrow('next',1);
      bindTabs();
      settle();
    }finally{binding=false;}
  }

  const obs=new MutationObserver(()=>requestAnimationFrame(enhance));
  const app=document.getElementById('app');
  if(app)obs.observe(app,{childList:true,subtree:true});
  window.addEventListener('resize',enhance);
  enhance();
})();