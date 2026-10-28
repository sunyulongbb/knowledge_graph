(function () {
  function getCurrentDbParam() {
    try {
      const currentUrl = new URL(window.location.href);
      return (currentUrl.searchParams.get("db") || "").trim();
    } catch {
      return "";
    }
  }

  function appendCurrentDbParam(input) {
    try {
      const db = getCurrentDbParam();
      const url =
        input instanceof URL
          ? new URL(input.toString())
          : new URL(String(input), window.location.origin);
      if (db) {
        url.searchParams.set("db", db);
      } else {
        url.searchParams.delete("db");
      }
      return url;
    } catch {
      return input;
    }
  }

  window.getCurrentDbParam = getCurrentDbParam;
  window.appendCurrentDbParam = appendCurrentDbParam;
})();
