const root=document.getElementById('app');
let token=localStorage.getItem('token');
let state={teacher:null,students:[],content:[],results:[]};
let recognition=null;
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
// Formula/OCR helpers.  The original source text is kept for normal paragraphs; formula lines
// get a display-safe mathematical representation while a plain-text fallback is retained for
// speech/testing.  This is intentionally client-side: no book image is uploaded to the server.
const COMMON_FORMULA_CANONICALS=[
  [/(?:^|\b)Molarity\s*\(\s*M\s*\)/i,'M = \\frac{w \\times 1000}{M \\times V}'],
  [/(?:^|\b)Normality\s*\(\s*N\s*\)/i,'N = \\frac{w \\times 1000}{E \\times V}'],
  [/(?:^|\b)Molality\s*\(\s*m\s*\)/i,'m = \\frac{n \\times 1000}{W}'],
  [/(?:^|\b)Mole\s+Fraction\s*\(\s*x\s*\)/i,'x_A = \\frac{n_A}{n_A + n_B}'],
  [/(?:^|\b)Raoult[’\']s\s+Law/i,'P_A = x_A \\cdot P_A^0'],
  [/(?:^|\b)Osmotic\s+Pressure/i,'\\pi = CRT'],
  [/(?:^|\b)Rate\s+of\s+Reaction/i,'Rate = -\\frac{\\Delta[R]}{\\Delta t}'],
  [/(?:^|\b)First\s+Order\s+Rate\s+Law/i,'k = \\frac{2.303}{t}\\log\\frac{[A]_0}{[A]}'],
  [/(?:^|\b)Arrhenius\s+Equation/i,'k = Ae^{-\\frac{E_a}{RT}}'],
  [/(?:^|\b)Nernst\s+Equation/i,'E = E^0 - \\frac{0.0591}{n}\\log Q'],
  [/(?:^|\b)Gibbs\s+Free\s+Energy/i,'\\Delta G = \\Delta H - T\\Delta S,\\quad \\text{also}\\quad \\Delta G = -nFE_{cell}'],
  [/(?:^|\b)Equilibrium\s+Constant/i,'K_c = \\frac{[Products]}{[Reactants]}'],
  [/(?:^|\b)pH\s*:/i,'pH = -\\log[H^+]'],
  [/(?:^|\b)Faraday[’\']s\s+Law/i,'W = \\frac{EIt}{96500}'],
  [/(?:^|\b)Depression\s+in\s+Freezing\s+Point/i,'\\Delta T_f = K_f \\cdot m'],
  [/(?:^|\b)Elevation\s+in\s+Boiling\s+Point/i,'\\Delta T_b = K_b \\cdot m'],
  [/(?:^|\b)Henry[’\']s\s+Law/i,'P = k_H \\cdot x'],
  [/(?:^|\b)(?:I|l)onic\s+Product\s+of\s+Water/i,'K_w = [H^+][OH^-] = 10^{-14}'],
  [/(?:^|\b)Solubility\s+Product/i,'K_{sp} = [A^+][B^-] \\quad \\text{for } AB \\rightarrow A^+ + B^-'],
  [/(?:^|\b)(?:Van|h)\s*[’\']?t\s+Hoff\s+Factor/i,'i = \\frac{Observed}{Calculated}'],
  [/(?:^|\b)Hess[’\']s\s+Law/i,'\\Delta H = \\sum \\Delta H_{products} - \\sum \\Delta H_{reactants}']
];
const COMMON_FORMULA_EXAMPLES=[
  '4.9 g H₂SO₄ in 1 L → M = 0.05 M',
  '4.9 g H₂SO₄ (E = 49) in 1 L → N = 0.1 N',
  '1 mol in 1000 g solvent → m = 1 mol/kg',
  'A = 1 mol, B = 2 mol → x_A = 1/3',
  'x_A = 0.2, P_A^0 = 100 mm → P_A = 20 mm',
  'C = 0.1, R = 0.0821, T = 300 → π = 2.46 atm',
  'Δ[R] = 0.1, t = 10 → Rate = 0.01 mol/L·s',
  '[A]₀ = 1, [A] = 0.5, t = 693 → k ≈ 0.001 s⁻¹',
  '',
  'n = 2, Q = 10 → E = E⁰ − 0.02955',
  '', '',
  '[H⁺] = 10⁻³ → pH = 3',
  'I = 2 A, t = 965 s, E = 1 g eq → W = 2 g',
  '', '', '', '', '', '', ''
];
function canonicalFormulaForLine(line){
  const raw=String(line??'');
  for(const [re,formula] of COMMON_FORMULA_CANONICALS) if(re.test(raw)) return formula;
  return '';
}
function formulaTitleInfo(line){
  const raw=String(line??'');
  for(let i=0;i<COMMON_FORMULA_CANONICALS.length;i++){
    const [re,formula]=COMMON_FORMULA_CANONICALS[i];
    const m=raw.match(re);
    if(m) return {formula,index:m.index??0,number:i};
  }
  return null;
}
function splitFormulaTail(raw){
  const pipe=String(raw??'').indexOf('|');
  return pipe>=0?{body:String(raw).slice(0,pipe).trim(),tail:String(raw).slice(pipe).trim()}:{body:String(raw??'').trim(),tail:''};
}
function repairFormulaExampleTail(tail){
  let x=String(tail??'');
  x=x.replace(/H\s*(?:_\s*)?\{?2\}?\s*[*×]?\s*S\s*[*×]?\s*O\s*(?:_\s*)?\{?4\}?/gi,'H₂SO₄');
  x=x.replace(/\bchi\s*A\b/gi,'χ_A').replace(/\bchi\s*\{?A\}?/gi,'χ_A');
  x=x.replace(/\bpi\s*=/gi,'π =').replace(/\bDelta\s*([A-Za-z])/g,'Δ$1').replace(/\bsum\b/gi,'Σ');
  x=x.replace(/\b([A-Za-z])\s*\^\s*\{?([+-]?\d+)\}?/g,'$1^$2').replace(/\b([A-Za-z])\s*_\s*\{?([A-Za-z0-9]+)\}?/g,'$1_$2');
  return x.replace(/\s{2,}/g,' ').trim();
}
function normalizeKnownFormulaPrefix(prefix){
  let x=String(prefix??'').trim();
  x=x.replace(/\b[lI]onic\s+Product\s+of\s+Water\b/i,'Ionic Product of Water');
  x=x.replace(/\b(?:van|h)\s*[’']?t\s+Hoff\s+Factor\b/i,"van't Hoff Factor");
  return x;
}
const CANONICAL_FORMULA_TITLES=[
  'Molarity (M)','Normality (N)','Molality (m)','Mole Fraction (x)',
  "Raoult's Law",'Osmotic Pressure','Rate of Reaction','First Order Rate Law',
  'Arrhenius Equation','Nernst Equation','Gibbs Free Energy','Equilibrium Constant',
  'pH',"Faraday’s Law",'Depression in Freezing Point','Elevation in Boiling Point',
  "Henry's Law",'Ionic Product of Water','Solubility Product',"van't Hoff Factor","Hess's Law"
];
function canonicalizeKnownFormulaLine(line){
  const raw=String(line??'');
  const info=formulaTitleInfo(raw);
  if(!info) return repairGenericFormulaLine(raw);
  const numMatch=raw.match(/^\s*(\d{1,2})[.)]?\s*/);
  const title=CANONICAL_FORMULA_TITLES[info.number]||normalizeKnownFormulaPrefix(raw.slice(0,Math.max(0,info.index)).trim());
  const prefix=numMatch?`${Number(numMatch[1])}. ${title}:`:`${title}:`;
  const example=COMMON_FORMULA_EXAMPLES[info.number]||'';
  return `${prefix} ${info.formula}${example?` | ${example}`:''}`.trim();
}
function looksLikeFormulaNoisePrefix(text){
  const x=String(text??'').trim(),words=x.split(/\s+/).filter(Boolean);
  if(!x||words.length>10||x.length>90)return false;
  if(!/[0-9=×÷+*/^_]|\bx\b/.test(x))return false;
  return !/\b(?:the|and|law|pressure|constant|factor|equation|reaction|point|energy|example|given|where|calculate|formula|means|is|are|of|for)\b/i.test(x);
}
const KNOWN_FORMULA_HEADING_RE=/(?:^|\s)(\d{1,2})[.)]?\s*(?:Molarity\s*\(\s*M\s*\)|Normality\s*\(\s*N\s*\)|Molality\s*\(\s*m\s*\)|Mole\s+Fraction\s*\(\s*x\s*\)|Raoult[’']s\s+Law|Osmotic\s+Pressure|Rate\s+of\s+Reaction|First\s+Order\s+Rate\s+Law|Arrhenius\s+Equation|Nernst\s+Equation|Gibbs\s+Free\s+Energy|Equilibrium\s+Constant|pH\s*:|Faraday[’']s\s+Law|Depression\s+in\s+Freezing\s+Point|Elevation\s+in\s+Boiling\s+Point|Henry[’']s\s+Law|(?:I|l)onic\s+Product\s+of\s+Water|Solubility\s+Product|(?:Van|h)[’']?t\s+Hoff\s+Factor|Hess[’']s\s+Law)/gi;
function findKnownFormulaMarks(raw){
  const marks=[];const re=new RegExp(KNOWN_FORMULA_HEADING_RE.source,KNOWN_FORMULA_HEADING_RE.flags);let m;
  while((m=re.exec(raw))){
    let start=m.index;
    if(start<raw.length && /\s/.test(raw[start]))start++;
    marks.push(start);
    if(m[0].length===0)re.lastIndex++;
  }
  return marks;
}
function splitKnownFormulaChunks(text){
  const raw=String(text??'').replace(/\r/g,'').trim();if(!raw)return [];
  const marks=findKnownFormulaMarks(raw);
  if(!marks.length)return [raw];
  const chunks=[];
  if(marks[0]>0){const prefix=raw.slice(0,marks[0]).trim();if(prefix&&!looksLikeFormulaNoisePrefix(prefix))chunks.push(prefix);}
  for(let i=0;i<marks.length;i++){const a=marks[i],b=i+1<marks.length?marks[i+1]:raw.length;const chunk=raw.slice(a,b).trim();if(chunk)chunks.push(chunk);}
  return chunks;
}
function canonicalizeKnownFormulaText(text){
  const raw=String(text??'').replace(/\r/g,'').trim();if(!raw)return '';
  const chunks=splitKnownFormulaChunks(raw),out=[];
  const nums=chunks.map(c=>{const m=String(c).match(/^\s*(\d{1,2})[.)]?\s*/);return m?Number(m[1]):null;});
  const have20=nums.includes(20);
  const infer20=!have20 && nums.includes(19) && nums.includes(21) && /\bCalculated\b/i.test(raw);
  for(let i=0;i<chunks.length;i++){
    const chunk=chunks[i],num=nums[i];
    if(infer20&&num===21)out.push("20. van't Hoff Factor: i = \\frac{Observed}{Calculated}");
    const subChunks=splitKnownFormulaChunks(chunk);
    if(subChunks.length>1){
      for(const part of subChunks){const info=formulaTitleInfo(part);out.push(info?canonicalizeKnownFormulaLine(part):repairGenericFormulaLine(part));}
    }else{
      const info=formulaTitleInfo(chunk);out.push(info?canonicalizeKnownFormulaLine(chunk):repairGenericFormulaLine(chunk));
    }
  }
  return out.join('\n').replace(/\n{3,}/g,'\n\n').trim();
}
function canonicalFormulaCopyLine(line){
  const raw=String(line??'').trim();if(!raw)return '';
  const colon=raw.indexOf(':');if(colon<0)return raw;
  const info=formulaTitleInfo(raw);if(!info)return raw;
  const left=raw.slice(0,colon+1).trim();
  const pipe=raw.indexOf('|',colon+1);
  const formula=raw.slice(colon+1,pipe>=0?pipe:raw.length).trim();
  const tail=pipe>=0?raw.slice(pipe+1).trim():'';
  const plainFormula=formulaBodyPlain(formula);
  const plainTail=tail?formulaBodyPlain(tail):'';
  return `${left} ${plainFormula}${plainTail?` | ${plainTail}`:''}`.trim();
}
function formulaAwareClipboardText(text){
  const raw=String(text??'').replace(/\r/g,'');
  const canonical=canonicalizeKnownFormulaText(raw);if(!canonical)return '';
  return canonical.split('\n').map(canonicalFormulaCopyLine).join('\n').replace(/\n{3,}/g,'\n\n').trim();
}

function replaceTexFractionsForPlain(input){
  const src=String(input??'');let out='',i=0;
  while(i<src.length){
    const at=src.indexOf('\\frac',i);
    if(at<0){out+=src.slice(i);break;}
    out+=src.slice(i,at);
    let pos=at+5;while(/\s/.test(src[pos]||''))pos++;
    const a=takeBracedGroup(src,pos);
    if(!a){out+='\\frac';i=at+5;continue;}
    pos=a.end;while(/\s/.test(src[pos]||''))pos++;
    const b=takeBracedGroup(src,pos);
    if(!b){out+='\\frac'+src.slice(at+5,a.end);i=a.end;continue;}
    out+=`(${replaceTexFractionsForPlain(a.value)})/(${replaceTexFractionsForPlain(b.value)})`;
    i=b.end;
  }
  return out;
}
function formulaBodyPlain(formula){
  let s=String(formula??'');
  // Replace nested fractions structurally, including fractions containing subscripts.
  s=replaceTexFractionsForPlain(s);
  s=s.replace(/\\log\s*\(([^()]*)\)\s*\/\s*\(([^()]*)\)/g,'log(($1)/($2))')
    .replace(/\\ln\s*\(([^()]*)\)\s*\/\s*\(([^()]*)\)/g,'ln(($1)/($2))');
  s=s.replace(/\\sqrt\s*\{([^{}]*)\}/g,'sqrt($1)').replace(/\\text\s*\{([^{}]*)\}/g,'$1').replace(/\\mathrm\s*\{([^{}]*)\}/g,'$1').replace(/\\operatorname\s*\{([^{}]*)\}/g,'$1');
  s=s.replace(/\\(?:left|right)\b/g,'').replace(/\\(?:displaystyle|textstyle|quad|qquad)\b/g,' ')
    .replace(/\\times\b/g,'×').replace(/\\cdot\b|\\cdotp\b/g,'·').replace(/\\div\b/g,'÷')
    .replace(/\\rightarrow\b/g,'→').replace(/\\leftarrow\b/g,'←').replace(/\\approx\b/g,'≈')
    .replace(/\\Delta\b/g,'Δ').replace(/\\delta\b/g,'δ').replace(/\\pi\b/g,'π').replace(/\\Sigma\b|\\sum\b/g,'Σ')
    .replace(/\\chi\b/g,'χ').replace(/\\mu\b/g,'μ').replace(/\\lambda\b/g,'λ').replace(/\\Omega\b/g,'Ω')
    .replace(/\\log\b/g,'log').replace(/\\ln\b/g,'ln').replace(/\\sin\b/g,'sin').replace(/\\cos\b/g,'cos').replace(/\\tan\b/g,'tan')
    .replace(/[{}]/g,'');
  return s.replace(/\)(?=log\()/g, ') ').replace(/\s+/g,' ').trim();
}
function repairGenericFormulaLine(line){
  let x=String(line??'').replace(/[−–—]/g,'-').replace(/→/g,'→');
  x=x.replace(/\s*[—–-]+>\s*/g,' → ').replace(/\s*=>\s*/g,' → ');
  x=x.replace(/(?<!\\)\b(?:Delta|DELTA)\b/g,'Δ').replace(/(?<!\\)\b(?:sum|SUM)\b/g,'Σ');
  x=x.replace(/(?<!\\)\bchi\s*(?=\^|_|\{)/gi,'χ').replace(/(?<!\\)\bpi\s*(?==|\^|_|\[)/gi,'π');
  x=x.replace(/\bH\s*[,;]\s*S\s*[,;]?\s*O\s*[,;]\s*([0-9])\b/g,'H₂SO₄');
  x=x.replace(/\bH[, ]*2\s*S[O0][, ]*4\b/gi,'H₂SO₄');
  x=x.replace(/\b([A-Za-z])\s*\*\s*([A-Za-z0-9])/g,'$1 × $2');
  x=x.replace(/\b(0\.0591|2\.303)\s+\/\s+([A-Za-z0-9]+)/g,'$1/$2');
  return x.replace(/\s{2,}/g,' ').trim();
}
function repairOcrFormulaLine(line){
  const raw=String(line??'');
  const known=canonicalFormulaForLine(raw);
  if(known) return canonicalizeKnownFormulaLine(raw);
  if(!looksLikeFormulaLine(raw)) return raw;
  const colon=raw.indexOf(':');
  if(colon>0&&colon<100){
    const prefix=raw.slice(0,colon+1),rest=raw.slice(colon+1),{body,tail}=splitFormulaTail(rest);
    return `${prefix} ${repairGenericFormulaLine(body)}${tail?` ${repairFormulaExampleTail(tail)}`:''}`.trim();
  }
  return repairGenericFormulaLine(raw);
}
function formulaTextToTeX(s){
  let x=String(s??'').trim();
  x=repairGenericFormulaLine(x);
  // Keep already structured LaTeX groups intact, but normalize common OCR spellings.
  // Normalize both spelled-out and Unicode scientific symbols without doubling
  // an already-present TeX command (e.g. \pi must stay \pi).
  x=x.replace(/(?<!\\)\bDelta\b/g,'\\Delta').replace(/(?<!\\)\b(?:Sigma|sum)\b/g,'\\Sigma')
    .replace(/(?<!\\)\bpi\b/g,'\\pi').replace(/(?<!\\)\bchi\b/g,'\\chi')
    .replace(/(?<!\\)\bmu\b/g,'\\mu').replace(/(?<!\\)\blambda\b/g,'\\lambda')
    .replace(/(?<!\\)\bOmega\b/g,'\\Omega')
    .replace(/[Δ]/g,'\\Delta').replace(/[Σ∑]/g,'\\Sigma').replace(/π/g,'\\pi')
    .replace(/χ/g,'\\chi').replace(/μ/g,'\\mu').replace(/λ/g,'\\lambda').replace(/Ω/g,'\\Omega');
  // Common OCR spelling of square-root notation.
  x=x.replace(/\bsqrt\s*\(([^()]*)\)/gi,'\\sqrt{$1}').replace(/√\s*\(?([^()\s]+)\)?/g,'\\sqrt{$1}');
  // Normalize simple superscript/subscript tokens into complete groups.
  x=x.replace(/\^\s*\{([^{}]+)\}/g,'^{$1}').replace(/_\s*\{([^{}]+)\}/g,'_{$1}')
    .replace(/\^\s*([A-Za-z0-9+\-]+)/g,'^{$1}')
    .replace(/_\s*([A-Za-z0-9]+)/g,'_{$1}');
  // Textbook chemistry/science notation: H2, SO4, Ksp, etc.
  x=x.replace(/([A-Za-z])([0-9]+)/g,'$1_{$2}')
    .replace(/\bK\s*([a-z]{1,3})\b/g,(_,sub)=>`K_{${sub}}`);
  // Common ionic charges are genuine superscripts; restrict this to chemistry tokens
  // so ordinary A+B expressions are not changed.
  x=x.replace(/\b(OH|NH|H|Na|K|Ca|Mg|Cl|Br|F|Ag|Cu|Fe|Al|Zn|e)\s*([+-])\b/g,'$1^{$2}');
  x=x.replace(/×/g,'\\times ').replace(/÷/g,'\\div ')
    .replace(/→/g,'\\rightarrow ').replace(/←/g,'\\leftarrow ').replace(/≈/g,'\\approx ');

  // Turn a simple textbook fraction into a real fraction. This covers both
  // "x = a / b" and a standalone "a / b" while leaving multi-slash prose alone.
  if(!/\\frac\s*\{/.test(x)){
    const eqSlash=x.match(/^(.*?=\s*)([^/]+?)\s*\/\s*([^/]+?)\s*$/);
    if(eqSlash) return `${eqSlash[1]}\\frac{${eqSlash[2].trim()}}{${eqSlash[3].trim()}}`;
    const standalone=x.match(/^([^/\s]+(?:\s*[×*]\s*[^/\s]+)?)\s*\/\s*([^/\s]+(?:\s*[×*]\s*[^/\s]+)?)$/);
    if(standalone) return `\\frac{${standalone[1].trim()}}{${standalone[2].trim()}}`;
  }
  return x;
}
function takeBracedGroup(src,start){
  if(src[start]!=='{')return null;let depth=0;
  for(let i=start;i<src.length;i++){
    if(src[i]==='{')depth++;else if(src[i]==='}'&&--depth===0)return {value:src.slice(start+1,i),end:i+1};
  }
  return null;
}
function renderFormulaFragment(input,depth=0){
  const src=String(input??'');if(depth>24)return esc(src);let i=0,out='';
  const greek={Delta:'Δ',delta:'δ',pi:'π',Sigma:'Σ',sum:'Σ',chi:'χ',mu:'μ',lambda:'λ',Omega:'Ω',alpha:'α',beta:'β',gamma:'γ'};
  const ops={times:'×',cdot:'·',cdotp:'·',div:'÷',rightarrow:'→',leftarrow:'←',approx:'≈',le:'≤',ge:'≥',quad:' ',qquad:' '};
  while(i<src.length){
    if(src.startsWith('\\frac',i)){
      const a=takeBracedGroup(src,i+5);const b=a&&takeBracedGroup(src,a.end);
      if(a&&b){out+=`<span class="math-frac"><span class="math-frac-top">${renderFormulaFragment(a.value,depth+1)}</span><span class="math-frac-bottom">${renderFormulaFragment(b.value,depth+1)}</span></span>`;i=b.end;continue;}
    }
    if(src.startsWith('\\sqrt',i)){
      const a=takeBracedGroup(src,i+5);if(a){out+=`<span class="math-sqrt">√<span class="math-sqrt-body">${renderFormulaFragment(a.value,depth+1)}</span></span>`;i=a.end;continue;}
    }
    if(src[i]==='\\'){
      let j=i+1;while(j<src.length&&/[A-Za-z]/.test(src[j]))j++;const cmd=src.slice(i+1,j);
      if(greek[cmd]||ops[cmd]){out+=esc(greek[cmd]||ops[cmd]);i=j;continue;}
      if(['text','mathrm','mathbf','operatorname'].includes(cmd)){
        const a=takeBracedGroup(src,j);if(a){out+=`<span class="math-text">${esc(a.value)}</span>`;i=a.end;continue;}
      }
      if(j>i+1){out+=esc(cmd);i=j;continue;}out+='\\';i++;continue;
    }
    if(src[i]==='^'||src[i]==='_'){
      const tag=src[i]==='^'?'sup':'sub';i++;let value='';
      if(src[i]==='{'){const a=takeBracedGroup(src,i);if(a){value=renderFormulaFragment(a.value,depth+1);i=a.end;}}
      else if(i<src.length){value=esc(src[i++]);}
      if(value)out+=`<${tag}>${value}</${tag}>`;else out+=src[i-1]||'';continue;
    }
    const superMap={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'},subMap={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
    if(superMap[src[i]]){let j=i,q='';while(j<src.length&&superMap[src[j]])q+=superMap[src[j++]];out+=`<sup>${esc(q)}</sup>`;i=j;continue;}
    if(subMap[src[i]]){let j=i,q='';while(j<src.length&&subMap[src[j]])q+=subMap[src[j++]];out+=`<sub>${esc(q)}</sub>`;i=j;continue;}
    out+=esc(src[i++]);
  }
  return out;
}
function formulaExampleTailToHtml(tail){
  let x=String(tail??'');
  // Render negative scientific exponents explicitly instead of relying on the
  // device font's Unicode superscript glyphs (some Android fonts drop the minus).
  const superDigits={'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
  const supToAscii=value=>String(value??'').split('').map(ch=>superDigits[ch]??ch).join('');
  x=x.replace(/10\s*([⁻−-])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+|\d+)/g,(_,minus,digits)=>`10<sup class="formula-exp">−${supToAscii(digits)}</sup>`);
  x=x.replace(/([A-Za-z])\s*([⁻−-])\s*([⁰¹²³⁴⁵⁶⁷⁸⁹]+|\d+)/g,(_,base,minus,digits)=>`${esc(base)}<sup class="formula-exp">−${supToAscii(digits)}</sup>`);
  x=x.replace(/10\s*\^\s*\{\s*-\s*(\d+)\s*\}/g,(_,digits)=>`10<sup class="formula-exp">−${digits}</sup>`);
  return x;
}
function formulaTextToMathML(text){
  const tex=formulaTextToTeX(text);if(!tex||!/[A-Za-z0-9ΔδπΣχμλΩ]/.test(tex))return '';
  return `<span class="formula-math" aria-label="${esc(formulaBodyPlain(tex))}">${renderFormulaFragment(tex)}</span>`;
}
function looksLikeFormulaLine(line){const x=String(line??'').trim();if(canonicalFormulaForLine(x))return true;const words=x.split(/\s+/).filter(Boolean).length;const symbols=/(?:=|×|÷|->|→|←|\b(?:log|ln|sin|cos|tan|sqrt|lim|sum|frac|Delta|Sigma|pi|chi|mu|lambda|Omega)\b|[ΔδπΣ∑∞χμλΩαβγ]|[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]|\\frac|\\sum|\\Delta|\\pi|\^|_)/i.test(x);const slash=/[A-Za-z0-9\)\]]\s*\/\s*[A-Za-z0-9\(\[]/.test(x);return words<=45&&(symbols||slash);}
function ocrLineToRichHtml(line){
  const raw=String(line??'');if(!raw.trim())return '<br>';
  const repaired=repairOcrFormulaLine(raw);
  if(!looksLikeFormulaLine(repaired))return esc(repaired);
  const colon=repaired.indexOf(':');let prefix='',body=repaired,tail='';
  if(colon>0&&colon<100){prefix=repaired.slice(0,colon+1);body=repaired.slice(colon+1);}
  const pipe=body.indexOf('|');if(pipe>=0){tail=body.slice(pipe);body=body.slice(0,pipe);}
  const math=formulaTextToMathML(body.trim());
  if(!math)return esc(repaired);
  const speech=formulaBodyPlain(body.trim());
  const tailHtml=tail?` <span class="formula-example">${formulaExampleTailToHtml(esc(tail))}</span>`:'';
  return `${esc(prefix)} <span class="formula-source" data-ewl-speech="${esc(speech)}">${math}</span>${tailHtml}`;
}
function ocrTextToRichHtml(text){return String(text??'').replace(/\r/g,'').split('\n').map(ocrLineToRichHtml).join('\n');}
function renderMathParagraph(value){
  const text=canonicalizeKnownFormulaText(String(value??''));return text.split(/(\r?\n)/).map(line=>/^\r?\n$/.test(line)?line:ocrLineToRichHtml(line)).join('').replace(/\n/g,'<br>');
}

const RICH_PREFIX='[[EWL_RICH_HTML]]\n';

function isRichParagraph(value){return String(value??'').startsWith(RICH_PREFIX)}
function richPayload(value){return isRichParagraph(value)?String(value).slice(RICH_PREFIX.length):''}
function sanitizeRichHtml(input){
  const raw=String(input??'');
  const doc=new DOMParser().parseFromString(raw,'text/html');
  const allowed=new Set(['DIV','P','BR','SPAN','B','STRONG','I','EM','U','SUB','SUP','S','MARK','UL','OL','LI','TABLE','TBODY','THEAD','TR','TD','TH','MATH','MROW','MI','MN','MO','MS','MSUP','MSUB','MSUBSUP','MFRAC','MSQRT','MROOT','MTEXT','MSTYLE','MFENCED','MPADDED','MENCLOSE','MUNDER','MOVER','MUNDEROVER','ANNOTATION','SEMANTICS','SVG','PATH','IMG']);
  const walk=node=>{
    for(const child of [...node.children]){
      if(!allowed.has(child.tagName)){
        const frag=doc.createDocumentFragment(); while(child.firstChild) frag.appendChild(child.firstChild); child.replaceWith(frag); continue;
      }
      [...child.attributes].forEach(a=>{
        const n=a.name.toLowerCase(), v=a.value;
        if(n==='style'){
          const safe=v.split(';').map(x=>x.trim()).filter(x=>/^(vertical-align|font-(size|style|weight|family)|text-(align|decoration)|display|white-space)\s*:/i.test(x)).join(';');
          if(safe) child.setAttribute('style',safe); else child.removeAttribute('style');
        } else if(n==='class' && /^(math|math-inline|math-display|formula|ocr-book-line|ocr-book-line-text|ocr-formula-line-image)/i.test(v)){} 
        else if((child.namespaceURI||'').includes('MathML') && ['display','displaystyle','scriptlevel','mathvariant','columnalign','rowalign','stretchy','form'].includes(n)){} 
        else if((child.tagName==='PATH' && n==='d')){} 
        else if(n==='src'){ if(child.tagName==='IMG' && /^data:image\/(?:png|jpe?g|webp|gif);base64,/i.test(v)){} else child.removeAttribute(a.name); } else if(n==='alt' && child.tagName==='IMG'){} else if(n.startsWith('on') || n==='href' || n==='id' || (n.startsWith('data-') && !['data-ewl-text','data-ewl-speech'].includes(n))) child.removeAttribute(a.name);
        else if(!['class','style','display','displaystyle','scriptlevel','mathvariant','columnalign','rowalign','stretchy','form','d'].includes(n)) child.removeAttribute(a.name);
      });
      walk(child);
    }
  };
  walk(doc.body);
  return doc.body.innerHTML.trim();
}
function paragraphPlainText(value){
  const raw=String(value??'');
  if(!isRichParagraph(raw)) return raw;
  const doc=new DOMParser().parseFromString(richPayload(raw),'text/html');
  // Formula rows contain an image for visual fidelity and a hidden/plain fallback for
  // speech + scoring. Replace the visual wrapper with that fallback before extracting text.
  doc.querySelectorAll('.ocr-book-line').forEach(line=>{
    const hidden=line.querySelector('.ocr-book-line-text');
    const speech=hidden?.getAttribute('data-ewl-text')||hidden?.textContent||line.getAttribute('data-ewl-speech')||line.textContent||'';
    line.replaceWith(doc.createTextNode(speech));
  });
  doc.querySelectorAll('.formula-source').forEach(el=>{
    const speech=el.getAttribute('data-ewl-speech')||formulaBodyPlain(el.textContent||'');
    el.replaceWith(doc.createTextNode(speech));
  });
  doc.querySelectorAll('br').forEach(br=>br.replaceWith(doc.createTextNode('\n')));
  const plain=(doc.body.textContent||'');
  return plain.replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}function clipboardPlainFromHtml(html){
  const raw=String(html??'');
  return formulaAwareClipboardText(paragraphPlainText(RICH_PREFIX+raw));
}
function renderStoredParagraph(value){
  const raw=String(value??'');
  if(!isRichParagraph(raw)) return renderMathParagraph(raw);
  return sanitizeRichHtml(richPayload(raw));
}
function richEditorHtml(value){
  const raw=String(value??'');
  return isRichParagraph(raw)?sanitizeRichHtml(richPayload(raw)):esc(raw).replace(/\r?\n/g,'<br>');
}
async function pasteIntoField(id){
  const el=document.getElementById(id); if(!el)return;
  const insert=(text,html='')=>{
    const source=String(text||'');
    const known=splitKnownFormulaChunks(source).filter(x=>formulaTitleInfo(x)).length>=1 || /(?:^|\s)1\.\s*Molarity\s*\(\s*M\s*\)/i.test(source);
    if(el.isContentEditable){
      if(known){document.execCommand('insertHTML',false,normalizeFormulaEditorContent(source));}
      else if(html){document.execCommand('insertHTML',false,sanitizeRichHtml(html));}
      else document.execCommand('insertText',false,source);
    }else if(el.tagName==='TEXTAREA' || el.tagName==='INPUT'){
      const value=known?canonicalizeKnownFormulaText(source):source;
      const start=el.selectionStart??el.value.length,end=el.selectionEnd??start;el.setRangeText(value,start,end,'end');
    }
    el.dispatchEvent(new Event('input',{bubbles:true})); el.focus();
  };
  try{
    const clip=await navigator.clipboard.read();
    for(const item of clip){
      if(item.types.includes('text/html')){
        const html=await (await item.getType('text/html')).text();
        const text=paragraphPlainText(RICH_PREFIX+html);
        insert(text,html); return;
      }
      if(item.types.includes('text/plain')){
        insert(await (await item.getType('text/plain')).text()); return;
      }
    }
  }catch{}
  try{insert(await navigator.clipboard.readText());}
  catch(e){alert('Clipboard से Paste नहीं हो पाया। कृपया field पर long-press करके Paste करें।');}
}
function installFormulaPasteGuard(){
  if(window.__ewlFormulaPasteGuardInstalled)return;
  window.__ewlFormulaPasteGuardInstalled=true;
  document.addEventListener('paste',e=>{
    const el=e.target?.closest?.('.rich-paragraph-editor');if(!el)return;
    const text=e.clipboardData?.getData('text/plain')||'';
    if(!text.trim())return;
    const known=splitKnownFormulaChunks(text).filter(x=>formulaTitleInfo(x)).length>=1 || /(?:^|\s)1\.\s*Molarity\s*\(\s*M\s*\)/i.test(text);
    if(!known)return;
    e.preventDefault();
    document.execCommand('insertHTML',false,normalizeFormulaEditorContent(text));
    el.dispatchEvent(new Event('input',{bubbles:true}));
  });
}

function normalizeFormulaEditorContent(htmlOrText){
  const raw=String(htmlOrText??'');
  const plain=/<[A-Za-z][^>]*>/.test(raw)?paragraphPlainText(RICH_PREFIX+raw):raw.replace(/\r/g,'');
  const canonical=canonicalizeKnownFormulaText(plain);
  const known=splitKnownFormulaChunks(plain).filter(x=>formulaTitleInfo(x)).length>=1 || /(?:^|\s)1\.\s*Molarity\s*\(\s*M\s*\)/i.test(plain);
  if(known) return renderMathParagraph(canonical);
  return sanitizeRichHtml(raw);
}
function richParagraphPayload(id){
  const el=document.getElementById(id);if(!el)return '';
  const raw=el.isContentEditable?el.innerHTML:esc(el.value||'').replace(/\r?\n/g,'<br>');
  const html=normalizeFormulaEditorContent(raw);
  return html?RICH_PREFIX+html:'';
}


function formulaEditorToolbarHtml(){
  // Universal formula/symbol palette for Maths, Physics, Chemistry and Biology.
  // Keep ordinary Android/Gboard typing in the textarea; these buttons only add
  // symbols/structures that are difficult to type from a normal mobile keyboard.
  const groups=[
    ['Structure',[
      ['\\frac{a}{b}','Fraction'],['^{x}','Superscript'],['_{x}','Subscript'],
      ['\\sqrt{x}','√ Root'],['\\sqrt[n]{x}','ⁿ√ Root'],['( )','( )'],['[ ]','[ ]'],['{ }','{ }'],
      ['|x|','|x|'],['〈x〉','〈x〉'],['⟨x⟩','⟨x⟩'],['…','…']
    ]],
    ['Greek lowercase',[
      ['α','α'],['β','β'],['γ','γ'],['δ','δ'],['ε','ε'],['ϵ','ϵ'],['ζ','ζ'],['η','η'],['θ','θ'],['ϑ','ϑ'],
      ['ι','ι'],['κ','κ'],['λ','λ'],['μ','μ'],['ν','ν'],['ξ','ξ'],['ο','ο'],['π','π'],['ϖ','ϖ'],['ρ','ρ'],
      ['ϱ','ϱ'],['σ','σ'],['ς','ς'],['τ','τ'],['υ','υ'],['φ','φ'],['ϕ','ϕ'],['χ','χ'],['ψ','ψ'],['ω','ω']
    ]],
    ['Greek uppercase',[
      ['Α','Α'],['Β','Β'],['Γ','Γ'],['Δ','Δ'],['Ε','Ε'],['Ζ','Ζ'],['Η','Η'],['Θ','Θ'],['Ι','Ι'],['Κ','Κ'],
      ['Λ','Λ'],['Μ','Μ'],['Ν','Ν'],['Ξ','Ξ'],['Ο','Ο'],['Π','Π'],['Ρ','Ρ'],['Σ','Σ'],['Τ','Τ'],['Υ','Υ'],
      ['Φ','Φ'],['Χ','Χ'],['Ψ','Ψ'],['Ω','Ω']
    ]],
    ['Math operators',[
      ['+','+'],['−','−'],['−','−'],['±','±'],['∓','∓'],['×','×'],['·','·'],['÷','÷'],['∙','∙'],['∘','∘'],
      ['∗','∗'],['⊕','⊕'],['⊖','⊖'],['⊗','⊗'],['⊙','⊙'],['∝','∝'],['√','√'],['∛','∛'],['∜','∜'],['∂','∂'],
      ['∇','∇'],['∑','∑'],['∏','∏'],['∐','∐'],['∫','∫'],['∬','∬'],['∭','∭'],['∮','∮'],['∞','∞'],['∴','∴'],['∵','∵']
    ]],
    ['Relations',[
      ['=','='],['≠','≠'],['≈','≈'],['≃','≃'],['≅','≅'],['≡','≡'],['∼','∼'],['≁','≁'],['<','<'],['>','>'],
      ['≤','≤'],['≥','≥'],['≪','≪'],['≫','≫'],['∈','∈'],['∉','∉'],['∋','∋'],['∌','∌'],['⊂','⊂'],['⊃','⊃'],
      ['⊆','⊆'],['⊇','⊇'],['∅','∅'],['∀','∀'],['∃','∃'],['∄','∄'],['¬','¬'],['∧','∧'],['∨','∨'],['⊥','⊥']
    ]],
    ['Arrows',[
      ['→','→'],['←','←'],['↔','↔'],['⇒','⇒'],['⇐','⇐'],['⇔','⇔'],['↦','↦'],['↗','↗'],['↘','↘'],['↙','↙'],
      ['↖','↖'],['↑','↑'],['↓','↓'],['⇑','⇑'],['⇓','⇓'],['⇌','⇌'],['⇋','⇋'],['⟶','⟶'],['⟷','⟷'],['⟹','⟹']
    ]],
    ['Calculus / geometry',[
      ['d/dx','d/dx'],['dy/dx','dy/dx'],['Δ','Δ'],['δ','δ'],['∂','∂'],['∇','∇'],['∠','∠'],['⊥','⊥'],['∥','∥'],
      ['°','°'],['′','′'],['″','″'],['rad','rad'],['π','π'],['∞','∞'],['⌒','⌒'],['△','△'],['□','□'],['≅','≅']
    ]],
    ['Science / Chemistry',[
      ['℃','℃'],['℉','℉'],['Å','Å'],['Å','Å'],['ℏ','ℏ'],['ℓ','ℓ'],['µ','µ'],['Ω','Ω'],['Ω·m','Ω·m'],
      ['e⁻','e⁻'],['H⁺','H⁺'],['OH⁻','OH⁻'],['⇌','⇌'],['→','→'],['↑','↑'],['↓','↓'],['·H₂O','·H₂O'],['aq','aq'],['(s)','(s)'],['(l)','(l)'],['(g)','(g)']
    ]],
    ['Superscript numbers',[
      ['⁰','⁰'],['¹','¹'],['²','²'],['³','³'],['⁴','⁴'],['⁵','⁵'],['⁶','⁶'],['⁷','⁷'],['⁸','⁸'],['⁹','⁹'],['⁺','⁺'],['⁻','⁻'],['⁽','⁽'],['⁾','⁾'],['ⁿ','ⁿ']
    ]],
    ['Subscript numbers',[
      ['₀','₀'],['₁','₁'],['₂','₂'],['₃','₃'],['₄','₄'],['₅','₅'],['₆','₆'],['₇','₇'],['₈','₈'],['₉','₉'],['₊','₊'],['₋','₋'],['₍','₍'],['₎','₎'],['ₙ','ₙ']
    ]],
    ['Common formula structures',[
      ['\\vec{x}','Vector'],['\\hat{x}','Hat'],['\\bar{x}','Bar'],['\\dot{x}','Dot'],['\\ddot{x}','Double dot'],
      ['\\overline{x}','Overline'],['\\underline{x}','Underline'],['\\binom{n}{r}','Binomial'],['\\lim_{x\to0}','Limit'],
      ['sin θ','sin θ'],['cos θ','cos θ'],['tan θ','tan θ'],['cot θ','cot θ'],['sec θ','sec θ'],['cosec θ','cosec θ'],
      ['log x','log x'],['ln x','ln x'],['e^x','e^x'],['a^x','a^x'],['10^x','10^x'],['n!','n!'],['|x|','Modulus'],
      ['Σ_{i=1}^{n}','Σ range'],['∫_{a}^{b}','Definite integral'],['dy/dx','Derivative'],['d²y/dx²','2nd derivative']
    ]],
    ['Superscript letters',[
      ['ᵃ','ᵃ'],['ᵇ','ᵇ'],['ᶜ','ᶜ'],['ᵈ','ᵈ'],['ᵉ','ᵉ'],['ᶠ','ᶠ'],['ᵍ','ᵍ'],['ʰ','ʰ'],['ⁱ','ⁱ'],['ʲ','ʲ'],
      ['ᵏ','ᵏ'],['ˡ','ˡ'],['ᵐ','ᵐ'],['ⁿ','ⁿ'],['ᵒ','ᵒ'],['ᵖ','ᵖ'],['ʳ','ʳ'],['ˢ','ˢ'],['ᵗ','ᵗ'],['ᵘ','ᵘ'],['ᵛ','ᵛ'],['ʷ','ʷ'],['ˣ','ˣ'],['ʸ','ʸ'],['ᶻ','ᶻ']
    ]],
    ['Subscript letters',[
      ['ₐ','ₐ'],['ₑ','ₑ'],['ₕ','ₕ'],['ᵢ','ᵢ'],['ⱼ','ⱼ'],['ₖ','ₖ'],['ₗ','ₗ'],['ₘ','ₘ'],['ₙ','ₙ'],['ₒ','ₒ'],['ₚ','ₚ'],['ᵣ','ᵣ'],['ₛ','ₛ'],['ₜ','ₜ'],['ᵤ','ᵤ'],['ᵥ','ᵥ'],['ₓ','ₓ'],['ᵧ','ᵧ'],['𝓏','𝓏']
    ]],
    ['Special symbols',[
      ['%','%'],['‰','‰'],['‱','‱'],['#','#'],['°','°'],['′','′'],['″','″'],['′′′','′′′'],['…','…'],['⋯','⋯'],['⋮','⋮'],
      ['∎','∎'],['√','√'],['∑','∑'],['∫','∫'],['∅','∅'],['ℝ','ℝ'],['ℤ','ℤ'],['ℚ','ℚ'],['ℕ','ℕ'],['ℂ','ℂ']
    ]]
  ];
  return groups.map(([title,items])=>`<div class="formula-tool-group"><div class="formula-tool-group-title">${esc(title)}</div><div class="formula-tool-group-buttons">${items.map(([v,label])=>`<button type="button" class="formula-tool-btn" title="${esc(label)}" data-formula-token="${esc(v)}">${esc(label)}</button>`).join('')}</div></div>`).join('');
}
let __formulaEditorTarget=null;
let __formulaEditorInsertEditor=null;
let __lastRichParagraphEditor=null;
let __formulaEditorMode='insert';
let __formulaEditorSelectionStart=0;
let __formulaEditorSelectionEnd=0;
let __formulaEditorHandledPointer=false;
function openFormulaEditor(target){
  const isFormula=target?.classList?.contains('formula-source');
  __formulaEditorTarget=isFormula?target:null;
  __formulaEditorMode=isFormula?'edit':'insert';
  const initial=isFormula?(target.getAttribute('data-ewl-speech')||formulaBodyPlain(target.textContent||'')) : '';
  let modal=document.getElementById('formulaEditorModal');
  if(!modal){
    modal=document.createElement('div');modal.id='formulaEditorModal';modal.className='formula-editor-modal';
    modal.innerHTML=`<div class="formula-editor-dialog" role="dialog" aria-modal="true" aria-labelledby="formulaEditorTitle">
      <div class="formula-editor-head"><div><b id="formulaEditorTitle">Formula Editor</b><div class="muted">Formula लिखें या नीचे दिए buttons से structure बनाएं।</div></div><button type="button" class="btn-secondary" onclick="closeFormulaEditor()">✕</button></div>
      <div class="formula-editor-preview" id="formulaEditorPreview" aria-label="Formula preview"></div>
      <textarea id="formulaEditorInput" class="formula-editor-input" rows="4" spellcheck="false" autocapitalize="off" autocomplete="off" placeholder="जैसे: \\frac{a}{b}, H_{2}SO_{4}, 10^{-3}"></textarea>
      <div class="formula-editor-tools">${formulaEditorToolbarHtml()}</div>
      <div class="formula-editor-hint">Fraction: <b>\\frac{numerator}{denominator}</b> · Superscript: <b>^{power}</b> · Subscript: <b>_{number}</b></div>
      <div class="button-row form-actions"><button type="button" onclick="applyFormulaEditor()">Save Formula</button><button type="button" class="btn-secondary" onclick="closeFormulaEditor()">Cancel</button></div>
    </div>`;
    modal.addEventListener('click',e=>{
      if(e.target===modal){closeFormulaEditor();return;}
      const btn=e.target?.closest?.('.formula-tool-btn');
      if(btn){e.preventDefault();e.stopPropagation();if(__formulaEditorHandledPointer){__formulaEditorHandledPointer=false;return;}formulaEditorInsert(btn.getAttribute('data-formula-token')||'');}
    },true);
    // Save the caret before the formula toolbar takes focus. This keeps insertion at
    // the user's exact position even when Android temporarily moves focus to a button.
    modal.addEventListener('pointerdown',e=>{
      const btn=e.target?.closest?.('.formula-tool-btn');
      const input=document.getElementById('formulaEditorInput');
      if(btn){
        if(input&&Number.isInteger(input.selectionStart)){
          __formulaEditorSelectionStart=input.selectionStart;
          __formulaEditorSelectionEnd=Number.isInteger(input.selectionEnd)?input.selectionEnd:input.selectionStart;
        }
        e.preventDefault();e.stopPropagation();__formulaEditorHandledPointer=true;formulaEditorInsert(btn.getAttribute('data-formula-token')||'');
      }
    },true);
    modal.addEventListener('touchstart',e=>{
      const btn=e.target?.closest?.('.formula-tool-btn');
      const input=document.getElementById('formulaEditorInput');
      if(btn&&input&&Number.isInteger(input.selectionStart)){
        __formulaEditorSelectionStart=input.selectionStart;
        __formulaEditorSelectionEnd=Number.isInteger(input.selectionEnd)?input.selectionEnd:input.selectionStart;
        e.preventDefault();e.stopPropagation();
      }
    },{capture:true,passive:false});
    // Keep the editor visible above the Android keyboard so the normal keyboard and
    // the in-app formula keyboard can be used together.
    const syncFormulaViewport=()=>{
      const vv=window.visualViewport;
      if(!vv||modal.hidden)return;
      modal.style.height=vv.height+'px';
      modal.style.top=vv.offsetTop+'px';
      modal.style.bottom='auto';
    };
    if(window.visualViewport)window.visualViewport.addEventListener('resize',syncFormulaViewport);
    document.body.appendChild(modal);
  }
  const input=document.getElementById('formulaEditorInput');
  // This is a real <textarea>, so use its value/selection APIs. Do not turn it into
  // contenteditable: on Android that makes the control visually editable but breaks
  // native keyboard input and causes toolbar inserts to disappear.
  input.value=initial;
  if(!input.__formulaEditorSelectionTracking){
    const rememberSelection=()=>{
      if(Number.isInteger(input.selectionStart)){
        __formulaEditorSelectionStart=input.selectionStart;
        __formulaEditorSelectionEnd=Number.isInteger(input.selectionEnd)?input.selectionEnd:input.selectionStart;
      }
    };
    ['select','click','keyup','input'].forEach(ev=>input.addEventListener(ev,rememberSelection));
    input.__formulaEditorSelectionTracking=true;
  }
  __formulaEditorSelectionStart=input.value.length;
  __formulaEditorSelectionEnd=input.value.length;
  modal.hidden=false;
  if(window.visualViewport){modal.style.height=window.visualViewport.height+'px';modal.style.top=window.visualViewport.offsetTop+'px';modal.style.bottom='auto';}document.body.classList.add('formula-editor-open');
  updateFormulaEditorPreview();
  requestAnimationFrame(()=>{
    try{
      input.focus({preventScroll:true});
      const pos=input.value.length;
      input.setSelectionRange(pos,pos);
    }catch{}
  });
  setTimeout(()=>{
    if(document.activeElement!==input){
      try{input.focus({preventScroll:true});}catch{}
    }
  },120);
}
function closeFormulaEditor(){const modal=document.getElementById('formulaEditorModal');if(modal){modal.hidden=true;modal.style.height='';modal.style.top='';modal.style.bottom='';}document.body.classList.remove('formula-editor-open');__formulaEditorTarget=null;__formulaEditorInsertEditor=null;__formulaEditorSelectionStart=0;__formulaEditorSelectionEnd=0;}
function updateFormulaEditorPreview(){
  const input=document.getElementById('formulaEditorInput'),preview=document.getElementById('formulaEditorPreview');
  if(!input||!preview)return;
  const value=String(input.value||'').replace(/\u00a0/g,' ').trim();
  preview.innerHTML=value?formulaTextToMathML(value):'<span class="muted">Formula preview यहाँ दिखेगा</span>';
}
function formulaEditorInsert(value){
  const input=document.getElementById('formulaEditorInput');if(!input)return;
  const token=String(value??'');
  const len=input.value.length;
  let start=Number.isInteger(__formulaEditorSelectionStart)?__formulaEditorSelectionStart:input.selectionStart;
  let end=Number.isInteger(__formulaEditorSelectionEnd)?__formulaEditorSelectionEnd:input.selectionEnd;
  if(!Number.isInteger(start))start=len;if(!Number.isInteger(end))end=start;
  start=Math.max(0,Math.min(start,len));end=Math.max(start,Math.min(end,len));
  try{input.focus({preventScroll:true});}catch{input.focus();}
  input.setRangeText(token,start,end,'end');
  __formulaEditorSelectionStart=start+token.length;
  __formulaEditorSelectionEnd=__formulaEditorSelectionStart;
  input.dispatchEvent(new Event('input',{bubbles:true}));
  updateFormulaEditorPreview();
  try{input.focus({preventScroll:true});}catch{input.focus();}
}
function applyFormulaEditor(){
  const input=document.getElementById('formulaEditorInput');
  const value=String(input?.value||'').replace(/\u00a0/g,' ').trim()||'';if(!value)return alert('पहले formula लिखें।');
  const rendered=formulaTextToMathML(value);if(!rendered)return alert('इस formula को render नहीं किया जा सका।');
  if(__formulaEditorMode==='edit'&&__formulaEditorTarget?.isConnected){
    const el=__formulaEditorTarget;el.setAttribute('data-ewl-speech',formulaBodyPlain(value));el.innerHTML=rendered;el.setAttribute('title','Formula edit करने के लिए tap करें');
  }else{
    const editor=__formulaEditorInsertEditor||__lastRichParagraphEditor||document.querySelector('.rich-paragraph-editor');
    if(!editor){closeFormulaEditor();return alert('पहले Paragraph में cursor रखकर Formula Insert करें।');}
    __formulaEditorInsertEditor=editor;editor.focus();
    const html=`<span class="formula-source" data-ewl-speech="${esc(formulaBodyPlain(value))}" title="Formula edit करने के लिए tap करें">${rendered}</span>`;
    try{
      const sel=window.getSelection();
      if(sel&&sel.rangeCount&&editor.contains(sel.anchorNode)){document.execCommand('insertHTML',false,html);}
      else {
        const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);
        sel.removeAllRanges();sel.addRange(range);document.execCommand('insertHTML',false,html);
      }
    }catch{
      editor.insertAdjacentHTML('beforeend',html);
    }
    editor.dispatchEvent(new Event('input',{bubbles:true}));
    __lastRichParagraphEditor=editor;
  }
  closeFormulaEditor();
}
function installFormulaEditor(){
  if(window.__ewlFormulaEditorInstalled)return;window.__ewlFormulaEditorInstalled=true;
  document.addEventListener('click',e=>{
    const formula=e.target?.closest?.('.rich-paragraph-editor .formula-source');
    if(formula){e.preventDefault();e.stopPropagation();openFormulaEditor(formula);return;}
    const insert=e.target?.closest?.('.formula-insert-btn');
    if(insert){
      e.preventDefault();e.stopPropagation();
      const editor=insert.closest('.para')?.querySelector('.rich-paragraph-editor')||__lastRichParagraphEditor||document.querySelector('.rich-paragraph-editor');
      if(editor){__formulaEditorInsertEditor=editor;__lastRichParagraphEditor=editor;editor.focus();openFormulaEditor(null);}
    }
  },true);
  document.addEventListener('focusin',e=>{const editor=e.target?.closest?.('.rich-paragraph-editor');if(editor){__lastRichParagraphEditor=editor;__formulaEditorInsertEditor=editor;}},true);
  document.addEventListener('input',e=>{if(e.target?.id==='formulaEditorInput')updateFormulaEditorPreview();});
  document.addEventListener('beforeinput',e=>{if(e.target?.id==='formulaEditorInput')e.stopPropagation();},true);
  document.addEventListener('keydown',e=>{if(e.target?.id==='formulaEditorInput')e.stopPropagation();},true);
  document.addEventListener('click',e=>{if(e.target?.id==='formulaEditorInput'){e.stopPropagation();e.target.focus();}},true);
}
function formulaInsertButtonHtml(){return `<button type="button" class="btn-secondary formula-insert-btn">ƒx Formula</button>`;}

function installRichFormulaCopyGuard(){
  if(window.__ewlFormulaCopyGuardInstalled)return;
  window.__ewlFormulaCopyGuardInstalled=true;
  document.addEventListener('copy',e=>{
    const sel=window.getSelection(); if(!sel||!sel.rangeCount||sel.isCollapsed)return;
    const anchor=sel.anchorNode?.nodeType===Node.ELEMENT_NODE?sel.anchorNode:sel.anchorNode?.parentElement;
    const box=anchor?.closest?.('.rich-paragraph-editor,.rich-ocr-result');
    if(!box)return;
    try{
      const range=sel.getRangeAt(0),holder=document.createElement('div');
      holder.appendChild(range.cloneContents());
      const html=sanitizeRichHtml(holder.innerHTML);
      if(!html)return;
      const plain=formulaAwareClipboardText(paragraphPlainText(RICH_PREFIX+html)||sel.toString());
      if(!plain.trim())return;
      const clipboardHtml=html;
      e.clipboardData.setData('text/plain',plain);
      e.clipboardData.setData('text/html',clipboardHtml);
      e.preventDefault();
    }catch{}
  },true);
}

function typesetMath(container=root){
  if(window.MathJax?.typesetPromise) window.MathJax.typesetPromise([container]).catch(()=>{});
}
async function api(url,opt={}){opt.headers={...(opt.headers||{}),'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})};const r=await fetch('/api'+url,opt);const d=await r.json().catch(()=>({}));if(!r.ok)throw Error(d.error||'Request failed');return d}
function authView(){root.innerHTML=`<main class="center"><section class="card auth-card"><div class="auth-brand"><img src="/pwa-assets/icon-192.png" alt="Easyway Learn logo"><div><h1>Easyway Learn</h1><p>Tuition Teacher · Reading & Learning</p></div></div><h2>Welcome</h2><div class="auth-choice-grid"><button class="list" type="button" onclick="teacherLoginOnly()">🔐 Login</button><button class="list" type="button" onclick="teacherRegisterOnly()">🆕 Create Teacher Account</button></div></section></main>`}
function teacherLoginOnly(){teacherAuthForms();const reg=document.getElementById('reg');if(reg)reg.closest('form')?.remove();const admin=document.getElementById('adminLoginBtn');if(admin)admin.remove();const back=document.createElement('button');back.type='button';back.className='btn-secondary';back.textContent='Back';back.onclick=authView;root.querySelector('.auth-brand')?.after(back);const h3=root.querySelector('h3');if(h3)h3.remove();const hr=root.querySelectorAll('hr');if(hr.length)hr[hr.length-1].remove();}
function teacherRegisterOnly(){teacherAuthForms();const login=document.getElementById('login');if(login){login.remove();}const forgot=document.getElementById('forgot');if(forgot)forgot.remove();const headings=root.querySelectorAll('h2');if(headings[0])headings[0].textContent='Create Teacher Account';const h3=root.querySelector('h3');if(h3)h3.remove();const admin=document.getElementById('adminLoginBtn');if(admin)admin.remove();const hr=root.querySelectorAll('hr');hr.forEach(x=>x.remove());const brand=root.querySelector('.auth-brand');if(brand){const back=document.createElement('button');back.type='button';back.className='btn-secondary';back.textContent='Back';back.onclick=authView;brand.after(back);}}
function teacherAuthForms(){
  const resetToken=new URLSearchParams(location.search).get('reset');
  if(resetToken){return resetPasswordView(resetToken)}
  root.innerHTML=`<main class="center"><section class="card auth-card"><div class="auth-brand"><img src="/pwa-assets/icon-192.png" alt="Easyway Learn logo"><div><h1>Easyway Learn</h1><p>Tuition Teacher · Reading & Learning</p></div></div><div class="section-kicker">TEACHER PORTAL</div><h2>Teacher Login</h2><form id="login"><label for="loginEmail">Email</label><input id="loginEmail" name="email" type="email" placeholder="अपना ईमेल लिखें" autocomplete="username" required><label for="loginPassword">Password</label><input id="loginPassword" name="password" type="password" placeholder="अपना पासवर्ड लिखें" autocomplete="current-password" required><button>Login</button></form><button id="forgot" class="btn-secondary" type="button">Forgot Password?</button><hr><h3>Create new Teacher ID</h3><form id="reg"><label for="registerName">Teacher name</label><input id="registerName" name="name" placeholder="शिक्षक का नाम" required><label for="registerEmail">Email</label><input id="registerEmail" name="email" type="email" placeholder="ईमेल" autocomplete="email" required><label for="registerPassword">Password</label><input id="registerPassword" name="password" type="password" minlength="6" placeholder="कम से कम 6 अक्षर" autocomplete="new-password" required><button>Create Account</button></form></section></main>`;
  login.onsubmit=async e=>{e.preventDefault();try{const d=await api('/auth/login',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(login)))});token=d.token;localStorage.token=token;boot()}catch(x){alert(x.message)}};
  reg.onsubmit=async e=>{e.preventDefault();try{const d=await api('/auth/register',{method:'POST',body:JSON.stringify(Object.fromEntries(new FormData(reg)))});token=d.token;localStorage.token=token;sessionStorage.teacherCreated=`Account Created Successfully\nName: ${d.teacher.name}\nEmail/Teacher ID: ${d.teacher.email}`;boot()}catch(x){alert(x.message)}};
  forgot.onclick=forgotPasswordView;
}
function adminLoginView(){
  root.innerHTML=`<main class="center"><section class="card auth-card"><h1>Admin Login</h1><p>केवल <b>Manishgupta021469@gmail.com</b> से Admin Login किया जा सकता है।</p><form id="adminLoginForm"><input id="adminEmail" type="email" value="Manishgupta021469@gmail.com" readonly><input id="adminPassword" type="password" placeholder="Admin Password" required><button>Login</button></form><button id="adminForgotBtn" type="button">Forgot Password?</button><button id="backTeacherLogin" type="button">Back to Teacher Login</button></section></main>`;
  adminLoginForm.onsubmit=async e=>{e.preventDefault();try{const d=await api('/admin/login',{method:'POST',body:JSON.stringify({email:adminEmail.value,password:adminPassword.value})});token=d.token;localStorage.token=token;adminDashboard()}catch(x){alert(x.message)}};
  adminForgotBtn.onclick=adminForgotPasswordView;
  backTeacherLogin.onclick=()=>{location.href='/'};
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
    root.innerHTML=`<header><b>Admin Dashboard</b><button id="adminLogout">Logout</button></header><main><section class="card"><h2>Teacher IDs & Activity</h2><p class="muted">Admin यहाँ देख सकता है कि कौन-से teachers ने आज login किया है और किन phones पर PWA installation detect हुई है। Installation status तभी निश्चित रूप से <b>Installed</b> होगा जब ऐप standalone/PWA mode में खुला हो या install event detect हुआ हो।</p><div id="adminTeacherList">${teachers.map(t=>`<div class="student-row"><div><b>${esc(t.name)}</b> ${t.is_blocked?'<span class="muted">(BLOCKED)</span>':''}<br><small>${esc(t.email)} · Teacher ID #${t.id} · ${t.student_count} students · ${t.test_count} tests</small><br><small><b>आज Login:</b> ${t.today_login?'YES':'NO'} · <b>App Install:</b> ${t.installed?'YES — Detected':'NOT DETECTED'}${t.last_app_open_at?` · Last Open: ${new Date(t.last_app_open_at).toLocaleString('en-IN',{dateStyle:'short',timeStyle:'short'})}`:''}</small></div><div><button type="button" data-admin-open="${t.id}">Open Dashboard</button><button type="button" data-admin-password="${t.id}">Change Password</button><button type="button" data-admin-block="${t.id}" data-blocked="${t.is_blocked?'1':'0'}">${t.is_blocked?'Unblock Teacher':'Block Teacher'}</button><button type="button" data-admin-delete="${t.id}">Delete Teacher</button></div></div>`).join('')||'<p>No teachers registered yet.</p>'}</div></section></main>`;
    adminLogout.onclick=()=>{localStorage.removeItem('token');location.href='/admin'};
    document.querySelectorAll('[data-admin-open]').forEach(b=>b.onclick=()=>adminOpenTeacher(+b.dataset.adminOpen));
    document.querySelectorAll('[data-admin-password]').forEach(b=>b.onclick=()=>adminSetTeacherPassword(+b.dataset.adminPassword));
    document.querySelectorAll('[data-admin-block]').forEach(b=>b.onclick=()=>adminBlockTeacher(+b.dataset.adminBlock,b.dataset.blocked==='1'));
    document.querySelectorAll('[data-admin-delete]').forEach(b=>b.onclick=()=>adminDeleteTeacher(+b.dataset.adminDelete));
  }catch(e){localStorage.removeItem('token');alert(e.message||'Admin session expired');adminLoginView()}
}
async function adminOpenTeacher(id){try{const r=await api('/admin/teachers/'+id+'/impersonate',{method:'POST'});sessionStorage.adminTeacherToken=token;token=r.token;localStorage.token=token;await load();dashboard();reportTeacherActivity().catch(()=>{})}catch(e){alert(e.message)}}
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
  const created=sessionStorage.getItem('teacherCreated'); sessionStorage.removeItem('teacherCreated');
  const orderedStudents=state.students;
  const ranked=state.results.slice().sort((a,b)=>Number(b.score||0)-Number(a.score||0));
  const totalTests=state.results.reduce((sum,r)=>sum+Number(r.tests||0),0);
  const subjectIcons=['📖','📘','🧪','🧮','🌍'];
  const subjectClasses=['dash-pink','dash-blue','dash-green','dash-purple','dash-orange'];
  const recent=ranked.slice(0,3);
  root.innerHTML=`
  <header class="dash-header">
    <div class="dash-brand"><button class="dash-menu" type="button" aria-label="Menu">☰</button><div class="brand-lockup"><img src="/pwa-assets/icon-192.png" alt="Easyway Learn logo"><div><b>Easyway Learn</b><small>Read&nbsp; • &nbsp;Practice&nbsp; • &nbsp;Improve</small></div></div></div>
    <div class="header-actions">
      ${decodeJwtRole()==='admin_impersonate'?'<button id="backAdmin" class="btn-secondary" type="button">Back to Admin</button>':''}
      <button id="teacherProfile" class="dash-profile" type="button" aria-expanded="false"><span class="profile-name">${esc(state.teacher?.name||'Teacher')}</span><span>⌄</span></button>
      <button id="logout" class="dash-logout">Logout</button>
    </div>
    <div id="profileMenu" class="profile-menu" hidden><b>${esc(state.teacher?.name||'Teacher')}</b><small>Teacher ID: ${esc(state.teacher?.email||state.teacher?.id||'')}</small><button id="profileChangePassword" class="btn-secondary" type="button">Change Password</button></div>
  </header>
  <main class="teacher-dashboard">
    ${created?`<section class="success-banner"><b>${esc(created).replace(/\n/g,'<br>')}</b></section>`:''}
    <section class="dash-welcome">
      <div class="dash-welcome-person"><div><div class="dash-small-title">Welcome,</div><h1>${esc(state.teacher?.name||'Teacher')}</h1><p>Tuition Teacher <span>•</span> ${orderedStudents.length} Students</p></div></div>
    </section>

    <section class="dash-section-head"><div><span class="dash-section-icon">👥</span><h2>My Students</h2></div><span class="count-pill">${orderedStudents.length}/20</span></section>
    <section class="dash-student-grid">
      ${orderedStudents.slice(0,4).map((st,i)=>`<button class="dash-student-card" data-s="${st.id}" type="button"><span class="dash-student-info"><b>${esc(st.name)}</b><small>Class ${esc(st.class_name)}</small></span><span class="dash-arrow">›</span></button>`).join('')}
      ${orderedStudents.length>4?'<button id="moreStudents" class="dash-more-card" type="button"><span>•••</span><b>More</b><small>View students</small><i>›</i></button>':''}
      ${orderedStudents.length===0?'<div class="dash-empty">अभी कोई Student नहीं है। नीचे “Add Student” से जोड़ें।</div>':''}
    </section>
    <div id="extraStudents" class="dash-student-grid dash-extra" hidden>${orderedStudents.slice(4).map(st=>`<button class="dash-student-card" data-s="${st.id}" type="button"><span class="dash-student-info"><b>${esc(st.name)}</b><small>Class ${esc(st.class_name)}</small></span><span class="dash-arrow">›</span></button>`).join('')}</div>
    <div class="dash-action-row"><button id="addStudent" class="dash-primary-action" type="button">＋ Add Student</button></div>

    <section class="dash-section-head"><div><span class="dash-section-icon">📚</span><h2>Learning Materials</h2></div><button id="addSubject" class="dash-link-action" type="button">＋ Create Subject</button></section>
    <section class="dash-subject-grid">
      ${state.content.slice(0,5).map((sub,i)=>`<button class="dash-subject-card ${subjectClasses[i%subjectClasses.length]}" data-teacher-subject="${sub.id}" type="button"><span class="dash-subject-icon">${subjectIcons[i%subjectIcons.length]}</span><span><b>${esc(sub.name)}</b><small>${sub.books?.length||0} Books</small></span><span class="dash-manage">Manage</span></button>`).join('')}
      ${state.content.length>5?'<button id="moreSubjects" class="dash-subject-card dash-more-card" type="button"><span class="dash-subject-icon">•••</span><span><b>More</b><small>Subjects</small></span><span class="dash-arrow">›</span></button>':''}
      ${state.content.length===0?'<div class="dash-empty">अभी कोई Subject नहीं है। “Create Subject” से शुरू करें।</div>':''}
    </section>
    <div id="extraSubjects" class="dash-subject-grid dash-extra" hidden>${state.content.slice(5).map((sub,i)=>`<button class="dash-subject-card ${subjectClasses[(i+5)%subjectClasses.length]}" data-teacher-subject="${sub.id}" type="button"><span class="dash-subject-icon">${subjectIcons[(i+5)%subjectIcons.length]}</span><span><b>${esc(sub.name)}</b><small>${sub.books?.length||0} Books</small></span><span class="dash-manage">Manage</span></button>`).join('')}</div>
    <div id="content" hidden>${renderContent()}</div>

    <section class="dash-section-head dash-results-head"><div><span class="dash-section-icon">📋</span><h2>Student Performance</h2></div><span class="dash-stat-note">${totalTests} Tests</span></section>
    <section class="dash-results-card">
      ${recent.map((r,i)=>`<button class="dash-result-row" data-s="${r.student_id||r.id}" type="button"><span class="dash-result-icon ${['dash-purple','dash-blue','dash-green'][i]}">${i===0?'🎯':i===1?'📄':'✓'}</span><span class="dash-result-main"><b>${esc(r.name)}</b><small>${r.tests||0} test${Number(r.tests||0)===1?'':'s'} completed</small></span><strong>${Number(r.score||0).toFixed(0)}%</strong><span class="dash-arrow">›</span></button>`).join('')||'<div class="dash-empty">टेस्ट पूरा होने के बाद यहाँ Student Performance दिखाई देगी।</div>'}
    </section>

  </main>`;
  logout.onclick=()=>{localStorage.clear();sessionStorage.removeItem('adminTeacherToken');location.reload()};
  if(decodeJwtRole()==='admin_impersonate')backAdmin.onclick=backToAdmin;
  teacherProfile.onclick=()=>{const menu=document.getElementById('profileMenu');menu.hidden=!menu.hidden;teacherProfile.setAttribute('aria-expanded',String(!menu.hidden))};
  profileChangePassword.onclick=changePasswordForm;
  addStudent.onclick=addStudentForm; addSubject.onclick=addSubjectForm;
  const bindStudentButtons=()=>{document.querySelectorAll('[data-s]').forEach(b=>b.onclick=()=>studentTests(+b.dataset.s))}; bindStudentButtons();
  const moreStudents=document.getElementById('moreStudents'); if(moreStudents)moreStudents.onclick=()=>{document.getElementById('extraStudents').hidden=false;moreStudents.remove();bindStudentButtons()};
  const moreSubjects=document.getElementById('moreSubjects'); if(moreSubjects)moreSubjects.onclick=()=>{document.getElementById('extraSubjects').hidden=false;moreSubjects.remove();bindSubjectButtons()};
  function bindSubjectButtons(){document.querySelectorAll('[data-teacher-subject]').forEach(b=>b.onclick=()=>teacherSubjectFlow(+b.dataset.teacherSubject))} bindSubjectButtons();
  document.querySelectorAll('[data-quick="students"]').forEach(b=>b.onclick=()=>document.getElementById('addStudent')?.scrollIntoView({behavior:'smooth',block:'center'}));
  document.querySelectorAll('[data-quick="subjects"]').forEach(b=>b.onclick=()=>document.querySelector('.dash-subject-grid')?.scrollIntoView({behavior:'smooth',block:'center'}));
  document.querySelectorAll('[data-quick="results"]').forEach(b=>b.onclick=()=>document.querySelector('.dash-results-card')?.scrollIntoView({behavior:'smooth',block:'center'}));
  document.querySelectorAll('[data-quick="password"]').forEach(b=>b.onclick=changePasswordForm);
}
function teacherSubjectFlow(subjectId){const subject=state.content.find(s=>s.id===subjectId);if(!subject)return;root.innerHTML=`<header><div class="brand-lockup"><img src="/pwa-assets/icon-192.png" alt=""><div><b>Easyway Learn</b><small>${esc(subject.name)}</small></div></div><button class="btn-secondary" onclick="dashboard()">Back</button></header><main><section class="card"><h2>${esc(subject.name)} — Book चुनें</h2><div class="compact-grid">${subject.books.map(b=>`<button class="list compact-item" onclick="teacherBookFlow(${subjectId},${b.id})">${esc(b.name)}</button>`).join('')||'<p class="muted">अभी कोई Book नहीं है।</p>'}</div><div class="button-row"><button onclick="addBookForm(${subjectId})">+ Book</button><button class="btn-secondary" onclick="editSubject(${subjectId})">Edit Subject</button></div></section></main>`}
function teacherBookFlow(subjectId,bookId){const subject=state.content.find(s=>s.id===subjectId),book=subject?.books.find(b=>b.id===bookId);if(!book)return;root.innerHTML=`<header><b>${esc(book.name)} — Chapter चुनें</b><button class="btn-secondary" onclick="teacherSubjectFlow(${subjectId})">Back</button></header><main><section class="card"><div class="compact-grid">${book.chapters.map(c=>`<button class="list compact-item" onclick="teacherChapterFlow(${subjectId},${bookId},${c.id})">${esc(c.name)}</button>`).join('')||'<p class="muted">अभी कोई Chapter नहीं है।</p>'}</div><button onclick="addChapterForm(${bookId})">+ Chapter</button><button class="btn-secondary" onclick="editBook(${bookId})">Edit Book</button></section></main>`}
function teacherChapterFlow(subjectId,bookId,chapterId){const c=getChapter(chapterId);if(!c)return;root.innerHTML=`<header><b>${esc(c.name)} — Content चुनें</b><button class="btn-secondary" onclick="teacherBookFlow(${subjectId},${bookId})">Back</button></header><main><section class="card"><p>${c.paragraphs.length} paragraphs · ${c.qa.length} Q&A</p><div class="compact-grid"><button class="list compact-item" onclick="editChapterParagraphs(${chapterId})">Paragraph</button><button class="list compact-item" onclick="editChapterQA(${chapterId})">Question-Answer</button></div><button class="btn-secondary" onclick="editChapterName(${chapterId})">Edit Chapter Name</button></section></main>`}

function changePasswordForm(){
  root.innerHTML=`<header><b>Change Password</b><button id="backDash">Back</button></header><main><section class="card"><h2>Change Teacher Password</h2><form id="changePassForm"><input id="currentPassword" type="password" placeholder="Current password" required><input id="newPassword" type="password" minlength="6" placeholder="New password (minimum 6 characters)" required><input id="confirmPassword" type="password" minlength="6" placeholder="Confirm new password" required><button>Change Password</button></form></section></main>`;
  backDash.onclick=refresh;
  changePassForm.onsubmit=async e=>{e.preventDefault();if(newPassword.value!==confirmPassword.value)return alert('दोनों new passwords समान होने चाहिए।');try{const r=await api('/auth/change-password',{method:'POST',body:JSON.stringify({currentPassword:currentPassword.value,newPassword:newPassword.value})});alert(r.message||'Password changed successfully.');refresh()}catch(x){alert(x.message)}};
}
function renderContent(){return state.content.map(s=>`<details class="subject"><summary class="tree-summary subject-summary">${esc(s.name)} <span class="tree-hint">${s.books.length} books · खोलने के लिए दबाएँ</span></summary><div class="tree-actions"><button onclick="editSubject(${s.id})">Edit Subject</button><button onclick="deleteSubject(${s.id})">Delete Subject</button><button onclick="addBookForm(${s.id})">+ Book</button></div>${s.books.map(b=>`<details class="book"><summary class="tree-summary book-summary">${esc(b.name)} <span class="tree-hint">${b.chapters.length} chapters · खोलें</span></summary><div class="tree-actions"><button onclick="editBook(${b.id})">Edit Book</button><button onclick="addChapterForm(${b.id})">+ Chapter</button></div>${b.chapters.map(c=>`<div class="chapter"><b>${esc(c.name)}</b> <small>${c.paragraphs.length} paragraphs · ${c.qa.length} Q&A</small><div class="button-row"><button onclick="editChapter(${c.id})">Open / Edit Chapter</button><button onclick="deleteChapter(${c.id})">Delete Chapter</button></div></div>`).join('')}</details>`).join('')}</details>`).join('')||'<p>No subjects yet.</p>'}
async function refresh(){closeParagraphCamera();await load();dashboard();reportTeacherActivity().catch(()=>{})}
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
async function deleteSubject(id){const s=state.content.find(x=>x.id===id);if(!s)return;if(!confirm(`पहली पुष्टि: क्या Subject "${s.name}" को delete करना चाहते हैं?`))return;if(!confirm(`दूसरी पुष्टि: Subject "${s.name}" के सभी books, chapters, paragraphs और Q&A हट जाएंगे। पुराने saved test results/history को सुरक्षित रखने का प्रयास किया जाएगा। क्या स्थायी रूप से delete करें?`))return;try{await api('/subjects/'+id,{method:'DELETE'});await refresh()}catch(e){alert(e.message)}}
async function deleteChapter(id){const c=getChapter(id);if(!c)return;if(!confirm(`पहली पुष्टि: क्या Chapter "${c.name}" को delete करना चाहते हैं?`))return;if(!confirm(`दूसरी पुष्टि: इस chapter के सभी paragraphs और Q&A हट जाएंगे। पुराने saved test results/history सुरक्षित रखने का प्रयास किया जाएगा। क्या chapter स्थायी रूप से delete करें?`))return;try{await api('/chapters/'+id,{method:'DELETE'});await refresh()}catch(e){alert(e.message)}}
async function addBookForm(subjectId){const name=prompt('Book name');if(!name)return;try{await api('/books',{method:'POST',body:JSON.stringify({subjectId,name})});await refresh()}catch(e){alert(e.message)}}
async function editBook(id){const b=state.content.flatMap(s=>s.books).find(x=>x.id===id);if(!b)return;const name=prompt('Edit Book name',b.name);if(name===null||!name.trim())return;try{await api('/books/'+id,{method:'PUT',body:JSON.stringify({name:name.trim()})});await refresh()}catch(e){alert(e.message)}}
function addChapterForm(bookId){closeParagraphCamera();root.innerHTML=`<header><b>+ Add Chapter</b><button class="btn-secondary" type="button" onclick="refresh()">Back</button></header><main><section class="card form-card"><div class="section-kicker">LEARNING MATERIAL</div><h2>नया अध्याय जोड़ें</h2><p class="muted">अध्याय का नाम लिखें। चाहें तो किताब से कॉपी किया हुआ टेक्स्ट पेस्ट करें या कैमरे से पहचानें। यहाँ दिया गया पूरा टेक्स्ट एक पैराग्राफ के रूप में सेव होगा; बाद में अध्याय खोलकर अलग-अलग पैराग्राफ जोड़ सकते हैं।</p><label for="newChapterName">Chapter name</label><input id="newChapterName" placeholder="अध्याय का नाम" required><label for="newChapterText">Chapter text (optional)</label><textarea id="newChapterText" rows="9" placeholder="यहाँ टेक्स्ट लिखें या पेस्ट करें…"></textarea><div class="button-row"><button type="button" class="btn-secondary" onclick="pasteIntoField('newChapterText')">📋 Clipboard से Paste</button><button type="button" class="btn-secondary" onclick="openParagraphCamera('newChapterText')">🖼️ Gallery OCR</button></div>${cameraPanelHtml()}<div class="button-row form-actions"><button type="button" onclick="saveNewChapter(${bookId})">Save Chapter</button><button type="button" class="btn-secondary" onclick="closeParagraphCamera();refresh()">Cancel</button></div></section></main>`}
async function saveNewChapter(bookId){const name=document.getElementById('newChapterName')?.value.trim();const text=document.getElementById('newChapterText')?.value||'';if(!name)return alert('Chapter का नाम लिखें।');try{await api('/chapters',{method:'POST',body:JSON.stringify({bookId,name,text})});closeParagraphCamera();await refresh()}catch(e){alert(e.message)}}
function studentFlowContext(studentId,subjectId=null,bookId=null,chapterId=null){
  const student=(state.students||[]).find(x=>x.id===studentId)||null;
  const subject=(subjectId!=null?state.content.find(x=>x.id===subjectId):null)||null;
  const book=(subject&&bookId!=null?subject.books.find(x=>x.id===bookId):null)||null;
  const chapter=(chapterId!=null?getChapter(chapterId):null)||null;
  return {student,subject,book,chapter};
}
function studentFlowTopNav(studentId,subjectId=null,bookId=null,chapterId=null){
  const {student,subject,book,chapter}=studentFlowContext(studentId,subjectId,bookId,chapterId);
  const box=(kind,title,value,onclick,enabled=true)=>{const selectedTitle=value?title.replace(/\s+List$/,'')+' :':title;return `<button type="button" class="student-flow-select ${value?'is-selected':''}" ${enabled?`onclick="${onclick}"`: 'disabled'} aria-label="${esc(selectedTitle)}${value?': '+esc(value):''}"><span class="student-flow-select-label">${esc(selectedTitle)}</span><span class="student-flow-select-value">${value?esc(value):'Select'}</span></button>`;};
  return `<nav class="student-flow-top-nav" aria-label="Student selection lists">${
    box('student','Student List',student?.name||'',`studentListFlow(${studentId})`)
  }${
    box('subject','Subject List',subject?.name||'',`studentSubjectListFlow(${studentId})`,!!student)
  }${
    box('book','Book List',book?.name||'',`studentBookListFlow(${studentId},${subjectId})`,!!subject)
  }${
    box('chapter','Chapter List',chapter?.name||'',`studentChapterListFlow(${studentId},${subjectId},${bookId})`,!!book)
  }</nav>`;
}
function studentFlowBottomNav(studentId,chapterId=null){
  const ready=chapterId!=null;
  return `<nav class="student-flow-bottom-nav" aria-label="Chapter content choices"><button type="button" class="student-flow-bottom-btn paragraph" ${ready?`onclick="selectParagraph(${studentId},${chapterId})"`:'disabled'}>▣<span>Paragraph</span></button><button type="button" class="student-flow-bottom-btn complete" ${ready?`onclick="selectCompleteChapter(${studentId},${chapterId})"`:'disabled'}>▤<span>Complete Chapter</span></button><button type="button" class="student-flow-bottom-btn qa" ${ready?`onclick="selectQaItems(${studentId},${chapterId})"`:'disabled'}>▣<span>Question-Answer</span></button></nav>`;
}
function studentListFlow(currentStudentId){
  const students=state.students||[];
  root.innerHTML=`<header><b>Student List</b><button class="btn-secondary" onclick="studentTests(${currentStudentId})">Back</button></header><main>${studentFlowTopNav(currentStudentId)}<section class="card student-filter-card"><h2>Student चुनें</h2><p class="muted">Filter जैसी list में scroll करके student चुनें।</p><input id="studentFilterSearch" class="student-filter-search" placeholder="Student search…" autocomplete="off" oninput="filterStudentFlowList('student',this.value,${currentStudentId})"><div id="studentFlowFilterList" class="scroll-list">${students.map((st,i)=>`<button type="button" class="list compact-item student-filter-item ${st.id===currentStudentId?'is-selected':''}" onclick="studentTests(${st.id})"><span>${i+1}. ${esc(st.name)}</span>${st.class_name?`<small>Class ${esc(st.class_name)}</small>`:''}</button>`).join('')||'<p class="muted">अभी कोई Student नहीं है।</p>'}</div></section>${studentFlowBottomNav(currentStudentId,null)}</main>`;
}
function filterStudentFlowList(kind,query,studentId,subjectId=null,bookId=null,chapterId=null){
  const list=document.getElementById('studentFlowFilterList'); if(!list)return;
  const q=String(query||'').trim().toLocaleLowerCase();
  let html='';
  if(kind==='student'){
    const rows=(state.students||[]).filter(st=>!q||String(st.name||'').toLocaleLowerCase().includes(q)||String(st.class_name||'').toLocaleLowerCase().includes(q));
    html=rows.map((st,i)=>`<button type="button" class="list compact-item student-filter-item ${st.id===studentId?'is-selected':''}" onclick="studentTests(${st.id})"><span>${i+1}. ${esc(st.name)}</span>${st.class_name?`<small>Class ${esc(st.class_name)}</small>`:''}</button>`).join('');
  }else if(kind==='subject'){
    const rows=(state.content||[]).filter(sub=>!q||String(sub.name||'').toLocaleLowerCase().includes(q));
    html=rows.map((sub,i)=>`<button type="button" class="list compact-item student-filter-item ${sub.id===subjectId?'is-selected':''}" onclick="studentSubjectFlow(${studentId},${sub.id})"><span>${i+1}. ${esc(sub.name)}</span><small>Subject</small></button>`).join('');
  }else if(kind==='book'){
    const sub=state.content.find(x=>x.id===subjectId); const rows=sub?.books||[];
    const filtered=rows.filter(b=>!q||String(b.name||'').toLocaleLowerCase().includes(q));
    html=filtered.map((b,i)=>`<button type="button" class="list compact-item student-filter-item ${b.id===bookId?'is-selected':''}" onclick="studentBookFlow(${studentId},${subjectId},${b.id})"><span>${i+1}. ${esc(b.name)}</span><small>Book</small></button>`).join('');
  }else if(kind==='chapter'){
    const sub=state.content.find(x=>x.id===subjectId); const book=sub?.books.find(x=>x.id===bookId); const rows=book?.chapters||[];
    const filtered=rows.filter(c=>!q||String(c.name||'').toLocaleLowerCase().includes(q));
    html=filtered.map((c,i)=>`<button type="button" class="list compact-item student-filter-item ${c.id===chapterId?'is-selected':''}" onclick="studentChapterFlow(${studentId},${c.id})"><span>${i+1}. ${esc(c.name)}</span><small>Chapter</small></button>`).join('');
  }
  list.innerHTML=html||'<p class="muted">कोई matching item नहीं मिला।</p>';
}
function studentSubjectListFlow(studentId){
  const subjects=state.content||[];
  root.innerHTML=`<header><b>Subject List</b><button class="btn-secondary" onclick="studentTests(${studentId})">Back</button></header><main>${studentFlowTopNav(studentId)}<section class="card student-filter-card"><h2>Subject चुनें</h2><p class="muted">Filter जैसी list में scroll करके Subject चुनें।</p><input id="studentFilterSearch" class="student-filter-search" placeholder="Subject search…" autocomplete="off" oninput="filterStudentFlowList('subject',this.value,${studentId})"><div id="studentFlowFilterList" class="scroll-list">${subjects.map((sub,i)=>`<button type="button" class="list compact-item student-filter-item" onclick="studentSubjectFlow(${studentId},${sub.id})"><span>${i+1}. ${esc(sub.name)}</span><small>Subject</small></button>`).join('')||'<p class="muted">अभी कोई Subject नहीं है।</p>'}</div></section>${studentFlowBottomNav(studentId,null)}</main>`;
}
function studentBookListFlow(studentId,subjectId){
  const sub=state.content.find(x=>x.id===subjectId);if(!sub)return;
  root.innerHTML=`<header><b>Book List</b><button class="btn-secondary" onclick="studentSubjectFlow(${studentId},${subjectId})">Back</button></header><main>${studentFlowTopNav(studentId,subjectId)}<section class="card student-filter-card"><h2>Book चुनें</h2><p class="muted">Filter जैसी list में scroll करके Book चुनें।</p><input id="studentFilterSearch" class="student-filter-search" placeholder="Book search…" autocomplete="off" oninput="filterStudentFlowList('book',this.value,${studentId},${subjectId})"><div id="studentFlowFilterList" class="scroll-list">${sub.books.map((b,i)=>`<button type="button" class="list compact-item student-filter-item" onclick="studentBookFlow(${studentId},${subjectId},${b.id})"><span>${i+1}. ${esc(b.name)}</span><small>Book</small></button>`).join('')||'<p class="muted">इस Subject में कोई Book नहीं है।</p>'}</div></section>${studentFlowBottomNav(studentId,null)}</main>`;
}
function studentChapterListFlow(studentId,subjectId,bookId){
  const sub=state.content.find(x=>x.id===subjectId),book=sub?.books.find(x=>x.id===bookId);if(!book)return;
  root.innerHTML=`<header><b>Chapter List</b><button class="btn-secondary" onclick="studentBookFlow(${studentId},${subjectId},${bookId})">Back</button></header><main>${studentFlowTopNav(studentId,subjectId,bookId)}<section class="card student-filter-card"><h2>Chapter चुनें</h2><p class="muted">Filter जैसी list में scroll करके Chapter चुनें।</p><input id="studentFilterSearch" class="student-filter-search" placeholder="Chapter search…" autocomplete="off" oninput="filterStudentFlowList('chapter',this.value,${studentId},${subjectId},${bookId})"><div id="studentFlowFilterList" class="scroll-list">${book.chapters.map((c,i)=>`<button type="button" class="list compact-item student-filter-item" onclick="studentChapterFlow(${studentId},${c.id})"><span>${i+1}. ${esc(c.name)}</span><small>Chapter</small></button>`).join('')||'<p class="muted">इस Book में कोई Chapter नहीं है।</p>'}</div></section>${studentFlowBottomNav(studentId,null)}</main>`;
}
async function studentTests(id){
  const st=state.students.find(x=>x.id===id);if(!st)return;
  let attempts=[];try{attempts=await api('/results/'+id)}catch(e){console.error(e)}
  window.__attempts=attempts;
  const overallCorrect=attempts.reduce((n,r)=>n+Number(r.correct_words||0),0),overallTotal=attempts.reduce((n,r)=>n+Number(r.total_words||0),0),overallPct=overallTotal?overallCorrect/overallTotal*100:0;
  const subjects=state.content.map(sub=>{const chapters=sub.books.flatMap(b=>b.chapters);const ids=new Set(chapters.map(c=>c.id));const rows=attempts.filter(r=>ids.has(r.chapter_id));const latest=rows.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];const correct=rows.reduce((n,r)=>n+Number(r.correct_words||0),0),total=rows.reduce((n,r)=>n+Number(r.total_words||0),0);const subjectPct=total?Math.round(correct/total*10000)/100:0;return {...sub,chapters,latest,rows,correct,total,subjectPct}});
  root.innerHTML=`<header><div class="student-heading"><b>${esc(st.name)} — Class ${esc(st.class_name)}</b><button id="deleteCurrentStudent" class="delete-student" type="button">🗑 Delete Student</button></div><button class="btn-secondary" onclick="refresh()">Back</button></header><main>${studentFlowTopNav(id)}<section class="card" id="studentActions"><h2>Student Options</h2><button id="setPhone">📱 WhatsApp Number</button>${st.phone?`<button id="makePdfReport" class="student-action-button" type="button">📄 PDF + 📎 Send Attachment</button><button id="sendTextAttachment" class="student-action-button" type="button">💬 Text Send Attachment</button>`:''}</section><section class="card"><h2>Overall Result</h2><button class="result-link" type="button" onclick="showStudentOverallHistory(${id})">${overallTotal?overallPct.toFixed(2)+'% accuracy':'Results'} · ${overallCorrect}/${overallTotal} words</button></section><section class="card"><h2>Subjects — Test चुनें</h2><div class="compact-grid">${subjects.slice(0,5).map((sub,i)=>`<div class="subject-tile"><button class="list compact-item" onclick="studentSubjectFlow(${id},${sub.id})">${i+1}. ${esc(sub.name)}</button><button class="result-link" onclick="showSubjectHistory(${id},${sub.id})">${sub.total?`${sub.subjectPct.toFixed(2)}%`:'Results'}</button></div>`).join('')}${subjects.length>5?'<button id="moreStudentSubjects" class="btn-secondary compact-item">More</button>':''}</div><div id="extraStudentSubjects" class="compact-grid" hidden>${subjects.slice(5).map((sub,i)=>`<div class="subject-tile"><button class="list compact-item" onclick="studentSubjectFlow(${id},${sub.id})">${i+6}. ${esc(sub.name)}</button><button class="result-link" onclick="showSubjectHistory(${id},${sub.id})">${sub.total?`${sub.subjectPct.toFixed(2)}%`:'Results'}</button></div>`).join('')}</div></section>${studentFlowBottomNav(id,null)}</main>`;
  document.getElementById('deleteCurrentStudent').onclick=()=>deleteStudent(id);
  document.getElementById('setPhone').onclick=async()=>{const phone=prompt('WhatsApp number country code सहित',st.phone||'');if(phone===null)return;try{await api('/students/'+id+'/phone',{method:'PUT',body:JSON.stringify({phone})});await studentTests(id)}catch(e){alert(e.message)}};
  if(st.phone){document.getElementById('makePdfReport').onclick=()=>studentPdfAttachmentManager(id,attempts);document.getElementById('sendTextAttachment').onclick=()=>openWhatsAppStudentReport(id,attempts)}
  const more=document.getElementById('moreStudentSubjects');if(more)more.onclick=()=>{document.getElementById('extraStudentSubjects').hidden=false;more.remove()};
}
function showStudentOverallHistory(sid){const rows=(window.__attempts||[]).slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));root.innerHTML=`<header><b>Overall Result History</b><button class="btn-secondary" onclick="studentTests(${sid})">Back</button></header><main><section class="card"><h2>All Saved Attempts</h2>${rows.length?rows.map(r=>`<div class="attempt-row"><span>${esc(r.chapter_name||'Chapter')} · ${esc(r.test_type)} · ${new Date(r.created_at).toLocaleString()}</span><button class="result-link" onclick="showAttemptResult(${r.id})">${Number(r.score_percent).toFixed(2)}%</button></div>`).join(''):'<p class="muted">अभी कोई saved attempt नहीं है।</p>'}</section></main>`}
function studentSubjectFlow(studentId,subjectId){
  const sub=state.content.find(x=>x.id===subjectId);if(!sub)return;
  const attempts=window.__attempts||[];
  const books=sub.books.map(book=>{const ids=new Set(book.chapters.map(c=>c.id));const rows=attempts.filter(r=>ids.has(r.chapter_id));const correct=rows.reduce((n,r)=>n+Number(r.correct_words||0),0),total=rows.reduce((n,r)=>n+Number(r.total_words||0),0);return {...book,rows,correct,total,pct:total?correct/total*100:0}});
  root.innerHTML=`<header><b>${esc(sub.name)} — Books</b><button class="btn-secondary" onclick="studentTests(${studentId})">Back</button></header><main>${studentFlowTopNav(studentId,subjectId)}<section class="card"><h2>Book चुनें</h2><div class="compact-grid">${books.map((b,i)=>`<div class="subject-tile"><button class="list compact-item" onclick="studentBookFlow(${studentId},${subjectId},${b.id})">${i+1}. ${esc(b.name)}</button><button class="result-link" onclick="studentBookFlow(${studentId},${subjectId},${b.id})">${b.total?b.pct.toFixed(2)+'%':'Results'}</button></div>`).join('')||'<p class="muted">इस Subject में कोई Book नहीं है।</p>'}</div></section>${studentFlowBottomNav(studentId,null)}</main>`;
}
function studentBookFlow(studentId,subjectId,bookId){
  const sub=state.content.find(x=>x.id===subjectId),book=sub?.books.find(x=>x.id===bookId);if(!book)return;
  const attempts=window.__attempts||[];
  root.innerHTML=`<header><b>${esc(book.name)} — Chapters</b><button class="btn-secondary" onclick="studentSubjectFlow(${studentId},${subjectId})">Back</button></header><main>${studentFlowTopNav(studentId,subjectId,bookId)}<section class="card"><h2>Chapter चुनें</h2><div class="compact-grid">${book.chapters.map((c,i)=>{const rows=attempts.filter(r=>r.chapter_id===c.id),correct=rows.reduce((n,r)=>n+Number(r.correct_words||0),0),total=rows.reduce((n,r)=>n+Number(r.total_words||0),0),pct=total?correct/total*100:0;return `<div class="subject-tile"><button class="list compact-item" onclick="studentChapterFlow(${studentId},${c.id})">${i+1}. ${esc(c.name)}</button><button class="result-link" onclick="studentChapterFlow(${studentId},${c.id})">${total?pct.toFixed(2)+'%':'Results'}</button></div>`}).join('')||'<p class="muted">इस Book में कोई Chapter नहीं है।</p>'}</div></section>${studentFlowBottomNav(studentId,null)}</main>`;
}

function studentChapterFlow(studentId,chapterId){
  const c=getChapter(chapterId);if(!c)return;
  const loc=state.content.find(s=>s.books.some(b=>b.chapters.some(x=>x.id===chapterId)));const subjectId=loc?.id;const book=loc?.books.find(b=>b.chapters.some(x=>x.id===chapterId));const bookId=book?.id;
  const all=window.__attempts||[];const chapterRows=all.filter(r=>r.chapter_id===chapterId);const chapterCorrect=chapterRows.reduce((n,r)=>n+Number(r.correct_words||0),0),chapterTotal=chapterRows.reduce((n,r)=>n+Number(r.total_words||0),0),chapterPct=chapterTotal?chapterCorrect/chapterTotal*100:0;
  root.innerHTML=`<header><b>${esc(c.name)} — Chapter</b><button class="btn-secondary" onclick="studentChapterListFlow(${studentId},${subjectId},${bookId})">Back</button></header><main>${studentFlowTopNav(studentId,subjectId,bookId,chapterId)}<section class="card student-chapter-hub"><h2>${esc(c.name)}</h2><p class="muted">Chapter की कुल accuracy: <b>${chapterTotal?chapterPct.toFixed(2)+'%':'अभी परिणाम नहीं'}</b> (${chapterCorrect}/${chapterTotal} words)</p><div class="student-chapter-hub-note">नीचे से Paragraph, Complete Chapter या Question-Answer चुनें।</div></section>${studentFlowBottomNav(studentId,chapterId)}</main>`;
}
function selectCompleteChapter(sid,cid){
  const c=getChapter(cid);if(!c?.paragraphs.length)return alert('No paragraph content');
  const rows=(window.__attempts||[]).filter(r=>r.test_type==='chapter'&&r.chapter_id===cid).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));const latest=rows[0];
  const loc=state.content.find(s=>s.books.some(b=>b.chapters.some(x=>x.id===cid)));const subId=loc?.id;const bk=loc?.books.find(b=>b.chapters.some(x=>x.id===cid));
  root.innerHTML=`<header><b>${esc(c.name)} — Complete Chapter</b><button class="btn-secondary" onclick="studentChapterFlow(${sid},${cid})">Back</button></header><main>${studentFlowTopNav(sid,subId,bk?.id,cid)}<section class="card"><h2>Complete Chapter</h2><p class="muted">इस chapter के सभी paragraphs एक continuous complete test में होंगे।</p><article class="testrow paragraph-option-a"><div class="paragraph-row-heading"><b>Complete Chapter</b><span>${c.paragraphs.reduce((n,p)=>n+tokenize(p.text).length,0)} words</span></div><div class="paragraph-action-grid"><button class="result-link" onclick="showChapterTypeHistory(${sid},${cid},'complete')">${latest?Number(latest.score_percent).toFixed(2)+'%':'History'}</button><button class="progress-chart-btn" onclick="showProgressChart(${sid},${cid},null,'chapter','Complete Paragraph Test','chapter')">📈 Progress Chart</button><button class="history-underline-btn" onclick="showUnderlineHistory(${sid},${cid},null,'chapter','Complete Paragraph Test','chapter')">📋 Underline History</button><button class="primary-test-btn" onclick="startChapterTest(${sid},${cid})">▶ Start Test</button></div></article></section>${studentFlowBottomNav(sid,cid)}</main>`;
}

function showChapterTypeHistory(sid,cid,type){const rows=(window.__attempts||[]).filter(r=>r.chapter_id===cid&&(type==='complete'?(r.test_type==='chapter'||r.test_type==='paragraph'):r.test_type===type)).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));const c=getChapter(cid);root.innerHTML=`<header><b>${esc(c?.name||'Chapter')} — Attempt History</b><button class="btn-secondary" onclick="studentChapterFlow(${sid},${cid})">Back</button></header><main><section class="card"><h2>Previous Attempts</h2>${rows.length?rows.map(r=>`<div class="attempt-row"><span>${r.test_type==='qa'?'Question-Answer':r.test_type==='paragraph'?'Paragraph':'Complete Paragraph'} · ${new Date(r.created_at).toLocaleString()}</span><button class="result-link" onclick="showAttemptResult(${r.id})">${Number(r.score_percent).toFixed(2)}%</button></div>`).join(''):'<p class="muted">अभी कोई saved attempt नहीं है।</p>'}</section></main>`}
function selectQaItems(sid,cid){
  const c=getChapter(cid);if(!c?.qa.length)return alert('No Q&A');
  const loc=state.content.find(s=>s.books.some(b=>b.chapters.some(x=>x.id===cid)));const subId=loc?.id;const bk=loc?.books.find(b=>b.chapters.some(x=>x.id===cid));
  root.innerHTML=`<header><b>${esc(c.name)} — Question-Answer Test</b><button class="btn-secondary" onclick="studentChapterFlow(${sid},${cid})">Back</button></header><main>${studentFlowTopNav(sid,subId,bk?.id,cid)}<section class="card"><h2>Q&A चुनें</h2>${c.qa.map((q,i)=>{const rows=(window.__attempts||[]).filter(r=>r.test_type==='qa'&&r.chapter_id===cid&&r.item_id===q.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));const latest=rows[0];return `<article class="testrow paragraph-option-a"><div class="paragraph-row-heading"><b>Question ${i+1}</b><span>Q&A</span></div><div class="qa-question-preview">${esc(q.question)}</div><div class="paragraph-action-grid"><button class="result-link" onclick="showQaHistory(${sid},${cid},${q.id},${i+1})">${latest?Number(latest.score_percent).toFixed(2)+'%':'History'}</button><button class="progress-chart-btn" onclick="showProgressChart(${sid},${cid},${q.id},'qa','Q&A ${i+1}', 'qa')">📈 Progress Chart</button><button class="history-underline-btn" onclick="showUnderlineHistory(${sid},${cid},${q.id},'qa','Q&A ${i+1}','qa')">📋 Underline History</button><button class="primary-test-btn" onclick="startSingleQaTest(${sid},${cid},${q.id})">▶ Start Test</button></div></article>`}).join('')}</section>${studentFlowBottomNav(sid,cid)}</main>`;
}
function showQaHistory(sid,cid,qid,pos){const rows=(window.__attempts||[]).filter(r=>r.test_type==='qa'&&r.chapter_id===cid&&r.item_id===qid).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));root.innerHTML=`<header><b>Q&A ${pos} — Result History</b><button class="btn-secondary" onclick="selectQaItems(${sid},${cid})">Back</button></header><main><section class="card"><h2>Previous Attempts</h2>${rows.length?rows.map(r=>`<div class="attempt-row"><span>${new Date(r.created_at).toLocaleString()}</span><button class="result-link" onclick="showAttemptResult(${r.id})">${Number(r.score_percent).toFixed(2)}%</button></div>`).join(''):'<p class="muted">अभी कोई saved attempt नहीं है।</p>'}</section></main>`}
function startSingleQaTest(sid,cid,qid){const c=getChapter(cid),q=c?.qa.find(x=>x.id===qid);if(!q)return;speakTest({studentId:sid,chapterId:cid,type:'qa',itemId:q.id,reference:q.answer,title:`${c.name} — Q&A`,onDone:()=>studentTests(sid),onCancel:()=>startSingleQaTest(sid,cid,qid),onBack:()=>selectQaItems(sid,cid)})}
function showSubjectHistory(sid,subjectId){const sub=state.content.find(x=>x.id===subjectId);if(!sub)return;const ids=new Set(sub.books.flatMap(b=>b.chapters.map(c=>c.id)));const arr=(window.__attempts||[]).filter(r=>ids.has(r.chapter_id));root.innerHTML=`<header><b>${esc(sub.name)} — Result History</b><button class="btn-secondary" onclick="studentTests(${sid})">Back</button></header><main><section class="card"><h2>Subject Results</h2>${arr.length?arr.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).map(r=>`<div class="attempt-row"><span>${esc(r.chapter_name||'Chapter')} · ${esc(r.test_type)} · ${new Date(r.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</span><button class="result-link" onclick="showAttemptResult(${r.id})">${Number(r.score_percent).toFixed(2)}%</button></div>`).join(''):'<p class="muted">अभी कोई saved result नहीं है।</p>'}</section></main>`}

function selectParagraph(sid,cid){
  const c=getChapter(cid);if(!c?.paragraphs.length)return alert('No paragraphs');const attempts=(window.__attempts||[]);const loc=state.content.find(s=>s.books.some(b=>b.chapters.some(x=>x.id===cid)));const subId=loc?.id;const bk=loc?.books.find(b=>b.chapters.some(x=>x.id===cid));
  root.innerHTML=`<header><b>${esc(c.name)} — Paragraph Test</b><button class="btn-secondary" onclick="studentChapterFlow(${sid},${cid})">Back</button></header><main>${studentFlowTopNav(sid,subId,bk?.id,cid)}<section class="card"><h2>किस paragraph का test देना है?</h2><p class="muted">कोई भी paragraph चुनें। किसी क्रम की बाध्यता नहीं है।</p>${c.paragraphs.map((p,i)=>{const rows=attempts.filter(r=>r.test_type==='paragraph'&&r.chapter_id===cid&&r.item_id===p.id).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));const latest=rows[0];return `<article class="testrow paragraph-option-a"><div class="paragraph-row-heading"><b>Paragraph ${i+1}</b><span>${tokenize(p.text).length} words</span></div><div class="paragraph-action-grid"><button class="progress-chart-btn" onclick="showProgressChart(${sid},${cid},${p.id},'paragraph','Paragraph ${i+1}', 'paragraph')">📈 Progress Chart</button><button class="history-underline-btn" onclick="showUnderlineHistory(${sid},${cid},${p.id},'paragraph','Paragraph ${i+1}','paragraph')">📋 Underline History${latest?` · ${Number(latest.score_percent).toFixed(2)}%`:''}</button><button class="pronunciation-btn" onclick="showPronunciationHelp(${sid},${cid},${p.id},${i})">📖 Pronunciation Help</button><button class="primary-test-btn" onclick="startSelectedParagraphTest(${sid},${cid},${p.id},${i})">▶ Start Test</button></div></article>`}).join('')}</section>${studentFlowBottomNav(sid,cid)}</main>`;
}
function startSelectedParagraphTest(sid,cid,pid,index){const c=getChapter(cid);const p=c?.paragraphs.find(x=>x.id===pid);if(!p)return alert('Paragraph not found');const open=()=>speakTest({studentId:sid,chapterId:cid,type:'paragraph',itemId:p.id,reference:paragraphPlainText(p.text),title:`${c.name} — Paragraph ${index+1} of ${c.paragraphs.length}`,onDone:()=>studentTests(sid),onCancel:()=>open(),onBack:()=>selectParagraph(sid,cid)});open()}


function latexToFormulaWords(raw, language='hi'){
  let s=String(raw||'');
  // Convert common LaTeX commands into mathematical wording before speech.
  s=s.replace(/\\(?:left|right)\b/g,' ')
   .replace(/\\(?:displaystyle|textstyle|quad|qquad)\b/g,' ')
   .replace(/\\times\b/g,language==='hi'?' गुणा ':' times ')
   .replace(/\\cdot\b|\\cdotp\b/g,language==='hi'?' डॉट ':' dot ')
   .replace(/\\div\b/g,language==='hi'?' भाग ':' divided by ')
   .replace(/\\%/g,language==='hi'?' प्रतिशत ':' percent ')
   .replace(/\\,/g,' ').replace(/\\;/g,' ').replace(/\\!/g,' ')
   .replace(/\\text\s*\{([^{}]*)\}/g,' $1 ')
   .replace(/\\mathrm\s*\{([^{}]*)\}/g,' $1 ')
   .replace(/\\mathbf\s*\{([^{}]*)\}/g,' $1 ')
   .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g,(_,a,b)=>` ${a} ${language==='hi'?'बटा':'over'} ${b} `)
   .replace(/\\sqrt\s*\{([^{}]*)\}/g,(_,a)=>` ${language==='hi'?'वर्गमूल':'square root of'} ${a} `)
   .replace(/\\(?:text|mathrm|operatorname)\b/g,' ')
   .replace(/\\[A-Za-z]+/g,' ')
   .replace(/[{}]/g,' ')
   .replace(/_\s*\{?([0-9]+|[A-Za-z])\}?/g,(_,a)=>` ${language==='hi'?'सबस्क्रिप्ट':'subscript'} ${a} `)
   .replace(/\^\s*\{?([0-9]+|[A-Za-z])\}?/g,(_,a)=>` ${language==='hi'?'पावर':'power'} ${a} `)
   .replace(/\\/g,' ');
  s=s.replace(/Σ/g,language==='hi'?'सिग्मा':'sigma').replace(/Δ/g,language==='hi'?'डेल्टा':'delta').replace(/π/g,language==='hi'?'पाई':'pi').replace(/χ/g,language==='hi'?'काई':'chi').replace(/μ/g,language==='hi'?'म्यू':'mu').replace(/λ/g,language==='hi'?'लैम्ब्डा':'lambda').replace(/Ω/g,language==='hi'?'ओमेगा':'omega');
  const hiLetters={A:'ए',B:'बी',C:'सी',D:'डी',E:'ई',F:'एफ',G:'जी',H:'एच',I:'आई',J:'जे',K:'के',L:'एल',M:'एम',N:'एन',O:'ओ',P:'पी',Q:'क्यू',R:'आर',S:'एस',T:'टी',U:'यू',V:'वी',W:'डब्ल्यू',X:'एक्स',Y:'वाई',Z:'ज़ेड'};
  const enLetters={A:'A',B:'B',C:'C',D:'D',E:'E',F:'F',G:'G',H:'H',I:'I',J:'J',K:'K',L:'L',M:'M',N:'N',O:'O',P:'P',Q:'Q',R:'R',S:'S',T:'T',U:'U',V:'V',W:'W',X:'X',Y:'Y',Z:'Z'};
  const hiNums={'0':'ज़ीरो','1':'वन','2':'टू','3':'थ्री','4':'फोर','5':'फाइव','6':'सिक्स','7':'सेवन','8':'एट','9':'नाइन'};
  const enNums={'0':'zero','1':'one','2':'two','3':'three','4':'four','5':'five','6':'six','7':'seven','8':'eight','9':'nine'};
  s=s.replace(/([A-Za-z])|([0-9])|([₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹])|([()+\-=×→←/%])/g,(m,letter,digit,sub,op)=>{
    if(letter)return (language==='hi'?hiLetters:enLetters)[letter.toUpperCase()]||letter;
    if(digit)return (language==='hi'?hiNums:enNums)[digit]||digit;
    if(sub){const n={'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9','⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'}[sub];return (language==='hi'?hiNums:enNums)[n]||n;}
    const hiOps={'(':'ओपन ब्रैकेट',')':'क्लोज ब्रैकेट','+':'प्लस','-':'माइनस','=':'बराबर','×':'गुणा','→':'रिएक्शन एरो','←':'लेफ्ट एरो','/':'बटा','%':'प्रतिशत'};
    const enOps={'(':'open bracket',')':'close bracket','+':'plus','-':'minus','=':'equals','×':'times','→':'reacts to','←':'left arrow','/':'divided by','%':'percent'};
    return (language==='hi'?hiOps:enOps)[op]||op;
  });
  if(language==='hi')s=s.replace(/\bpercentage\b/gi,'परसेंटेज').replace(/\bsolution\b/gi,'सॉल्यूशन').replace(/\bin\b/gi,'में').replace(/\bMass\b/gi,'मास').replace(/\bVolume\b/gi,'वॉल्यूम');
  return s.replace(/\s+/g,' ').trim();
}
function paragraphSpeechLanguage(text){return /[\u0900-\u097F]/u.test(String(text||''))?'hi':'en';}
function formulaPronunciation(raw,language='hi'){return latexToFormulaWords(raw,language);}
function formulaSpeechEnglish(raw){return latexToFormulaWords(raw,'en');}
function speakHelpText(text,lang='hi-IN'){
  if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance)return alert('इस मोबाइल/browser में Text-to-Speech उपलब्ध नहीं है।');
  window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.82;window.speechSynthesis.speak(u);
}
function stopSpeaker(){if('speechSynthesis' in window)window.speechSynthesis.cancel();}
function extractPronunciationFormulas(text){
  const src=String(text||'').replace(/\u00a0/g,' ').trim();
  const found=[];
  const add=v=>{const x=String(v||'').trim().replace(/^[,;:]+|[,;:]+$/g,'');if(!x)return;if(/^\d+(?:\.\d+)?$/.test(x))return;if(x.length<2)return;if(!found.includes(x))found.push(x);};
  // Whole equations/expressions: keep the complete formula as one pronunciation item.
  const eqRe=/(?:[A-Za-zΑ-Ωα-ωΔΣπμλΩχ√]|\d|[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹]|[+\-×÷=<>≤≥→←≈∝/%^(){}\[\]\/]|\\[A-Za-z]+|\s)+(?:[=→←≈∝]|\\to|\\rightarrow)(?:\s*(?:[A-Za-zΑ-Ωα-ωΔΣπμλΩχ√]|\d|[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹]|[+\-×÷=<>≤≥→←≈∝/%^(){}\[\]\/]|\\[A-Za-z]+|\s)+)/g;
  (src.match(eqRe)||[]).forEach(add);
  // Fractions/roots/LaTeX structures are single formulas.
  (src.match(/\\(?:frac|sqrt)\s*\{[^{}]*\}(?:\s*\{[^{}]*\})?/g)||[]).forEach(add);
  // Compact symbolic formulas: H₂SO₄, x², 10⁻³, ΔH, v=u+at, etc.
  const compactRe=/(?<![\p{L}\p{N}])(?:[A-Za-zΔΣπμλΩχαβγθφ]+(?:[_^](?:\{[^{}]+\}|[A-Za-z0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹+\-]+)|[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹]+)*|\d+(?:[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]+)|[A-Za-zΔΣπμλΩχαβγθφ]+[0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹]+)(?![\p{L}\p{N}])/gu;
  (src.match(compactRe)||[]).forEach(t=>{if(/[A-Za-zΔΣπμλΩχαβγθφ]/u.test(t)&&/[0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹_^{⁻⁺}]/u.test(t))add(t);else if(/[⁻⁺]/u.test(t))add(t);});
  // Standalone Greek/scientific symbols only when they form a recognizable formula with a letter/number.
  const symbolFormulaRe=/(?:Δ|Σ|π|μ|λ|Ω|χ|α|β|γ|θ|φ)[A-Za-z]?\d*[₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺]*/g;
  (src.match(symbolFormulaRe)||[]).forEach(add);
  // Space-separated equations such as F = ma or 2 H₂ + O₂ → 2 H₂O.
  const spaced=src.match(/(?:\b[A-Za-zΔΣπμλΩχαβγθφ0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹]+\b\s*)?(?:[=+\-×÷→←≈∝]\s*[A-Za-zΔΣπμλΩχαβγθφ0-9₀-₉⁰¹²³⁴⁵⁶⁷⁸⁹]+\s*){1,6}/gu)||[];
  spaced.forEach(add);
  return found;
}
function formulaPronunciation(raw,language='hi'){return latexToFormulaWords(raw,language);}
function formulaSpeechEnglish(raw){return latexToFormulaWords(raw,'en');}
function speakHelpText(text,lang='hi-IN'){
  if(!('speechSynthesis' in window)||!window.SpeechSynthesisUtterance)return alert('इस मोबाइल/browser में Text-to-Speech उपलब्ध नहीं है।');
  window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=.82;window.speechSynthesis.speak(u);
}
function stopSpeaker(){if('speechSynthesis' in window)window.speechSynthesis.cancel();}
function showPronunciationHelp(sid,cid,pid,index){
  const c=getChapter(cid),p=c?.paragraphs.find(x=>x.id===pid);if(!p)return;
  const plainParagraph=paragraphPlainText(p.text);
  const formulas=extractPronunciationFormulas(plainParagraph);
  root.innerHTML=`<header><b>Pronunciation Help — Paragraph ${index+1}</b><button onclick="selectParagraph(${sid},${cid})">Back</button></header><main>
  <section class="card"><h2>Original Paragraph</h2><div class="word-result math-paragraph">${renderStoredParagraph(p.text)}</div></section>
  <section class="card"><h3>Formula Pronunciation — फॉर्मूला कैसे बोलें</h3>
  <p class="muted">इस paragraph में मिले हर पूरे formula को एक ही item में दिखाया गया है। किसी formula को अलग-अलग टुकड़ों में नहीं तोड़ा गया है।</p>
  ${formulas.length?formulas.map((f,i)=>`<div class="para formula-pronunciation-item"><p><b>${i+1}. Formula:</b> <span class="formula-original">${esc(f)}</span></p><p><b>हिंदी:</b> ${esc(formulaPronunciation(f,'hi'))}</p><p><b>English:</b> ${esc(formulaPronunciation(f,'en'))}</p><button type="button" data-speak-formula-hi="${i}">🔊 हिंदी में सुनें</button> <button type="button" data-speak-formula-en="${i}">🔊 English में सुनें</button></div>`).join(''):'<p class="muted">इस paragraph में कोई स्पष्ट formula नहीं मिला।</p>'}
  </section>
  <section class="card"><h3>Speaker</h3><p class="muted">Formula की pronunciation को सुनने के लिए ऊपर दिए buttons का उपयोग करें।</p><div class="button-row"><button id="stopWholeParagraph" type="button" class="btn-secondary">⏹ Speaker OFF / Stop</button></div></section>
  </main>`;
  typesetMath(root);
  root.querySelector('#stopWholeParagraph').onclick=stopSpeaker;
  root.querySelectorAll('[data-speak-formula-hi]').forEach(btn=>btn.onclick=()=>speakHelpText(formulaPronunciation(formulas[Number(btn.dataset.speakFormulaHi)],'hi'),'hi-IN'));
  root.querySelectorAll('[data-speak-formula-en]').forEach(btn=>btn.onclick=()=>speakHelpText(formulaPronunciation(formulas[Number(btn.dataset.speakFormulaEn)],'en'),'en-IN'));
}

function getChapter(id){return state.content.flatMap(s=>s.books.flatMap(b=>b.chapters)).find(c=>c.id===id)}
function tokenize(s){return paragraphPlainText(s).normalize('NFKC').match(/[\p{L}\p{M}\p{N}]+(?:['’-][\p{L}\p{M}\p{N}]+)*/gu)||[]}
function renderWords(reference,matched,manualMatched=[]){const set=new Set(matched||[]),manualSet=new Set(manualMatched||[]);let i=0;return tokenize(reference).map(w=>{const cls=['word',set.has(i)?'correct':'',manualSet.has(i)?'manual-added':''].filter(Boolean).join(' ');const html=`<span class="${cls}"${manualSet.has(i)?' title="मैनुअल अंडरलाइन"':''}>${esc(w)}</span>`;i++;return html}).join(' ')}
function renderEditableWords(reference,matched){const set=new Set(matched||[]);return tokenize(reference).map((w,i)=>`<span class="word manual-word ${set.has(i)?'correct speech-detected':''}" data-word-index="${i}" role="button" tabindex="0" aria-pressed="${set.has(i)}" title="Tap to toggle underline">${esc(w)}</span>`).join(' ')}
function bindManualScoreEditor(container,{resultId,reference,matched,studentId,onSaved}){
  const speechDetected=new Set(matched||[]);
  const selected=new Set(matched||[]);
  const manualAdded=new Set();
  const wordsBox=container.querySelector('[data-manual-words]');
  const countEl=container.querySelector('[data-manual-count]');
  const saveBtn=container.querySelector('[data-manual-save]');
  const status=container.querySelector('[data-manual-status]');
  const total=tokenize(reference).length;
  const paint=()=>{
    wordsBox.querySelectorAll('[data-word-index]').forEach(el=>{
      const i=Number(el.dataset.wordIndex),yes=selected.has(i),manual=yes&&manualAdded.has(i),speech=yes&&speechDetected.has(i);
      el.classList.toggle('correct',yes);el.classList.toggle('speech-detected',speech);el.classList.toggle('manual-added',manual);
      el.setAttribute('aria-pressed',String(yes));
      el.title=manual?'मैनुअल अंडरलाइन — नीला':speech?'बोलने से डिटेक्ट हुआ — हरा':'टैप करके अंडरलाइन करें';
    });
    const pct=total?Math.round(selected.size/total*10000)/100:0;
    const speechCount=[...speechDetected].filter(i=>selected.has(i)).length;
    const manualCount=[...manualAdded].filter(i=>selected.has(i)).length;
    countEl.innerHTML=`बोलने से डिटेक्ट: <b>${speechCount}</b> · मैनुअल नीले: <b>${manualCount}</b><br>कुल सही: <b>${selected.size}/${total}</b> शब्द · ${pct}% · <b>${pct>=80?'PASS':'NOT PASS'}</b>`;
  };
  const toggle=el=>{
    const i=Number(el.dataset.wordIndex);
    if(selected.has(i)){selected.delete(i);manualAdded.delete(i)}
    else {selected.add(i);if(!speechDetected.has(i))manualAdded.add(i)}
    paint();
  };
  wordsBox.addEventListener('click',e=>{const el=e.target.closest('[data-word-index]');if(el)toggle(el)});
  wordsBox.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-word-index]')){e.preventDefault();toggle(e.target)}});
  saveBtn.onclick=async()=>{saveBtn.disabled=true;status.textContent='Score save हो रहा है…';try{const r=await api(`/results/${resultId}/matches`,{method:'PUT',body:JSON.stringify({matchedWordIndexes:[...selected],manualWordIndexes:[...manualAdded].filter(i=>selected.has(i))})});status.textContent=`Updated: ${r.correct}/${r.total} words · ${r.percent}% · ${r.passed?'PASS':'NOT PASS'}`;if(onSaved)onSaved(r);if(studentId){const refreshed=await api('/results/'+studentId).catch(()=>null);if(refreshed){refreshed.forEach(a=>{const key=`${a.test_type}:${a.chapter_id}:${a.item_id||0}`;const group=refreshed.filter(x=>`${x.test_type}:${x.chapter_id}:${x.item_id||0}`===key).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));a.attempt_no=group.findIndex(x=>x.id===a.id)+1});window.__attempts=refreshed}}}catch(e){status.textContent=e.message||'Score update नहीं हुआ।'}finally{saveBtn.disabled=false}};
  paint();
}

function speakTest({studentId,chapterId,type,itemId,reference,title,onDone,onCancel,onBack}){
  const displayReference=String(reference??'');
  const plainReference=paragraphPlainText(displayReference);
  if(recognition){try{recognition.stop()}catch{}}
  stopSpeaker();
  const total=tokenize(plainReference).length;
  const previewWords=tokenize(plainReference).slice(0,6).join(' ');
  const listenLabel=type==='qa'?'उत्तर सुनिए':type==='chapter'?'पूरा पैराग्राफ सुनिए':'पैराग्राफ सुनिए';
  root.innerHTML=`<header><b>${esc(title)}</b><button id="exit" class="btn-secondary">Back</button></header><main><section class="card test"><div class="progress"><b>Test</b><span>${total} words</span></div>${displayReference&&((type==='paragraph'||type==='chapter'))?`<div id="testPreview" class="paragraph-preview math-paragraph"><span>Paragraph की शुरुआत</span><div>${esc(previewWords)}${tokenize(plainReference).length>6?' …':''}</div></div>`:''}<p id="testInstruction">Start Test दबाने के बाद paragraph/answer दिखाई नहीं देगा। उसके बाद microphone में बोलें।</p><div class="test-start-row"><button id="start">Start Test</button><button id="listenBeforeTest" class="btn-secondary" type="button">🔊 ${listenLabel}</button><button id="stopBeforeTest" class="btn-secondary" type="button">⏹ बंद कीजिए</button></div><div id="live"></div><div id="score"></div></section></main>`;
  const exit=document.getElementById('exit'),startBtn=document.getElementById('start'),listenBtn=document.getElementById('listenBeforeTest'),stopBtn=document.getElementById('stopBeforeTest'),preview=document.getElementById('testPreview');
  typesetMath(root);
  const speechLang=paragraphSpeechLanguage(plainReference)==='hi'?'hi-IN':'en-IN';
  listenBtn.onclick=()=>speakHelpText(plainReference,speechLang);
  stopBtn.onclick=stopSpeaker;
  exit.onclick=()=>{stopSpeaker();if(recognition){try{recognition.stop()}catch{}};if(onBack)onBack();else refresh()};
  startBtn.onclick=()=>{stopSpeaker();if(preview)preview.hidden=true;startBtn.disabled=true;listenBtn.disabled=true;startBtn.style.display='none';listenBtn.style.display='none';stopBtn.style.display='none';beginRecognition({studentId,chapterId,type,itemId,reference:plainReference,displayReference,title,onDone})};
}

function beginRecognition({studentId,chapterId,type,itemId,reference,displayReference,title,onDone}){
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
  // Chrome Android may replay a final phrase after a recognition session restarts.
  // Remember recent normalized chunks so the same spoken line is not appended repeatedly.
  const recentFinalChunkKeys=[];
  let stopping=false;
  let finished=false;
  let restartTimer=null;
  let submitTimer=null;
  let restartDelay=850;
  let activeRec=null;
  let startInProgress=false;
  let sessionNumber=0;

  const normWord=w=>(w||'').toLocaleLowerCase().replace(/[“”‘’'".,!?;:()[\]{}]/g,'');
  const words=s=>tokenize(s).map(normWord);
  const devMap={'अ':'a','आ':'aa','इ':'i','ई':'ee','उ':'u','ऊ':'oo','ऋ':'ri','ए':'e','ऐ':'ai','ओ':'o','औ':'au','क':'k','ख':'kh','ग':'g','घ':'gh','ङ':'ng','च':'ch','छ':'chh','ज':'j','झ':'jh','ञ':'ny','ट':'t','ठ':'th','ड':'d','ढ':'dh','ण':'n','त':'t','थ':'th','द':'d','ध':'dh','न':'n','प':'p','फ':'f','ब':'b','भ':'bh','म':'m','य':'y','र':'r','ल':'l','व':'v','श':'sh','ष':'sh','स':'s','ह':'h','ड़':'r','ढ़':'rh','़':'','ँ':'n','ं':'n','ः':'h','्':''};
  const devV={'ा':'aa','ि':'i','ी':'ee','ु':'u','ू':'oo','ृ':'ri','े':'e','ै':'ai','ो':'o','ौ':'au','ॉ':'o'};
  const romanize=w=>{let out='';for(const ch of String(w||'').normalize('NFKC'))out+=devV[ch]||devMap[ch]||ch;return out.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g,'')};
  const phonetic=w=>romanize(w).replace(/ph/g,'f').replace(/bh/g,'b').replace(/dh/g,'d').replace(/th/g,'t').replace(/kh/g,'k').replace(/gh/g,'g').replace(/chh/g,'ch').replace(/ch/g,'c').replace(/sh/g,'s').replace(/aa|a+/g,'a').replace(/ee|i+/g,'i').replace(/oo|u+/g,'u').replace(/ai|ay/g,'e').replace(/au|aw/g,'o').replace(/tion/g,'shan').replace(/sion/g,'zhan').replace(/c/g,'k').replace(/q/g,'k').replace(/x/g,'ks').replace(/v/g,'w').replace(/j/g,'y').replace(/[aeiou]+/g,'a').replace(/([a-z])\1+/g,'$1').replace(/a$/,'');
  const edit=(x,y)=>{const A=[...x],B=[...y];if(!A.length||!B.length)return 0;let prev=Array(B.length+1).fill(0).map((_,j)=>j);for(let i=1;i<=A.length;i++){const cur=[i];for(let j=1;j<=B.length;j++)cur[j]=Math.min(prev[j]+1,cur[j-1]+1,prev[j-1]+(A[i-1]===B[j-1]?0:1));prev=cur;}return 1-prev[B.length]/Math.max(A.length,B.length)};const crossAliasPairs=[['speculation','स्पेकुलेशन'],['chemistry','केमिस्ट्री'],['physics','फिजिक्स'],['biology','बायोलॉजी'],['computer','कंप्यूटर'],['equation','इक्वेशन'],['molecule','मॉलिक्यूल'],['formula','फॉर्मूला'],['chapter','चैप्टर'],['paragraph','पैराग्राफ'],['question','क्वेश्चन'],['answer','आंसर'],['percentage','परसेंटेज'],['solution','सॉल्यूशन'],['reaction','रिएक्शन'],['velocity','वेलोसिटी'],['acceleration','एक्सेलेरेशन'],['force','फोर्स'],['mass','मास'],['volume','वॉल्यूम'],['atom','एटम'],['electron','इलेक्ट्रॉन'],['proton','प्रोटॉन'],['neutron','न्यूट्रॉन'],['oxygen','ऑक्सीजन'],['hydrogen','हाइड्रोजन'],['carbon','कार्बन'],['nitrogen','नाइट्रोजन'],['glucose','ग्लूकोज'],['photosynthesis','फोटोसिंथेसिस']];const crossAlias=(x,y)=>crossAliasPairs.some(g=>g.includes(String(x||'').toLowerCase())&&g.includes(String(y||'').toLowerCase()));const sim=(x,y)=>{if(crossAlias(x,y))return .94;x=romanize(x);y=romanize(y);if(x===y)return 1;const px=phonetic(x),py=phonetic(y);if(px&&px===py)return .94;if(px&&py&&Math.min(px.length,py.length)>=4){const ps=edit(px,py);if(ps>=.64&&Math.abs(px.length-py.length)<=3)return Math.min(.94,.82+(ps-.64)*.34)}const score=edit(x,y);return score>=.82&&Math.min(x.length,y.length)>=4?score:0};
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
    for(const w of a){let best=0;for(const t of target)best=Math.max(best,sim(w,t));if(best>=.82)hits+=best;}
    return hits*3-Math.max(0,a.length-hits)*.15;
  };

  // Select the recognition language from the next words, so mixed Hindi/English
  // paragraphs can switch language when Chrome naturally restarts its short sessions.
  const languageForNextWords=()=>{
    const pos=words(finalParts.join(' ')).length;
    const upcoming=referenceWords.slice(pos,Math.min(referenceWords.length,pos+12));
    let hindi=0,english=0;
    for(const w of upcoming){
      if(/[\u0900-\u097F]/u.test(w))hindi++;
      else if(/[A-Za-z]/u.test(w))english++;
    }
    if(hindi===0&&english===0)return hasHindi?'hi-IN':'en-IN';
    return hindi>=english?'hi-IN':'en-IN';
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
    const key=words(t).join(' '); if(!key)return;
    const prev=lastFinalText.trim();
    const incoming=key.split(' '), accumulated=words(finalParts.join(' '));
    const expectedAtCurrent=referenceWords.slice(accumulated.length,accumulated.length+incoming.length).map(normWord).join(' ');
    if(recentFinalChunkKeys.includes(key)&&expectedAtCurrent!==key)return;
    // Ignore a repeated multi-word phrase replayed by Chrome after auto-restart.
    if(incoming.length>=5){
      outer: for(let i=Math.max(0,accumulated.length-100);i<=accumulated.length-incoming.length;i++){
        for(let j=0;j<incoming.length;j++)if(accumulated[i+j]!==incoming[j])continue outer;
        const nextPos=words(finalParts.join(' ')).length;
        const expected=referenceWords.slice(nextPos,nextPos+incoming.length).map(normWord).join(' ');
        if(expected!==key)return;
      }
    }
    let add=t;
    if(prev && (t===prev || words(prev).join(' ').endsWith(key)))return;
    if(accumulated.length){
      let overlap=0;const max=Math.min(40,accumulated.length,incoming.length);
      for(let n=max;n>=1;n--){if(accumulated.slice(-n).join(' ')===incoming.slice(0,n).join(' ')){overlap=n;break}}
      if(overlap)add=tokenize(t).slice(overlap).join(' ');
    }
    if(add){finalParts.push(add);recentFinalChunkKeys.push(key);if(recentFinalChunkKeys.length>12)recentFinalChunkKeys.shift();}
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
      const sameAttempts=await api('/results/'+studentId).catch(()=>[]); const key=`${type}:${chapterId}:${itemId||0}`; const attemptNo=sameAttempts.filter(x=>`${x.test_type}:${x.chapter_id}:${x.item_id||0}`===key).length; score.innerHTML=`<h3>Score: <span id="manualScorePercent">${r.percent}%</span></h3><p id="manualScoreSummary">${r.correct}/${r.total} words correct — <b>${r.passed?'PASS':'NOT PASS'}</b></p><p class="muted">हरे अंडरलाइन वाले शब्द बोलने से डिटेक्ट हुए हैं। जो शब्द छूट गए, उन्हें टैप करें—वे नीले हो जाएँगे। गलत अंडरलाइन हटाने के लिए उस शब्द पर फिर टैप करें।</p><div class="word-result" data-manual-words>${renderEditableWords(r.referenceText,r.matched)}</div><p><b data-manual-count></b></p><button type="button" data-manual-save>✓ Manual underline save करके score दोबारा निकालें</button><p class="muted" data-manual-status>शब्दों पर टैप करके सही मिलान ठीक करें, फिर Save दबाएँ।</p><p class="muted">WhatsApp message अपने-आप नहीं भेजा जाता।</p><button id="nextButton" type="button">${onDone?'Next':'Done'}</button>`;
      bindManualScoreEditor(score,{resultId:r.resultId,reference:r.referenceText,matched:r.matched,studentId,onSaved:updated=>{r.percent=updated.percent;r.correct=updated.correct;r.total=updated.total;r.passed=updated.passed;r.matched=updated.matched;document.getElementById('manualScorePercent').textContent=`${updated.percent}%`;document.getElementById('manualScoreSummary').innerHTML=`${updated.correct}/${updated.total} words correct — <b>${updated.passed?'PASS':'NOT PASS'}</b>`}});
      document.getElementById('nextButton').onclick=()=>onDone?onDone(r):refresh();
    }catch(e){
      statusEl.textContent=e.message||'Test score नहीं हो सका।'; stopBtn.disabled=false; finished=false;
    }
  };

  const scheduleRestart=()=>{
    if(stopping||finished||restartTimer||startInProgress)return;
    const delay=Math.max(450,restartDelay);
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
    rec.lang=languageForNextWords();

    rec.onstart=()=>{
      startInProgress=false; restartDelay=450;
      statusEl.textContent='Listening… बोलते रहें।'; dot.classList.add('active'); stopBtn.disabled=false;
    };
    rec.onspeechstart=()=>{statusEl.textContent='आपकी आवाज़ सुनाई दे रही है…';dot.classList.add('active');};
    rec.onspeechend=()=>{if(!stopping)statusEl.textContent='Pause/रुकावट मिली—माइक चालू है, बोलना जारी रखें…';};

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
        // Let this recognition instance finish first. onend will restart it;
        // starting a second instance here can leave Android Chrome's mic busy.
        statusEl.textContent='आवाज़ नहीं मिली—माइक फिर से शुरू होगा। बोलते रहें…';
        restartDelay=450;
        return;
      }
      if(e.error==='network'){
        // SpeechRecognition is network-backed in Chrome. Back off, then let
        // onend restart the same flow instead of opening overlapping sessions.
        restartDelay=Math.min(3000,Math.max(600,restartDelay*2));
        statusEl.textContent='Speech service से कनेक्शन दोबारा जोड़ा जा रहा है…';
        return;
      }
      if(e.error==='not-allowed'||e.error==='service-not-allowed'){
        statusEl.textContent='Microphone permission बंद है। Chrome में microphone permission Allow करें।';
        stopping=true; stopBtn.disabled=true; return;
      }
      // For recoverable errors, wait for onend before restarting. This avoids
      // two recognizers competing for the microphone on Android.
      restartDelay=Math.max(300,restartDelay);
      statusEl.textContent='Speech फिर से शुरू हो रही है…';
    };

    rec.onend=()=>{
      if(activeRec!==rec)return;
      dot.classList.remove('active');
      if(finished)return;
      if(stopping){activeRec=null;recognition=null;submitTimer=setTimeout(submitResult,300);return;}
      activeRec=null; recognition=null; startInProgress=false;
      interimText=''; renderLive();
      statusEl.textContent='माइक फिर से शुरू हो रहा है…';
      restartDelay=Math.max(450,restartDelay); scheduleRestart();
    };

    try{rec.start();}
    catch(e){
      startInProgress=false;
      if(activeRec===rec){activeRec=null;recognition=null;}
      if(!stopping&&!finished){restartDelay=Math.min(3000,Math.max(600,restartDelay*2));scheduleRestart();}
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
function showChapterReady(sid,cid){const c=getChapter(cid);root.innerHTML=`<header><b>${esc(c.name)}</b><button class="btn-secondary" onclick="studentChapterFlow(${sid},${cid})">Back</button></header><main><section class="card"><h2>All Paragraphs Completed</h2><p>अब पूरा chapter test दिया जा सकता है।</p><button onclick="startChapterTest(${sid},${cid})">Start Complete Chapter Test</button></section></main>`}
function startQaTest(sid,cid){const c=getChapter(cid);if(!c?.qa.length)return alert('No Q&A');let index=0;const run=()=>{const q=c.qa[index];speakTest({studentId:sid,chapterId:cid,type:'qa',itemId:q.id,reference:q.answer,title:`Q&A ${index+1} of ${c.qa.length} — ${q.question}`,onDone:()=>{index++;if(index<c.qa.length)run();else refresh()}})};run()}
function startChapterTest(sid,cid){const c=getChapter(cid);if(!c?.paragraphs.length)return alert('No paragraph content');const reference=c.paragraphs.slice().sort((a,b)=>Number(a.position||0)-Number(b.position||0)).map(p=>paragraphPlainText(p.text)).join('\n\n');speakTest({studentId:sid,chapterId:cid,type:'chapter',itemId:null,reference,title:`${c.name} — Complete Paragraph Test`,onDone:()=>studentTests(sid),onCancel:()=>startChapterTest(sid,cid),onBack:()=>selectCompleteChapter(sid,cid)})}
function showProgressChart(sid,cid,itemId,type,label,backMode){
  let rows=(window.__attempts||[]).filter(r=>r.chapter_id===cid&&((type==='chapter'&&r.test_type==='chapter')||(type!=='chapter'&&r.test_type===type&&r.item_id===itemId))).sort((a,b)=>new Date(a.created_at)-new Date(b.created_at));
  const title=String(label||'Progress');
  const max=100,min=0,W=360,H=190,L=38,R=12,T=18,B=34;
  const plotW=W-L-R,plotH=H-T-B;
  const pts=rows.map((r,i)=>{const pct=Math.max(min,Math.min(max,Number(r.score_percent)||0));const x=rows.length===1?L+plotW/2:L+(i/(rows.length-1))*plotW;const y=T+(1-pct/100)*plotH;return {x,y,pct,r,i};});
  const poly=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const grid=[0,25,50,75,100].map(v=>{const y=T+(1-v/100)*plotH;return `<line x1="${L}" y1="${y}" x2="${W-R}" y2="${y}" class="progress-grid-line"/><text x="${L-7}" y="${y+4}" text-anchor="end" class="progress-axis-label">${v}%</text>`}).join('');
  const line=pts.length>1?`<polyline points="${poly}" class="progress-line" fill="none"/>`:'';
  const dots=pts.map(p=>`<circle cx="${p.x}" cy="${p.y}" r="4.5" class="progress-dot"><title>Attempt ${p.i+1}: ${p.pct.toFixed(2)}%</title></circle>`).join('');
  const trend=rows.length<2?'अभी पर्याप्त attempts नहीं हैं।':Number(rows.at(-1).score_percent)>Number(rows[0].score_percent)?'कुल मिलाकर progress ऊपर गई है 📈':Number(rows.at(-1).score_percent)<Number(rows[0].score_percent)?'कुल मिलाकर accuracy कम हुई है 📉':'Accuracy लगभग समान रही है ➖';
  const back=backMode==='paragraph'?`selectParagraph(${sid},${cid})`:backMode==='qa'?`selectQaItems(${sid},${cid})`:`studentChapterFlow(${sid},${cid})`;
  root.innerHTML=`<header><b>${esc(title)} — Progress Chart</b><button class="btn-secondary" onclick="${back}">Back</button></header><main><section class="card progress-chart-card"><h2>📈 ${esc(title)} की Progress</h2><p class="muted">हर saved test attempt का percentage क्रम से दिखाया गया है। Chart ऊपर जाए तो accuracy बढ़ी है और नीचे जाए तो accuracy कम हुई है।</p><div class="progress-chart-wrap"><svg class="progress-chart-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)} progress chart">${grid}<line x1="${L}" y1="${T+plotH}" x2="${W-R}" y2="${T+plotH}" class="progress-axis"/>${line}${dots}</svg></div><div class="progress-trend">${esc(trend)}</div>${rows.length?`<div class="progress-attempt-list">${rows.map((r,i)=>`<div class="progress-attempt-row"><span><b>Attempt ${i+1}</b><small>${new Date(r.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</small></span><strong>${Number(r.score_percent).toFixed(2)}%</strong></div>`).join('')}</div>`:'<p class="muted">इस test का अभी कोई saved attempt नहीं है। Test पूरा करने के बाद यहाँ progress chart दिखाई देगा।'}</section></main>`;
}

function showUnderlineHistory(sid,cid,itemId,type,title,backMode){
  let rows=(window.__attempts||[]).filter(r=>r.chapter_id===cid&&((type==='chapter'&&r.test_type==='chapter')||(type!=='chapter'&&r.test_type===type&&r.item_id===itemId))).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
  const c=getChapter(cid);
  const paragraph=itemId&&type==='paragraph'?c?.paragraphs?.find(p=>p.id===itemId):null;
  const qa=itemId&&type==='qa'?c?.qa?.find(q=>q.id===itemId):null;
  const back=backMode==='paragraph'?`selectParagraph(${sid},${cid})`:backMode==='qa'?`selectQaItems(${sid},${cid})`:`studentChapterFlow(${sid},${cid})`;
  root.innerHTML=`<header><b>${esc(title||'Test')} — Underline History</b><button class="btn-secondary" onclick="${back}">Back</button></header><main><section class="card"><h2>📋 Underline-wise Result History</h2><p class="muted">इस ${type==='qa'?'answer':type==='chapter'?'Complete Paragraph':'paragraph'} के सभी saved attempts की underlined result view नीचे है।</p>${rows.length?rows.map((r,i)=>{const reference=r.reference_text||r.paragraph_text||r.qa_answer||(paragraph?paragraphPlainText(paragraph.text):qa?.answer)||'';const matched=r.matched_word_indexes||r.matched||[];const manual=r.manual_word_indexes||r.manualWordIndexes||[];return `<article class="underline-history-card"><div class="attempt-row"><span><b>Attempt ${i+1}</b><br><small>${new Date(r.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'})}</small></span><strong>${Number(r.score_percent).toFixed(2)}%</strong><button class="result-link" onclick="showAttemptResult(${r.id})">Open Result</button></div><div class="math-paragraph underline-history-text">${renderWords(reference,matched,manual)}</div></article>`}).join(''):'<p class="muted">अभी इस item का कोई saved attempt नहीं है।</p>'}</section></main>`;typesetMath(root);
}

function showItemHistory(sid,cid,itemId,type,position){const rows=(window.__attempts||[]).filter(r=>r.chapter_id===cid&&r.item_id===itemId&&r.test_type===type).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));root.innerHTML=`<header><b>Paragraph ${position} — Result History</b><button class="btn-secondary" onclick="selectParagraph(${sid},${cid})">Back</button></header><main><section class="card"><h2>Previous Attempts</h2>${rows.length?rows.map(r=>`<div class="attempt-row"><span>${new Date(r.created_at).toLocaleString()}</span><button class="result-link" onclick="showAttemptResult(${r.id})">${Number(r.score_percent).toFixed(2)}%</button></div>`).join(''):'<p class="muted">अभी कोई saved attempt नहीं है।</p>'}</section></main>`}
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
  const wrap=document.createElement('div');wrap.id='pdfReportTemp';wrap.innerHTML=`<div class="pdf-report"><h1>Tuition Student Test Report</h1><p><b>Student:</b> ${esc(st.name)}<br><b>Class:</b> ${esc(st.class_name||'')}</p><section class="pdf-section"><h2>${esc(c?.subjectName||'Subject')} → ${esc(c?.bookName||'Book')} → ${esc(c?.name||'Chapter')} → Paragraph ${esc(arr[0].paragraph_position||'')}</h2><h3>Original Paragraph</h3><p class="pdf-original math-paragraph">${renderStoredParagraph(arr[0].reference_text||p.text||'')}</p><h3>Test Attempts</h3>${arr.map((a,i)=>{const ref=a.reference_text||p.text||'';return `<div class="pdf-attempt"><h4>Attempt ${i+1}</h4><p><b>Score:</b> ${Number(a.score_percent).toFixed(2)}% &nbsp; <b>Words:</b> ${a.correct_words}/${a.total_words} &nbsp; <b>Result:</b> ${a.passed?'PASS':'NOT PASS'}</p><div class="pdf-words">${renderWords(ref,a.matched_word_indexes||a.matched||[],a.manual_word_indexes||a.manualWordIndexes||[])}</div></div>`}).join('')}</section></div>`;
  Object.assign(wrap.style,{position:'absolute',left:'0px',top:'0px',width:'794px',background:'#fff',color:'#111',zIndex:'2147483647',pointerEvents:'none'});document.body.appendChild(wrap);
  try{
    if(window.MathJax?.typesetPromise)await window.MathJax.typesetPromise([wrap]).catch(()=>{});if(document.fonts&&document.fonts.ready)await document.fonts.ready;await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
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
function showAttemptResult(id){const r=(window.__attempts||[]).find(x=>x.id===id);if(!r)return;const reference=r.reference_text||r.paragraph_text||r.qa_answer||'';const label=r.test_type==='paragraph'?`Paragraph ${r.paragraph_position||''}`:r.test_type==='qa'?'Q&A':'Complete Chapter';const matched=r.matched_word_indexes||r.matched||[];const attemptDateTime=new Date(r.created_at).toLocaleString('en-IN',{dateStyle:'medium',timeStyle:'short'});root.innerHTML=`<header><b>Attempt ${r.attempt_no} — ${esc(label)}</b><button onclick="studentTests(${r.student_id})">Back</button></header><main><section class="card"><h2>Score: ${Number(r.score_percent).toFixed(2)}%</h2><p><b>Test Date & Time:</b> ${esc(attemptDateTime)}</p><p>${r.correct_words}/${r.total_words} words correct — <b>${r.passed?'PASS':'NOT PASS'}</b></p>${r.question?`<div class="attempt-question"><b>Question:</b><p>${esc(r.question)}</p></div>`:''}<h3>Original Paragraph / Answer</h3><div class="math-paragraph original-test-text">${renderStoredParagraph(reference)}</div><h3>Word Matching</h3><div class="word-result">${renderWords(reference,matched,r.manual_word_indexes||r.manualWordIndexes||[])}</div></section></main>`;typesetMath(root)}
function editChapterParagraphs(cid){const c=getChapter(cid);if(!c)return;closeParagraphCamera();root.innerHTML=`<header><b>${esc(c.name)} — Paragraphs</b><button class="btn-secondary" onclick="teacherChapterFlow(${state.content.find(s=>s.books.some(b=>b.chapters.some(x=>x.id===cid)))?.id},${state.content.flatMap(s=>s.books).find(b=>b.chapters.some(x=>x.id===cid))?.id},${cid})">Back</button></header><main><section class="card"><h2>Paragraphs (${c.paragraphs.length})</h2>${c.paragraphs.map((p,i)=>`<div class="para"><label for="p${p.id}">Paragraph ${i+1}</label><div id="p${p.id}" class="rich-paragraph-editor" contenteditable="true" spellcheck="false">${richEditorHtml(p.text)}</div><div class="button-row"><button class="btn-secondary" onclick="pasteIntoField('p${p.id}')">📋 Paste (Book Format)</button>${formulaInsertButtonHtml()}<button onclick="savePara(${p.id})">Save</button><button class="btn-danger" onclick="deleteParagraph(${p.id},${cid},${i+1})">Delete</button>${i<c.paragraphs.length-1?`<button class="btn-secondary" onclick="mergePara(${p.id},${c.paragraphs[i+1].id})">Merge next</button>`:''}</div></div>`).join('')}<button onclick="addPara(${cid})">+ Add Paragraph</button><button class="btn-secondary" onclick="editChapterName(${cid})">Edit Chapter Name</button></section></main>`}
function editChapterQA(cid){const c=getChapter(cid);if(!c)return;closeParagraphCamera();root.innerHTML=`<header><b>${esc(c.name)} — Question-Answer</b><button class="btn-secondary" onclick="teacherChapterFlow(${state.content.find(s=>s.books.some(b=>b.chapters.some(x=>x.id===cid)))?.id},${state.content.flatMap(s=>s.books).find(b=>b.chapters.some(x=>x.id===cid))?.id},${cid})">Back</button></header><main><section class="card"><h2>Add Question & Answer</h2><label for="q">Question</label><input id="q" placeholder="प्रश्न लिखें या पेस्ट करें"><div class="button-row"><button class="btn-secondary" onclick="pasteIntoField('q')">📋 Paste Question</button><button class="btn-secondary" onclick="openParagraphCamera('q')">🖼️ Gallery OCR</button></div><label for="a">Correct answer</label><textarea id="a" rows="5" placeholder="सही उत्तर लिखें या पेस्ट करें"></textarea><div class="button-row"><button class="btn-secondary" onclick="pasteIntoField('a')">📋 Paste Answer</button><button class="btn-secondary" onclick="openParagraphCamera('a')">🖼️ Gallery OCR</button></div>${cameraPanelHtml()}<button onclick="addQA(${cid})">+ Add Q&A</button></section><section class="card"><h2>Saved Q&A (${c.qa.length})</h2>${c.qa.map((x,i)=>`<div class="qa"><div class="qa-number">Q&A ${i+1}</div><b>${esc(x.question)}</b><p>${esc(x.answer)}</p></div>`).join('')||'<p class="muted">अभी Q&A नहीं है।</p>'}</section></main>`}
function editChapter(cid){const c=getChapter(cid);closeParagraphCamera();root.innerHTML=`<header><div class="header-title"><span class="header-eyebrow">CHAPTER EDITOR</span><b>${esc(c.name)}</b></div><button class="btn-secondary" type="button" onclick="refresh()">Back</button></header><main><section class="card"><div class="section-heading"><h2>Chapter settings</h2></div><button class="btn-secondary" onclick="editChapterName(${cid})">✎ Edit Chapter Name</button></section><section class="card"><div class="section-heading"><div><div class="section-kicker">READING CONTENT</div><h2>Paragraphs</h2></div><span class="count-pill">${c.paragraphs.length} total</span></div><p class="muted">हर पैराग्राफ का टेक्स्ट बदल सकते हैं। कॉपी किया हुआ टेक्स्ट पेस्ट करने के लिए Paste बटन दबाएँ। अगले पैराग्राफ से जोड़ने का विकल्प भी उपलब्ध है।</p>${c.paragraphs.map((p,i)=>`<div class="para"><label for="p${p.id}">Paragraph ${i+1}</label><div id="p${p.id}" class="rich-paragraph-editor" contenteditable="true" spellcheck="false">${richEditorHtml(p.text)}</div><div class="button-row"><button class="btn-secondary" onclick="pasteIntoField('p${p.id}')">📋 Paste (Book Format)</button>${formulaInsertButtonHtml()}<button onclick="savePara(${p.id})">Save</button><button class="btn-danger" onclick="deleteParagraph(${p.id},${cid},${i+1})">Delete Paragraph</button>${i<c.paragraphs.length-1?`<button class="btn-secondary" onclick="mergePara(${p.id},${c.paragraphs[i+1].id})">Merge with next</button>`:''}</div></div>`).join('')}<button type="button" onclick="addPara(${cid})">+ Add Paragraph</button></section><section class="card"><div class="section-kicker">QUESTION PRACTICE</div><h2>Add Question & Answer</h2><p class="muted">प्रश्न और उत्तर टाइप/पेस्ट करें या Gallery की फोटो से टेक्स्ट पहचानकर संबंधित फ़ील्ड में डालें।</p><label for="q">Question</label><input id="q" placeholder="यहाँ प्रश्न लिखें या पेस्ट करें"><div class="button-row field-actions"><button type="button" class="btn-secondary" onclick="pasteIntoField('q')">📋 Question Paste</button><button type="button" class="btn-secondary" onclick="openParagraphCamera('q')">🖼️ Question Gallery OCR</button></div><label for="a">Correct answer</label><textarea id="a" rows="5" placeholder="यहाँ सही उत्तर लिखें या पेस्ट करें"></textarea><div class="button-row field-actions"><button type="button" class="btn-secondary" onclick="pasteIntoField('a')">📋 Answer Paste</button><button type="button" class="btn-secondary" onclick="openParagraphCamera('a')">🖼️ Answer Gallery OCR</button></div>${cameraPanelHtml()}<div class="form-actions"><button onclick="addQA(${cid})">+ Add Q&A</button></div></section>${c.qa.length?`<section class="card"><div class="section-kicker">SAVED ITEMS</div><h2>Existing Q&A</h2>${c.qa.map((x,i)=>`<div class="qa"><div class="qa-number">Q&A ${i+1}</div><b>${esc(x.question)}</b><p>${esc(x.answer)}</p></div>`).join('')}</section>`:''}</main>`}
async function savePara(id){try{const text=richParagraphPayload('p'+id);if(!text)return alert('Paragraph खाली है।');await api('/paragraphs/'+id,{method:'PUT',body:JSON.stringify({text})});await refresh()}catch(e){alert(e.message)}}
async function deleteParagraph(id,cid,number){if(!confirm(`पहली पुष्टि: क्या Paragraph ${number} delete करना चाहते हैं?`))return;if(!confirm('दूसरी पुष्टि: यह paragraph स्थायी रूप से हट जाएगा। पुराने saved test results/history को सुरक्षित रखने का प्रयास किया जाएगा। क्या delete करें?'))return;try{await api('/paragraphs/'+id,{method:'DELETE'});await editChapter(cid)}catch(e){alert(e.message)}}
async function mergePara(firstId,secondId){if(!confirm('इन दोनों paragraphs को एक में merge करें?'))return;try{await api('/paragraphs/merge',{method:'POST',body:JSON.stringify({firstId,secondId})});await refresh()}catch(e){alert(e.message)}}
let paragraphCameraStream=null;
let paragraphCameraTargetId='newParagraphText';
let paragraphCameraCapturedCanvas=null;
let paragraphCameraTrack=null;
let paragraphCameraZoom=1;
let paragraphCameraTorch=false;
let paragraphLensMode=false;
function closeParagraphCamera(){
  const panel=document.getElementById('paragraphCameraPanel');
  if(panel)panel.hidden=true;
  const input=document.getElementById('paragraphGalleryInput');
  if(input)input.value='';
  paragraphCameraCapturedCanvas=null;
  paragraphLensMode=false;
}
function cameraPanelHtml(){return `<div id="paragraphCameraPanel" class="camera-panel" hidden><div class="camera-panel-heading"><div><b>Gallery Image OCR</b><p class="muted">फोन की Gallery से अपनी फोटो चुनें। Formula वाले हिस्सों में superscript, subscript और fraction को पहचानकर mathematical format में बदलने की कोशिश की जाएगी। फोटो ऐप/server पर सेव नहीं की जाती।</p></div><button type="button" class="btn-secondary" onclick="closeParagraphCamera()">बंद करें</button></div><div class="button-row camera-actions"><button type="button" onclick="chooseParagraphGalleryImage()">🖼️ Gallery से फोटो चुनें</button><input id="paragraphGalleryInput" type="file" accept="image/*" hidden onchange="scanParagraphGalleryImage(this)"></div><div id="galleryOcrResultBox" hidden><label for="galleryOcrResult"><b>OCR से पहचाना गया टेक्स्ट / Formula</b></label><div id="galleryOcrResult" class="rich-ocr-result" contenteditable="true" spellcheck="false" data-placeholder="फोटो से पहचाना गया टेक्स्ट यहाँ आएगा…"></div><div class="button-row camera-actions"><button type="button" class="btn-secondary" onclick="copyGallerySelectedText()">📋 Copy Selected</button><button type="button" class="btn-secondary" onclick="copyGalleryAllText()">📋 Copy All</button><button type="button" class="btn-secondary" onclick="shareGalleryText()">↗️ Share Text</button><button type="button" onclick="pasteGalleryTextToParagraph()">⬇️ Paragraph में Paste</button></div></div><p id="paragraphCameraStatus" class="camera-status" aria-live="polite">Gallery से फोटो चुनकर OCR करें।</p></div>`}
async function loadTesseract(){if(window.Tesseract)return window.Tesseract;await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';script.onload=resolve;script.onerror=()=>reject(new Error('OCR library लोड नहीं हुई। इंटरनेट कनेक्शन जाँचें।'));document.head.appendChild(script)});return window.Tesseract;}
async function openParagraphCamera(targetId='newParagraphText'){paragraphCameraTargetId=targetId;paragraphLensMode=false;const panel=document.getElementById('paragraphCameraPanel');const status=document.getElementById('paragraphCameraStatus');if(panel)panel.hidden=false;if(status)status.textContent='Gallery से अपनी फोटो चुनें। फोटो कैमरे से नहीं ली जाएगी।';chooseParagraphGalleryImage();}
async function copyGallerySelectedText(){
  const box=document.getElementById('galleryOcrResult');if(!box)return;
  const sel=window.getSelection();
  if(!sel||!sel.rangeCount||!box.contains(sel.anchorNode)){alert('पहले OCR टेक्स्ट में जरूरी हिस्सा select करें।');return;}
  let range=sel.getRangeAt(0),holder=document.createElement('div');
  try{holder.appendChild(range.cloneContents());}catch{holder.innerHTML=esc(sel.toString());}
  if(!holder.innerHTML.trim()){
    const node=sel.anchorNode?.nodeType===Node.ELEMENT_NODE?sel.anchorNode:sel.anchorNode?.parentElement;
    const line=node?.closest?.('.ocr-book-line,.formula-known');if(line)holder.innerHTML=line.outerHTML;
  }
  const html=sanitizeRichHtml(holder.innerHTML),plain=formulaAwareClipboardText(paragraphPlainText(RICH_PREFIX+html)||sel.toString());
  if(!plain.trim()&&!html.trim()){alert('Selected text खाली है।');return;}
  try{if(navigator.clipboard?.write&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);alert('Selected corrected text और formula formatting copy हो गया।');return;}}catch{}
  try{await navigator.clipboard.writeText(plain);alert('Corrected text copy हो गया।');}catch{alert('Selected text copy नहीं हो पाया।')}
}
async function copyGalleryAllText(){
  const box=document.getElementById('galleryOcrResult');if(!box)return;
  const html=box.innerHTML,plain=formulaAwareClipboardText(paragraphPlainText(RICH_PREFIX+html)||box.innerText);
  if(!plain.trim()){alert('पहले फोटो का OCR करें।');return;}
  try{if(navigator.clipboard?.write&&window.ClipboardItem){await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([html],{type:'text/html'}),'text/plain':new Blob([plain],{type:'text/plain'})})]);alert('पूरा corrected OCR text और formula formatting copy हो गया।');return;}}catch{}
  try{await navigator.clipboard.writeText(plain);alert('पूरा corrected OCR text copy हो गया।');return;}catch{}
  try{const sel=window.getSelection(),range=document.createRange();range.selectNodeContents(box);sel.removeAllRanges();sel.addRange(range);const ok=document.execCommand('copy');sel.removeAllRanges();if(ok){alert('OCR text copy हो गया।');return;}}catch{}
  alert('Clipboard copy नहीं हो पाया। “Paragraph में Paste” से सीधे जोड़ें।');
}
async function shareGalleryText(){
  const box=document.getElementById('galleryOcrResult');if(!box)return;
  const text=formulaAwareClipboardText(paragraphPlainText(RICH_PREFIX+box.innerHTML)||box.innerText);
  if(!text.trim()){alert('पहले फोटो का OCR करें।');return;}
  try{if(navigator.share){await navigator.share({title:'Easyway Learn OCR Text',text});}else{await navigator.clipboard.writeText(text);alert('Share इस device/browser में उपलब्ध नहीं है। Corrected text clipboard में copy कर दिया गया है।')}}catch(e){if(e?.name!=='AbortError'){try{await navigator.clipboard.writeText(text);alert('Share नहीं खुल सका। Corrected text clipboard में copy कर दिया गया है।')}catch{}}}
}
async function pasteGalleryTextToParagraph(){const box=document.getElementById('galleryOcrResult');const target=document.getElementById(paragraphCameraTargetId);if(!box||!target)return;const selected=window.getSelection();let html='',text='';if(selected&&selected.rangeCount&&box.contains(selected.anchorNode)){const range=selected.getRangeAt(0);const frag=range.cloneContents();const holder=document.createElement('div');holder.appendChild(frag);html=holder.innerHTML;text=paragraphPlainText(RICH_PREFIX+html);}else{html=box.innerHTML;text=paragraphPlainText(RICH_PREFIX+html);}text=formulaAwareClipboardText(text||box.innerText);if(!text.trim()&&!html.trim()){alert('पहले फोटो का OCR करें।');return;}if(target.isContentEditable){if(target.innerText.trim())document.execCommand('insertHTML',false,'<br><br>'+html);else target.innerHTML=html;}else{const plain=text.trim();const existing=String(target.value||'').trim();target.value=existing?existing+'\n\n'+plain:plain;}target.dispatchEvent(new Event('input',{bubbles:true}));target.focus();const status=document.getElementById('paragraphCameraStatus');if(status)status.textContent='OCR टेक्स्ट Paragraph में paste हो गया; formulas की fraction/superscript/subscript formatting रखी गई है।'}
async function chooseParagraphGalleryImage(){
  const input=document.getElementById('paragraphGalleryInput');
  if(!input){alert('Gallery विकल्प नहीं मिला। फ़ॉर्म को दोबारा खोलकर कोशिश करें।');return;}
  input.value='';input.click();
}
async function scanParagraphGalleryImage(input){const status=document.getElementById('paragraphCameraStatus');const file=input?.files?.[0];if(!file)return;if(!file.type?.startsWith('image/')){if(status)status.textContent='कृपया Gallery से केवल image चुनें।';input.value='';return;}const target=document.getElementById(paragraphCameraTargetId),resultBox=document.getElementById('galleryOcrResult');if(!target||!resultBox){if(status)status.textContent='Text field नहीं मिला। दोबारा कोशिश करें।';input.value='';return;}try{if(status)status.textContent='Gallery photo तैयार की जा रही है…';const url=URL.createObjectURL(file);try{const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('इमेज पढ़ी नहीं जा सकी।'));i.src=url;});const maxSide=4200,scale=Math.min(1.6,maxSide/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((img.naturalWidth||img.width)*scale));canvas.height=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(img,0,0,canvas.width,canvas.height);const box=document.getElementById('galleryOcrResultBox');if(box)box.hidden=false;resultBox.innerHTML='';await scanParagraphSource(canvas,resultBox,status,{appendToTarget:false});}finally{URL.revokeObjectURL(url);}}catch(e){if(status)status.textContent='Gallery OCR नहीं हो पाया: '+(e.message||'कृपया साफ फोटो चुनें।');}finally{input.value='';}}
async function scanParagraphCamera(){const status=document.getElementById('paragraphCameraStatus');if(status)status.textContent='अब Live Camera OCR उपलब्ध नहीं है। Gallery से फोटो चुनकर OCR करें।';chooseParagraphGalleryImage();}
function cropOcrLine(base,b,padRatio=.95){
  if(!base||!b||![b.x0,b.x1,b.y0,b.y1].every(Number.isFinite))return null;
  const lineW=Math.max(1,b.x1-b.x0),lineH=Math.max(1,b.y1-b.y0);
  const padX=Math.max(18,Math.round(lineW*.04)),padY=Math.max(18,Math.round(lineH*padRatio));
  const x=Math.max(0,Math.floor(b.x0-padX)),y=Math.max(0,Math.floor(b.y0-padY));
  const x2=Math.min(base.width,Math.ceil(b.x1+padX)),y2=Math.min(base.height,Math.ceil(b.y1+padY));
  const c=document.createElement('canvas');c.width=Math.max(1,x2-x);c.height=Math.max(1,y2-y);
  const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(base,x,y,c.width,c.height,0,0,c.width,c.height);return c;
}
function formulaLineScore(text){
  const x=String(text??'').trim();if(!x)return -999;
  const eq=(x.match(/=/g)||[]).length,frac=(x.match(/\/|frac/g)||[]).length,sym=(x.match(/[+\-×÷^_()[\]{}]/g)||[]).length;
  const letters=(x.match(/[A-Za-z]/g)||[]).length,digits=(x.match(/[0-9]/g)||[]).length;
  const words=x.split(/\s+/).filter(Boolean).length;
  const prose=(x.match(/\b(?:the|and|law|pressure|constant|factor|equation|reaction|point|energy)\b/gi)||[]).length;
  return eq*4+frac*2+Math.min(8,sym)*.5+Math.min(8,letters*.18+digits*.25)-Math.max(0,words-22)*.1-prose*.6;
}
async function refineFormulaLines(result,base,worker,status){
  const lines=Array.isArray(result?.data?.lines)?result.data.lines:[];if(!lines.length)return;
  // Known textbook equation names are repaired deterministically. Unknown formula rows get
  // one focused PSM-7 OCR pass on a high-resolution crop, without altering normal text rows.
  const unknown=lines.filter(line=>{
    const text=String(line?.text||'').trim();return text&&looksLikeFormulaLine(text)&&!canonicalFormulaForLine(text)&&line?.bbox;
  }).slice(0,28);
  if(!unknown.length)return;
  const oldParams={tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_char_whitelist:'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-=()[]{}^_.,:|'};
  try{
    await worker.setParameters(oldParams);
    for(let n=0;n<unknown.length;n++){
      const line=unknown[n],crop=cropOcrLine(base,line.bbox,.9);if(!crop)continue;
      status.textContent=`Formula refinement: ${n+1}/${unknown.length}…`;
      const candidates=[String(line.text||'').trim()];
      for(const psm of [7,13]){
        await worker.setParameters({...oldParams,tessedit_pageseg_mode:String(psm)});
        try{const r=await worker.recognize(crop);const t=String(r?.data?.text||'').replace(/[ \t]+\n/g,' ').replace(/\n+/g,' ').trim();if(t)candidates.push(t);}catch{}
      }
      const chosen=candidates.map(repairGenericFormulaLine).sort((a,b)=>formulaLineScore(b)-formulaLineScore(a))[0]||String(line.text||'').trim();
      // Keep the original title/example text and only replace the mathematical body if the
      // focused pass produced a formula-like fragment of comparable quality.
      const original=String(line.text||'').trim(),oc=original.indexOf(':'),op=original.indexOf('|');
      const cc=chosen.indexOf(':'),cp=chosen.indexOf('|');
      let candidateBody=chosen;
      if(cc>=0)candidateBody=chosen.slice(cc+1);if(cp>=0)candidateBody=candidateBody.slice(0,candidateBody.indexOf('|'));
      candidateBody=repairGenericFormulaLine(candidateBody).trim();
      if(oc>=0&&candidateBody&&/[=^_\\/]/.test(candidateBody)){
        const originalTail=op>=0?original.slice(op):'';
        line.text=`${original.slice(0,oc+1)} ${candidateBody}${originalTail?` ${repairGenericFormulaLine(originalTail)}`:''}`.trim();
      }else if(oc<0&&candidateBody&&/[=^_\\/→←]/.test(candidateBody)&&formulaLineScore(candidateBody)>=formulaLineScore(original)+1){
        line.text=candidateBody;
      }
    }
  }finally{
    await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_char_whitelist:''});
  }
}
function knownFormulaRichHtml(chunk){
  const canonical=canonicalizeKnownFormulaLine(chunk);
  const pipe=canonical.indexOf('|');
  const left=pipe>=0?canonical.slice(0,pipe).trim():canonical;
  const tail=pipe>=0?canonical.slice(pipe+1).trim():'';
  const colon=left.indexOf(':');
  const prefix=colon>=0?left.slice(0,colon+1).trim():'';
  const formula=colon>=0?left.slice(colon+1).trim():left;
  const speech=formulaBodyPlain(formula)+(tail?` | ${tail}`:'');
  return `<span class="ocr-book-line formula-known" contenteditable="false"><span class="ocr-book-line-text" data-ewl-text="${esc(canonical)}" data-ewl-speech="${esc(speech)}">${esc(prefix)} ${formulaTextToMathML(formula)}${tail?` <span class="formula-example">| ${esc(tail)}</span>`:''}</span></span>`;
}
function ocrLinesToBookLikeHtml(result,base){
  const lines=Array.isArray(result?.data?.lines)?result.data.lines:[];
  if(!lines.length){
    const raw=result?.data?.text||'';
    return splitKnownFormulaChunks(raw).map(chunk=>canonicalFormulaForLine(chunk)?knownFormulaRichHtml(chunk):ocrLineToRichHtml(chunk)).join('<br>');
  }
  const out=[];
  for(const line of lines){
    const original=String(line?.text||'').trim();if(!original){out.push('<br>');continue;}
    const chunks=splitKnownFormulaChunks(original);
    if(chunks.length>1 || canonicalFormulaForLine(original)){
      chunks.forEach((chunk,idx)=>{if(canonicalFormulaForLine(chunk))out.push(knownFormulaRichHtml(chunk));else out.push(ocrLineToRichHtml(chunk));if(idx<chunks.length-1)out.push('<br>')});
      out.push('<br>');continue;
    }
    const text=repairOcrFormulaLine(original),b=line?.bbox;
    if(looksLikeFormulaLine(text)){
      const structured=ocrLineToRichHtml(text);
      // If a usable structured formula was produced, show it directly. This avoids the V74
      // failure mode where the fallback crop/text path made formulas appear as one linear line.
      // Keep an original line crop as a secondary visual reference only when the parser cannot
      // produce a meaningful mathematical fragment. The hidden data-ewl-text remains the
      // normalized representation used by speech/testing.
      if(structured && /formula-(?:known|math)|math-frac|math-sqrt|<sup>|<sub>/.test(structured)){
        out.push(structured);
      }else if(b&&Number.isFinite(b.x0)&&Number.isFinite(b.x1)&&Number.isFinite(b.y0)&&Number.isFinite(b.y1)){
        try{
          const c=cropOcrLine(base,b,.95);if(!c)throw new Error('crop');
          const src=c.toDataURL('image/webp',.92);
          out.push(`<span class="ocr-book-line" contenteditable="false"><span class="ocr-book-line-text" data-ewl-text="${esc(canonicalizeKnownFormulaText(text))}">${esc(canonicalizeKnownFormulaText(text))}</span><img class="ocr-formula-line-image" src="${src}" alt="${esc(text)}"></span>`);
        }catch{out.push(esc(canonicalizeKnownFormulaText(text)));}
      }else out.push(esc(canonicalizeKnownFormulaText(text)));
    }else out.push(esc(text));
    out.push('<br>');
  }
  if(out[out.length-1]==='<br>')out.pop();return out.join('');
}

async function scanParagraphSource(source,textarea,status,options={}){
  status.textContent='इमेज साफ करके multi-pass OCR किया जा रहा है… पहली बार भाषा डेटा डाउनलोड होने में समय लग सकता है।';
  try{
    const Tesseract=await loadTesseract();const lang='hin+eng';
    if(!window.__paragraphOcrWorker||window.__paragraphOcrLang!==lang){
      if(window.__paragraphOcrWorker){await window.__paragraphOcrWorker.terminate();window.__paragraphOcrWorker=null;}
      window.__paragraphOcrWorker=await Tesseract.createWorker(lang,1,{logger:m=>{if(m.status==='recognizing text')status.textContent=`टेक्स्ट पहचाना जा रहा है… ${Math.round((m.progress||0)*100)}%`;}});
      window.__paragraphOcrLang=lang;
      await window.__paragraphOcrWorker.setParameters({preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_pageseg_mode:'6',tessedit_char_whitelist:''});
    }
    const maxSide=3600,scale=Math.min(2.8,Math.max(1,maxSide/Math.max(source.width,source.height)));const base=document.createElement('canvas');base.width=Math.round(source.width*scale);base.height=Math.round(source.height*scale);
    const ctx=base.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,base.width,base.height);
    const frame=ctx.getImageData(0,0,base.width,base.height),d=frame.data;const hist=new Uint32Array(256);let total=0;
    for(let i=0;i<d.length;i+=4){const gray=Math.max(0,Math.min(255,Math.round(.299*d[i]+.587*d[i+1]+.114*d[i+2])));hist[gray]++;total++;}
    let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sumB=0,wB=0,maxVar=-1,threshold=150;
    for(let i=0;i<256;i++){wB+=hist[i];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=i*hist[i];const mB=sumB/wB,mF=(sum-sumB)/wF;const variance=wB*wF*(mB-mF)*(mB-mF);if(variance>maxVar){maxVar=variance;threshold=i;}}
    const makeGray=(contrast=1.0)=>{const c=document.createElement('canvas');c.width=base.width;c.height=base.height;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(base,0,0);const f=x.getImageData(0,0,c.width,c.height),a=f.data;for(let i=0;i<a.length;i+=4){const g=Math.max(0,Math.min(255,Math.round(.299*a[i]+.587*a[i+1]+.114*a[i+2])));const v=Math.max(0,Math.min(255,Math.round((g-128)*contrast+128)));a[i]=a[i+1]=a[i+2]=v;}x.putImageData(f,0,0);return c;};
    const gray=makeGray(1.18);
    const bin=document.createElement('canvas');bin.width=base.width;bin.height=base.height;const bctx=bin.getContext('2d',{willReadFrequently:true});bctx.drawImage(gray,0,0);const bf=bctx.getImageData(0,0,bin.width,bin.height),bd=bf.data;for(let i=0;i<bd.length;i+=4){const v=bd[i]<threshold?0:255;bd[i]=bd[i+1]=bd[i+2]=v;}bctx.putImageData(bf,0,0);
    const original=base;
    const inv=document.createElement('canvas');inv.width=bin.width;inv.height=bin.height;const ictx=inv.getContext('2d',{willReadFrequently:true});ictx.drawImage(bin,0,0);const idata=ictx.getImageData(0,0,inv.width,inv.height);for(let i=0;i<idata.data.length;i+=4){const v=255-idata.data[i];idata.data[i]=idata.data[i+1]=idata.data[i+2]=v;}ictx.putImageData(idata,0,0);
    const variants=[['original',original,6],['contrast',gray,6],['binarized',bin,6],['inverted',inv,6],['block-text',original,4],['sparse-text',original,11]];
    const results=[];
    for(const [name,canvas,psm] of variants){status.textContent=`OCR प्रयास: ${name}…`;await window.__paragraphOcrWorker.setParameters({tessedit_pageseg_mode:String(psm),preserve_interword_spaces:'1',user_defined_dpi:'300'});const r=await window.__paragraphOcrWorker.recognize(canvas);results.push(r);}
    await window.__paragraphOcrWorker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300',tessedit_char_whitelist:''});
    const clean=r=>(r?.data?.text||'').replace(/\r/g,'').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    const scored=results.map((r,i)=>({r,i,text:clean(r),confidence:Number(r?.data?.confidence)||0})).filter(x=>x.text);
    if(!scored.length){status.textContent='टेक्स्ट नहीं मिला। इमेज साफ रखें, रोशनी पर्याप्त रखें और फिर कोशिश करें।';return;}
    scored.sort((a,b)=>{const score=x=>{const known=splitKnownFormulaChunks(x.text).filter(y=>formulaTitleInfo(y)).length;return x.confidence+Math.min(18,x.text.length/180)+Math.min(8,x.text.split(/\s+/).filter(Boolean).length/40)+Math.min(3,(x.text.match(/\n/g)||[]).length/8)+known*8;};return score(b)-score(a);});
    const best=scored[0],text=best.text;
    const knownChunks=splitKnownFormulaChunks(text);
    const hasKnownFormulaPage=knownChunks.filter(x=>formulaTitleInfo(x)).length>=2 || /(?:^|\s)1\.\s*Molarity\s*\(\s*M\s*\)/i.test(text);
    let repairedText=text,rich='';
    if(hasKnownFormulaPage){
      // Tesseract can put fraction numerators and denominators on separate OCR lines.
      // Rebuild known formula blocks from the whole OCR result before rendering/copying.
      repairedText=canonicalizeKnownFormulaText(text);
      rich=renderMathParagraph(repairedText);
    }else{
      await refineFormulaLines(best.r,base,window.__paragraphOcrWorker,status);
      const repairedLines=Array.isArray(best.r?.data?.lines)&&best.r.data.lines.length?best.r.data.lines.map(l=>repairOcrFormulaLine(l?.text||'')).join('\n'):String(best.r?.data?.text||text).split('\n').map(repairOcrFormulaLine).join('\n');
      repairedText=canonicalizeKnownFormulaText(repairedLines);
      rich=ocrLinesToBookLikeHtml(best.r,base);
    }
    if(options.appendToTarget!==false){
      const target=textarea;
      if(target.isContentEditable){
        if(target.innerText.trim())document.execCommand('insertHTML',false,'<br><br>'+rich);else target.innerHTML=rich;
        target.dispatchEvent(new Event('input',{bubbles:true}));target.focus();
      }else{
        const existing=String(target.value||'').trim();target.value=existing?existing+'\n\n'+repairedText:repairedText;target.dispatchEvent(new Event('input',{bubbles:true}));target.focus();
      }
    }else{
      textarea.innerHTML=rich;
      const box=document.getElementById('galleryOcrResultBox')||document.getElementById('lensOcrResultBox');if(box)box.hidden=false;
      typesetMath(root);
    }
    status.textContent=options.appendToTarget===false?`टेक्स्ट पहचान लिया गया। Formula blocks को संरचना के साथ सुधारा गया है और speech/test के लिए corrected text अलग रखा गया है। जिस हिस्से की जरूरत हो उसे select करके “Copy Selected” या “Paragraph में Paste” दबाएँ। Gallery की फोटो ऐप/server पर सेव नहीं की गई।`:`टेक्स्ट पहचाना गया (best OCR confidence लगभग ${Math.round(best.confidence)}%). Multi-pass OCR के बाद formula refinement किया गया है। सेव करने से पहले spelling, punctuation, numbers और formulas जाँचें। Gallery की फोटो ऐप/server पर सेव नहीं की गई।`;
  }catch(e){status.textContent='OCR नहीं हो पाया: '+(e.message||'कृपया फिर कोशिश करें।');}
}
async function addPara(cid){
  closeParagraphCamera();root.innerHTML=`<header><div class="header-title"><span class="header-eyebrow">READING CONTENT</span><b>+ Add Paragraph</b></div><button class="btn-secondary" type="button" onclick="closeParagraphCamera();editChapter(${cid})">Back</button></header><main><section class="card form-card"><h2>नया पैराग्राफ जोड़ें</h2><p class="muted">Gallery की फोटो से किताब का टेक्स्ट पहचानें या सीधे लिखें/पेस्ट करें। पहचाना गया टेक्स्ट एक पैराग्राफ के रूप में सेव होगा। हिंदी और English OCR उपलब्ध हैं; सेव करने से पहले टेक्स्ट जाँच लें।</p><div class="button-row"><button type="button" onclick="openParagraphCamera('newParagraphText')">🖼️ Gallery से फोटो OCR</button><button type="button" class="btn-secondary" onclick="pasteIntoField('newParagraphText')">📋 Clipboard से Paste</button>${formulaInsertButtonHtml()}</div>${cameraPanelHtml()}<label for="newParagraphText">Paragraph text</label><div id="newParagraphText" class="rich-paragraph-editor" contenteditable="true" spellcheck="false" data-placeholder="Gallery OCR से पहचाना गया टेक्स्ट यहाँ आएगा… या यहाँ लिखें/पेस्ट करें"></div><div class="button-row form-actions"><button type="button" onclick="saveNewParagraph(${cid})">Save Paragraph</button><button type="button" class="btn-secondary" onclick="closeParagraphCamera();editChapter(${cid})">Cancel</button></div></section></main>`;
}
async function saveNewParagraph(cid){const text=richParagraphPayload('newParagraphText');if(!text)return alert('पहले टेक्स्ट पहचानें या पैराग्राफ लिखें।');try{await api('/chapters/'+cid+'/paragraphs',{method:'POST',body:JSON.stringify({text})});closeParagraphCamera();await refresh()}catch(e){alert(e.message)}}
async function addQA(cid){if(!q.value||!a.value)return alert('Question और answer दोनों भरें');try{await api('/chapters/'+cid+'/qa',{method:'POST',body:JSON.stringify({question:q.value,answer:a.value})});await load();editChapterQA(cid)}catch(e){alert(e.message)}}
async function reportTeacherActivity(){
  if(!token)return;
  const mode=window.matchMedia?.('(display-mode: standalone)').matches?'standalone':(window.navigator.standalone?'standalone':'browser');
  try{await api('/teacher/activity',{method:'POST',body:JSON.stringify({mode})});}catch{}
  window.addEventListener('appinstalled',()=>{api('/teacher/activity',{method:'POST',body:JSON.stringify({mode:'standalone'})}).catch(()=>{});},{once:true});
}

installRichFormulaCopyGuard();
installFormulaPasteGuard();
installFormulaEditor();

async function boot(){const isAdminRoute=location.pathname.replace(/\/+$/,'')==='/admin';if(new URLSearchParams(location.search).get('reset')){localStorage.removeItem('token');token=null;isAdminRoute?adminLoginView():authView();return}try{if(isAdminRoute){if(decodeJwtRole()==='admin'){await adminDashboard()}else{adminLoginView()}return}if(decodeJwtRole()==='admin'||decodeJwtRole()==='admin_impersonate'){localStorage.removeItem('token');token=null;authView();return}await load();dashboard();reportTeacherActivity().catch(()=>{})}catch(e){localStorage.clear();sessionStorage.removeItem('adminTeacherToken');token=null;isAdminRoute?adminLoginView():authView()}}
boot();

history.replaceState({appRoot:true},'',location.href);
const navigationClickPattern=/(dashboard|teacherSubjectFlow|teacherBookFlow|teacherChapterFlow|editChapterParagraphs|editChapterQA|studentTests|studentSubjectFlow|studentBookFlow|studentChapterFlow|selectParagraph|selectQaItems|showChapterTypeHistory|showItemHistory|showAttemptResult|showQaHistory|showSubjectHistory|showStudentOverallHistory|studentListFlow|studentSubjectListFlow|studentBookListFlow|studentChapterListFlow|selectCompleteChapter|startChapterTest|startSelectedParagraphTest|startSingleQaTest|showPronunciationHelp|authView|adminLoginView|teacherLoginOnly|teacherRegisterOnly|addPara|addChapterForm|forgotPasswordView)/;
let __handlingAppPopstate=false;
document.addEventListener('click',e=>{
  const b=e.target.closest('button,[data-s]');
  if(!b)return;
  const action=b.getAttribute('onclick')||'';
  const label=(b.innerText||'').trim().toLowerCase();
  const isBack=label==='back'||label.startsWith('back ');
  const isExit=label==='exit';
  // Back must consume the same browser-history entry that was created for the
  // current in-app screen. Otherwise Android/browser Back and the visible Back
  // button can drift apart and return to an unrelated subject/home screen.
  if(isBack&&!__handlingAppPopstate){
    if(history.state?.appScreen){
      e.preventDefault();
      e.stopPropagation();
      history.back();
    }
    return;
  }
  if(isExit||(!(b.dataset.s||b.dataset.teacherSubject||b.dataset.adminOpen)&&!navigationClickPattern.test(action)))return;
  history.pushState({appScreen:true},'',location.pathname+'#app');
},true);
window.addEventListener('popstate',()=>{
  const buttons=[...root.querySelectorAll('button')];
  const back=buttons.find(b=>/^back(\b|\s)/i.test((b.innerText||'').trim()));
  if(back){
    __handlingAppPopstate=true;
    try{back.click();}finally{__handlingAppPopstate=false;}
    return;
  }
  const exit=buttons.find(b=>/^exit$/i.test((b.innerText||'').trim()));
  if(exit){
    __handlingAppPopstate=true;
    try{exit.click();}finally{__handlingAppPopstate=false;}
    return;
  }
  if(token){refresh().catch(()=>authView())}else authView();
});
