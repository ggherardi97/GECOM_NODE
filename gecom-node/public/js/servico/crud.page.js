(function () {
  const api = window.ServiceApi;
  const shared = window.ServiceResources || {};
  const { waitForI18nReady, textFor, esc, normalizeArray, enumLabel } = shared;
  const cfg = window.__SERVICE_PAGE_CONFIG || {};
  if (!api || !cfg) return;

  const state = {
    rows: [],
    filteredRows: [],
    selectedIds: new Set(),
    sortKey: "",
    sortDir: "asc",
    filters: {},
    contextFilters: parseContextFilters(),
  };

  function tt(value, fallback) {
    return textFor(value, fallback);
  }

  function parseContextFilters() {
    const params = new URLSearchParams(window.location.search || "");
    const out = {};
    params.forEach((value, key) => {
      if (!value || key === "id") return;
      out[key] = value;
    });
    return out;
  }

  function getColumns() {
    return Array.isArray(cfg.columns) ? cfg.columns : [];
  }

  function getByPath(obj, path) {
    return String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce((acc, key) => (acc == null ? null : acc[key]), obj);
  }

  function formatDate(value, mode) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return mode === "date" ? date.toLocaleDateString() : date.toLocaleString();
  }

  function formatCell(column, row) {
    const raw = getByPath(row, column.key);
    if (raw == null || raw === "") return "-";
    if (column.enumGroup) return enumLabel(column.enumGroup, raw, raw);
    if (column.type === "boolean") return raw ? tt({ pt: "Sim", en: "Yes", es: "Si" }, "Sim") : tt({ pt: "Nao", en: "No", es: "No" }, "Nao");
    if (column.type === "datetime" || column.type === "date") return formatDate(raw, column.type);
    if (typeof raw === "object") return JSON.stringify(raw);
    return String(raw);
  }

  function normalizeSortValue(value, column) {
    if (value == null) return "";
    if (column?.type === "datetime" || column?.type === "date") {
      const ts = new Date(value).getTime();
      if (!Number.isNaN(ts)) return ts;
    }
    if (typeof value === "boolean") return value ? 1 : 0;
    const num = Number(value);
    if (Number.isFinite(num) && String(value).trim() !== "") return num;
    return String(value).toLowerCase();
  }

  function resolvePageUrl(template, id) {
    const raw = String(template || "").trim();
    if (!raw) return "";
    const next = id ? raw.replace("{id}", encodeURIComponent(String(id))) : raw;
    const search = window.location.search || "";
    if (!search) return next;
    const hasQuery = next.includes("?");
    return `${next}${hasQuery ? "&" : "?"}${search.replace(/^\?/, "")}`;
  }

  function showMessage(kind, text) {
    const $el = $("#serviceMessage");
    $el.removeClass("alert-success alert-danger alert-warning").hide();
    if (!text) return;
    $el.addClass(kind === "success" ? "alert-success" : kind === "warning" ? "alert-warning" : "alert-danger").text(text).show();
  }

  function applyPageChrome() {
    const title = tt(cfg.title, "Servico");
    $("#serviceGridTitle").text(title);
    $("#pageName").text(title);
    $("#subpageName").text("Servico").attr("href", "/servico/incidentes");
    $("#subSecoundPageName").text(title);
    $("#subpathName").text(title);
    $("#serviceKanbanBtn").toggle(!!cfg.kanbanPageUrl);
  }

  function renderHeader() {
    const header = [
      `<th class="service-select-col"><input id="serviceSelectAll" type="checkbox" title="${esc(tt({ pt: "Selecionar todos", en: "Select all", es: "Seleccionar todos" }, "Selecionar todos"))}" /></th>`,
      ...getColumns().map((column) => `<th class="sortable" data-sort-key="${esc(column.key)}">${esc(tt(column.label, column.key))} <span class="sort-indicator"></span></th>`),
    ].join("");

    const filters = [
      '<th class="service-select-col"></th>',
      ...getColumns().map((column) => `<th><input class="form-control input-sm js-service-filter" data-key="${esc(column.key)}" placeholder="${esc(tt({ pt: "Filtrar", en: "Filter", es: "Filtrar" }, "Filtrar"))}" /></th>`),
    ].join("");

    $("#serviceHeaderRow").html(header);
    $("#serviceFiltersRow").html(filters);
    updateSortIndicators();
  }

  function updateSortIndicators() {
    $("#serviceHeaderRow th.sortable").each(function () {
      const key = String($(this).data("sort-key") || "");
      const $indicator = $(this).find(".sort-indicator");
      if (!$indicator.length) return;
      if (state.sortKey === key) $indicator.text(state.sortDir === "asc" ? "^" : "v");
      else $indicator.text("");
    });
  }

  function rowMatchesContext(row) {
    return Object.entries(state.contextFilters).every(([key, expected]) => {
      const direct = row?.[key];
      const nested = getByPath(row, key);
      const actual = direct != null ? direct : nested;
      if (actual == null) return true;
      return String(actual) === String(expected);
    });
  }

  function applyFiltersAndSort() {
    let rows = state.rows.filter(rowMatchesContext).filter((row) =>
      Object.entries(state.filters).every(([key, term]) => {
        const query = String(term || "").trim().toLowerCase();
        if (!query) return true;
        const column = getColumns().find((item) => item.key === key);
        return String(formatCell(column || { key }, row)).toLowerCase().includes(query);
      }),
    );

    if (state.sortKey) {
      const column = getColumns().find((item) => item.key === state.sortKey);
      rows = rows.slice().sort((left, right) => {
        const av = normalizeSortValue(getByPath(left, state.sortKey), column);
        const bv = normalizeSortValue(getByPath(right, state.sortKey), column);
        if (av < bv) return state.sortDir === "asc" ? -1 : 1;
        if (av > bv) return state.sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    state.filteredRows = rows;
  }

  function syncSelectAll() {
    const ids = state.filteredRows.map((row) => String(row?.[cfg.idField || "id"] || row?.id || "")).filter(Boolean);
    const $all = $("#serviceSelectAll");
    if (!$all.length || !ids.length) {
      $all.prop("checked", false).prop("indeterminate", false);
      return;
    }
    const selected = ids.filter((id) => state.selectedIds.has(id)).length;
    if (!selected) $all.prop("checked", false).prop("indeterminate", false);
    else if (selected === ids.length) $all.prop("checked", true).prop("indeterminate", false);
    else $all.prop("checked", false).prop("indeterminate", true);
  }

  function renderRows() {
    applyFiltersAndSort();
    const cols = getColumns();
    const html = state.filteredRows
      .map((row) => {
        const id = String(row?.[cfg.idField || "id"] || row?.id || "");
        const checked = state.selectedIds.has(id) ? ' checked="checked"' : "";
        const rowClass = state.selectedIds.has(id) ? "is-selected" : "";
        return `
          <tr data-id="${esc(id)}" class="${rowClass}">
            <td class="service-select-col"><input type="checkbox" class="js-service-check" data-id="${esc(id)}"${checked} /></td>
            ${cols.map((column) => `<td data-field="${esc(column.key)}">${esc(formatCell(column, row))}</td>`).join("")}
          </tr>
        `;
      })
      .join("");

    $("#serviceRows").html(
      html || `<tr><td colspan="${cols.length + 1}" class="text-muted">${esc(tt({ pt: "Nenhum registro encontrado.", en: "No records found.", es: "No se encontraron registros." }, "Nenhum registro encontrado."))}</td></tr>`,
    );

    $("#serviceSelectedCount").text(String(state.selectedIds.size));
    $("#serviceBulkBar").toggleClass("is-open", state.selectedIds.size > 0);
    syncSelectAll();
    updateSortIndicators();
  }

  async function loadRows() {
    const search = window.location.search || "";
    const url = `${cfg.listPath || cfg.apiPath}${search}`;
    const payload = await api.getJson(url);
    state.rows = normalizeArray(payload);
    renderRows();
  }

  function openRecord(id) {
    const url = resolvePageUrl(cfg.editPageUrl || cfg.detailPath, id);
    if (url) window.location.href = url;
  }

  async function deleteSelected() {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) return;
    if (!window.confirm(tt({ pt: "Deseja realmente excluir os registros selecionados?", en: "Do you really want to delete the selected records?", es: "Desea eliminar los registros seleccionados?" }, "Deseja realmente excluir os registros selecionados?"))) {
      return;
    }

    try {
      for (const id of ids) {
        await api.deleteJson(`${cfg.apiPath}/${encodeURIComponent(id)}`);
      }
      state.selectedIds.clear();
      await loadRows();
      showMessage("success", tt({ pt: "Registros excluidos com sucesso.", en: "Records deleted successfully.", es: "Registros eliminados con exito." }, "Registros excluidos com sucesso."));
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Nao foi possivel excluir os registros.");
    }
  }

  function bindEvents() {
    $("#serviceRefreshBtn").on("click", loadRows);
    $("#serviceNewBtn").on("click", function () {
      const url = resolvePageUrl(cfg.newPageUrl || cfg.detailPath);
      if (url) window.location.href = url;
    });
    $("#serviceKanbanBtn").on("click", function () {
      if (cfg.kanbanPageUrl) window.location.href = cfg.kanbanPageUrl;
    });
    $("#serviceDeleteSelectedBtn").on("click", deleteSelected);
    $("#serviceClearSelectionBtn").on("click", function () {
      state.selectedIds.clear();
      renderRows();
    });

    $("#serviceFiltersRow").on("input", ".js-service-filter", function () {
      const key = String($(this).data("key") || "");
      state.filters[key] = String($(this).val() || "");
      renderRows();
    });

    $("#serviceHeaderRow").on("click", "th.sortable", function () {
      const key = String($(this).data("sort-key") || "");
      if (!key) return;
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else {
        state.sortKey = key;
        state.sortDir = "asc";
      }
      renderRows();
    });

    $("#serviceHeaderRow").on("click", "#serviceSelectAll", function (event) {
      event.stopPropagation();
      const checked = $(this).is(":checked");
      state.filteredRows.forEach((row) => {
        const id = String(row?.[cfg.idField || "id"] || row?.id || "");
        if (!id) return;
        if (checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
      });
      renderRows();
    });

    $("#serviceRows").on("click", ".js-service-check", function (event) {
      event.stopPropagation();
      const id = String($(this).data("id") || "");
      if (!id) return;
      if ($(this).is(":checked")) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      renderRows();
    });

    $("#serviceRows").on("click", "tr[data-id]", function (event) {
      if ($(event.target).closest("input,button,a,label").length) return;
      const id = String($(this).data("id") || "");
      if (id) openRecord(id);
    });
  }

  async function init() {
    await waitForI18nReady(2000);
    applyPageChrome();
    renderHeader();
    bindEvents();
    await loadRows();
  }

  $(document).ready(function () {
    init().catch((error) => {
      console.error(error);
      showMessage("error", error?.message || "Nao foi possivel carregar os registros.");
    });
  });
})();
