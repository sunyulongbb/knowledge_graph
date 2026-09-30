(function () {
  class KbPaginationController {
    constructor(container, options = {}) {
      this.container = container;
      this.options = options;
      this.page = Math.max(1, Number(options.page) || 1);
      this.pageSize = Number(options.pageSize) || 20;
      this.total = 0;
      this.render();
    }

    setState({
      page = this.page,
      pageSize = this.pageSize,
      total = this.total,
    } = {}) {
      this.page = Math.max(1, Number(page) || 1);
      this.pageSize = Math.max(1, Number(pageSize) || 20);
      this.total = Math.max(0, Number(total) || 0);
      this.render();
    }

    render() {
      if (!this.container) return;
      const maxPage = Math.max(1, Math.ceil(this.total / this.pageSize));
      this.page = Math.min(this.page, maxPage);
      this.container.replaceChildren();
      this.container.classList.add("kb-pagination");

      const previous = this.createButton("上一页", "上一页");
      previous.disabled = this.page <= 1;
      previous.addEventListener("click", () => this.changePage(this.page - 1));

      const info = document.createElement("span");
      info.className = "kb-pagination-info";
      info.textContent = `第 ${this.page} / ${maxPage} 页 · 共 ${this.total} 条`;

      const numbers = document.createElement("div");
      numbers.className = "kb-pagination-numbers";
      this.pageNumbers(maxPage).forEach((page) => {
        if (page === null) {
          const ellipsis = document.createElement("span");
          ellipsis.className = "kb-pagination-ellipsis";
          ellipsis.textContent = "…";
          numbers.appendChild(ellipsis);
          return;
        }
        const button = this.createButton(String(page), `第 ${page} 页`);
        button.classList.toggle("active", page === this.page);
        if (page === this.page) button.setAttribute("aria-current", "page");
        button.addEventListener("click", () => this.changePage(page));
        numbers.appendChild(button);
      });

      const next = this.createButton("下一页", "下一页");
      next.disabled = this.page >= maxPage;
      next.addEventListener("click", () => this.changePage(this.page + 1));

      const pageSize = document.createElement("select");
      pageSize.className = "kb-select sm kb-pagination-size";
      pageSize.setAttribute("aria-label", "每页条数");
      (this.options.pageSizes || [10, 20, 50, 100]).forEach((size) => {
        const option = document.createElement("option");
        option.value = String(size);
        option.textContent = `${size}条/页`;
        option.selected = Number(size) === this.pageSize;
        pageSize.appendChild(option);
      });
      pageSize.addEventListener("change", () => {
        this.pageSize = Number(pageSize.value) || 20;
        this.page = 1;
        this.options.onPageSizeChange?.(this.pageSize);
      });

      const jumpLabel = document.createElement("label");
      jumpLabel.className = "kb-pagination-jump";
      jumpLabel.textContent = "前往 ";
      const jump = document.createElement("input");
      jump.type = "number";
      jump.min = "1";
      jump.max = String(maxPage);
      jump.step = "1";
      jump.className = "kb-input sm";
      jump.setAttribute("aria-label", "输入页码");
      const confirm = this.createButton("确定", "跳转到指定页");
      const doJump = () => {
        const page = Math.min(
          maxPage,
          Math.max(1, Math.trunc(Number(jump.value))),
        );
        if (Number.isFinite(page)) this.changePage(page);
        jump.value = "";
      };
      confirm.addEventListener("click", doJump);
      jump.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          doJump();
        }
      });
      jumpLabel.append(jump, " 页");

      this.container.append(
        previous,
        info,
        numbers,
        next,
        pageSize,
        jumpLabel,
        confirm,
      );
    }

    createButton(text, label) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn sm kb-pagination-button";
      button.textContent = text;
      button.title = label;
      button.setAttribute("aria-label", label);
      return button;
    }

    pageNumbers(maxPage) {
      const pages = [1, this.page - 1, this.page, this.page + 1, maxPage]
        .filter((page) => page >= 1 && page <= maxPage)
        .sort((a, b) => a - b)
        .filter((page, index, list) => page !== list[index - 1]);
      const result = [];
      pages.forEach((page, index) => {
        if (index && page - pages[index - 1] > 1) result.push(null);
        result.push(page);
      });
      return result;
    }

    changePage(page) {
      const maxPage = Math.max(1, Math.ceil(this.total / this.pageSize));
      const nextPage = Math.min(maxPage, Math.max(1, page));
      if (nextPage === this.page) return;
      this.page = nextPage;
      this.options.onPageChange?.(nextPage);
    }
  }

  window.KbPaginationController = KbPaginationController;
})();
