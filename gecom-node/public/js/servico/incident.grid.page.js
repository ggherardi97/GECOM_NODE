(function () {
  const api = window.ServiceApi;
  const resourcesApi = window.ServiceIncidentResources || {};
  const { resources, waitForI18nReady, esc, textFor, enumLabel, normalizeArray } = resourcesApi;
  const page = window.__incidentGridPage || {};
  const config = resources?.[page.key];
  if (!api || !config) return;

  const state = {
    rows: [],
    filteredRows: [],
    selectedIds: new Set(),
    sortKey: "",
    sortDir: "asc",
    filters: {},
  };

  const columns = [
    { key: "number", label: { pt: "Numero", en: "Number", es: "Numero" } },
    { key: "title", label: { pt: "Titulo", en: "Title", es: "Titulo" } },
    { key: "status", label: { pt: "Status", en: "Status", es: "Estado" }, enumGroup: "status" },
    { key: "priority", label: { pt: "Prioridade", en: "Priority", es: "Prioridad" }, enumGroup: "priority" },
    { key: "sla_summary", label: { pt: "SLA", en: "SLA", es: "SLA" }, format: "sla" },
    { key: "company.company_name", label: { pt: "Empresa", en: "Company", es: "Empresa" } },
    { key: "queue.name", label: { pt: "Fila", en: "Queue", es: "Cola" } },
    { key: "created_at", label: { pt: "Criado em", en: "Created at", es: "Creado el" }, format: "datetime" },
  ];

  function tt(value, fallback) {
    return textFor(value, fallback);
  }

  function getByPath(obj, path) {
    return String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce((acc, key) => (acc == null ? null : acc[key]), obj);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function formatSlaSummary(summary) {
    if (!summary || typeof summary !== "object") return "-";

    const label = String(summary.label || "-");
    const percent = Number(summary.progress_percent);
    const width = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
    const tone = String(summary.tone || "info").toLowerCase();
    const toneClass =
      tone === "danger"
        ? "progress-bar-danger"
        : tone === "warning"
          ? "progress-bar-warning"
          : tone === "success"
            ? "progress-bar-success"
            : "progress-bar-info";

    const titleParts = [];
    if (summary.kpi_name) titleParts.push(String(summary.kpi_name));
    if (summary.target_at) {
      titleParts.push(`${tt({ pt: "Limite", en: "Deadline", es: "Limite" }, "Limite")}: ${formatDateTime(summary.target_at)}`);
    }

    return `
      <div class="incident-sla-cell" title="${esc(titleParts.join(" | "))}">
        <div class="progress m-b-1 incident-sla-progress">
          <div class="progress-bar progress-bar-striped ${toneClass}" style="width: ${width}%;"></div>
        </div>
        <small class="incident-sla-label">${esc(label)}</small>
      </div>
    `;
  }

  function formatCell(column, row) {
    const raw = getByPath(row, column.key);
    if (raw == null || raw === "") return "-";
    if (column.enumGroup) return enumLabel(column.enumGroup, raw);
    if (column.format === "datetime") return formatDateTime(raw);
    if (column.format === "sla") return formatSlaSummary(raw);
    return String(raw);
  }

  function normalizeSortValue(value, column) {
    if (column?.format === "sla") {
      const percent = Number(value?.percent_remaining);
      if (Number.isFinite(percent)) return percent;
      return -1;
    }

    if (value == null) return "";
    if (column?.format === "datetime") {
      const ts = new Date(value).getTime();
      if (!Number.isNaN(ts)) return ts;
    }
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    return String(value).toLowerCase();
  }

  function updatePageChrome() {
    const title = tt(config.title, "Incidentes");
    $("#incidentGridTitle").text(title);
    $("#pageName").text(title);
    $("#subpageName").text(title).attr("href", page.gridPath || "/servico/incidentes");
    $("#subSecoundPageName").text(title);
    $("#subpathName").text(title);
    $("#subpath").show();
    $("#path").show();
  }

  function renderHeader() {
    const headerHtml = [
      `<th class="incident-select-col"><input id="incidentSelectAll" type="checkbox" title="${esc(tt({ pt: "Selecionar todos", en: "Select all", es: "Seleccionar todos" }, "Selecionar todos"))}" /></th>`,
      ...columns.map(
        (column) =>
          `<th class="sortable" data-sort-key="${esc(column.key)}">${esc(tt(column.label, column.key))} <span class="sort-indicator"></span></th>`,
      ),
    ].join("");

    const filterHtml = [
      `<th class="incident-select-col"></th>`,
      ...columns.map((column) => {
        if (column.format === "sla") return "<th></th>";
        return `<th><input class="form-control input-sm js-incident-filter" data-key="${esc(column.key)}" placeholder="${esc(
          tt({ pt: "Filtrar", en: "Filter", es: "Filtrar" }, "Filtrar"),
        )}" /></th>`;
      }),
    ].join("");

    $("#incidentGridHeader").html(headerHtml);
    $("#incidentGridFilters").html(filterHtml);
    updateSortIndicators();
  }

  function updateSortIndicators() {
    $("#incidentGridHeader th.sortable").each(function () {
      const key = String($(this).data("sort-key") || "");
      const $indicator = $(this).find(".sort-indicator");
      if (!$indicator.length) return;
      if (state.sortKey === key) $indicator.text(state.sortDir === "asc" ? "^" : "v");
      else $indicator.text("");
    });
  }

  function applyFiltersAndSort() {
    let rows = state.rows.filter((row) =>
      Object.entries(state.filters).every(([key, term]) => {
        const query = String(term || "").trim().toLowerCase();
        if (!query) return true;
        const column = columns.find((item) => item.key === key);
        if (!column || column.format === "sla") return true;
        return String(formatCell(column, row) || "")
          .toLowerCase()
          .includes(query);
      }),
    );

    if (state.sortKey) {
      const column = columns.find((item) => item.key === state.sortKey);
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

  function syncSelectAllCheckbox() {
    const visibleIds = state.filteredRows.map((row) => String(row?.id || "")).filter(Boolean);
    const $all = $("#incidentSelectAll");
    if (!$all.length) return;

    if (!visibleIds.length) {
      $all.prop("checked", false).prop("indeterminate", false);
      return;
    }

    const selectedVisible = visibleIds.filter((id) => state.selectedIds.has(id)).length;
    if (!selectedVisible) {
      $all.prop("checked", false).prop("indeterminate", false);
      return;
    }
    if (selectedVisible === visibleIds.length) {
      $all.prop("checked", true).prop("indeterminate", false);
      return;
    }
    $all.prop("checked", false).prop("indeterminate", true);
  }

  function renderBody() {
    applyFiltersAndSort();
    const html = state.filteredRows
      .map((row) => {
        const id = String(row?.id || "");
        const checked = state.selectedIds.has(id) ? ' checked="checked"' : "";
        const rowClass = state.selectedIds.has(id) ? "is-selected" : "";
        return `
          <tr data-id="${esc(id)}" class="${rowClass}">
            <td class="incident-select-col"><input type="checkbox" class="js-incident-check" data-id="${esc(id)}"${checked} /></td>
            ${columns
              .map((column) => {
                const rendered = formatCell(column, row);
                return `<td data-field="${esc(column.key)}">${column.format === "sla" ? rendered : esc(rendered)}</td>`;
              })
              .join("")}
          </tr>
        `;
      })
      .join("");

    $("#incidentGridBody").html(
      html ||
        `<tr><td colspan="${columns.length + 1}" class="text-muted">${esc(tt(config.messages?.noRecords, "Nenhum registro encontrado."))}</td></tr>`,
    );

    $("#incidentSelectedCount").text(String(state.selectedIds.size));
    $("#incidentBulkActions").toggle(state.selectedIds.size > 0);
    syncSelectAllCheckbox();
    updateSortIndicators();
  }

  async function loadRows() {
    const data = await api.getJson("/api/service/incidents");
    state.rows = normalizeArray(data);
    renderBody();
  }

  function openRecord(id) {
    const url = `${page.detailPath || "/servico/incidentes/ficha"}?id=${encodeURIComponent(id)}`;
    window.location.href = url;
  }

  async function deleteSelected() {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) return;
    if (!window.confirm(tt(config.messages?.confirmDelete, "Deseja realmente excluir este incidente?"))) return;

    try {
      for (const id of ids) {
        await api.deleteJson(`/api/service/incidents/${encodeURIComponent(id)}`);
      }
      state.selectedIds.clear();
      await loadRows();
    } catch (error) {
      console.error(error);
      alert(error?.message || "Nao foi possivel excluir os incidentes.");
    }
  }

  function bindEvents() {
    $("#btnIncidentGridRefresh").on("click", loadRows);
    $("#btnIncidentGridNew").on("click", function () {
      window.location.href = page.detailPath || "/servico/incidentes/ficha";
    });
    $("#btnIncidentGridDelete").on("click", deleteSelected);
    $("#btnIncidentGridClearSelection").on("click", function () {
      state.selectedIds.clear();
      renderBody();
    });

    $("#incidentGridFilters").on("input", ".js-incident-filter", function () {
      const key = String($(this).data("key") || "");
      state.filters[key] = String($(this).val() || "");
      renderBody();
    });

    $("#incidentGridHeader").on("click", "th.sortable", function () {
      const key = String($(this).data("sort-key") || "");
      if (!key) return;
      if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
      else {
        state.sortKey = key;
        state.sortDir = "asc";
      }
      renderBody();
    });

    $("#incidentGridHeader").on("click", "#incidentSelectAll", function (event) {
      event.stopPropagation();
      const checked = $(this).is(":checked");
      state.filteredRows.forEach((row) => {
        const id = String(row?.id || "");
        if (!id) return;
        if (checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
      });
      renderBody();
    });

    $("#incidentGridBody").on("click", ".js-incident-check", function (event) {
      event.stopPropagation();
      const id = String($(this).data("id") || "");
      if (!id) return;
      if ($(this).is(":checked")) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      renderBody();
    });

    $("#incidentGridBody").on("click", "tr[data-id]", function (event) {
      if ($(event.target).closest("input,button,a,label").length) return;
      const id = String($(this).data("id") || "");
      if (id) openRecord(id);
    });
  }

  async function init() {
    await waitForI18nReady(2000);
    updatePageChrome();
    renderHeader();
    bindEvents();
    await loadRows();
  }

  $(document).ready(function () {
    init().catch((error) => {
      console.error(error);
      alert(error?.message || "Nao foi possivel carregar os incidentes.");
    });
  });
})();
