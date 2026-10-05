const express=require('express');const cors=require('cors');const path=require('path');const fs=require('fs');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');const {Pool}=require('pg');const crypto=require('crypto');require('dotenv').config();
const app=express();app.use(cors());app.use(express.json({limit:'2mb'}));app.use(express.static(__dirname));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
async function init(){const sql=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8');await pool.query(sql);await pool.query(`ALTER TABLE teachers ADD COLUMN IF NOT EXISTS reset_token_hash TEXT; ALTER TABLE teachers ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ; ALTER TABLE teachers ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT FALSE; ALTER TABLE teachers ADD COLUMN IF NOT EXISTS last_login_date DATE; ALTER TABLE teachers ADD COLUMN IF NOT EXISTS installed_at TIMESTAMPTZ; ALTER TABLE teachers ADD COLUMN IF NOT EXISTS last_app_open_at TIMESTAMPTZ; ALTER TABLE teachers ADD COLUMN IF NOT EXISTS last_app_open_mode TEXT; ALTER TABLE test_results ADD COLUMN IF NOT EXISTS reference_text TEXT; ALTER TABLE test_results ADD COLUMN IF NOT EXISTS matched_word_indexes JSONB DEFAULT '[]'::jsonb; ALTER TABLE test_results ADD COLUMN IF NOT EXISTS manual_word_indexes JSONB NOT NULL DEFAULT '[]'::jsonb; ALTER TABLE students ADD COLUMN IF NOT EXISTS phone TEXT`);await pool.query(`CREATE TABLE IF NOT EXISTS admin_account (id INTEGER PRIMARY KEY CHECK (id=1), email TEXT NOT NULL, password_hash TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);const email=normalizeEmail(process.env.ADMIN_EMAIL||ADMIN_EMAIL_FALLBACK);const initial=process.env.ADMIN_INITIAL_PASSWORD||'';const ar=await pool.query('SELECT id FROM admin_account WHERE id=1');if(!ar.rowCount && initial){const h=await bcrypt.hash(initial,12);await pool.query('INSERT INTO admin_account(id,email,password_hash) VALUES(1,$1,$2)',[email,h]);}}
const secret=process.env.JWT_SECRET||'dev-only-change-me';
function indiaDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function auth(req,res,next){try{const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';req.user=jwt.verify(token,secret);if(req.user.role!=='admin'&&req.user.role!=='admin_impersonate'&&req.user.loginDate!==indiaDate())return res.status(401).json({error:'Daily login required. Please login again today.'});next()}catch(e){res.status(401).json({error:'Unauthorized'})}}
function requireAdmin(req,res,next){if(req.user?.role!=='admin')return res.status(403).json({error:'Admin access required'});next()}
function teacherId(req){return Number(req.user?.id)}
const adminOtps=new Map();
function normalizeEmail(email){return String(email||'').trim().toLowerCase()}
const ADMIN_EMAIL_FALLBACK='Manishgupta021469@gmail.com';
function adminEmail(){return normalizeEmail(process.env.ADMIN_EMAIL||ADMIN_EMAIL_FALLBACK)}
function isAdminEmail(email){return normalizeEmail(email)===adminEmail()}
function createOtp(){return String(crypto.randomInt(100000,1000000))}
function gmailConfig(){
  const url=String(process.env.GMAIL_WEBHOOK_URL||'').trim();
  const secret=String(process.env.GMAIL_WEBHOOK_SECRET||'').trim();
  if(!url)throw new Error('Gmail HTTP email service is not configured. Set GMAIL_WEBHOOK_URL in Render.');
  if(!secret)throw new Error('Gmail HTTP email service is not configured. Set GMAIL_WEBHOOK_SECRET in Render.');
  return {url,secret};
}
async function sendGmail(to,subject,html){
  const {url,secret}=gmailConfig();
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),20000);
  try{
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,to,subject,html}),signal:controller.signal});
    const raw=await r.text();
    let data={};
    try{data=JSON.parse(raw||'{}')}catch{}
    if(!r.ok || data.ok!==true){
      throw new Error(data.error||`Gmail HTTP email service returned HTTP ${r.status}`);
    }
    return data;
  }catch(e){
    if(e.name==='AbortError')throw new Error('Gmail HTTP email service timed out after 20 seconds. Check the Apps Script Web App URL and deployment.');
    throw e;
  }finally{clearTimeout(timer)}
}
async function sendAdminMail(to,subject,html){
  return sendGmail(to,subject,html);
}
async function getAdmin(){const r=await pool.query('SELECT * FROM admin_account WHERE id=1');return r.rowCount?r.rows[0]:null}
app.post('/api/admin/login',async(req,res)=>{try{const email=normalizeEmail(req.body.email),password=String(req.body.password||'');if(!isAdminEmail(email))return res.status(401).json({error:'This email is not authorized for Admin Login'});const a=await getAdmin();if(!a)return res.status(503).json({error:'Admin password is not initialized. Set ADMIN_INITIAL_PASSWORD once in Render and redeploy.'});if(!(await bcrypt.compare(password,a.password_hash)))return res.status(401).json({error:'Incorrect Admin password'});res.json({token:jwt.sign({role:'admin',email:adminEmail()},secret,{expiresIn:'8h'}),admin:{email:adminEmail()}})}catch(e){console.error(e);res.status(500).json({error:'Admin login failed'})}});
app.post('/api/admin/request-reset',async(req,res)=>{try{const email=normalizeEmail(req.body.email);if(!isAdminEmail(email))return res.status(401).json({error:'This email is not authorized for Admin Password reset'});const existing=adminOtps.get(email);if(existing&&Date.now()-existing.lastSentAt<60000)return res.status(429).json({error:'Please wait 60 seconds before requesting another code'});const otp=createOtp();await sendAdminMail(email,'Tuition Teacher App - Admin Password Reset',`<div style="font-family:Arial,sans-serif"><h2>Admin Password Reset</h2><p>Your 6-digit verification code is:</p><p style="font-size:30px;font-weight:bold;letter-spacing:6px">${otp}</p><p>This code expires in 10 minutes and can be used only once.</p></div>`);adminOtps.set(email,{hash:crypto.createHash('sha256').update(otp).digest('hex'),expiresAt:Date.now()+10*60*1000,attempts:0,lastSentAt:Date.now()});res.json({ok:true,message:'Reset code sent to your authorized email. Check Inbox, Spam and Promotions. It expires in 10 minutes.'})}catch(e){console.error('ADMIN_RESET_EMAIL_ERROR',e);res.status(503).json({error:'Gmail reset code could not be sent. Check the Gmail HTTP email service settings in Render. Server: '+(e.message||'unknown error')})}});
app.post('/api/admin/reset-password',async(req,res)=>{try{const email=normalizeEmail(req.body.email),otp=String(req.body.otp||'').trim(),newPassword=String(req.body.newPassword||'');if(!isAdminEmail(email))return res.status(401).json({error:'This email is not authorized for Admin Password reset'});if(newPassword.length<6)return res.status(400).json({error:'New password must be at least 6 characters'});const rec=adminOtps.get(email);if(!rec)return res.status(400).json({error:'Reset code not found. Request a new code.'});if(Date.now()>rec.expiresAt){adminOtps.delete(email);return res.status(400).json({error:'Reset code expired. Request a new code.'});}if(rec.attempts>=5){adminOtps.delete(email);return res.status(429).json({error:'Too many incorrect attempts. Request a new code.'});}const h=crypto.createHash('sha256').update(otp).digest('hex');if(h!==rec.hash){rec.attempts++;return res.status(401).json({error:'Incorrect reset code'});}const ph=await bcrypt.hash(newPassword,12);await pool.query(`INSERT INTO admin_account(id,email,password_hash) VALUES(1,$1,$2) ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,password_hash=EXCLUDED.password_hash,updated_at=NOW()`,[adminEmail(),ph]);adminOtps.delete(email);res.json({ok:true,message:'Admin password reset successfully.'})}catch(e){console.error(e);res.status(500).json({error:'Could not reset Admin password'})}});
app.get('/api/admin/me',auth,requireAdmin,async(req,res)=>res.json({role:'admin',email:adminEmail()}));
function words(s){return (s||'').normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu)||[]}
function scriptOf(w){return /[\u0900-\u097F]/u.test(w)?'hi':'en'}
function devanagariToLatin(input){
  const s=String(input||'').normalize('NFKC').replace(/़/g,'');
  const map={
    'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au',
    'क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny',
    'ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n',
    'प':'p','फ':'f','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h',
    'ड़':'r','ढ़':'rh','क़':'q','ख़':'kh','ग़':'gh','ज़':'z','फ़':'f','य़':'y','ल़':'l','श़':'sh',
    'ँ':'n','ं':'n','ः':'h','ऽ':'a','्':'','़':''
  };
  const vowel={'ा':'aa','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'o','ो':'o'};
  let out='';
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(vowel[ch]){out+=vowel[ch];continue}
    if(ch==='्'){continue}
    out+=map[ch]??ch;
  }
  return out.toLowerCase();
}
function romanize(w){return /[\u0900-\u097F]/u.test(w)?devanagariToLatin(w):String(w||'').toLowerCase();}
function phoneticKey(w){
  let x=romanize(w).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'');
  if(!x)return '';
  x=x.replace(/ph/g,'f').replace(/bh/g,'b').replace(/dh/g,'d').replace(/th/g,'t').replace(/kh/g,'k').replace(/gh/g,'g').replace(/chh/g,'ch').replace(/ch/g,'c').replace(/sh/g,'s').replace(/aa|a+/g,'a').replace(/ee|i+/g,'i').replace(/oo|u+/g,'u').replace(/ai|ay/g,'e').replace(/au|aw/g,'o');
  x=x.replace(/([a-z])\1+/g,'$1');
  return x;
}
function editSimilarity(a,b){
  if(a===b)return 1;if(!a||!b)return 0;
  const A=[...a],B=[...b];let prev=Array(B.length+1).fill(0).map((_,j)=>j);
  for(let i=1;i<=A.length;i++){const cur=[i];for(let j=1;j<=B.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(A[i-1]===B[j-1]?0:1));prev=cur;}
  const d=prev[B.length];return 1-d/Math.max(A.length,B.length);
}
function tokenSimilarity(a,b){
  const aa=romanize(a),bb=romanize(b);if(aa===bb)return 1;
  const pa=phoneticKey(a),pb=phoneticKey(b);if(pa&&pa===pb)return 0.94;
  const sim=editSimilarity(aa,bb);
  if(sim>=0.82 && Math.min(aa.length,bb.length)>=4)return sim;
  return 0;
}
function scoreText(reference,spoken){
  const a=words(reference),b=words(spoken);const n=a.length,m=b.length;
  const dp=Array.from({length:n+1},()=>Array(m+1).fill(0));const take=Array.from({length:n+1},()=>Array(m+1).fill(false));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--){
    const sim=tokenSimilarity(a[i],b[j]);
    const match=sim>=0.82?dp[i+1][j+1]+sim: -1;
    const skipRef=dp[i+1][j],skipSpoken=dp[i][j+1];
    if(match>=skipRef && match>=skipSpoken && sim>=0.82){dp[i][j]=match;take[i][j]=true;}else dp[i][j]=Math.max(skipRef,skipSpoken);
  }
  let i=0,j=0;const matched=new Set();let quality=0;
  while(i<n&&j<m){const sim=tokenSimilarity(a[i],b[j]);if(take[i][j]&&sim>=0.82){matched.add(i);quality+=sim;i++;j++;}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++;}
  const correct=matched.size;return {total:n,correct,percent:n?Math.round(correct/n*10000)/100:0,matched:[...matched],matchQuality:n?Math.round(quality/n*10000)/100:0};
}
app.post('/api/admin/request-otp',async(req,res)=>{try{const email=normalizeEmail(req.body.email);if(!isAdminEmail(email))return res.status(401).json({error:'This email is not authorized for Admin Login'});const existing=adminOtps.get(email);if(existing && existing.lastSentAt && Date.now()-existing.lastSentAt<60000)return res.status(429).json({error:'Please wait 60 seconds before requesting another OTP'});const otp=createAdminOtp();adminOtps.set(email,{hash:crypto.createHash('sha256').update(otp).digest('hex'),expiresAt:Date.now()+10*60*1000,attempts:0,lastSentAt:Date.now()});await sendAdminOtpEmail(email,otp);res.json({ok:true,message:'OTP sent to your authorized email. It expires in 10 minutes.'});}catch(e){console.error(e);res.status(503).json({error:e.message||'Could not send Admin OTP'})}});
app.post('/api/admin/verify-otp',async(req,res)=>{try{const email=normalizeEmail(req.body.email);const otp=String(req.body.otp||'').trim();if(!isAdminEmail(email))return res.status(401).json({error:'This email is not authorized for Admin Login'});const record=adminOtps.get(email);if(!record)return res.status(400).json({error:'OTP not found. Please request a new OTP.'});if(Date.now()>record.expiresAt){adminOtps.delete(email);return res.status(400).json({error:'OTP expired. Please request a new OTP.'});}if(record.attempts>=5){adminOtps.delete(email);return res.status(429).json({error:'Too many incorrect OTP attempts. Please request a new OTP.'});}const hash=crypto.createHash('sha256').update(otp).digest('hex');if(hash!==record.hash){record.attempts++;return res.status(401).json({error:'Incorrect OTP'});}adminOtps.delete(email);res.json({token:jwt.sign({role:'admin',email},secret,{expiresIn:'8h'}),admin:{email}});}catch(e){console.error(e);res.status(500).json({error:'Admin OTP verification failed'})}});
app.get('/api/admin/teachers',auth,requireAdmin,async(req,res)=>{const r=await pool.query(`SELECT t.id,t.name,t.email,t.created_at,t.is_blocked,t.last_login_date,t.installed_at,t.last_app_open_at,t.last_app_open_mode,COUNT(DISTINCT s.id)::int student_count,COUNT(DISTINCT tr.id)::int test_count FROM teachers t LEFT JOIN students s ON s.teacher_id=t.id LEFT JOIN test_results tr ON tr.teacher_id=t.id GROUP BY t.id ORDER BY t.created_at DESC`);res.json(r.rows.map(x=>({...x,today_login:String(x.last_login_date||'')===indiaDate(),installed:!!x.installed_at})))});
app.post('/api/admin/teachers/:id/impersonate',auth,requireAdmin,async(req,res)=>{const r=await pool.query('SELECT id,name,email,is_blocked FROM teachers WHERE id=$1',[req.params.id]);if(!r.rowCount)return res.status(404).json({error:'Teacher not found'});const t=r.rows[0];res.json({token:jwt.sign({id:t.id,role:'admin_impersonate',adminEmail:req.user.email||process.env.ADMIN_EMAIL||ADMIN_EMAIL_FALLBACK||''},secret,{expiresIn:'2h'}),teacher:t})});
app.post('/api/admin/teachers/:id/set-password',auth,requireAdmin,async(req,res)=>{try{const id=Number(req.params.id),newPassword=String(req.body.newPassword||'');if(!Number.isInteger(id))return res.status(400).json({error:'Invalid teacher ID'});if(newPassword.length<6)return res.status(400).json({error:'New password must be at least 6 characters'});const hash=await bcrypt.hash(newPassword,12);const r=await pool.query('UPDATE teachers SET password_hash=$1,reset_token_hash=NULL,reset_token_expires_at=NULL WHERE id=$2 RETURNING id,name,email',[hash,id]);if(!r.rowCount)return res.status(404).json({error:'Teacher not found'});res.json({ok:true,message:'Teacher password changed successfully. Existing password cannot be displayed; a new password has been set.',teacher:r.rows[0]})}catch(e){console.error(e);res.status(500).json({error:'Could not change teacher password'})}});
app.post('/api/admin/teachers/:id/block',auth,requireAdmin,async(req,res)=>{try{const id=Number(req.params.id),blocked=!!req.body.blocked;if(!Number.isInteger(id))return res.status(400).json({error:'Invalid teacher ID'});const r=await pool.query('UPDATE teachers SET is_blocked=$1 WHERE id=$2 RETURNING id,name,email,is_blocked',[blocked,id]);if(!r.rowCount)return res.status(404).json({error:'Teacher not found'});res.json({ok:true,teacher:r.rows[0],message:blocked?'Teacher blocked successfully.':'Teacher unblocked successfully.'})}catch(e){console.error(e);res.status(500).json({error:'Could not change teacher block status'})}});

app.delete('/api/admin/teachers/:id',auth,requireAdmin,async(req,res)=>{const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({error:'Invalid teacher ID'});const r=await pool.query('DELETE FROM teachers WHERE id=$1 RETURNING id,name,email',[id]);if(!r.rowCount)return res.status(404).json({error:'Teacher not found'});res.json({ok:true,teacher:r.rows[0]})});
app.post('/api/auth/register',async(req,res)=>{try{const{name,email,password}=req.body;if(!name||!email||!password)return res.status(400).json({error:'Name, email and password are required'});const hash=await bcrypt.hash(password,12);const r=await pool.query('INSERT INTO teachers(name,email,password_hash,last_login_date) VALUES($1,$2,$3,$4) RETURNING id,name,email',[name,email.toLowerCase(),hash,indiaDate()]);const t=r.rows[0];res.json({token:jwt.sign({id:t.id,loginDate:indiaDate()},secret,{expiresIn:'30d'}),teacher:t})}catch(e){res.status(400).json({error:e.code==='23505'?'Email already registered':'Registration failed'})}});
app.post('/api/auth/login',async(req,res)=>{const{email,password}=req.body;const r=await pool.query('SELECT * FROM teachers WHERE email=$1',[String(email||'').toLowerCase()]);if(!r.rowCount)return res.status(401).json({error:'Invalid login'});const t=r.rows[0];if(t.is_blocked)return res.status(403).json({error:'Your Teacher ID is blocked by Admin. Please contact the Admin.'});if(!(await bcrypt.compare(password||'',t.password_hash)))return res.status(401).json({error:'Invalid login'});const today=indiaDate();await pool.query('UPDATE teachers SET last_login_date=$1,last_app_open_at=NOW(),last_app_open_mode=$2 WHERE id=$3',[today,'browser',t.id]);res.json({token:jwt.sign({id:t.id,loginDate:today},secret,{expiresIn:'30d'}),teacher:{id:t.id,name:t.name,email:t.email}})});
app.post('/api/auth/change-password',auth,async(req,res)=>{try{const{currentPassword,newPassword}=req.body;if(!currentPassword||!newPassword||String(newPassword).length<6)return res.status(400).json({error:'Current password and a new password of at least 6 characters are required'});const r=await pool.query('SELECT password_hash FROM teachers WHERE id=$1',[req.user.id]);if(!r.rowCount||!(await bcrypt.compare(currentPassword,r.rows[0].password_hash)))return res.status(400).json({error:'Current password is incorrect'});const hash=await bcrypt.hash(newPassword,12);await pool.query('UPDATE teachers SET password_hash=$1 WHERE id=$2',[hash,req.user.id]);res.json({ok:true,message:'Password changed successfully'})}catch(e){console.error(e);res.status(500).json({error:'Could not change password'})}});
app.post('/api/auth/forgot-password',async(req,res)=>{try{const email=normalizeEmail(req.body.email);if(!email)return res.status(400).json({error:'Email is required'});const r=await pool.query('SELECT id,email,name FROM teachers WHERE email=$1',[email]);if(!r.rowCount)return res.json({message:'If this email is registered, a reset link has been sent.'});const token=crypto.randomBytes(32).toString('hex');const hash=crypto.createHash('sha256').update(token).digest('hex');await pool.query("UPDATE teachers SET reset_token_hash=$1,reset_token_expires_at=NOW()+INTERVAL '30 minutes' WHERE id=$2",[hash,r.rows[0].id]);const base=process.env.APP_URL||`${req.protocol}://${req.get('host')}`;const link=`${base}/?reset=${token}`;await sendGmail(email,'Tuition Teacher App - Password Reset',`<div style="font-family:Arial,sans-serif"><h2>Password Reset</h2><p>Hello ${String(r.rows[0].name||'Teacher').replace(/[<>&"']/g,'')}</p><p>Click the button below to create a new password. This link expires in 30 minutes.</p><p><a href="${link}" style="display:inline-block;padding:12px 18px;background:#111;color:#fff;text-decoration:none;border-radius:6px">Reset Password</a></p><p>If you did not request this, you can ignore this email.</p></div>`);res.json({message:'Password reset link has been sent to your registered email. The link expires in 30 minutes.'})}catch(e){console.error(e);res.status(503).json({error:e.message||'Could not send password reset email. Check GMAIL_WEBHOOK_URL and GMAIL_WEBHOOK_SECRET in Render.'})}});
app.post('/api/auth/reset-password',async(req,res)=>{try{const{token,newPassword}=req.body;if(!token||!newPassword||String(newPassword).length<6)return res.status(400).json({error:'Reset link and a new password of at least 6 characters are required'});const hash=crypto.createHash('sha256').update(String(token)).digest('hex');const r=await pool.query('SELECT id FROM teachers WHERE reset_token_hash=$1 AND reset_token_expires_at>NOW()',[hash]);if(!r.rowCount)return res.status(400).json({error:'Reset link is invalid or expired'});const pass=await bcrypt.hash(newPassword,12);await pool.query('UPDATE teachers SET password_hash=$1,reset_token_hash=NULL,reset_token_expires_at=NULL WHERE id=$2',[pass,r.rows[0].id]);res.json({ok:true,message:'Password reset successfully. You can now login.'})}catch(e){console.error(e);res.status(500).json({error:'Could not reset password'})}});
app.post('/api/teacher/activity',auth,async(req,res)=>{try{const mode=String(req.body.mode||'browser').slice(0,30);const installed=mode==='standalone'||mode==='fullscreen'||mode==='minimal-ui';const r=await pool.query(`UPDATE teachers SET last_app_open_at=NOW(),last_app_open_mode=$1,installed_at=CASE WHEN $2::boolean THEN COALESCE(installed_at,NOW()) ELSE installed_at END WHERE id=$3 RETURNING id,installed_at,last_app_open_at,last_app_open_mode,last_login_date`,[mode,installed,req.user.id]);res.json({ok:true,...r.rows[0],installed:!!r.rows[0]?.installed_at});}catch(e){console.error(e);res.status(500).json({error:'Could not update app activity'})}});
app.get('/api/me',auth,async(req,res)=>{const r=await pool.query('SELECT id,name,email FROM teachers WHERE id=$1',[req.user.id]);res.json(r.rows[0])});
app.get('/api/students',auth,async(req,res)=>{const r=await pool.query('SELECT * FROM students WHERE teacher_id=$1 ORDER BY name',[req.user.id]);res.json(r.rows)});
app.post('/api/students',auth,async(req,res)=>{const c=await pool.query('SELECT COUNT(*) FROM students WHERE teacher_id=$1',[req.user.id]);if(+c.rows[0].count>=20)return res.status(400).json({error:'Maximum 20 students allowed'});const{name,className,phone}=req.body;if(!name||!className)return res.status(400).json({error:'Name and class are required'});const cleanPhone=String(phone||'').replace(/[^0-9+]/g,'').trim()||null;const r=await pool.query('INSERT INTO students(teacher_id,name,class_name,phone) VALUES($1,$2,$3,$4) RETURNING *',[req.user.id,name,className,cleanPhone]);res.json(r.rows[0])});app.delete('/api/students/:id',auth,async(req,res)=>{const r=await pool.query('DELETE FROM students WHERE id=$1 AND teacher_id=$2 RETURNING id',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Student not found'});res.json({ok:true})});
app.put('/api/students/:id/phone',auth,async(req,res)=>{const phone=String(req.body.phone||'').replace(/[^0-9+]/g,'').trim();const r=await pool.query('UPDATE students SET phone=$1 WHERE id=$2 AND teacher_id=$3 RETURNING *',[phone||null,req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Student not found'});res.json(r.rows[0])});
app.get('/api/content',auth,async(req,res)=>{const subjects=(await pool.query('SELECT * FROM subjects WHERE teacher_id=$1 ORDER BY name',[req.user.id])).rows;for(const s of subjects){s.books=(await pool.query('SELECT b.* FROM books b WHERE b.subject_id=$1 ORDER BY b.name',[s.id])).rows;for(const b of s.books){b.chapters=(await pool.query('SELECT c.* FROM chapters c WHERE c.book_id=$1 ORDER BY c.created_at',[b.id])).rows;for(const c of b.chapters){c.paragraphs=(await pool.query('SELECT * FROM paragraphs WHERE chapter_id=$1 ORDER BY position',[c.id])).rows;c.qa=(await pool.query('SELECT * FROM qa_items WHERE chapter_id=$1 ORDER BY position',[c.id])).rows}}}res.json(subjects)});
app.post('/api/subjects',auth,async(req,res)=>{const{name}=req.body;if(!name)return res.status(400).json({error:'Subject name required'});const r=await pool.query('INSERT INTO subjects(teacher_id,name) VALUES($1,$2) RETURNING *',[req.user.id,name]);res.json(r.rows[0])});
app.put('/api/subjects/:id',auth,async(req,res)=>{const{name}=req.body;if(!name)return res.status(400).json({error:'Subject name required'});const r=await pool.query('UPDATE subjects SET name=$1 WHERE id=$2 AND teacher_id=$3 RETURNING *',[name,req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Subject not found'});res.json(r.rows[0])});
app.delete('/api/subjects/:id',auth,async(req,res)=>{const r=await pool.query('DELETE FROM subjects WHERE id=$1 AND teacher_id=$2 RETURNING id',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Subject not found'});res.json({ok:true})});
app.post('/api/books',auth,async(req,res)=>{const{name,subjectId}=req.body;const own=await pool.query('SELECT id FROM subjects WHERE id=$1 AND teacher_id=$2',[subjectId,req.user.id]);if(!own.rowCount)return res.status(404).json({error:'Subject not found'});const r=await pool.query('INSERT INTO books(subject_id,name) VALUES($1,$2) RETURNING *',[subjectId,name]);res.json(r.rows[0])});
app.put('/api/books/:id',auth,async(req,res)=>{const{name}=req.body;if(!name)return res.status(400).json({error:'Book name required'});const r=await pool.query('UPDATE books b SET name=$1 FROM subjects s WHERE b.id=$2 AND b.subject_id=s.id AND s.teacher_id=$3 RETURNING b.*',[name,req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Book not found'});res.json(r.rows[0])});
app.post('/api/chapters',auth,async(req,res)=>{const{name,bookId,text}=req.body;const own=await pool.query('SELECT b.id FROM books b JOIN subjects s ON s.id=b.subject_id WHERE b.id=$1 AND s.teacher_id=$2',[bookId,req.user.id]);if(!own.rowCount)return res.status(404).json({error:'Book not found'});const ch=(await pool.query('INSERT INTO chapters(book_id,name) VALUES($1,$2) RETURNING *',[bookId,name])).rows[0];const chapterText=String(text||'').trim();if(chapterText)await pool.query('INSERT INTO paragraphs(chapter_id,position,text) VALUES($1,$2,$3)',[ch.id,1,chapterText]);res.json(ch)});
app.put('/api/chapters/:id',auth,async(req,res)=>{const{name}=req.body;if(!name)return res.status(400).json({error:'Chapter name required'});const r=await pool.query('UPDATE chapters c SET name=$1 FROM books b JOIN subjects s ON s.id=b.subject_id WHERE c.id=$2 AND c.book_id=b.id AND s.teacher_id=$3 RETURNING c.*',[name,req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Chapter not found'});res.json(r.rows[0])});
app.delete('/api/chapters/:id',auth,async(req,res)=>{const r=await pool.query('DELETE FROM chapters c USING books b,subjects s WHERE c.id=$1 AND c.book_id=b.id AND b.subject_id=s.id AND s.teacher_id=$2 RETURNING c.id',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Chapter not found'});res.json({ok:true})});
app.post('/api/chapters/:id/paragraphs',auth,async(req,res)=>{const id=req.params.id;const own=await pool.query('SELECT c.id FROM chapters c JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE c.id=$1 AND s.teacher_id=$2',[id,req.user.id]);if(!own.rowCount)return res.status(404).json({error:'Chapter not found'});const{text,position}=req.body;const r=await pool.query('INSERT INTO paragraphs(chapter_id,position,text) VALUES($1,$2,$3) RETURNING *',[id,position||999,text]);res.json(r.rows[0])});
app.put('/api/paragraphs/:id',auth,async(req,res)=>{const r=await pool.query('UPDATE paragraphs p SET text=$1 FROM chapters c JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE p.id=$2 AND p.chapter_id=c.id AND s.teacher_id=$3 RETURNING p.*',[req.body.text,req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Paragraph not found'});res.json(r.rows[0])});
app.delete('/api/paragraphs/:id',auth,async(req,res)=>{const r=await pool.query('DELETE FROM paragraphs p USING chapters c,books b,subjects s WHERE p.id=$1 AND p.chapter_id=c.id AND c.book_id=b.id AND b.subject_id=s.id AND s.teacher_id=$2 RETURNING p.id',[req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Paragraph not found'});res.json({ok:true})});
app.post('/api/paragraphs/merge',auth,async(req,res)=>{
  const client=await pool.connect();
  try{
    const {firstId,secondId}=req.body;
    await client.query('BEGIN');
    const r=await client.query('SELECT p.id,p.chapter_id,p.position,p.text,s.teacher_id FROM paragraphs p JOIN chapters c ON c.id=p.chapter_id JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE p.id=ANY($1::int[]) ORDER BY p.position',[ [firstId,secondId] ]);
    if(r.rows.length!==2||r.rows[0].chapter_id!==r.rows[1].chapter_id||r.rows[0].teacher_id!==req.user.id)throw new Error('Paragraphs not found');
    const first=r.rows[0],second=r.rows[1];
    if(second.position!==first.position+1)throw new Error('Only adjacent paragraphs can be merged');
    const merged=(first.text.trim()+' '+second.text.trim()).trim();
    await client.query('UPDATE paragraphs SET text=$1 WHERE id=$2',[merged,first.id]);
    await client.query('DELETE FROM paragraphs WHERE id=$1',[second.id]);
    await client.query('UPDATE paragraphs SET position=position-1 WHERE chapter_id=$1 AND position>$2',[first.chapter_id,second.position]);
    await client.query('COMMIT');
    res.json({ok:true});
  }catch(e){await client.query('ROLLBACK');res.status(400).json({error:e.message||'Could not merge paragraphs'});
  }finally{client.release();}
});
app.post('/api/chapters/:id/qa',auth,async(req,res)=>{const own=await pool.query('SELECT c.id FROM chapters c JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE c.id=$1 AND s.teacher_id=$2',[req.params.id,req.user.id]);if(!own.rowCount)return res.status(404).json({error:'Chapter not found'});const{question,answer,position}=req.body;const r=await pool.query('INSERT INTO qa_items(chapter_id,position,question,answer) VALUES($1,$2,$3,$4) RETURNING *',[req.params.id,position||999,question,answer]);res.json(r.rows[0])});
app.post('/api/tests/score',auth,async(req,res)=>{
  try{
    const {studentId,chapterId,testType,itemId,spokenText}=req.body;
    if(!studentId||!chapterId||!testType)return res.status(400).json({error:'Student, chapter and test type are required'});
    const own=await pool.query('SELECT id FROM students WHERE id=$1 AND teacher_id=$2',[studentId,req.user.id]);
    if(!own.rowCount)return res.status(404).json({error:'Student not found'});
    let referenceText='';
    if(testType==='paragraph'){
      const r=await pool.query('SELECT p.text FROM paragraphs p JOIN chapters c ON c.id=p.chapter_id JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE p.id=$1 AND p.chapter_id=$2 AND s.teacher_id=$3',[itemId,chapterId,req.user.id]);
      if(!r.rowCount)return res.status(404).json({error:'Paragraph not found'});
      referenceText=r.rows[0].text;
    }else if(testType==='qa'){
      const r=await pool.query('SELECT q.answer FROM qa_items q JOIN chapters c ON c.id=q.chapter_id JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE q.id=$1 AND q.chapter_id=$2 AND s.teacher_id=$3',[itemId,chapterId,req.user.id]);
      if(!r.rowCount)return res.status(404).json({error:'Q&A item not found'});
      referenceText=r.rows[0].answer;
    }else if(testType==='chapter'){
      const r=await pool.query("SELECT COALESCE(string_agg(p.text, ' ' ORDER BY p.position), '') AS reference_text FROM paragraphs p JOIN chapters c ON c.id=p.chapter_id JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE c.id=$1 AND s.teacher_id=$2",[chapterId,req.user.id]);
      if(!r.rowCount)return res.status(404).json({error:'Chapter not found'});
      referenceText=r.rows[0].reference_text;
    }else{return res.status(400).json({error:'Invalid test type'});}
    const result=scoreText(referenceText,spokenText||'');
    const passed=result.percent>=80;
    const saved=await pool.query('INSERT INTO test_results(teacher_id,student_id,chapter_id,test_type,item_id,total_words,correct_words,score_percent,passed,spoken_text,reference_text,matched_word_indexes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *',[req.user.id,studentId,chapterId,testType,itemId||null,result.total,result.correct,result.percent,passed,spokenText||'',referenceText,JSON.stringify(result.matched)]);
    res.json({...result,passed,referenceText,resultId:saved.rows[0].id});
  }catch(e){console.error(e);res.status(500).json({error:'Could not score test'});
  }
});
app.put('/api/results/:resultId/matches',auth,async(req,res)=>{try{const resultId=Number(req.params.resultId);if(!Number.isInteger(resultId)||resultId<1)return res.status(400).json({error:'Invalid result ID'});const found=await pool.query("SELECT tr.id,tr.student_id,COALESCE(tr.reference_text,CASE WHEN tr.test_type='paragraph' THEN p.text WHEN tr.test_type='qa' THEN q.answer WHEN tr.test_type='chapter' THEN (SELECT COALESCE(string_agg(pp.text,' ' ORDER BY pp.position),'') FROM paragraphs pp WHERE pp.chapter_id=tr.chapter_id) END,'') AS reference_text FROM test_results tr LEFT JOIN paragraphs p ON tr.test_type='paragraph' AND p.id=tr.item_id LEFT JOIN qa_items q ON tr.test_type='qa' AND q.id=tr.item_id WHERE tr.id=$1 AND tr.teacher_id=$2",[resultId,req.user.id]);if(!found.rowCount)return res.status(404).json({error:'Test result not found'});const reference=String(found.rows[0].reference_text||'');const total=words(reference).length;const incoming=Array.isArray(req.body.matchedWordIndexes)?req.body.matchedWordIndexes:[];const matched=[...new Set(incoming.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<total))].sort((a,b)=>a-b);const manualIncoming=Array.isArray(req.body.manualWordIndexes)?req.body.manualWordIndexes:[];const manual=[...new Set(manualIncoming.map(Number).filter(n=>Number.isInteger(n)&&n>=0&&n<total&&matched.includes(n)))].sort((a,b)=>a-b);const correct=matched.length;const percent=total?Math.round(correct/total*10000)/100:0;const passed=percent>=80;const updated=await pool.query('UPDATE test_results SET total_words=$1,correct_words=$2,score_percent=$3,passed=$4,matched_word_indexes=$5::jsonb,manual_word_indexes=$6::jsonb,reference_text=$7 WHERE id=$8 AND teacher_id=$9 RETURNING id,student_id,total_words,correct_words,score_percent,passed,reference_text,matched_word_indexes,manual_word_indexes',[total,correct,percent,passed,JSON.stringify(matched),JSON.stringify(manual),reference,resultId,req.user.id]);res.json({...updated.rows[0],percent:Number(updated.rows[0].score_percent),correct:updated.rows[0].correct_words,total:updated.rows[0].total_words,matched,manualWordIndexes:manual,passed:updated.rows[0].passed,referenceText:updated.rows[0].reference_text});}catch(e){console.error(e);res.status(500).json({error:'Could not update manual score'});}});
app.get('/api/results/:studentId',auth,async(req,res)=>{try{const studentId=Number(req.params.studentId);const own=await pool.query('SELECT id FROM students WHERE id=$1 AND teacher_id=$2',[studentId,req.user.id]);if(!own.rowCount)return res.status(404).json({error:'Student not found'});const r=await pool.query(`SELECT tr.id,tr.student_id,tr.chapter_id,tr.test_type,tr.item_id,tr.total_words,tr.correct_words,tr.score_percent,tr.passed,tr.spoken_text,tr.reference_text,tr.matched_word_indexes,tr.manual_word_indexes,tr.created_at,c.name chapter_name,p.position paragraph_position,p.text paragraph_text,q.question,q.answer qa_answer FROM test_results tr LEFT JOIN chapters c ON c.id=tr.chapter_id LEFT JOIN paragraphs p ON tr.test_type='paragraph' AND p.id=tr.item_id LEFT JOIN qa_items q ON tr.test_type='qa' AND q.id=tr.item_id WHERE tr.student_id=$1 AND tr.teacher_id=$2 ORDER BY tr.created_at DESC`,[studentId,req.user.id]);const rows=r.rows.map(x=>{let matched=[];try{matched=Array.isArray(x.matched_word_indexes)?x.matched_word_indexes:JSON.parse(x.matched_word_indexes||'[]')}catch{};let reference=x.reference_text||x.paragraph_text||x.qa_answer||'';if(reference&&x.spoken_text&&(x.reference_text==null||!Array.isArray(x.matched_word_indexes)||x.matched_word_indexes.length===0)){matched=scoreText(reference,x.spoken_text).matched}return {...x,score_percent:Number(x.score_percent),matched_word_indexes:matched,manual_word_indexes:Array.isArray(x.manual_word_indexes)?x.manual_word_indexes:[],reference_text:reference}});res.json(rows)}catch(e){console.error(e);res.status(500).json({error:'Could not load test history'})}});
app.get('/api/results',auth,async(req,res)=>{const r=await pool.query(`SELECT s.id student_id,s.name,s.class_name,ROUND(COALESCE(AVG(tr.score_percent),0),2) score,COUNT(tr.id)::int tests FROM students s LEFT JOIN test_results tr ON tr.student_id=s.id AND tr.teacher_id=$1 WHERE s.teacher_id=$1 GROUP BY s.id ORDER BY score DESC, s.name`,[req.user.id]);res.json(r.rows)});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
init().then(()=>app.listen(process.env.PORT||10000)).catch(e=>{console.error(e);process.exit(1)});
