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
["jobs","tests","issues","rota","handover","shifts","tasks","clockEvents"].forEach(k=>{ if(!localStorage.getItem(k)) store.set(k,[]); });
let currentUser = null;
let loginMode = "staff";
function toast(msg){ const t=$("#toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }
function now(){ return new Date().toLocaleString("en-GB",{dateStyle:"medium",timeStyle:"short"}); }
function todayKey(){ return new Date().toISOString().slice(0,10); }
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function norm(v){ return (v||"").toString().toLowerCase(); }
function canManage(){ return currentUser?.role === "manager"; }
function isTodayOrDue(task){ return task.repeat==="Daily" || task.dueDate===todayKey(); }
function isOverdue(task){ if(task.status==="Done" || !task.dueDate) return false; const due = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`); return Date.now() > due.getTime(); }
function showScreen(id){ $$(".screen").forEach(s=>s.classList.remove("active")); const screen=$(id); if(screen) screen.classList.add("active"); const bottom=$("#bottomNav"); if(bottom) bottom.classList.toggle("hidden", true); updateManagerOnly(); }
function goHome(){ showScreen("#homeScreen"); renderHome(); }
function backToManager(){ renderManagerHome(); showScreen("#managerHomeScreen"); }
function updateManagerOnly(){ $$(".manager-only").forEach(el=>el.style.display = canManage() ? "" : "none"); }
window.openMoreMenu = function(){ $("#moreUserName").textContent=currentUser?.name || "Staff Member"; $("#moreUserRole").textContent="Role: " + (currentUser?.role || "staff"); showScreen("#moreScreen"); };
$$(".toggle-btn").forEach(btn=>btn.onclick=()=>{ loginMode=btn.dataset.mode; $$(".toggle-btn").forEach(b=>b.classList.remove("active")); btn.classList.add("active"); $("#staffLogin").classList.toggle("hidden", loginMode!=="staff"); $("#managerLogin").classList.toggle("hidden", loginMode!=="manager"); });
$("#staffSignIn").onclick=()=>{ const pin=$("#pinInput").value.trim(); const staff=store.get("staff",[]).find(s=>s.pin===pin && s.active && s.role!=="manager"); if(!staff) return toast("PIN not recognised"); currentUser=staff; goHome(); };
$("#managerSignIn").onclick=()=>{ const pin=$("#managerPinInput").value.trim(); const manager=store.get("staff",[]).find(s=>s.pin===pin && s.active && s.role==="manager"); if(!manager) return toast("Manager PIN not recognised"); currentUser=manager; goHome(); };
function activeShift(){ if(!currentUser) return null; return store.get("shifts",[]).find(s=>s.staff===currentUser.name && !s.clockOut); }
$("#clockBtn").onclick=()=>{
  let shifts=store.get("shifts",[]);
  let events=store.get("clockEvents",[]);
  let active=activeShift();

  if(active){
    active.clockOut=now();
    active.clockOutRaw=Date.now();
    active.hours=((active.clockOutRaw-active.clockInRaw)/3600000).toFixed(2);

    events.unshift({
      id:uid(),
      staff:currentUser.name,
      type:"Clock Out",
      time:active.clockOut,
      raw:Date.now(),
      date:todayKey(),
      read:false,
      message:currentUser.name + " clocked out"
    });

    toast("Clocked out");
  }else{
    const clockInTime=now();
    shifts.unshift({
      id:uid(),
      staff:currentUser.name,
      date:todayKey(),
      clockIn:clockInTime,
      clockInRaw:Date.now()
    });

    events.unshift({
      id:uid(),
      staff:currentUser.name,
      type:"Clock In",
      time:clockInTime,
      raw:Date.now(),
      date:todayKey(),
      read:false,
      message:currentUser.name + " clocked in"
    });

    toast("Clocked in");
  }

  store.set("shifts",shifts);
  store.set("clockEvents",events);
  renderHome();
};
function renderHome(){ $("#currentUserName").textContent=currentUser?.name || "Staff Member"; const active=activeShift(); $("#clockBtn").textContent=active ? "Clock Out" : "Clock In"; $("#clockInfo").textContent=active ? `Clocked in: ${active.clockIn}` : "Start your shift before logging work."; renderStaffTaskMini(); updateManagerOnly(); }
function myTasks(){ return store.get("tasks",[]).filter(t => (t.assignedTo==="All Staff" || t.assignedTo===currentUser?.name) && t.status!=="Done" && isTodayOrDue(t)); }
function renderStaffTaskMini(){ const tasks=myTasks(); $("#taskBadge").textContent=tasks.length; const list=$("#staffTaskMiniList"); if(!tasks.length){ list.innerHTML=`<div class="mini-task">No tasks assigned for today.</div>`; return; } list.innerHTML=tasks.slice(0,3).map(t=>`<div class="mini-task">${t.priority==="Urgent"?"⚠️":"✅"} ${t.title}</div>`).join(""); }
function openStaffTasks(){ renderStaffTasks(); showScreen("#staffTasksScreen"); }
function renderStaffTasks(){ const tasks=myTasks(); $("#staffTasksList").innerHTML = tasks.length ? tasks.map(t=>{ const due = t.dueDate ? `${t.dueDate} ${t.dueTime||""}` : "No due time"; return itemHTML(t.title, `${t.priority} • Due: ${due}`, `${t.location?`Location: ${t.location}<br>`:""}${t.notes||""}`, t.repeat, `<div class="item-actions"><button class="resolve" onclick="completeTask('${t.id}')">Mark Done</button></div>`); }).join("") : `<div class="item">No tasks assigned for today.</div>`; }
function completeTask(id){
  const tasks=store.get("tasks",[]);
  const t=tasks.find(x=>x.id===id);
  if(t){
    t.status="Done";
    t.completedBy=currentUser.name;
    t.completedAt=now();
    t.completedDate=todayKey();
    t.completionNote = "Completed by " + currentUser.name + " at " + t.completedAt;
    store.set("tasks",tasks);
    renderStaffTasks();
    renderStaffTaskMini();
    toast("Task completed");
  }
}
function openForm(type){ $("#formTitle").textContent = type==="Cleaning" ? "Clean Tank" : "Feed Tank"; $("#jobType").value=type; showScreen("#formScreen"); }
function openProblemForm(){ showScreen("#problemScreen"); }
$$(".back").forEach(b=>b.onclick=goHome);
$$(".manager-back").forEach(b=>b.onclick=backToManager);
$("#jobForm").onsubmit=(e)=>{ e.preventDefault(); if(!activeShift()) return toast("Please clock in first"); const job={id:uid(), tank:$("#tankInput").value, type:$("#jobType").value, staff:currentUser.name, date:todayKey(), time:now(), raw:Date.now(), notes:$("#jobNotes").value}; const jobs=store.get("jobs",[]); jobs.unshift(job); store.set("jobs",jobs); e.target.reset(); toast("Saved"); goHome(); };
$("#problemForm").onsubmit=(e)=>{ e.preventDefault(); if(!activeShift()) return toast("Please clock in first"); const issue={ id:uid(), tank:$("#problemTank").value, staff:currentUser.name, time:now(), raw:Date.now(), date:todayKey(), category:$("#problemType").value, subject:$("#problemSubject").value, qty:$("#problemQty").value || "1", desc:$("#problemNotes").value || "Problem reported", status:"Open", managerNote:"" }; const issues=store.get("issues",[]); issues.unshift(issue); store.set("issues",issues); e.target.reset(); toast("Problem submitted"); goHome(); };
$("#testForm").onsubmit=(e)=>{ e.preventDefault(); if(!activeShift()) return toast("Please clock in first"); const test={id:uid(), tank:$("#testTank").value, staff:currentUser.name, time:now(), raw:Date.now(), date:todayKey(), ph:$("#ph").value, ammonia:$("#ammonia").value, nitrite:$("#nitrite").value, nitrate:$("#nitrate").value, phosphate:$("#phosphate").value, salinity:$("#salinity").value, temp:$("#temp").value, alk:$("#alk").value, notes:$("#testNotes").value}; const tests=store.get("tests",[]); tests.unshift(test); store.set("tests",tests); e.target.reset(); renderTests(); toast("Test saved"); };
function itemHTML(title, meta, body="", tag="", extra=""){ return `<div class="item"><h3>${title} ${tag?`<span class="tag">${tag}</span>`:""}</h3><p>${meta}</p>${body?`<p>${body}</p>`:""}${extra}</div>`; }
function deleteRecord(collection, id, renderFn){ if(!canManage()) return toast("Manager only"); if(!confirm("Delete this record?")) return; store.set(collection, store.get(collection,[]).filter(x=>x.id!==id)); if(renderFn) renderFn(); toast("Deleted"); }
function testWarning(t){ const warnings=[]; const nitrate=parseFloat(t.nitrate), phosphate=parseFloat(t.phosphate), ammonia=parseFloat(t.ammonia), nitrite=parseFloat(t.nitrite); if(!isNaN(ammonia) && ammonia>0) warnings.push("Ammonia alert"); if(!isNaN(nitrite) && nitrite>0) warnings.push("Nitrite alert"); if(!isNaN(nitrate) && nitrate>50) warnings.push("High nitrate"); if(!isNaN(phosphate) && phosphate>0.15) warnings.push("High phosphate"); return warnings; }
function renderTests(){ const tests=store.get("tests",[]); $("#recentTests").innerHTML = tests.slice(0,8).map(t=>{ const warns=testWarning(t); const warning = warns.length ? `<div class="status-row">${warns.map(w=>`<span class="pill bad">${w}</span>`).join("")}</div>` : ""; const actions = canManage() ? `<div class="item-actions"><button class="delete" onclick="deleteRecord('tests','${t.id}',renderTests)">Delete</button></div>` : ""; return itemHTML(t.tank, `${t.staff} • ${t.time}`, `pH ${t.ph||"-"} • Ammo ${t.ammonia||"-"} • Nitrite ${t.nitrite||"-"} • Nitrate ${t.nitrate||"-"} • Phos ${t.phosphate||"-"} • Salinity ${t.salinity||"-"}`, "Test", warning+actions); }).join("") || `<div class="item">No test results yet.</div>`; }
$("#rotaForm").onsubmit=(e)=>{ e.preventDefault(); const rota=store.get("rota",[]); rota.unshift({id:uid(), name:$("#rotaName").value, date:$("#rotaDate").value, shift:$("#rotaShift").value, role:$("#rotaRole").value}); store.set("rota",rota); e.target.reset(); renderRota(); };
function renderRota(){ const rota=store.get("rota",[]); const today=todayKey(); $("#rotaList").innerHTML = rota.length ? rota.map(r=>{ const tag = r.date===today ? "Today" : "Rota"; const actions = canManage() ? `<div class="item-actions"><button class="delete" onclick="deleteRecord('rota','${r.id}',renderRota)">Delete</button></div>` : ""; return itemHTML(r.name, `${r.date} • ${r.shift}`, r.role, tag, actions); }).join("") : `<div class="item">No rota entries yet.</div>`; }
$("#handoverForm").onsubmit=(e)=>{ e.preventDefault(); const hand=store.get("handover",[]); hand.unshift({id:uid(), note:$("#handoverNote").value, priority:$("#handoverPriority").value, staff:currentUser.name, time:now(), raw:Date.now(), date:todayKey()}); store.set("handover",hand); e.target.reset(); renderHandover(); };
function renderHandover(){ const hand=store.get("handover",[]); $("#handoverList").innerHTML = hand.length ? hand.map(h=>{ const actions = canManage() ? `<div class="item-actions"><button class="delete" onclick="deleteRecord('handover','${h.id}',renderHandover)">Delete</button></div>` : ""; return itemHTML(`${h.priority} Note`, `${h.staff} • ${h.time}`, h.note, h.priority, actions); }).join("") : `<div class="item">No handover notes yet.</div>`; }
function populateStaffSelects(){ const staff=store.get("staff",[]).filter(s=>s.active); const taskStaff=$("#taskStaff"); if(taskStaff) taskStaff.innerHTML=`<option>All Staff</option>` + staff.filter(s=>s.role!=="manager").map(s=>`<option>${s.name}</option>`).join(""); }
function renderAssignTask(){ populateStaffSelects(); $("#taskDueDate").value=todayKey(); }
$("#taskForm").onsubmit=(e)=>{ e.preventDefault(); const tasks=store.get("tasks",[]); tasks.unshift({id:uid(), assignedTo:$("#taskStaff").value, title:$("#taskTitle").value, location:$("#taskLocation").value, dueDate:$("#taskDueDate").value, dueTime:$("#taskDueTime").value, repeat:$("#taskRepeat").value, priority:$("#taskPriority").value, notes:$("#taskNotes").value, status:"Not Started", createdBy:currentUser.name, createdAt:now(), raw:Date.now()}); store.set("tasks",tasks); e.target.reset(); toast("Task sent"); renderManagerHome(); showScreen("#managerHomeScreen"); };
function renderManagerTasks(){
  const tasks=store.get("tasks",[]);
  if(!tasks.length){
    $("#managerTasksList").innerHTML = `<div class="item">No tasks assigned yet.</div>`;
    return;
  }

  const pending = tasks.filter(t=>t.status!=="Done");
  const done = tasks.filter(t=>t.status==="Done");

  const renderTask = (t) => {
    const statusClass = t.status==="Done" ? "good" : isOverdue(t) ? "bad" : "warn";
    const status = t.status==="Done"
      ? `Completed by ${t.completedBy || "staff"}`
      : isOverdue(t) ? "Overdue" : "Pending";

    const assigned = `Assigned to: ${t.assignedTo} • Assigned by: ${t.createdBy || "Manager"} • Due ${t.dueDate||"-"} ${t.dueTime||""}`;
    const body = `${t.location?`Location: ${t.location}<br>`:""}${t.notes||""}
      ${t.completedAt?`<br><b>Completed at:</b> ${t.completedAt}`:""}
      <div class="status-row"><span class="pill ${statusClass}">${status}</span><span class="pill">${t.priority}</span></div>`;

    const actions = `<div class="item-actions">
      ${t.status!=="Done" ? `<button class="resolve" onclick="managerCompleteTask('${t.id}')">Mark Done</button>` : `<button onclick="reopenTask('${t.id}')">Reopen</button>`}
      <button class="delete" onclick="deleteRecord('tasks','${t.id}',renderManagerTasks)">Delete</button>
    </div>`;

    return itemHTML(t.title, assigned, body, t.status==="Done" ? "Completed" : t.repeat, actions);
  };

  $("#managerTasksList").innerHTML =
    `<div class="item"><h3>Pending Tasks</h3><p>${pending.length} still to complete</p></div>` +
    (pending.length ? pending.map(renderTask).join("") : `<div class="item">No pending tasks.</div>`) +
    `<div class="item"><h3>Completed Tasks</h3><p>${done.length} completed</p></div>` +
    (done.length ? done.map(renderTask).join("") : `<div class="item">No completed tasks yet.</div>`);
}

function managerCompleteTask(id){ const tasks=store.get("tasks",[]); const t=tasks.find(x=>x.id===id); if(t){ t.status="Done"; t.completedBy=currentUser.name; t.completedAt=now(); t.completedDate=todayKey(); store.set("tasks",tasks); renderManagerTasks(); toast("Task marked done"); } }

function reopenTask(id){
  const tasks=store.get("tasks",[]);
  const t=tasks.find(x=>x.id===id);
  if(t){
    t.status="Not Started";
    delete t.completedBy;
    delete t.completedAt;
    delete t.completedDate;
    delete t.completionNote;
    store.set("tasks",tasks);
    renderManagerTasks();
    toast("Task reopened");
  }
}
function renderLivestockIssues(){ const issues=store.get("issues",[]); $("#livestockIssuesList").innerHTML = issues.length ? issues.map(i=>{ const statusClass = i.status==="Resolved" ? "good" : i.status==="In Progress" ? "warn" : "bad"; const actions = `<div class="item-actions"><button onclick="setIssueStatus('${i.id}','Open')">Open</button><button onclick="setIssueStatus('${i.id}','In Progress')">In Progress</button><button class="resolve" onclick="setIssueStatus('${i.id}','Resolved')">Resolved</button><button onclick="addIssueNote('${i.id}')">Note</button><button class="delete" onclick="deleteRecord('issues','${i.id}',renderLivestockIssues)">Delete</button></div>`; return itemHTML(`${i.category}: ${i.subject || i.tank}`, `${i.tank} • ${i.staff} • ${i.time}`, `Qty: ${i.qty||"-"}<br>${i.desc}${i.managerNote?`<br><b>Manager note:</b> ${i.managerNote}`:""}<div class="status-row"><span class="pill ${statusClass}">${i.status||"Open"}</span></div>`, i.category, actions); }).join("") : `<div class="item">No livestock issues logged.</div>`; }
function setIssueStatus(id,status){ const issues=store.get("issues",[]); const issue=issues.find(i=>i.id===id); if(issue){ issue.status=status; issue.updatedBy=currentUser.name; issue.updatedAt=now(); store.set("issues",issues); renderLivestockIssues(); renderManagerHome(); toast("Issue updated"); } }
function addIssueNote(id){ const note=prompt("Manager note:"); if(note===null) return; const issues=store.get("issues",[]); const issue=issues.find(i=>i.id===id); if(issue){ issue.managerNote=note; issue.updatedBy=currentUser.name; issue.updatedAt=now(); store.set("issues",issues); renderLivestockIssues(); toast("Note added"); } }
function renderManagerHome(){
  populateQuickStaffSelect();
  renderStaffSettings();

  const issues=store.get("issues",[]).filter(i=>i.status!=="Resolved");
  const tasks=store.get("tasks",[]);
  const pendingTasks=tasks.filter(t=>t.status!=="Done");
  const completedToday=tasks.filter(t=>t.status==="Done" && t.completedDate===todayKey());
  const shifts=store.get("shifts",[]).filter(s=>!s.clockOut);

  $("#mgrOpenIssues").textContent=issues.length;
  $("#mgrTasksDue").textContent=pendingTasks.length;
  $("#mgrClockedIn").textContent=shifts.length;
  $("#mgrDoneToday").textContent=completedToday.length;

  const issueBox=$("#mgrLiveIssues");
  if(issueBox){
    issueBox.innerHTML = issues.length ? issues.slice(0,5).map(i=>{
      return itemHTML(
        `${i.category}: ${i.subject || i.tank}`,
        `${i.tank} • ${i.staff} • ${i.time}`,
        i.desc || "",
        "Issue",
        `<div class="item-actions">
          <button onclick="setIssueStatusQuick('${i.id}','In Progress')">Fixing</button>
          <button class="resolve" onclick="setIssueStatusQuick('${i.id}','Resolved')">Done</button>
        </div>`
      );
    }).join("") : `<div class="item">No problems reported.</div>`;
  }

  const pendingBox=$("#mgrPendingTasks");
  if(pendingBox){
    pendingBox.innerHTML = pendingTasks.length ? pendingTasks.slice(0,8).map(t=>{
      const due = t.dueDate ? `${t.dueDate} ${t.dueTime||""}` : "No due time";
      return itemHTML(
        t.title,
        `${t.assignedTo} • ${due}`,
        `${t.location?`Location: ${t.location}<br>`:""}${t.notes||""}`,
        isOverdue(t) ? "Overdue" : "Pending",
        `<div class="item-actions">
          <button class="resolve" onclick="managerCompleteTaskQuick('${t.id}')">Done</button>
          <button class="delete" onclick="deleteRecord('tasks','${t.id}',renderManagerHome)">Delete</button>
        </div>`
      );
    }).join("") : `<div class="item">No tasks waiting.</div>`;
  }

  const doneBox=$("#mgrCompletedTasks");
  if(doneBox){
    doneBox.innerHTML = completedToday.length ? completedToday.slice(0,8).map(t=>{
      return itemHTML(t.title, `Done by ${t.completedBy || "staff"} • ${t.completedAt || ""}`, "", "Done",
      `<div class="item-actions"><button onclick="reopenTaskQuick('${t.id}')">Reopen</button></div>`);
    }).join("") : `<div class="item">Nothing completed yet today.</div>`;
  }

  const shiftBox=$("#mgrClockedInList");
  if(shiftBox){
    shiftBox.innerHTML = shifts.length ? shifts.map(s=>itemHTML(s.staff, `Clocked in: ${s.clockIn}`, "", "In")).join("") : `<div class="item">No staff clocked in.</div>`;
  }
}

function populateQuickStaffSelect(){
  const staff=store.get("staff",[]).filter(s=>s.active);
  const select=$("#quickTaskStaff");
  if(select) select.innerHTML=`<option>All Staff</option>` + staff.filter(s=>s.role!=="manager").map(s=>`<option>${s.name}</option>`).join("");
  const date=$("#quickTaskDueDate");
  if(date && !date.value) date.value=todayKey();
}

function setIssueStatusQuick(id,status){
  const issues=store.get("issues",[]);
  const issue=issues.find(i=>i.id===id);
  if(issue){
    issue.status=status;
    issue.updatedBy=currentUser.name;
    issue.updatedAt=now();
    store.set("issues",issues);
    renderManagerHome();
    toast("Problem updated");
  }
}

function managerCompleteTaskQuick(id){
  const tasks=store.get("tasks",[]);
  const t=tasks.find(x=>x.id===id);
  if(t){
    t.status="Done";
    t.completedBy=currentUser.name;
    t.completedAt=now();
    t.completedDate=todayKey();
    store.set("tasks",tasks);
    renderManagerHome();
    toast("Task done");
  }
}

function reopenTaskQuick(id){
  const tasks=store.get("tasks",[]);
  const t=tasks.find(x=>x.id===id);
  if(t){
    t.status="Not Started";
    delete t.completedBy;
    delete t.completedAt;
    delete t.completedDate;
    store.set("tasks",tasks);
    renderManagerHome();
    toast("Task reopened");
  }
}

function renderManagerTools(){
  const staff=store.get("staff",[]).filter(s=>s.active);
  const select=$("#quickTaskStaff");
  if(select) select.innerHTML=`<option>All Staff</option>` + staff.filter(s=>s.role!=="manager").map(s=>`<option>${s.name}</option>`).join("");
  const date=$("#quickTaskDueDate");
  if(date && !date.value) date.value=todayKey();
  const rotaDate=$("#quickRotaDate");
  if(rotaDate && !rotaDate.value) rotaDate.value=todayKey();
}

function renderManagerRotaPreview(){
  const box=$("#mgrRotaList");
  if(!box) return;
  const rota=store.get("rota",[]);
  box.innerHTML = rota.length ? rota.slice(0,5).map(r=>{
    return itemHTML(r.name, `${r.date} • ${r.shift}`, r.role, r.date===todayKey() ? "Today" : "Rota",
      `<div class="item-actions"><button class="delete" onclick="deleteRecord('rota','${r.id}',renderManagerHome)">Delete</button></div>`);
  }).join("") : `<div class="item">No rota entries yet.</div>`;
}

function renderManagerHandoverPreview(){
  const box=$("#mgrHandoverList");
  if(!box) return;
  const hand=store.get("handover",[]);
  box.innerHTML = hand.length ? hand.slice(0,5).map(h=>{
    return itemHTML(`${h.priority} Note`, `${h.staff} • ${h.time}`, h.note, h.priority,
      `<div class="item-actions"><button class="delete" onclick="deleteRecord('handover','${h.id}',renderManagerHome)">Delete</button></div>`);
  }).join("") : `<div class="item">No handover notes yet.</div>`;
}

function renderManagerTools(id,status){
  const issues=store.get("issues",[]);
  const issue=issues.find(i=>i.id===id);
  if(issue){
    issue.status=status;
    issue.updatedBy=currentUser.name;
    issue.updatedAt=now();
    store.set("issues",issues);
    renderManagerHome();
    toast("Issue updated");
  }
}

function managerCompleteTaskQuick(id){
  const tasks=store.get("tasks",[]);
  const t=tasks.find(x=>x.id===id);
  if(t){
    t.status="Done";
    t.completedBy=currentUser.name;
    t.completedAt=now();
    t.completedDate=todayKey();
    store.set("tasks",tasks);
    renderManagerHome();
    toast("Task marked done");
  }
}

function reopenTaskQuick(id){
  const tasks=store.get("tasks",[]);
  const t=tasks.find(x=>x.id===id);
  if(t){
    t.status="Not Started";
    delete t.completedBy;
    delete t.completedAt;
    delete t.completedDate;
    store.set("tasks",tasks);
    renderManagerHome();
    toast("Task reopened");
  }
}


function markClockAlertRead(id){
  const events=store.get("clockEvents",[]);
  const event=events.find(e=>e.id===id);
  if(event){
    event.read=true;
    store.set("clockEvents",events);
    renderManagerHome();
    toast("Alert marked seen");
  }
}

function markAllClockAlertsSeen(){
  const events=store.get("clockEvents",[]);
  events.forEach(e=>e.read=true);
  store.set("clockEvents",events);
  renderManagerHome();
  toast("All clock alerts marked seen");
}

function renderManagerTools(){ const summary=[["Jobs", store.get("jobs",[]).length],["Tests", store.get("tests",[]).length],["Problems", store.get("issues",[]).length],["Tasks", store.get("tasks",[]).length],["Rota", store.get("rota",[]).length],["Handover", store.get("handover",[]).length],["Shifts", store.get("shifts",[]).length]]; $("#managerToolsSummary").innerHTML=summary.map(([name,count])=>itemHTML(name, `${count} records`, "", "Data")).join(""); }
function exportData(){ const data={staff:store.get("staff",[]), shifts:store.get("shifts",[]), jobs:store.get("jobs",[]), tests:store.get("tests",[]), issues:store.get("issues",[]), tasks:store.get("tasks",[]), rota:store.get("rota",[]), handover:store.get("handover",[])}; const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="finest-staff-hub-export.json"; a.click(); }
function clearLogsOnly(){ if(!canManage()) return; if(!confirm("Clear all logs, tests, problems, tasks, rota, handover and shifts? Staff profiles will stay.")) return; ["jobs","tests","issues","tasks","rota","handover","shifts"].forEach(k=>store.set(k,[])); renderManagerTools(); toast("Logs cleared"); }
function factoryResetDemo(){ if(!canManage()) return; if(!confirm("Factory reset demo? This clears everything and restores demo staff.")) return; localStorage.clear(); store.set("staff", initialStaff); ["jobs","tests","issues","tasks","rota","handover","shifts"].forEach(k=>store.set(k,[])); currentUser=null; showScreen("#loginScreen"); toast("Demo reset"); }

const quickTaskForm=$("#quickTaskForm");
if(quickTaskForm){
  quickTaskForm.onsubmit=(e)=>{
    e.preventDefault();
    const tasks=store.get("tasks",[]);
    tasks.unshift({
      id:uid(),
      assignedTo:$("#quickTaskStaff").value,
      title:$("#quickTaskTitle").value,
      location:$("#quickTaskLocation").value,
      dueDate:$("#quickTaskDueDate").value,
      dueTime:$("#quickTaskDueTime").value,
      repeat:$("#quickTaskRepeat").value,
      priority:$("#quickTaskPriority").value,
      notes:$("#quickTaskNotes").value,
      status:"Not Started",
      createdBy:currentUser.name,
      createdAt:now(),
      raw:Date.now()
    });
    store.set("tasks",tasks);
    e.target.reset();
    toast("Task sent");
    renderManagerHome();
  };
}

const quickStaffForm=$("#quickStaffForm");
if(quickStaffForm){
  quickStaffForm.onsubmit=(e)=>{
    e.preventDefault();
    const staff=store.get("staff",[]);
    const name=$("#quickStaffName").value.trim();
    const pin=$("#quickStaffPin").value.trim();
    if(!name || !pin) return toast("Name and PIN required");
    if(staff.some(s=>s.pin===pin)) return toast("PIN already used");
    staff.push({id:uid(), name, pin, role:$("#quickStaffRole").value, active:true});
    store.set("staff",staff);
    e.target.reset();
    toast("Staff added");
    renderManagerHome();
  };
}

const quickRotaForm=$("#quickRotaForm");
if(quickRotaForm){
  quickRotaForm.onsubmit=(e)=>{
    e.preventDefault();
    const rota=store.get("rota",[]);
    rota.unshift({id:uid(), name:$("#quickRotaName").value, date:$("#quickRotaDate").value, shift:$("#quickRotaShift").value, role:$("#quickRotaRole").value});
    store.set("rota",rota);
    e.target.reset();
    toast("Rota added");
    renderManagerHome();
  };
}

const quickHandoverForm=$("#quickHandoverForm");
if(quickHandoverForm){
  quickHandoverForm.onsubmit=(e)=>{
    e.preventDefault();
    const hand=store.get("handover",[]);
    hand.unshift({id:uid(), note:$("#quickHandoverNote").value, priority:$("#quickHandoverPriority").value, staff:currentUser.name, time:now(), raw:Date.now(), date:todayKey()});
    store.set("handover",hand);
    e.target.reset();
    toast("Note added");
    renderManagerHome();
  };
}


function logout(){ currentUser=null; showScreen("#loginScreen"); $("#pinInput").value=""; $("#managerPinInput").value=""; }
window.addEventListener("DOMContentLoaded",()=>{ $("#menuBtn")?.addEventListener("click", window.openMoreMenu); });


function setIssueStatusQuick(id,status){
  const issues=store.get("issues",[]);
  const issue=issues.find(i=>i.id===id);
  if(issue){
    issue.status=status;
    issue.updatedBy=currentUser.name;
    issue.updatedAt=now();
    store.set("issues",issues);
    renderManagerHome();
    toast("Issue updated");
  }
}

function addIssueNoteQuick(id){
  const note=prompt("Manager note:");
  if(note===null) return;
  const issues=store.get("issues",[]);
  const issue=issues.find(i=>i.id===id);
  if(issue){
    issue.managerNote=note;
    issue.updatedBy=currentUser.name;
    issue.updatedAt=now();
    store.set("issues",issues);
    renderManagerHome();
    toast("Note added");
  }
}

function managerCompleteTaskQuick(id){
  const tasks=store.get("tasks",[]);
  const t=tasks.find(x=>x.id===id);
  if(t){
    t.status="Done";
    t.completedBy=currentUser.name;
    t.completedAt=now();
    t.completedDate=todayKey();
    store.set("tasks",tasks);
    renderManagerHome();
    toast("Task marked done");
  }
}

function reopenTaskQuick(id){
  const tasks=store.get("tasks",[]);
  const t=tasks.find(x=>x.id===id);
  if(t){
    t.status="Not Started";
    delete t.completedBy;
    delete t.completedAt;
    delete t.completedDate;
    store.set("tasks",tasks);
    renderManagerHome();
    toast("Task reopened");
  }
}

function markClockAlertRead(id){
  const events=store.get("clockEvents",[]);
  const event=events.find(e=>e.id===id);
  if(event){
    event.read=true;
    store.set("clockEvents",events);
    renderManagerHome();
    toast("Alert marked seen");
  }
}

function markAllClockAlertsSeen(){
  const events=store.get("clockEvents",[]);
  events.forEach(e=>e.read=true);
  store.set("clockEvents",events);
  renderManagerHome();
  toast("All clock alerts marked seen");
}

function renderQuickHistory(){
  const box=$("#quickHistoryList");
  if(!box) return;
  const q=norm($("#quickHistorySearch")?.value);
  const type=$("#quickHistoryType")?.value || "all";
  const date=$("#quickHistoryDate")?.value || "";
  let items=[];
  if(type==="all"||type==="jobs") items.push(...store.get("jobs",[]).map(x=>({collection:"jobs", id:x.id, kind:"Job", staff:x.staff, date:x.date, raw:x.raw, title:x.tank, meta:`${x.type} • ${x.staff} • ${x.time}`, body:x.notes})));
  if(type==="all"||type==="tests") items.push(...store.get("tests",[]).map(x=>({collection:"tests", id:x.id, kind:"Test", staff:x.staff, date:x.date, raw:x.raw, title:x.tank, meta:`${x.staff} • ${x.time}`, body:`pH ${x.ph||"-"} nitrate ${x.nitrate||"-"} phosphate ${x.phosphate||"-"}`})));
  if(type==="all"||type==="issues") items.push(...store.get("issues",[]).map(x=>({collection:"issues", id:x.id, kind:"Problem", staff:x.staff, date:x.date, raw:x.raw, title:x.tank, meta:`${x.category} • ${x.staff} • ${x.time} • ${x.status}`, body:x.desc})));
  if(type==="all"||type==="tasks") items.push(...store.get("tasks",[]).map(x=>({collection:"tasks", id:x.id, kind:"Task", staff:x.assignedTo, date:x.dueDate, raw:x.raw, title:x.title, meta:`${x.assignedTo} • ${x.status} • ${x.priority}`, body:x.notes})));
  if(type==="all"||type==="shifts") items.push(...store.get("shifts",[]).map(x=>({collection:"shifts", id:x.id, kind:"Shift", staff:x.staff, date:x.date, raw:x.clockInRaw, title:x.staff, meta:`${x.clockIn} → ${x.clockOut || "Still clocked in"}`, body:x.hours?`${x.hours} hours`:""})));
  if(type==="all"||type==="handover") items.push(...store.get("handover",[]).map(x=>({collection:"handover", id:x.id, kind:"Handover", staff:x.staff, date:x.date, raw:x.raw, title:x.priority+" Note", meta:`${x.staff} • ${x.time}`, body:x.note})));
  items = items.filter(i=>(!q || norm(i.title+i.meta+i.body+i.kind).includes(q)) && (!date || i.date===date));
  items.sort((a,b)=>(b.raw||0)-(a.raw||0));
  box.innerHTML = items.length ? items.slice(0,8).map(i=>{
    return itemHTML(i.title,i.meta,i.body,i.kind,`<div class="item-actions"><button class="delete" onclick="deleteRecord('${i.collection}','${i.id}',renderManagerHome)">Delete</button></div>`);
  }).join("") : `<div class="item">No records found.</div>`;
}


/* V8 SIMPLE MANAGER FIX */
function v8ManagerStaffOptions(){
  const select = document.getElementById("quickTaskStaff");
  if(!select) return;
  const staff = store.get("staff",[]).filter(s=>s.active && s.role !== "manager");
  select.innerHTML = `<option>All Staff</option>` + staff.map(s=>`<option>${s.name}</option>`).join("");
  const date = document.getElementById("quickTaskDueDate");
  if(date && !date.value) date.value = todayKey();
}

function renderManagerHome(){
  v8ManagerStaffOptions();
  renderStaffSettings();

  const issues = store.get("issues",[]).filter(i=>i.status !== "Resolved");
  const tasks = store.get("tasks",[]);
  const pendingTasks = tasks.filter(t=>t.status !== "Done");
  const completedToday = tasks.filter(t=>t.status === "Done" && t.completedDate === todayKey());
  const shifts = store.get("shifts",[]).filter(s=>!s.clockOut);

  const setText = (id, val) => { const el = document.getElementById(id); if(el) el.textContent = val; };
  setText("mgrOpenIssues", issues.length);
  setText("mgrTasksDue", pendingTasks.length);
  setText("mgrClockedIn", shifts.length);
  setText("mgrDoneToday", completedToday.length);

  const clockBox = document.getElementById("mgrClockedInList");
  if(clockBox){
    clockBox.innerHTML = shifts.length ? shifts.map(s =>
      itemHTML(s.staff, `Clocked in: ${s.clockIn}`, "", "In")
    ).join("") : `<div class="item">No staff clocked in.</div>`;
  }

  const issueBox = document.getElementById("mgrLiveIssues");
  if(issueBox){
    issueBox.innerHTML = issues.length ? issues.map(i =>
      itemHTML(
        `${i.category || "Problem"}: ${i.subject || i.tank}`,
        `${i.tank} • ${i.staff} • ${i.time}`,
        i.desc || "",
        "Problem",
        `<div class="item-actions">
          <button onclick="setIssueStatusQuick('${i.id}','In Progress')">Fixing</button>
          <button class="resolve" onclick="setIssueStatusQuick('${i.id}','Resolved')">Done</button>
          <button class="delete" onclick="deleteRecord('issues','${i.id}',renderManagerHome)">Delete</button>
        </div>`
      )
    ).join("") : `<div class="item">No problems reported.</div>`;
  }

  const pendingBox = document.getElementById("mgrPendingTasks");
  if(pendingBox){
    pendingBox.innerHTML = pendingTasks.length ? pendingTasks.map(t => {
      const due = t.dueDate ? `${t.dueDate} ${t.dueTime || ""}` : "No due time";
      return itemHTML(
        t.title,
        `${t.assignedTo} • ${due}`,
        `${t.location ? `Location: ${t.location}<br>` : ""}${t.notes || ""}`,
        isOverdue(t) ? "Overdue" : "Pending",
        `<div class="item-actions">
          <button class="resolve" onclick="managerCompleteTaskQuick('${t.id}')">Done</button>
          <button class="delete" onclick="deleteRecord('tasks','${t.id}',renderManagerHome)">Delete</button>
        </div>`
      );
    }).join("") : `<div class="item">No tasks waiting.</div>`;
  }

  const doneBox = document.getElementById("mgrCompletedTasks");
  if(doneBox){
    doneBox.innerHTML = completedToday.length ? completedToday.map(t =>
      itemHTML(
        t.title,
        `Done by ${t.completedBy || "staff"} • ${t.completedAt || ""}`,
        "",
        "Done",
        `<div class="item-actions"><button onclick="reopenTaskQuick('${t.id}')">Reopen</button></div>`
      )
    ).join("") : `<div class="item">Nothing completed today yet.</div>`;
  }
}

function setIssueStatusQuick(id,status){
  const issues = store.get("issues",[]);
  const issue = issues.find(i=>i.id===id);
  if(issue){
    issue.status = status;
    issue.updatedBy = currentUser.name;
    issue.updatedAt = now();
    store.set("issues",issues);
    renderManagerHome();
    toast("Problem updated");
  }
}

function managerCompleteTaskQuick(id){
  const tasks = store.get("tasks",[]);
  const t = tasks.find(x=>x.id===id);
  if(t){
    t.status = "Done";
    t.completedBy = currentUser.name;
    t.completedAt = now();
    t.completedDate = todayKey();
    store.set("tasks",tasks);
    renderManagerHome();
    toast("Task done");
  }
}

function reopenTaskQuick(id){
  const tasks = store.get("tasks",[]);
  const t = tasks.find(x=>x.id===id);
  if(t){
    t.status = "Not Started";
    delete t.completedBy;
    delete t.completedAt;
    delete t.completedDate;
    store.set("tasks",tasks);
    renderManagerHome();
    toast("Task reopened");
  }
}

function v8AttachManagerHandlers(){
  const taskForm = document.getElementById("quickTaskForm");
  if(taskForm && !taskForm.dataset.bound){
    taskForm.dataset.bound = "1";
    taskForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const tasks = store.get("tasks",[]);
      tasks.unshift({
        id: uid(),
        assignedTo: document.getElementById("quickTaskStaff").value,
        title: document.getElementById("quickTaskTitle").value,
        location: document.getElementById("quickTaskLocation").value,
        dueDate: document.getElementById("quickTaskDueDate").value,
        dueTime: document.getElementById("quickTaskDueTime").value,
        repeat: document.getElementById("quickTaskRepeat").value,
        priority: document.getElementById("quickTaskPriority").value,
        notes: "",
        status: "Not Started",
        createdBy: currentUser.name,
        createdAt: now(),
        raw: Date.now()
      });
      store.set("tasks",tasks);
      e.target.reset();
      toast("Task given");
      renderManagerHome();
    });
  }

  const staffForm = document.getElementById("quickStaffForm");
  if(staffForm && !staffForm.dataset.bound){
    staffForm.dataset.bound = "1";
    staffForm.addEventListener("submit", (e)=>{
      e.preventDefault();
      const staff = store.get("staff",[]);
      const name = document.getElementById("quickStaffName").value.trim();
      const pin = document.getElementById("quickStaffPin").value.trim();
      if(!name || !pin) return toast("Name and PIN required");
      if(staff.some(s=>s.pin===pin)) return toast("PIN already used");
      staff.push({id:uid(), name, pin, role:document.getElementById("quickStaffRole").value, active:true});
      store.set("staff",staff);
      e.target.reset();
      toast("Staff added");
      renderManagerHome();
    });
  }
}

const oldShowScreenV8 = showScreen;
showScreen = function(id){
  oldShowScreenV8(id);
  if(id === "#managerHomeScreen"){
    setTimeout(()=>{
      v8AttachManagerHandlers();
      renderManagerHome();
    }, 0);
  }
};
