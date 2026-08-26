(() => {
  'use strict';

  let timer = null;

  function pad(n){ return String(n).padStart(2,'0'); }
  function isoDate(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

  function nthWeekday(year,month,weekday,n){
    const d=new Date(year,month,1);
    const offset=(weekday-d.getDay()+7)%7;
    d.setDate(1+offset+(n-1)*7);
    return d;
  }

  function lastWeekday(year,month,weekday){
    const d=new Date(year,month+1,0);
    const offset=(d.getDay()-weekday+7)%7;
    d.setDate(d.getDate()-offset);
    return d;
  }

  function companyHolidays(year){
    const fixed=(month,day,name)=>({date:new Date(year,month,day),name});
    const thanksgiving=nthWeekday(year,10,4,4);
    return [
      fixed(0,1,"NEW YEAR'S DAY"),
      {date:lastWeekday(year,4,1),name:'MEMORIAL DAY'},
      fixed(6,4,'INDEPENDENCE DAY'),
      {date:nthWeekday(year,8,1,1),name:'LABOR DAY'},
      {date:thanksgiving,name:'THANKSGIVING DAY'},
      {date:addDays(thanksgiving,1),name:'DAY AFTER THANKSGIVING'},
      fixed(11,24,'CHRISTMAS EVE'),
      fixed(11,25,'CHRISTMAS DAY')
    ];
  }

  function holidayFor(dateString){
    const year=Number(dateString.slice(0,4));
    const matches=[...companyHolidays(year-1),...companyHolidays(year),...companyHolidays(year+1)];
    return matches.find(h=>isoDate(h.date)===dateString) || null;
  }

  function sync(){
    const cells=Array.from(document.querySelectorAll('.dropCell[data-date]'));
    if(!cells.length) return;
    cells.forEach(cell=>{
      cell.querySelectorAll('.scheduleHolidayMarker').forEach(el=>el.remove());
      const holiday=holidayFor(cell.dataset.date || '');
      if(!holiday) return;
      const marker=document.createElement('div');
      marker.className='scheduleHolidayMarker';
      marker.innerHTML=`<strong>${holiday.name}</strong><span>HOLIDAY</span>`;
      const firstJob=cell.querySelector('.jobCard');
      if(firstJob) cell.insertBefore(marker,firstJob);
      else {
        const offMarker=cell.querySelector('.scheduleTimeOffMarker');
        const addButton=cell.querySelector('.addCell');
        if(offMarker) cell.insertBefore(marker,offMarker);
        else if(addButton) cell.insertBefore(marker,addButton);
        else cell.appendChild(marker);
      }
    });
  }

  function queue(){ clearTimeout(timer); timer=setTimeout(sync,80); }
  const observer=new MutationObserver(()=>requestAnimationFrame(queue));
  const app=document.getElementById('app');
  if(app) observer.observe(app,{childList:true,subtree:true});
  document.addEventListener('visibilitychange',()=>{ if(!document.hidden) queue(); });
  window.addEventListener('pageshow',queue);
  queue();
})();