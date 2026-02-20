(function () {
  const api = window.ServiceApi;
  const cfg = window.__SERVICE_PAGE_CONFIG || {};

  const state = {
    rows: [],
    filtered: [],
    editingId: null,
    lookupCache: new Map(),
    selectedLookupRows: {},
    sort: { key: null, dir: "asc" },
    columnFilters: {},
    savedViewState: {
      viewId: null,
      name: "",
      columns: [],
      columns_order: [],
      filters: [],
      sort: [],
      pageSize: 0,
    },
  };

  function esc(v) {
    if (v == null) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function listToArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  function parseQuery() {
    const q = {};
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of p.entries()) q[k] = v;
    return q;
  }

  function showMsg(kind, text) {
    const el = $("#serviceMessage");
    el.removeClass("is-open alert-success alert-danger alert-warning");
    if (!text) return;
    el.addClass("is-open");
    el.addClass(kind === "success" ? "alert-success" : kind === "warning" ? "alert-warning" : "alert-danger");
    el.text(text);
  }

  function isAuthError(err) {
    return err && (err.status === 401 || err.status === 403);
  }

  function handleError(err, fallback) {
    console.error(err);
    if (isAuthError(err)) {
      window.location.href = "/";
      return;
    }
    showMsg("error", err?.message || fallback || "Nao foi possivel executar a acao.");
  }

  function formatValue(v, type) {
    if (v == null || v === "") return "-";
    if (type === "boolean") return v ? "Sim" : "Nao";
    if (type === "date" || type === "datetime") {
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return String(v);
      return type === "date" ? d.toLocaleDateString("pt-BR") : d.toLocaleString("pt-BR");
    }
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  }

  function getByPath(obj, path) {
    const parts = String(path || "").split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return null;
      cur = cur[p];
    }
    return cur;
  }

  function getId(row) {
    const key = cfg.idField || "id";
    return String(row?.[key] ?? row?.id ?? "").trim();
  }

  function getColumns() {
    return Array.isArray(cfg.columns) && cfg.columns.length ? cfg.columns : [{ key: "id", label: "ID" }, { key: "name", label: "Nome" }];
  }

  function getFields() {
    return Array.isArray(cfg.formFields) ? cfg.formFields : [];
  }

  function normalizeSortValue(v) {
    if (v == null) return "";
    if (typeof v === "number") return v;
    return String(v).toLowerCase();
  }

  function renderHeader() {
    const cols = getColumns();
    const headerRow = $("#serviceHeaderRow");
    const filtersRow = $("#serviceFiltersRow");
    headerRow.empty();
    filtersRow.empty();

    cols.forEach((c) => {
      const key = String(c.key || "");
      headerRow.append(
        `<th class="sortable" data-sort-key="${esc(key)}">${esc(c.label || c.key)} <span class="sort-indicator"></span></th>`
      );

      if (c.type === "boolean") {
        filtersRow.append(
          `<th data-field="${esc(key)}">
            <select class="form-control input-sm service-col-filter" data-field="${esc(key)}">
              <option value="">Todos</option>
              <option value="sim">Sim</option>
              <option value="nao">Nao</option>
            </select>
          </th>`
        );
      } else {
        filtersRow.append(
          `<th data-field="${esc(key)}">
            <input type="text" class="form-control input-sm service-col-filter" data-field="${esc(key)}" placeholder="Filtrar..." />
          </th>`
        );
      }
    });

    headerRow.append("<th style='width:220px;'>Acoes</th>");
    filtersRow.append("<th></th>");
    applyFiltersToInputs();
    renderSortIndicators();
  }

  function renderSortIndicators() {
    $("#serviceHeaderRow th.sortable").each(function () {
      const th = $(this);
      const key = String(th.data("sort-key") || "");
      const indicator = th.find(".sort-indicator");
      if (!key || !indicator.length) return;
      if (state.sort.key !== key) indicator.text("");
      else indicator.text(state.sort.dir === "asc" ? "▲" : "▼");
    });
  }

  function rowMatchesSearch(row, q) {
    if (!q) return true;
    const hay = Object.values(row || {}).map((v) => formatValue(v)).join(" ").toLowerCase();
    return hay.includes(q);
  }

  function rowMatchesColumnFilters(row) {
    const cols = getColumns();
    for (const c of cols) {
      const key = String(c.key || "");
      const expected = String(state.columnFilters[key] || "").trim().toLowerCase();
      if (!expected) continue;

      const raw = getByPath(row, key);
      if (c.type === "boolean") {
        const actual = raw ? "sim" : "nao";
        if (expected !== actual) return false;
        continue;
      }

      const text = formatValue(raw, c.type).toLowerCase();
      if (!text.includes(expected)) return false;
    }
    return true;
  }

  function sortRows(rows) {
    if (!state.sort.key) return rows.slice();
    const cols = getColumns();
    const col = cols.find((c) => String(c.key) === String(state.sort.key));
    const type = col?.type || "text";
    const dir = state.sort.dir === "desc" ? -1 : 1;

    return rows.slice().sort((a, b) => {
      const va = getByPath(a, state.sort.key);
      const vb = getByPath(b, state.sort.key);

      if (type === "date" || type === "datetime") {
        const da = va ? new Date(va).getTime() : 0;
        const db = vb ? new Date(vb).getTime() : 0;
        return (da - db) * dir;
      }

      const na = normalizeSortValue(va);
      const nb = normalizeSortValue(vb);
      if (na < nb) return -1 * dir;
      if (na > nb) return 1 * dir;
      return 0;
    });
  }

  function setCounters(visible, total) {
    $("#serviceCountLabel").text(`Exibindo ${visible} de ${total}`);
  }

  function renderRows() {
    const q = String($("#serviceSearch").val() || "").trim().toLowerCase();
    const rows = state.rows
      .filter((r) => rowMatchesSearch(r, q))
      .filter((r) => rowMatchesColumnFilters(r));
    state.filtered = sortRows(rows);

    const tbody = $("#serviceRows");
    tbody.empty();

    const cols = getColumns();
    if (!state.filtered.length) {
      tbody.append(`<tr><td colspan="${cols.length + 1}">Nenhum registro encontrado.</td></tr>`);
      setCounters(0, state.rows.length);
      return;
    }

    state.filtered.forEach((row) => {
      const id = getId(row);
      const tds = cols.map((c) => `<td>${esc(formatValue(getByPath(row, c.key), c.type))}</td>`).join("");
      const extras = (cfg.rowActions || []).map((a) => {
        if (a.type === "link" && a.href) {
          const href = String(a.href).replace("{id}", encodeURIComponent(id));
          return `<a class="btn btn-xs ${esc(a.className || "btn-default")}" href="${esc(href)}"><i class="fa ${esc(a.icon || "fa-link")}"></i> ${esc(a.label || "Abrir")}</a>`;
        }
        return "";
      }).join("");

      tbody.append(`
        <tr data-id="${esc(id)}">
          ${tds}
          <td>
            <div class="service-actions-inline">
              <button type="button" class="btn btn-xs btn-default js-edit"><i class="fa fa-pencil"></i> Editar</button>
              <button type="button" class="btn btn-xs btn-danger js-delete"><i class="fa fa-trash"></i> Excluir</button>
              ${extras}
            </div>
          </td>
        </tr>
      `);
    });

    setCounters(state.filtered.length, state.rows.length);
  }

  function openSide() {
    $("#serviceSideOverlay").addClass("is-open");
    $("#serviceSidePanel").addClass("is-open").attr("aria-hidden", "false");
  }

  function closeSide() {
    $("#serviceSideOverlay").removeClass("is-open");
    $("#serviceSidePanel").removeClass("is-open").attr("aria-hidden", "true");
    state.editingId = null;
    $("#serviceRowId").val("");
    $("#serviceFormTitle").text("Novo registro");
    clearForm();
  }

  function fieldElement(name) {
    return $(`#field_${name}`);
  }

  function clearForm() {
    getFields().forEach((f) => {
      const el = fieldElement(f.name);
      if (!el.length) return;
      if (f.type === "checkbox") el.prop("checked", false);
      else el.val("");
    });
    state.selectedLookupRows = {};
  }

  async function fetchLookupRows(field) {
    if (!field.lookup?.url) return [];
    if (state.lookupCache.has(field.lookup.url)) return state.lookupCache.get(field.lookup.url);
    const data = await api.getJson(field.lookup.url);
    const rows = listToArray(data);
    state.lookupCache.set(field.lookup.url, rows);
    return rows;
  }

  function lookupLabel(field, row) {
    if (!row) return "";
    const labelKey = field.lookup?.labelKey || "name";
    return String(getByPath(row, labelKey) || row?.name || row?.title || row?.id || "");
  }

  async function populateSelect(field) {
    const el = fieldElement(field.name);
    if (!el.length || field.type !== "select") return;
    const current = String(el.val() || "");
    el.empty().append('<option value="">Selecione...</option>');

    if (Array.isArray(field.options)) {
      field.options.forEach((opt) => el.append(`<option value="${esc(opt)}">${esc(opt)}</option>`));
      if (current) el.val(current);
      return;
    }

    if (!field.lookup?.url) return;
    const rows = await fetchLookupRows(field);
    let list = rows;
    if (field.filterByCompanyField) {
      const companyId = String(fieldElement(field.filterByCompanyField).val() || "");
      if (companyId) {
        list = rows.filter((r) => String(r?.company_id || r?.companyId || r?.company?.id || "") === companyId);
      }
    }
    list.forEach((row) => {
      const value = String(getByPath(row, field.lookup.valueKey || "id") || row?.id || "");
      if (!value) return;
      el.append(`<option value="${esc(value)}">${esc(lookupLabel(field, row))}</option>`);
    });
    if (current) el.val(current);
  }

  async function populateAllSelects() {
    const fields = getFields().filter((f) => f.type === "select");
    for (const field of fields) {
      await populateSelect(field);
    }
  }

  function normalizeValue(type, raw, checked) {
    if (type === "checkbox") return !!checked;
    const v = String(raw == null ? "" : raw).trim();
    if (!v) return null;
    if (type === "datetime-local") {
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? v : d.toISOString();
    }
    if (type === "number") {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    return v;
  }

  function validateForm(payload) {
    const required = (cfg.requiredFields || []).concat(getFields().filter((f) => f.required).map((f) => f.name));
    const unique = Array.from(new Set(required));
    const missing = unique.filter((k) => payload[k] == null || payload[k] === "");
    if (missing.length) throw new Error(`Campos obrigatorios: ${missing.join(", ")}`);
  }

  function buildPayload() {
    const payload = {};
    getFields().forEach((f) => {
      const el = fieldElement(f.name);
      if (!el.length) return;
      const value = normalizeValue(f.type, el.val(), el.is(":checked"));
      if (value != null) payload[f.name] = value;
    });

    // Backward-compat for stale frontend/runtime caches.
    // Ensures legacy keys are not sent to strict backend DTOs.
    if (cfg.pathKey === "tarefas/tipos") {
      if (payload.default_channel != null && payload.channel == null) payload.channel = payload.default_channel;
      if (payload.default_duration_min != null && payload.default_duration_minutes == null) {
        payload.default_duration_minutes = payload.default_duration_min;
      }
      delete payload.default_channel;
      delete payload.default_duration_min;
    }

    delete payload.tenant_id;
    delete payload.tenantId;
    validateForm(payload);
    return payload;
  }

  function setFormValues(row) {
    getFields().forEach((f) => {
      const el = fieldElement(f.name);
      if (!el.length) return;
      const v = row?.[f.name];
      if (f.type === "checkbox") {
        el.prop("checked", !!v);
      } else if (f.type === "datetime-local" && v) {
        const d = new Date(v);
        el.val(Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 16));
      } else {
        el.val(v == null ? "" : String(v));
      }
    });
  }

  async function loadList() {
    try {
      const url = cfg.listPath || cfg.apiPath;
      const data = await api.getJson(url);
      state.rows = listToArray(data);
      renderHeader();
      renderRows();
    } catch (err) {
      handleError(err, "Nao foi possivel carregar os dados.");
    }
  }

  async function saveForm(ev) {
    ev.preventDefault();
    const btn = $("#serviceSaveBtn");
    btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Salvando...');
    showMsg("", "");

    try {
      const payload = buildPayload();
      if (state.editingId) {
        await api.putJson(`${cfg.apiPath}/${encodeURIComponent(state.editingId)}`, payload);
      } else {
        await api.postJson(cfg.apiPath, payload);
      }
      showMsg("success", "Salvo com sucesso.");
      closeSide();
      await loadList();
    } catch (err) {
      handleError(err, "Nao foi possivel salvar. Verifique os campos e tente novamente.");
    } finally {
      btn.prop("disabled", false).html('<i class="fa fa-save"></i> Salvar');
    }
  }

  async function onEdit(id) {
    try {
      const row = await api.getJson(`${cfg.apiPath}/${encodeURIComponent(id)}`);
      state.editingId = id;
      $("#serviceRowId").val(id);
      $("#serviceFormTitle").text("Editar registro");
      await populateAllSelects();
      setFormValues(row);
      openSide();
    } catch (err) {
      handleError(err, "Nao foi possivel carregar o registro.");
    }
  }

  async function onDelete(id) {
    const ok = await window.confirm("Deseja realmente excluir este registro?");
    if (!ok) return;
    try {
      await api.deleteJson(`${cfg.apiPath}/${encodeURIComponent(id)}`);
      showMsg("success", "Registro excluido com sucesso.");
      await loadList();
    } catch (err) {
      handleError(err, "Nao foi possivel excluir o registro.");
    }
  }

  function bindFieldDependencies() {
    getFields().forEach((f) => {
      if (f.type === "select" && f.filterByCompanyField) {
        fieldElement(f.filterByCompanyField).on("change", () => populateSelect(f));
      }

      if (f.type === "select" && Array.isArray(f.onChangeCopyTo) && f.lookup?.url) {
        fieldElement(f.name).on("change", async function () {
          const selected = String($(this).val() || "");
          if (!selected) return;
          const rows = await fetchLookupRows(f);
          const valueKey = f.lookup.valueKey || "id";
          const row = rows.find((r) => String(getByPath(r, valueKey) || "") === selected);
          if (!row) return;
          f.onChangeCopyTo.forEach((rule) => {
            const to = fieldElement(rule.to);
            if (!to.length) return;
            const value = getByPath(row, rule.from);
            if (value != null && String(to.val() || "").trim() === "") {
              to.val(String(value));
            }
          });
        });
      }
    });
  }

  function applyQueryDefaults() {
    const q = parseQuery();
    Object.keys(q).forEach((k) => {
      const el = fieldElement(k);
      if (el.length) {
        el.val(q[k]);
      }
    });
  }

  async function openCreate() {
    state.editingId = null;
    $("#serviceFormTitle").text("Novo registro");
    clearForm();
    await populateAllSelects();
    applyQueryDefaults();
    openSide();
  }

  function applyFiltersToInputs() {
    Object.keys(state.columnFilters).forEach((key) => {
      const input = $(`#serviceFiltersRow .service-col-filter[data-field="${key}"]`);
      if (!input.length) return;
      input.val(state.columnFilters[key]);
    });
  }

  function captureFiltersFromInputs() {
    const map = {};
    $("#serviceFiltersRow .service-col-filter").each(function () {
      const field = String($(this).data("field") || "");
      if (!field) return;
      const value = String($(this).val() || "").trim();
      if (!value) return;
      map[field] = value;
    });
    state.columnFilters = map;
  }

  function getAllColumnKeys() {
    return getColumns().map((c) => String(c.key || "")).filter(Boolean);
  }

  function captureFiltersForSavedView() {
    const filters = [];
    Object.keys(state.columnFilters).forEach((field) => {
      const value = String(state.columnFilters[field] || "").trim();
      if (!value) return;
      filters.push({ field, op: "contains", value });
    });
    return filters;
  }

  function applyFiltersFromSavedView(def) {
    state.columnFilters = {};
    (def?.filters || []).forEach((f) => {
      const field = String(f?.field || "");
      const value = String(f?.value || "").trim();
      if (!field || !value) return;
      state.columnFilters[field] = value;
    });
    applyFiltersToInputs();
  }

  function applySortFromSavedView(def) {
    const s = Array.isArray(def?.sort) ? def.sort[0] : null;
    if (!s?.field) {
      state.sort = { key: null, dir: "asc" };
      renderSortIndicators();
      return;
    }
    state.sort.key = String(s.field);
    state.sort.dir = String(s.dir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    renderSortIndicators();
  }

  async function initSavedViews() {
    if (!window.SavedViewsGrid || typeof window.SavedViewsGrid.init !== "function") return;
    const entityName = String(cfg.pathKey || cfg.title || "service").replace(/\s+/g, "_").toLowerCase();
    const allKeys = getAllColumnKeys();
    state.savedViewState.columns = allKeys.slice();
    state.savedViewState.columns_order = allKeys.slice();

    await window.SavedViewsGrid.init({
      entityName,
      hostSelector: "#serviceSavedViewsHost",
      tableSelector: "#serviceTable",
      headerRowSelector: "#serviceHeaderRow",
      filtersRowSelector: "#serviceFiltersRow",
      getAllColumnKeys: () => getAllColumnKeys(),
      fallbackViewName: "",
      includeFallbackOption: false,
      fallbackDefinition: {
        columns: allKeys.slice(),
        columns_order: allKeys.slice(),
        filters: [],
        sort: [],
        pageSize: 0,
      },
      getCurrentState: () => {
        state.savedViewState.filters = captureFiltersForSavedView();
        state.savedViewState.sort = state.sort.key ? [{ field: state.sort.key, dir: state.sort.dir }] : [];
        return Object.assign({}, state.savedViewState);
      },
      applyState: ({ viewId, name, definition }) => {
        state.savedViewState.viewId = viewId;
        state.savedViewState.name = name || "";
        applyFiltersFromSavedView(definition || {});
        applySortFromSavedView(definition || {});
        renderRows();
      },
      onAfterApply: () => {
        renderRows();
      },
    });
  }

  function bindEvents() {
    $("#serviceSearch").on("input", renderRows);
    $("#serviceRefreshBtn").on("click", loadList);
    $("#serviceNewBtn").on("click", openCreate);
    $("#serviceCloseBtn,#serviceCancelBtn,#serviceSideOverlay").on("click", closeSide);
    $("#serviceForm").on("submit", saveForm);

    $("#serviceFiltersRow").on("keyup change", ".service-col-filter", function () {
      captureFiltersFromInputs();
      renderRows();
    });

    $("#serviceHeaderRow").on("click", "th.sortable", function () {
      const key = String($(this).data("sort-key") || "");
      if (!key) return;
      if (state.sort.key === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      else {
        state.sort.key = key;
        state.sort.dir = "asc";
      }
      renderSortIndicators();
      renderRows();
    });

    $("#serviceRows").on("click", ".js-edit", function () {
      const id = String($(this).closest("tr").data("id") || "");
      if (id) onEdit(id);
    });

    $("#serviceRows").on("click", ".js-delete", function () {
      const id = String($(this).closest("tr").data("id") || "");
      if (id) onDelete(id);
    });
  }

  async function init() {
    $("#pageName").text(cfg.title || "Servico");
    $("#subSecoundPageName").text(cfg.title || "Servico");
    $("#subpathName").text(cfg.title || "Servico");
    $("#subpath").show();
    $("#path").show();
    $("#subpageName").text("Servico");
    $("#subpageName").attr("href", "/servico/incidentes");

    bindEvents();
    bindFieldDependencies();
    await loadList();
    await initSavedViews();
  }

  $(document).ready(init);
})();
