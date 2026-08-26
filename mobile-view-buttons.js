(() => {
  'use strict';
  const MOBILE_MAX=700;
  let queued=false;

  function apply(){
    queued=false;
    if(window.innerWidth>MOBILE_MAX)return;
    const tabs=document.getElementById('mobileViewTabs');
    if(!tabs)return;
    tabs.style.gridTemplateColumns='repeat(2,1fr)';
    const day=tabs.querySelector('[data-mobile-view="today"]');
    const tomorrow=tabs.querySelector('[data-mobile-view="tomorrow"]');
    const week=tabs.querySelector('[data-mobile-view="week"]');
    if(day)day.textContent='Day';
    if(tomorrow)tomorrow.style.display='none';
    if(week)week.textContent='Week';
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