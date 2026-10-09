import { expect, test } from 'bun:test';
import {
  clampPopoverPosition,
  graphPointFromClient,
  incrementGraphCount,
  normalizeOntologyColor,
  ontologyNodeCyElement,
  resolveTreePayload,
} from '../public/assets/scripts/vis-ontology-panel.js';

test('screen point converts to graph model coordinates with pan and zoom', () => {
  const rect = { left: 100, top: 40 };
  const viewport = { panX: 30, panY: -10, zoom: 2 };
  expect(graphPointFromClient(rect, viewport, 200, 100)).toEqual({ x: 35, y: 35 });
  // 平移到原点、缩放为 1 时退回“画布内偏移”
  expect(graphPointFromClient({ left: 0, top: 0 }, { panX: 0, panY: 0, zoom: 1 }, 12, 8)).toEqual({
    x: 12,
    y: 8,
  });
  // 非法缩放不应产生 Infinity
  expect(graphPointFromClient(rect, { zoom: 0 }, 100, 40)).toEqual({ x: 0, y: 0 });
});

test('popover position stays inside the canvas', () => {
  const bounds = { width: 600, height: 400 };
  const size = { width: 236, height: 140 };
  expect(clampPopoverPosition({ x: 300, y: 200 }, size, bounds)).toEqual({ left: 300, top: 200 });
  expect(clampPopoverPosition({ x: -40, y: -20 }, size, bounds)).toEqual({ left: 8, top: 8 });
  expect(clampPopoverPosition({ x: 900, y: 900 }, size, bounds)).toEqual({ left: 356, top: 252 });
});

test('ontology colors fall back to the default swatch', () => {
  expect(normalizeOntologyColor('#b9581f')).toBe('#b9581f');
  expect(normalizeOntologyColor('  #ABC  ')).toBe('#ABC');
  expect(normalizeOntologyColor('red')).toBe('#94a3b8');
  expect(normalizeOntologyColor('url(javascript:alert(1))')).toBe('#94a3b8');
  expect(normalizeOntologyColor('')).toBe('#94a3b8');
  expect(normalizeOntologyColor('', '#000000')).toBe('#000000');
});

test('created node maps to a cytoscape element', () => {
  const spec = ontologyNodeCyElement(
    {
      _id: 'entity/review_together_surf_001',
      name: '一起冲浪',
      color: '#22c55e',
      typeId: 'ontology/user-review',
      type: 'ontology/user-review',
      classId: 'ontology/user-review',
      classLabel: '用户评论',
      images: ['/uploads/a.png'],
    },
    '一起冲浪',
  );
  expect(spec).toEqual({
    group: 'nodes',
    data: {
      id: 'entity/review_together_surf_001',
      label: '一起冲浪',
      label_zh: '',
      color: '#22c55e',
      type: 'ontology/user-review',
      typeId: 'ontology/user-review',
      classId: 'ontology/user-review',
      classLabel: '用户评论',
      description: '',
      image: '/uploads/a.png',
      link: '',
      pdf: '',
    },
  });
  // 名称缺失时用拖拽的分类名兜底，没有 id 则不入图
  expect(ontologyNodeCyElement({ id: 'n1' }, '人物')?.data.label).toBe('人物');
  expect(ontologyNodeCyElement({ name: '无 id' })).toBeNull();
  expect(ontologyNodeCyElement(null)).toBeNull();
});

test('bottom bar counters follow a node created on the canvas', () => {
  expect(incrementGraphCount('全部 (12)', ['全部'])).toBe('全部 (13)');
  expect(incrementGraphCount('节点 12 · 边 8', ['节点'])).toBe('节点 13 · 边 8');
  expect(incrementGraphCount('节点 12 · 边 8', ['节点', '边'])).toBe('节点 13 · 边 9');
  // 文案为空或没有数字时保持原样
  expect(incrementGraphCount('', ['全部'])).toBe('');
  expect(incrementGraphCount('暂无节点', ['全部'])).toBe('暂无节点');
  expect(incrementGraphCount('全部 (0)', [])).toBe('全部 (0)');
});

test('tree rows resolve an ontology payload from any inner element', () => {
  const globalWithStyle = globalThis as typeof globalThis & {
    getComputedStyle?: (el: unknown) => { getPropertyValue: (name: string) => string };
  };
  const originalGetComputedStyle = globalWithStyle.getComputedStyle;
  globalWithStyle.getComputedStyle = () => ({ getPropertyValue: () => ' #b9581f ' });
  try {
    // 按在文字上：直接取标签元素
    const labelEl = {
      dataset: { treeNodeId: 'ontology/person' },
      textContent: '人物',
      previousElementSibling: { matches: () => true },
    };
    const labelTarget = {
      closest: (selector: string) => (selector === '[data-tree-node-id]' ? labelEl : null),
    };
    expect(resolveTreePayload(labelTarget)).toEqual({
      id: 'ontology/person',
      label: '人物',
      color: '#b9581f',
    });

    // 按在图标或行的空白处：回退到整行（DHTMLX 会给 li 打上 data-dhx-id）
    const row = {
      getAttribute: (name: string) => (name === 'data-dhx-id' ? 'ontology/place' : null),
      querySelector: (selector: string) =>
        selector === '.ontology-node-label' ? { textContent: '地点' } : { matches: () => true },
    };
    const rowTarget = {
      closest: (selector: string) => (selector === 'li[data-dhx-id]' ? row : null),
    };
    expect(resolveTreePayload(rowTarget)).toEqual({
      id: 'ontology/place',
      label: '地点',
      color: '#b9581f',
    });

    // 行上缺少本体 id，或目标不在树里
    expect(
      resolveTreePayload({
        closest: (selector: string) =>
          selector === 'li[data-dhx-id]' ? { getAttribute: () => '', querySelector: () => null } : null,
      }),
    ).toBeNull();
    expect(resolveTreePayload({ closest: () => null })).toBeNull();
    expect(resolveTreePayload(null)).toBeNull();
  } finally {
    if (originalGetComputedStyle) globalWithStyle.getComputedStyle = originalGetComputedStyle;
    else delete globalWithStyle.getComputedStyle;
  }
});
