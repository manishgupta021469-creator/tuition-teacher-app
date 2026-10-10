'use strict';
const crypto = require('crypto');

const SUBJECTS = [
  {name:'हिंदी', code:'hindi', topics:['भाषा और व्याकरण','संज्ञा','सर्वनाम','विशेषण','क्रिया','काल','वचन और लिंग','विराम-चिह्न','पत्र लेखन','कहानी की समझ','कविता का भाव','मुहावरे','पर्यावरण','मेरा विद्यालय','स्वच्छता','समय का महत्व','पुस्तकें और ज्ञान','अच्छी आदतें']},
  {name:'English', code:'english', topics:['A Morning Walk','The Clever Rabbit','Nouns and Pronouns','A Visit to the Zoo','Adjectives','The Helpful Friend','Simple Present Tense','Our Green Earth','A Letter to a Friend','The Honest Woodcutter','Prepositions','A Rainy Day','Healthy Habits','The Little Seed','Past Tense','Reading a Story','The Value of Time','A Day at School']},
  {name:'गणित', code:'math', topics:['संख्याओं की समझ','पूर्ण संख्याएँ','गुणनखंड और गुणज','भिन्न','दशमलव','पूर्णांक','आकार और आकृतियाँ','रेखाएँ और कोण','परिमाप','क्षेत्रफल','आँकड़ों का प्रबंधन','अनुपात','सममिति','बीजगणित की शुरुआत','मापन','समय और दूरी','धन और गणना','गणितीय पहेलियाँ']},
  {name:'विज्ञान', code:'science', topics:['भोजन के स्रोत','भोजन के घटक','रेशों से वस्त्र','वस्तुओं का वर्गीकरण','पदार्थों को अलग करना','हमारे आसपास परिवर्तन','पौधों को जानें','शरीर की गति','जीव-जंतु और आवास','जीवों में विविधता','प्रकाश और छाया','विद्युत परिपथ','चुंबक','जल','वायु','कचरा प्रबंधन','संतुलित आहार','विज्ञान और दैनिक जीवन']},
  {name:'सामाजिक विज्ञान', code:'social', topics:['हमारी पृथ्वी','ग्लोब और मानचित्र','दिशाएँ और पैमाना','भारत की भौगोलिक विविधता','प्रारंभिक मानव','इतिहास के स्रोत','प्राचीन बस्तियाँ','गाँव और नगर','विविधता में एकता','परिवार और समुदाय','स्थानीय शासन','पंचायत','जीवन और आजीविका','संसाधनों का उपयोग','मौसम और जलवायु','प्राकृतिक पर्यावरण','नागरिक जिम्मेदारियाँ','सहयोग और समानता']},
  {name:'संस्कृत', code:'sanskrit', topics:['संस्कृत वर्णमाला','स्वर और व्यंजन','सरल शब्द','सर्वनाम','संख्या शब्द','धातु परिचय','लट् लकार','सुभाषितानि','परिवारः','विद्यालयः','प्रकृतिः','फलानि','पशवः','रंगाः','समयः','सरल वाक्यानि','पठित गद्यांश','अभ्यास और पुनरावृत्ति']}
];
const STUDENTS = [
  {name:'आरव सिंह', phone:null}, {name:'अंशिका वर्मा', phone:null}, {name:'मोहित यादव', phone:null},
  {name:'सान्वी मिश्रा', phone:null}, {name:'रोहन कुमार', phone:null}
];

function words(s){return (s||'').normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu)||[];}
function safeRandomInt(min,max){return crypto.randomInt(min,max+1);}
function choosePositions(total,correct){
  const a=Array.from({length:total},(_,i)=>i);
  for(let i=a.length-1;i>0;i--){const j=crypto.randomInt(i+1);[a[i],a[j]]=[a[j],a[i]];}
  return a.slice(0,correct).sort((x,y)=>x-y);
}
function contentFor(subject,topic,bookNo,chapterNo){
  if(subject.code==='english'){
    const p1=`${topic} helps us learn new words and understand the world around us. In this lesson, students read carefully, notice important details, and discuss the meaning of each sentence. Good readers use context, ask questions, and explain their ideas in simple language.`;
    const p2=`The lesson ${topic} also teaches us to listen patiently and speak clearly. We should practise reading aloud, learn the key vocabulary, and retell the main idea in our own words. Regular practice builds confidence and improves comprehension.`;
    return [p1,p2];
  }
  if(subject.code==='math'){
    const p1=`${topic} गणित का एक उपयोगी विषय है। इसे समझने के लिए पहले प्रश्न को ध्यान से पढ़ना, दी गई संख्याओं की पहचान करना और सही विधि चुनना आवश्यक है। उदाहरणों को क्रम से हल करने पर गणना अधिक स्पष्ट होती है और गलती ढूँढ़ना आसान होता है।`;
    const p2=`इस अध्याय में विद्यार्थी ${topic} से जुड़े उदाहरण, अभ्यास और दैनिक जीवन के उपयोग समझते हैं। उत्तर लिखते समय सभी चरण दिखाएँ, इकाई जहाँ आवश्यक हो वहाँ लगाएँ और अंत में उत्तर की जाँच करें। अभ्यास से गति और शुद्धता दोनों बढ़ती हैं।`;
    return [p1,p2];
  }
  if(subject.code==='science'){
    const p1=`${topic} हमारे आसपास की दुनिया को समझने में सहायता करता है। विज्ञान में हम वस्तुओं और घटनाओं को ध्यान से देखते हैं, प्रश्न पूछते हैं और प्रमाण के आधार पर निष्कर्ष निकालते हैं। अवलोकन करते समय समानताओं, भिन्नताओं और कारणों पर ध्यान देना चाहिए।`;
    const p2=`इस पाठ ${topic} से हमें पता चलता है कि प्रकृति और दैनिक जीवन की घटनाओं को समझने के लिए जिज्ञासा तथा सावधानी जरूरी हैं। सरल गतिविधियों को शिक्षक के मार्गदर्शन में करें, परिणाम लिखें और पर्यावरण तथा अपने स्वास्थ्य के प्रति जिम्मेदार व्यवहार अपनाएँ।`;
    return [p1,p2];
  }
  if(subject.code==='social'){
    const p1=`${topic} समाज, स्थान और लोगों के जीवन को समझने का अवसर देता है। अपने आसपास के उदाहरणों को देखकर विद्यार्थी जान सकते हैं कि स्थान, इतिहास, संसाधन और सामाजिक व्यवहार एक-दूसरे से किस प्रकार जुड़े होते हैं। मानचित्र, चित्र और बातचीत इस अध्ययन में उपयोगी हैं।`;
    const p2=`इस अध्याय ${topic} का मुख्य संदेश है कि हर समुदाय का जीवन अनेक परिस्थितियों से प्रभावित होता है। हमें स्थानीय उदाहरणों का सम्मानपूर्वक अध्ययन करना चाहिए, अलग-अलग विचार सुनने चाहिए और साझा संसाधनों का जिम्मेदारी से उपयोग करना चाहिए।`;
    return [p1,p2];
  }
  if(subject.code==='sanskrit'){
    const p1=`${topic} संस्कृत सीखने का एक महत्वपूर्ण अभ्यास है। विद्यार्थी शब्दों का स्पष्ट उच्चारण करते हैं, उनका अर्थ समझते हैं और छोटे वाक्यों में उनका प्रयोग करते हैं। नियमित पठन से वर्ण, शब्द और वाक्य रचना की पहचान मजबूत होती है।`;
    const p2=`इस पाठ ${topic} में सरल उदाहरणों के माध्यम से भाषा का अभ्यास किया जाता है। शब्दों को ध्यान से पढ़ें, अर्थ याद करने के साथ उनका प्रयोग भी करें और छोटे वाक्य स्वयं बनाएँ। अभ्यास, शुद्ध उच्चारण और पुनरावृत्ति से सीखना आसान होता है।`;
    return [p1,p2];
  }
  const p1=`${topic} भाषा और जीवन से जुड़ा एक महत्वपूर्ण विषय है। इसे पढ़ते समय मुख्य विचार पहचानना, नए शब्दों का अर्थ समझना और उदाहरणों पर ध्यान देना चाहिए। विद्यार्थी अपने अनुभवों से विषय को जोड़कर सरल व स्पष्ट भाषा में बात समझा सकते हैं।`;
  const p2=`इस पाठ ${topic} से हमें ध्यानपूर्वक पढ़ने, सही जानकारी चुनने और अपने विचार क्रम से लिखने का अभ्यास मिलता है। पाठ के मुख्य बिंदु दोहराएँ, छोटे उदाहरण बनाएँ और सीखी हुई बातों का दैनिक जीवन में उपयोग करें। निरंतर अभ्यास से समझ बेहतर होती है।`;
  return [p1,p2];
}
function noteFor(subject,topic){
  if(subject.code==='english') return `Key idea: ${topic}. Read the passage twice, underline important words, learn their meanings, and retell the central idea in your own words. Practise clear pronunciation and complete the exercise without rushing.`;
  return `${topic} — मुख्य बिंदु: विषय की परिभाषा और उदाहरण समझें। महत्वपूर्ण शब्दों को लिखें, पाठ के दोनों अनुच्छेद दोहराएँ और सीखी हुई बात का दैनिक जीवन में एक उदाहरण सोचें। टेस्ट से पहले मुख्य बिंदुओं की पुनरावृत्ति करें।`;
}
function questionRows(subject,topic,paras){
  const def = subject.code==='english' ? `${topic} is a reading and learning topic. It helps students understand ideas, improve vocabulary, and explain a lesson in clear words.` : `${topic} को समझने के लिए ध्यान से पढ़ना, उदाहरणों पर विचार करना और मुख्य बिंदुओं को अपने शब्दों में बताना आवश्यक है।`;
  const lesson = subject.code==='english' ? `The lesson encourages careful reading, clear speaking, regular practice, and explaining the main idea in one's own words.` : `इस विषय से हमें सही जानकारी समझने, उदाहरणों से सीखने, नियमित अभ्यास करने और अपने ज्ञान का उचित उपयोग करने की सीख मिलती है।`;
  return [
    {position:1,item_type:'qa',question:`${topic} से आप क्या समझते हैं?`,answer:def},
    {position:2,item_type:'qa',question:`${topic} का अभ्यास करते समय किन बातों का ध्यान रखना चाहिए?`,answer:lesson},
    {position:3,item_type:'notes',question:`${topic} — Revision Notes`,answer:noteFor(subject,topic)}
  ];
}
async function insertRows(client, table, columns, rows, returning='', chunkSize=250){
  if(!rows.length)return [];
  const out=[];
  for(let start=0;start<rows.length;start+=chunkSize){
    const chunk=rows.slice(start,start+chunkSize);const values=[];const tuples=[];
    for(const row of chunk){const marks=[];for(const value of row){values.push(value);marks.push(`$${values.length}`);}tuples.push(`(${marks.join(',')})`);}
    const sql=`INSERT INTO ${table} (${columns.join(',')}) VALUES ${tuples.join(',')}${returning?` RETURNING ${returning}`:''}`;
    const result=await client.query(sql,values);if(returning)out.push(...result.rows);
  }
  return out;
}

async function ensureDemoSeed(pool){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(88671231)');
    let tr=await client.query("SELECT * FROM teachers WHERE demo_key='easyway-learn-public-demo-v1' LIMIT 1");
    let teacher=tr.rows[0];
    if(!teacher){
      let email=`easyway-demo-${crypto.randomBytes(6).toString('hex')}@example.invalid`;
      const pass=crypto.randomBytes(32).toString('hex');
      tr=await client.query("INSERT INTO teachers(name,email,password_hash,is_demo,demo_key,last_login_date) VALUES($1,$2,$3,TRUE,$4,$5) RETURNING *",['Demo Teacher',email,pass,'easyway-learn-public-demo-v1',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())]);
      teacher=tr.rows[0];
    }
    const existing=await client.query('SELECT COUNT(*)::int AS n FROM students WHERE teacher_id=$1',[teacher.id]);
    if(Number(existing.rows[0].n)>0){await client.query('COMMIT');return teacher;}

    const studentRows=await insertRows(client,'students',['teacher_id','name','class_name','phone'],STUDENTS.map(s=>[teacher.id,s.name,'6 (UP Board)',s.phone]),'*',50);
    const subjectRows=await insertRows(client,'subjects',['teacher_id','name'],SUBJECTS.map(s=>[teacher.id,s.name]),'*',50);
    const subjectByName=new Map(subjectRows.map(s=>[s.name,s]));
    const bookSpecs=[];
    for(const subject of SUBJECTS){
      const sub=subjectByName.get(subject.name);
      bookSpecs.push({subject,subjectId:sub.id,bookNo:1,name:`भाग 1 — ${subject.name} (Demo)`});
      bookSpecs.push({subject,subjectId:sub.id,bookNo:2,name:`भाग 2 — ${subject.name} (Demo)`});
    }
    const bookRows=await insertRows(client,'books',['subject_id','name'],bookSpecs.map(b=>[b.subjectId,b.name]),'*',50);
    const specByBookName=new Map(bookSpecs.map(b=>[b.name,b]));
    const chapterSpecs=[];
    for(const book of bookRows){
      const spec=specByBookName.get(book.name);
      const topicStart=(spec.bookNo-1)*9;
      for(let i=0;i<9;i++){
        const topic=spec.subject.topics[topicStart+i];
        const paras=contentFor(spec.subject,topic,spec.bookNo,i+1);
        chapterSpecs.push({bookId:book.id,subject:spec.subject,topic,bookNo:spec.bookNo,chapterNo:i+1,paragraphs:paras,completeText:paras.join('\n\n')});
      }
    }
    const chapterRows=await insertRows(client,'chapters',['book_id','name','complete_text'],chapterSpecs.map(c=>[c.bookId,c.topic,c.completeText]),'id,book_id,name',150);
    const chapterSpecByKey=new Map(chapterSpecs.map(c=>[`${c.bookId}|${c.topic}`,c]));
    const chapterById=new Map(chapterRows.map(c=>[Number(c.id),{...chapterSpecByKey.get(`${c.book_id}|${c.name}`),id:Number(c.id)}]));
    const paraRowsToInsert=[];
    const qaRowsToInsert=[];
    for(const chapter of chapterRows){
      const spec=chapterById.get(Number(chapter.id));
      spec.paragraphIds=[];spec.qaIds=[];spec.noteIds=[];
      spec.paragraphs.forEach((text,idx)=>paraRowsToInsert.push([chapter.id,idx+1,text]));
      for(const q of questionRows(spec.subject,spec.topic,spec.paragraphs))qaRowsToInsert.push([chapter.id,q.position,q.question,q.answer,q.item_type]);
    }
    const paraRows=await insertRows(client,'paragraphs',['chapter_id','position','text'],paraRowsToInsert,'id,chapter_id,position,text',250);
    const paraByChapter=new Map();
    for(const p of paraRows){const k=Number(p.chapter_id);if(!paraByChapter.has(k))paraByChapter.set(k,[]);paraByChapter.get(k).push(p);}
    for(const [id,arr] of paraByChapter){arr.sort((a,b)=>a.position-b.position);chapterById.get(id).paragraphIds=arr.map(x=>Number(x.id));}
    const qaRows=await insertRows(client,'qa_items',['chapter_id','position','question','answer','item_type'],qaRowsToInsert,'id,chapter_id,position,item_type,question,answer',250);
    const qaByChapter=new Map();
    for(const q of qaRows){const k=Number(q.chapter_id);if(!qaByChapter.has(k))qaByChapter.set(k,[]);qaByChapter.get(k).push(q);}
    for(const [id,arr] of qaByChapter){const spec=chapterById.get(id);for(const q of arr){if(q.item_type==='notes')spec.noteIds.push(Number(q.id));else spec.qaIds.push(Number(q.id));}}

    const attempts=[];
    for(const student of studentRows){
      for(const chapter of chapterRows){
        const spec=chapterById.get(Number(chapter.id));
        const pRows=paraByChapter.get(Number(chapter.id))||[];
        const qRows=(qaByChapter.get(Number(chapter.id))||[]).filter(q=>q.item_type==='qa');
        const nRows=(qaByChapter.get(Number(chapter.id))||[]).filter(q=>q.item_type==='notes');
        const items=[];
        for(const p of pRows)items.push({type:'paragraph',itemId:Number(p.id),text:p.text});
        for(const q of qRows)items.push({type:'qa',itemId:Number(q.id),text:q.answer});
        for(const n of nRows)items.push({type:'notes',itemId:Number(n.id),text:n.answer});
        items.push({type:'chapter',itemId:null,text:spec.completeText.replace(/\n\n/g,' ')});
        for(const item of items){
          const ws=words(item.text);const total=ws.length;if(!total)continue;
          const pct=safeRandomInt(48,100);const correct=Math.max(1,Math.min(total,Math.round(total*pct/100)));
          const matched=choosePositions(total,correct);const actualPct=Math.round((correct/total)*10000)/100;
          const spoken=matched.map(i=>ws[i]).join(' ');
          const daysAgo=safeRandomInt(0,13);const date=new Date(Date.now()-daysAgo*86400000-safeRandomInt(0,86399)*1000).toISOString();
          attempts.push([teacher.id,student.id,Number(chapter.id),item.type,item.itemId,total,correct,actualPct,actualPct>=80,spoken,item.text,JSON.stringify(matched),'[]',date]);
        }
      }
    }
    await insertRows(client,'test_results',['teacher_id','student_id','chapter_id','test_type','item_id','total_words','correct_words','score_percent','passed','spoken_text','reference_text','matched_word_indexes','manual_word_indexes','created_at'],attempts,'',200);
    await client.query('COMMIT');
    return teacher;
  }catch(err){try{await client.query('ROLLBACK');}catch{}throw err;}finally{client.release();}
}
module.exports={ensureDemoSeed};
