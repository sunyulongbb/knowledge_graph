import { Grid } from "@dhtmlx/grid";
import "@dhtmlx/grid/codebase/grid.min.css";

export type BusinessGridColumn = {
  id: string | number;
  header?: Array<Record<string, unknown>>;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  gravity?: number;
  sortable?: boolean;
  editable?: boolean;
  editorType?: "input" | "select" | "datePicker" | "checkbox" | "combobox" | "multiselect" | "textarea";
  options?: Array<string | { id: string | number; value: string }>;
  template?: (value: unknown, row: BusinessGridRow, column: BusinessGridColumn) => string;
  htmlEnable?: boolean;
  [key: string]: unknown;
};
export type BusinessGridRow = { id: string | number; [key: string]: unknown };
export type BusinessGridFilterValue = string | string[] | Date | Date[];
export type BusinessGridFilters = Record<string, BusinessGridFilterValue>;

export type BusinessGridOptions = {
  columns: BusinessGridColumn[];
  data?: BusinessGridRow[];
  selection?: "cell" | "row" | "complex";
  multiselection?: boolean;
  selectAll?: boolean;
  editable?: boolean;
  sortable?: boolean;
  rowHeight?: number;
  headerRowHeight?: number;
  height?: number | "auto";
  emptyText?: string;
  onCellClick?: (row: BusinessGridRow, column: BusinessGridColumn, event: MouseEvent) => void;
  onCellDblClick?: (row: BusinessGridRow, column: BusinessGridColumn, event: MouseEvent) => void;
  onAfterEdit?: (value: unknown, row: BusinessGridRow, column: BusinessGridColumn) => void;
  onAfterSort?: (column: BusinessGridColumn, direction: "asc" | "desc") => void;
  onSelectionChange?: (rowIds: string[]) => void;
  serverFilter?: boolean;
  filterDebounceMs?: number;
  onFilterChange?: (filters: BusinessGridFilters) => void | Promise<void>;
};

export class BusinessGridController {
  private grid: Grid | null = null;
  private options: BusinessGridOptions;
  private selectedRows = new Set<string>();
  private serverFilters: BusinessGridFilters = {};
  private filterTimer: ReturnType<typeof setTimeout> | null = null;
  private selectionObserver: MutationObserver | null = null;
  private handleSelectAll = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches('.business-grid-select-all, input[data-grid-select-id]')) return;
    event.stopPropagation();
    // Handle the native checkbox click once, before grid row selection can toggle it again.
    if (event.type !== 'click' || target.disabled) return;
    if (target.dataset.gridSelectId !== undefined) {
      this.selectAll([target.dataset.gridSelectId], target.checked);
      return;
    }
    const ids: string[] = [];
    this.grid?.data.forEach((row) => { if (row.id !== undefined) ids.push(String(row.id)); });
    this.selectAll(ids, target.checked);
  };

  constructor(private host: HTMLElement, options: BusinessGridOptions) {
    this.options = options;
    if (options.selectAll) {
      this.options.columns = options.columns.map((column) => column.id === 'select' ? {
        ...column,
        header: [{ text: '<input class="business-grid-select-all" type="checkbox" aria-label="全选当前页" title="全选当前页">', htmlEnable: true }],
      } : column);
      for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick', 'change']) {
        this.host.addEventListener(type, this.handleSelectAll, true);
      }
      this.selectionObserver = new MutationObserver(() => this.syncSelectionCheckboxes());
      this.selectionObserver.observe(this.host, { childList: true, subtree: true });
    }
    this.create();
  }

  update(data: BusinessGridRow[], columns?: BusinessGridColumn[]): void {
    if (!this.grid) this.create();
    if (columns) {
      this.options.columns = columns;
      this.grid!.setColumns(columns as never);
    }
    this.grid!.data.removeAll();
    if (data.length) this.grid!.data.parse(data);
    this.host.classList.toggle("business-grid--empty", data.length === 0);
    this.host.dataset.emptyText = this.options.emptyText || "暂无数据";
    this.applySelectedRows();
  }

  setSelectedRows(ids: Iterable<string>): void {
    this.selectedRows = new Set(Array.from(ids, String));
    this.applySelectedRows();
  }

  getSelectedRows(): string[] {
    return [...this.selectedRows];
  }

  toggleRow(id: string, additive = false): void {
    if (!additive) this.selectedRows.clear();
    if (this.selectedRows.has(id)) this.selectedRows.delete(id);
    else this.selectedRows.add(id);
    this.applySelectedRows();
    this.options.onSelectionChange?.(this.getSelectedRows());
  }

  selectAll(ids: Iterable<string>, selected = true): void {
    for (const id of ids) {
      if (selected) this.selectedRows.add(String(id));
      else this.selectedRows.delete(String(id));
    }
    this.applySelectedRows();
    this.options.onSelectionChange?.(this.getSelectedRows());
  }

  destroy(): void {
    this.selectionObserver?.disconnect();
    for (const type of ['pointerdown', 'mousedown', 'click', 'dblclick', 'change']) {
      this.host.removeEventListener(type, this.handleSelectAll, true);
    }
    if (this.filterTimer) clearTimeout(this.filterTimer);
    this.filterTimer = null;
    this.grid?.destructor();
    this.grid = null;
    this.host.innerHTML = "";
    registry.delete(this.host);
  }

  private create(): void {
    this.host.innerHTML = "";
    this.host.classList.add("business-grid-host");
    this.grid = new Grid(this.host, {
      columns: this.options.columns as never,
      data: this.options.data || [],
      selection: this.options.selection ?? "row",
      multiselection: this.options.multiselection ?? false,
      editable: this.options.editable ?? false,
      sortable: this.options.sortable ?? true,
      autoWidth: true,
      resizable: true,
      keyNavigation: true,
      tooltip: true,
      headerTooltip: true,
      htmlEnable: true,
      rowHeight: this.options.rowHeight ?? 42,
      headerRowHeight: this.options.headerRowHeight ?? 42,
      height: this.options.height,
      css: "kb-business-grid",
    });
    this.grid.events.on("cellClick", (row, column, event) => {
      this.options.onCellClick?.(row as BusinessGridRow, column as unknown as BusinessGridColumn, event);
    });
    this.grid.events.on("cellDblClick", (row, column, event) => {
      this.options.onCellDblClick?.(row as BusinessGridRow, column as unknown as BusinessGridColumn, event);
    });
    this.grid.events.on("afterEditEnd", (value, row, column) => {
      this.options.onAfterEdit?.(value, row as BusinessGridRow, column as unknown as BusinessGridColumn);
    });
    this.grid.events.on("afterSort", (column, direction) => {
      this.options.onAfterSort?.(column as unknown as BusinessGridColumn, direction);
    });
    this.grid.events.on("beforeFilter", (value, columnId) => {
      if (!this.options.serverFilter) return true;
      const key = String(columnId);
      const isEmpty = Array.isArray(value) ? value.length === 0 : String(value ?? "").trim() === "";
      if (isEmpty) delete this.serverFilters[key];
      else this.serverFilters[key] = value as BusinessGridFilterValue;
      if (this.filterTimer) clearTimeout(this.filterTimer);
      this.filterTimer = setTimeout(() => {
        this.filterTimer = null;
        void this.options.onFilterChange?.({ ...this.serverFilters });
      }, this.options.filterDebounceMs ?? 300);
      return false;
    });
    const selection = this.grid.selection as typeof this.grid.selection & {
      events?: { on: (name: string, handler: (row: BusinessGridRow) => void) => void };
    };
    selection.events?.on("afterSelect", (row) => {
      const id = String(row.id);
      if (!this.options.multiselection) this.selectedRows.clear();
      this.selectedRows.add(id);
      this.applySelectedRows();
      this.options.onSelectionChange?.(this.getSelectedRows());
    });
    selection.events?.on("afterUnSelect", (row) => {
      this.selectedRows.delete(String(row.id));
      this.applySelectedRows();
      this.options.onSelectionChange?.(this.getSelectedRows());
    });
    this.update(this.options.data || []);
  }

  private applySelectedRows(): void {
    if (!this.grid) return;
    this.grid.data.forEach((row) => {
      if (row.id === undefined) return;
      const id = String(row.id);
      if (this.selectedRows.has(id)) this.grid!.addRowCss(row.id, "business-grid-row--selected");
      else this.grid!.removeRowCss(row.id, "business-grid-row--selected");
    });
    this.syncSelectionCheckboxes();
  }

  private syncSelectionCheckboxes(): void {
    if (!this.options.selectAll || !this.grid) return;
    let total = 0;
    let selected = 0;
    this.grid.data.forEach((row) => {
      if (row.id === undefined) return;
      total++;
      if (this.selectedRows.has(String(row.id))) selected++;
    });
    this.host.querySelectorAll<HTMLInputElement>('.business-grid-select-all').forEach((input) => {
      input.checked = total > 0 && selected === total;
      input.indeterminate = selected > 0 && selected < total;
      input.disabled = total === 0;
    });
    this.host.querySelectorAll<HTMLInputElement>('input[data-grid-select-id]').forEach((input) => {
      input.checked = this.selectedRows.has(input.dataset.gridSelectId || '');
    });
  }
}

const registry = new WeakMap<HTMLElement, BusinessGridController>();

export function getBusinessGrid(host: HTMLElement, options: BusinessGridOptions): BusinessGridController {
  registry.get(host)?.destroy();
  const controller = new BusinessGridController(host, options);
  registry.set(host, controller);
  return controller;
}

export function destroyBusinessGrid(host: HTMLElement): void {
  registry.get(host)?.destroy();
}

type LegacyGridEvent = { cell?: Record<string, unknown>; header?: Record<string, unknown>; NativeEvent?: Event };

export class EditableBusinessGrid {
  schema: Array<{ name: string; title?: string; width?: number }> = [];
  data: Array<Record<string, unknown>> = [];
  attributes = { showColumnHeaders: true };
  style: Record<string, unknown> = {};
  selectedRows: Record<number, boolean> = {};
  selectionBounds: { top: number; bottom: number; left: number; right: number } | null = null;
  scrollLeft = 0;
  private grid: Grid;
  private listeners = new Map<string, Set<(event: LegacyGridEvent) => void>>();

  constructor(private host: HTMLElement) {
    host.classList.add("business-grid-host", "entry-dhtmlx-grid");
    this.grid = new Grid(host, {
      columns: [],
      data: [],
      editable: true,
      sortable: false,
      autoWidth: true,
      resizable: true,
      selection: "complex",
      multiselection: true,
      rangeSelection: true,
      clipboard: true,
      keyNavigation: true,
      htmlEnable: true,
      rowHeight: 38,
      headerRowHeight: 42,
      css: "kb-business-grid kb-entry-grid",
    });
    this.grid.events.on("cellClick", (row, column, event) => {
      this.emit("click", { cell: this.cell(row, column), NativeEvent: event });
    });
    this.grid.events.on("cellDblClick", (row, column, event) => {
      this.emit("dblclick", { cell: this.cell(row, column), NativeEvent: event });
    });
    this.grid.events.on("headerCellDblClick", (_cell, column, event) => {
      this.emit("dblclick", { cell: this.headerCell(column), header: this.legacyColumn(column), NativeEvent: event });
    });
    this.grid.events.on("headerCellRightClick", (_cell, column, event) => {
      event.preventDefault();
      this.emit("contextmenu", { cell: this.headerCell(column), header: this.legacyColumn(column), NativeEvent: event });
    });
    this.grid.events.on("afterEditEnd", (value, row, column) => {
      const rowIndex = Number(row.__entry_index);
      const name = String(column.id);
      if (this.data[rowIndex]) this.data[rowIndex]![name] = value;
      this.emit("endedit", { cell: this.cell(row, column) });
    });
    host.addEventListener("paste", (event) => this.emit("beforepaste", { NativeEvent: event }));
  }

  draw(): void {
    const columns = this.schema.map((column) => ({
      id: column.name,
      header: [{ text: column.title || column.name }],
      width: column.width || 140,
      minWidth: 90,
      editable: true,
      editorType: "input" as const,
      sortable: false,
    }));
    this.grid.setColumns(columns);
    this.grid.data.removeAll();
    this.grid.data.parse(this.data.map((row, index) => ({ ...row, id: `entry-row-${index}`, __entry_index: index })));
  }

  resize(): void { this.grid.paint(); }
  selectArea(bounds: { top: number; bottom: number; left: number; right: number }): void {
    this.selectionBounds = bounds;
    this.selectedRows = {};
    for (let index = bounds.top; index <= bounds.bottom; index += 1) this.selectedRows[index] = true;
  }
  scrollIntoView(rowIndex: number, columnIndex: number): void {
    const row = this.grid.data.getId(rowIndex);
    const column = this.schema[columnIndex]?.name;
    if (row !== undefined && column) this.grid.scrollTo(row, column);
  }
  addEventListener(name: string, handler: (event: LegacyGridEvent) => void): void {
    const handlers = this.listeners.get(name) || new Set();
    handlers.add(handler);
    this.listeners.set(name, handlers);
  }
  destructor(): void { this.grid.destructor(); this.listeners.clear(); }

  private emit(name: string, event: LegacyGridEvent): void {
    this.listeners.get(name)?.forEach((handler) => handler(event));
  }
  private legacyColumn(column: { id?: string | number }): { name: string; title: string } {
    const item = this.schema.find((entry) => entry.name === String(column.id));
    return { name: item?.name || String(column.id || ""), title: item?.title || item?.name || String(column.id || "") };
  }
  private cell(row: Record<string, unknown>, column: { id?: string | number }): Record<string, unknown> {
    const rowIndex = Number(row.__entry_index);
    const columnIndex = this.schema.findIndex((item) => item.name === String(column.id));
    return { rowIndex, columnIndex, x: 0, y: 0, width: this.schema[columnIndex]?.width || 140, height: 38 };
  }
  private headerCell(column: { id?: string | number }): Record<string, unknown> {
    const columnIndex = this.schema.findIndex((item) => item.name === String(column.id));
    return { isColumnHeader: true, columnIndex, x: 0, y: 0, width: this.schema[columnIndex]?.width || 140, height: 42 };
  }
}

export function createEditableBusinessGrid(host: HTMLElement): EditableBusinessGrid {
  return new EditableBusinessGrid(host);
}
