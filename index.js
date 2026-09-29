const express=require('express');const cors=require('cors');const path=require('path');const fs=require('fs');const bcrypt=require('bcryptjs');const jwt=require('jsonwebtoken');const {Pool}=require('pg');require('dotenv').config();
const app=express();app.use(cors());app.use(express.json({limit:'2mb'}));app.use(express.static(__dirname));
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:process.env.NODE_ENV==='production'?{rejectUnauthorized:false}:false});
async function init(){const sql=fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8');await pool.query(sql)}
const secret=process.env.JWT_SECRET||'dev-only-change-me';
function auth(req,res,next){try{const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';req.user=jwt.verify(token,secret);next()}catch(e){res.status(401).json({error:'Unauthorized'})}}
function words(s){return (s||'').normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu)||[]}
function scoreText(reference,spoken){const a=words(reference).map(x=>x.toLocaleLowerCase());const b=words(spoken).map(x=>x.toLocaleLowerCase());const dp=Array.from({length:a.length+1},()=>Array(b.length+1).fill(0));for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)dp[i][j]=a[i]===b[j]?dp[i+1][j+1]+1:Math.max(dp[i+1][j],dp[i][j+1]);let i=0,j=0;const matched=new Set();while(i<a.length&&j<b.length){if(a[i]===b[j]){matched.add(i);i++;j++}else if(dp[i+1][j]>=dp[i][j+1])i++;else j++}return {total:a.length,correct:matched.size,percent:a.length?Math.round(matched.size/a.length*10000)/100:0,matched:[...matched]}}
app.post('/api/auth/register',async(req,res)=>{try{const{name,email,password}=req.body;if(!name||!email||!password)return res.status(400).json({error:'Name, email and password are required'});const hash=await bcrypt.hash(password,12);const r=await pool.query('INSERT INTO teachers(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email',[name,email.toLowerCase(),hash]);const t=r.rows[0];res.json({token:jwt.sign({id:t.id},secret,{expiresIn:'30d'}),teacher:t})}catch(e){res.status(400).json({error:e.code==='23505'?'Email already registered':'Registration failed'})}});
app.post('/api/auth/login',async(req,res)=>{const{email,password}=req.body;const r=await pool.query('SELECT * FROM teachers WHERE email=$1',[String(email||'').toLowerCase()]);if(!r.rowCount||!(await bcrypt.compare(password||'',r.rows[0].password_hash)))return res.status(401).json({error:'Invalid login'});const t=r.rows[0];res.json({token:jwt.sign({id:t.id},secret,{expiresIn:'30d'}),teacher:{id:t.id,name:t.name,email:t.email}})});
app.get('/api/me',auth,async(req,res)=>{const r=await pool.query('SELECT id,name,email FROM teachers WHERE id=$1',[req.user.id]);res.json(r.rows[0])});
app.get('/api/students',auth,async(req,res)=>{const r=await pool.query('SELECT * FROM students WHERE teacher_id=$1 ORDER BY name',[req.user.id]);res.json(r.rows)});
app.post('/api/students',auth,async(req,res)=>{const c=await pool.query('SELECT COUNT(*) FROM students WHERE teacher_id=$1',[req.user.id]);if(+c.rows[0].count>=20)return res.status(400).json({error:'Maximum 20 students allowed'});const{name,className}=req.body;if(!name||!className)return res.status(400).json({error:'Name and class are required'});const r=await pool.query('INSERT INTO students(teacher_id,name,class_name) VALUES($1,$2,$3) RETURNING *',[req.user.id,name,className]);res.json(r.rows[0])});
app.get('/api/content',auth,async(req,res)=>{const subjects=(await pool.query('SELECT * FROM subjects WHERE teacher_id=$1 ORDER BY name',[req.user.id])).rows;for(const s of subjects){s.books=(await pool.query('SELECT b.* FROM books b WHERE b.subject_id=$1 ORDER BY b.name',[s.id])).rows;for(const b of s.books){b.chapters=(await pool.query('SELECT c.* FROM chapters c WHERE c.book_id=$1 ORDER BY c.created_at',[b.id])).rows;for(const c of b.chapters){c.paragraphs=(await pool.query('SELECT * FROM paragraphs WHERE chapter_id=$1 ORDER BY position',[c.id])).rows;c.qa=(await pool.query('SELECT * FROM qa_items WHERE chapter_id=$1 ORDER BY position',[c.id])).rows}}}res.json(subjects)});
app.post('/api/subjects',auth,async(req,res)=>{const{name}=req.body;if(!name)return res.status(400).json({error:'Subject name required'});const r=await pool.query('INSERT INTO subjects(teacher_id,name) VALUES($1,$2) RETURNING *',[req.user.id,name]);res.json(r.rows[0])});
app.post('/api/books',auth,async(req,res)=>{const{name,subjectId}=req.body;const own=await pool.query('SELECT id FROM subjects WHERE id=$1 AND teacher_id=$2',[subjectId,req.user.id]);if(!own.rowCount)return res.status(404).json({error:'Subject not found'});const r=await pool.query('INSERT INTO books(subject_id,name) VALUES($1,$2) RETURNING *',[subjectId,name]);res.json(r.rows[0])});
app.post('/api/chapters',auth,async(req,res)=>{const{name,bookId,text}=req.body;const own=await pool.query('SELECT b.id FROM books b JOIN subjects s ON s.id=b.subject_id WHERE b.id=$1 AND s.teacher_id=$2',[bookId,req.user.id]);if(!own.rowCount)return res.status(404).json({error:'Book not found'});const ch=(await pool.query('INSERT INTO chapters(book_id,name) VALUES($1,$2) RETURNING *',[bookId,name])).rows[0];const ps=String(text||'').split(/\n\s*\n|\n(?=\s*\S)/).map(x=>x.trim()).filter(Boolean);for(let i=0;i<ps.length;i++)await pool.query('INSERT INTO paragraphs(chapter_id,position,text) VALUES($1,$2,$3)',[ch.id,i+1,ps[i]]);res.json(ch)});
app.post('/api/chapters/:id/paragraphs',auth,async(req,res)=>{const id=req.params.id;const own=await pool.query('SELECT c.id FROM chapters c JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE c.id=$1 AND s.teacher_id=$2',[id,req.user.id]);if(!own.rowCount)return res.status(404).json({error:'Chapter not found'});const{text,position}=req.body;const r=await pool.query('INSERT INTO paragraphs(chapter_id,position,text) VALUES($1,$2,$3) RETURNING *',[id,position||999,text]);res.json(r.rows[0])});
app.put('/api/paragraphs/:id',auth,async(req,res)=>{const r=await pool.query('UPDATE paragraphs p SET text=$1 FROM chapters c JOIN books b ON b.id=c.book_id JOIN subjects s ON s.id=b.subject_id WHERE p.id=$2 AND p.chapter_id=c.id AND s.teacher_id=$3 RETURNING p.*',[req.body.text,req.params.id,req.user.id]);if(!r.rowCount)return res.status(404).json({error:'Paragraph not found'});res.json(r.rows[0])});
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
    const saved=await pool.query('INSERT INTO test_results(teacher_id,student_id,chapter_id,test_type,item_id,total_words,correct_words,score_percent,passed,spoken_text) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',[req.user.id,studentId,chapterId,testType,itemId||null,result.total,result.correct,result.percent,passed,spokenText||'']);
    res.json({...result,passed,referenceText,resultId:saved.rows[0].id});
  }catch(e){console.error(e);res.status(500).json({error:'Could not score test'});
  }
});
app.get('/api/results',auth,async(req,res)=>{const r=await pool.query(`SELECT s.id student_id,s.name,s.class_name,ROUND(COALESCE(AVG(tr.score_percent),0),2) score,COUNT(tr.id)::int tests FROM students s LEFT JOIN test_results tr ON tr.student_id=s.id AND tr.teacher_id=$1 WHERE s.teacher_id=$1 GROUP BY s.id ORDER BY score DESC, s.name`,[req.user.id]);res.json(r.rows)});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
init().then(()=>app.listen(process.env.PORT||10000)).catch(e=>{console.error(e);process.exit(1)});
