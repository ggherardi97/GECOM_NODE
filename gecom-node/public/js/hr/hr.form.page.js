(function () {
  const { resources, tt, waitForI18nReady, esc, normalizeArray, toMoney, toDateTimeBr } = window.HrResources || {};
  const page = window.__hrPage || {};
  const config = resources?.[page.key];
  if (!config) return;

  const params = new URLSearchParams(window.location.search || "");
  const state = {
    id: String(params.get("id") || "").trim() || null,
    prefill: {},
    lookups: {},
    currentRow: null,
    payments: [],
    tabs: [],
    fieldToTab: {},
    relatedDefs: [],
    relatedActiveKey: "",
    relatedCache: {},
  };

  const relatedFormPathByApi = {
    "/api/hr/departments": "/NewHRDepartment",
    "/api/hr/positions": "/NewHRPosition",
    "/api/hr/work-locations": "/NewHRWorkLocation",
    "/api/hr/employment-statuses": "/NewHREmploymentStatus",
    "/api/hr/document-types": "/NewHRDocumentType",
    "/api/hr/marital-statuses": "/NewHRMaritalStatus",
    "/api/hr/employees": "/NewHREmployee",
    "/api/hr/department-assignments": "/NewHRAssignment",
    "/api/hr/work-schedules": "/NewHRWorkSchedule",
    "/api/hr/employee-schedule-assignments": "/NewHREmployeeScheduleAssignment",
    "/api/hr/leave-types": "/NewHRLeaveType",
    "/api/hr/leave-requests": "/NewHRLeaveRequest",
    "/api/hr/skill-categories": "/NewHRSkillCategory",
    "/api/hr/skills": "/NewHRSkill",
    "/api/hr/employee-skills": "/NewHREmployeeSkill",
    "/api/hr/certifications": "/NewHRCertification",
    "/api/hr/employee-certifications": "/NewHREmployeeCertification",
    "/api/hr/lifecycle/templates": "/NewHRLifecycleTemplate",
    "/api/hr/lifecycle/stages": "/NewHRLifecycleStage",
    "/api/hr/lifecycle/tasks": "/NewHRLifecycleTask",
    "/api/hr/lifecycle/employee-lifecycles": "/NewHREmployeeLifecycle",
    "/api/hr/lifecycle/employee-lifecycle-tasks": "/NewHREmployeeLifecycleTask",
  };

  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: "include" }, opts || {})).then(async (resp) => {
      const text = await resp.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data;
    });
  }

  function askConfirm(message) {
    try {
      const result = window.confirm(message);
      if (result && typeof result.then === "function") return result.then((v) => !!v);
      return Promise.resolve(!!result);
    } catch {
      return Promise.resolve(false);
    }
  }

  function lookupLabel(item) {
    return String(
      item?.full_name ||
        item?.employee_number ||
        item?.title ||
        item?.company_name ||
        item?.name ||
        item?.code ||
        item?.invoice_number ||
        item?.title_number ||
        item?.payable_number ||
        item?.email ||
        item?.id ||
        "",
    ).trim();
  }

  function lookupSubtitle(item) {
    return String(
      item?.description ||
        item?.document_number ||
        item?.reference ||
        item?.email ||
        item?.issuer ||
        item?.type ||
        "",
    ).trim();
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function normalizeApiPath(value) {
    return String(value || "")
      .trim()
      .split("?")[0]
      .replace(/\/+$/g, "");
  }

  function resolveRelatedFormPath(def) {
    const api = normalizeApiPath(def?.api);
    if (!api) return "";
    return String(relatedFormPathByApi[api] || "").trim();
  }

  function relatedRecordId(row) {
    const id = row?.id;
    const text = String(id == null ? "" : id).trim();
    return text || "";
  }

  function buildRelatedEditUrl(def, row) {
    const formPath = resolveRelatedFormPath(def);
    const id = typeof row === "string" ? String(row || "").trim() : relatedRecordId(row);
    if (!formPath || !id) return "";
    return `${formPath}?id=${encodeURIComponent(id)}`;
  }

  function buildRelatedNewUrl(def) {
    const formPath = resolveRelatedFormPath(def);
    const filter = String(def?.filter || "").trim();
    if (!formPath || !filter || !state.id) return "";
    const url = new URL(formPath, window.location.origin);
    url.searchParams.set(filter, String(state.id));
    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  function buildPrefillFromQuery() {
    const fields = Array.isArray(config.formFields) ? config.formFields : [];
    const byName = new Map(fields.map((field) => [String(field?.name || "").trim(), field]));
    const prefill = {};
    params.forEach((rawValue, rawKey) => {
      const key = String(rawKey || "").trim();
      if (!key || key === "id") return;
      const field = byName.get(key);
      if (!field) return;

      const value = String(rawValue == null ? "" : rawValue).trim();
      if (field.type === "checkbox") {
        const normalized = value.toLowerCase();
        prefill[key] = ["1", "true", "t", "yes", "sim", "on"].includes(normalized);
        return;
      }
      prefill[key] = value;
    });
    return prefill;
  }

  state.prefill = buildPrefillFromQuery();

  function isIntegerField(field) {
    if (field?.type !== "number") return false;
    return String(field?.step || "") === "1" || /(installment_number|installment_total)/i.test(String(field?.name || ""));
  }

  function isMoneyField(field) {
    if (field?.type !== "number") return false;
    if (isIntegerField(field)) return false;
    return /(amount|balance|price|total)/i.test(String(field?.name || "")) || String(field?.step || "") === "0.01";
  }

  function parseLocaleNumber(raw) {
    const text = String(raw == null ? "" : raw).trim();
    if (!text) return null;

    const cleaned = text.replace(/\s+/g, "").replace(/[^\d,.\-]/g, "");
    if (!cleaned) return null;

    let normalized = cleaned;
    if (cleaned.includes(",") && cleaned.includes(".")) {
      normalized =
        cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
          ? cleaned.replace(/\./g, "").replace(",", ".")
          : cleaned.replace(/,/g, "");
    } else if (cleaned.includes(",")) {
      normalized = cleaned.replace(/\./g, "").replace(",", ".");
    }

    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function toMoneyApiString(raw) {
    const n = parseLocaleNumber(raw);
    if (n == null) return null;
    return n.toFixed(2);
  }

  function formatMoneyDisplay(raw) {
    const n = parseLocaleNumber(raw);
    if (n == null) return "";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function bindMoneyMasks($scope, prefix, fields) {
    (fields || [])
      .filter((field) => isMoneyField(field))
      .forEach((field) => {
        const id = `#${prefix}_${field.name}`;
        const $input = $scope.find(id);
        if (!$input.length) return;

        const initial = formatMoneyDisplay($input.val());
        if (initial) $input.val(initial);

        $input.attr("inputmode", "numeric");
        $input.off(".finmoney");
        $input.on("input.finmoney", function () {
          const digits = String($(this).val() || "").replace(/\D/g, "");
          if (!digits) {
            $(this).val("");
            return;
          }
          const num = Number(digits) / 100;
          $(this).val(num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        });
        $input.on("blur.finmoney", function () {
          const value = formatMoneyDisplay($(this).val());
          $(this).val(value);
        });
      });
  }

  function mapRowValue(field, row) {
    const value = row?.[field.name];
    if (field.type === "lookup") {
      if (value != null && value !== "") return String(value);
      const base = String(field.name || "").replace(/_id$/i, "");
      const rel = row?.[base];
      if (rel?.id != null) return String(rel.id);
      return "";
    }
    if (field.type === "date" && value) return String(value).slice(0, 10);
    if (field.type === "datetime-local" && value) return new Date(value).toISOString().slice(0, 16);
    if (field.type === "checkbox") return !!value;
    if (value == null) return field.defaultValue ?? "";
    return String(value);
  }

  function buildFormTabs() {
    const allFields = Array.isArray(config.formFields) ? config.formFields : [];
    const byName = new Map(allFields.map((field) => [String(field.name || ""), field]));
    const used = new Set();
    const tabs = [];
    const sourceTabs = Array.isArray(config.formTabs) ? config.formTabs : [];

    sourceTabs.forEach((tab) => {
      const ids = Array.isArray(tab?.fields) ? tab.fields : [];
      const fields = ids
        .map((name) => String(name || ""))
        .filter(Boolean)
        .map((name) => byName.get(name))
        .filter(Boolean);
      fields.forEach((field) => used.add(String(field.name || "")));
      if (!fields.length) return;
      tabs.push({
        id: String(tab.id || `tab_${tabs.length + 1}`).trim(),
        label: String(tab.label || "page.hr.tabs.basic"),
        fields,
      });
    });

    const remaining = allFields.filter((field) => !used.has(String(field.name || "")));
    if (remaining.length) {
      tabs.push({
        id: "extra",
        label: "page.hr.tabs.more",
        fields: remaining,
      });
    }

    if (!tabs.length) {
      tabs.push({
        id: "basic",
        label: "page.hr.tabs.basic",
        fields: allFields,
      });
    }

    const normalized = normalizeTabsForUi(tabs);
    return normalized.map((tab, index) => {
      const paneId = `hrTab_${tab.id}_${index}`;
      return Object.assign({}, tab, { paneId });
    });
  }

  function normalizeTabsForUi(rawTabs) {
    let tabs = (rawTabs || []).map((tab) => ({
      id: String(tab.id || "").trim() || "tab",
      label: String(tab.label || "page.hr.tabs.basic"),
      fields: Array.isArray(tab.fields) ? tab.fields.slice() : [],
    }));

    if (!tabs.length) return tabs;

    const basicIdx = Math.max(
      0,
      tabs.findIndex((tab) => String(tab.id || "").toLowerCase() === "basic"),
    );

    tabs.forEach((tab, idx) => {
      if (idx === basicIdx) return;
      if ((tab.fields || []).length > 1) return;
      tabs[basicIdx].fields = tabs[basicIdx].fields.concat(tab.fields || []);
      tab.fields = [];
    });

    tabs = tabs.filter((tab) => (tab.fields || []).length > 0);
    if (tabs.length <= 3) return tabs;

    const keep = tabs.slice(0, 2);
    const rest = tabs.slice(2);
    const merged = {
      id: "more",
      label: "page.hr.tabs.more",
      fields: [],
    };
    rest.forEach((tab) => {
      merged.fields = merged.fields.concat(tab.fields || []);
    });

    if (merged.fields.length) keep.push(merged);
    return keep;
  }

  function getRelatedPaneId() {
    return "hrTab_related";
  }

  function getRelatedDefinitions() {
    const defs = Array.isArray(config.relatedResources) ? config.relatedResources : [];
    return defs
      .map((def, idx) => ({
        key: String(def?.id || `related_${idx + 1}`).trim(),
        label: String(def?.label || `Relacionado ${idx + 1}`).trim(),
        api: String(def?.api || "").trim(),
        filter: String(def?.filter || "").trim(),
        query: def?.query && typeof def.query === "object" ? Object.assign({}, def.query) : {},
        columns: Array.isArray(def?.columns) ? def.columns.slice() : [],
      }))
      .filter((def) => def.key && def.api && def.filter);
  }

  function relatedDefinitionByKey(key) {
    const normalized = String(key || "").trim();
    if (!normalized) return null;
    return (state.relatedDefs || []).find((def) => String(def.key) === normalized) || null;
  }

  function pathValue(row, path) {
    const normalized = String(path || "").trim();
    if (!normalized) return null;
    const parts = normalized.split(".");
    let current = row;
    for (const part of parts) {
      if (current == null) return null;
      current = current?.[part];
    }
    return current;
  }

  function formatDateBr(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  }

  function formatDateTimeBr(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR");
  }

  function formatRelatedValue(raw, column) {
    const format = String(column?.format || "").trim().toLowerCase();
    if (format === "date") return formatDateBr(raw);
    if (format === "datetime") return formatDateTimeBr(raw);
    if (format === "bool") return raw ? tt("page.hr.common.yes", "Sim") : tt("page.hr.common.no", "Não");
    if (Array.isArray(raw)) {
      if (!raw.length) return "-";
      return raw
        .slice(0, 3)
        .map((item) => lookupLabel(item))
        .join(", ");
    }
    if (raw && typeof raw === "object") return lookupLabel(raw) || "-";
    const text = String(raw == null ? "" : raw).trim();
    return text || "-";
  }

  function inferRelatedColumns(rows) {
    const first = rows?.[0];
    if (!first || typeof first !== "object") return [];
    return Object.keys(first)
      .filter((key) => !["id", "tenant_id", "deleted_at", "created_at", "updated_at"].includes(String(key)))
      .slice(0, 6)
      .map((key) => ({ key, label: key }));
  }

  function relatedRequestUrl(def) {
    const params = new URLSearchParams();
    params.set(def.filter, String(state.id || ""));
    const extra = def.query || {};
    Object.entries(extra).forEach(([key, value]) => {
      const name = String(key || "").trim();
      const text = String(value == null ? "" : value).trim();
      if (!name || !text) return;
      params.set(name, text);
    });
    if (!params.has("page_size")) params.set("page_size", "100");
    const base = String(def.api || "").trim();
    if (!base) return "";
    return `${base}${base.includes("?") ? "&" : "?"}${params.toString()}`;
  }

  function renderRelatedPane() {
    return `
      <div class="row hr-related-wrap">
        <div class="col-md-4">
          <div class="list-group hr-related-list" id="hrRelatedList"></div>
        </div>
        <div class="col-md-8">
          <div class="panel panel-default">
            <div class="panel-heading hr-related-header">
              <strong id="hrRelatedTitle">${esc(tt("page.hr.tabs.related", "Relacionados"))}</strong>
              <button type="button" id="btnHrRelatedNew" class="btn btn-primary btn-xs" style="display:none;">
                <i class="fa fa-plus"></i> ${esc(tt("page.hr.common.new", "Novo"))}
              </button>
            </div>
            <div class="panel-body">
              <div class="table-responsive">
                <table class="table table-striped table-condensed">
                  <thead id="hrRelatedHead"></thead>
                  <tbody id="hrRelatedBody">
                    <tr><td class="text-muted">${esc(tt("page.hr.common.selectOne", "Selecione uma relação ao lado."))}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderRelatedList() {
    const $list = $("#hrRelatedList");
    if (!$list.length) return;
    const defs = state.relatedDefs || [];
    if (!defs.length) {
      $list.html(`<div class="text-muted" style="padding:10px;">${esc(tt("page.hr.common.empty", "Nenhum registro encontrado."))}</div>`);
      return;
    }
    const html = defs
      .map((def) => {
        const active = String(def.key) === String(state.relatedActiveKey || "") ? " active" : "";
        const count = Array.isArray(state.relatedCache?.[def.key]) ? state.relatedCache[def.key].length : null;
        return `
          <button type="button" class="list-group-item hr-related-item${active} js-hr-related-item" data-related-key="${esc(def.key)}">
            <span>${esc(def.label)}</span>
            ${count == null ? "" : `<span class="badge">${esc(String(count))}</span>`}
          </button>
        `;
      })
      .join("");
    $list.html(html);
  }

  function renderRelatedTable(def, rows) {
    const $head = $("#hrRelatedHead");
    const $body = $("#hrRelatedBody");
    if (!$head.length || !$body.length) return;
    const targetFormPath = resolveRelatedFormPath(def);

    const columns = Array.isArray(def?.columns) && def.columns.length ? def.columns : inferRelatedColumns(rows);
    if (!columns.length) {
      $head.html("");
      $body.html(`<tr><td class="text-muted">${esc(tt("page.hr.common.empty", "Nenhum registro encontrado."))}</td></tr>`);
      return;
    }

    $head.html(`<tr>${columns.map((col) => `<th>${esc(col?.label || col?.key || "-")}</th>`).join("")}</tr>`);

    if (!Array.isArray(rows) || !rows.length) {
      $body.html(`<tr><td colspan="${esc(String(columns.length))}" class="text-muted">${esc(tt("page.hr.common.empty", "Nenhum registro encontrado."))}</td></tr>`);
      return;
    }

    const html = rows
      .map((row) => {
        const rowId = relatedRecordId(row);
        const clickable = !!(targetFormPath && rowId);
        const rowClass = clickable ? "js-hr-related-row hr-related-row-clickable" : "";
        const cells = columns
          .map((column) => {
            const raw = pathValue(row, column?.key);
            return `<td>${esc(formatRelatedValue(raw, column))}</td>`;
          })
          .join("");
        return `<tr class="${rowClass}" data-row-id="${esc(rowId)}">${cells}</tr>`;
      })
      .join("");
    $body.html(html);
  }

  function setRelatedActive(defKey) {
    const def = relatedDefinitionByKey(defKey);
    if (!def) return;
    state.relatedActiveKey = def.key;
    renderRelatedList();
    $("#hrRelatedTitle").text(def.label || tt("page.hr.tabs.related", "Relacionados"));
    const newUrl = buildRelatedNewUrl(def);
    const $newButton = $("#btnHrRelatedNew");
    if ($newButton.length) {
      $newButton.attr("data-related-key", def.key);
      if (newUrl) $newButton.show();
      else $newButton.hide();
    }

    const cached = state.relatedCache?.[def.key];
    if (Array.isArray(cached)) {
      renderRelatedTable(def, cached);
      return;
    }

    $("#hrRelatedHead").html("");
    $("#hrRelatedBody").html(`<tr><td class="text-muted">${esc(tt("page.hr.common.loading", "Carregando..."))}</td></tr>`);
    const url = relatedRequestUrl(def);
    if (!url) {
      $("#hrRelatedBody").html(`<tr><td class="text-muted">URL inválida</td></tr>`);
      return;
    }

    api(url)
      .then((data) => {
        const rows = normalizeArray(data);
        state.relatedCache[def.key] = rows;
        if (String(state.relatedActiveKey || "") !== String(def.key)) return;
        renderRelatedList();
        renderRelatedTable(def, rows);
      })
      .catch((error) => {
        if (String(state.relatedActiveKey || "") !== String(def.key)) return;
        $("#hrRelatedHead").html("");
        $("#hrRelatedBody").html(`<tr><td class="text-danger">${esc(error?.message || "Erro ao carregar relacionados")}</td></tr>`);
      });
  }

  function bindRelatedWidgets($scope) {
    const defs = state.relatedDefs || [];
    if (!$scope || !$scope.length || !defs.length || !state.id) return;

    renderRelatedList();

    $scope.off("click.finrelateditem", "#hrRelatedList .js-hr-related-item");
    $scope.on("click.finrelateditem", "#hrRelatedList .js-hr-related-item", function () {
      const key = String($(this).data("related-key") || "").trim();
      if (!key) return;
      setRelatedActive(key);
    });

    $scope.off("click.finrelatedrow", "#hrRelatedBody .js-hr-related-row");
    $scope.on("click.finrelatedrow", "#hrRelatedBody .js-hr-related-row", function () {
      const rowId = String($(this).data("row-id") || "").trim();
      const def = relatedDefinitionByKey(state.relatedActiveKey);
      if (!def || !rowId) return;
      const url = buildRelatedEditUrl(def, rowId);
      if (!url) return;
      window.location.href = url;
    });

    $scope.off("click.finrelatednew", "#btnHrRelatedNew");
    $scope.on("click.finrelatednew", "#btnHrRelatedNew", function () {
      const key = String($(this).attr("data-related-key") || state.relatedActiveKey || "").trim();
      const def = relatedDefinitionByKey(key);
      if (!def) return;
      const url = buildRelatedNewUrl(def);
      if (!url) return;
      window.location.href = url;
    });

    const firstKey = defs.find((def) => def?.key)?.key || "";
    const targetKey = relatedDefinitionByKey(state.relatedActiveKey)?.key || firstKey;
    if (targetKey) setRelatedActive(targetKey);
  }

  function requiredMark(field) {
    return field.required ? `<span class="hr-required">*</span>` : "";
  }

  function renderLookupField(field, row, prefix) {
    const value = mapRowValue(field, row);
    const hiddenId = `${prefix}_${field.name}`;
    const inputId = `${prefix}_${field.name}__lookup`;
    const menuId = `${prefix}_${field.name}__menu`;
    const label = tt(field.label, field.name);
    const lookupRows = state.lookups[field.lookup] || [];
    const selected = lookupRows.find((item) => String(item?.id || "") === String(value || ""));
    const rel = row?.[String(field.name || "").replace(/_id$/i, "")];
    const selectedLabel = selected ? lookupLabel(selected) : rel ? lookupLabel(rel) : "";
    const req = field.required ? "data-required=\"1\"" : "";

    return `
      <div id="${esc(`${hiddenId}__wrap`)}" class="form-group hr-field-wrap" data-field="${esc(field.name)}">
        <label>${esc(label)}${requiredMark(field)}</label>
        <div class="hr-lookup-wrap">
          <input
            id="${esc(inputId)}"
            class="form-control js-fin-lookup-input"
            type="text"
            autocomplete="off"
            value="${esc(selectedLabel)}"
            data-prefix="${esc(prefix)}"
            data-field="${esc(field.name)}"
            data-lookup="${esc(field.lookup || "")}"
            data-target="#${esc(hiddenId)}"
            data-menu="#${esc(menuId)}"
            ${req}
            placeholder="${esc(tt("page.hr.common.lookupPlaceholder", "Clique para ver recentes ou digite para buscar"))}"
          />
          <input id="${esc(hiddenId)}" type="hidden" value="${esc(value || "")}" />
          <div id="${esc(menuId)}" class="hr-lookup-menu"></div>
        </div>
      </div>
    `;
  }

  function renderNormalField(field, row, prefix) {
    const id = `${prefix}_${field.name}`;
    const label = tt(field.label, field.name);
    const value = mapRowValue(field, row);
    const required = field.required ? "required data-required=\"1\"" : "";

    if (field.type === "checkbox") {
      return `
        <div id="${esc(`${id}__wrap`)}" class="form-group hr-field-wrap" data-field="${esc(field.name)}">
          <label><input id="${esc(id)}" type="checkbox" ${value ? "checked" : ""}/> ${esc(label)}${requiredMark(field)}</label>
        </div>
      `;
    }

    if (field.type === "textarea") {
      return `
        <div id="${esc(`${id}__wrap`)}" class="form-group hr-field-wrap" data-field="${esc(field.name)}">
          <label>${esc(label)}${requiredMark(field)}</label>
          <textarea id="${esc(id)}" class="form-control" rows="2" ${required}>${esc(value || "")}</textarea>
        </div>
      `;
    }

    if (field.type === "select") {
      const options = (field.options || []).map((opt) => {
        const selected = String(value || field.defaultValue || "") === String(opt) ? "selected" : "";
        return `<option value="${esc(opt)}" ${selected}>${esc(opt)}</option>`;
      });
      return `
        <div id="${esc(`${id}__wrap`)}" class="form-group hr-field-wrap" data-field="${esc(field.name)}">
          <label>${esc(label)}${requiredMark(field)}</label>
          <select id="${esc(id)}" class="form-control" ${required}>${options.join("")}</select>
        </div>
      `;
    }

    const isMoney = isMoneyField(field);
    const type = isMoney ? "text" : field.type || "text";
    const displayValue = isMoney ? formatMoneyDisplay(value) : value;
    return `
      <div id="${esc(`${id}__wrap`)}" class="form-group hr-field-wrap" data-field="${esc(field.name)}">
        <label>${esc(label)}${requiredMark(field)}</label>
        <input
          id="${esc(id)}"
          class="form-control"
          type="${esc(type)}"
          value="${esc(displayValue || "")}"
          ${field.step ? `step="${esc(field.step)}"` : ""}
          ${required}
        />
      </div>
    `;
  }

  function fieldColumnClass(field) {
    if (field.type === "textarea") return "col-md-12";
    if (field.type === "checkbox") return "col-md-12";
    return "col-md-6";
  }

  function renderFormTabs(row) {
    const tabs = buildFormTabs();
    const relatedDefs = state.id ? getRelatedDefinitions() : [];
    state.relatedDefs = relatedDefs;
    state.tabs = tabs;
    state.fieldToTab = {};
    tabs.forEach((tab) => {
      tab.fields.forEach((field) => {
        state.fieldToTab[String(field.name || "")] = tab.paneId;
      });
    });

    let nav = tabs
      .map((tab, idx) => {
        const active = idx === 0 ? "active" : "";
        return `<li class="${active}"><a href="#${esc(tab.paneId)}" data-toggle="tab">${esc(tt(tab.label, tab.id))}</a></li>`;
      })
      .join("");

    let panes = tabs
      .map((tab, idx) => {
        const active = idx === 0 ? "tab-pane active" : "tab-pane";
        const fieldsHtml = tab.fields
          .map((field) => {
            const html = field.type === "lookup" ? renderLookupField(field, row, "ff") : renderNormalField(field, row, "ff");
            return `<div class="${fieldColumnClass(field)}">${html}</div>`;
          })
          .join("");
        return `<div class="${active}" id="${esc(tab.paneId)}"><div class="row">${fieldsHtml}</div></div>`;
      })
      .join("");

    if (relatedDefs.length) {
      nav += `<li><a href="#${esc(getRelatedPaneId())}" data-toggle="tab">${esc(tt("page.hr.tabs.related", "Relacionados"))}</a></li>`;
      panes += `<div class="tab-pane" id="${esc(getRelatedPaneId())}">${renderRelatedPane()}</div>`;
    }

    return `
      <ul class="nav nav-tabs hr-form-tabs" id="hrFormTabs">${nav}</ul>
      <div class="tab-content hr-tab-content">${panes}</div>
    `;
  }

  function recentScore(item) {
    const keys = ["updated_at", "created_at", "issue_date", "due_date", "movement_date", "payment_date", "date"];
    for (const key of keys) {
      const value = item?.[key];
      if (!value) continue;
      const ts = new Date(value).getTime();
      if (!Number.isNaN(ts)) return ts;
    }
    return 0;
  }

  function sortRecent(items) {
    return items.slice().sort((a, b) => recentScore(b) - recentScore(a));
  }

  function renderLookupMenu($menu, rows) {
    if (!$menu || !$menu.length) return;
    if (!rows.length) {
      $menu.html(`<div class="hr-lookup-empty">${esc(tt("page.hr.common.lookupEmpty", "Nenhum registro encontrado."))}</div>`).show();
      return;
    }
    const html = rows
      .map((item) => {
        const label = lookupLabel(item);
        const subtitle = lookupSubtitle(item);
        return `<div class="hr-lookup-item" data-id="${esc(item.id)}" data-label="${esc(label)}">
          <div><strong>${esc(label || item.id || "-")}</strong></div>
          ${subtitle ? `<div style="font-size:11px;color:#81909c;">${esc(subtitle)}</div>` : ""}
        </div>`;
      })
      .join("");
    $menu.html(html).show();
  }

  function bindLookupWidgets($scope, prefix, fields) {
    const fieldMap = new Map((fields || []).map((field) => [String(field.name || ""), field]));

    $scope.find(`.js-fin-lookup-input[data-prefix="${prefix}"]`).each(function () {
      const $input = $(this);
      const fieldName = String($input.data("field") || "").trim();
      if (!fieldName) return;
      const field = fieldMap.get(fieldName);
      if (!field) return;

      const targetSelector = String($input.data("target") || "");
      const menuSelector = String($input.data("menu") || "");
      const lookupKey = String($input.data("lookup") || field.lookup || "");
      const $hidden = $scope.find(targetSelector);
      const $menu = $scope.find(menuSelector);
      let timer = null;

      function clearSelected() {
        $hidden.val("");
      }

      function markValid() {
        $input.removeClass("hr-invalid");
      }

      function openRecent() {
        const rows = sortRecent(state.lookups[lookupKey] || []).slice(0, 5);
        renderLookupMenu($menu, rows);
      }

      function search(term) {
        const source = state.lookups[lookupKey] || [];
        const q = normalizeText(term);
        if (!q) {
          openRecent();
          return;
        }
        const rows = source
          .filter((item) => {
            const label = normalizeText(lookupLabel(item));
            const subtitle = normalizeText(lookupSubtitle(item));
            return label.includes(q) || subtitle.includes(q);
          })
          .slice(0, 10);
        renderLookupMenu($menu, rows);
      }

      $input.off(".finlookup");
      $menu.off(".finlookup");

      $input.on("focus.finlookup", function () {
        openRecent();
      });

      $input.on("input.finlookup", function () {
        clearSelected();
        markValid();
        if (timer) clearTimeout(timer);
        const term = String($(this).val() || "");
        timer = setTimeout(() => search(term), 180);
      });

      $menu.on("mousedown.finlookup", ".hr-lookup-item", function (event) {
        event.preventDefault();
        const id = String($(this).data("id") || "").trim();
        const label = String($(this).data("label") || "").trim();
        if (!id) return;
        $hidden.val(id);
        $input.val(label || id);
        $input.removeClass("hr-invalid");
        $menu.hide();
      });

      $input.on("blur.finlookup", function () {
        setTimeout(() => $menu.hide(), 140);
      });
    });
  }

  function readFieldValue(field, prefix, $scope) {
    const id = `${prefix}_${field.name}`;
    if (field.type === "lookup") return String($scope.find(`#${id}`).val() || "").trim();
    if (field.type === "checkbox") return $scope.find(`#${id}`).is(":checked");
    return $scope.find(`#${id}`).val();
  }

  function normalizeFieldValue(field, value) {
    if (field.type !== "number") return value;
    if (isMoneyField(field)) return toMoneyApiString(value);
    if (isIntegerField(field)) {
      const n = parseLocaleNumber(value);
      if (n == null) return null;
      return Math.trunc(n);
    }
    const n = parseLocaleNumber(value);
    return n == null ? null : n;
  }

  function markFieldInvalid(fieldName, prefix, $scope, isInvalid) {
    const id = `${prefix}_${fieldName}`;
    const $control =
      $scope.find(`#${id}__lookup`).length > 0
        ? $scope.find(`#${id}__lookup`)
        : $scope.find(`#${id}`);
    if (isInvalid) $control.addClass("hr-invalid");
    else $control.removeClass("hr-invalid");
  }

  function activateTabByField(fieldName) {
    const paneId = state.fieldToTab[String(fieldName || "")];
    if (!paneId) return;
    setActiveTabByPane(paneId);
  }

  function setActiveTabByPane(paneId) {
    const id = String(paneId || "").trim();
    if (!id) return;
    $("#hrFormTabs li").removeClass("active");
    $(`#hrFormTabs a[href="#${id}"]`).closest("li").addClass("active");
    $(".hr-tab-content .tab-pane").removeClass("active");
    $(`#${id}`).addClass("active");
    setRelatedLayoutMode(id === getRelatedPaneId());
  }

  function setRelatedLayoutMode(enabled) {
    const $row = $("#hrFormMainRow");
    const $mainCol = $("#hrFormMainCol");
    const $tipsCol = $("#hrTipsCol");
    if (!$row.length || !$mainCol.length || !$tipsCol.length) return;

    if (enabled) {
      $row.addClass("hr-related-mode");
      $mainCol.removeClass("col-md-8").addClass("col-md-12");
      $tipsCol.hide();
      return;
    }

    $row.removeClass("hr-related-mode");
    $mainCol.removeClass("col-md-12").addClass("col-md-8");
    $tipsCol.show();
  }

  function bindTabClicks($scope) {
    const $tabs = $scope.find("#hrFormTabs a[href^=\"#hrTab_\"]");
    $tabs.off("click.fintab").on("click.fintab", function (event) {
      event.preventDefault();
      const href = String($(this).attr("href") || "").trim();
      if (!href || !href.startsWith("#")) return;
      setActiveTabByPane(href.slice(1));
    });
  }

  function focusField(fieldName, prefix, $scope) {
    const id = `${prefix}_${fieldName}`;
    const $target =
      $scope.find(`#${id}__lookup`).length > 0
        ? $scope.find(`#${id}__lookup`)
        : $scope.find(`#${id}`);
    if ($target.length) $target.trigger("focus");
  }

  function collectPayload(fields, prefix, $scope, withTabs) {
    const payload = {};
    const missing = [];

    fields.forEach((field) => {
      let value = readFieldValue(field, prefix, $scope);
      value = normalizeFieldValue(field, value);

      const empty =
        field.type === "checkbox"
          ? field.required && !value
          : String(value == null ? "" : value).trim() === "";

      if (field.required && empty) {
        missing.push(field);
        markFieldInvalid(field.name, prefix, $scope, true);
      } else {
        markFieldInvalid(field.name, prefix, $scope, false);
      }

      if (field.type !== "checkbox" && !field.required && String(value == null ? "" : value).trim() === "") value = null;
      payload[field.name] = value;
    });

    if (missing.length) {
      const first = missing[0];
      if (withTabs) activateTabByField(first.name);
      focusField(first.name, prefix, $scope);
      const names = missing.map((field) => tt(field.label, field.name)).join(", ");
      throw new Error(`${tt("page.hr.common.fillRequired", "Preencha os campos obrigatórios")}: ${names}`);
    }

    return payload;
  }

  function defaultWorkScheduleJson() {
    return {
      mon: { start: "09:00", end: "18:00", break: 60 },
      tue: { start: "09:00", end: "18:00", break: 60 },
      wed: { start: "09:00", end: "18:00", break: 60 },
      thu: { start: "09:00", end: "18:00", break: 60 },
      fri: { start: "09:00", end: "18:00", break: 60 },
    };
  }

  function bindValidationClear($scope, prefix, fields) {
    fields.forEach((field) => {
      const id = `${prefix}_${field.name}`;
      if (field.type === "lookup") {
        $scope.find(`#${id}__lookup`).off(".findirty").on("input.findirty change.findirty", function () {
          const hiddenValue = String($scope.find(`#${id}`).val() || "").trim();
          if (hiddenValue || String($(this).val() || "").trim()) markFieldInvalid(field.name, prefix, $scope, false);
        });
        return;
      }
      const evt = field.type === "select" || field.type === "checkbox" ? "change.findirty" : "input.findirty change.findirty";
      $scope.find(`#${id}`).off(".findirty").on(evt, function () {
        const value = field.type === "checkbox" ? $(this).is(":checked") : String($(this).val() || "").trim();
        if (!field.required || value) markFieldInvalid(field.name, prefix, $scope, false);
      });
    });
  }

  async function loadLookups() {
    const sources = config.lookupSources || {};
    for (const [key, url] of Object.entries(sources)) {
      try {
        state.lookups[key] = normalizeArray(await api(url));
      } catch {
        state.lookups[key] = [];
      }
    }
  }

  function renderMainForm(row) {
    const fields = config.formFields || [];
    $("#hrFormFields").html(renderFormTabs(row || {}));
    const $scope = $("#hrFormFields");
    setRelatedLayoutMode(false);
    bindTabClicks($scope);
    bindLookupWidgets($scope, "ff", fields);
    bindMoneyMasks($scope, "ff", fields);
    bindValidationClear($scope, "ff", fields);
    bindRelatedWidgets($scope);
  }

  function renderPayments() {
    if (!config.paymentFields) {
      $("#hrPaymentsWrap").hide();
      return;
    }

    $("#hrPaymentsWrap").show();
    const rows = state.payments || [];
    const html = rows
      .map((payment) => {
        const bank = payment?.bank_account?.name || "-";
        return `<tr data-id="${esc(payment.id)}">
          <td>${esc(toDateTimeBr(payment.payment_date))}</td>
          <td>${esc(toMoney(payment.amount))}</td>
          <td>${esc(payment.payment_method || "-")}</td>
          <td>${esc(bank)}</td>
          <td>${esc(payment.reference || "-")}</td>
          <td>
            <button class="btn btn-xs btn-default js-payment-edit"><i class="fa fa-pencil"></i></button>
            <button class="btn btn-xs btn-danger js-payment-del"><i class="fa fa-trash"></i></button>
          </td>
        </tr>`;
      })
      .join("");

    $("#hrPaymentsBody").html(
      html || `<tr><td colspan="6" class="text-muted">${esc(tt("page.hr.common.empty", "Nenhum registro encontrado."))}</td></tr>`,
    );
  }

  function renderModalFields(fields, row, prefix) {
    return (fields || [])
      .map((field) => {
        if (field.type === "lookup") return renderLookupField(field, row || {}, prefix);
        return renderNormalField(field, row || {}, prefix);
      })
      .join("");
  }

  async function loadById(id) {
    const row = await api(`${config.apiBase}/${encodeURIComponent(id)}`);
    state.currentRow = row;
    state.payments = normalizeArray(row?.payments);
    state.relatedCache = {};
    state.relatedActiveKey = "";
    renderMainForm(row);
    renderPayments();
  }

  async function addOrEditPayment(payment) {
    if (!state.id) {
      alert(tt("page.hr.common.saveBeforePayments", "Salve primeiro o registro."));
      return;
    }

    const isEdit = !!payment?.id;
    const fields = config.paymentFields || [];
    window.SideModal.open({
      title: isEdit ? tt("page.hr.common.editPayment", "Editar pagamento") : tt("page.hr.common.newPayment", "Novo pagamento"),
      html: renderModalFields(fields, payment || {}, "fp"),
      okText: tt("page.hr.common.save", "Salvar"),
      cancelText: tt("page.hr.common.cancel", "Cancelar"),
      onOpen: function (ctx) {
        const $root = ctx?.root || $("#dynamicModalBody");
        bindLookupWidgets($root, "fp", fields);
        bindMoneyMasks($root, "fp", fields);
        bindValidationClear($root, "fp", fields);
      },
      onOk: async function (ctx) {
        try {
          const $root = ctx?.root || $("#dynamicModalBody");
          const payload = collectPayload(fields, "fp", $root, false);
          const base = `${config.apiBase}/${encodeURIComponent(state.id)}/payments`;
          await api(isEdit ? `${base}/${encodeURIComponent(payment.id)}` : base, {
            method: isEdit ? "PATCH" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          await loadById(state.id);
          return false;
        } catch (error) {
          alert(error?.message || "Erro ao salvar pagamento");
          return true;
        }
      },
    });
  }

  async function removePayment(id) {
    if (!state.id) return;
    const ok = await askConfirm(tt("page.hr.common.confirmDeletePayment", "Deseja excluir este pagamento?"));
    if (!ok) return;
    try {
      await api(`${config.apiBase}/${encodeURIComponent(state.id)}/payments/${encodeURIComponent(id)}`, { method: "DELETE" });
      await loadById(state.id);
    } catch (error) {
      alert(error?.message || "Erro ao excluir pagamento");
    }
  }

  async function generateFromInvoiceModal() {
    const field = {
      name: "invoice_id",
      label: "page.hr.fields.invoice",
      type: "lookup",
      lookup: "invoices",
      required: true,
    };

    window.SideModal.open({
      title: tt("page.hr.common.generateFromInvoice", "Gerar a receber por invoice"),
      html: `
        ${renderLookupField(field, {}, "gen")}
        <div class="form-group"><label>${esc(tt("page.hr.fields.installmentTotal", "Total de parcelas"))}</label><input id="gen_installments" class="form-control" type="number" value="1" min="1"/></div>
        <div class="form-group"><label>${esc(tt("page.hr.fields.intervalDays", "Intervalo em dias"))}</label><input id="gen_interval_days" class="form-control" type="number" value="30" min="1"/></div>
        <div class="form-group"><label>${esc(tt("page.hr.fields.firstDueDate", "Primeiro vencimento"))}</label><input id="gen_first_due_date" class="form-control" type="date"/></div>
      `,
      okText: tt("page.hr.common.generate", "Gerar"),
      cancelText: tt("page.hr.common.cancel", "Cancelar"),
      onOpen: function (ctx) {
        const $root = ctx?.root || $("#dynamicModalBody");
        bindLookupWidgets($root, "gen", [field]);
        bindValidationClear($root, "gen", [field]);
      },
      onOk: async function (ctx) {
        try {
          const $root = ctx?.root || $("#dynamicModalBody");
          const invoiceId = collectPayload([field], "gen", $root, false).invoice_id;
          const payload = {
            installment_total: Number($("#gen_installments").val() || 1),
            interval_days: Number($("#gen_interval_days").val() || 30),
            first_due_date: String($("#gen_first_due_date").val() || "").trim() || null,
          };

          const rows = normalizeArray(
            await api(`/api/hr/receivables/from-invoice/${encodeURIComponent(invoiceId)}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }),
          );

          if (rows[0]?.id) window.location.href = `${page.formPath}?id=${encodeURIComponent(rows[0].id)}`;
          else window.location.href = page.gridPath;
          return false;
        } catch (error) {
          alert(error?.message || "Erro ao gerar");
          return true;
        }
      },
    });
  }

  $("#btnHrBack").on("click", function () {
    window.location.href = page.gridPath;
  });

  $("#btnHrNew").on("click", function () {
    window.location.href = page.formPath;
  });

  $("#btnHrSave").on("click", async function () {
    try {
      const $scope = $("#hrFormFields");
      const payload = collectPayload(config.formFields || [], "ff", $scope, true);
      const isEdit = !!state.id;
      if (!isEdit && page.key === "workSchedules") {
        payload.schedule_json = defaultWorkScheduleJson();
      }
      if (!isEdit && config.forceActiveOnCreate === true) {
        payload.is_active = true;
      }
      if (!isEdit && (page.key === "receivables" || page.key === "payables")) {
        if (payload.installment_number == null) payload.installment_number = 1;
        if (payload.installment_total == null) payload.installment_total = 1;
      }
      const saved = await api(isEdit ? `${config.apiBase}/${encodeURIComponent(state.id)}` : config.apiBase, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const id = saved?.id || state.id;
      if (id) window.location.href = `${page.formPath}?id=${encodeURIComponent(id)}`;
      else window.location.href = page.gridPath;
    } catch (error) {
      alert(error?.message || "Erro ao salvar");
    }
  });

  $("#btnHrDelete").on("click", async function () {
    if (!state.id) return;
    const ok = await askConfirm(tt("page.hr.common.confirmDeleteOne", "Deseja excluir este registro?"));
    if (!ok) return;
    try {
      await api(`${config.apiBase}/${encodeURIComponent(state.id)}`, { method: "DELETE" });
      window.location.href = page.gridPath;
    } catch (error) {
      alert(error?.message || "Erro ao excluir");
    }
  });

  $("#btnHrAddPayment").on("click", function () {
    addOrEditPayment(null);
  });

  $("#btnHrGenerateFromInvoice").on("click", function () {
    generateFromInvoiceModal();
  });

  $(document).on("click", ".js-payment-edit", function () {
    const id = String($(this).closest("tr").data("id") || "");
    const row = state.payments.find((payment) => String(payment.id) === id);
    if (!row) return;
    addOrEditPayment(row);
  });

  $(document).on("click", ".js-payment-del", function () {
    const id = String($(this).closest("tr").data("id") || "");
    if (!id) return;
    removePayment(id);
  });

  $(document).ready(async function () {
    if (typeof waitForI18nReady === "function") await waitForI18nReady();
    $("#pageName").text(tt(page.titleKey, "RH"));
    $("#subpageName").text(tt(page.titleKey, "RH")).attr("href", page.gridPath);

    await loadLookups();
    renderMainForm(state.id ? {} : state.prefill || {});

    if (state.id) {
      $("#btnHrDelete").show();
      $("#btnHrNew").show();
      await loadById(state.id);
    } else {
      $("#btnHrDelete").hide();
      $("#btnHrNew").hide();
      $("#hrPaymentsWrap").hide();
    }

    if (page.key === "receivables") $("#btnHrGenerateFromInvoice").show();
    else $("#btnHrGenerateFromInvoice").hide();
  });
})();

