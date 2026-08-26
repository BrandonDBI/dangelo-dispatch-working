(() => {
  'use strict';

  const MOBILE_MAX=700;
  let selectedDate=null;
  let currentMode='today';
  let binding=false;

  function isMobile(){return window.innerWidth<=MOBILE_MAX;}
  function localDate(d){const x=new Date(d);x.setHours(0,0,0,0);return x;}
  function iso(d){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
  function parse(s){return new Date(`${s}T00:00:00`);}
  function addDays(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x;}
  function pretty(s){return parse(s).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();}
  function todayIso(){return iso(localDate(new Date()));}
  function tomorrowIso(){return iso(addDays(localDate(new Date()),1));}
  function boardDates(){return [...new Set(Array.from(document.querySelectorAll('.cell[data-date]')).map(c=>c.dataset.date).filter(Boolean))].sort();}
  function weekendShown(){const dates=boardDates();return dates.length>5||dates.some(d=>{const day=parse(d).getDay();return day===0||day===6;});}
  function nextSelectable(date,dir){let d=addDays(parse(date),dir);if(!weekendShown()){while(d.getDay()===0||d.getDay()===6)d=addDays(d,dir);}return iso(d);}
  function syncModeFromSelected(){const t=todayIso(),tm=tomorrowIso();currentMode=selectedDate===t?'today':selectedDate===tm?'tomorrow':'day';}

  function paintSingleDay(){
    if(!isMobile()||currentMode==='week'||!selectedDate)return;
    document.querySelectorAll('[data-mobile-view]').forEach(btn=>{
      const mode=btn.dataset.mobileView;
      btn.classList.toggle('active',(mode==='today'&&selectedDate===todayIso())||(mode==='tomorrow'&&selectedDate===tomorrowIso()));
    });
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
      if(selectedDate===todayIso())label.textContent=`TODAY · ${pretty(selectedDate)}`;
      else if(selectedDate===tomorrowIso())label.textContent=`TOMORROW · ${pretty(selectedDate)}`;
      else label.textContent=pretty(selectedDate);
    }
    window.DANGELO_TIME_OFF_REFRESH?.();
  }

  function afterWeekRender(){
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      syncModeFromSelected();
      paintSingleDay();
    }));
  }

  function moveDay(dir,coreHandler,button,event){
    if(currentMode==='week'){
      coreHandler?.call(button,event);
      return;
    }
    if(!selectedDate)selectedDate=currentMode==='tomorrow'?tomorrowIso():todayIso();
    selectedDate=nextSelectable(selectedDate,dir);
    syncModeFromSelected();
    const dates=boardDates();
    if(dates.includes(selectedDate)){
      paintSingleDay();
      return;
    }
    coreHandler?.call(button,event);
    afterWeekRender();
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
    document.querySelectorAll('[data-mobile-view]').forEach(btn=>{
      if(btn.dataset.mobileDayTabBound==='1')return;
      btn.dataset.mobileDayTabBound='1';
      btn.addEventListener('click',()=>{
        const mode=btn.dataset.mobileView;
        currentMode=mode;
        if(mode==='today')selectedDate=todayIso();
        else if(mode==='tomorrow')selectedDate=tomorrowIso();
        else selectedDate=null;
        if(mode!=='week')requestAnimationFrame(paintSingleDay);
      },false);
    });
  }

  function enhance(){
    if(binding||!isMobile())return;
    binding=true;
    try{
      bindArrow('prev',-1);
      bindArrow('next',1);
      bindTabs();
      if(selectedDate&&currentMode!=='week')paintSingleDay();
    }finally{binding=false;}
  }

  const obs=new MutationObserver(()=>requestAnimationFrame(enhance));
  const app=document.getElementById('app');
  if(app)obs.observe(app,{childList:true,subtree:true});
  window.addEventListener('resize',enhance);
  enhance();
})();