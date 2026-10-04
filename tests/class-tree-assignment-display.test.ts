import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
test('assignment refresh updates badges without replacing the tree or changing scroll position', () => {
  const source = readFileSync('public/assets/scripts/ontology-tree.ts', 'utf8');
  const method = source.slice(source.indexOf('  refreshAssignedStates()'), source.indexOf('  setExpanded('));
  const js = new Bun.Transpiler({loader:'ts'}).transformSync(`class Controller { ${method} }`);
  const Controller = new Function('document', `${js}; return Controller;`)({createElement:()=>({textContent:''})});
  let badge: any = null; const attrs: any = {}; let selected = false;
  const row = {dataset:{classActivate:'child'},title:'',classList:{toggle:(_:string,v:boolean)=>{selected=v;}},setAttribute:(k:string,v:string)=>{attrs[k]=v;},querySelector:()=>badge,append:(item:any)=>{badge=item;item.remove=()=>{badge=null;};}};
  const container = {scrollTop:480,querySelectorAll:()=>[row]};
  const controller = new Controller();controller.container=container;
  let assigned=true;controller.options={nodeIconFilled:()=>assigned};
  controller.refreshAssignedStates();
  expect(selected).toBe(true);expect(badge.textContent).toBe('已分类');expect(container.scrollTop).toBe(480);
  assigned=false;controller.refreshAssignedStates();
  expect(badge).toBeNull();expect(attrs['aria-pressed']).toBe('false');expect(container.scrollTop).toBe(480);
});
