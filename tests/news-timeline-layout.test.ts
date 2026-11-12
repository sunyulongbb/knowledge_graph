import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const source=readFileSync('public/assets/scripts/news-timeline-layout.js','utf8');
const positions=new Function(source.slice(source.indexOf('  function newsTimelinePositions('),source.indexOf('  let active ='))+';return newsTimelinePositions;')();
test('alternating cards share vertical space with a compact same-side gap and no overlap',()=>{
  const heights=[300,300,300,300],result=positions(heights);
  expect(result.height).toBeLessThan((heights.reduce((sum,height)=>sum+height,0)+36)*.6);
  result.positions.forEach((position:any,index:number)=>{
    if(index>0)expect(position.top).toBeGreaterThan(result.positions[index-1].top);
    if(index>1)expect(position.top-result.positions[index-2].top-heights[index-2]!).toBe(12);
  });
  for(const sizes of [[90,330,120,70,400,80],[250],[300,100]]){
    const layout=positions(sizes);
    layout.positions.forEach((position:any,index:number)=>{
      expect(position.top+sizes[index]!).toBeLessThanOrEqual(layout.height);
      if(index>1)expect(position.top).toBeGreaterThanOrEqual(layout.positions[index-2].top+sizes[index-2]!+12);
    });
  }
  expect(positions([])).toEqual({positions:[],height:0});
});
test('cards relayout when media height changes and return to normal document flow on mobile',()=>{
  let frame:Function,resize:Function,desktop=true,disconnected=false;
  const classes=new Set<string>(),items=[300,180,200].map(height=>({offsetHeight:height,style:{width:'',transform:''}}));
  const list={clientWidth:864,children:items,style:{height:''},classList:{add:(name:string)=>classes.add(name),remove:(name:string)=>classes.delete(name)}};
  const root={querySelectorAll:()=>[list],addEventListener(){},removeEventListener(){}};
  const window:any={matchMedia:()=>({matches:desktop}),addEventListener(){},removeEventListener(){}};
  class Observer{constructor(fn:Function){resize=fn;}observe(){}disconnect(){disconnected=true;}}
  new Function('window','ResizeObserver','requestAnimationFrame','cancelAnimationFrame',source)(window,Observer,(fn:Function)=>{frame=fn;return 1;},()=>{});
  window.newsTimelineLayout.mount(root);frame!();
  expect(classes.has('is-compact-timeline')).toBe(true);expect(items[0]!.style.width).toBe('400px');
  expect(items[1]!.style.transform).toBe('translate(464px, 24px)');
  expect(list.style.height).toBe('512px');
  items[0]!.offsetHeight=400;resize!();frame!();expect(list.style.height).toBe('612px');
  desktop=false;resize!();frame!();expect(list.style.height).toBe('');expect(items.every(item=>item.style.width===''&&item.style.transform==='')).toBe(true);
  window.newsTimelineLayout.destroy();expect(disconnected).toBe(true);
});
