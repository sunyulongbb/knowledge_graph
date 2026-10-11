import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../public/assets/scripts/graph-details.js', import.meta.url), 'utf8');
function setup() {
  class Element {
    children: any[] = []; parentNode: any; hidden = false; value = ''; scrollTop = 9;
    style = { display: '' }; handlers: Record<string, Function> = {}; attrs: Record<string,string> = {};
    classes = new Set<string>();
    classList = { add: (s: string) => this.classes.add(s), remove: (s: string) => this.classes.delete(s), toggle: (s: string, v: boolean) => v ? this.classes.add(s) : this.classes.delete(s) };
    appendChild(c: any) { if(c.parentNode) c.parentNode.children = c.parentNode.children.filter((x:any)=>x!==c); c.parentNode=this; this.children.push(c); }
    before(c: any) { c.parentNode=this.parentNode; this.parentNode.children.splice(this.parentNode.children.indexOf(this),0,c); }
    after(c: any) { if(c.parentNode) c.parentNode.children=c.parentNode.children.filter((x:any)=>x!==c); c.parentNode=this.parentNode; this.parentNode.children.splice(this.parentNode.children.indexOf(this)+1,0,c); }
    replaceChildren(...cs: any[]) { this.children=cs; } add(c:any){this.children.push(c);}
    setAttribute(k:string,v:string){this.attrs[k]=v;} addEventListener(k:string,f:Function){this.handlers[k]=f;}
  }
  const ids=['detailPanel','detailInner','visDetailHost','visRecommendContent','visDetailContent','visRecommendTab','visDetailTab','visRecommendPanel','cy_btnRecommendPanel','visDetailEmpty','cy'];
  const elements=Object.fromEntries(ids.map(id=>[id,new Element()]));
  const home=new Element(); home.appendChild(elements.detailPanel);
  let graphIds=['Q1','Q2']; let refresh:Function=()=>{};
  const calls:any[]=[]; const selected:string[]=[]; let embedded:any=null;
  const mediaViewer={open:(id:string,options:any)=>{calls.push([id,options]);embedded=options.embedded;},close:()=>{const previous=embedded;embedded=null;previous?.onClose();},isEmbedded:()=>!!embedded,updateFeed:()=>{}};
  const window:any={kbViewMode:'vis',kbSelectGraphDetailNode:(id:string)=>selected.push(id),homeKnowledgeMediaViewer:mediaViewer,showNodeDetailInline:(...args:any[])=>calls.push(args),kbCy:{nodes:()=>({toArray:()=>graphIds.map(id=>({id:()=>id,data:(key:string)=>key==='label'?`Name ${id}`:false}))}),on:(event:string,fn:Function)=>{if(event === "add remove data") refresh=fn;}}};
  new Function('document','window','Option','MutationObserver',source)({getElementById:(id:string)=>elements[id],createComment:()=>new Element()},window,class {constructor(public text:string,public value:string){}},class {observe(){}});
  return {window,elements,home,calls,selected,change:(ids:string[])=>{graphIds=ids;refresh();}};
}
test('canvas detail embeds the actual home media viewer with the current graph feed',()=>{
  const h=setup(); h.window.kbGraphDetails.open('Q1');
  expect(h.calls[0][0]).toBe('Q1');
  expect(h.calls[0][1].nodes.map((node:any)=>node.id)).toEqual(['Q1','Q2']);
  expect(h.calls[0][1].embedded.host).toBe(h.elements.visDetailHost);
  expect(h.elements.detailPanel.parentNode).toBe(h.home);
  expect(h.window.kbGraphDetails.isActive()).toBe(true);
  h.calls[0][1].embedded.onNodeChange('Q2');
  expect(h.selected).toEqual(['Q2']);
  h.elements.visRecommendTab.handlers.click();
  expect(h.window.kbGraphDetails.isActive()).toBe(false);
  expect(h.elements.visDetailContent.hidden).toBe(true);
});
test('removing active graph node closes its media viewer and shows empty state',()=>{
  const h=setup();h.window.kbGraphDetails.open('Q1');h.change(['Q2']);
  expect(h.window.kbGraphDetails.isActive()).toBe(false);
  expect(h.elements.visDetailEmpty.hidden).toBe(false);

});
test('ontology selection recommends its type while clearing legacy graph restrictions',()=>{
  const code=readFileSync(new URL('../public/assets/scripts/vis-ontology-panel.js',import.meta.url),'utf8');
  const handler=code.slice(code.indexOf('function handleOntologySelect'),code.indexOf('function applyTailTypeFilter'));
  const recommendations:string[]=[];const filters:any[]=[];
  new Function('loadRecommendations','applyTailTypeFilter',`${handler};handleOntologySelect('Type1');`)((id:string)=>recommendations.push(id),(...args:any[])=>filters.push(args));
  expect(recommendations).toEqual(['Type1']);
  expect(filters).toEqual([['']]);
});
test('detail paging synchronizes selection and pans without changing zoom or reloading the graph',()=>{
  const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
  const start=html.indexOf('    window.kbSelectGraphDetailNode =');
  const code=html.slice(start,html.indexOf('\n    function focusNode',start));
  const selections:any[]=[],focus:any[]=[],routes:any[]=[];
  const window:any={kbViewMode:'vis',setTableSelection:(...args:any[])=>selections.push(args)};
  new Function('window','focusNode','syncHashForView',code)(window,(...args:any[])=>focus.push(args),(...args:any[])=>routes.push(args));
  window.kbSelectGraphDetailNode('entity/Q2');
  expect(selections).toEqual([['entity/Q2',false,{skipDetailRefresh:true,skipSidebarSync:true,skipGraphFocus:true}]]);
  expect(focus).toEqual([['entity/Q2',{fit:false,duration:180}]]);
  expect(routes).toEqual([['vis',{nodeId:'entity/Q2',includeNode:true,replace:true}]]);
  window.kbViewMode='app_home';window.kbSelectGraphDetailNode('Q1');
  expect(selections).toHaveLength(1);
  expect(html).not.toContain('id="visDetailNodeSelect"');
});
