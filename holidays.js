(() => {
  'use strict';

  let timer = null;

  function pad(n){ return String(n).padStart(2,'0'); }
  function isoDate(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }

  function observedDate(d){
    const day=d.getDay();
    if(day===6) return addDays(d,-1);
    if(day===0) return addDays(d,1);
    return d;
  }

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

  function federalHolidays(year){
    const fixed=(month,day,name)=>({date:observedDate(new Date(year,month,day)),name});
    return [
      fixed(0,1,"NEW YEAR'S DAY"),
      {date:nthWeekday(year,0,1,3),name:'MARTIN LUTHER KING JR. DAY'},
      {date:nthWeekday(year,1,1,3),name:"PRESIDENTS' DAY"},
      {date:lastWeekday(year,4,1),name:'MEMORIAL DAY'},
      fixed(5,19,'JUNETEENTH'),
      fixed(6,4,'INDEPENDENCE DAY'),
      {date:nthWeekday(year,8,1,1),name:'LABOR DAY'},
      {date:nthWeekday(year,9,1,2),name:'COLUMBUS DAY'},
      fixed(10,11,'VETERANS DAY'),
      {date:nthWeekday(year,10,4,4),name:'THANKSGIVING DAY'},
      fixed(11,25,'CHRISTMAS DAY')
    ];
  }

  function holidayFor(dateString){
    const year=Number(dateString.slice(0,4));
    const matches=[...federalHolidays(year-1),...federalHolidays(year),...federalHolidays(year+1)];
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
      marker.innerHTML=`<strong>${holiday.name}</strong><span>FEDERAL HOLIDAY</span>`;
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