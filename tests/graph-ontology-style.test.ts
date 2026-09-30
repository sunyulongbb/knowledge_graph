import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

test('ontology styles stay isolated and apply to newly added nodes', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const start = html.indexOf('    const GRAPH_NODE_STYLE_FIELDS');
  const end = html.indexOf('    function showGraphLoading', start);
  const defaultsStart = html.indexOf('    const KB_VIS_STYLE_DEFAULTS');
  const defaultsEnd = html.indexOf('    function getGraphStyleConfig', defaultsStart);
  const context = createContext({ module: { exports: {} }, exports: {}, console: { log() {}, warn() {} }, setTimeout, clearTimeout, performance });
  runInContext(readFileSync(new URL('../public/js/cytoscape.min.js', import.meta.url), 'utf8'), context);
  const result = runInContext(`
    const window = {kbOntologies:[{id:'T1',name:'People'},{id:'T2',name:'Places'}]};
    const storage = new Map(); let db = 'one';
    const localStorage = {getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)};
    const getCurrentGraphDbScope = () => db;
    const getGraphStyleConfig = () => ({...KB_VIS_STYLE_DEFAULTS});
    const getGraphThemePalette = () => ({nodeBackground:'#ffffff',nodeBorder:'#000000',accent:'#0000ff',text:'#000000',edgeColor:'#000000'});
    const formatGraphNodeLabel = () => 'Label';
    ${html.slice(defaultsStart, defaultsEnd)}
    ${html.slice(start, end)}
    persistOntologyGraphStyle('T1',{...KB_VIS_STYLE_DEFAULTS,nodeShape:'circle',nodeAutoSize:false,nodeSize:80,nodeLabelPosition:'bottom'});
    persistOntologyGraphStyle('T2',{...KB_VIS_STYLE_DEFAULTS,nodeShape:'star',nodeAutoSize:false,nodeSize:160,nodeFontSize:16});
    const cy = module.exports({headless:true,styleEnabled:true,elements:[{data:{id:'a',type:'T1'}},{data:{id:'b',type:'Places'}},{data:{id:'c',classId:'T1'}}]});
    cy.style().fromJson(buildCyStyle().filter(s=>s.selector==='node'||s.selector==='node:selected')).update();
    const a=cy.getElementById('a'), b=cy.getElementById('b'), c=cy.getElementById('c');
    const values = [a.width(),a.style('shape'),a.style('text-valign'),b.width(),b.style('shape'),parseFloat(b.style('font-size')),c.style('shape')];
    a.select(); values.push(a.width(),b.width());
    cy.add({data:{id:'later',type:'T1'}}); values.push(cy.getElementById('later').width());
    db='two'; values.push(Object.keys(getOntologyGraphStyles()).length);
    db='one'; values.push(getOntologyGraphStyles().T1.nodeSize);
    cy.destroy(); values;
  `, context);
  expect(Array.from(result)).toEqual([80, 'ellipse', 'bottom', 160, 'star', 16, 'round-rectangle', 80, 160, 80, 0, 80]);
});
