import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

const source = readFileSync('public/assets/scripts/application-pages.js', 'utf8');
const block = source.slice(source.indexOf("  byId('applicationHomePanel').addEventListener('click'"), source.indexOf('  function writeSearchRoute()'));

test('home navigation opens existing views and account/theme controls', () => {
  const views: string[] = [], clicked: string[] = [];
  let click: Function;
  const byId = (id: string) => id === 'applicationHomePanel'
    ? { addEventListener: (_: string, handler: Function) => { click = handler; } }
    : { click: () => clicked.push(id) };
  new Function('byId', 'window', block)(byId, { setViewMode: (view: string) => views.push(view), openQuickKnowledge: () => clicked.push('quick-create') });
  for (const action of ['shorts', 'app_explore', 'create', 'applications', 'account', 'theme']) {
    click!({ target: { closest: (selector: string) => selector === '[data-home-action]' ? { dataset: { homeAction: action } } : null } });
  }
  expect(views).toEqual(['shorts', 'app_explore', 'applications']);
  expect(clicked).toEqual(['quick-create', 'btnAuth', 'btnTheme']);
});

test('changing home feed resets category and pagination before requesting new content', () => {
  const harness = new Function('byId', 'window', `
    let homeFeed='for-you', homeSelectedCategory='category', homeNodes=[1],homeVisibleNodes=[1],homePage=4,homeTotal=100;
    let loads=[];function syncHomeNavigation(){}function loadHomePage(page,category){loads.push([page,category,homeFeed]);}
    ${block}
    return ()=>({homeFeed,homeSelectedCategory,homePage,homeTotal,homeNodes,loads});
  `);
  let click: Function;
  const state = harness(() => ({ addEventListener: (_: string, handler: Function) => { click = handler; } }), { kbViewMode: 'app_home' });
  click!({ target: { closest: (selector: string) => selector === '[data-home-feed]' ? ({ dataset: { homeFeed: 'popular' } }) : null } });
  expect(state()).toMatchObject({homeFeed:'popular',homeSelectedCategory:'',homePage:1,homeTotal:0,homeNodes:[],loads:[[1,'','popular']]});
});

test('feed navigation from Short returns to the homepage content instead of loading behind the player', () => {
  let click: Function;
  const views: string[] = [];
  const byId = () => ({ addEventListener: (_: string, handler: Function) => { click = handler; } });
  new Function('byId', 'window', `let homeFeed='for-you'; ${block}`)(byId, {
    kbViewMode: 'shorts', setViewMode: (view: string) => views.push(view),
  });
  click!({ target: { closest: (selector: string) => selector === '[data-home-feed]' ? ({ dataset: { homeFeed: 'for-you' } }) : null } });
  expect(views).toEqual(['app_home']);
});
