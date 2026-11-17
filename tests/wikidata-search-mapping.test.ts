import {test,expect} from 'bun:test';
import {ensureEntitySearchMapping} from '../src/server/enterprise-search';
test('multilingual imports get sufficient ES field capacity without lowering larger limits',async()=>{
  for(const limit of [1000,30000]){
    const calls:any[]=[];
    const client={send:async(path:string,init:any)=>{calls.push([path,init]);return {body:{default:{settings:{'index.mapping.total_fields.limit':String(limit)}}}};}} as any;
    await ensureEntitySearchMapping(client,'default');
    const update=calls.find(([path,init])=>path==='/default/_settings'&&init?.method==='PUT');
    if(limit===1000)expect(JSON.parse(update[1].body)['index.mapping.total_fields.limit']).toBe(20000);
    else expect(update).toBeUndefined();
  }
});
