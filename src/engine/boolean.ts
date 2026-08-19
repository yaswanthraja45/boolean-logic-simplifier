export type Bit = 0|1;
export type TruthValue = 0|1|'X';
export type InputMode = 'truth'|'terms'|'expression';
export type TermKind = 'minterm'|'maxterm';

export interface Implicant { bits:string; minterms:number[]; literals:number }
export interface MinimizationResult { expression:string; implicants:Implicant[]; constant:0|1; }
export interface ParsedExpression { evaluate:(assignment:Record<string,Bit>)=>Bit; variables:string[] }

const VARS=['A','B','C','D','E','F'];
const names=(n:number)=>VARS.slice(0,n);
const pop=(s:string)=>[...s].filter(c=>c!=='-').length;
const covers=(bits:string,m:number,n:number)=>{const b=m.toString(2).padStart(n,'0'); return [...bits].every((c,i)=>c==='-'||c===b[i])};

function combine(a:string,b:string){let diff=0, out=''; for(let i=0;i<a.length;i++){ if(a[i]!==b[i]){diff++;out+='-'}else out+=a[i]; } return diff===1?out:null;}

function primeImplicants(required:number[], dc:number[], n:number):Implicant[]{
  const start=[...new Set([...required,...dc])].sort((a,b)=>a-b);
  let current=Array.from(new Map(start.map(m=>[m.toString(2).padStart(n,'0'),{bits:m.toString(2).padStart(n,'0'),minterms:[m],literals:n}])).values());
  const primes=new Map<string,Set<number>>();
  while(current.length){
    const used=new Set<string>(); const next=new Map<string,Set<number>>();
    const groups=new Map<number,Implicant[]>();
    for(const imp of current){const ones=[...imp.bits].filter(x=>x==='1').length;(groups.get(ones)||groups.set(ones,[]).get(ones)!).push(imp)}
    const keys=[...groups.keys()].sort((a,b)=>a-b);
    for(let gi=0;gi<keys.length-1;gi++){
      for(const a of groups.get(keys[gi])||[]) for(const b of groups.get(keys[gi+1])||[]){
        const c=combine(a.bits,b.bits); if(c){used.add(a.bits);used.add(b.bits); const set=next.get(c)||new Set<number>(); a.minterms.forEach(x=>set.add(x)); b.minterms.forEach(x=>set.add(x)); next.set(c,set)}
      }
    }
    for(const imp of current) if(!used.has(imp.bits)) primes.set(imp.bits,new Set([...(primes.get(imp.bits)||new Set()),...imp.minterms]));
    current=[...next.entries()].map(([bits,set])=>({bits,minterms:[...set],literals:pop(bits)}));
  }
  return [...primes.entries()].map(([bits,set])=>({bits,minterms:[...set].sort((a,b)=>a-b),literals:pop(bits)}));
}

function selectCover(required:number[], primes:Implicant[]):Implicant[]{
  if(!required.length)return [];
  const coversBy=new Map<number,Implicant[]>(); for(const m of required) coversBy.set(m,primes.filter(p=>p.minterms.includes(m)));
  const essential=new Map<string,Implicant>();
  for(const m of required){const list=coversBy.get(m)!; if(list.length===1) essential.set(list[0].bits,list[0]);}
  const base=[...essential.values()]; const covered=new Set(base.flatMap(p=>p.minterms)); const remaining=required.filter(m=>!covered.has(m));
  if(!remaining.length)return base;
  let best:Implicant[]|null=null; let bestCost=[Infinity,Infinity] as const;
  const chosen=new Set<string>(base.map(p=>p.bits));
  const search=(rem:number[],picked:Implicant[])=>{
    if(!rem.length){const solution=[...base,...picked]; const cost=[solution.length,solution.reduce((s,p)=>s+p.literals,0)] as const; if(cost[0]<bestCost[0]||(cost[0]===bestCost[0]&&cost[1]<bestCost[1])){best=solution;bestCost=cost} return;}
    if(picked.length+base.length>bestCost[0])return;
    const m=rem[0]; let options=(coversBy.get(m)||[]).filter(p=>!chosen.has(p.bits)).sort((a,b)=>a.literals-b.literals);
    for(const p of options){chosen.add(p.bits); const nr=rem.filter(x=>!p.minterms.includes(x)); search(nr,[...picked,p]); chosen.delete(p.bits)}
  };
  search(remaining,[]); return best||base;
}

const implicantToSOP=(p:Implicant,n:number)=>{let s=''; names(n).forEach((v,i)=>{if(p.bits[i]==='1')s+=v; else if(p.bits[i]==='0')s+=`${v}'`;}); return s||'1'};
const implicantToPOS=(p:Implicant,n:number)=>{const parts:string[]=[]; names(n).forEach((v,i)=>{if(p.bits[i]==='0')parts.push(v); else if(p.bits[i]==='1')parts.push(`${v}'`);}); return `(${parts.join(' + ')||'0'})`};

export function minimizeSOP(required:number[],dc:number[],n:number):MinimizationResult{
  if(required.length===0)return {expression:'0',implicants:[],constant:0};
  if(required.length===2**n && dc.length===0)return {expression:'1',implicants:[],constant:1};
  const primes=primeImplicants(required,dc,n); const chosen=selectCover(required,primes); return {expression:chosen.map(p=>implicantToSOP(p,n)).join(' + '),implicants:chosen,constant:NaN as never};
}
export function minimizePOS(zeros:number[],dc:number[],n:number):MinimizationResult{
  if(zeros.length===0)return {expression:'1',implicants:[],constant:1};
  if(zeros.length===2**n && dc.length===0)return {expression:'0',implicants:[],constant:0};
  const primes=primeImplicants(zeros,dc,n); const chosen=selectCover(zeros,primes); return {expression:chosen.map(p=>implicantToPOS(p,n)).join(' · ')||'1',implicants:chosen,constant:NaN as never};
}

export function rowsFromTerms(n:number,kind:TermKind,indices:number[],dc:number[]){const out:TruthValue[]=Array(2**n).fill(0); if(kind==='minterm')indices.forEach(i=>out[i]=1); else indices.forEach(i=>out[i]=0); dc.forEach(i=>out[i]='X'); if(kind==='maxterm')for(let i=0;i<2**n;i++)if(!indices.includes(i)&&!dc.includes(i))out[i]=1; return out}
export function expressionFromTable(n:number,rows:TruthValue[]):{minterms:number[];zeros:number[];dc:number[]}{const minterms:number[]=[],zeros:number[]=[],dc:number[]=[]; rows.forEach((v,i)=>v==='X'?dc.push(i):v===1?minterms.push(i):zeros.push(i)); return {minterms,zeros,dc}}

interface Tok{type:'var'|'op'|'lparen'|'rparen';value:string}
function tokenize(input:string):Tok[]{const raw:Tok[]=[]; const s=input.replaceAll('¬','!'); for(let i=0;i<s.length;){const c=s[i]; if(/\s/.test(c)){i++;continue} if(/[A-Fa-f]/.test(c)){raw.push({type:'var',value:c.toUpperCase()});i++;continue} if(c==='('){raw.push({type:'lparen',value:c});i++;continue} if(c===')'){raw.push({type:'rparen',value:c});i++;continue} if(c==="'"){raw.push({type:'op',value:"NOT"});i++;continue} if(c==='!'||c==='~'){raw.push({type:'op',value:'NOT'});i++;continue} if(c==='.'||c==='*'||c==='·'){raw.push({type:'op',value:'AND'});i++;continue} if(c==='+'){raw.push({type:'op',value:'OR'});i++;continue} const rest=s.slice(i); const kw=rest.match(/^(AND|OR|XOR|NOT)\b/i); if(kw){raw.push({type:'op',value:kw[1].toUpperCase()});i+=kw[1].length;continue} throw new Error(`Unexpected symbol “${c}”`)}
  const out:Tok[]=[]; const atomEnd=(t:Tok)=>t.type==='var'||t.type==='rparen'||(t.type==='op'&&t.value==='NOT'); const atomStart=(t:Tok)=>t.type==='var'||t.type==='lparen'||(t.type==='op'&&t.value==='NOT'); for(let i=0;i<raw.length;i++){const prev=raw[i-1],cur=raw[i]; if(prev&&atomEnd(prev)&&atomStart(cur))out.push({type:'op',value:'AND'}); out.push(cur)} return out;}
const prec:Record<string,number>={OR:1,XOR:2,AND:3,NOT:4};
export function parseExpression(input:string):ParsedExpression{const toks=tokenize(input); if(!toks.length)throw new Error('Enter a Boolean expression.'); const output:Tok[]=[]; const ops:Tok[]=[]; for(const t of toks){if(t.type==='var')output.push(t); else if(t.type==='op'){if(t.value==='NOT'){while(ops.length&&ops.at(-1)!.value==='NOT'&&prec[ops.at(-1)!.value]>prec[t.value])output.push(ops.pop()!); ops.push(t)}else{while(ops.length&&ops.at(-1)!.type==='op'&&ops.at(-1)!.value!=='('&&prec[ops.at(-1)!.value]>=prec[t.value])output.push(ops.pop()!); ops.push(t)}} else if(t.type==='lparen')ops.push(t); else {while(ops.length&&ops.at(-1)!.type!=='lparen')output.push(ops.pop()!); if(!ops.length)throw new Error('Mismatched parentheses.'); ops.pop()}}
  while(ops.length){const o=ops.pop()!; if(o.type==='lparen')throw new Error('Mismatched parentheses.'); output.push(o)}
  type Node={op?:string; v?:string; left?:Node; right?:Node}; const st:Node[]=[]; for(const t of output){if(t.type==='var')st.push({v:t.value}); else if(t.value==='NOT'){const a=st.pop();if(!a)throw new Error('Missing operand for NOT.');st.push({op:'NOT',left:a})}else{const b=st.pop(),a=st.pop();if(!a||!b)throw new Error(`Missing operand for ${t.value}.`);st.push({op:t.value,left:a,right:b})}} if(st.length!==1)throw new Error('Invalid expression.'); const root=st[0]; const vars=[...new Set(toks.filter(t=>t.type==='var').map(t=>t.value))].sort(); const ev=(n:Node,a:Record<string,Bit>):Bit=>{if(n.v)return a[n.v]??0; if(n.op==='NOT')return ev(n.left!,a)?0:1; const x=ev(n.left!,a),y=ev(n.right!,a); if(n.op==='AND')return (x&y) as Bit; if(n.op==='OR')return (x|y) as Bit; return (x^y) as Bit}; return {evaluate:a=>ev(root,a),variables:vars}}

export function evaluateSOP(expression:string,a:Record<string,Bit>):Bit{const normalized=expression.replaceAll(' ','').trim();if(normalized==='0')return 0;if(normalized==='1')return 1; for(const term of normalized.split('+')){if(!term)continue; let ok:Bit=1; const re=/([A-F])('?)/g; let m:RegExpExecArray|null; let found=0; while((m=re.exec(term))){found++; const neg=!!m[2]; if(a[m[1]]!==(neg?0:1)){ok=0;break}} if(ok&&found>0)return 1} return 0}

export function truthTable(n:number,evalFn:(a:Record<string,Bit>)=>Bit):Bit[]{const vs=names(n);return Array.from({length:2**n},(_,m)=>{const a:Record<string,Bit>={};vs.forEach((v,i)=>a[v]=((m>>(n-1-i))&1) as Bit);return evalFn(a)})}

export interface GateNode{id:string;type:'INPUT'|'AND'|'OR'|'NOT'|'NAND'|'NOR';label?:string}
export interface GateEdge{from:string;to:string;port?:number}
export interface GateGraph{nodes:GateNode[];edges:GateEdge[];output:string;width:number;height:number}
let gid=0; const ng=(type:GateNode['type'],label?:string):GateNode=>({id:`g${++gid}`,type,label});
export function buildSOPGraph(implicants:Implicant[],n:number,mode:'basic'|'nand'|'nor',constant:Bit=0):GateGraph{gid=0;const nodes:GateNode[]=[],edges:GateEdge[]=[]; const inputNodes=names(n).map(v=>{const g=ng('INPUT',v);nodes.push(g);return g}); const add=(g:GateNode)=>{nodes.push(g);return g}; const output=(g:GateNode)=>g;
  if(implicants.length===0){const c=ng('INPUT',String(constant));add(c);return {nodes,edges,output:c.id,width:520,height:260}};
  if(mode==='basic'){
    const terms:GateNode[]=[]; implicants.forEach((imp,ti)=>{const factors:GateNode[]=[]; names(n).forEach((v,i)=>{if(imp.bits[i]==='-')return; let source=inputNodes[i]; if(imp.bits[i]==='0'){const inv=add(ng('NOT'));edges.push({from:source.id,to:inv.id});source=inv} factors.push(source)}); if(factors.length===1)terms.push(factors[0]); else {const a=add(ng('AND',`T${ti+1}`));factors.forEach((f,j)=>edges.push({from:f.id,to:a.id,port:j}));terms.push(a)}}); let out=terms[0]; if(terms.length>1){const o=add(ng('OR'));terms.forEach((t,j)=>edges.push({from:t.id,to:o.id,port:j}));out=o} return {nodes,edges,output:out.id,width:Math.max(680,220+terms.length*100),height:Math.max(280,120+terms.length*80)};
  }
  if(mode==='nand'){
    const termNands:GateNode[]=[]; implicants.forEach((imp,ti)=>{const factors:GateNode[]=[];names(n).forEach((v,i)=>{if(imp.bits[i]==='-')return;let source=inputNodes[i];if(imp.bits[i]==='0'){const inv=add(ng('NAND'));edges.push({from:source.id,to:inv.id,port:0},{from:source.id,to:inv.id,port:1});source=inv}factors.push(source)});const na=add(ng('NAND',`T${ti+1}`));factors.forEach((f,j)=>edges.push({from:f.id,to:na.id,port:j}));termNands.push(na)}); let out:GateNode; if(termNands.length===1){out=add(ng('NAND'));edges.push({from:termNands[0].id,to:out.id,port:0},{from:termNands[0].id,to:out.id,port:1})}else{out=add(ng('NAND'));termNands.forEach((t,j)=>edges.push({from:t.id,to:out.id,port:j}))} return {nodes,edges,output:out.id,width:720,height:340};
  }
  // NOR implementation from SOP: invert each positive literal, use NOR for De Morgan product, then NOR all products with final inverter.
  const termNors:GateNode[]=[]; implicants.forEach((imp,ti)=>{const lits:GateNode[]=[];names(n).forEach((v,i)=>{if(imp.bits[i]==='-')return;let source=inputNodes[i];if(imp.bits[i]==='1'){const inv=add(ng('NOR'));edges.push({from:source.id,to:inv.id,port:0},{from:source.id,to:inv.id,port:1});source=inv}lits.push(source)});const nr=add(ng('NOR',`T${ti+1}`));lits.forEach((f,j)=>edges.push({from:f.id,to:nr.id,port:j}));termNors.push(nr)}); let out=termNors.length===1?termNors[0]:add(ng('NOR')); if(termNors.length>1)termNors.forEach((t,j)=>edges.push({from:t.id,to:out.id,port:j})); const inv=add(ng('NOR'));edges.push({from:out.id,to:inv.id,port:0},{from:out.id,to:inv.id,port:1}); return {nodes,edges,output:inv.id,width:760,height:360};
}

export function expressionForSOP(implicants:Implicant[],n:number){return implicants.length?implicants.map(p=>implicantToSOP(p,n)).join(' + '):'0'}
export function expressionForPOS(implicants:Implicant[],n:number){return implicants.length?implicants.map(p=>implicantToPOS(p,n)).join(' · '):'1'}

export function evaluateGraph(graph:GateGraph, assignment:Record<string,Bit>):Bit{
  const nodes=new Map(graph.nodes.map(n=>[n.id,n])); const incoming=new Map<string,string[]>();
  for(const e of graph.edges){const a=incoming.get(e.to)||[];a[e.port??a.length]=e.from;incoming.set(e.to,a)}
  const memo=new Map<string,Bit>();
  const ev=(id:string):Bit=>{if(memo.has(id))return memo.get(id)!;const node=nodes.get(id)!;let v:Bit=0;
    if(node.type==='INPUT') v=(node.label && node.label in assignment?assignment[node.label]:Number(node.label==='1')) as Bit;
    else {const ins=(incoming.get(id)||[]).filter(Boolean).map(ev); const all=ins.length>0&&ins.every(Boolean), any=ins.some(Boolean);
      if(node.type==='NOT')v=ins[0]?0:1; else if(node.type==='AND')v=all?1:0; else if(node.type==='OR')v=any?1:0; else if(node.type==='NAND')v=all?0:1; else if(node.type==='NOR')v=any?0:1;
    } memo.set(id,v);return v;
  }; return ev(graph.output);
}
