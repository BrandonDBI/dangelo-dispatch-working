(() => {
  'use strict';
  function main(){return document.querySelector('#app main')}
  function scheduleEls(){const m=main();if(!m)return[];return [...m.children].filter(el=>!el.classList.contains('topbar')&&!el.classList.contains('appTabs')&&!el.classList.contains('timeOffPage')&&!el.classList.contains('restorationPage')&&!el.classList.contains('onCallPage')&&!el.classList.contains('privateWorkPage'))}
  function ensure(){
    const tabs=document.getElementById('appTabs'),m=main();if(!tabs||!m)return false;
    let b=document.getElementById('tabPrivateWork');
    if(!b){b=document.createElement('button');b.id='tabPrivateWork';b.className='appTab';b.type='button';b.textContent='Private Work';const restoration=document.getElementById('tabRestoration');restoration?tabs.insertBefore(b,restoration):tabs.appendChild(b)}
    if(!document.getElementById('privateWorkPage')){const p=document.createElement('section');p.id='privateWorkPage';p.className='privateWorkPage timeOffHidden';p.innerHTML='<div style="padding:28px 24px"><h2 style="margin:0 0 6px">Private Work</h2><p style="margin:0;color:#666">Track private jobs from site visit and pricing through approval, preparation, and scheduling.</p></div>';const firstPage=document.getElementById('restorationPage')||document.getElementById('timeOffPage');firstPage?firstPage.insertAdjacentElement('beforebegin',p):tabs.insertAdjacentElement('afterend',p)}
    b.onclick=show;return true;
  }
  function show(){
    document.querySelectorAll('.appTab').forEach(x=>x.classList.toggle('active',x.id==='tabPrivateWork'));
    document.getElementById('timeOffPage')?.classList.remove('active');
    ['restorationPage','onCallPage'].forEach(id=>{const p=document.getElementById(id);p?.classList.remove('active');p?.classList.add('timeOffHidden')});
    scheduleEls().forEach(x=>x.classList.add('timeOffHidden'));
    const p=document.getElementById('privateWorkPage');p?.classList.remove('timeOffHidden');p?.classList.add('active');
  }
  function hide(){const p=document.getElementById('privateWorkPage');p?.classList.remove('active');p?.classList.add('timeOffHidden');document.getElementById('tabPrivateWork')?.classList.remove('active')}
  document.addEventListener('click',e=>{if(['tabSchedule','tabRestoration','tabOnCall','tabTimeOff'].includes(e.target?.id))hide()},true);
  const obs=new MutationObserver(ensure);obs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});ensure();
})();