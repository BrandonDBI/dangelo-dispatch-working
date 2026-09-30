(() => {
  'use strict';

  function main(){ return document.querySelector('#app main'); }
  function scheduleEls(){
    const m=main(); if(!m) return [];
    return [...m.children].filter(el =>
      !el.classList.contains('topbar') &&
      !el.classList.contains('appTabs') &&
      !el.classList.contains('timeOffPage') &&
      !el.classList.contains('restorationPage') &&
      !el.classList.contains('onCallPage') &&
      !el.classList.contains('privateWorkPage')
    );
  }
  function ensure(){
    const tabs=document.getElementById('appTabs'), m=main();
    if(!tabs||!m) return false;
    let b=document.getElementById('tabOnCall');
    if(!b){
      b=document.createElement('button');
      b.id='tabOnCall'; b.className='appTab'; b.type='button'; b.textContent='On Call';
      const timeOff=document.getElementById('tabTimeOff');
      timeOff ? tabs.insertBefore(b,timeOff) : tabs.appendChild(b);
    }
    if(!document.getElementById('onCallPage')){
      const p=document.createElement('section');
      p.id='onCallPage'; p.className='onCallPage timeOffHidden';
      p.innerHTML='<div style="padding:28px 24px"><h2 style="margin:0 0 6px">On Call</h2><p style="margin:0;color:#666">Weekend, holiday, and break on-call assignments will live here.</p></div>';
      const timeOffPage=document.getElementById('timeOffPage');
      timeOffPage ? timeOffPage.insertAdjacentElement('beforebegin',p) : tabs.insertAdjacentElement('afterend',p);
    }
    b.onclick=show;
    return true;
  }
  function show(){
    document.querySelectorAll('.appTab').forEach(x=>x.classList.toggle('active',x.id==='tabOnCall'));
    document.getElementById('timeOffPage')?.classList.remove('active');
    const r=document.getElementById('restorationPage');
    r?.classList.remove('active'); r?.classList.add('timeOffHidden');
    scheduleEls().forEach(x=>x.classList.add('timeOffHidden'));
    const p=document.getElementById('onCallPage');
    p?.classList.remove('timeOffHidden'); p?.classList.add('active');
  }
  function hide(){
    const p=document.getElementById('onCallPage');
    p?.classList.remove('active'); p?.classList.add('timeOffHidden');
    document.getElementById('tabOnCall')?.classList.remove('active');
  }
  document.addEventListener('click',e=>{
    if(['tabSchedule','tabPrivateWork','tabRestoration','tabTimeOff'].includes(e.target?.id)) hide();
  },true);
  const obs=new MutationObserver(ensure);
  obs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});
  ensure();
})();