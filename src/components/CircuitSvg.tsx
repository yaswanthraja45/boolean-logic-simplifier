import React, {useMemo} from 'react';
import type {GateGraph,GateNode} from '../engine/boolean';

type Point={x:number;y:number};

const NODE_W=120;
const NODE_H=46;
const COL_GAP=90;
const ROW_GAP=26;
const PAD_X=40;
const PAD_Y=45;

function layoutGraph(graph:GateGraph){
  const incoming=new Map<string,string[]>();
  for(const e of graph.edges){
    const list=incoming.get(e.to)||[];
    list.push(e.from);
    incoming.set(e.to,list);
  }

  const depth=new Map<string,number>();
  const visiting=new Set<string>();
  const getDepth=(id:string):number=>{
    if(depth.has(id))return depth.get(id)!;
    if(visiting.has(id))return 0;
    visiting.add(id);
    const parents=incoming.get(id)||[];
    const d=parents.length?Math.max(...parents.map(getDepth))+1:0;
    visiting.delete(id);
    depth.set(id,d);
    return d;
  };
  graph.nodes.forEach(n=>getDepth(n.id));

  const columns=new Map<number,GateNode[]>();
  graph.nodes.forEach(n=>{
    const d=depth.get(n.id)||0;
    const arr=columns.get(d)||[];
    arr.push(n);
    columns.set(d,arr);
  });

  const positions=new Map<string,Point>();
  const maxRows=Math.max(...[...columns.values()].map(a=>a.length),1);
  const height=Math.max(graph.height,PAD_Y*2+maxRows*(NODE_H+ROW_GAP)-ROW_GAP);
  const maxDepth=Math.max(...columns.keys(),0);
  const width=Math.max(graph.width,PAD_X*2+(maxDepth+1)*NODE_W+maxDepth*COL_GAP);

  [...columns.entries()].sort((a,b)=>a[0]-b[0]).forEach(([d,nodes])=>{
    const total=nodes.length*(NODE_H+ROW_GAP)-ROW_GAP;
    const start=Math.max(PAD_Y,(height-total)/2);
    nodes.forEach((node,i)=>{
      positions.set(node.id,{
        x:PAD_X+d*(NODE_W+COL_GAP),
        y:start+i*(NODE_H+ROW_GAP)
      });
    });
  });

  return {positions,incoming,width,height};
}

export function CircuitSvg({graph,title}:{graph:GateGraph;title:string}){
  const {positions,incoming,width,height}=useMemo(()=>layoutGraph(graph),[graph]);
  const markerId=`arrow-${title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}`;

  const inputY=(edgeTo:string,port:number)=>{
    const p=positions.get(edgeTo)!;
    const count=Math.max(incoming.get(edgeTo)?.length||1,1);
    const gap=Math.min(14,(NODE_H-12)/Math.max(count-1,1));
    if(count===1)return p.y+NODE_H/2;
    const first=p.y+NODE_H/2-((count-1)*gap)/2;
    return first+port*gap;
  };

  return <div className="rounded-2xl border border-slate-700/60 bg-slate-950/70 p-3 overflow-auto">
    <div className="px-2 pb-2 text-xs uppercase tracking-[.18em] text-slate-500">{title}</div>
    <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[680px] w-full h-auto" role="img" aria-label={title}>
      <defs>
        <marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M0 0L10 5L0 10z" fill="currentColor"/>
        </marker>
      </defs>

      {graph.edges.map((e,i)=>{
        const a=positions.get(e.from);
        const b=positions.get(e.to);
        if(!a||!b)return null;
        const port=e.port??0;
        const x1=a.x+NODE_W;
        const y1=a.y+NODE_H/2;
        const x2=b.x;
        const y2=inputY(e.to,port);
        const mid=x1+(x2-x1)/2;
        return <path
          key={i}
          d={`M ${x1} ${y1} H ${mid} V ${y2} H ${x2}`}
          fill="none"
          stroke="currentColor"
          className="text-slate-500"
          strokeWidth="2"
          markerEnd={`url(#${markerId})`}
        />;
      })}

      {graph.nodes.map(n=>{
        const p=positions.get(n.id)!;
        const count=incoming.get(n.id)?.length||0;
        return <g key={n.id} transform={`translate(${p.x},${p.y})`}>
          <rect x="0" y="0" width={NODE_W} height={NODE_H} rx="12" className={n.id===graph.output?'fill-cyan-500/10 stroke-cyan-400':'fill-slate-900 stroke-slate-600'} strokeWidth="2"/>

          {Array.from({length:count},(_,i)=><circle key={i} cx="0" cy={inputY(n.id,i)-p.y} r="4" className="fill-cyan-300"/>)}
          <circle cx={NODE_W} cy={NODE_H/2} r="4" className="fill-cyan-300"/>

          <text x={NODE_W/2} y="19" textAnchor="middle" className="fill-slate-100 text-[12px] font-semibold">{n.type}</text>
          <text x={NODE_W/2} y="36" textAnchor="middle" className="fill-slate-400 text-[10px]">{n.label||'gate'}</text>
        </g>;
      })}
    </svg>
  </div>;
}
