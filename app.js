const root=document.getElementById('app');
let token=localStorage.getItem('token');
let state={teacher:null,students:[],content:[],results:[]};
let recognition=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
async function api(url,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};const r=await fetch('/api'+url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}
function authView(){
  const resetToken=new URLSearchParams(location.search).get('reset');
  if(resetToken){return resetPasswordView(resetToken)}
  root.innerHTML=`<main class="center"><section class="card auth-card"><h1>Tuition Teacher App</h1><p>Teacher Login</p><form id="login"><input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required><button>Login</button></form><button id="forgot" type="button">Forgot Password?</button><hr><p>Create new Teacher ID</p><form id="reg"><input name="name" placeholder="Teacher name" required><input name="email" type="email" placeholder="Email" required><input name="password" type="password" minlength="6" placeholder="Password (minimum 6 characters)" required><button>Create Account</button></form></section></main>`;
  login.onsubmit=async e=>{e.preventDefault();try{const d=await api('/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(login)))});token=d.token;localStorage.token=token;boot()}catch(x){alert(x.message)}};
  reg.onsubmit=async e=>{e.preventDefault();try{const d=await api('/auth/register',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(reg)))});token=d.token;localStorage.token=token;sessionStorage.teacherCreated=`Teacher ID created successfully!\nName: ${d.teacher.name}\nEmail/Teacher ID: ${d.teacher.email}`;boot()}catch(x){alert(x.message)}};
  forgot.onclick=forgotPasswordView;
}
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
  root.innerHTML=`<header><b>Tuition Teacher App</b><div><button id="changePassword" type="button">Change Password</button><button id="logout">Logout</button></div></header><main>${created?`<section class="success-banner"><b>${esc(created).replace(/\n/g,'<br>')}</b></section>`:''}<section class="grid"><div class="card"><h2>Students</h2><p>${state.students.length}/20</p><button id="addStudent">Add Student</button><div id="studentList">${state.students.map((s,i)=>`<div class="student-row"><button class="list" data-s="${s.id}">${i+1}. ${esc(s.name)} — Class ${esc(s.class_name)}</button><button class="delete-student" type="button" data-delete-student="${s.id}">Delete Student</button></div>`).join('')||'<p>No students yet.</p>'}</div></div><div class="card"><h2>Performance</h2>${state.results.map((r,i)=>`<div class="result"><b>#${i+1} ${esc(r.name)}</b><span>${r.score}% · ${r.tests} tests</span></div>`).join('')||'<p>No test results yet.</p>'}</div></section><section class="card"><h2>Content</h2><button id="addSubject">Create Subject</button><div id="content">${renderContent()}</div></section></main>`;
  logout.onclick=()=>{localStorage.clear();location.reload()};
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
async function addStudentForm(){const name=prompt('Student name');if(!name)return;const className=prompt('Class');if(!className)return;try{await api('/students',{method:'POST',body:JSON.stringify({name,className})});await refresh()}catch(e){alert(e.message)}}
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
async function studentTests(id){const s=state.students.find(x=>x.id===id);const chapters=state.content.flatMap(x=>x.books.flatMap(b=>b.chapters));let attempts=[];try{attempts=await api('/results/'+id)}catch(e){console.error(e)}const groups={};attempts.forEach(r=>{const key=`${r.test_type}:${r.chapter_id}:${r.item_id||0}`;(groups[key]??=[]).push(r)});attempts.forEach(r=>{const key=`${r.test_type}:${r.chapter_id}:${r.item_id||0}`;const arr=groups[key].slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));r.attempt_no=arr.findIndex(x=>x.id===r.id)+1});const historyHtml=attempts.length?attempts.map(r=>`<div class="attempt-row"><div><b>Attempt ${r.attempt_no}</b> — ${esc(r.test_type==='paragraph'?'Paragraph':r.test_type==='qa'?'Q&A':'Complete Chapter')}</div><span>${Number(r.score_percent).toFixed(2)}%</span><button onclick="showAttemptResult(${r.id})">Open Attempt</button></div>`).join(''):'<p class="muted">अभी कोई attempt नहीं है। Test देने के बाद यहाँ history दिखाई देगी।</p>';window.__attempts=attempts;root.innerHTML=`<header><b>${esc(s.name)} — Class ${esc(s.class_name)}</b><button onclick="refresh()">Back</button></header><main><section class="card"><h2>Select Test</h2>${chapters.map(c=>`<div class="testrow"><b>${esc(c.name)}</b><span>${c.paragraphs.length} paragraphs · ${c.qa.length} Q&A</span><button onclick="startParagraphTest(${id},${c.id})">Paragraph Test</button><button onclick="startQaTest(${id},${c.id})" ${c.qa.length?'':'disabled'}>Q&A Test</button><button onclick="startChapterTest(${id},${c.id})" ${c.paragraphs.length?'':'disabled'}>Complete Chapter</button></div>`).join('')||'<p>No chapters yet.</p>'}</section><section class="card"><h2>Attempt History</h2>${historyHtml}</section></main>`}
function getChapter(id){return state.content.flatMap(s=>s.books.flatMap(b=>b.chapters)).find(c=>c.id===id)}
function tokenize(s){return (s||'').normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu)||[]}
function renderWords(reference,matched){const set=new Set(matched||[]);let i=0;return tokenize(reference).map(w=>{const cls=set.has(i)?'word correct':'word';const html=`<span class="${cls}">${esc(w)}</span>`;i++;return html}).join(' ')}
function speakTest({studentId,chapterId,type,itemId,reference,title,onDone}){if(recognition){try{recognition.stop()}catch{}};const total=tokenize(reference).length;root.innerHTML=`<header><b>${esc(title)}</b><button id="exit">Exit</button></header><main><section class="card test"><div class="progress"><b>Test</b><span>${total} words</span></div><p>Start Test दबाने के बाद original text छिप जाएगा। उसके बाद microphone में paragraph/answer बोलें।</p><button id="start">Start Test</button><div id="live"></div><div id="score"></div></section></main>`;exit.onclick=()=>{if(recognition){try{recognition.stop()}catch{}};refresh()};start.onclick=()=>{start.style.display='none';beginRecognition({studentId,chapterId,type,itemId,reference,title,onDone})}}
function beginRecognition({studentId,chapterId,type,itemId,reference,title,onDone}){
  const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!SR){
    live.innerHTML='<p>इस browser में Speech Recognition उपलब्ध नहीं है। Chrome Android इस्तेमाल करें।</p>';
    return;
  }

  live.innerHTML=`<div class="mic-panel">
    <div class="mic-status"><span id="micDot" class="mic-dot"></span><b id="status">Microphone तैयार हो रहा है…</b></div>
    <button id="stopTest" type="button">⏹ Stop Test</button>
  </div>
  <div class="live-box"><div class="live-label">Live Speech</div><div id="spokenLive" class="spoken-live">बोलना शुरू करें…</div></div>`;

  const statusEl=document.getElementById('status');
  const spokenEl=document.getElementById('spokenLive');
  const stopBtn=document.getElementById('stopTest');
  const dot=document.getElementById('micDot');

  let finalParts=[];
  let interimText='';
  let lastFinalText='';
  let stopping=false;
  let finished=false;
  let restartTimer=null;
  let submitTimer=null;
  let activeRec=null;
  let startInProgress=false;

  const appendFinalChunk=(text)=>{
    const t=(text||'').trim();
    if(!t)return;
    const prev=lastFinalText.trim();
    if(prev && (t===prev || prev.endsWith(t)))return;
    let add=t;
    if(prev){
      const a=prev.toLocaleLowerCase().split(/\s+/);
      const b=t.toLocaleLowerCase().split(/\s+/);
      const max=Math.min(a.length,b.length);
      let overlap=0;
      for(let n=max;n>0;n--){
        if(a.slice(-n).join(' ')===b.slice(0,n).join(' ')){overlap=n;break;}
      }
      if(overlap)add=t.split(/\s+/).slice(overlap).join(' ');
    }
    if(add)finalParts.push(add);
    lastFinalText=t;
  };

  const renderLive=()=>{
    const finalText=finalParts.join(' ').trim();
    spokenEl.innerHTML=(esc(finalText)+(interimText?` <span class="interim">${esc(interimText)}</span>`:''))||'बोलना शुरू करें…';
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
    if(recognition===rec||recognition)recognition=null;
    disposeRecognizer(rec);
    dot.classList.remove('active');
  };

  const submitResult=async()=>{
    if(finished)return;
    finished=true;
    clearTimers();
    const spokenText=finalParts.join(' ').trim();
    cleanup();
    stopBtn.disabled=true;
    statusEl.textContent='Checking…';

    if(!spokenText){
      statusEl.textContent='कोई speech detect नहीं हुई। फिर से Start Test दबाएँ।';
      stopBtn.disabled=false;
      finished=false;
      return;
    }

    try{
      const r=await api('/tests/score',{method:'POST',body:JSON.stringify({studentId,chapterId,testType:type,itemId,spokenText})});
      score.innerHTML=`<h3>Score: ${r.percent}%</h3><p>${r.correct}/${r.total} words correct — <b>${r.passed?'PASS':'NOT PASS'}</b></p><div class="word-result">${renderWords(r.referenceText,r.matched)}</div><p class="muted">Underline/marked words सही match हुए हैं।</p><button id="nextButton" type="button">${onDone?'Next':'Done'}</button>`;
      document.getElementById('nextButton').onclick=()=>onDone?onDone(r):refresh();
    }catch(e){
      statusEl.textContent=e.message||'Test score नहीं हो सका।';
      stopBtn.disabled=false;
      finished=false;
    }
  };

  const scheduleRestart=()=>{
    if(stopping||finished||restartTimer)return;
    restartTimer=setTimeout(()=>{
      restartTimer=null;
      if(stopping||finished)return;
      startRecognizer();
    },350);
  };

  const startRecognizer=()=>{
    if(stopping||finished||startInProgress)return;
    startInProgress=true;
    const rec=new SR();
    activeRec=rec;
    recognition=rec;
    rec.continuous=true;
    rec.interimResults=true;
    rec.maxAlternatives=1;
    rec.lang=/[\u0900-\u097F]/.test(reference)?'hi-IN':'en-IN';

    rec.onstart=()=>{
      startInProgress=false;
      statusEl.textContent='Listening… बोलते रहें।';
      dot.classList.add('active');
      stopBtn.disabled=false;
    };

    rec.onspeechstart=()=>{
      statusEl.textContent='आपकी आवाज़ सुनाई दे रही है…';
      dot.classList.add('active');
    };

    rec.onspeechend=()=>{
      if(!stopping)statusEl.textContent='Listening जारी है…';
    };

    rec.onresult=e=>{
      let interim='';
      for(let i=e.resultIndex;i<e.results.length;i++){
        const t=(e.results[i][0]?.transcript||'').trim();
        if(!t)continue;
        if(e.results[i].isFinal)appendFinalChunk(t);
        else interim+=(interim?' ':'')+t;
      }
      interimText=interim;
      renderLive();
      if(finalParts.length&&!stopping)statusEl.textContent='Listening…';
    };

    rec.onerror=e=>{
      if(finished||stopping)return;
      if(e.error==='aborted')return;
      if(e.error==='no-speech'){
        statusEl.textContent='कुछ देर चुप रहे हैं — microphone फिर से सुनना शुरू करेगा…';
        return;
      }
      if(e.error==='network'){
        statusEl.textContent='Speech service reconnect हो रही है…';
        return;
      }
      if(e.error==='not-allowed'||e.error==='service-not-allowed'){
        statusEl.textContent='Microphone permission बंद है। Chrome में microphone permission Allow करें।';
        stopping=true;
        stopBtn.disabled=true;
        return;
      }
      statusEl.textContent='Speech error: '+e.error+' — फिर से listening शुरू होगी।';
    };

    rec.onend=()=>{
      if(activeRec!==rec)return;
      dot.classList.remove('active');
      if(finished)return;
      if(stopping){
        activeRec=null;
        recognition=null;
        submitTimer=setTimeout(submitResult,350);
        return;
      }
      activeRec=null;
      recognition=null;
      startInProgress=false;
      statusEl.textContent='Listening फिर से शुरू हो रहा है…';
      scheduleRestart();
    };

    try{
      rec.start();
    }catch(e){
      startInProgress=false;
      if(activeRec===rec){activeRec=null;recognition=null;}
      if(!stopping&&!finished){
        statusEl.textContent='Microphone फिर से शुरू हो रहा है…';
        scheduleRestart();
      }
    }
  };

  stopBtn.onclick=()=>{
    if(finished||stopping)return;
    stopping=true;
    clearTimers();
    stopBtn.disabled=true;
    statusEl.textContent='Test रोक रहे हैं…';
    dot.classList.remove('active');
    const rec=activeRec;
    activeRec=null;
    recognition=null;
    if(rec){
      try{rec.stop();}catch{}
      try{rec.abort();}catch{}
    }
    submitTimer=setTimeout(submitResult,450);
  };

  startRecognizer();
}
function startParagraphTest(sid,cid){const c=getChapter(cid);if(!c?.paragraphs.length)return alert('No paragraphs');let index=0;const run=()=>{const p=c.paragraphs[index];speakTest({studentId:sid,chapterId:cid,type:'paragraph',itemId:p.id,reference:p.text,title:`${c.name} — Paragraph ${index+1} of ${c.paragraphs.length}`,onDone:()=>{index++;if(index<c.paragraphs.length)run();else showChapterReady(sid,cid)}})};run()}
function showChapterReady(sid,cid){const c=getChapter(cid);root.innerHTML=`<header><b>${esc(c.name)}</b><button onclick="refresh()">Exit</button></header><main><section class="card"><h2>All Paragraphs Completed</h2><p>अब पूरा chapter test दिया जा सकता है।</p><button onclick="startChapterTest(${sid},${cid})">Start Complete Chapter Test</button></section></main>`}
function startQaTest(sid,cid){const c=getChapter(cid);if(!c?.qa.length)return alert('No Q&A');let index=0;const run=()=>{const q=c.qa[index];speakTest({studentId:sid,chapterId:cid,type:'qa',itemId:q.id,reference:q.answer,title:`Q&A ${index+1} of ${c.qa.length} — ${q.question}`,onDone:()=>{index++;if(index<c.qa.length)run();else refresh()}})};run()}
function startChapterTest(sid,cid){const c=getChapter(cid);const reference=c.paragraphs.map(p=>p.text).join(' ');if(!reference)return alert('No paragraph content');speakTest({studentId:sid,chapterId:cid,type:'chapter',reference,title:c.name+' — Complete Chapter Test'})}
async function editChapterName(id){const c=getChapter(id);if(!c)return;const name=prompt('Edit Chapter name',c.name);if(name===null||!name.trim())return;try{await api('/chapters/'+id,{method:'PUT',body:JSON.stringify({name:name.trim()})});await refresh()}catch(e){alert(e.message)}}
function showAttemptResult(id){const r=(window.__attempts||[]).find(x=>x.id===id);if(!r)return;const reference=r.reference_text||r.paragraph_text||'';const label=r.test_type==='paragraph'?`Paragraph ${r.paragraph_position||''}`:r.test_type==='qa'?'Q&A':'Complete Chapter';root.innerHTML=`<header><b>Attempt ${r.attempt_no} — ${esc(label)}</b><button onclick="studentTests(${r.student_id})">Back</button></header><main><section class="card"><h2>${Number(r.score_percent).toFixed(2)}% — ${r.passed?'PASS':'NOT PASS'}</h2><p>${r.correct_words}/${r.total_words} words correct</p>${r.question?`<div class="attempt-question"><b>Question:</b><p>${esc(r.question)}</p></div>`:''}<div class="word-result">${renderWords(reference,r.matched_word_indexes)}</div><p class="muted">यह उसी attempt का original paragraph/answer है। Underline किए गए शब्द वही हैं जो उस attempt में सही बोले गए थे।</p></section></main>`}
function editChapter(cid){const c=getChapter(cid);root.innerHTML=`<header><b>${esc(c.name)}</b><button onclick="refresh()">Back</button></header><main><section class="card"><h2>Edit Chapter</h2><button onclick="editChapterName(${cid})">Edit Chapter Name</button></section><section class="card"><h2>Paragraphs</h2><p class="muted">Text edit करें। Next paragraph से merge करने का option भी है।</p>${c.paragraphs.map((p,i)=>`<div class="para"><textarea id="p${p.id}">${esc(p.text)}</textarea><div><button onclick="savePara(${p.id})">Save</button>${i<c.paragraphs.length-1?`<button onclick="mergePara(${p.id},${c.paragraphs[i+1].id})">Merge with next</button>`:''}</div></div>`).join('')}<button onclick="addPara(${cid})">+ Add Paragraph</button></section><section class="card"><h2>Add Q&A</h2><input id="q" placeholder="Question"><textarea id="a" placeholder="Correct answer"></textarea><button onclick="addQA(${cid})">Add Q&A</button></section>${c.qa.length?`<section class="card"><h2>Existing Q&A</h2>${c.qa.map(x=>`<div class="qa"><b>${esc(x.question)}</b><p>${esc(x.answer)}</p></div>`).join('')}</section>`:''}</main>`}
async function savePara(id){try{await api('/paragraphs/'+id,{method:'PUT',body:JSON.stringify({text:document.getElementById('p'+id).value})});await refresh()}catch(e){alert(e.message)}}
async function mergePara(firstId,secondId){if(!confirm('इन दोनों paragraphs को एक में merge करें?'))return;try{await api('/paragraphs/merge',{method:'POST',body:JSON.stringify({firstId,secondId})});await refresh()}catch(e){alert(e.message)}}
async function addPara(cid){const text=prompt('New paragraph text');if(!text)return;try{await api('/chapters/'+cid+'/paragraphs',{method:'POST',body:JSON.stringify({text})});await refresh()}catch(e){alert(e.message)}}
async function addQA(cid){if(!q.value||!a.value)return alert('Question और answer दोनों भरें');try{await api('/chapters/'+cid+'/qa',{method:'POST',body:JSON.stringify({question:q.value,answer:a.value})});await refresh()}catch(e){alert(e.message)}}
async function boot(){if(new URLSearchParams(location.search).get('reset')){localStorage.removeItem('token');token=null;authView();return}try{await load();dashboard()}catch(e){localStorage.clear();token=null;authView()}}
boot();
