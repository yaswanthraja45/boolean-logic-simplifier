import {describe,it,expect} from 'vitest';
import {parseExpression,minimizeSOP,minimizePOS,truthTable,evaluateSOP} from './boolean';
const vals=(n:number,e:string)=>truthTable(n,parseExpression(e).evaluate);
const mins=(v:number[])=>v.map((x,i)=>x?i:-1).filter(i=>i>=0);
describe('boolean engine',()=>{
 it('majority of 3',()=>{const v=vals(3,'AB+AC+BC');const m=minimizeSOP(mins(v),[],3);expect(truthTable(3,a=>evaluateSOP(m.expression,a))).toEqual(v)});
 it('xor',()=>{const v=vals(2,'A XOR B');const m=minimizeSOP(mins(v),[],2);expect(truthTable(2,a=>evaluateSOP(m.expression,a))).toEqual(v)});
 it('full adder sum',()=>{const v=vals(3,'A XOR B XOR C');const m=minimizeSOP(mins(v),[],3);expect(truthTable(3,a=>evaluateSOP(m.expression,a))).toEqual(v)});
 it('full adder carry',()=>{const v=vals(3,'AB+AC+BC');const m=minimizeSOP(mins(v),[],3);expect(truthTable(3,a=>evaluateSOP(m.expression,a))).toEqual(v)});
 it('dont cares',()=>{const m=minimizeSOP([1,3,5,7],[0,2],3);expect(m.expression).toBe('C')});
 it('pos xor',()=>{const v=vals(2,'A XOR B');const zeros=v.map((x,i)=>x? -1:i).filter(i=>i>=0);const p=minimizePOS(zeros,[],2);expect(p.expression.length).toBeGreaterThan(0)});
});
