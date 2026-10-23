import { copyFileSync } from 'node:fs';

copyFileSync(
  'node_modules/cytoscape-dagre/dist/cytoscape-dagre.min.js',
  'public/js/cytoscape-dagre.min.js',
);
