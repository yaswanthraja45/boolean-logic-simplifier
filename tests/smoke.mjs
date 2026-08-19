import {parseExpression,minimizeSOP,minimizePOS,truthTable,evaluateSOP} from '../.engine/boolean.js';
const cases=[['majority',3,'AB+AC+BC'],['xor',2,'A XOR B'],['full-adder-sum',3,'A XOR B XOR C'],['full-adder-carry',3,'AB+AC+BC']];
for(const [name,n,e] of cases){const v=truthTable(n,parseExpression(e).evaluate);const req=v.flatMap((x,i)=>x?[i]:[]);const m=minimizeSOP(req,[],n);const chk=truthTable(n,a=>evaluateSOP(m.expression,a));if(JSON.stringify(v)!==JSON.stringify(chk))throw new Error(name);console.log('PASS',name,m.expression)}
console.log('PASS POS',minimizePOS([0,3],[],2).expression)
