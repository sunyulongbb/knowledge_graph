import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
const source = readFileSync('public/assets/scripts/home-waterfall.js','utf8');
const layout = new Function(source.slice(source.indexOf('  function masonryPositions('), source.indexOf('  let current ='))+'; return masonryPositions;')();

test('masonry places each new card in the shortest column without changing previous positions', () => {
  const initial=layout([100,200,150],860);
  const appended=layout([100,200,150,80,90],860);
  expect(appended.positions.slice(0,3)).toEqual(initial.positions);
  expect(appended.positions[3].x).toBe(0);
  expect(appended.positions[3].y).toBe(116);
  for(let i=0;i<appended.positions.length;i++)for(let j=i+1;j<appended.positions.length;j++){
    const a=appended.positions[i],b=appended.positions[j];
    if(a.x===b.x)expect(b.y).toBeGreaterThanOrEqual(a.y+[100,200,150,80,90][i]!+16);
  }
});

test('narrow feeds fit one column and large screens cap at four columns', () => {
  const narrow=layout([100,200],220);
  expect(narrow.positions.map((p:any)=>p.x)).toEqual([0,0]);
  expect(narrow.width).toBe(220);
  expect(narrow.height).toBe(316);
  const wide=layout([10,10,10,10,10],1800);
  expect(wide.positions[4].x).toBe(0);
  expect(wide.positions[4].y).toBe(26);
});
