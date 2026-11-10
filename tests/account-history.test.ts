import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
test('initial authenticated view is recorded after auth resolves; anonymous views are not assigned to a later login',async()=>{
  const listeners:Record<string,Function>={},requests:URL[]=[];
  const window:any={addEventListener:(name:string,fn:Function)=>listeners[name]=fn};
  new Function('window','location','fetch',readFileSync('public/assets/scripts/account-history.js','utf8'))(window,{origin:'http://localhost',search:'?db=demo'},async(url:URL)=>{requests.push(url);return{ok:true};});
  window.recordKnowledgeView('a');window.recordKnowledgeView('entity/b');
  expect(requests).toHaveLength(0);
  window.authUser={id:1};listeners['kb-auth-change']!();
  expect(requests).toHaveLength(1);expect(requests[0]?.searchParams.get('id')).toBe('b');expect(requests[0]?.searchParams.get('db')).toBe('demo');
  window.recordKnowledgeView('b');expect(requests).toHaveLength(1);
  window.authUser=null;listeners['kb-auth-change']!();window.recordKnowledgeView('anonymous');
  window.authUser={id:2};listeners['kb-auth-change']!();expect(requests).toHaveLength(1);
  window.recordKnowledgeView('a');expect(requests).toHaveLength(2);
});
