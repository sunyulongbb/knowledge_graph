import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { buildNetwork, transitIslands } from '../public/assets/scripts/knowledge-roam-graph.js';

test('groups interconnected lines together and sorts independent maps largest first', () => {
  const pairs = [['A','B'],['B','C'],['C','D'], ['W','X'],['X','Y'],['Y','Z'],['Y','P'],['P','Q']];
  const network = buildNetwork({ nodes: [...new Set(pairs.flat())].map(id => ({ id })), edges: pairs.map(([source,target]) => ({ source,target })) });
  const islands = transitIslands(network);
  expect(islands.map(island => island.nodes.size)).toEqual([6,4]);
  expect(islands[0].nodes.has('W')).toBe(true);
  expect(islands[0].nodes.has('Q')).toBe(true);
  expect(islands[0].nodes.has('A')).toBe(false);
  for (const island of islands) {
    for (const edge of network.edges.filter(edge => island.edges.has(edge.id))) {
      expect(island.nodes.has(edge.source) && island.nodes.has(edge.target)).toBe(true);
    }
  }
  expect(transitIslands(network)).toEqual(islands);
  expect(transitIslands(buildNetwork({}))).toEqual([]);
});

test('islands follow visible paths instead of hidden relations', () => {
  const network = buildNetwork({ nodes: ['A','B','C','D'].map(id => ({id})), edges: [
    {source:'A',target:'B'}, {source:'B',target:'C'}, {source:'C',target:'D'},
  ] });
  expect(transitIslands(network, {nodes:new Set(['A','B','C','D']), edges:new Set(['link-0','link-2'])}).map(item => [...item.nodes])).toEqual([['A','B'],['C','D']]);
});

test('switching islands clears the old route, restricts station choices and fits the new map', () => {
  const source = readFileSync(new URL('../public/assets/scripts/knowledge-roam.js', import.meta.url), 'utf8');
  const block = source.slice(source.indexOf('function selectIsland('), source.indexOf('function draw()'));
  const tabs = [0,1].map(index => ({dataset:{island:String(index)}, tabIndex:0, setAttribute(key:string,value:string) { this[key] = value; }}));
  const controls = Object.fromEntries(['islands','island-panel','start','end'].map(id => [id, {innerHTML:'old', querySelectorAll:()=>tabs, setAttribute(){}, removeAttribute(){}}]));
  const calls:string[] = [];
  const result = new Function('get','label','escape','calls', `
    const islands = [{nodes:new Set(['A']),edges:new Set()}, {nodes:new Set(['X','Y']),edges:new Set()}];
    let activeIsland=0, overview=islands[0], route={}, step=2, journeySidebar=null;
    const visited=new Set(['A']);
    let graph={destroy(){calls.push('destroy')}};
    function draw(){calls.push('draw');graph={resize(){calls.push('resize')},fit(){calls.push('fit')}}}
    function selectRoute(){calls.push('select')}
    ${block}
    selectIsland(1);selectIsland(1);selectIsland(99);
    return {activeIsland,route,step,visited:[...visited],nodes:[...overview.nodes]};
  `)((id:string)=>controls[id], (id:string)=>id, (id:string)=>id, calls);
  expect(result).toEqual({activeIsland:1,route:null,step:-1,visited:[],nodes:['X','Y']});
  expect(calls).toEqual(['destroy','draw','select','resize','fit']);
  expect(controls.start.innerHTML).toContain('value="X"');
  expect(controls.start.innerHTML).not.toContain('value="A"');
  expect(tabs[1]['aria-selected']).toBe('true');
  expect(tabs[0].tabIndex).toBe(-1);
});
