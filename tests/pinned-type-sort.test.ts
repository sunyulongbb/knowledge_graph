import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
test('pinned types can move above or below another type and persist',()=>{
 const source=readFileSync('public/assets/scripts/knowledge-explore.js','utf8');
 const code=source.slice(source.indexOf('  function movePin('),source.indexOf('  function renderPins()'));
 let pins=[{id:'a'},{id:'b'},{id:'c'}];let rendered=0;
 const move=new Function('readPins','localStorage','pinKey','renderPins','pinStatus',code+';return movePin;')(
 ()=>pins,{setItem:(_:string,value:string)=>{pins=JSON.parse(value);}},()=> 'account:app',()=>rendered++,{});
 move('a','c',true);expect(pins.map(item=>item.id)).toEqual(['b','c','a']);
 move('a','b',false);expect(pins.map(item=>item.id)).toEqual(['a','b','c']);expect(rendered).toBe(2);
});
