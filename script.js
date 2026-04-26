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

if(!localStorage.getItem("staff")) store.set("staff", initialStaff);
["jobs","tests","issues","rota","handover","shifts"].forEach(k=>{ if(!localStorage.getItem(k)) store.set(k,[]); });

let currentUser = null;
let loginMode = "staff";
let currentFormType = "Feeding";

function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }
function now(){ return new Date().toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}); }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function norm(v){ return (v||"").toString().toLowerCase(); }
function canManage(){ return currentUser?.role === "manager"; }

function showScreen(id){
  $$(".screen").forEach(s=>s.classList.remove("active"));
  const screen = $(id);
  if(screen) screen.classList.add("active");
  $("#bottomNav").classList.toggle("hidden", id==="#loginScreen");
  updateManagerOnly();
}
function goHome(){ showScreen("#homeScreen"); renderHome(); }
function updateManagerOnly(){ $$(".manager-only").forEach(el=>el.style.display = canManage() ? "" : "none"); }

window.openMoreMenu = function(){
  const name=$("#moreUserName"), role=$("#moreUserRole");
  if(name) name.textContent=currentUser?.name || "Staff Member";
  if(role) role.textContent="Role: " + (currentUser?.role || "staff");
  showScreen("#moreScreen");
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
  const staff=store.get("staff",[]).filter(s=>s.active);
  $("#homeDone").textContent=jobs.length;
  $("#homeTests").textContent=tests.length;
  $("#homeIssues").textContent=issues.length;
  $("#homeStaff").textContent=staff.length;
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
    issues.unshift({id:uid(), tank:job.tank, staff:currentUser.name, time:now(), raw:Date.now(), date:todayKey(), category:$("#issueCategory").value, desc:$("#issueDesc").value || "Issue flagged", status:"Open", managerNote:"", jobId:job.id});
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

function deleteRecord(collection, id, renderFn){
  if(!canManage()) return toast("Manager only");
  if(!confirm("Delete this record?")) return;
  store.set(collection, store.get(collection,[]).filter(x=>x.id!==id));
  if(renderFn) renderFn();
  renderHome();
  toast("Deleted");
}

function renderList(type){
  const list=$("#listContent"); list.innerHTML="";
  if(type==="jobs"){
    $("#listTitle").textContent="Today’s Jobs";
    const jobs=store.get("jobs",[]).filter(j=>j.date===todayKey());
    list.innerHTML = jobs.length ? jobs.map(j=>{
      const actions = canManage() ? `<div class="item-actions"><button class="delete" onclick="deleteRecord('jobs','${j.id}',()=>renderList('jobs'))">Delete</button></div>` : "";
      return itemHTML(`${j.tank}`, `${j.type} • ${j.staff} • ${j.time}`, j.notes, j.type, actions);
    }).join("") : `<div class="item">No jobs logged today yet.</div>`;
  } else if(type==="issues"){
    $("#listTitle").textContent="Issues";
    const issues=store.get("issues",[]);
    list.innerHTML = issues.length ? issues.map(i=>{
      const pill = `<div class="status-row"><span class="pill ${i.status==='Resolved'?'good':i.status==='In Progress'?'warn':'bad'}">${i.status||"Open"}</span></div>`;
      const manager = canManage() ? `<div class="item-actions">
        <button onclick="setIssueStatus('${i.id}','Open')">Open</button>
        <button onclick="setIssueStatus('${i.id}','In Progress')">In Progress</button>
        <button class="resolve" onclick="setIssueStatus('${i.id}','Resolved')">Resolved</button>
        <button onclick="addIssueNote('${i.id}')">Manager Note</button>
        <button class="delete" onclick="deleteRecord('issues','${i.id}',()=>renderList('issues'))">Delete</button>
      </div>` : "";
      return itemHTML(`${i.tank}`, `${i.category||"Issue"} • ${i.staff} • ${i.time}`, `${i.desc}${i.managerNote?`<br><b>Manager note:</b> ${i.managerNote}`:""}`, i.status==="Resolved"?"Resolved":"Issue", pill+manager);
    }).join("") : `<div class="item">No issues logged.</div>`;
  }
}

function setIssueStatus(id,status){
  const issues=store.get("issues",[]);
  const issue=issues.find(i=>i.id===id);
  if(issue){
    issue.status=status;
    issue.updatedBy=currentUser.name;
    issue.updatedAt=now();
    store.set("issues",issues);
    renderList("issues");
    renderHome();
    toast("Issue updated");
  }
}
function addIssueNote(id){
  const note=prompt("Add manager note:");
  if(note===null) return;
  const issues=store.get("issues",[]);
  const issue=issues.find(i=>i.id===id);
  if(issue){
    issue.managerNote=note;
    issue.updatedBy=currentUser.name;
    issue.updatedAt=now();
    store.set("issues",issues);
    renderList("issues");
    toast("Note added");
  }
}

function testWarning(t){
  const warnings=[];
  const nitrate=parseFloat(t.nitrate), phosphate=parseFloat(t.phosphate), ammonia=parseFloat(t.ammonia), nitrite=parseFloat(t.nitrite);
  if(!isNaN(ammonia) && ammonia>0) warnings.push("Ammonia alert");
  if(!isNaN(nitrite) && nitrite>0) warnings.push("Nitrite alert");
  if(!isNaN(nitrate) && nitrate>50) warnings.push("High nitrate");
  if(!isNaN(phosphate) && phosphate>0.15) warnings.push("High phosphate");
  return warnings;
}
function renderTests(){
  const tests=store.get("tests",[]);
  $("#recentTests").innerHTML = tests.slice(0,12).map(t=>{
    const warns=testWarning(t);
    const warning = warns.length ? `<div class="status-row">${warns.map(w=>`<span class="pill bad">${w}</span>`).join("")}</div>` : `<div class="status-row"><span class="pill good">Within normal check</span></div>`;
    const actions = canManage() ? `<div class="item-actions"><button class="delete" onclick="deleteRecord('tests','${t.id}',renderTests)">Delete</button></div>` : "";
    return itemHTML(t.tank, `${t.staff} • ${t.time}`, `pH ${t.ph||"-"} • Ammo ${t.ammonia||"-"} • Nitrite ${t.nitrite||"-"} • Nitrate ${t.nitrate||"-"} • Phos ${t.phosphate||"-"} • Salinity ${t.salinity||"-"}`, "Test", warning+actions);
  }).join("") || `<div class="item">No test results yet.</div>`;
}

$("#rotaForm").onsubmit=(e)=>{
  e.preventDefault();
  const rota=store.get("rota",[]);
  rota.unshift({id:uid(), name:$("#rotaName").value, date:$("#rotaDate").value, shift:$("#rotaShift").value, role:$("#rotaRole").value});
  store.set("rota",rota); e.target.reset(); renderRota();
};
function renderRota(){
  const rota=store.get("rota",[]);
  const today=todayKey();
  const sorted=[...rota].sort((a,b)=>(a.date||"").localeCompare(b.date||""));
  $("#rotaList").innerHTML = sorted.length ? sorted.map(r=>{
    const tag = r.date===today ? "Today" : "Rota";
    const actions = canManage() ? `<div class="item-actions"><button class="delete" onclick="deleteRecord('rota','${r.id}',renderRota)">Delete</button></div>` : "";
    return itemHTML(r.name, `${r.date} • ${r.shift}`, r.role, tag, actions);
  }).join("") : `<div class="item">No rota entries yet.</div>`;
}

$("#handoverForm").onsubmit=(e)=>{
  e.preventDefault();
  const hand=store.get("handover",[]);
  hand.unshift({id:uid(), note:$("#handoverNote").value, priority:$("#handoverPriority").value, staff:currentUser.name, time:now(), raw:Date.now(), date:todayKey()});
  store.set("handover",hand); e.target.reset(); renderHandover();
};
function renderHandover(){
  const hand=store.get("handover",[]);
  $("#handoverList").innerHTML = hand.length ? hand.map(h=>{
    const actions = canManage() ? `<div class="item-actions"><button class="delete" onclick="deleteRecord('handover','${h.id}',renderHandover)">Delete</button></div>` : "";
    return itemHTML(`${h.priority} Note`, `${h.staff} • ${h.time}`, h.note, h.priority, actions);
  }).join("") : `<div class="item">No handover notes yet.</div>`;
}

$("#staffForm").onsubmit=(e)=>{
  e.preventDefault();
  const staff=store.get("staff",[]);
  const name=$("#newStaffName").value.trim(), pin=$("#newStaffPin").value.trim();
  if(!name || !pin) return toast("Name and PIN required");
  if(staff.some(s=>s.pin===pin)) return toast("PIN already used");
  staff.push({id:uid(), name, pin, role:$("#newStaffRole").value, active:true});
  store.set("staff",staff); e.target.reset(); renderStaffSettings(); renderHome(); toast("Staff added");
};

function toggleStaff(id){
  const staff=store.get("staff",[]);
  const s=staff.find(x=>x.id===id);
  if(s){ s.active=!s.active; store.set("staff",staff); renderStaffSettings(); renderHome(); }
}
function editStaff(id){
  const staff=store.get("staff",[]);
  const s=staff.find(x=>x.id===id);
  if(!s) return;
  const name=prompt("Staff name:", s.name);
  if(name===null) return;
  const pin=prompt("PIN:", s.pin);
  if(pin===null) return;
  if(staff.some(x=>x.id!==id && x.pin===pin)) return toast("PIN already used");
  s.name=name.trim()||s.name;
  s.pin=pin.trim()||s.pin;
  store.set("staff",staff);
  renderStaffSettings();
  renderHome();
  toast("Staff updated");
}
function deleteStaff(id){
  const staff=store.get("staff",[]);
  const target=staff.find(x=>x.id===id);
  if(!target) return;
  if(target.role==="manager" && target.pin==="9999") return toast("Demo manager cannot be deleted");
  if(!confirm("Delete " + target.name + "? Existing logs stay saved.")) return;
  store.set("staff", staff.filter(x=>x.id!==id));
  renderStaffSettings(); renderManager(); renderHome();
  toast("Staff deleted");
}
function renderStaffSettings(){
  const staff=store.get("staff",[]);
  $("#staffList").innerHTML = staff.map(s=>{
    const protectedManager = s.role==="manager" && s.pin==="9999";
    const btn=`<div class="item-actions">
      <button onclick="editStaff('${s.id}')">Edit</button>
      <button onclick="toggleStaff('${s.id}')">${s.active?'Disable':'Enable'}</button>
      ${protectedManager ? '' : `<button class="delete" onclick="deleteStaff('${s.id}')">Delete</button>`}
    </div>`;
    return itemHTML(s.name, `Role: ${s.role} • PIN: ${s.pin}`, `Status: ${s.active?'Active':'Disabled'}`, s.role, btn);
  }).join("");
}

function populateStaffFilter(){
  const select=$("#historyStaff");
  if(!select) return;
  const current=select.value;
  const staff=store.get("staff",[]);
  select.innerHTML=`<option value="all">All staff</option>` + staff.map(s=>`<option value="${s.name}">${s.name}</option>`).join("");
  select.value=current || "all";
}
function matchesDate(item, date){
  if(!date) return true;
  if(item.date) return item.date===date;
  if(item.raw) return new Date(item.raw).toISOString().slice(0,10)===date;
  return true;
}
function renderHistory(){
  populateStaffFilter();
  const q=norm($("#historySearch")?.value), type=$("#historyType")?.value || "all", date=$("#historyDate")?.value || "", staffFilter=$("#historyStaff")?.value || "all";
  let items=[];
  if(type==="all"||type==="jobs") items.push(...store.get("jobs",[]).map(x=>({collection:"jobs", id:x.id, kind:"Job", staff:x.staff, date:x.date, raw:x.raw, title:x.tank, meta:`${x.type} • ${x.staff} • ${x.time}`, body:x.notes})));
  if(type==="all"||type==="tests") items.push(...store.get("tests",[]).map(x=>({collection:"tests", id:x.id, kind:"Test", staff:x.staff, date:x.date, raw:x.raw, title:x.tank, meta:`${x.staff} • ${x.time}`, body:`pH ${x.ph||"-"} nitrate ${x.nitrate||"-"} phosphate ${x.phosphate||"-"} salinity ${x.salinity||"-"}`})));
  if(type==="all"||type==="issues") items.push(...store.get("issues",[]).map(x=>({collection:"issues", id:x.id, kind:"Issue", staff:x.staff, date:x.date, raw:x.raw, title:x.tank, meta:`${x.category||"Issue"} • ${x.staff} • ${x.time} • ${x.status||"Open"}`, body:x.desc})));
  if(type==="all"||type==="shifts") items.push(...store.get("shifts",[]).map(x=>({collection:"shifts", id:x.id, kind:"Shift", staff:x.staff, date:x.date, raw:x.clockInRaw, title:x.staff, meta:`${x.clockIn} → ${x.clockOut || "Still clocked in"}`, body:x.hours?`${x.hours} hours`:""})));
  if(type==="all"||type==="handover") items.push(...store.get("handover",[]).map(x=>({collection:"handover", id:x.id, kind:"Handover", staff:x.staff, date:x.date, raw:x.raw, title:x.priority+" Note", meta:`${x.staff} • ${x.time}`, body:x.note})));
  items = items.filter(i=>(!q || norm(i.title+i.meta+i.body+i.kind).includes(q)) && (staffFilter==="all" || i.staff===staffFilter) && matchesDate(i,date));
  items.sort((a,b)=>(b.raw||0)-(a.raw||0));
  $("#historyList").innerHTML = items.length ? items.map(i=>{
    const actions = canManage() ? `<div class="item-actions"><button class="delete" onclick="deleteRecord('${i.collection}','${i.id}',renderHistory)">Delete</button></div>` : "";
    return itemHTML(i.title,i.meta,i.body,i.kind,actions);
  }).join("") : `<div class="item">No matching records found.</div>`;
}

function renderManager(){
  const jobs=store.get("jobs",[]), tests=store.get("tests",[]), issues=store.get("issues",[]).filter(i=>i.status!=="Resolved"), staff=store.get("staff",[]);
  $("#statJobs").textContent=jobs.length; $("#statTests").textContent=tests.length; $("#statIssues").textContent=issues.length; $("#statStaff").textContent=staff.length;
  $("#shiftList").innerHTML = store.get("shifts",[]).map(s=>itemHTML(s.staff, `${s.clockIn} → ${s.clockOut || "Still clocked in"}`, s.hours ? `${s.hours} hours` : "", "Shift")).join("") || `<div class="item">No shift logs yet.</div>`;
}
function renderManagerTools(){
  const summary=[
    ["Jobs", store.get("jobs",[]).length],
    ["Tests", store.get("tests",[]).length],
    ["Issues", store.get("issues",[]).length],
    ["Rota", store.get("rota",[]).length],
    ["Handover", store.get("handover",[]).length],
    ["Shifts", store.get("shifts",[]).length]
  ];
  $("#managerToolsSummary").innerHTML=summary.map(([name,count])=>itemHTML(name, `${count} records`, "", "Data")).join("");
}
function exportData(){
  const data={staff:store.get("staff",[]), shifts:store.get("shifts",[]), jobs:store.get("jobs",[]), tests:store.get("tests",[]), issues:store.get("issues",[]), rota:store.get("rota",[]), handover:store.get("handover",[])};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="finest-staff-hub-export.json"; a.click();
}
function clearLogsOnly(){
  if(!canManage()) return;
  if(!confirm("Clear all logs, tests, issues, rota, handover and shifts? Staff profiles will stay.")) return;
  ["jobs","tests","issues","rota","handover","shifts"].forEach(k=>store.set(k,[]));
  renderManagerTools(); renderHome(); toast("Logs cleared");
}
function factoryResetDemo(){
  if(!canManage()) return;
  if(!confirm("Factory reset demo? This clears everything and restores demo staff.")) return;
  localStorage.clear();
  store.set("staff", initialStaff);
  ["jobs","tests","issues","rota","handover","shifts"].forEach(k=>store.set(k,[]));
  currentUser=null;
  showScreen("#loginScreen");
  toast("Demo reset");
}
function logout(){ currentUser=null; showScreen("#loginScreen"); $("#pinInput").value=""; $("#managerPinInput").value=""; }
window.addEventListener("DOMContentLoaded",()=>{ $("#menuBtn")?.addEventListener("click", window.openMoreMenu); });
