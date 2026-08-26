(() => {
  'use strict';

  function apply(){
    const tab=document.getElementById('tabTimeOff');
    if(!tab)return;
    const role=(document.querySelector('.roleBadge')?.textContent||'').trim().toLowerCase();
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