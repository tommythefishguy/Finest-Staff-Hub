const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const store = {
  get(k, fallback){ return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
const initialStaff = [
  {id:"s1", name:"Staff Member", pin:"1234", role:"staff", active:true},
  {id:"m1", name:"Manager", pin:"9999", role:"manager", active:true}
];
const defaultSchedule = [
  {id:"d1", tank:"Marine 1", type:"Feeding", due:"10:00"},
  {id:"d2", tank:"Marine 1", type:"Cleaning", due:"15:00"},
  {id:"d3", tank:"Coral Bay", type:"Tank Test", due:"11:00"}
];
if(!localStorage.getItem("staff")) store.set("staff", initialStaff);
["jobs","tests","issues","rota","handover","shifts","tanks","adhocTasks"].forEach(k=>{ if(!localStorage.getItem(k)) store.set(k,[]); });
if(!localStorage.getItem("schedule")) store.set("schedule", defaultSchedule);
if(store.get("tanks",[]).length===0){
  store.set("tanks", [
    {id:"t1", name:"Marine 1", type:"Marine", notes:"Demo tank"},
    {id:"t2", name:"Coral Bay", type:"Coral", notes:"Demo coral system"}
  ]);
}

let currentUser = null;
let loginMode = "staff";
let currentFormType = "Feeding";

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }
function now(){ return new Date().toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}); }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function norm(v){ return (v||"").toString().toLowerCase(); }

function showScreen(id){
  $$(".screen").forEach(s=>s.classList.remove("active"));
  const screen = $(id);
  if(screen) screen.classList.add("active");
  $("#bottomNav").classList.toggle("hidden", id==="#loginScreen");
  updateManagerOnly();
}
function goHome(){ showScreen("#homeScreen"); renderHome(); }
function updateManagerOnly(){ $$(".manager-only").forEach(el=>el.style.display = currentUser?.role==="manager" ? "" : "none"); }

window.openMoreMenu = function(){
  const name=$("#moreUserName"), role=$("#moreUserRole");
  if(name) name.textContent=currentUser?.name || "Staff Member";
  if(role) role.textContent="Role: " + (currentUser?.role || "staff");
  showScreen("#moreScreen");
};


function renderNotifications(){
  const list = $("#notificationsList");
  if(!list) return;
  const issues = store.get("issues",[]).filter(i=>i.status!=="Resolved");
  list.innerHTML = issues.length ? issues.map(i=>{
    const resolve = currentUser?.role==="manager" ? `<div class="item-actions"><button onclick="resolveIssue('${i.id}')">Mark Resolved</button></div>` : "";
    return itemHTML(`${i.tank}`, `${i.category||"Issue"} • ${i.staff} • ${i.time}`, `${i.desc} • Status: ${i.status||"Open"}`, "Issue", resolve);
  }).join("") : `<div class="item"><h3>No open notifications</h3><p>Any sick livestock, coral or equipment reports will appear here.</p></div>`;
}

window.openNotifications = function(){
  renderNotifications();
  showScreen("#notificationsScreen");
};

$$(".toggle-btn").forEach(btn=>btn.onclick=()=>{
  loginMode=btn.dataset.mode;
  $$(".toggle-btn").forEach(b=>b.classList.remove("active")); btn.classList.add("active");
  $("#staffLogin").classList.toggle("hidden", loginMode!=="staff");
  $("#managerLogin").classList.toggle("hidden", loginMode!=="manager");
});

$("#staffSignIn").onclick=()=>{
  const pin=$("#pinInput").value.trim();
  const staff=store.get("staff",[]).find(s=>s.pin===pin && s.active && s.role!=="manager");
  if(!staff) return toast("PIN not recognised");
  currentUser=staff; goHome();
};
$("#managerSignIn").onclick=()=>{
  const pin=$("#managerPinInput").value.trim();
  const manager=store.get("staff",[]).find(s=>s.pin===pin && s.active && s.role==="manager");
  if(!manager) return toast("Manager PIN not recognised");
  currentUser=manager; goHome();
};

function activeShift(){
  if(!currentUser) return null;
  return store.get("shifts",[]).find(s=>s.staff===currentUser.name && !s.clockOut);
}
$("#clockBtn").onclick=()=>{
  let shifts=store.get("shifts",[]);
  let active=activeShift();
  if(active){
    active.clockOut=now(); active.clockOutRaw=Date.now();
    active.hours=((active.clockOutRaw-active.clockInRaw)/3600000).toFixed(2);
    toast("Clocked out");
  }else{
    shifts.unshift({id:uid(), staff:currentUser.name, date:todayKey(), clockIn:now(), clockInRaw:Date.now()});
    toast("Clocked in");
  }
  store.set("shifts",shifts); renderHome();
};

function renderHome(){
  $("#currentUserName").textContent=currentUser?.name || "Staff Member";
  const active=activeShift();
  $("#clockState").textContent=active ? "You are clocked in" : "You are not clocked in";
  $("#clockState").style.color=active ? "var(--green)" : "var(--orange)";
  $("#clockInfo").textContent=active ? `Started at ${active.clockIn}` : "Start your shift before logging jobs.";
  $("#clockBtn").textContent=active ? "Clock Out" : "Clock In";
  const jobs=store.get("jobs",[]).filter(j=>j.date===todayKey());
  const tests=store.get("tests",[]).filter(t=>t.date===todayKey());
  const issues=store.get("issues",[]).filter(i=>i.status!=="Resolved");
  const due=countDueTasks();
  $("#homeDone").textContent=jobs.length+tests.length;
  $("#homeTests").textContent=tests.length;
  $("#homeIssues").textContent=issues.length;
  $("#homeMissed").textContent=due;
  $("#issueBadge").textContent=issues.length;
}

function openForm(type){
  currentFormType=type;
  $("#formTitle").textContent = type==="Cleaning" ? "Log Cleaning" : "Log Feeding";
  $("#jobType").value=type;
  showScreen("#formScreen");
}
$$(".back").forEach(b=>b.onclick=goHome);
$("#issueToggle").onchange=()=>$("#issueExtra").classList.toggle("hidden", !$("#issueToggle").checked);

$("#jobForm").onsubmit=(e)=>{
  e.preventDefault();
  if(!activeShift()) return toast("Please clock in first");
  const isIssue=$("#issueToggle").checked;
  const job={id:uid(), tank:$("#tankInput").value, type:$("#jobType").value, staff:currentUser.name, date:todayKey(), time:now(), raw:Date.now(), notes:$("#jobNotes").value};
  const jobs=store.get("jobs",[]); jobs.unshift(job); store.set("jobs",jobs);
  if(isIssue){
    const issues=store.get("issues",[]);
    issues.unshift({id:uid(), tank:job.tank, staff:currentUser.name, time:now(), raw:Date.now(), category:$("#issueCategory").value, desc:$("#issueDesc").value || "Issue flagged", status:"Open", jobId:job.id});
    store.set("issues",issues);
  }
  e.target.reset(); $("#issueExtra").classList.add("hidden"); toast("Log saved"); goHome();
};

$("#testForm").onsubmit=(e)=>{
  e.preventDefault();
  if(!activeShift()) return toast("Please clock in first");
  const test={id:uid(), tank:$("#testTank").value, staff:currentUser.name, time:now(), raw:Date.now(), date:todayKey(),
    ph:$("#ph").value, ammonia:$("#ammonia").value, nitrite:$("#nitrite").value, nitrate:$("#nitrate").value,
    phosphate:$("#phosphate").value, salinity:$("#salinity").value, temp:$("#temp").value, alk:$("#alk").value, notes:$("#testNotes").value};
  const tests=store.get("tests",[]); tests.unshift(test); store.set("tests",tests); e.target.reset(); renderTests(); toast("Test saved");
};

function itemHTML(title, meta, body="", tag="", extra=""){
  return `<div class="item"><h3>${title} ${tag?`<span class="tag">${tag}</span>`:""}</h3><p>${meta}</p>${body?`<p>${body}</p>`:""}${extra}</div>`;
}

function tankNames(){
  const names = new Set();
  store.get("tanks",[]).forEach(x=>names.add(x.name));
  store.get("schedule",[]).forEach(x=>names.add(x.tank));
  store.get("adhocTasks",[]).forEach(x=>names.add(x.tank));
  store.get("jobs",[]).forEach(x=>names.add(x.tank));
  store.get("tests",[]).forEach(x=>names.add(x.tank));
  store.get("issues",[]).forEach(x=>names.add(x.tank));
  return [...names].filter(Boolean).sort();
}
function latestFor(arr, tank, type){
  return arr.filter(x=>x.tank===tank && (!type || x.type===type)).sort((a,b)=>(b.raw||0)-(a.raw||0))[0];
}
function renderTankStatus(){
  const q=norm($("#tankStatusSearch")?.value);
  const jobs=store.get("jobs",[]), tests=store.get("tests",[]), issues=store.get("issues",[]).filter(i=>i.status!=="Resolved");
  const names=tankNames().filter(t=>!q || norm(t).includes(q));
  $("#tankStatusList").innerHTML = names.length ? names.map(t=>{
    const fed=latestFor(jobs,t,"Feeding");
    const cleaned=latestFor(jobs,t,"Cleaning");
    const tested=latestFor(tests,t);
    const issue=issues.find(i=>i.tank===t);
    const pills = `<div class="status-row">
      <span class="pill ${fed && fed.date===todayKey()?'good':'bad'}">Feeding ${fed?fed.time:'Never'}</span>
      <span class="pill ${cleaned && cleaned.date===todayKey()?'good':'warn'}">Cleaning ${cleaned?cleaned.time:'Never'}</span>
      <span class="pill ${tested && tested.date===todayKey()?'good':'warn'}">Test ${tested?tested.time:'Never'}</span>
      <span class="pill ${issue?'bad':'good'}">${issue?'Issue Open':'No Issue'}</span>
    </div>`;
    return itemHTML(t, "Tank overview", "", issue?"Attention":"Status", pills);
  }).join("") : `<div class="item">No tanks found yet. Add schedule entries or logs first.</div>`;
}

function isTaskDoneToday(task){
  if(task.done) return true;
  if(task.type==="Tank Test") return store.get("tests",[]).some(t=>t.date===todayKey() && t.tank===task.tank);
  if(task.type==="Feeding" || task.type==="Cleaning") return store.get("jobs",[]).some(j=>j.date===todayKey() && j.tank===task.tank && j.type===task.type);
  return store.get("jobs",[]).some(j=>j.date===todayKey() && j.tank===task.tank && (j.notes||"").toLowerCase().includes((task.type||"").toLowerCase()));
}
function taskIsDue(task){
  if(!task.due) return false;
  const nowDate = new Date();
  const [h,m]=task.due.split(":").map(Number);
  const due = new Date(); due.setHours(h,m||0,0,0);
  return nowDate > due && !isTaskDoneToday(task);
}
function countDueTasks(){ return store.get("schedule",[]).filter(taskIsDue).length; }
function renderTodayTasks(){
  const recurring = store.get("schedule",[]).map(t=>({...t, source:"Recurring"}));
  const adhoc = store.get("adhocTasks",[]).filter(t=>t.date===todayKey()).map(t=>({...t, source:"Today"}));
  const schedule=[...adhoc, ...recurring];
  $("#tasksList").innerHTML = schedule.length ? schedule.map(t=>{
    const done=isTaskDoneToday(t), due=taskIsDue(t);
    const canLogJob = t.type==="Feeding" || t.type==="Cleaning" || t.type==="Water Change" || t.type==="Medication" || t.type==="Maintenance" || t.type==="Other";
    const actions = `<div class="item-actions">
      ${canLogJob ? `<button onclick="quickLogTask('${t.id || ''}','${t.source || 'Recurring'}','${(t.type||'').replace(/'/g,"")}','${(t.tank||'').replace(/'/g,"")}')">Log Done</button>` : ""}
      ${t.type==='Tank Test' ? `<button onclick="showScreen('#testsScreen')">Log Test</button>` : ""}
      ${t.source==='Today' ? `<button onclick="deleteAdhocTask('${t.id}'); renderTodayTasks();">Delete</button>` : ""}
    </div>`;
    return itemHTML(`${t.tank}`, `${t.type} • ${t.source || "Task"} • Due ${t.due || "Any time"} ${t.assigned?`• ${t.assigned}`:""}`, done?"Completed today":(due?"Overdue / missing":(t.notes||"Not done yet")), done?"Done":(due?"Missed":"Due"), actions);
  }).join("") : `<div class="item">No tasks scheduled yet. Managers can add tanks and tasks in Setup Hub.</div>`;
}

function quickLogTask(id, source, type, tank){
  if(!activeShift()) return toast("Please clock in first");
  const jobs = store.get("jobs",[]);
  jobs.unshift({id:uid(), tank, type: type==="Tank Test" ? "Tank Test" : (type==="Cleaning"||type==="Feeding"?type:"Cleaning"), staff:currentUser.name, date:todayKey(), time:now(), raw:Date.now(), notes:`Completed task: ${type}`});
  store.set("jobs",jobs);
  if(source==="Today" && id){
    const tasks=store.get("adhocTasks",[]);
    const task=tasks.find(t=>t.id===id);
    if(task){ task.done=true; task.doneBy=currentUser.name; task.doneAt=now(); store.set("adhocTasks",tasks); }
  }
  renderTodayTasks();
  renderHome();
  toast("Task marked done");
}

function renderList(type){
  const list=$("#listContent"); list.innerHTML="";
  if(type==="jobs"){
    $("#listTitle").textContent="Today’s Jobs";
    const jobs=store.get("jobs",[]).filter(j=>j.date===todayKey());
    list.innerHTML = jobs.length ? jobs.map(j=>itemHTML(`${j.tank}`, `${j.type} • ${j.staff} • ${j.time}`, j.notes, j.type)).join("") : `<div class="item">No jobs logged today yet.</div>`;
  } else if(type==="issues"){
    $("#listTitle").textContent="Issues";
    const issues=store.get("issues",[]);
    list.innerHTML = issues.length ? issues.map(i=>{
      const resolve = currentUser?.role==="manager" && i.status!=="Resolved" ? `<div class="item-actions"><button onclick="resolveIssue('${i.id}')">Mark Resolved</button></div>` : "";
      return itemHTML(`${i.tank}`, `${i.category||"Issue"} • ${i.staff} • ${i.time}`, `${i.desc} • Status: ${i.status||"Open"}`, i.status==="Resolved"?"Resolved":"Issue", resolve);
    }).join("") : `<div class="item">No issues logged.</div>`;
  }
}
function resolveIssue(id){
  const issues=store.get("issues",[]);
  const issue=issues.find(i=>i.id===id);
  if(issue){ issue.status="Resolved"; issue.resolvedBy=currentUser.name; issue.resolvedAt=now(); store.set("issues",issues); renderList("issues"); renderHome(); }
}

function renderTests(){
  const tests=store.get("tests",[]);
  $("#recentTests").innerHTML = tests.slice(0,12).map(t=>itemHTML(t.tank, `${t.staff} • ${t.time}`, `pH ${t.ph||"-"} • Ammo ${t.ammonia||"-"} • Nitrite ${t.nitrite||"-"} • Nitrate ${t.nitrate||"-"} • Phos ${t.phosphate||"-"} • Salinity ${t.salinity||"-"}`, "Test")).join("") || `<div class="item">No test results yet.</div>`;
}

$("#rotaForm").onsubmit=(e)=>{
  e.preventDefault();
  const rota=store.get("rota",[]);
  rota.unshift({id:uid(), name:$("#rotaName").value, date:$("#rotaDate").value, shift:$("#rotaShift").value, role:$("#rotaRole").value});
  store.set("rota",rota); e.target.reset(); renderRota();
};
function renderRota(){
  const rota=store.get("rota",[]);
  $("#rotaList").innerHTML = rota.length ? rota.map(r=>itemHTML(r.name, `${r.date} • ${r.shift}`, r.role, "Rota")).join("") : `<div class="item">No rota entries yet.</div>`;
}

$("#handoverForm").onsubmit=(e)=>{
  e.preventDefault();
  const hand=store.get("handover",[]);
  hand.unshift({id:uid(), note:$("#handoverNote").value, priority:$("#handoverPriority").value, staff:currentUser.name, time:now(), raw:Date.now()});
  store.set("handover",hand); e.target.reset(); renderHandover();
};
function renderHandover(){
  const hand=store.get("handover",[]);
  $("#handoverList").innerHTML = hand.length ? hand.map(h=>itemHTML(`${h.priority} Note`, `${h.staff} • ${h.time}`, h.note, h.priority)).join("") : `<div class="item">No handover notes yet.</div>`;
}

$("#staffForm").onsubmit=(e)=>{
  e.preventDefault();
  const staff=store.get("staff",[]);
  staff.push({id:uid(), name:$("#newStaffName").value, pin:$("#newStaffPin").value, role:$("#newStaffRole").value, active:true});
  store.set("staff",staff); e.target.reset(); renderStaffSettings(); toast("Staff added");
};
function toggleStaff(id){
  const staff=store.get("staff",[]);
  const s=staff.find(x=>x.id===id);
  if(s){ s.active=!s.active; store.set("staff",staff); renderStaffSettings(); }
}
function renderStaffSettings(){
  const staff=store.get("staff",[]);
  $("#staffList").innerHTML = staff.map(s=>{
    const btn=`<div class="item-actions"><button onclick="toggleStaff('${s.id}')">${s.active?'Disable':'Enable'}</button></div>`;
    return itemHTML(s.name, `Role: ${s.role} • PIN: ${s.pin}`, `Status: ${s.active?'Active':'Disabled'}`, s.role, btn);
  }).join("");
}


function fillTankSelect(selectId){
  const el = $(selectId);
  if(!el) return;
  const names = tankNames();
  el.innerHTML = names.length ? names.map(n=>`<option value="${n}">${n}</option>`).join("") : `<option value="">No tanks added yet</option>`;
}
function fillStaffSelect(selectId){
  const el = $(selectId);
  if(!el) return;
  const staff = store.get("staff",[]).filter(s=>s.active);
  el.innerHTML = `<option value="Any staff">Any staff</option>` + staff.map(s=>`<option value="${s.name}">${s.name}</option>`).join("");
}
function renderSetupHub(){
  updateManagerOnly();
}
function renderTankManager(){
  const list = $("#tankManagerList");
  const tanks = store.get("tanks",[]);
  if(!list) return;
  list.innerHTML = tanks.length ? tanks.map(t=>{
    const actions = `<div class="item-actions"><button onclick="deleteTank('${t.id}')">Delete Tank</button></div>`;
    return itemHTML(t.name, `${t.type || "Tank"}`, t.notes || "", "Tank", actions);
  }).join("") : `<div class="item">No tanks added yet.</div>`;
}
function deleteTank(id){
  store.set("tanks", store.get("tanks",[]).filter(t=>t.id!==id));
  renderTankManager();
  toast("Tank removed");
}
const tankForm = $("#tankForm");
if(tankForm){
  tankForm.onsubmit = (e)=>{
    e.preventDefault();
    const name = $("#newTankName").value.trim();
    if(!name) return toast("Tank name required");
    const tanks = store.get("tanks",[]);
    tanks.unshift({id:uid(), name, type:$("#newTankType").value, notes:$("#newTankNotes").value});
    store.set("tanks",tanks);
    e.target.reset();
    renderTankManager();
    toast("Tank added");
  };
}
function renderAdhocTasks(){
  fillTankSelect("#adhocTankSelect");
  fillStaffSelect("#adhocAssignedTo");
  const list = $("#adhocTaskList");
  const tasks = store.get("adhocTasks",[]).filter(t=>t.date===todayKey());
  if(!list) return;
  list.innerHTML = tasks.length ? tasks.map(t=>{
    const actions = `<div class="item-actions"><button onclick="deleteAdhocTask('${t.id}')">Delete</button></div>`;
    return itemHTML(t.tank, `${t.type} • Due ${t.due || "Any time"} • Assigned: ${t.assigned || "Any staff"}`, t.notes || "", t.done?"Done":"Today", actions);
  }).join("") : `<div class="item">No one-off tasks added for today yet.</div>`;
}
function deleteAdhocTask(id){
  store.set("adhocTasks", store.get("adhocTasks",[]).filter(t=>t.id!==id));
  renderAdhocTasks();
}
const adhocTaskForm = $("#adhocTaskForm");
if(adhocTaskForm){
  adhocTaskForm.onsubmit = (e)=>{
    e.preventDefault();
    const tasks = store.get("adhocTasks",[]);
    tasks.unshift({
      id: uid(),
      date: todayKey(),
      tank: $("#adhocTankSelect").value,
      type: $("#adhocTaskType").value,
      due: $("#adhocTaskDue").value,
      assigned: $("#adhocAssignedTo").value,
      notes: $("#adhocTaskNotes").value,
      createdBy: currentUser?.name || "Manager"
    });
    store.set("adhocTasks",tasks);
    e.target.reset();
    renderAdhocTasks();
    toast("Task added for today");
  };
}

$("#scheduleForm").onsubmit=(e)=>{
  e.preventDefault();
  const schedule=store.get("schedule",[]);
  schedule.unshift({id:uid(), tank:$("#scheduleTank").value.trim() || $("#scheduleTankSelect").value, type:$("#scheduleType").value, due:$("#scheduleTime").value});
  store.set("schedule",schedule); e.target.reset(); renderScheduleSettings(); toast("Task added");
};
function deleteSchedule(id){
  store.set("schedule", store.get("schedule",[]).filter(x=>x.id!==id));
  renderScheduleSettings();
}
function renderScheduleSettings(){
  fillTankSelect("#scheduleTankSelect");
  const schedule=store.get("schedule",[]);
  $("#scheduleList").innerHTML = schedule.length ? schedule.map(s=>{
    const btn=`<div class="item-actions"><button onclick="deleteSchedule('${s.id}')">Delete</button></div>`;
    return itemHTML(s.tank, `${s.type} • Due ${s.due || "Any time"}`, "", "Daily", btn);
  }).join("") : `<div class="item">No scheduled tasks yet.</div>`;
}

function renderManager(){
  const jobs=store.get("jobs",[]), tests=store.get("tests",[]), issues=store.get("issues",[]).filter(i=>i.status!=="Resolved"), staff=store.get("staff",[]);
  $("#statJobs").textContent=jobs.length; $("#statTests").textContent=tests.length; $("#statIssues").textContent=issues.length; $("#statStaff").textContent=staff.length;
  $("#shiftList").innerHTML = store.get("shifts",[]).map(s=>itemHTML(s.staff, `${s.clockIn} → ${s.clockOut || "Still clocked in"}`, s.hours ? `${s.hours} hours` : "", "Shift")).join("") || `<div class="item">No shift logs yet.</div>`;
}

function renderHistory(){
  const q=norm($("#historySearch")?.value), type=$("#historyType")?.value || "all";
  let items=[];
  if(type==="all"||type==="jobs") items.push(...store.get("jobs",[]).map(x=>({kind:"Job", title:x.tank, meta:`${x.type} • ${x.staff} • ${x.time}`, body:x.notes})));
  if(type==="all"||type==="tests") items.push(...store.get("tests",[]).map(x=>({kind:"Test", title:x.tank, meta:`${x.staff} • ${x.time}`, body:`pH ${x.ph||"-"} nitrate ${x.nitrate||"-"} phosphate ${x.phosphate||"-"} salinity ${x.salinity||"-"}`})));
  if(type==="all"||type==="issues") items.push(...store.get("issues",[]).map(x=>({kind:"Issue", title:x.tank, meta:`${x.category||"Issue"} • ${x.staff} • ${x.time}`, body:x.desc})));
  if(type==="all"||type==="shifts") items.push(...store.get("shifts",[]).map(x=>({kind:"Shift", title:x.staff, meta:`${x.clockIn} → ${x.clockOut || "Still clocked in"}`, body:x.hours?`${x.hours} hours`:""})));
  items = items.filter(i=>!q || norm(i.title+i.meta+i.body+i.kind).includes(q));
  $("#historyList").innerHTML = items.length ? items.map(i=>itemHTML(i.title,i.meta,i.body,i.kind)).join("") : `<div class="item">No matching records found.</div>`;
}

function exportData(){
  const data={staff:store.get("staff",[]), shifts:store.get("shifts",[]), jobs:store.get("jobs",[]), tests:store.get("tests",[]), issues:store.get("issues",[]), rota:store.get("rota",[]), handover:store.get("handover",[]), schedule:store.get("schedule",[]), tanks:store.get("tanks",[]), adhocTasks:store.get("adhocTasks",[])};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="finest-staff-hub-export.json"; a.click();
}
function logout(){ currentUser=null; showScreen("#loginScreen"); $("#pinInput").value=""; $("#managerPinInput").value=""; }



// Hard-wired top buttons. This fixes GitHub/cache/browser cases where inline clicks don't fire.
window.addEventListener("DOMContentLoaded", () => {
  const menu = document.getElementById("menuBtn");
  const notif = document.getElementById("notificationBtn");

  if (menu) {
    menu.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.openMoreMenu();
    };
  }

  if (notif) {
    notif.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.openNotifications();
    };
  }

  // Make every back button go home, including newly inserted screens
  document.querySelectorAll(".back").forEach(btn => {
    btn.onclick = (event) => {
      event.preventDefault();
      goHome();
    };
  });
});


window.goHome = goHome;
window.showScreen = showScreen;
window.renderList = renderList;
window.renderRota = renderRota;
window.renderHandover = renderHandover;
window.renderManager = renderManager;
window.renderHistory = renderHistory;
window.renderStaffSettings = renderStaffSettings;
window.renderScheduleSettings = renderScheduleSettings;
window.renderTodayTasks = renderTodayTasks;
window.renderTankStatus = renderTankStatus;
window.renderTests = renderTests;
window.openForm = openForm;
window.logout = logout;
window.exportData = exportData;
window.resolveIssue = resolveIssue;
window.toggleStaff = toggleStaff;
window.deleteSchedule = deleteSchedule;



window.renderSetupHub = renderSetupHub;
window.renderTankManager = renderTankManager;
window.deleteTank = deleteTank;
window.renderAdhocTasks = renderAdhocTasks;
window.deleteAdhocTask = deleteAdhocTask;
window.quickLogTask = quickLogTask;
