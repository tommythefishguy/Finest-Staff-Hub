const $ = (s)=>document.querySelector(s);
const $$ = (s)=>document.querySelectorAll(s);
const store = {
  get(k, fallback){ return JSON.parse(localStorage.getItem(k) || JSON.stringify(fallback)); },
  set(k, v){ localStorage.setItem(k, JSON.stringify(v)); }
};
const initialStaff = [
  {name:"Staff Member", pin:"1234", role:"staff", active:true},
  {name:"Manager", pin:"9999", role:"manager", active:true}
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

function showScreen(id){
  $$(".screen").forEach(s=>s.classList.remove("active"));
  $(id).classList.add("active");
  $("#bottomNav").classList.toggle("hidden", id==="loginScreen");
  updateManagerOnly();
}
function goHome(){ showScreen("#homeScreen"); renderHome(); }

window.openMoreMenu = function(){
  renderList("more");
  showScreen("#listScreen");
};
function updateManagerOnly(){ $$(".manager-only").forEach(el=>el.style.display = currentUser?.role==="manager" ? "" : "none"); }

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
    active.clockOut=now();
    active.clockOutRaw=Date.now();
    active.hours=((active.clockOutRaw-active.clockInRaw)/3600000).toFixed(2);
    toast("Clocked out");
  }else{
    shifts.push({id:uid(), staff:currentUser.name, date:todayKey(), clockIn:now(), clockInRaw:Date.now()});
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
  $("#issueBadge").textContent=store.get("issues",[]).length;
}
function openForm(type){
  currentFormType=type;
  $("#formTitle").textContent = type==="Cleaning" ? "Log Cleaning" : "Log Feeding";
  $("#jobType").value=type;
  showScreen("#formScreen");
}
$$("[data-view]").forEach(btn=>btn.onclick=()=>{
  const v=btn.dataset.view;
  if(v==="home") return goHome();
  if(v==="feeding") return openForm("Feeding");
  if(v==="cleaning") return openForm("Cleaning");
  if(v==="tests") { renderTests(); return showScreen("#testsScreen"); }
  if(v==="jobs") { renderList("jobs"); return showScreen("#listScreen"); }
  if(v==="issues") { renderList("issues"); return showScreen("#listScreen"); }
  if(v==="rota") { renderRota(); return showScreen("#rotaScreen"); }
  if(v==="handover") { renderHandover(); return showScreen("#handoverScreen"); }
  if(v==="manager") { renderManager(); return showScreen("#managerScreen"); }
  if(v==="more") { renderList("more"); return showScreen("#listScreen"); }
});
$$(".back").forEach(b=>b.onclick=goHome);

// Top-left menu button opens the More screen
const menuButton = document.querySelector('[data-action="openMore"]');
if (menuButton) {
  menuButton.onclick = window.openMoreMenu;
}


$("#issueToggle").onchange=()=>$("#issueExtra").classList.toggle("hidden", !$("#issueToggle").checked);

$("#jobForm").onsubmit=(e)=>{
  e.preventDefault();
  if(!activeShift()) return toast("Please clock in first");
  const isIssue=$("#issueToggle").checked;
  const job={id:uid(), tank:$("#tankInput").value, type:$("#jobType").value, staff:currentUser.name, date:todayKey(), time:now(), notes:$("#jobNotes").value};
  const jobs=store.get("jobs",[]); jobs.unshift(job); store.set("jobs",jobs);
  if(isIssue){
    const issues=store.get("issues",[]);
    issues.unshift({id:uid(), tank:job.tank, staff:currentUser.name, time:now(), desc:$("#issueDesc").value || "Issue flagged", jobId:job.id});
    store.set("issues",issues);
  }
  e.target.reset(); $("#issueExtra").classList.add("hidden"); toast("Log saved"); goHome();
};

$("#testForm").onsubmit=(e)=>{
  e.preventDefault();
  if(!activeShift()) return toast("Please clock in first");
  const test={id:uid(), tank:$("#testTank").value, staff:currentUser.name, time:now(), date:todayKey(),
    ph:$("#ph").value, ammonia:$("#ammonia").value, nitrite:$("#nitrite").value, nitrate:$("#nitrate").value,
    phosphate:$("#phosphate").value, salinity:$("#salinity").value, temp:$("#temp").value, alk:$("#alk").value, notes:$("#testNotes").value};
  const tests=store.get("tests",[]); tests.unshift(test); store.set("tests",tests); e.target.reset(); renderTests(); toast("Test saved");
};

function itemHTML(title, meta, body="", tag=""){
  return `<div class="item"><h3>${title} ${tag?`<span class="tag">${tag}</span>`:""}</h3><p>${meta}</p>${body?`<p>${body}</p>`:""}</div>`;
}
function renderList(type){
  const list=$("#listContent"); list.innerHTML="";
  if(type==="jobs"){
    $("#listTitle").textContent="Today’s Jobs";
    const jobs=store.get("jobs",[]).filter(j=>j.date===todayKey());
    list.innerHTML = jobs.length ? jobs.map(j=>itemHTML(`${j.tank}`, `${j.type} • ${j.staff} • ${j.time}`, j.notes, j.type)).join("") : `<div class="item">No jobs logged today yet.</div>`;
  } else if(type==="issues"){
    $("#listTitle").textContent="Issues / Sick Livestock";
    const issues=store.get("issues",[]);
    list.innerHTML = issues.length ? issues.map(i=>itemHTML(`${i.tank}`, `${i.staff} • ${i.time}`, i.desc, "Issue")).join("") : `<div class="item">No issues logged.</div>`;
  } else {
    $("#listTitle").textContent="More";
    list.innerHTML = `<div class="item"><h3>Logged in as ${currentUser.name}</h3><p>Role: ${currentUser.role}</p></div><button class="primary full" onclick="logout()">Logout</button>`;
  }
}
function renderTests(){
  const tests=store.get("tests",[]);
  $("#recentTests").innerHTML = tests.slice(0,8).map(t=>itemHTML(t.tank, `${t.staff} • ${t.time}`, `pH ${t.ph||"-"} • Nitrate ${t.nitrate||"-"} • Phosphate ${t.phosphate||"-"} • Salinity ${t.salinity||"-"}`, "Test")).join("");
}
$("#rotaForm").onsubmit=(e)=>{
  e.preventDefault();
  const rota=store.get("rota",[]);
  rota.unshift({id:uid(), name:$("#rotaName").value, date:$("#rotaDate").value, shift:$("#rotaShift").value});
  store.set("rota",rota); e.target.reset(); renderRota();
};
function renderRota(){
  const rota=store.get("rota",[]);
  $("#rotaList").innerHTML = rota.length ? rota.map(r=>itemHTML(r.name, `${r.date} • ${r.shift}`, "", "Rota")).join("") : `<div class="item">No rota entries yet.</div>`;
}
$("#handoverForm").onsubmit=(e)=>{
  e.preventDefault();
  const hand=store.get("handover",[]);
  hand.unshift({id:uid(), note:$("#handoverNote").value, staff:currentUser.name, time:now()});
  store.set("handover",hand); e.target.reset(); renderHandover();
};
function renderHandover(){
  const hand=store.get("handover",[]);
  $("#handoverList").innerHTML = hand.length ? hand.map(h=>itemHTML("Handover Note", `${h.staff} • ${h.time}`, h.note)).join("") : `<div class="item">No handover notes yet.</div>`;
}
$("#staffForm").onsubmit=(e)=>{
  e.preventDefault();
  const staff=store.get("staff",[]);
  staff.push({name:$("#newStaffName").value, pin:$("#newStaffPin").value, role:"staff", active:true});
  store.set("staff",staff); e.target.reset(); renderManager(); toast("Staff added");
};
function renderManager(){
  const jobs=store.get("jobs",[]), tests=store.get("tests",[]), issues=store.get("issues",[]), staff=store.get("staff",[]);
  $("#statJobs").textContent=jobs.length; $("#statTests").textContent=tests.length; $("#statIssues").textContent=issues.length; $("#statStaff").textContent=staff.length;
  $("#staffList").innerHTML = staff.map(s=>itemHTML(s.name, `Role: ${s.role} • PIN: ${s.pin}`, "", s.active?"Active":"Inactive")).join("");
  $("#shiftList").innerHTML = store.get("shifts",[]).map(s=>itemHTML(s.staff, `${s.clockIn} → ${s.clockOut || "Still clocked in"}`, s.hours ? `${s.hours} hours` : "", "Shift")).join("");
}
function logout(){ currentUser=null; showScreen("#loginScreen"); $("#pinInput").value=""; $("#managerPinInput").value=""; }
if("serviceWorker" in navigator){ window.addEventListener("load",()=>navigator.serviceWorker.register("sw.js").catch(()=>{})); }
