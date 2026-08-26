(() => {
  'use strict';
  const MOBILE_MAX=700;
  let queued=false;
  let dayMode=true;
  let selectedDate=null;

  function isMobile(){return window.innerWidth<=MOBILE_MAX;}
  function boardDates(){return [...new Set(Array.from(document.querySelectorAll('.cell[data-date]')).map(c=>c.dataset.date).filter(Boolean))].sort();}
  function todayIso(){const d=new Date(),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
  function pretty(date){return new Date(`${date}T00:00:00`).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();}

  function paintDay(){
    if(!isMobile()||!dayMode)return;
    const dates=boardDates();
    if(!dates.length)return;
    if(!selectedDate||!dates.includes(selectedDate)){
      selectedDate=dates.includes(todayIso())?todayIso():dates[0];
    }
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
    if(label){
      const text=selectedDate===todayIso()?`TODAY · ${pretty(selectedDate)}`:pretty(selectedDate);
      if(label.textContent!==text)label.textContent=text;
    }
  }

  function bindArrow(id,dir){
    const btn=document.getElementById(id);
    if(!btn||btn.dataset.dayArrowBound==='1')return;
    const coreHandler=btn.onclick;
    btn.dataset.dayArrowBound='1';
    btn.addEventListener('click',e=>{
      if(!isMobile()||!dayMode)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const dates=boardDates();
      if(!dates.length)return;
      if(!selectedDate||!dates.includes(selectedDate))selectedDate=dates.includes(todayIso())?todayIso():dates[0];
      const index=dates.indexOf(selectedDate);
      const nextIndex=index+dir;
      if(nextIndex>=0&&nextIndex<dates.length){
        selectedDate=dates[nextIndex];
        paintDay();
        return;
      }
      coreHandler?.call(btn,e);
      const nextDates=boardDates();
      if(nextDates.length){
        selectedDate=dir>0?nextDates[0]:nextDates[nextDates.length-1];
        paintDay();
      }
    },true);
  }

  function bindTabs(day,week){
    if(day&&day.dataset.dayModeBound!=='1'){
      day.dataset.dayModeBound='1';
      day.addEventListener('click',()=>{dayMode=true;selectedDate=todayIso();requestAnimationFrame(paintDay);});
    }
    if(week&&week.dataset.dayModeBound!=='1'){
      week.dataset.dayModeBound='1';
      week.addEventListener('click',()=>{dayMode=false;selectedDate=null;});
    }
  }

  function apply(){
    queued=false;
    if(!isMobile())return;
    const tabs=document.getElementById('mobileViewTabs');
    if(!tabs)return;
    if(tabs.style.gridTemplateColumns!=='repeat(2, 1fr)')tabs.style.gridTemplateColumns='repeat(2,1fr)';
    const day=tabs.querySelector('[data-mobile-view="today"]');
    const tomorrow=tabs.querySelector('[data-mobile-view="tomorrow"]');
    const week=tabs.querySelector('[data-mobile-view="week"]');
    if(day&&day.textContent!=='Day')day.textContent='Day';
    if(tomorrow&&tomorrow.style.display!=='none')tomorrow.style.display='none';
    if(week&&week.textContent!=='Week')week.textContent='Week';
    bindTabs(day,week);
    bindArrow('prev',-1);
    bindArrow('next',1);
    if(dayMode)paintDay();
  }

  function queue(){
    if(queued)return;
    queued=true;
    requestAnimationFrame(apply);
  }

  const app=document.getElementById('app');
  if(app)new MutationObserver(queue).observe(app,{childList:true,subtree:true});
  window.addEventListener('resize',queue);
  queue();
})();