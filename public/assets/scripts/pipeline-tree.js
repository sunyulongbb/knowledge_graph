// Reuse the ontology picker used by property management; keep the popup outside scroll panes.
let popup, controller, trigger;
export function closePipelineTree() {
  // Selection emits before DHTMLX finishes its queued paint. Dispose after that paint.
  const previous = controller; controller = null;
  if (previous) requestAnimationFrame(() => requestAnimationFrame(() => previous.destroy()));
  popup?.remove(); popup = null;
  trigger?.setAttribute('aria-expanded', 'false'); trigger = null;
}
export async function openPipelineTree(button, nodes, input) {
  if (trigger === button) { closePipelineTree(); return; }
  closePipelineTree(); trigger = button;
  button.setAttribute('aria-expanded', 'true');
  const panel = document.createElement('div'); popup = panel;
  panel.id = 'pipelineOntologyPopup'; panel.className = 'pipeline-tree-popup';
  panel.setAttribute('aria-label', '选择目标本体');
  panel.innerHTML = '<input type="search" class="kb-input" placeholder="搜索本体" aria-label="搜索本体"><div class="ontology-dropdown-plugin-host">加载中…</div>';
  document.body.appendChild(panel);
  const rect = button.getBoundingClientRect(), width = Math.min(320, innerWidth - 24), height = Math.min(340, innerHeight - 24);
  Object.assign(panel.style, { width:width+'px', height:height+'px', left:Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px', top:Math.max(12,Math.min(rect.bottom+4,innerHeight-height-12))+'px' });
  try {
    const module = await (window.kbOntologyTreeModuleReady || import('/assets/generated/ontology-tree.js'));
    if (popup !== panel) return;
    controller = new module.OntologyTreeController(panel.querySelector('div'), {
      showAllButton:true, allLabel:'清除选择', enableDrag:false, enableContextMenu:false,
      disableReadonlyItems:false, toggleSelection:false, storageKey:'kb:ontology-tree-state:pipeline',
      onSelect:id => { input.value = id || ''; closePipelineTree(); button.focus(); input.dispatchEvent(new Event('change',{bubbles:true})); },
      onEdit:()=>{}, onAddChild:()=>{}, onDelete:()=>{}, onReload:()=>{},
    });
    controller.update(nodes, input.value);
    const search = panel.querySelector('input'); search.addEventListener('input',()=>controller?.filter(search.value)); search.focus();
  } catch { if (popup === panel) panel.querySelector('div').textContent = '本体加载失败，请关闭后重试'; }
}
document.addEventListener('pointerdown',e=>{ if (popup && !popup.contains(e.target) && !trigger?.contains(e.target)) closePipelineTree(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape' && popup) { const button=trigger; closePipelineTree(); button?.focus(); } });
window.addEventListener('resize',closePipelineTree);
window.addEventListener('hashchange',closePipelineTree);
