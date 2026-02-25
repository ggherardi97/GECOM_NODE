(function () {
  if (window.SavedViewsSimpleGrid) return;

  function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  function parseMaybeNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function compareValues(a, b) {
    const na = parseMaybeNumber(a);
    const nb = parseMaybeNumber(b);
    if (na != null && nb != null) return na - nb;
    return String(a == null ? "" : a).localeCompare(String(b == null ? "" : b), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  }

  async function readJsonSafe(response) {
    const text = await response.text();
    if (!text) return {};
    try { return JSON.parse(text); } catch { return { message: text }; }
  }

  async function apiGet(url) {
    const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  }

  window.SavedViewsSimpleGrid = {
    async init(config) {
      const cfg = Object.assign(
        {
          entityName: "",
          hostSelector: "",
          tableSelector: "",
          filtersRowSelector: "",
          headerRowSelector: "",
          bodySelector: "",
          loadingText: "Carregando...",
          emptyText: "Sem registros.",
          loadRows: null,
          rowToView: null,
          renderRow: null,
          onAfterRender: null,
        },
        config || {},
      );

      if (!cfg.entityName) throw new Error("Missing entityName");
      if (typeof cfg.loadRows !== "function") throw new Error("Missing loadRows");
      if (typeof cfg.rowToView !== "function") throw new Error("Missing rowToView");
      if (typeof cfg.renderRow !== "function") throw new Error("Missing renderRow");

      const $host = $(cfg.hostSelector);
      const $table = $(cfg.tableSelector);
      const $filtersRow = $(cfg.filtersRowSelector);
      const $headerRow = $(cfg.headerRowSelector);
      const $body = $(cfg.bodySelector);

      if (!$host.length || !$table.length || !$filtersRow.length || !$headerRow.length || !$body.length) {
        throw new Error("Grid selectors not found");
      }

      const state = {
        rows: [],
        rendered: [],
        filterState: {},
        sort: { key: null, dir: "asc" },
        savedViewsState: { viewId: null, name: "", columns: [], columns_order: [], filters: [], sort: [] },
      };

      function getAllColumnKeys() {
        return $headerRow.find("th.sortable")
          .map(function () { return String($(this).data("sort-key") || ""); })
          .get()
          .filter(Boolean);
      }

      function initFilterState() {
        $filtersRow.find("[data-filter]").each(function () {
          const k = String($(this).data("filter") || "").trim();
          if (!k) return;
          state.filterState[k] = "";
        });
      }

      function captureFiltersForSavedView() {
        const out = [];
        Object.keys(state.filterState).forEach((k) => {
          const value = String(state.filterState[k] || "").trim();
          if (!value) return;
          out.push({ field: k, op: "contains", value });
        });
        return out;
      }

      function applyFiltersFromSavedView(definition) {
        Object.keys(state.filterState).forEach((k) => { state.filterState[k] = ""; });
        $filtersRow.find("[data-filter]").each(function () { $(this).val(""); });

        const filters = Array.isArray(definition?.filters) ? definition.filters : [];
        filters.forEach((f) => {
          const field = String(f?.field || "").trim();
          const value = String(f?.value || "");
          if (!field || !Object.prototype.hasOwnProperty.call(state.filterState, field)) return;
          state.filterState[field] = value;
          $filtersRow.find(`[data-filter="${field}"]`).val(value);
        });
      }

      function applySortFromSavedView(definition) {
        const first = Array.isArray(definition?.sort) ? definition.sort[0] : null;
        const key = String(first?.field || "").trim();
        const dir = String(first?.dir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
        state.sort.key = key || null;
        state.sort.dir = dir;
      }

      function applyFilterAndSort() {
        const keys = Object.keys(state.filterState);
        let data = state.rows.slice();

        if (keys.length) {
          data = data.filter((row) => {
            const view = cfg.rowToView(row);
            return keys.every((k) => {
              const filterValue = String(state.filterState[k] || "").trim().toLowerCase();
              if (!filterValue) return true;
              const value = String(view[k] == null ? "" : view[k]).toLowerCase();
              return value.includes(filterValue);
            });
          });
        }

        if (state.sort.key) {
          const key = state.sort.key;
          const dir = state.sort.dir;
          data.sort((a, b) => {
            const va = cfg.rowToView(a)[key];
            const vb = cfg.rowToView(b)[key];
            const cmp = compareValues(va, vb);
            return dir === "asc" ? cmp : -cmp;
          });
        }

        state.rendered = data;
      }

      function updateSortIndicators() {
        $headerRow.find("th.sortable").each(function () {
          const key = String($(this).data("sort-key") || "");
          const $ind = $(this).find(".sort-indicator");
          if (!$ind.length) return;
          if (state.sort.key === key) $ind.text(state.sort.dir === "asc" ? "^" : "v");
          else $ind.text("");
        });
      }

      function renderRows() {
        if (!state.rows.length) {
          const colspan = $headerRow.find("th").length || 1;
          $body.html(`<tr><td colspan="${colspan}">${escapeHtml(cfg.emptyText)}</td></tr>`);
          return;
        }
        if (!state.rendered.length) {
          const colspan = $headerRow.find("th").length || 1;
          $body.html(`<tr><td colspan="${colspan}">Sem resultados para o filtro.</td></tr>`);
          return;
        }

        $body.html(state.rendered.map((row) => cfg.renderRow(row)).join(""));
        if (typeof cfg.onAfterRender === "function") cfg.onAfterRender(state.rendered.slice());
      }

      function rerender() {
        applyFilterAndSort();
        renderRows();
        updateSortIndicators();
      }

      async function reloadRows() {
        const loaded = await cfg.loadRows(apiGet);
        state.rows = normalizeArray(loaded);
        rerender();
      }

      function bindEvents() {
        $filtersRow.find("[data-filter]").off("input.svfg change.svfg").on("input.svfg change.svfg", function () {
          const key = String($(this).data("filter") || "").trim();
          if (!key) return;
          state.filterState[key] = String($(this).val() || "");
          rerender();
        });

        $headerRow.find("th.sortable").off("click.svfg").on("click.svfg", function () {
          const key = String($(this).data("sort-key") || "").trim();
          if (!key) return;
          if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
          else {
            state.sort.key = key;
            state.sort.dir = "asc";
          }
          rerender();
        });
      }

      initFilterState();
      bindEvents();
      $body.html(`<tr><td colspan="${$headerRow.find("th").length || 1}">${escapeHtml(cfg.loadingText)}</td></tr>`);
      await reloadRows();

      const allKeys = getAllColumnKeys();
      state.savedViewsState.columns = allKeys.slice();
      state.savedViewsState.columns_order = allKeys.slice();

      await window.SavedViewsGrid.init({
        entityName: cfg.entityName,
        hostSelector: cfg.hostSelector,
        tableSelector: cfg.tableSelector,
        headerRowSelector: cfg.headerRowSelector,
        filtersRowSelector: cfg.filtersRowSelector,
        getAllColumnKeys: () => getAllColumnKeys(),
        fallbackViewName: "",
        includeFallbackOption: false,
        fallbackDefinition: { columns: allKeys.slice(), columns_order: allKeys.slice(), filters: [], sort: [] },
        getCurrentState: () => {
          const domOrder = $headerRow.find("th.sortable").map(function () {
            return String($(this).data("sort-key") || "");
          }).get().filter(Boolean);

          const visible = $headerRow.find("th.sortable:visible").map(function () {
            return String($(this).data("sort-key") || "");
          }).get().filter(Boolean);

          state.savedViewsState.columns_order = domOrder.length ? domOrder : state.savedViewsState.columns_order;
          state.savedViewsState.columns = visible.length ? visible : state.savedViewsState.columns;
          state.savedViewsState.filters = captureFiltersForSavedView();
          state.savedViewsState.sort = state.sort.key ? [{ field: state.sort.key, dir: state.sort.dir }] : [];
          return Object.assign({}, state.savedViewsState);
        },
        applyState: ({ viewId, name, definition, _fromColumnsModal }) => {
          state.savedViewsState.viewId = viewId;
          state.savedViewsState.name = name || "";
          if (_fromColumnsModal === true) return;
          applyFiltersFromSavedView(definition || {});
          applySortFromSavedView(definition || {});
          rerender();
        },
        onAfterApply: () => {
          rerender();
        },
      });

      return {
        reload: reloadRows,
        state,
      };
    },
  };
})();
