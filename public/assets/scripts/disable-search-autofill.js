(function () {
  const selector = [
    'input[type="search"]',
    'input.app-search-input',
    'input.dhx_grid-filter',
    'input[id$="Search"]',
    'input[id$="SearchInput"]',
    'input[id$="FilterValue"]',
  ].join(",");

  function disableSearchAutofill(root) {
    const inputs = [];
    if (root instanceof HTMLInputElement && root.matches(selector)) inputs.push(root);
    if (root instanceof Document || root instanceof DocumentFragment || root instanceof Element) {
      inputs.push(...root.querySelectorAll(selector));
    }
    inputs.forEach((input) => {
      if (input.type !== "text" && input.type !== "search") return;
      input.setAttribute("autocomplete", "new-password");
      input.setAttribute("autocorrect", "off");
      input.setAttribute("autocapitalize", "off");
      input.setAttribute("spellcheck", "false");
      input.setAttribute("aria-autocomplete", "none");
      input.setAttribute("data-lpignore", "true");
      input.setAttribute("data-1p-ignore", "true");
      input.setAttribute("data-bwignore", "true");
      if (!input.name) {
        input.name = `kb_filter_${input.id || Math.random().toString(36).slice(2)}`;
      }
      if (input.dataset.kbAutofillGuard === "1") return;
      input.dataset.kbAutofillGuard = "1";
      input.readOnly = true;
      const unlock = () => {
        input.readOnly = false;
      };
      input.addEventListener("pointerdown", unlock, { once: true });
      input.addEventListener("keydown", unlock, { once: true });
      input.addEventListener("focus", unlock, { once: true });
    });
  }

  disableSearchAutofill(document);
  new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => disableSearchAutofill(node));
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
