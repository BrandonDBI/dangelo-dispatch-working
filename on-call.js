(() => {
'use strict';
const cfg=window.DANGELO_CONFIG||{},BASE=String(cfg.SUPABASE_URL||'').replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');const KEY=String(cfg.SUPABASE_ANON_KEY||'');
let periods=[],assignments=[],templates=[],members=[],role='viewer',current=null,currentDate=null,onCallRealtime=null,onCallRealtimeTimer=null,onCallSelectLocked=false,onCallSelectLockTimer=null,onCallPageOffset=0;
let crews=[];
function pad(n){return String(n).padStart(2,'0')} function iso(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())} function add(d,n){const x=new Date(d);x.setDate(x.getDate()+n);return x}
function nth(y,m,w,n){const d=new Date(y,m,1),o=(w-d.getDay()+7)%7;d.setDate(1+o+(n-1)*7);return d} function last(y,m,w){const d=new Date(y,m+1,0),o=(d.getDay()-w+7)%7;d.setDate(d.getDate()-o);return d}
function holidayBreaks(y){const tg=nth(y,10,4,4);return[
{label:'New Year’s Weekend',start:new Date(y,0,1),end:new Date(y,0,1)},
{label:'Memorial Day Weekend',start:add(last(y,4,1),-2),end:last(y,4,1)},
{label:'Independence Day',start:new Date(y,6,4),end:new Date(y,6,4)},
{label:'Labor Day Weekend',start:add(nth(y,8,1,1),-2),end:nth(y,8,1,1)},
{label:'Thanksgiving Break',start:tg,end:add(tg,3)},
{label:'Christmas Break',start:new Date(y,11,24),end:new Date(y,11,27)}
]}
function nextOnCall(){const now=new Date();now.setHours(0,0,0,0);const dow=now.getDay(),sat=add(now,(6-dow+7)%7),sun=add(sat,1);let choices=[{label:'Weekend',start:sat,end:sun}];for(let y=now.getFullYear();y<=now.getFullYear()+1;y++)choices.push(...holidayBreaks(y));choices=choices.filter(x=>x.end>=now).sort((a,b)=>a.start-b.start);return choices[0]}
async function ensureNextPeriod(){const n=nextOnCall(),s=iso(n.start),e=iso(n.end);let p=periods.find(x=>x.start_date===s&&x.end_date===e);if(!p&&role==='supervisor'){const made=await req('/rest/v1/on_call_periods',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({label:n.label,start_date:s,end_date:e})});p=made?.[0];if(p)periods.unshift(p)}if(p&&current==null)current=p.id;else if(current==null&&periods.length)current=periods[0].id}
const session=()=>{try{return JSON.parse(localStorage.getItem('dangelo_session')||'null')}catch{return null}};
const headers=(x={})=>({apikey:KEY,Authorization:`Bearer ${session()?.access_token||KEY}`,'Content-Type':'application/json',...x});
async function req(path,o={}){const r=await fetch(BASE+path,{...o,headers:{...headers(),...(o.headers||{})}}),t=await r.text();let b=null;try{b=t?JSON.parse(t):null}catch{b=t}if(!r.ok)throw new Error(b?.message||b?.error||b||'Request failed');return b}
const esc=v=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function main(){return document.querySelector('#app main')}
function scheduleEls(){const m=main();if(!m)return[];return [...m.children].filter(el=>!['topbar','appTabs','timeOffPage','restorationPage','onCallPage','privateWorkPage'].some(c=>el.classList.contains(c)))}
function ensure(){const tabs=document.getElementById('appTabs'),m=main();if(!tabs||!m)return false;let b=document.getElementById('tabOnCall');if(!b){b=document.createElement('button');b.id='tabOnCall';b.className='appTab';b.type='button';b.textContent='On Call';const t=document.getElementById('tabTimeOff');t?tabs.insertBefore(b,t):tabs.appendChild(b)}if(!document.getElementById('onCallPage')){const p=document.createElement('section');p.id='onCallPage';p.className='onCallPage timeOffHidden';const t=document.getElementById('timeOffPage');t?t.insertAdjacentElement('beforebegin',p):tabs.insertAdjacentElement('afterend',p)}b.onclick=show;return true}
async function load(){const s=session();if(s?.user?.id){const p=await req(`/rest/v1/profiles?id=eq.${s.user.id}&select=role`);role=p?.[0]?.role||'viewer'}[periods,assignments,templates,members]=await Promise.all([req('/rest/v1/on_call_periods?select=*&order=start_date.desc'),req('/rest/v1/on_call_assignments?select=*&order=normal_crew,employee_name'),req('/rest/v1/on_call_crew_templates?select=*&active=eq.true&order=sort_order'),req('/rest/v1/on_call_crew_members?select=*&order=sort_order')]);crews=templates.map(x=>x.crew_name);await ensureNextPeriod();const cp=periods.find(x=>x.id===current);if(cp&&(!currentDate||currentDate<cp.start_date||currentDate>cp.end_date))currentDate=cp.start_date;render()}

function queueOnCallRealtime(){
  clearTimeout(onCallRealtimeTimer);
  const refresh=()=>{
    const page=document.getElementById('onCallPage');
    if(document.hidden||!page?.classList.contains('active'))return;
    if(onCallSelectLocked||document.activeElement?.matches?.('[data-inline-slot]')){
      onCallRealtimeTimer=setTimeout(refresh,700);
      return;
    }
    load().catch(()=>{});
  };
  onCallRealtimeTimer=setTimeout(refresh,150);
}
function startOnCallRealtime(){
  if(onCallRealtime||!window.supabase?.createClient||!session()?.access_token)return;
  const client=window.supabase.createClient(BASE,KEY,{auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${session().access_token}`}}});
  onCallRealtime=client.channel('on-call-live');
  ['on_call_periods','on_call_assignments','on_call_crew_templates','on_call_crew_members'].forEach(table=>onCallRealtime.on('postgres_changes',{event:'*',schema:'public',table},queueOnCallRealtime));
  onCallRealtime.subscribe();
}
function show(){document.querySelectorAll('.appTab').forEach(x=>x.classList.toggle('active',x.id==='tabOnCall'));['timeOffPage','restorationPage','privateWorkPage'].forEach(id=>{const p=document.getElementById(id);p?.classList.remove('active');p?.classList.add('timeOffHidden')});scheduleEls().forEach(x=>x.classList.add('timeOffHidden'));const p=document.getElementById('onCallPage');p?.classList.remove('timeOffHidden');p?.classList.add('active');load().catch(e=>p.innerHTML='<div class="ocWrap"><div class="ocError">'+esc(e.message)+'</div></div>')}
function hide(){const p=document.getElementById('onCallPage');p?.classList.remove('active');p?.classList.add('timeOffHidden');document.getElementById('tabOnCall')?.classList.remove('active')}
document.addEventListener('click',e=>{if(['tabSchedule','tabPrivateWork','tabRestoration','tabTimeOff'].includes(e.target?.id))hide()},true);
function fmt(d){if(!d)return'';const [y,m,day]=d.split('-');return Number(m)+'/'+Number(day)+'/'+String(y).slice(-2)}
function planDate(a,b){const A=new Date(a+'T12:00:00'),B=new Date(b+'T12:00:00'),am=A.toLocaleString('en-US',{month:'short'}).toUpperCase(),bm=B.toLocaleString('en-US',{month:'short'}).toUpperCase(),ad=A.getDate(),bd=B.getDate();return am===bm?`<span class="ocDateMonth">${am}</span> <strong>${ad}–${bd}</strong>`:`<span class="ocDateMonth">${am}</span> <strong>${ad}</strong> <span class="ocDateDash">–</span> <span class="ocDateMonth">${bm}</span> <strong>${bd}</strong>`}
function periodDays(p){const out=[];for(let d=new Date(p.start_date+'T12:00:00'),end=new Date(p.end_date+'T12:00:00');d<=end;d=add(d,1))out.push(iso(d));return out}
function dayLabel(s){const d=new Date(s+'T12:00:00');return d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase()}
function planDay(s){const d=new Date(s+'T12:00:00');return `<span class="ocDateMonth">${d.toLocaleString('en-US',{month:'short'}).toUpperCase()}</span> <strong>${d.getDate()}</strong><div class="ocDayName">${d.toLocaleString('en-US',{weekday:'short'}).toUpperCase()}</div>`}

function injectStyle(){if(document.getElementById('onCallStyles'))return;const s=document.createElement('style');s.id='onCallStyles';s.textContent=`
.ocWrap{padding:24px 24px 140px;width:100%;max-width:none;margin:0;box-sizing:border-box}.ocHead{padding:14px 16px;border:1px solid rgba(35,31,32,.55);border-bottom:3px solid #ef0714;border-radius:10px;background:rgba(35,31,32,.055)}.ocHead h2{font-family:inherit;font-size:25px;font-weight:700;line-height:1.15;letter-spacing:-.02em;text-transform:none}.ocHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.ocHead h2{margin:0 0 4px}.ocHead p,.ocEmpty p{margin:0;color:#64748b}.ocPrimary{background:#231f20;color:#fff;border:0;border-radius:8px;padding:10px 14px;font-weight:800;cursor:pointer}.ocUpcomingTitle{font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;margin:4px 0 8px;color:#475569}.ocPlanWrap{background:#fff;border:1px solid #dce2e8;border-radius:10px;overflow:auto;margin-bottom:20px}.ocPlanWrap .ocPlanTable{display:table!important;width:100%!important}.ocPlanWrap .ocPlanTable thead{display:table-header-group!important}.ocPlanWrap .ocPlanTable tbody{display:table-row-group!important}.ocPlanWrap .ocPlanTable tr{display:table-row!important}.ocPlanWrap .ocPlanTable th,.ocPlanWrap .ocPlanTable td{display:table-cell!important;box-sizing:border-box!important}.ocPlanWrap .ocPlanRow{width:auto!important;border-radius:0!important;padding:0!important;text-align:left!important}.ocPlanTable{width:100%;border-collapse:collapse;table-layout:fixed}.ocPlanTable th{padding:9px 12px;background:#f4f6f8;text-align:left;font-size:11px;text-transform:uppercase;color:#64748b}.ocPlanTable td{padding:10px 12px;border-top:1px solid #edf0f2}.ocPlanTable tr.ocPlanRow{cursor:pointer}.ocPlanTable tr.ocPlanRow:hover td{background:#f8fafc}.ocPlanTable tr.ocPlanRow.holiday td{background:#f7f4ee}.ocPlanTable tr.ocPlanRow.holiday .ocCoverageName{font-weight:900}.ocPlanTable tr.ocPlanRow.holiday.active td{background:#231f20;color:#fff}.ocPlanTable tr.ocPlanRow.active td{background:#231f20;color:#fff}.ocPlanTable th:first-child{width:24%}.ocPlanTable th:nth-child(2){width:22%}.ocCoverageName{font-weight:800}.ocPlan{background:#fff;border:1px solid #dce2e8;border-radius:10px;overflow:hidden;margin-bottom:20px}.ocPlanHead,.ocPlanRow{display:grid;grid-template-columns:1.35fr 1.2fr 1fr 1fr 1fr;align-items:center;gap:10px;padding:9px 12px}.ocPlanHead{background:#f4f6f8;font-size:11px;font-weight:900;text-transform:uppercase;color:#64748b}.ocPlanRow{width:100%;border:0;border-top:1px solid #edf0f2;background:#fff;text-align:left;font:inherit;cursor:pointer}.ocPlanRow:hover{background:#f8fafc}.ocPlanRow.active{background:#231f20;color:#fff}.ocPlanRow.active .ocCoverageName{color:#fff}.ocCoverageName{font-weight:800}.ocPlanRow .ocCoverageName:not(:first-child){}.ocPeriods{display:flex;gap:8px;overflow:auto;margin-bottom:18px;padding-bottom:3px}.ocPeriod{border:1px solid #d6dde5;background:#fff;border-radius:9px;padding:8px 12px;text-align:left;white-space:nowrap;cursor:pointer}.ocPeriod.active{background:#231f20;color:#fff;border-color:#231f20}.ocPeriod strong,.ocPeriod span{display:block}.ocPeriod span{font-size:11px;opacity:.72;margin-top:2px}.ocToolbar{display:flex;justify-content:space-between;align-items:center;margin:12px 0}.ocToolbar h3{margin:0}.ocLegend{font-size:12px;color:#64748b}.ocDayTabs{display:flex;gap:8px;overflow:auto;margin:0 0 12px;padding-bottom:2px}.ocDayTab{border:1px solid #cbd3db;background:#fff;border-radius:8px;padding:8px 11px;font-size:12px;font-weight:800;white-space:nowrap;cursor:pointer}.ocDayTab.active{background:#231f20;color:#fff;border-color:#231f20}.ocDayName{margin-top:2px;font-size:10px;font-weight:800;color:#7b838c}.ocPlanRow.active .ocDayName{color:#c7cbd0}
.ocExpandRow td{padding:0!important;background:#f7f8fa!important;border-top:0!important}
.ocInlineEditor{padding:12px 14px 14px;border-top:2px solid #231f20}
.ocPeriodStack{display:grid;gap:14px}
.ocCoverageNav{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;margin:4px 0 10px}
.ocCoverageNav .ocUpcomingTitle{margin:0}
.ocCoverageRange{display:block;margin-top:3px;font-size:12px;color:#64748b;font-weight:700}
.ocCoverageNavBtns{display:flex;gap:7px;flex-wrap:wrap}
.ocCoverageNavBtns button{padding:7px 11px;border:1px solid #cbd3db;border-radius:7px;background:#fff;color:#231f20;font-weight:800;cursor:pointer}
.ocCoverageNavBtns button:hover:not(:disabled){border-color:#231f20;background:#f4f6f8}
.ocCoverageNavBtns button:disabled{opacity:.35;cursor:default}
.ocCoverageNavBtns .ocAddCoverage{border-color:rgba(239,7,20,.35);background:rgba(239,7,20,.055);color:#8f1118}
.ocCoverageNavBtns .ocAddCoverage:hover:not(:disabled){border-color:rgba(239,7,20,.7);background:rgba(239,7,20,.09)}
.ocModalHint{margin:-2px 0 12px;color:#64748b;font-size:12px;line-height:1.4}

.ocRosterEditorModal{width:min(720px,calc(100vw - 40px))!important;box-sizing:border-box}.ocRosterEditList{display:grid;gap:8px;margin-top:12px;min-width:0}.ocRosterEditRow{display:grid;grid-template-columns:minmax(170px,.9fr) minmax(0,1.35fr) 38px;gap:10px;align-items:center;width:100%;min-width:0;box-sizing:border-box;padding:9px 10px;border:1px solid #e1e5ea;border-radius:8px;background:#fafbfc;overflow:hidden}.ocRosterCurrent{min-width:0}.ocRosterEditRow>div strong,.ocRosterEditRow>div small{display:block}.ocRosterEditRow>div strong{font-size:14px}.ocRosterEditRow>div small{margin-top:2px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ocRosterEditRow select{display:block;width:100%;min-width:0;max-width:100%;box-sizing:border-box;padding:8px 30px 8px 9px;border:1px solid #cbd3db;border-radius:7px;background:#fff;font-weight:700}.ocRosterRemove{width:38px;height:36px;min-width:38px;padding:0;border:1px solid #e0b9bc;border-radius:7px;background:#fff;color:#a20d15;font-size:18px;font-weight:800;cursor:pointer}.ocRosterAdd{margin-top:10px;padding:8px 11px;border:1px solid #cbd3db;border-radius:7px;background:#fff;font-weight:800;cursor:pointer}.ocRosterAdd:hover{border-color:#231f20}@media(max-width:700px){.ocRosterEditorModal{width:min(94vw,540px)!important}.ocRosterEditRow{grid-template-columns:1fr 38px}.ocRosterEditRow .ocRosterSwap{grid-column:1/-1;grid-row:2}.ocRosterCurrent{grid-column:1}.ocRosterRemove{grid-column:2;grid-row:1}}
@media(max-width:700px){.ocCoverageNav{align-items:flex-start;flex-direction:column}.ocCoverageNavBtns{width:100%}.ocCoverageNavBtns button{flex:1;min-height:40px}}

.ocPeriodBlock{background:#fff;border:1px solid #dce2e8;border-radius:10px;overflow:hidden}
.ocPeriodBlock.holiday{box-shadow:inset 4px 0 0 var(--oc-red)}
.ocPeriodBlockHead{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:11px 14px;background:rgba(239,7,20,.07);border-bottom:2px solid rgba(239,7,20,.78)}
.ocPeriodBlockHead strong{font-size:14px}.ocPeriodBlockHead span{font-size:11px;color:#64748b}
.ocPeriodHeadActions{display:flex;align-items:center;gap:9px}
.ocDeletePeriod{width:26px;height:26px;border:1px solid rgba(143,17,24,.22);border-radius:6px;background:rgba(255,255,255,.65);color:#8f1118;font-size:18px;line-height:20px;font-weight:700;cursor:pointer;padding:0}
.ocDeletePeriod:hover{border-color:rgba(143,17,24,.55);background:rgba(239,7,20,.08)}
.ocPeriodDays{padding:0 14px}
@media(max-width:700px){.ocPeriodBlockHead{align-items:flex-start}.ocPeriodHeadActions>span{display:none}.ocPeriodDays{padding:0 10px}}

.ocInlineHead{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
.ocInlineHead strong{font-size:13px}.ocInlineHead span{font-size:11px;color:#64748b}
.ocDayAssign{display:grid;grid-template-columns:150px 1fr 1fr 1fr;gap:10px;align-items:end;padding:9px 0;border-top:1px solid #e1e5ea}
.ocDayAssign:first-of-type{border-top:0}
.ocDayAssignDate strong{display:block;font-size:13px}.ocDayAssignDate span{font-size:11px;color:#64748b}
.ocAssignField{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:end}
.ocAssignField label{display:block;font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase}
.ocAssignField select{width:100%;padding:8px;border:1px solid #cbd3db;border-radius:7px;background:#fff;font-weight:700}
.ocRosterBtn{height:34px;padding:0 9px;border:1px solid #cbd3db;border-radius:7px;background:#fff;font-size:11px;font-weight:800;cursor:pointer}
.ocRosterModalList{display:grid;gap:0;border:1px solid #e1e5ea;border-radius:8px;overflow:hidden}
.ocRosterModalRow{display:flex;justify-content:space-between;gap:14px;padding:9px 11px;border-top:1px solid #edf0f2}
.ocRosterModalRow:first-child{border-top:0}.ocRosterModalRow small{color:#64748b}
@media(max-width:700px){.ocDayAssign{grid-template-columns:1fr;gap:7px}.ocAssignField{grid-template-columns:1fr auto}.ocInlineHead{align-items:flex-start}.ocInlineEditor{padding:10px}.ocRosterBtn{min-width:54px}}.ocGroups{display:grid;gap:10px}.ocGroup{background:#fff;border:1px solid #dce2e8;border-radius:10px;overflow:hidden}.ocGroupHead{display:flex;justify-content:space-between;align-items:center;background:#f4f6f8;padding:9px 12px}.ocGroupHead strong{text-transform:uppercase;font-size:12px}.ocAdd{border:0;background:transparent;font-weight:800;cursor:pointer}.ocPerson{display:grid;grid-template-columns:minmax(150px,1fr) 110px 220px;align-items:center;gap:10px;padding:9px 12px;border-top:1px solid #edf0f2}.ocPerson small{color:#64748b}.ocCrewBtns{display:flex;gap:5px}.ocCrewBtns button{width:38px;height:32px;border:1px solid #cbd3db;background:#fff;border-radius:7px;font-weight:800;cursor:pointer}.ocCrewBtns button.sel{background:#231f20;color:#fff;border-color:#231f20}.ocEmpty{padding:38px 20px;text-align:center;background:#fff;border:1px dashed #cbd3db;border-radius:10px}.ocSlots{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.ocSlot{background:#fff;border:1px solid #dce2e8;border-radius:10px;overflow:hidden;min-height:220px}.ocSlotHead{padding:12px;background:#f4f6f8;border-bottom:1px solid #e1e6eb}.ocSlotHead strong{display:block;margin-bottom:8px}.ocSlotHead select{width:100%;padding:9px;border:1px solid #cbd3db;border-radius:7px;background:#fff;font-weight:700}.ocRoster{padding:7px 12px}.ocRosterRow{display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid #edf0f2}.ocRosterRow span small{display:block;color:#64748b}.ocRosterRow button{border:0;background:transparent;font-size:18px;cursor:pointer}.ocSlotEmpty{padding:40px 12px;text-align:center;color:#94a3b8}.ocPersonRemove{display:none!important}.ocSlot.editing .ocPersonRemove{display:block!important}.onCallPage{--oc-red:#ef0714;--oc-red-dark:#ef0714;--oc-black:#231f20;--oc-gray:#eef0f2;--oc-gray-dark:#5f666d}.onCallPage{max-width:none!important;width:100%;box-sizing:border-box}.ocUpcomingTitle{border-left:4px solid var(--oc-red);padding-left:8px}.ocPlanTable th{border-bottom:2px solid var(--oc-black)}.ocPlanTable tr.ocPlanRow.active td{background:var(--oc-black)!important;color:#fff}.ocPlanTable tr.ocPlanRow.holiday td{box-shadow:inset 4px 0 0 var(--oc-red)}.ocSlot{border-top:4px solid var(--oc-red)}.ocSlotHead{background:var(--oc-gray)}.ocSlotHead strong{color:var(--oc-black)}.ocSlotHead select:focus{outline:2px solid var(--oc-red);outline-offset:1px}.ocDateCell strong{font-weight:850}.ocDateMonth{font-size:11px;font-weight:800;color:#7b838c;letter-spacing:.04em}.ocDateDash{color:#9aa1a8;margin:0 2px}.ocPlanRow.active .ocDateMonth,.ocPlanRow.active .ocDateDash{color:#c7cbd0}.ocWeekendActions{display:flex;gap:8px;margin:8px 12px 12px}.ocEditWeekend{display:inline-block;margin:0;padding:7px 12px;border:1px solid var(--oc-black);border-radius:7px;background:#fff;color:var(--oc-black);font-weight:800;cursor:pointer}.ocEditWeekend:hover{background:var(--oc-black);color:#fff}.ocWeekendActions .ocEditWeekend:last-child{border-color:var(--oc-red);color:var(--oc-red)}.ocWeekendActions .ocEditWeekend:last-child:hover{background:var(--oc-red);color:#fff}.ocSlotOptional{opacity:.82}.ocSlotOptional .ocSlotEmpty{padding:22px 12px}.ocModalBack{position:fixed;inset:0;background:#0008;display:flex;align-items:center;justify-content:center;z-index:10000}.ocModal{background:#fff;border-radius:12px;padding:20px;width:min(430px,calc(100vw - 30px));box-shadow:0 20px 60px #0004}.ocModal h3{margin-top:0}.ocModal label{display:block;font-weight:700;font-size:12px;margin:10px 0}.ocModal input,.ocModal select{display:block;width:100%;box-sizing:border-box;padding:9px;margin-top:4px;border:1px solid #cbd3db;border-radius:7px}.ocActions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px}.ocActions button{padding:9px 13px;border-radius:7px;border:1px solid #cbd3db;background:#fff;font-weight:700}.ocActions .ocPrimary{background:#231f20;color:#fff;border-color:#231f20}@media(max-width:700px){
.ocWrap{padding:14px 12px 120px}
.ocHead{align-items:center;padding:12px 14px}
.ocHead h2{font-size:22px}
.ocUpcomingTitle{margin:18px 0 10px}
.ocPlanWrap{overflow:visible;border-radius:10px}
.ocPlanWrap .ocPlanTable{display:block!important}
.ocPlanWrap .ocPlanTable thead{display:none!important}
.ocPlanWrap .ocPlanTable tbody{display:block!important}
.ocPlanWrap .ocPlanTable tr.ocPlanRow{display:grid!important;grid-template-columns:88px minmax(0,1fr);gap:3px 12px;padding:12px 14px!important;border-top:1px solid #e3e7ed!important}
.ocPlanWrap .ocPlanTable tr.ocPlanRow:first-child{border-top:0!important}
.ocPlanWrap .ocPlanTable td{display:block!important;padding:0!important;border:0!important;min-width:0}
.ocPlanRow .ocDateCell{grid-row:1 / span 4;align-self:start}
.ocPlanRow .ocCoverageName{grid-column:2;font-weight:900}
.ocPlanRow td:nth-child(3),.ocPlanRow td:nth-child(4),.ocPlanRow td:nth-child(5){grid-column:2;font-size:13px;line-height:1.35}
.ocPlanRow td:nth-child(3)::before{content:"Crew 1  ";font-size:10px;font-weight:800;color:#7b838c;text-transform:uppercase}
.ocPlanRow td:nth-child(4)::before{content:"Crew 2  ";font-size:10px;font-weight:800;color:#7b838c;text-transform:uppercase}
.ocPlanRow td:nth-child(5)::before{content:"Crew 3  ";font-size:10px;font-weight:800;color:#7b838c;text-transform:uppercase}
.ocPlanTable tr.ocPlanRow.active td{background:transparent!important;color:#fff}
.ocPlanTable tr.ocPlanRow.active{background:var(--oc-black)!important;color:#fff}
.ocPlanRow.active td:nth-child(3)::before,.ocPlanRow.active td:nth-child(4)::before,.ocPlanRow.active td:nth-child(5)::before{color:#c7cbd0}
.ocPlanTable tr.ocPlanRow.holiday td{box-shadow:none}
.ocPlanTable tr.ocPlanRow.holiday{box-shadow:inset 4px 0 0 var(--oc-red);background:#f7f4ee}
.ocSlots{grid-template-columns:1fr}
.ocToolbar h3{font-size:18px}
.ocPerson{grid-template-columns:1fr auto}
.ocPerson small{display:none}
.ocCrewBtns{grid-column:2}
.ocLegend{display:none}
.ocHead{display:none!important}
.ocCoverageNav{margin-top:2px!important;gap:8px!important}
.ocCoverageNavBtns{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:6px!important}
.ocCoverageNavBtns button{width:100%!important;min-height:38px!important;padding:7px 8px!important;font-size:12px!important}
.ocPeriodStack{gap:14px!important}
.ocMobilePeriod{background:#fff;border:1px solid #dce2e8;border-radius:14px;overflow:hidden;box-shadow:0 2px 8px rgba(15,23,42,.04)}
.ocMobilePeriod.holiday{box-shadow:inset 4px 0 0 var(--oc-red),0 2px 8px rgba(15,23,42,.04)}
.ocMobilePeriodHead{padding:14px 16px;background:#231f20;color:#fff;border-bottom:0}
.ocMobilePeriodHead>div{display:flex;align-items:baseline;gap:9px}
.ocMobilePeriodKicker{font-size:10px;font-weight:900;letter-spacing:.09em;color:#f2b4b8}
.ocMobilePeriodHead strong{font-size:18px;letter-spacing:-.01em}
.ocMobileDay{padding:13px 16px 14px;border-top:1px solid #edf0f2;background:#fff}
.ocMobileDay:first-of-type{border-top:0}
.ocMobileDay+ .ocMobileDay{border-top:3px solid #d7dde4;padding-top:16px;background:#fafbfc}
.ocMobileDate{display:flex;align-items:baseline;gap:8px;margin-bottom:9px}
.ocMobileDate strong{font-size:13px;letter-spacing:.06em;color:#475569}
.ocMobileDate span{font-size:12px;color:#94a3b8;font-weight:700}
.ocMobileCrews{display:grid;gap:8px}
.ocMobileCrew{padding:10px 0 0;border:0;border-top:1px solid #edf0f2;background:transparent}
.ocMobileCrew:first-child{border-top:0;padding-top:0}
.ocMobileCrewTop{display:flex;align-items:center;gap:8px;margin-bottom:2px}
.ocMobileCrewBadge{display:inline-flex;align-items:center;justify-content:center;min-width:54px;padding:3px 7px;border-radius:999px;background:rgba(239,7,20,.09);color:#a20d15;font-size:9px;font-weight:900;letter-spacing:.06em}
.ocMobileCrewTop strong{font-size:12px;letter-spacing:.04em;color:#64748b}
.ocMobileLead{font-size:20px;font-weight:900;letter-spacing:-.02em;color:#111827;line-height:1.05;margin:2px 0 4px}
.ocMobileNames{font-size:13px;line-height:1.4;color:#64748b;font-weight:700}
}`;document.head.appendChild(s)}
function periodSummaryCrew(p,n){
  const days=periodDays(p);
  const perDay=days.map(d=>{
    const names=[...new Set(assignments.filter(a=>a.period_id===p.id&&a.assignment_date===d&&a.on_call_crew===n).map(a=>a.normal_crew).filter(Boolean))];
    return names.length===1?names[0]:'';
  });
  const unique=[...new Set(perDay.filter(Boolean))];
  if(!unique.length)return '—';
  return unique.length===1?unique[0].toUpperCase():'VARIES';
}
function assignmentCrew(periodId,date,n){
  const names=[...new Set(assignments.filter(a=>a.period_id===periodId&&a.assignment_date===date&&a.on_call_crew===n).map(a=>a.normal_crew).filter(Boolean))];
  return names.length===1?names[0]:'';
}
function inlineAssignField(p,date,n){
  const selected=assignmentCrew(p.id,date,n);
  const rosterBtn=selected?`<button type="button" class="ocRosterBtn" data-roster-period="${p.id}" data-roster-date="${date}" data-roster-slot="${n}">Roster</button>`:'';
  if(role!=='supervisor')return `<div class="ocAssignField"><div><label>Crew ${n}</label><strong>${esc(selected||'—')}</strong></div>${rosterBtn}</div>`;
  return `<div class="ocAssignField"><div><label>Crew ${n}${n===3?' (optional)':''}</label><select data-inline-slot="${n}" data-inline-date="${date}" data-inline-period="${p.id}"><option value="">${n===3?'None':'Select crew…'}</option>${crews.map(cr=>`<option value="${esc(cr)}" ${selected===cr?'selected':''}>${esc(cr.toUpperCase())}</option>`).join('')}</select></div>${rosterBtn}</div>`;
}
function inlinePeriodEditor(p){
  return `<tr class="ocExpandRow"><td colspan="5"><div class="ocInlineEditor"><div class="ocInlineHead"><strong>${esc(String(p.label||'').toUpperCase())} · ${fmt(p.start_date)} – ${fmt(p.end_date)}</strong><span>Assign two crews for each day</span></div>${periodDays(p).map(d=>{const dt=new Date(d+'T12:00:00');return `<div class="ocDayAssign"><div class="ocDayAssignDate"><strong>${esc(dt.toLocaleDateString('en-US',{weekday:'long'}))}</strong><span>${esc(dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}))}</span></div>${inlineAssignField(p,d,1)}${inlineAssignField(p,d,2)}${inlineAssignField(p,d,3)}</div>`}).join('')}</div></td></tr>`;
}
function mobileCrewRoster(periodId,date,n){
  const rows=assignments.filter(a=>a.period_id===periodId&&a.assignment_date===date&&a.on_call_crew===n);
  if(!rows.length)return '';
  const crewNames=[...new Set(rows.map(a=>a.normal_crew).filter(Boolean))];
  const crewLabel=crewNames.length===1?crewNames[0]:'Crew '+n;
  const rank={'Foreman':0,'Operator':1,'Truck Driver':2,'Driver':2,'Laborer':3};
  const sorted=[...rows].sort((a,b)=>(rank[a.role]??9)-(rank[b.role]??9)||String(a.employee_name||'').localeCompare(String(b.employee_name||'')));
  const lead=sorted[0]?.employee_name||crewLabel;
  const rest=sorted.slice(1).map(a=>esc(a.employee_name)).join(' · ');
  return '<div class="ocMobileCrew"><div class="ocMobileCrewTop"><span class="ocMobileCrewBadge">CREW '+n+'</span><strong>'+esc(String(crewLabel).toUpperCase())+'</strong></div><div class="ocMobileLead">'+esc(lead)+'</div>'+(rest?'<div class="ocMobileNames">'+rest+'</div>':'')+'</div>';
}
function mobilePeriodBlock(p){
  const A=new Date(p.start_date+'T12:00:00'),B=new Date(p.end_date+'T12:00:00');
  const range=A.toLocaleString('en-US',{month:'short'}).toUpperCase()+' '+A.getDate()+(A.getMonth()===B.getMonth()?'–'+B.getDate():' – '+B.toLocaleString('en-US',{month:'short'}).toUpperCase()+' '+B.getDate());
  return '<section class="ocMobilePeriod '+(p.label!=='Weekend'?'holiday':'')+'"><div class="ocMobilePeriodHead"><div><span class="ocMobilePeriodKicker">'+esc(String(p.label||'').toUpperCase())+'</span><strong>'+esc(range)+'</strong></div></div>'+periodDays(p).map(d=>{const dt=new Date(d+'T12:00:00');return '<div class="ocMobileDay"><div class="ocMobileDate"><strong>'+esc(dt.toLocaleDateString('en-US',{weekday:'long'}).toUpperCase())+'</strong><span>'+esc(dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}))+'</span></div><div class="ocMobileCrews">'+mobileCrewRoster(p.id,d,1)+mobileCrewRoster(p.id,d,2)+mobileCrewRoster(p.id,d,3)+'</div></div>'}).join('')+'</section>';
}
function render(){
  injectStyle();
  const p=document.getElementById('onCallPage');
  if(!p)return;

  const upcomingRaw=periods.filter(x=>x.end_date>=iso(new Date()));
  const allUpcoming=upcomingRaw
    .filter(x=>!upcomingRaw.some(h=>{
      if(h.id===x.id)return false;
      const contains=h.start_date<=x.start_date&&h.end_date>=x.end_date;
      if(!contains)return false;
      const strictlyBroader=h.start_date<x.start_date||h.end_date>x.end_date;
      const sameDates=h.start_date===x.start_date&&h.end_date===x.end_date;
      return strictlyBroader||(sameDates&&Number(h.id)>Number(x.id));
    }))
    .sort((a,b)=>a.start_date.localeCompare(b.start_date));

  if(!allUpcoming.length){
    p.innerHTML='<div class="ocWrap"><div class="ocHead"><div><h2>ON CALL</h2></div></div><div class="ocEmpty"><p>No upcoming on-call periods.</p></div></div>';
    return;
  }

  const maxOffset=Math.max(0,Math.floor((allUpcoming.length-1)/4)*4);
  onCallPageOffset=Math.min(Math.max(0,onCallPageOffset),maxOffset);
  const visible=allUpcoming.slice(onCallPageOffset,onCallPageOffset+4);
  const rangeStart=visible[0],rangeEnd=visible[visible.length-1];

  const mobile=window.matchMedia('(max-width:700px)').matches;
  p.innerHTML=`<div class="ocWrap">
    <div class="ocHead"><div><h2>ON CALL</h2></div></div>
    <div class="ocCoverageNav">
      <div>
        <div class="ocUpcomingTitle">Coverage Schedule</div>
        <span class="ocCoverageRange">${fmt(rangeStart.start_date)} – ${fmt(rangeEnd.end_date)}</span>
      </div>
      <div class="ocCoverageNavBtns">
        ${!mobile&&role==='supervisor'?'<button type="button" id="ocAddCoverage" class="ocAddCoverage">+ Add Days / Break</button>':''}
        <button type="button" id="ocPrevPeriods" ${onCallPageOffset===0?'disabled':''}>‹ Earlier</button>
        <button type="button" id="ocCurrentPeriods" ${onCallPageOffset===0?'disabled':''}>Current</button>
        <button type="button" id="ocNextPeriods" ${onCallPageOffset+4>=allUpcoming.length?'disabled':''}>Later ›</button>
      </div>
    </div>
    <div class="ocPeriodStack">${mobile?visible.map(mobilePeriodBlock).join(''):visible.map(periodBlock).join('')}</div>
  </div>`;

  p.querySelector('#ocAddCoverage')?.addEventListener('click',periodModal);
  p.querySelector('#ocPrevPeriods')?.addEventListener('click',()=>{onCallPageOffset=Math.max(0,onCallPageOffset-4);render()});
  p.querySelector('#ocCurrentPeriods')?.addEventListener('click',()=>{onCallPageOffset=0;render()});
  p.querySelector('#ocNextPeriods')?.addEventListener('click',()=>{onCallPageOffset=Math.min(maxOffset,onCallPageOffset+4);render()});

  p.querySelectorAll('[data-inline-slot]').forEach(sel=>{
    const lock=()=>{
      onCallSelectLocked=true;
      clearTimeout(onCallSelectLockTimer);
      onCallSelectLockTimer=setTimeout(()=>{onCallSelectLocked=false},15000);
    };
    const unlockSoon=()=>{
      clearTimeout(onCallSelectLockTimer);
      onCallSelectLockTimer=setTimeout(()=>{onCallSelectLocked=false;queueOnCallRealtime()},350);
    };
    sel.addEventListener('pointerdown',lock);
    sel.addEventListener('mousedown',lock);
    sel.addEventListener('focus',lock);
    sel.addEventListener('keydown',lock);
    sel.addEventListener('change',async()=>{
      lock();
      await setSlot(
        Number(sel.dataset.inlinePeriod),
        sel.dataset.inlineDate,
        Number(sel.dataset.inlineSlot),
        sel.value
      );
      unlockSoon();
    });
    sel.addEventListener('blur',()=>setTimeout(()=>{
      if(document.activeElement!==sel) unlockSoon();
    },250));
  });

  p.querySelectorAll('[data-roster-period]').forEach(b=>b.onclick=e=>{
    e.stopPropagation();
    showDayRoster(Number(b.dataset.rosterPeriod),b.dataset.rosterDate,Number(b.dataset.rosterSlot));
  });

  p.querySelectorAll('[data-delete-period]').forEach(b=>b.onclick=async e=>{
    e.stopPropagation();
    const id=Number(b.dataset.deletePeriod);
    const period=periods.find(x=>x.id===id);
    if(!period||role!=='supervisor')return;
    if(!confirm('Remove '+period.label+' ('+fmt(period.start_date)+' – '+fmt(period.end_date)+') from the on-call schedule?'))return;
    await req('/rest/v1/on_call_assignments?period_id=eq.'+id,{method:'DELETE'});
    await req('/rest/v1/on_call_periods?id=eq.'+id,{method:'DELETE'});
    if(current===id)current=null;
    await load();
  });
}
function periodBlock(p){
  return `<section class="ocPeriodBlock ${p.label!=='Weekend'?'holiday':''}">
    <div class="ocPeriodBlockHead">
      <strong>${esc(String(p.label||'').toUpperCase())} · ${fmt(p.start_date)} – ${fmt(p.end_date)}</strong>
      <div class="ocPeriodHeadActions">
        <span>Assign two crews for each day</span>
        ${role==='supervisor'?'<button type="button" class="ocDeletePeriod" data-delete-period="'+p.id+'" title="Remove this coverage period" aria-label="Remove coverage period">×</button>':''}
      </div>
    </div>
    <div class="ocPeriodDays">
      ${periodDays(p).map(d=>{
        const dt=new Date(d+'T12:00:00');
        return `<div class="ocDayAssign">
          <div class="ocDayAssignDate">
            <strong>${esc(dt.toLocaleDateString('en-US',{weekday:'long'}))}</strong>
            <span>${esc(dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}))}</span>
          </div>
          ${inlineAssignField(p,d,1)}
          ${inlineAssignField(p,d,2)}
          ${inlineAssignField(p,d,3)}
        </div>`;
      }).join('')}
    </div>
  </section>`;
}
function planRow(p){return `<tr class="ocPlanRow ${p.id===current?'active':''} ${p.label!=='Weekend'?'holiday':''}" data-period="${p.id}"><td class="ocDateCell">${planDate(p.start_date,p.end_date)}</td><td class="ocCoverageName">${esc(p.label)}</td><td>${esc(periodSummaryCrew(p,1))}</td><td>${esc(periodSummaryCrew(p,2))}</td><td>${esc(periodSummaryCrew(p,3))}</td></tr>`}
function fullRosterOptions(){
  return templates.map(t=>{
    const opts=members.filter(m=>m.crew_id===t.id).sort((a,b)=>(a.sort_order??0)-(b.sort_order??0)).map(m=>{
      return '<option value="'+m.id+'">'+esc(m.employee_name)+(m.role?' — '+esc(m.role):'')+'</option>';
    }).join('');
    return opts?'<optgroup label="'+esc(String(t.crew_name||'').toUpperCase())+'">'+opts+'</optgroup>':'';
  }).join('');
}
async function changeDayRosterPerson(assignmentId,memberId,periodId,date,slot){
  if(role!=='supervisor')return;
  const a=assignments.find(x=>x.id===assignmentId),m=members.find(x=>x.id===memberId),t=templates.find(x=>x.id===m?.crew_id);
  if(!a||!m||!t)return;
  if(a.employee_name===m.employee_name)return;
  const other=assignments.find(x=>x.period_id===periodId&&x.assignment_date===date&&x.id!==a.id&&x.employee_name===m.employee_name);
  const originalPerson={employee_name:a.employee_name,role:a.role};
  if(other){
    await req('/rest/v1/on_call_assignments?id=eq.'+other.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify(originalPerson)});
  }
  await req('/rest/v1/on_call_assignments?id=eq.'+a.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({employee_name:m.employee_name,role:m.role})});
  await load();
  showDayRoster(periodId,date,slot);
}
function showDayRoster(periodId,date,slot){
  const p=periods.find(x=>x.id===periodId),rows=assignments.filter(a=>a.period_id===periodId&&a.assignment_date===date&&a.on_call_crew===slot);
  const rank={'Foreman':0,'Operator':1,'Truck Driver':2,'Driver':2,'Laborer':3};
  rows.sort((a,b)=>(rank[a.role]??9)-(rank[b.role]??9)||String(a.employee_name||'').localeCompare(String(b.employee_name||'')));
  const dt=new Date(date+'T12:00:00'),title='Crew '+slot+' · '+dt.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'});
  const editable=role==='supervisor';
  const rowHtml=rows.map(a=>{
    if(!editable)return '<div class="ocRosterModalRow"><strong>'+esc(a.employee_name)+'</strong><small>'+esc(a.role||'')+'</small></div>';
    return '<div class="ocRosterEditRow" data-assignment-id="'+a.id+'"><div class="ocRosterCurrent"><strong>'+esc(a.employee_name)+'</strong><small>'+esc((a.normal_crew||'')+(a.role?' · '+a.role:''))+'</small></div><select class="ocRosterSwap"><option value="" selected>Replace with…</option>'+fullRosterOptions()+'</select><button type="button" class="ocRosterRemove" title="Remove from this day">×</button></div>';
  }).join('')||'<div class="ocSlotEmpty">No one is assigned to this crew.</div>';
  const b=modal('<h3>'+esc(title)+'</h3><p class="ocModalHint">'+esc(p?.label||'On Call')+' · Changes apply only to this date.</p><div class="ocRosterEditList">'+rowHtml+'</div>'+(editable?'<button type="button" id="ocRosterAdd" class="ocRosterAdd">+ Add Person</button>':'')+'<div class="ocActions"><button data-cancel>Close</button></div>');b.querySelector('.ocModal')?.classList.add('ocRosterEditorModal');
  if(!editable)return;
  b.querySelectorAll('.ocRosterEditRow').forEach(row=>{
    const assignmentId=Number(row.dataset.assignmentId),sel=row.querySelector('.ocRosterSwap');
    sel.onchange=async()=>{const memberId=Number(sel.value);if(!memberId)return;sel.disabled=true;try{b.remove();await changeDayRosterPerson(assignmentId,memberId,periodId,date,slot)}catch(e){alert(e.message);await load()}};
    row.querySelector('.ocRosterRemove').onclick=async()=>{if(!confirm('Remove this person from this on-call crew for '+dt.toLocaleDateString('en-US')+'?'))return;await req('/rest/v1/on_call_assignments?id=eq.'+assignmentId,{method:'DELETE'});b.remove();await load();showDayRoster(periodId,date,slot)};
  });
  b.querySelector('#ocRosterAdd')?.addEventListener('click',()=>{b.remove();addDayRosterPerson(periodId,date,slot)});
}
function addDayRosterPerson(periodId,date,slot){
  const b=modal('<h3>Add Person · Crew '+slot+'</h3><p class="ocModalHint">This adds the employee only to this on-call date.</p><label>Employee<select id="ocDayRosterPerson"><option value="">Select employee…</option>'+fullRosterOptions()+'</select></label><div class="ocActions"><button data-cancel>Cancel</button><button id="ocDayRosterAdd" class="ocPrimary">Add</button></div>');
  b.querySelector('#ocDayRosterAdd').onclick=async()=>{
    const memberId=Number(b.querySelector('#ocDayRosterPerson').value),m=members.find(x=>x.id===memberId),t=templates.find(x=>x.id===m?.crew_id);
    if(!m||!t)return;
    const existing=assignments.find(x=>x.period_id===periodId&&x.assignment_date===date&&x.employee_name===m.employee_name);
    if(existing)return alert(m.employee_name+' is already assigned on call that day. Use a roster dropdown to swap them instead.');
    await req('/rest/v1/on_call_assignments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({period_id:periodId,assignment_date:date,employee_name:m.employee_name,normal_crew:t.crew_name,role:m.role,on_call_crew:slot})});
    b.remove();await load();showDayRoster(periodId,date,slot);
  };
}
function slotHtml(n,rows){const rank={'Operator':1,'Truck Driver':2,'Driver':2,'Laborer':3,'Foreman':0};const people=rows.filter(a=>a.on_call_crew===n).sort((a,b)=>{const r=(rank[a.role]??9)-(rank[b.role]??9);if(r)return r;const ta=templates.find(t=>t.crew_name===a.normal_crew),tb=templates.find(t=>t.crew_name===b.normal_crew),ma=members.find(m=>m.crew_id===ta?.id&&m.employee_name===a.employee_name),mb=members.find(m=>m.crew_id===tb?.id&&m.employee_name===b.employee_name);return (ma?.sort_order??99)-(mb?.sort_order??99)}),names=[...new Set(people.map(a=>a.normal_crew).filter(Boolean))],selected=names.length===1?names[0]:'';return `<section class="ocSlot ${!people.length&&n===3?'ocSlotOptional':''}"><div class="ocSlotHead"><strong>ON CALL CREW ${n}${selected?' — '+esc(selected.toUpperCase()):''}</strong>${role==='supervisor'?`<select data-slot="${n}"><option value="">Select normal crew…</option>${crews.map(c=>`<option value="${esc(c)}" ${selected===c?'selected':''} >${esc(c.toUpperCase())}</option>`).join('')}</select>`:''}</div>${people.length?`<div class="ocRoster">${people.map(a=>`<div class="ocRosterRow"><span><b>${esc(a.employee_name)}</b><small>${esc(a.role||'')}</small></span><button class="ocPersonRemove" data-remove-person="${a.id}">×</button></div>`).join('')}</div>${role==='supervisor'?'<div class="ocWeekendActions"><button class="ocEditWeekend" data-edit-weekend="'+n+'">Edit</button><button class="ocEditWeekend" data-add-weekend="'+n+'">+ Add Person</button></div>':''}`:'<div class="ocSlotEmpty">'+(n===3?'Optional third crew':'No crew assigned')+'</div>'}</section>`}
function addWeekendPerson(periodId,assignmentDate,n){const opts=templates.flatMap(t=>members.filter(m=>m.crew_id===t.id).map(m=>`<option value="${m.id}">${esc(m.employee_name)} — ${esc(t.crew_name.toUpperCase())} · ${esc(m.role)}</option>`)).join('');const b=modal(`<h3>Add Person to On Call Crew ${n}</h3><label>Employee<select id="ocPickPerson"><option value="">Select employee…</option>${opts}</select></label><div class="ocActions"><button data-cancel>Cancel</button><button id="ocAddPicked" class="ocPrimary">Add</button></div>`);b.querySelector('#ocAddPicked').onclick=async()=>{const id=Number(b.querySelector('#ocPickPerson').value),m=members.find(x=>x.id===id),t=templates.find(x=>x.id===m?.crew_id);if(!m||!t)return;await req('/rest/v1/on_call_assignments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({period_id:periodId,assignment_date:assignmentDate,employee_name:m.employee_name,normal_crew:t.crew_name,role:m.role,on_call_crew:n})});b.remove();await load()}}
async function setSlot(periodId,assignmentDate,n,crew){if(role!=='supervisor')return;const old=assignments.filter(a=>a.period_id===periodId&&a.assignment_date===assignmentDate&&(a.on_call_crew===n||(crew&&a.normal_crew===crew)));for(const a of old)await req('/rest/v1/on_call_assignments?id=eq.'+a.id,{method:'DELETE'});if(crew){const t=templates.find(x=>x.crew_name===crew),base=members.filter(x=>x.crew_id===t?.id);for(const m of base)await req('/rest/v1/on_call_assignments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({period_id:periodId,assignment_date:assignmentDate,employee_name:m.employee_name,normal_crew:crew,role:m.role,on_call_crew:n})})}await load()}
async function removePerson(id){if(role!=='supervisor')return;await req('/rest/v1/on_call_assignments?id=eq.'+id,{method:'DELETE'});await load()}
function groupHtml(crew,rows){const t=templates.find(x=>x.crew_name===crew),base=members.filter(x=>x.crew_id===t?.id),people=rows.filter(a=>a.normal_crew===crew);return `<section class="ocGroup"><div class="ocGroupHead"><strong>${esc(crew)} Crew</strong>${role==='supervisor'?`<div><button class="ocAdd" data-whole="${esc(crew)}">Assign Crew</button> <button class="ocAdd" data-add="${esc(crew)}">+ Add Employee</button></div>`:''}</div>${base.map(m=>{const a=people.find(x=>x.employee_name===m.employee_name);return `<div class="ocPerson"><div><strong>${esc(m.employee_name)}</strong></div><small>${esc(m.role)}</small><div class="ocCrewBtns">${[1,2,3].map(n=>`<button ${a?`data-assign="${a.id}"`:`data-member="${m.id}" data-normal="${esc(crew)}"`} data-crew="${n}" class="${a?.on_call_crew===n?'sel':''}">${n}</button>`).join('')}</div></div>`}).join('')}</section>`}
function modal(inner){const b=document.createElement('div');b.className='ocModalBack';b.innerHTML='<div class="ocModal">'+inner+'</div>';document.body.appendChild(b);b.onclick=e=>{if(e.target===b)b.remove()};b.querySelector('[data-cancel]')?.addEventListener('click',()=>b.remove());return b}
function periodModal(){const b=modal('<h3>Add Coverage Days</h3><p class="ocModalHint">Add a single day or a stretch of days to the on-call sequence.</p><label>Name<input id="ocLabel" placeholder="Winter Break, Christmas Shutdown..."></label><label>Start Date<input id="ocStart" type="date"></label><label>End Date<input id="ocEnd" type="date"></label><div class="ocActions"><button data-cancel>Cancel</button><button id="ocSavePeriod" class="ocPrimary">Add Coverage</button></div>');b.querySelector('#ocSavePeriod').onclick=async()=>{const label=b.querySelector('#ocLabel').value.trim(),start=b.querySelector('#ocStart').value,end=b.querySelector('#ocEnd').value;if(!label||!start||!end)return alert('Name, start date, and end date are required.');if(end<start)return alert('End date must be the same as or after the start date.');const made=await req('/rest/v1/on_call_periods',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({label,start_date:start,end_date:end})});current=made[0].id;onCallPageOffset=0;b.remove();await load()}}
function employeeModal(periodId,crew){const b=modal(`<h3>Add Employee</h3><label>Normal Crew<input value="${esc(crew)}" disabled></label><label>Employee Name<input id="ocEmployee"></label><label>Role<select id="ocRole"><option value="">Select role</option><option>Foreman</option><option>Operator</option><option>Driver</option><option>Laborer</option></select></label><div class="ocActions"><button data-cancel>Cancel</button><button id="ocSaveEmployee" class="ocPrimary">Add</button></div>`);b.querySelector('#ocSaveEmployee').onclick=async()=>{const name=b.querySelector('#ocEmployee').value.trim();if(!name)return;await req('/rest/v1/on_call_assignments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({period_id:periodId,employee_name:name,normal_crew:crew,role:b.querySelector('#ocRole').value||null})});b.remove();await load()}}
async function assignMember(periodId,memberId,normalCrew,n){const m=members.find(x=>x.id===memberId);if(!m||role!=='supervisor')return;await req('/rest/v1/on_call_assignments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({period_id:periodId,employee_name:m.employee_name,normal_crew:normalCrew,role:m.role,on_call_crew:n})});await load()}
async function assignWhole(periodId,crew){if(role!=='supervisor')return;const n=Number(prompt('Assign '+crew+' crew to On Call Crew 1, 2, or 3:'));if(![1,2,3].includes(n))return;const t=templates.find(x=>x.crew_name===crew),base=members.filter(x=>x.crew_id===t?.id),existing=assignments.filter(x=>x.period_id===periodId&&x.normal_crew===crew);for(const m of base){const a=existing.find(x=>x.employee_name===m.employee_name);if(a)await req('/rest/v1/on_call_assignments?id=eq.'+a.id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({on_call_crew:n,role:m.role})});else await req('/rest/v1/on_call_assignments',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify({period_id:periodId,employee_name:m.employee_name,normal_crew:crew,role:m.role,on_call_crew:n})})}await load()}
async function setCrew(id,n){if(role!=='supervisor')return;const a=assignments.find(x=>x.id===id);if(!a)return;const val=a.on_call_crew===n?null:n;await req('/rest/v1/on_call_assignments?id=eq.'+id,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({on_call_crew:val})});a.on_call_crew=val;render()}
const obs=new MutationObserver(ensure);obs.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});ensure();startOnCallRealtime();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&document.getElementById('onCallPage')?.classList.contains('active'))load().catch(()=>{})});
})();