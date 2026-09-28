(() => {
  'use strict';

  function apply(){
    const tab=document.getElementById('tabTimeOff');
    if(!tab)return;
    const badge=document.querySelector('.roleBadge');if(!badge||badge.dataset.roleReady!=='1')return;const role=(badge.textContent||'').trim().toLowerCase();
    const supervisor=role==='supervisor';
    tab.style.display=supervisor?'':'none';
    if(!supervisor && tab.classList.contains('active')){
      document.getElementById('tabSchedule')?.click();
    }
  }

  const observer=new MutationObserver(apply);
  observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true,characterData:true});
  apply();
})();