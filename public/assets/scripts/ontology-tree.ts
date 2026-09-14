import { Tree } from "@dhtmlx/tree";
import "@dhtmlx/tree/codebase/tree.min.css";
import {
  createOntologyMovePayload,
  flattenOntologyTree,
  isIllegalOntologyMove,
  toOntologyTreeItems,
  type OntologyRecord,
} from "./ontology-tree-adapter";
import { moveOntology } from "./ontology-tree-api";

type TreeState = Record<string, { selected: number; open: boolean }>;

export type OntologyTreeControllerOptions = {
  onSelect: (id: string) => void | Promise<void>;
  onEdit: (id: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  onReload: () => void | Promise<void>;
  onError?: (message: string) => void;
  allLabel?: string;
  showAllButton?: boolean;
  enableDrag?: boolean;
  enableContextMenu?: boolean;
  disableReadonlyItems?: boolean;
  toggleSelection?: boolean;
  onDoubleClick?: (id: string) => void;
  storageKey?: string;
  nodeIcon?: "dot" | "folder";
  nodeIconFilled?: (id: string) => boolean;
  onNodeIconClick?: (id: string) => void | Promise<void>;
};

const STORAGE_KEY = "kb:ontology-tree-state";

export class OntologyTreeController {
  private tree: Tree | null = null;
  private records: OntologyRecord[] = [];
  private selectedId = "";
  private busy = false;
  private syncing = false;
  private suppressNextSelect = false;
  private toggleTimer: ReturnType<typeof setTimeout> | null = null;
  private menu: HTMLElement | null = null;

  constructor(
    private container: HTMLElement,
    private options: OntologyTreeControllerOptions,
  ) {}

  setLoading(): void {
    this.destroyTree();
    this.container.innerHTML =
      '<div class="ontology-tree-state" role="status"><span class="ontology-tree-spinner"></span>加载本体中...</div>';
  }

  setError(message = "本体加载失败"): void {
    this.destroyTree();
    this.container.innerHTML = "";
    const state = document.createElement("div");
    state.className = "ontology-tree-state ontology-tree-state--error";
    state.setAttribute("role", "alert");
    state.textContent = message;
    const retry = document.createElement("button");
    retry.type = "button";
    retry.className = "btn sm";
    retry.textContent = "重试";
    retry.addEventListener("click", () => void this.options.onReload());
    state.appendChild(retry);
    this.container.appendChild(state);
  }

  update(nodes: OntologyRecord[], selectedId = ""): void {
    const oldState = this.readState();
    this.destroyTree();
    this.records = flattenOntologyTree(nodes, []);
    this.selectedId = selectedId;
    this.container.innerHTML = "";
    if (this.options.showAllButton !== false) {
      const allButton = document.createElement("button");
      allButton.type = "button";
      allButton.className = `ontology-tree-all${selectedId ? "" : " is-selected"}`;
      allButton.textContent = this.options.allLabel || "全部属性";
      allButton.title =
        this.options.allLabel === "全部分类" ? "显示全部分类" : "显示全部属性";
      allButton.addEventListener("click", () => void this.options.onSelect(""));
      this.container.appendChild(allButton);
    }
    if (!nodes.length) {
      const empty = document.createElement("div");
      empty.className = "ontology-tree-state";
      empty.textContent = "暂无本体，点击“新增本体”开始。";
      this.container.appendChild(empty);
      return;
    }
    const host = document.createElement("div");
    host.className = "ontology-dhtmlx-host";
    if (this.options.onNodeIconClick) {
      const activateIcon = (event: Event) => {
        const target = event.target as HTMLElement | null;
        const icon = target?.closest<HTMLElement>("[data-ontology-node-icon]");
        if (!icon || !host.contains(icon)) return;
        event.preventDefault();
        event.stopPropagation();
        const id = icon.dataset.ontologyNodeIcon || "";
        if (id) void this.options.onNodeIconClick?.(id);
      };
      host.addEventListener("click", activateIcon, true);
      host.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") activateIcon(event);
      }, true);
    }
    this.container.appendChild(host);
    const openedIds = new Set(
      Object.entries(oldState)
        .filter(([, value]) => value.open)
        .map(([id]) => id),
    );
    this.tree = new Tree(host, {
      dragMode: this.options.enableDrag === false ? undefined : "both",
      dropBehaviour: this.options.enableDrag === false ? undefined : "complex",
      keyNavigation: true,
      selection: true,
      tooltip: (item) => String(item.value || ""),
      template: (item) => {
        const color = String(item.data?.color || "#94a3b8");
        const filled = Boolean(this.options.nodeIconFilled?.(String(item.id)));
        const icon = this.options.nodeIcon === "folder"
          ? `<span class="ontology-node-folder" style="--ontology-node-color:${this.escape(color)}" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path fill="currentColor" d="M3 5.75A1.75 1.75 0 0 1 4.75 4h5.19c.46 0 .9.18 1.23.51L12.66 6h6.59A1.75 1.75 0 0 1 21 7.75v8.5A2.75 2.75 0 0 1 18.25 19H5.75A2.75 2.75 0 0 1 3 16.25V5.75Z"/></svg></span>`
          : `<span class="ontology-node-dot${filled ? " is-filled" : ""}" style="--ontology-node-color:${this.escape(color)}"${this.options.onNodeIconClick ? ` data-ontology-node-icon="${this.escape(String(item.id))}" role="button" tabindex="0" aria-pressed="${filled}" aria-label="${filled ? "取消分类" : "添加分类"}"` : ""}></span>`;
        return `${icon}<span class="ontology-node-label">${this.escape(item.value)}</span>`;
      },
    });
    this.bindTreeEvents();
    this.syncing = true;
    try {
      // DHTMLX accepts nested root items without `parent` at runtime, although its
      // public ITreeItem declaration currently marks that field as required.
      const treeItems = toOntologyTreeItems(nodes, openedIds);
      if (this.options.disableReadonlyItems === false) {
        const enableItems = (items: typeof treeItems) => {
          for (const item of items) {
            item.disabled = false;
            if (item.items) enableItems(item.items);
          }
        };
        enableItems(treeItems);
      }
      this.tree.data.parse(treeItems as never);
      const restorable = Object.fromEntries(
        Object.entries(oldState)
          .filter(([id]) => this.records.some((item) => item.id === id))
          .map(([id, value]) => [
            id,
            { ...value, selected: id === selectedId ? 1 : 0 },
          ]),
      );
      if (Object.keys(restorable).length) this.tree.setState(restorable);
      if (selectedId && this.tree.data.exists(selectedId))
        this.tree.selection.add(selectedId);
    } finally {
      this.syncing = false;
    }
    this.saveState();
  }

  filter(query: string): void {
    if (!this.tree) return;
    const value = query.trim().toLocaleLowerCase();
    this.tree.data.filter(
      value
        ? (item) =>
            String(item.value || "")
              .toLocaleLowerCase()
              .includes(value)
        : undefined,
      { id: "ontology-search" },
    );
    if (value) this.tree.expandAll();
    else this.restoreSavedState();
  }

  select(id: string): void {
    if (!this.tree || !id || !this.tree.data.exists(id)) return;
    if (this.toggleTimer) {
      clearTimeout(this.toggleTimer);
      this.toggleTimer = null;
    }
    this.tree.selection.add(id);
    this.selectedId = id;
  }

  clearSelection(): void {
    if (this.toggleTimer) {
      clearTimeout(this.toggleTimer);
      this.toggleTimer = null;
    }
    if (
      this.tree &&
      this.selectedId &&
      this.tree.data.exists(this.selectedId)
    ) {
      this.suppressNextSelect = true;
      this.tree.selection.remove(this.selectedId);
    }
    this.selectedId = "";
    this.saveState();
    void this.options.onSelect("");
    setTimeout(() => {
      this.suppressNextSelect = false;
    }, 0);
  }

  destroy(): void {
    if (this.toggleTimer) clearTimeout(this.toggleTimer);
    this.toggleTimer = null;
    this.destroyTree();
    this.menu?.remove();
    this.menu = null;
    this.container.innerHTML = "";
  }

  private bindTreeEvents(): void {
    const tree = this.tree!;
    tree.events.on("itemClick", (rawId) => {
      if (this.syncing || !this.options.toggleSelection) return;
      const id = String(rawId);
      if (id !== this.selectedId) return;
      if (this.toggleTimer) clearTimeout(this.toggleTimer);
      this.toggleTimer = setTimeout(() => {
        this.toggleTimer = null;
        this.suppressNextSelect = true;
        tree.selection.remove(id);
        this.selectedId = "";
        this.saveState();
        void this.options.onSelect("");
        setTimeout(() => {
          this.suppressNextSelect = false;
        }, 0);
      }, 260);
    });
    tree.selection.events.on("afterSelect", (rawId) => {
      if (this.syncing) return;
      if (this.suppressNextSelect) {
        this.suppressNextSelect = false;
        return;
      }
      const id = String(rawId);
      this.selectedId = id;
      this.saveState();
      void this.options.onSelect(id);
    });
    tree.events.on("afterExpand", () => this.saveState());
    tree.events.on("afterCollapse", () => this.saveState());
    tree.events.on("itemDblClick", (rawId, event) => {
      (event as MouseEvent | undefined)?.preventDefault();
      (event as MouseEvent | undefined)?.stopPropagation();
      if (this.toggleTimer) {
        clearTimeout(this.toggleTimer);
        this.toggleTimer = null;
      }
      const id = String(rawId);
      if (this.options.onDoubleClick) this.options.onDoubleClick(id);
      else this.options.onEdit(id);
    });
    tree.events.on("itemRightClick", (rawId, event) => {
      event.preventDefault();
      if (this.options.enableContextMenu === false) return;
      this.showContextMenu(String(rawId), event as MouseEvent);
    });
    tree.events.on("beforeDrag", (data) => {
      if (this.options.enableDrag === false) return false;
      const source = this.records.find(
        (item) => item.id === String(data.start),
      );
      return !this.busy && !source?.readonly && !source?.system;
    });
    tree.events.on("beforeDrop", (data) => {
      if (this.options.enableDrag === false) return false;
      const movedId = String(data.start);
      const targetId = data.target == null ? null : String(data.target);
      if (isIllegalOntologyMove(movedId, targetId, this.records)) {
        this.notify("不能将本体移动到自身或其后代下面");
        return false;
      }
      return !this.busy;
    });
    tree.events.on(
      "afterDrop",
      (data) => void this.persistDrop(String(data.start)),
    );
  }

  private async persistDrop(id: string): Promise<void> {
    if (!this.tree || this.busy) return;
    this.busy = true;
    this.container.setAttribute("aria-busy", "true");
    try {
      const root = String(this.tree.data.getRoot());
      const rawParent = String(this.tree.data.getParent(id));
      const parentId = rawParent === root ? null : rawParent;
      const siblings = this.tree.data
        .getItems(parentId ?? root)
        .map((item) => String(item.id));
      const payload = createOntologyMovePayload(id, parentId, siblings);
      await moveOntology(id, payload);
      await this.options.onReload();
    } catch (error) {
      this.notify(
        `移动本体失败，已恢复服务器状态：${error instanceof Error ? error.message : String(error)}`,
      );
      await this.options.onReload();
    } finally {
      this.busy = false;
      this.container.removeAttribute("aria-busy");
    }
  }

  private showContextMenu(id: string, event: MouseEvent): void {
    this.menu?.remove();
    const record = this.records.find((item) => item.id === id);
    const menu = document.createElement("div");
    menu.className = "ontology-tree-context-menu";
    menu.setAttribute("role", "menu");
    const actions = [
      ["新增子本体", () => this.options.onAddChild(id), false],
      [
        "编辑",
        () => this.options.onEdit(id),
        Boolean(record?.readonly || record?.system),
      ],
      [
        "删除",
        () => this.options.onDelete(id),
        Boolean(record?.readonly || record?.system),
      ],
    ] as const;
    for (const [label, action, disabled] of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = disabled;
      button.setAttribute("role", "menuitem");
      button.addEventListener("click", () => {
        menu.remove();
        action();
      });
      menu.appendChild(button);
    }
    menu.style.left = `${Math.min(event.clientX, window.innerWidth - 170)}px`;
    menu.style.top = `${Math.min(event.clientY, window.innerHeight - 130)}px`;
    document.body.appendChild(menu);
    this.menu = menu;
    const close = () => {
      menu.remove();
      document.removeEventListener("click", close);
    };
    setTimeout(() => document.addEventListener("click", close), 0);
    menu.querySelector<HTMLElement>("button:not(:disabled)")?.focus();
  }

  private readState(): TreeState {
    if (this.tree) return this.tree.getState() as TreeState;
    try {
      return JSON.parse(
        sessionStorage.getItem(this.options.storageKey || STORAGE_KEY) || "{}",
      );
    } catch {
      return {};
    }
  }

  private saveState(): void {
    if (!this.tree) return;
    try {
      sessionStorage.setItem(
        this.options.storageKey || STORAGE_KEY,
        JSON.stringify(this.tree.getState()),
      );
    } catch {}
  }

  private restoreSavedState(): void {
    if (!this.tree) return;
    const state = this.readState();
    const valid = Object.fromEntries(
      Object.entries(state).filter(([id]) => this.tree?.data.exists(id)),
    );
    this.tree.setState(valid);
    if (this.selectedId && this.tree.data.exists(this.selectedId))
      this.tree.selection.add(this.selectedId);
  }

  private destroyTree(): void {
    if (this.tree) {
      this.saveState();
      this.tree.destructor();
      this.tree = null;
    }
  }

  private notify(message: string): void {
    if (this.options.onError) this.options.onError(message);
    else window.alert(message);
  }

  private escape(value: unknown): string {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
}

export { loadOntologyTree } from "./ontology-tree-api";
