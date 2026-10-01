const root=document.getElementById('app');
let token=localStorage.getItem('token');
let state={teacher:null,students:[],content:[],results:[]};
let recognition=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(url,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};const r=await fetch('/api'+url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}
function authView(){
  const resetToken=new URLSearchParams(location.search).get('reset');
  if(resetToken){return resetPasswordView(resetToken)}
  root.innerHTML=`<main class="center"><section class="card auth-card"><h1>Tuition Teacher App</h1><p>Teacher Login</p><form id="login"><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required><button>Login</button></form><button id="forgot" type="button">Forgot Password?</button><hr><p>Create new Teacher ID</p><form id="reg"><input name="name" placeholder="Teacher name" required><input name="email" type="email" placeholder="Email" required><input name="password" type="password" minlength="6" placeholder="Password (minimum 6 characters)" required><button>Create Account</button></form><hr><button id="adminLoginBtn" type="button">Admin Login</button></section></main>`;
  login.onsubmit=async e=>{e.preventDefault();try{const d=await api('/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(login)))});token=d.token;localStorage.token=token;boot()}catch(x){alert(x.message)}};
  reg.onsubmit=async e=>{e.preventDefault();try{const d=await api('/auth/register',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(reg)))});token=d.token;localStorage.token=token;sessionStorage.teacherCreated=`Teacher ID created successfully!\nName: ${d.teacher.name}\nEmail/Teacher ID: ${d.teacher.email}`;boot()}catch(x){alert(x.message)}};
  forgot.onclick=forgotPasswordView;
  adminLoginBtn.onclick=adminLoginView;
}
function adminLoginView(){
  root.innerHTML=`<main class="center"><section class="card auth-card"><h1>Admin Login</h1><p>केवल <b>Manishgupta021469@gmail.com</b> से Admin Login किया जा सकता है।</p><form id="adminLoginForm"><input id="adminEmail" type="email" value="Manishgupta021469@gmail.com" readonly><input id="adminPassword" type="password" placeholder="Admin Password" required><button>Login</button></form><button id="adminForgotBtn" type="button">Forgot Password?</button><button id="backTeacherLogin" type="button">Back to Teacher Login</button></section></main>`;
  adminLoginForm.onsubmit=async e=>{e.preventDefault();try{const d=await api('/admin/login',{method:'POST',body:JSON.stringify({email:adminEmail.value,password:adminPassword.value})});token=d.token;localStorage.token=token;adminDashboard()}catch(x){alert(x.message)}};
  adminForgotBtn.onclick=adminForgotPasswordView;
  backTeacherLogin.onclick=authView;
}
function adminForgotPasswordView(){
  root.innerHTML=`<main class="center"><section class="card auth-card"><h1>Admin Forgot Password</h1><p>Reset code केवल आपकी authorized Admin email <b>Manishgupta021469@gmail.com</b> पर भेजा जाएगा।</p><form id="adminResetRequestForm"><input id="resetAdminEmail" type="email" value="Manishgupta021469@gmail.com" readonly><button>Send Reset Code</button></form><div id="adminResetBox" style="margin-top:12px"><p class="muted">पहले <b>Send Reset Code</b> दबाएँ। Gmail में आया 6-digit code नीचे डालें।</p><input id="adminResetOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit reset code"><input id="adminNewPassword" type="password" minlength="6" placeholder="New Admin Password (minimum 6 characters)"><input id="adminConfirmPassword" type="password" minlength="6" placeholder="Confirm new password"><button id="adminResetBtn" type="button">Set New Password</button><button id="adminResendResetBtn" type="button">Resend Code</button></div><button id="adminBackLogin" type="button">Back to Admin Login</button></section></main>`;
  const send=async()=>{try{const r=await api('/admin/request-reset',{method:'POST',body:JSON.stringify({email:resetAdminEmail.value})});alert(r.message||'Reset code sent.');adminResetOtp.focus()}catch(x){alert(x.message)}};
  adminResetRequestForm.onsubmit=async e=>{e.preventDefault();await send()};
  adminResendResetBtn.onclick=send;
  adminResetBtn.onclick=async()=>{if(adminNewPassword.value!==adminConfirmPassword.value)return alert('दोनों passwords समान होने चाहिए।');try{const r=await api('/admin/reset-password',{method:'POST',body:JSON.stringify({email:resetAdminEmail.value,otp:adminResetOtp.value,newPassword:adminNewPassword.value})});alert(r.message||'Password reset successfully.');adminLoginView()}catch(x){alert(x.message)}};
  adminBackLogin.onclick=adminLoginView;
}
async function adminDashboard(){
  try{const d=await api('/admin/me');if(d.role!=='admin')throw Error('Admin session required');const teachers=await api('/admin/teachers');
    root.innerHTML=`<header><b>Admin Dashboard</b><button id="adminLogout">Logout</button></header><main><section class="card"><h2>Teacher IDs</h2><p class="muted">Admin किसी Teacher का dashboard check कर सकता है, password बदल सकता है, Teacher को block/unblock कर सकता है या उसकी पूरी ID delete कर सकता है। सुरक्षा के लिए किसी Teacher का मौजूदा password कभी दिखाया नहीं जाएगा; Admin नया password सेट कर सकता है।</p><div id="adminTeacherList">${teachers.map(t=>`<div class="student-row"><div><b>${esc(t.name)}</b> ${t.is_blocked?'<span class="muted">(BLOCKED)</span>':''}<br><small>${esc(t.email)} · Teacher ID #${t.id} · ${t.student_count} students · ${t.test_count} tests</small></div><div><button type="button" data-admin-open="${t.id}">Open Dashboard</button><button type="button" data-admin-password="${t.id}">Change Password</button><button type="button" data-admin-block="${t.id}" data-blocked="${t.is_blocked?'1':'0'}">${t.is_blocked?'Unblock Teacher':'Block Teacher'}</button><button type="button" data-admin-delete="${t.id}">Delete Teacher</button></div></div>`).join('')||'<p>No teachers registered yet.</p>'}</div></section></main>`;
    adminLogout.onclick=()=>{localStorage.removeItem('token');authView()};
    document.querySelectorAll('[data-admin-open]').forEach(b=>b.onclick=()=>adminOpenTeacher(+b.dataset.adminOpen));
    document.querySelectorAll('[data-admin-password]').forEach(b=>b.onclick=()=>adminSetTeacherPassword(+b.dataset.adminPassword));
    document.querySelectorAll('[data-admin-block]').forEach(b=>b.onclick=()=>adminBlockTeacher(+b.dataset.adminBlock,b.dataset.blocked==='1'));
    document.querySelectorAll('[data-admin-delete]').forEach(b=>b.onclick=()=>adminDeleteTeacher(+b.dataset.adminDelete));
  }catch(e){localStorage.removeItem('token');alert(e.message||'Admin session expired');authView()}
}
async function adminOpenTeacher(id){try{const r=await api('/admin/teachers/'+id+'/impersonate',{method:'POST'});sessionStorage.adminTeacherToken=token;token=r.token;localStorage.token=token;await load();dashboard()}catch(e){alert(e.message)}}
async function adminSetTeacherPassword(id){
  const teachers=await api('/admin/teachers');const t=teachers.find(x=>x.id===id);if(!t)return;
  const newPassword=prompt(`Teacher "${t.name}" के लिए नया password डालें (कम से कम 6 characters):`);if(newPassword===null)return;
  if(newPassword.length<6)return alert('Password कम से कम 6 characters का होना चाहिए।');
  const confirmPassword=prompt('नया password दोबारा डालें:');if(confirmPassword===null)return;
  if(newPassword!==confirmPassword)return alert('दोनों passwords समान नहीं हैं।');
  if(!confirm(`Teacher "${t.name}" का नया password सेट करना है? पुराना password दिखाया नहीं जा सकता।`))return;
  try{const r=await api('/admin/teachers/'+id+'/set-password',{method:'POST',body:JSON.stringify({newPassword})});alert(r.message||'Password changed successfully.');}catch(e){alert(e.message)}
}
async function adminBlockTeacher(id,currentBlocked){
  const teachers=await api('/admin/teachers');const t=teachers.find(x=>x.id===id);if(!t)return;
  const next=!currentBlocked;
  if(!confirm(next?`Teacher "${t.name}" को block करना है? वह login नहीं कर पाएगा।`:`Teacher "${t.name}" को unblock करना है?`))return;
  try{await api('/admin/teachers/'+id+'/block',{method:'POST',body:JSON.stringify({blocked:next})});await adminDashboard();}catch(e){alert(e.message)}
}
async function adminDeleteTeacher(id){const teachers=await api('/admin/teachers');const t=teachers.find(x=>x.id===id);if(!t)return;if(!confirm(`पहली पुष्टि: क्या Teacher "${t.name}" (${t.email}) को delete करना है?`))return;if(!confirm(`दूसरी पुष्टि: इस Teacher की ID के साथ उसके students, subjects, books, chapters और saved test results भी delete होंगे। आगे बढ़ें?`))return;if(!confirm(`तीसरी और अंतिम पुष्टि: Teacher ID #${t.id} को स्थायी रूप से delete करना है?`))return;try{await api('/admin/teachers/'+id,{method:'DELETE'});await adminDashboard()}catch(e){alert(e.message)}}
async function backToAdmin(){const t=sessionStorage.getItem('adminTeacherToken');if(!t)return authView();token=t;localStorage.token=t;sessionStorage.removeItem('adminTeacherToken');await adminDashboard()}
function decodeJwtRole(){try{const p=String(token||'').split('.')[1];return p?JSON.parse(atob(p.replace(/-/g,'+').replace(/_/g,'/'))).role||'teacher':'teacher'}catch{return 'teacher'}}
function forgotPasswordView(){
  root.innerHTML=`<main class="center"><section class="card"><h1>Forgot Password</h1><p>अपना registered email डालें। Password reset link इसी email पर भेजा जाएगा।</p><form id="forgotForm"><input id="forgotEmail" type="email" placeholder="Registered email" required><button>Send Reset Link</button></form><button id="backLogin" type="button">Back to Login</button></section></main>`;
  forgotForm.onsubmit=async e=>{e.preventDefault();try{const r=await api('/auth/forgot-password',{method:'POST',body:JSON.stringify({email:forgotEmail.value})});alert(r.message||'Reset link sent.');authView()}catch(x){alert(x.message)}};
  backLogin.onclick=authView;
}
function resetPasswordView(resetToken){
  root.innerHTML=`<main class="center"><section class="card"><h1>Reset Password</h1><p>नया password सेट करें।</p><form id="resetForm"><input id="newResetPassword" type="password" minlength="6" placeholder="New password (minimum 6 characters)" required><input id="confirmResetPassword" type="password" minlength="6" placeholder="Confirm new password" required><button>Reset Password</button></form></section></main>`;
  resetForm.onsubmit=async e=>{e.preventDefault();if(newResetPassword.value!==confirmResetPassword.value)return alert('दोनों passwords समान होने चाहिए।');try{const r=await api('/auth/reset-password',{method:'POST',body:JSON.stringify({token:resetToken,newPassword:newResetPassword.value})});alert(r.message||'Password reset successfully.');history.replaceState({},'',location.pathname);authView()}catch(x){alert(x.message)}};
}
async function load(){[state.teacher,state.students,state.content,state.results]=await Promise.all([api('/me'),api('/students'),api('/content'),api('/results')])}
function dashboard(){
  const created=sessionStorage.getItem('teacherCreated');
  sessionStorage.removeItem('teacherCreated');
  root.innerHTML=`<header><b>Tuition Teacher App${decodeJwtRole()==='admin_impersonate'?' — Admin Check Mode':''}</b><div>${decodeJwtRole()==='admin_impersonate'?'<button id="backAdmin" type="button">Back to Admin</button>':''}<button id="changePassword" type="button">Change Password</button><button id="logout">Logout</button></div></header><main>${created?`<section class="success-banner"><b>${esc(created).replace(/\n/g,'<br>')}</b></section>`:''}<section class="grid"><div class="card"><h2>Students</h2><p>${state.students.length}/20</p><button id="addStudent">Add Student</button><div id="studentList">${state.students.map((s,i)=>`<div class="student-row"><button class="list" data-s="${s.id}">${i+1}. ${esc(s.name)} — Class ${esc(s.class_name)}</button><button class="delete-student" type="button" data-delete-student="${s.id}">Delete Student</button></div>`).join('')||'<p>No students yet.</p>'}</div></div><div class="card"><h2>Performance</h2>${state.results.map((r,i)=>`<div class="result"><b>#${i+1} ${esc(r.name)}</b><span>${r.score}% · ${r.tests} tests</span></div>`).join('')||'<p>No test results yet.</p>'}</div></section><section class="card"><h2>Content</h2><button id="addSubject">Create Subject</button><div id="content">${renderContent()}</div></section></main>`;
  logout.onclick=()=>{localStorage.clear();sessionStorage.removeItem('adminTeacherToken');location.reload()};
  if(decodeJwtRole()==='admin_impersonate')backAdmin.onclick=backToAdmin;
  changePassword.onclick=changePasswordForm;
  addStudent.onclick=addStudentForm;addSubject.onclick=addSubjectForm;
  document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>studentTests(+b.dataset.s));
  document.querySelectorAll('[data-delete-student]').forEach(b=>b.onclick=()=>deleteStudent(+b.dataset.deleteStudent));
}
function changePasswordForm(){
  root.innerHTML=`<header><b>Change Password</b><button id="backDash">Back</button></header><main><section class="card"><h2>Change Teacher Password</h2><form id="changePassForm"><input id="currentPassword" type="password" placeholder="Current password" required><input id="newPassword" type="password" minlength="6" placeholder="New password (minimum 6 characters)" required><input id="confirmPassword" type="password" minlength="6" placeholder="Confirm new password" required><button>Change Password</button></form></section></main>`;
  backDash.onclick=refresh;
  changePassForm.onsubmit=async e=>{e.preventDefault();if(newPassword.value!==confirmPassword.value)return alert('दोनों new passwords समान होने चाहिए।');try{const r=await api('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:currentPassword.value,newPassword:newPassword.value})});alert(r.message||'Password changed successfully.');refresh()}catch(x){alert(x.message)}};
}
function renderContent(){return state.content.map(s=>`<div class="subject"><h3>${esc(s.name)}</h3><button onclick="editSubject(${s.id})">Edit Subject</button><button onclick="addBookForm(${s.id})">+ Book</button>${s.books.map(b=>`<div class="book"><b>${esc(b.name)}</b><button onclick="editBook(${b.id})">Edit Book</button><button onclick="addChapterForm(${b.id})">+ Chapter</button>${b.chapters.map(c=>`<div class="chapter"><b>${esc(c.name)}</b> <small>${c.paragraphs.length} paragraphs · ${c.qa.length} Q&A</small><button onclick="editChapter(${c.id})">Open / Edit Chapter</button></div>`).join('')}</div>`).join('')}</div>`).join('')||'<p>No subjects yet.</p>'}
async function refresh(){await load();dashboard()}
async function addStudentForm(){const name=prompt('Student name');if(!name)return;const className=prompt('Class');if(!className)return;const phone=prompt('WhatsApp number (country code सहित, जैसे 919876543210)');try{await api('/students',{method:'POST',body:JSON.stringify({name,className,phone})});await refresh()}catch(e){alert(e.message)}}
async function deleteStudent(id){
  const student=state.students.find(s=>s.id===id);
  if(!student)return;

  // Deliberately require three separate confirmations so an accidental tap
  // on the Delete Student button cannot immediately remove the student.
  if(!confirm(`पहली पुष्टि: क्या आप छात्र \"${student.name}\" को delete करना चाहते हैं?`))return;
  if(!confirm(`दूसरी पुष्टि: \"${student.name}\" की ID और उसके सभी saved test results delete हो जाएंगे। क्या आप आगे बढ़ना चाहते हैं?`))return;
  if(!confirm(`तीसरी और अंतिम पुष्टि: \"${student.name}\" को स्थायी रूप से delete करना है? OK दबाने पर deletion होगा।`))return;

  try{
    await api('/students/'+id,{method:'DELETE'});
    await refresh();
  }catch(e){alert(e.message)}
}
async function addSubjectForm(){const name=prompt('Subject name');if(!name)return;try{await api('/subjects',{method:'POST',body:JSON.stringify({name})});await refresh()}catch(e){alert(e.message)}}
async function editSubject(id){const s=state.content.find(x=>x.id===id);if(!s)return;const name=prompt('Edit Subject name',s.name);if(name===null||!name.trim())return;try{await api('/subjects/'+id,{method:'PUT',body:JSON.stringify({name:name.trim()})});await refresh()}catch(e){alert(e.message)}}
async function addBookForm(subjectId){const name=prompt('Book name');if(!name)return;try{await api('/books',{method:'POST',body:JSON.stringify({subjectId,name})});await refresh()}catch(e){alert(e.message)}}
async function editBook(id){const b=state.content.flatMap(s=>s.books).find(x=>x.id===id);if(!b)return;const name=prompt('Edit Book name',b.name);if(name===null||!name.trim())return;try{await api('/books/'+id,{method:'PUT',body:JSON.stringify({name:name.trim()})});await refresh()}catch(e){alert(e.message)}}
async function addChapterForm(bookId){const name=prompt('Chapter name');if(!name)return;const text=prompt('Paste full chapter text. Blank lines/new lines will create paragraphs.');if(text===null)return;try{await api('/chapters',{method:'POST',body:JSON.stringify({bookId,name,text})});await refresh()}catch(e){alert(e.message)}}
async function studentTests(id){
  const s=state.students.find(x=>x.id===id);if(!s)return;
  const chapters=state.content.flatMap(x=>x.books.flatMap(b=>b.chapters));
  let attempts=[];try{attempts=await api('/results/'+id)}catch(e){console.error(e)}
  const groups={};attempts.forEach(r=>{const key=`${r.test_type}:${r.chapter_id}:${r.item_id||0}`;(groups[key]??=[]).push(r)});
  attempts.forEach(r=>{const key=`${r.test_type}:${r.chapter_id}:${r.item_id||0}`;const arr=groups[key].slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));r.attempt_no=arr.findIndex(x=>x.id===r.id)+1});
  const historyHtml=attempts.length?attempts.map(r=>`<div class="attempt-row"><div><b>Attempt ${r.attempt_no}</b> — ${esc(r.test_type==='paragraph'?'Paragraph':r.test_type==='qa'?'Q&A':'Complete Chapter')} ${r.chapter_name?`— ${esc(r.chapter_name)}`:''}${r.paragraph_position?` · Paragraph ${r.paragraph_position}`:''}</div><span>${Number(r.score_percent).toFixed(2)}%</span><button onclick="showAttemptResult(${r.id})">Open Attempt</button></div>`).join(''):'<p class="muted">अभी कोई attempt नहीं है। Test देने के बाद यहाँ history दिखाई देगी।</p>';
  window.__attempts=attempts;
  root.innerHTML=`<header><b>${esc(s.name)} — Class ${esc(s.class_name)}</b><button onclick="refresh()">Back</button></header><main>
  <section class="card"><h2>Student WhatsApp</h2><p>${s.phone?`Saved number: <b>${esc(s.phone)}</b>`:'अभी WhatsApp number saved नहीं है।'}</p><button id="setPhone">${s.phone?'Change WhatsApp Number':'Save WhatsApp Number'}</button>${s.phone?`<button id="sendWhatsappReport" type="button">📱 WhatsApp Text Report भेजें</button><button id="makePdfReport" type="button">📄 PDF Attachments चुनकर भेजें</button><small class="muted">Test खत्म होते ही कुछ अपने-आप नहीं भेजा जाएगा। नीचे से जितने tested paragraph PDF attachments चाहें select करके भेज सकते हैं, या सभी भेज सकते हैं।</small>`:'<small class="muted">पहले student का WhatsApp number save करें। फिर जब चाहें report भेज सकते हैं।</small>'}</section>
  <section class="card"><h2>Select Test</h2>${chapters.map(c=>`<div class="testrow"><b>${esc(c.name)}</b><span>${c.paragraphs.length} paragraphs · ${c.qa.length} Q&A</span><button onclick="selectParagraph(${id},${c.id})" ${c.paragraphs.length?'':'disabled'}>Choose Paragraph</button><button onclick="startQaTest(${id},${c.id})" ${c.qa.length?'':'disabled'}>Q&A Test</button><button onclick="startChapterTest(${id},${c.id})" ${c.paragraphs.length?'':'disabled'}>Complete Chapter</button></div>`).join('')||'<p>No chapters yet.</p>'}</section>
  <section class="card"><h2>Attempt History</h2>${historyHtml}</section></main>`;
  document.getElementById('setPhone').onclick=async()=>{const phone=prompt('WhatsApp number country code सहित (जैसे 919876543210)',s.phone||'');if(phone===null)return;try{const updated=await api('/students/'+id+'/phone',{method:'PUT',body:JSON.stringify({phone})});s.phone=updated.phone||null;studentTests(id)}catch(e){alert(e.message)}};
  const sendReportBtn=document.getElementById('sendWhatsappReport');
  if(sendReportBtn)sendReportBtn.onclick=()=>openWhatsAppStudentReport(id,attempts);
  const pdfBtn=document.getElementById('makePdfReport');
  if(pdfBtn)pdfBtn.onclick=()=>studentPdfAttachmentManager(id,attempts);
}
function selectParagraph(sid,cid){const c=getChapter(cid);if(!c?.paragraphs.length)return alert('No paragraphs');root.innerHTML=`<header><b>${esc(c.name)} — Paragraph Test</b><button onclick="studentTests(${sid})">Back</button></header><main><section class="card"><h2>किस paragraph का test देना है?</h2><p class="muted">कोई भी paragraph चुनें। किसी क्रम की बाध्यता नहीं है।</p>${c.paragraphs.map((p,i)=>`<div class="testrow"><b>Paragraph ${i+1}</b><span>${tokenize(p.text).length} words</span><button onclick="startSelectedParagraphTest(${sid},${cid},${p.id},${i})">Start Test</button></div>`).join('')}</section></main>`}
function startSelectedParagraphTest(sid,cid,pid,index){const c=getChapter(cid);const p=c?.paragraphs.find(x=>x.id===pid);if(!p)return alert('Paragraph not found');const open=()=>speakTest({studentId:sid,chapterId:cid,type:'paragraph',itemId:p.id,reference:p.text,title:`${c.name} — Paragraph ${index+1} of ${c.paragraphs.length}`,onDone:()=>studentTests(sid),onCancel:()=>open()});open()}

function getChapter(id){return state.content.flatMap(s=>s.books.flatMap(b=>b.chapters)).find(c=>c.id===id)}
function tokenize(s){return (s||'').normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu)||[]}
function renderWords(reference,matched){const set=new Set(matched||[]);let i=0;return tokenize(reference).map(w=>{const cls=set.has(i)?'word correct':'word';const html=`<span class="${cls}">${esc(w)}</span>`;i++;return html}).join(' ')}
function speakTest({studentId,chapterId,type,itemId,reference,title,onDone,onCancel}){if(recognition){try{recognition.stop()}catch{}};const total=tokenize(reference).length;root.innerHTML=`<header><b>${esc(title)}</b><button id="exit">Exit</button></header><main><section class="card test"><div class="progress"><b>Test</b><span>${total} words</span></div><p>Start Test दबाने के बाद original text छिप जाएगा। उसके बाद microphone में paragraph/answer बोलें।</p><button id="start">Start Test</button><div id="live"></div><div id="score"></div></section></main>`;exit.onclick=()=>{if(recognition){try{recognition.stop()}catch{}};refresh()};start.onclick=()=>{start.style.display='none';beginRecognition({studentId,chapterId,type,itemId,reference,title,onDone})}}
function beginRecognition({studentId,chapterId,type,itemId,reference,title,onDone}){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    live.innerHTML='<p>इस browser में Speech Recognition उपलब्ध नहीं है। Chrome Android इस्तेमाल करें।</p>';
    return;
  }

  live.innerHTML=`<div class="mic-panel">
    <div class="mic-status"><span id="micDot" class="mic-dot"></span><b id="status">Microphone तैयार हो रहा है…</b></div>
    <div class="test-actions"><button id="stopTest" type="button">⏹ Finish & Score</button><button id="cancelTest" type="button">✖ Cancel Test — No Score</button></div>
  </div>
  <div class="live-box"><div class="live-label">Live Speech — बोलते ही शब्द यहाँ दिखाई देंगे</div><div id="spokenLive" class="spoken-live">बोलना शुरू करें…</div></div>`;

  const statusEl=document.getElementById('status');
  const spokenEl=document.getElementById('spokenLive');
  const stopBtn=document.getElementById('stopTest');
  const cancelBtn=document.getElementById('cancelTest');
  const dot=document.getElementById('micDot');
  const referenceWords=tokenize(reference);
  const hasHindi=referenceWords.some(w=>/[\u0900-\u097F]/u.test(w));
  const hasEnglish=referenceWords.some(w=>/[A-Za-z]/u.test(w));

  let finalParts=[];
  let interimText='';
  let lastFinalText='';
  let stopping=false;
  let finished=false;
  let restartTimer=null;
  let submitTimer=null;
  let restartDelay=20;
  let activeRec=null;
  let startInProgress=false;
  let sessionNumber=0;

  const normWord=w=>(w||'').toLocaleLowerCase().replace(/[“”‘’'".,!?;:()[\]{}]/g,'');
  const words=s=>tokenize(s).map(normWord);
  const devMap={'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au','क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny','ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n','प':'p','फ':'f','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h','ड़':'r','ढ़':'rh','़':'','ँ':'n','ं':'n','ः':'h','्':''};
  const devV={'ा':'aa','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'o'};
  const romanize=w=>{let out='';for(const ch of String(w||'').normalize('NFKC'))out+=devV[ch]||devMap[ch]||ch;return out.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'')};
  const phonetic=w=>romanize(w).replace(/ph/g,'f').replace(/bh/g,'b').replace(/dh/g,'d').replace(/th/g,'t').replace(/kh/g,'k').replace(/gh/g,'g').replace(/chh/g,'ch').replace(/ch/g,'c').replace(/sh/g,'s').replace(/aa|a+/g,'a').replace(/ee|i+/g,'i').replace(/oo|u+/g,'u').replace(/ai|ay/g,'e').replace(/au|aw/g,'o').replace(/([a-z])\1+/g,'$1');
  const sim=(x,y)=>{x=romanize(x);y=romanize(y);if(x===y)return 1;const px=phonetic(x),py=phonetic(y);if(px&&px===py)return .94;const A=[...x],B=[...y];if(!A.length||!B.length)return 0;let prev=Array(B.length+1).fill(0).map((_,j)=>j);for(let i=1;i<=A.length;i++){const cur=[i];for(let j=1;j<=B.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(A[i-1]===B[j-1]?0:1));prev=cur;}const score=1-prev[B.length]/Math.max(A.length,B.length);return score>=.84&&Math.min(A.length,B.length)>=3?score:0};
  const overlapScore=(a,b)=>{
    const A=words(a),B=words(b); if(!A.length||!B.length)return 0;
    let best=0; const max=Math.min(8,A.length,B.length);
    for(let n=max;n>=1;n--){if(A.slice(-n).join(' ')===B.slice(0,n).join(' ')){best=n;break}}
    return best;
  };
  const similarityToReference=(text)=>{
    const a=words(text); if(!a.length)return 0;
    const used=finalParts.join(' '); const pos=words(used).length;
    const target=referenceWords.slice(Math.max(0,pos-3),Math.min(referenceWords.length,pos+a.length+10));
    let hits=0;
    for(const w of a){let best=0;for(const t of target)best=Math.max(best,sim(w,t));if(best>=.84)hits+=best;}
    return hits*3-Math.max(0,a.length-hits)*.15;
  };

  const chooseBestAlternative=(result)=>{
    let best='',bestScore=-Infinity;
    const count=Math.min(result.length||1,5);
    for(let i=0;i<count;i++){
      const t=(result[i]?.transcript||'').trim();
      if(!t)continue;
      const score=similarityToReference(t)+(result[i]?.confidence||0)*0.25;
      if(score>bestScore){bestScore=score;best=t;}
    }
    return best;
  };

  const appendFinalChunk=(text)=>{
    const t=(text||'').trim(); if(!t)return;
    const prev=lastFinalText.trim();
    if(prev && (t===prev || prev.endsWith(t)))return;
    let add=t;
    if(prev){
      const overlap=overlapScore(prev,t);
      if(overlap) add=tokenize(t).slice(overlap).join(' ');
    }
    if(add)finalParts.push(add);
    lastFinalText=t;
  };

  const renderLive=()=>{
    const finalText=finalParts.join(' ').trim();
    spokenEl.innerHTML=(esc(finalText)+(interimText?` <span class="interim">${esc(interimText)}</span>`:''))||'बोलना शुरू करें…';
    spokenEl.scrollTop=spokenEl.scrollHeight;
  };

  const clearTimers=()=>{
    if(restartTimer){clearTimeout(restartTimer);restartTimer=null;}
    if(submitTimer){clearTimeout(submitTimer);submitTimer=null;}
  };

  const disposeRecognizer=(rec)=>{
    if(!rec)return;
    try{rec.onstart=null;rec.onspeechstart=null;rec.onspeechend=null;rec.onresult=null;rec.onerror=null;rec.onend=null;}catch{}
    try{rec.stop();}catch{}
    try{rec.abort();}catch{}
  };

  const cleanup=()=>{
    clearTimers();
    const rec=activeRec;
    activeRec=null;
    recognition=null;
    disposeRecognizer(rec);
    dot.classList.remove('active');
  };

  const cancelTest=()=>{
    if(finished)return;
    finished=true; stopping=true; clearTimers();
    stopBtn.disabled=true; cancelBtn.disabled=true; statusEl.textContent='Test cancel किया गया — कोई score save नहीं होगा।'; dot.classList.remove('active');
    const rec=activeRec; activeRec=null; recognition=null;
    if(rec){try{rec.stop();}catch{} try{rec.abort();}catch{}}
    cleanup();
    if(onCancel){
      score.innerHTML='<h3>Test Cancelled</h3><p>इस attempt का कोई score या history save नहीं हुआ।</p><button id="retrySame" type="button">↻ इसी Paragraph का Test फिर से दें</button> <button id="backAfterCancel" type="button">Back</button>';
      document.getElementById('retrySame').onclick=()=>onCancel();
      document.getElementById('backAfterCancel').onclick=()=>refresh();
    }else{
      setTimeout(()=>refresh(),150);
    }
  };

  const submitResult=async()=>{
    if(finished)return;
    finished=true; clearTimers();
    const spokenText=finalParts.join(' ').trim();
    cleanup(); stopBtn.disabled=true; statusEl.textContent='Checking…';
    if(!spokenText){
      statusEl.textContent='कोई speech detect नहीं हुई। फिर से Start Test दबाएँ।';
      stopBtn.disabled=false; finished=false; return;
    }
    try{
      const r=await api('/tests/score',{method:'POST',body:JSON.stringify({studentId,chapterId,testType:type,itemId,spokenText})});
      const sameAttempts=await api('/results/'+studentId).catch(()=>[]); const key=`${type}:${chapterId}:${itemId||0}`; const attemptNo=sameAttempts.filter(x=>`${x.test_type}:${x.chapter_id}:${x.item_id||0}`===key).length; score.innerHTML=`<h3>Score: ${r.percent}%</h3><p>${r.correct}/${r.total} words correct — <b>${r.passed?'PASS':'NOT PASS'}</b></p><div class="word-result">${renderWords(r.referenceText,r.matched)}</div><p class="muted">Underline/marked words सही match हुए हैं। WhatsApp message अपने-आप नहीं भेजा गया। Teacher Student page से जब चाहे report भेज सकता है।</p><button id="nextButton" type="button">${onDone?'Next':'Done'}</button>`;
      document.getElementById('nextButton').onclick=()=>onDone?onDone(r):refresh();
    }catch(e){
      statusEl.textContent=e.message||'Test score नहीं हो सका।'; stopBtn.disabled=false; finished=false;
    }
  };

  const scheduleRestart=()=>{
    if(stopping||finished||restartTimer||startInProgress)return;
    const delay=restartDelay;
    restartTimer=setTimeout(()=>{restartTimer=null;if(!stopping&&!finished)startRecognizer();},delay);
  };

  const startRecognizer=()=>{
    if(stopping||finished||startInProgress)return;
    startInProgress=true; sessionNumber++;
    const rec=new SR(); activeRec=rec; recognition=rec;
    // Chrome Android can behave as short recognition sessions even when
    // continuous=true. We therefore restart immediately on end and keep the
    // transcript ourselves instead of depending on continuous mode.
    rec.continuous=true;
    rec.interimResults=true;
    rec.maxAlternatives=5;
    rec.lang=hasHindi?'hi-IN':'en-IN';

    rec.onstart=()=>{
      startInProgress=false; restartDelay=20;
      statusEl.textContent='Listening… बोलते रहें।'; dot.classList.add('active'); stopBtn.disabled=false;
    };
    rec.onspeechstart=()=>{statusEl.textContent='आपकी आवाज़ सुनाई दे रही है…';dot.classList.add('active');};
    rec.onspeechend=()=>{if(!stopping)statusEl.textContent='Listening जारी है…';};

    rec.onresult=e=>{
      let interim='';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const result=e.results[i];
        const t=chooseBestAlternative(result);
        if(!t)continue;
        if(result.isFinal) appendFinalChunk(t);
        else interim+=(interim?' ':'')+t;
      }
      interimText=interim; renderLive();
      if(finalParts.length&&!stopping)statusEl.textContent='Listening…';
    };

    rec.onerror=e=>{
      if(finished||stopping)return;
      if(e.error==='aborted')return;
      if(e.error==='no-speech'){
        statusEl.textContent='फिर से सुन रहा है… बोलते रहें।';
        restartDelay=10;
        scheduleRestart();
        return;
      }
      if(e.error==='network'){
        restartDelay=Math.min(250,Math.max(20,restartDelay*2));
        statusEl.textContent='Speech service फिर से connect हो रही है…'; scheduleRestart(); return;
      }
      if(e.error==='not-allowed'||e.error==='service-not-allowed'){
        statusEl.textContent='Microphone permission बंद है। Chrome में microphone permission Allow करें।';
        stopping=true; stopBtn.disabled=true; return;
      }
      statusEl.textContent='Speech फिर से शुरू हो रही है…'; restartDelay=20; scheduleRestart();
    };

    rec.onend=()=>{
      if(activeRec!==rec)return;
      dot.classList.remove('active');
      if(finished)return;
      if(stopping){activeRec=null;recognition=null;submitTimer=setTimeout(submitResult,300);return;}
      activeRec=null; recognition=null; startInProgress=false;
      interimText=''; renderLive();
      statusEl.textContent='Listening फिर से शुरू हो रहा है…';
      restartDelay=20; scheduleRestart();
    };

    try{rec.start();}
    catch(e){
      startInProgress=false;
      if(activeRec===rec){activeRec=null;recognition=null;}
      if(!stopping&&!finished){restartDelay=Math.min(100,Math.max(20,restartDelay+10));scheduleRestart();}
    }
  };

  cancelBtn.onclick=cancelTest;

  stopBtn.onclick=()=>{
    if(finished||stopping)return;
    stopping=true; clearTimers(); stopBtn.disabled=true; statusEl.textContent='Test रोक रहे हैं…'; dot.classList.remove('active');
    const rec=activeRec; activeRec=null; recognition=null;
    if(rec){try{rec.stop();}catch{} try{rec.abort();}catch{}}
    submitTimer=setTimeout(submitResult,350);
  };

  startRecognizer();
}

function startParagraphTest(sid,cid){selectParagraph(sid,cid)}
function showChapterReady(sid,cid){const c=getChapter(cid);root.innerHTML=`<header><b>${esc(c.name)}</b><button onclick="refresh()">Exit</button></header><main><section class="card"><h2>All Paragraphs Completed</h2><p>अब पूरा chapter test दिया जा सकता है।</p><button onclick="startChapterTest(${sid},${cid})">Start Complete Chapter Test</button></section></main>`}
function startQaTest(sid,cid){const c=getChapter(cid);if(!c?.qa.length)return alert('No Q&A');let index=0;const run=()=>{const q=c.qa[index];speakTest({studentId:sid,chapterId:cid,type:'qa',itemId:q.id,reference:q.answer,title:`Q&A ${index+1} of ${c.qa.length} — ${q.question}`,onDone:()=>{index++;if(index<c.qa.length)run();else refresh()}})};run()}
function startChapterTest(sid,cid){const c=getChapter(cid);const reference=c.paragraphs.map(p=>p.text).join(' ');if(!reference)return alert('No paragraph content');speakTest({studentId:sid,chapterId:cid,type:'chapter',reference,title:c.name+' — Complete Chapter Test'})}
async function editChapterName(id){const c=getChapter(id);if(!c)return;const name=prompt('Edit Chapter name',c.name);if(name===null||!name.trim())return;try{await api('/chapters/'+id,{method:'PUT',body:JSON.stringify({name:name.trim()})});await refresh()}catch(e){alert(e.message)}}
function getCorrectWords(reference,matched){const ws=tokenize(reference);return (matched||[]).map(i=>ws[i]).filter(Boolean)}
function openWhatsAppStudentReport(studentId,attempts){
  const st=state.students.find(x=>x.id===studentId);if(!st?.phone)return alert('पहले student का WhatsApp number save करें।');
  const chapters=state.content.flatMap(sub=>sub.books.flatMap(book=>book.chapters.map(c=>({...c,subjectName:sub.name,bookName:book.name}))));const byChapter=new Map(chapters.map(c=>[c.id,c]));
  const pa=attempts.filter(r=>r.test_type==='paragraph'&&r.item_id);const lines=['Tuition Student Report',`Student: ${st.name}`,`Class: ${st.class_name||''}`,''];
  if(!pa.length)lines.push('इस student ने अभी किसी paragraph का completed test नहीं दिया है।');
  const groups=new Map();pa.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(r=>{const k=`${r.chapter_id}:${r.item_id}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
  for(const arr of groups.values()){const r=arr[0],c=byChapter.get(r.chapter_id),p=c?.paragraphs?.find(x=>x.id===r.item_id);if(!p)continue;lines.push(`=== ${c?.subjectName||'Subject'} → ${c?.bookName||'Book'} → ${c?.name||'Chapter'} → Paragraph ${r.paragraph_position||''} ===`);lines.push((arr[0].reference_text||p.text||''));arr.forEach((a,i)=>{const correct=getCorrectWords(a.reference_text||p.text,a.matched_word_indexes||a.matched||[]);lines.push(`Attempt ${i+1}: ${Number(a.score_percent).toFixed(2)}% | ${a.correct_words}/${a.total_words} | ${a.passed?'PASS':'NOT PASS'}`);lines.push(`Correct words: ${correct.join(' ')||'(none)'}`)});lines.push('');}
  const full=lines.join('\n');const parts=[];const max=5000;for(let i=0;i<full.length;i+=max)parts.push(full.slice(i,i+max));if(parts.length>1&&!confirm(`Report ${parts.length} WhatsApp messages में खुलेगा। हर message को WhatsApp में Send करना होगा। आगे बढ़ें?`))return;openWhatsAppPart(st.phone,parts,0);
}
function getStudentParagraphPdfGroups(attempts){
  const chapters=state.content.flatMap(sub=>sub.books.flatMap(book=>book.chapters.map(c=>({...c,subjectName:sub.name,bookName:book.name}))));
  const byChapter=new Map(chapters.map(c=>[c.id,c]));
  const pa=attempts.filter(r=>r.test_type==='paragraph'&&r.item_id);
  const groups=new Map();
  pa.slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).forEach(r=>{const k=`${r.chapter_id}:${r.item_id}`;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r)});
  return [...groups.values()].map(arr=>{const r=arr[0],c=byChapter.get(r.chapter_id),p=c?.paragraphs?.find(x=>x.id===r.item_id);return p?{key:`${r.chapter_id}:${r.item_id}`,arr,c,p}:null}).filter(Boolean);
}
function studentPdfAttachmentManager(studentId,attempts){
  const st=state.students.find(x=>x.id===studentId);if(!st)return;
  const groups=getStudentParagraphPdfGroups(attempts);
  if(!groups.length)return alert('इस student ने अभी किसी paragraph का completed test नहीं दिया है। पहले कम-से-कम एक paragraph test पूरा करें।');
  root.innerHTML=`<header><b>PDF Attachments — ${esc(st.name)}</b><button onclick="studentTests(${studentId})">Back</button></header><main><section class="card"><h2>PDF Attachments चुनें</h2><p class="muted">हर tested paragraph की अलग PDF attachment बनेगी। जितनी चाहें select करें, या सभी select करके एक साथ Share करें। PDF में उस paragraph का original text और उसके सभी saved attempts होंगे।</p><div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0"><button id="selectAllPdf" type="button">Select All</button><button id="clearAllPdf" type="button">Clear All</button><button id="sendSelectedPdf" type="button">📎 Selected PDF भेजें</button><button id="sendAllPdf" type="button">📚 सभी PDF भेजें</button></div><div id="pdfAttachmentList">${groups.map((g,i)=>`<label class="student-row" style="display:flex;align-items:center;gap:10px;cursor:pointer"><input class="pdf-select" type="checkbox" value="${esc(g.key)}"><div><b>${i+1}. ${esc(g.subjectName||'Subject')} → ${esc(g.bookName||'Book')} → ${esc(g.c.name||'Chapter')} → Paragraph ${esc(g.arr[0].paragraph_position||'')}</b><br><small>${g.arr.length} saved attempt${g.arr.length===1?'':'s'}</small></div></label>`).join('')}</div></section></main>`;
  const boxes=()=>[...document.querySelectorAll('.pdf-select')];
  document.getElementById('selectAllPdf').onclick=()=>boxes().forEach(x=>x.checked=true);
  document.getElementById('clearAllPdf').onclick=()=>boxes().forEach(x=>x.checked=false);
  document.getElementById('sendSelectedPdf').onclick=()=>shareStudentPdfAttachments(studentId,attempts,boxes().filter(x=>x.checked).map(x=>x.value));
  document.getElementById('sendAllPdf').onclick=()=>shareStudentPdfAttachments(studentId,attempts,groups.map(g=>g.key));
}
async function createStudentParagraphPdfFile(st,group){
  const {arr,c,p}=group;
  const safeBase=String(st.name||'Student').replace(/[^a-z0-9_-]+/gi,'_')||'Student';
  const pos=String(arr[0].paragraph_position||'').replace(/[^a-z0-9_-]+/gi,'_')||String(arr[0].item_id);
  const filename=`${safeBase}-Paragraph-${pos}-Test-Report.pdf`;
  const wrap=document.createElement('div');wrap.id='pdfReportTemp';wrap.innerHTML=`<div class="pdf-report"><h1>Tuition Student Test Report</h1><p><b>Student:</b> ${esc(st.name)}<br><b>Class:</b> ${esc(st.class_name||'')}</p><section class="pdf-section"><h2>${esc(c?.subjectName||'Subject')} → ${esc(c?.bookName||'Book')} → ${esc(c?.name||'Chapter')} → Paragraph ${esc(arr[0].paragraph_position||'')}</h2><h3>Original Paragraph</h3><p class="pdf-original">${esc(arr[0].reference_text||p.text||'')}</p><h3>Test Attempts</h3>${arr.map((a,i)=>{const ref=a.reference_text||p.text||'';return `<div class="pdf-attempt"><h4>Attempt ${i+1}</h4><p><b>Score:</b> ${Number(a.score_percent).toFixed(2)}% &nbsp; <b>Words:</b> ${a.correct_words}/${a.total_words} &nbsp; <b>Result:</b> ${a.passed?'PASS':'NOT PASS'}</p><div class="pdf-words">${renderWords(ref,a.matched_word_indexes||a.matched||[])}</div></div>`}).join('')}</section></div>`;
  Object.assign(wrap.style,{position:'absolute',left:'0px',top:'0px',width:'794px',background:'#fff',color:'#111',zIndex:'2147483647',pointerEvents:'none'});document.body.appendChild(wrap);
  try{
    if(document.fonts&&document.fonts.ready)await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    const opt={margin:12,filename,image:{type:'jpeg',quality:.96},html2canvas:{scale:2,useCORS:true,backgroundColor:'#ffffff',logging:false,windowWidth:794},jsPDF:{unit:'mm',format:'a4',orientation:'portrait'},pagebreak:{mode:['css','legacy']}};
    const blob=await html2pdf().set(opt).from(wrap.querySelector('.pdf-report')).outputPdf('blob');
    return new File([blob],filename,{type:'application/pdf'});
  }finally{wrap.remove()}
}
async function shareStudentPdfAttachments(studentId,attempts,keys){
  const st=state.students.find(x=>x.id===studentId);if(!st)return;
  if(typeof html2pdf==='undefined')return alert('PDF module अभी load नहीं हुआ। Internet चालू करके page दोबारा खोलें।');
  const allGroups=getStudentParagraphPdfGroups(attempts);const wanted=new Set(keys);const groups=allGroups.filter(g=>wanted.has(g.key));
  if(!groups.length)return alert('कम-से-कम एक PDF attachment select करें।');
  if(!confirm(`${groups.length} PDF attachment तैयार करके Share करना है?`))return;
  try{
    const files=[];for(const g of groups)files.push(await createStudentParagraphPdfFile(st,g));
    if(navigator.share&&navigator.canShare&&navigator.canShare({files})){await navigator.share({files,title:'Student Test PDF Reports',text:`${st.name} की ${files.length} test PDF report attachment${files.length===1?'':'s'}`});}
    else{
      for(const file of files){const url=URL.createObjectURL(file);const a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);await new Promise(r=>setTimeout(r,300));}
      alert(`${files.length} PDF तैयार हो गई हैं और download शुरू हो गया है। इन्हें WhatsApp में एक साथ attach करके भेजें।`);
    }
  }catch(e){if(e?.name!=='AbortError')alert('PDF बनाने/Share करने में समस्या हुई: '+e.message)}
}
function openWhatsAppPart(phone,parts,index){
  const msg=parts[index];
  const suffix=parts.length>1?`\n\nPart ${index+1}/${parts.length}`:'';
  const url='https://wa.me/'+String(phone).replace(/\D/g,'')+'?text='+encodeURIComponent(msg+suffix);
  const w=window.open(url,'_blank');if(!w)location.href=url;
  if(index<parts.length-1){
    setTimeout(()=>{if(confirm(`Part ${index+1}/${parts.length} WhatsApp में तैयार है। अगला part खोलें?`))openWhatsAppPart(phone,parts,index+1)},1200);
  }
}
function showAttemptResult(id){const r=(window.__attempts||[]).find(x=>x.id===id);if(!r)return;const reference=r.reference_text||r.paragraph_text||'';const label=r.test_type==='paragraph'?`Paragraph ${r.paragraph_position||''}`:r.test_type==='qa'?'Q&A':'Complete Chapter';root.innerHTML=`<header><b>Attempt ${r.attempt_no} — ${esc(label)}</b><button onclick="studentTests(${r.student_id})">Back</button></header><main><section class="card"><h2>${Number(r.score_percent).toFixed(2)}% — ${r.passed?'PASS':'NOT PASS'}</h2><p>${r.correct_words}/${r.total_words} words correct</p>${r.question?`<div class="attempt-question"><b>Question:</b><p>${esc(r.question)}</p></div>`:''}<div class="word-result">${renderWords(reference,r.matched_word_indexes)}</div><p class="muted">यह उसी attempt का original paragraph/answer है। Underline किए गए शब्द वही हैं जो उस attempt में सही बोले गए थे।</p></section></main>`}
function editChapter(cid){const c=getChapter(cid);root.innerHTML=`<header><b>${esc(c.name)}</b><button onclick="refresh()">Back</button></header><main><section class="card"><h2>Edit Chapter</h2><button onclick="editChapterName(${cid})">Edit Chapter Name</button></section><section class="card"><h2>Paragraphs</h2><p class="muted">Text edit करें। Next paragraph से merge करने का option भी है।</p>${c.paragraphs.map((p,i)=>`<div class="para"><textarea id="p${p.id}">${esc(p.text)}</textarea><div><button onclick="savePara(${p.id})">Save</button>${i<c.paragraphs.length-1?`<button onclick="mergePara(${p.id},${c.paragraphs[i+1].id})">Merge with next</button>`:''}</div></div>`).join('')}<button onclick="addPara(${cid})">+ Add Paragraph</button></section><section class="card"><h2>Add Q&A</h2><input id="q" placeholder="Question"><textarea id="a" placeholder="Correct answer"></textarea><button onclick="addQA(${cid})">Add Q&A</button></section>${c.qa.length?`<section class="card"><h2>Existing Q&A</h2>${c.qa.map(x=>`<div class="qa"><b>${esc(x.question)}</b><p>${esc(x.answer)}</p></div>`).join('')}</section>`:''}</main>`}
async function savePara(id){try{await api('/paragraphs/'+id,{method:'PUT',body:JSON.stringify({text:document.getElementById('p'+id).value})});await refresh()}catch(e){alert(e.message)}}
async function mergePara(firstId,secondId){if(!confirm('इन दोनों paragraphs को एक में merge करें?'))return;try{await api('/paragraphs/merge',{method:'POST',body:JSON.stringify({firstId,secondId})});await refresh()}catch(e){alert(e.message)}}
async function addPara(cid){const text=prompt('New paragraph text');if(!text)return;try{await api('/chapters/'+cid+'/paragraphs',{method:'POST',body:JSON.stringify({text})});await refresh()}catch(e){alert(e.message)}}
async function addQA(cid){if(!q.value||!a.value)return alert('Question और answer दोनों भरें');try{await api('/chapters/'+cid+'/qa',{method:'POST',body:JSON.stringify({question:q.value,answer:a.value})});await refresh()}catch(e){alert(e.message)}}
async function boot(){if(new URLSearchParams(location.search).get('reset')){localStorage.removeItem('token');token=null;authView();return}try{if(decodeJwtRole()==='admin'){await adminDashboard();return}await load();dashboard()}catch(e){localStorage.clear();sessionStorage.removeItem('adminTeacherToken');token=null;authView()}}
boot();
