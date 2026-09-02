(() => {
  'use strict';

  const MOBILE_MAX = 700;
  let lastPreviewAt = 0;

  function isMobile(){ return window.innerWidth <= MOBILE_MAX; }
  function isoLocal(d){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,'0');
    const day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function parseDate(s){ return new Date(`${s}T00:00:00`); }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
  function prettyDate(dateString){
    return parseDate(dateString).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase();
  }
  function boardDates(){
    return [...new Set(Array.from(document.querySelectorAll('.cell[data-date]')).map(c=>c.dataset.date).filter(Boolean))].sort();
  }
  function weekendShown(){
    return boardDates().some(date=>{ const day=parseDate(date).getDay(); return day===0 || day===6; });
  }
  function adjacentDate(dateString,dir){
    let d=addDays(parseDate(dateString),dir);
    if(!weekendShown()) while(d.getDay()===0 || d.getDay()===6) d=addDays(d,dir);
    return isoLocal(d);
  }
  function visibleDate(){
    return document.querySelector('.cell[data-date]:not(.mobileHidden)')?.dataset.date || null;
  }
  function updateCrewVisibility(){
    document.querySelectorAll('.crewName').forEach(name=>{
      let node=name.nextElementSibling;
      let visible=false;
      while(node && !node.classList.contains('crewName')){
        if(node.classList.contains('cell') && !node.classList.contains('mobileHidden')) visible=true;
        node=node.nextElementSibling;
      }
      name.classList.toggle('mobileHidden',!visible);
    });
  }
  function setTabs(mode){
    document.querySelectorAll('[data-mobile-view]').forEach(btn=>{
      btn.classList.toggle('active', mode==='week' ? btn.dataset.mobileView==='week' : btn.dataset.mobileView==='today');
    });
  }
  function setLabel(date,mode){
    const label=document.querySelector('.mobileDateNavLabel');
    if(!label) return;
    if(mode==='week'){
      const first=boardDates()[0];
      label.textContent=first ? `WEEK OF ${parseDate(first).toLocaleDateString('en-US',{month:'short',day:'numeric'}).toUpperCase()}` : 'WEEK';
      return;
    }
    const today=isoLocal(new Date());
    label.textContent=date===today ? `TODAY · ${prettyDate(date)}` : prettyDate(date);
  }
  function scrollScheduleTop(){
    requestAnimationFrame(()=>{
      const board=document.getElementById('board');
      const top=board ? Math.max(0,board.getBoundingClientRect().top + window.scrollY - 6) : 0;
      window.scrollTo({top,behavior:'auto'});
      const scroller=document.querySelector('.scroller');
      if(scroller) scroller.scrollTop=0;
    });
  }
  function previewDay(date,scroll=false){
    if(!date) return;
    document.querySelectorAll('.cell[data-date]').forEach(cell=>{
      cell.classList.toggle('mobileHidden',cell.dataset.date!==date);
    });
    updateCrewVisibility();
    setTabs('day');
    setLabel(date,'day');
    lastPreviewAt=performance.now();
    if(scroll) scrollScheduleTop();
  }
  function previewWeek(){
    document.querySelectorAll('.cell[data-date]').forEach(cell=>cell.classList.remove('mobileHidden'));
    document.querySelectorAll('.crewName').forEach(name=>name.classList.remove('mobileHidden'));
    setTabs('week');
    setLabel(null,'week');
    lastPreviewAt=performance.now();
  }

  document.addEventListener('pointerdown',e=>{
    if(!isMobile()) return;

    const tab=e.target.closest?.('[data-mobile-view]');
    if(tab){
      if(tab.dataset.mobileView==='week'){
        previewWeek();
      } else {
        const weekButton=document.querySelector('[data-mobile-view="week"]');
        const comingFromWeek=weekButton?.classList.contains('active');

        // Day always means the current day. If the user browsed to another week,
        // first return the underlying board to the current week so the normal
        // mobile Day handler has a real "today" cell to reveal.
        if(comingFromWeek){
          document.getElementById('today')?.click();
        }

        const dates=boardDates();
        const today=isoLocal(new Date());
        previewDay(dates.includes(today) ? today : (visibleDate() || dates[0]), true);
      }
      return;
    }

    const arrow=e.target.closest?.('#prev,#next');
    if(!arrow) return;
    const weekButton=document.querySelector('[data-mobile-view="week"]');
    if(weekButton?.classList.contains('active')) return;
    const current=visibleDate();
    if(!current) return;
    const target=adjacentDate(current,arrow.id==='next'?1:-1);
    if(boardDates().includes(target)) previewDay(target);
  },true);

  // Prevent a browser-generated delayed synthetic click from making the control
  // feel sticky after the visual preview has already happened.
  document.addEventListener('touchend',()=>{
    if(performance.now()-lastPreviewAt<700) document.documentElement.dataset.mobileNavWarm='1';
  },{passive:true,capture:true});
})();
