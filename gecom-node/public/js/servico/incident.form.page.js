(function () {
  const api = window.ServiceApi;
  const resourcesApi = window.ServiceIncidentResources || {};
  const {
    resources,
    waitForI18nReady,
    esc,
    textFor,
    normalizeArray,
    enumLabel,
    enumOptions,
  } = resourcesApi;
  const page = window.__incidentPage || {};
  const config = resources?.[page.key];
  if (!config || !api) return;

  const params = new URLSearchParams(window.location.search || "");
  const state = {
    id: String(params.get("id") || "").trim() || null,
    currentRow: null,
    draft: {},
    lookups: {},
    timeline: [],
    related: null,
    activeTab: String(config.formTabs?.[0]?.id || "main"),
  };

  function msg(key, fallback) {
    return textFor(config.messages?.[key], fallback);
  }

  function label(value, fallback) {
    return textFor(value, fallback);
  }

  function getFields() {
    return Array.isArray(config.fields) ? config.fields : [];
  }

  function getField(name) {
    return getFields().find((field) => String(field?.name || "") === String(name || "")) || null;
  }

  function getByPath(obj, path) {
    return String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce((acc, key) => (acc == null ? null : acc[key]), obj);
  }

  function apiRequest(url, options) {
    return fetch(url, Object.assign({ credentials: "include" }, options || {})).then(async (resp) => {
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

  function buildPagedUrl(rawUrl, pageNumber, pageSize) {
    try {
      const url = new URL(String(rawUrl || ""), window.location.origin);
      if (!url.searchParams.get("page_size") && Number(pageSize) > 0) {
        url.searchParams.set("page_size", String(pageSize));
      }
      if (Number(pageNumber) > 0) {
        url.searchParams.set("page", String(pageNumber));
      }
      return `${url.pathname}${url.search}${url.hash || ""}`;
    } catch {
      const glue = String(rawUrl || "").includes("?") ? "&" : "?";
      const suffix = [`page_size=${encodeURIComponent(String(pageSize || 200))}`, `page=${encodeURIComponent(String(pageNumber || 1))}`].join("&");
      return `${rawUrl}${glue}${suffix}`;
    }
  }

  async function fetchLookupRows(rawUrl) {
    const firstUrl = buildPagedUrl(rawUrl, 1, 200);
    const firstResponse = await api.getJson(firstUrl);
    const rows = normalizeArray(firstResponse);
    const total = Number(firstResponse?.total);
    const pageSize = Number(firstResponse?.page_size || firstResponse?.pageSize || rows.length || 0);

    if (!Number.isFinite(total) || !Number.isFinite(pageSize) || pageSize <= 0 || rows.length >= total) {
      return rows;
    }

    const out = rows.slice();
    const totalPages = Math.min(Math.ceil(total / pageSize), 30);
    for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
      const next = await api.getJson(buildPagedUrl(rawUrl, pageNumber, pageSize));
      const items = normalizeArray(next);
      if (!items.length) break;
      out.push(...items);
    }

    const seen = new Set();
    return out.filter((row) => {
      const id = String(row?.id || "").trim();
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function showMessage(kind, text) {
    const $el = $("#incidentMessage");
    $el.removeClass("is-open alert-success alert-danger alert-warning");
    if (!text) return;
    $el.addClass("is-open");
    $el.addClass(kind === "success" ? "alert-success" : kind === "warning" ? "alert-warning" : "alert-danger");
    $el.text(text);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function toInputDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function lookupRows(field, data) {
    const rows = normalizeArray(state.lookups[field.lookup] || []);
    if (!field.filterBy) return rows;
    const companyId = String((data && data[field.filterBy]) || state.draft[field.filterBy] || state.currentRow?.[field.filterBy] || "");
    if (!companyId) return rows;
    return rows.filter((row) => String(row?.company_id || row?.companyId || row?.company?.id || "") === companyId);
  }

  function lookupLabel(field, row) {
    if (!row) return "";
    if (field.lookup === "companies") return String(row?.company_name || row?.name || row?.id || "").trim();
    if (field.lookup === "users") return String(row?.full_name || row?.name || row?.email || row?.id || "").trim();
    return String(row?.name || row?.title || row?.id || "").trim();
  }

  function fieldValue(field, data) {
    const draftValue = data?.[field.name];
    if (draftValue != null) return draftValue;
    if (state.currentRow?.[field.name] != null) return state.currentRow[field.name];
    if (field.defaultValue != null) return field.defaultValue;
    return field.type === "checkbox" ? false : "";
  }

  function renderOptionTags(field, data) {
    const currentValue = String(fieldValue(field, data) || "");
    const empty = `<option value="">${esc(msg("selectPlaceholder", "Selecione..."))}</option>`;
    if (field.type === "select") {
      return [
        empty,
        ...enumOptions(field.optionsGroup).map((option) => {
          const selected = currentValue === option.value ? ' selected="selected"' : "";
          return `<option value="${esc(option.value)}"${selected}>${esc(option.label)}</option>`;
        }),
      ].join("");
    }

    const rows = lookupRows(field, data);
    return [
      empty,
      ...rows.map((row) => {
        const value = String(row?.id || "");
        const selected = currentValue === value ? ' selected="selected"' : "";
        return `<option value="${esc(value)}"${selected}>${esc(lookupLabel(field, row))}</option>`;
      }),
    ].join("");
  }

  function renderField(field, data) {
    const rawValue = fieldValue(field, data);
    const currentValue = rawValue == null ? "" : String(rawValue);
    const disabled = field.disabled ? ' disabled="disabled"' : "";
    const required = field.required ? '<span class="incident-required">*</span>' : "";
    const title = label(field.label, field.name);

    if (field.type === "textarea") {
      return `
        <div class="incident-field-wrap col-md-12" data-field="${esc(field.name)}">
          <label for="incident_${esc(field.name)}">${esc(title)}${required}</label>
          <textarea id="incident_${esc(field.name)}" class="form-control" data-name="${esc(field.name)}">${esc(currentValue)}</textarea>
        </div>
      `;
    }

    if (field.type === "select" || field.type === "lookup") {
      return `
        <div class="incident-field-wrap col-md-6" data-field="${esc(field.name)}">
          <label for="incident_${esc(field.name)}">${esc(title)}${required}</label>
          <select id="incident_${esc(field.name)}" class="form-control" data-name="${esc(field.name)}"${disabled}>
            ${renderOptionTags(field, data)}
          </select>
        </div>
      `;
    }

    const type = field.type || "text";
    const value = type === "datetime-local" ? toInputDateTime(currentValue) : currentValue;

    return `
      <div class="incident-field-wrap ${type === "text" ? "col-md-6" : "col-md-6"}" data-field="${esc(field.name)}">
        <label for="incident_${esc(field.name)}">${esc(title)}${required}</label>
        <input id="incident_${esc(field.name)}" class="form-control" type="${esc(type)}" data-name="${esc(field.name)}" value="${esc(value)}"${disabled} />
      </div>
    `;
  }

  function buildTabs() {
    return (config.formTabs || [])
      .map((tab) => ({
        id: String(tab.id || "").trim(),
        label: label(tab.label, tab.id),
        fields: (tab.fields || []).map((name) => getField(name)).filter(Boolean),
      }))
      .filter((tab) => tab.id && tab.fields.length);
  }

  function renderForm(data) {
    const tabs = buildTabs();
    if (!tabs.length) return;

    const navHtml = tabs
      .map((tab) => {
        const active = tab.id === state.activeTab ? "active" : "";
        return `<li class="${active}"><a href="#incidentFormTab_${esc(tab.id)}" data-toggle="tab">${esc(tab.label)}</a></li>`;
      })
      .join("");

    const panesHtml = tabs
      .map((tab) => {
        const active = tab.id === state.activeTab ? "tab-pane active" : "tab-pane";
        return `
          <div id="incidentFormTab_${esc(tab.id)}" class="${active}">
            <div class="row">
              ${tab.fields.map((field) => renderField(field, data)).join("")}
            </div>
          </div>
        `;
      })
      .join("");

    $("#incidentFormTabsHost").html(`<ul class="nav nav-tabs incident-form-tabs">${navHtml}</ul>`);
    $("#incidentFormFields").html(`<div class="tab-content">${panesHtml}</div>`);
    bindFormUi();
  }

  function readDraftFromDom() {
    const draft = {};
    getFields().forEach((field) => {
      const $el = $(`#incident_${field.name}`);
      if (!$el.length) return;
      if (field.type === "textarea" || field.type === "text" || field.type === "lookup" || field.type === "select") {
        draft[field.name] = String($el.val() || "");
        return;
      }
      if (field.type === "datetime-local") {
        draft[field.name] = String($el.val() || "");
        return;
      }
      draft[field.name] = $el.val();
    });
    state.draft = draft;
    return draft;
  }

  function buildPayload() {
    const payload = {};
    const draft = readDraftFromDom();
    const missing = [];

    getFields().forEach((field) => {
      if (field.disabled) return;

      let value = draft[field.name];
      if (typeof value === "string") value = value.trim();

      if (field.required && !value) missing.push(label(field.label, field.name));
      if (!value) return;

      if (field.type === "datetime-local") {
        const date = new Date(value);
        payload[field.name] = Number.isNaN(date.getTime()) ? value : date.toISOString();
        return;
      }

      payload[field.name] = value;
    });

    if (missing.length) {
      throw new Error(`${msg("requiredPrefix", "Preencha os campos obrigatórios")}: ${missing.join(", ")}`);
    }

    return payload;
  }

  function badgeHtml(text, colorClass) {
    return `<span class="label ${esc(colorClass || "label-default")}">${esc(text || "-")}</span>`;
  }

  function statusBadgeClass(status) {
    switch (String(status || "")) {
      case "RESOLVED":
        return "label-primary";
      case "CANCELLED":
        return "label-danger";
      case "IN_PROGRESS":
        return "label-warning";
      case "WAITING_CUSTOMER":
      case "WAITING_INTERNAL":
        return "label-success";
      default:
        return "label-default";
    }
  }

  function renderSummary() {
    const row = state.currentRow || {};
    const summaryHtml = `
      <div class="incident-summary-stack">
        <span class="incident-summary-pill"><i class="fa fa-ticket"></i> ${esc(row.number || "INC-......")}</span>
        <span class="incident-summary-pill"><i class="fa fa-flag"></i> ${esc(enumLabel("status", row.status || "NEW"))}</span>
      </div>
      <div class="incident-summary-grid">
        <div class="incident-summary-item">
          <span class="incident-summary-label">${esc(label({ pt: "Prioridade", en: "Priority", es: "Prioridad" }, "Prioridade"))}</span>
          <div class="incident-summary-value">${esc(enumLabel("priority", row.priority || "NORMAL"))}</div>
        </div>
        <div class="incident-summary-item">
          <span class="incident-summary-label">${esc(label({ pt: "Canal", en: "Channel", es: "Canal" }, "Canal"))}</span>
          <div class="incident-summary-value">${esc(enumLabel("channel", row.channel || "PORTAL"))}</div>
        </div>
        <div class="incident-summary-item">
          <span class="incident-summary-label">${esc(label({ pt: "Empresa", en: "Company", es: "Empresa" }, "Empresa"))}</span>
          <div class="incident-summary-value">${esc(row.company?.company_name || "-")}</div>
        </div>
        <div class="incident-summary-item">
          <span class="incident-summary-label">${esc(label({ pt: "Responsável", en: "Owner", es: "Responsable" }, "Responsável"))}</span>
          <div class="incident-summary-value">${esc(row.owner_user?.full_name || "-")}</div>
        </div>
        <div class="incident-summary-item">
          <span class="incident-summary-label">${esc(label({ pt: "Criado em", en: "Created at", es: "Creado el" }, "Criado em"))}</span>
          <div class="incident-summary-value">${esc(formatDateTime(row.created_at))}</div>
        </div>
        <div class="incident-summary-item">
          <span class="incident-summary-label">${esc(label({ pt: "Atualizado em", en: "Updated at", es: "Actualizado el" }, "Atualizado em"))}</span>
          <div class="incident-summary-value">${esc(formatDateTime(row.updated_at))}</div>
        </div>
      </div>
    `;

    $("#incidentSummary").html(summaryHtml);
  }

  function renderTimeline() {
    const $host = $("#incidentTimeline");
    if (!state.id) {
      $host.html(`<div class="incident-empty-state">${esc(msg("saveBeforeTimeline", "Salve o incidente para habilitar a timeline."))}</div>`);
      return;
    }
    if (!Array.isArray(state.timeline) || !state.timeline.length) {
      $host.html(`<div class="incident-empty-state">${esc(msg("noTimeline", "Nenhum evento relacionado ainda."))}</div>`);
      return;
    }

    const html = state.timeline
      .map((item) => {
        const meta = config.timelineMeta?.[item.kind] || { icon: "fa-circle", color: "#1c84c6" };
        const title = label(config.timelineMeta?.[item.kind]?.label, "") || label(config.timelineKind?.[item.kind], "") || "";
        const kindLabel = enumLabel("timelineKind", item.kind);
        const description =
          item.description && typeof item.description === "object" ? JSON.stringify(item.description) : item.description || "";

        return `
          <div class="incident-timeline-item">
            <div class="incident-timeline-icon" style="background:${esc(meta.color)};">
              <i class="fa ${esc(meta.icon)}"></i>
            </div>
            <div class="incident-timeline-content">
              <div class="incident-timeline-title">${esc(item.title || kindLabel || title || item.kind)}</div>
              <div class="incident-timeline-meta">${esc(kindLabel)}${item.subtitle ? ` • ${esc(item.subtitle)}` : ""} • ${esc(formatDateTime(item.occurred_at))}</div>
              ${description ? `<div class="incident-timeline-description">${esc(description)}</div>` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    $host.html(`<div class="incident-timeline-list">${html}</div>`);
  }

  function formatRelatedValue(column, row) {
    const raw = getByPath(row, column.key);
    if (raw == null || raw === "") return "-";
    if (column.enumGroup) return enumLabel(column.enumGroup, raw);
    if (column.format === "datetime") return formatDateTime(raw);
    if (typeof raw === "object") return JSON.stringify(raw);
    return String(raw);
  }

  function renderRelatedTable(def, rows) {
    const columns = Array.isArray(def.columns) ? def.columns : [];
    if (!rows.length) {
      return `<div class="incident-empty-state">${esc(msg("noRecords", "Nenhum registro encontrado."))}</div>`;
    }

    const thead = columns.map((column) => `<th>${esc(label(column.label, column.key))}</th>`).join("");
    const tbody = rows
      .map((row) => {
        const cells = columns.map((column) => `<td>${esc(formatRelatedValue(column, row))}</td>`).join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    return `
      <div class="table-responsive">
        <table class="table table-hover">
          <thead><tr>${thead}</tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    `;
  }

  function renderRelated() {
    const $host = $("#incidentRelated");
    if (!state.id) {
      $host.html(`<div class="incident-empty-state" style="margin-top:16px;">${esc(msg("saveBeforeRelated", "Salve o incidente para visualizar os relacionados."))}</div>`);
      return;
    }

    const related = state.related || {};
    const sections = [];

    Object.entries(config.related || {}).forEach(([key, def]) => {
      const rows = normalizeArray(related[key] || []);
      sections.push(`
        <section class="incident-related-section">
          <div class="incident-related-head">
            <h4 class="incident-related-title">${esc(label(def.title, key))}</h4>
            <span class="incident-related-count">${esc(String(rows.length))}</span>
          </div>
          ${renderRelatedTable(def, rows)}
        </section>
      `);
    });

    const slaInstance = related.sla_instance;
    if (slaInstance) {
      const kpis = normalizeArray(slaInstance.instance_kpis || []);
      const kpiHtml = kpis.length
        ? `<div class="incident-sla-kpi-list">${kpis
            .map(
              (kpi) => `
              <div class="incident-sla-kpi-item">
                <strong>${esc(kpi.sla_kpi?.name || "-")}</strong><br/>
                <span class="text-muted">${esc(enumLabel("slaInstanceStatus", slaInstance.status))}</span><br/>
                <span class="text-muted">${esc(formatDateTime(kpi.target_at))}</span>
              </div>
            `,
            )
            .join("")}</div>`
        : `<div class="incident-empty-state">${esc(msg("noRecords", "Nenhum registro encontrado."))}</div>`;

      sections.push(`
        <section class="incident-related-section">
          <div class="incident-related-head">
            <h4 class="incident-related-title">${esc(label({ pt: "Instância SLA", en: "SLA instance", es: "Instancia SLA" }, "Instância SLA"))}</h4>
            <span class="incident-related-count">${esc(enumLabel("slaInstanceStatus", slaInstance.status))}</span>
          </div>
          <div class="incident-card-body">
            <div class="incident-summary-grid" style="margin-top:0;">
              <div class="incident-summary-item">
                <span class="incident-summary-label">${esc(label({ pt: "Política", en: "Policy", es: "Política" }, "Política"))}</span>
                <div class="incident-summary-value">${esc(slaInstance.sla_policy?.name || "-")}</div>
              </div>
              <div class="incident-summary-item">
                <span class="incident-summary-label">${esc(label({ pt: "Início", en: "Started at", es: "Inicio" }, "Início"))}</span>
                <div class="incident-summary-value">${esc(formatDateTime(slaInstance.started_at))}</div>
              </div>
            </div>
            <div style="margin-top:14px;">${kpiHtml}</div>
          </div>
        </section>
      `);
    }

    $host.html(`<div class="incident-related-grid">${sections.join("") || `<div class="incident-empty-state">${esc(msg("noRecords", "Nenhum registro encontrado."))}</div>`}</div>`);
  }

  function refreshPageChrome() {
    $("#incidentPageTitle").text(label(config.titleSingular, "Incidente"));
    $("#incidentFormCardTitle").text(label(config.detailCardTitle, "Ficha do incidente"));
    $("#incidentFormCardSubtitle").text(label(config.detailCardSubtitle, ""));
    $("#incidentTimelineTitle").text(label(config.timelineTitle, "Timeline"));
    $("#incidentTimelineSubtitle").text(label(config.timelineSubtitle, ""));
    $("#incidentSummaryTitle").text(label(config.summaryTitle, "Resumo"));
    $("#incidentSummarySubtitle").text(label(config.summarySubtitle, ""));
    $("#incidentDetailsTabLink").text(label(config.detailTab, "Detalhes"));
    $("#incidentRelatedTabLink").text(label(config.relatedTab, "Relacionados"));
    $("#btnIncidentBack").text(msg("back", "Voltar"));
    $("#btnIncidentSave").html(`<i class="fa fa-check"></i> ${esc(msg("save", "Salvar"))}`);
    $("#btnIncidentCreateWorkOrder").html(`<i class="fa fa-wrench"></i> ${esc(msg("createWorkOrder", "Gerar work order"))}`);
    $("#btnIncidentDelete").html(`<i class="fa fa-trash"></i> ${esc(msg("delete", "Excluir"))}`);
    $("#btnIncidentNew").html(`<i class="fa fa-plus"></i> ${esc(msg("new", "Novo"))}`);
    $("#pageName").text(label(config.title, "Incidentes"));
    $("#subpageName").text(label(config.title, "Incidentes")).attr("href", page.gridPath || "/servico/incidentes");
    $("#subSecoundPageName").text(label(config.titleSingular, "Incidente"));
    $("#subpathName").text(label(config.titleSingular, "Incidente"));
    $("#subpath").show();
    $("#path").show();
  }

  function updateTabsState() {
    const hasRecord = !!state.id;
    const $relatedTab = $("#incidentRelatedTabLink").closest("li");
    $relatedTab.toggleClass("disabled", !hasRecord);
    $("#btnIncidentCreateWorkOrder").toggle(!!hasRecord);
    $("#btnIncidentDelete").toggle(!!hasRecord);
    $("#btnIncidentNew").toggle(!!hasRecord);
  }

  function bindFormUi() {
    $("#incidentFormTabsHost a[data-toggle='tab']")
      .off("shown.bs.tab")
      .on("shown.bs.tab", function () {
        const href = String($(this).attr("href") || "");
        state.activeTab = href.replace("#incidentFormTab_", "") || state.activeTab;
      });

    $("#incident_company_id")
      .off("change.incidentform")
      .on("change.incidentform", function () {
        state.draft = readDraftFromDom();
        renderForm(state.draft);
      });
  }

  async function loadLookups() {
    const entries = Object.entries(config.lookupSources || {});
    for (const [key, url] of entries) {
      if (!url) continue;
      state.lookups[key] = await fetchLookupRows(url);
    }
  }

  async function loadRecord() {
    if (!state.id) {
      state.currentRow = null;
      state.draft = {};
      return;
    }
    state.currentRow = await api.getJson(`/api/service/incidents/${encodeURIComponent(state.id)}`);
    state.draft = {};
  }

  async function loadTimeline() {
    if (!state.id) {
      state.timeline = [];
      return;
    }
    state.timeline = normalizeArray(await api.getJson(`/api/service/incidents/${encodeURIComponent(state.id)}/timeline`));
  }

  async function loadRelated() {
    if (!state.id) {
      state.related = null;
      return;
    }
    state.related = await api.getJson(`/api/service/incidents/${encodeURIComponent(state.id)}/related`);
  }

  function rerenderAll() {
    renderForm(state.draft);
    renderSummary();
    renderTimeline();
    renderRelated();
    updateTabsState();
    refreshPageChrome();
  }

  async function saveIncident() {
    const $btn = $("#btnIncidentSave");
    const oldHtml = $btn.html();
    $btn.prop("disabled", true).html(`<i class="fa fa-spinner fa-spin"></i> ${esc(msg("saving", "Salvando..."))}`);
    showMessage("", "");

    try {
      const payload = buildPayload();
      const row = state.id
        ? await api.putJson(`/api/service/incidents/${encodeURIComponent(state.id)}`, payload)
        : await api.postJson("/api/service/incidents", payload);

      state.id = String(row?.id || state.id || "").trim() || null;
      if (state.id) {
        const url = `${page.detailPath || "/servico/incidentes/ficha"}?id=${encodeURIComponent(state.id)}`;
        window.history.replaceState({}, "", url);
      }

      await loadRecord();
      await Promise.all([loadTimeline(), loadRelated()]);
      rerenderAll();
      showMessage("success", msg("saveSuccess", "Incidente salvo com sucesso."));
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Não foi possível salvar o incidente.");
    } finally {
      $btn.prop("disabled", false).html(oldHtml);
    }
  }

  async function deleteIncident() {
    if (!state.id) return;
    const confirmed = window.confirm(msg("confirmDelete", "Deseja realmente excluir este incidente?"));
    if (!confirmed) return;

    try {
      await api.deleteJson(`/api/service/incidents/${encodeURIComponent(state.id)}`);
      showMessage("success", msg("deleteSuccess", "Incidente excluído com sucesso."));
      window.location.href = page.gridPath || "/servico/incidentes";
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Não foi possível excluir o incidente.");
    }
  }

  async function createWorkOrder() {
    if (!state.id) return;
    const $btn = $("#btnIncidentCreateWorkOrder");
    const oldHtml = $btn.html();
    $btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Criando...');
    try {
      const response = await api.postJson(`/api/service/incidents/${encodeURIComponent(state.id)}/create-work-order`, {});
      showMessage("success", msg("workOrderCreated", "Work order criada com sucesso."));
      if (response?.id) {
        await loadRelated();
        renderRelated();
      }
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Não foi possível criar a work order.");
    } finally {
      $btn.prop("disabled", false).html(oldHtml);
    }
  }

  function bindPageEvents() {
    $("#btnIncidentBack")
      .off("click")
      .on("click", function () {
        window.location.href = page.gridPath || "/servico/incidentes";
      });

    $("#btnIncidentNew")
      .off("click")
      .on("click", function () {
        window.location.href = page.detailPath || "/servico/incidentes/ficha";
      });

    $("#btnIncidentSave")
      .off("click")
      .on("click", function () {
        saveIncident();
      });

    $("#btnIncidentDelete")
      .off("click")
      .on("click", function () {
        deleteIncident();
      });

    $("#btnIncidentCreateWorkOrder")
      .off("click")
      .on("click", function () {
        createWorkOrder();
      });

    $("#incidentMainTabs a[data-toggle='tab']")
      .off("click.incidentmain")
      .on("click.incidentmain", function (event) {
        const $parent = $(this).closest("li");
        if ($parent.hasClass("disabled")) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      });
  }

  async function init() {
    try {
      await waitForI18nReady(2000);
      refreshPageChrome();
      showMessage("", "");
      await loadLookups();
      await loadRecord();
      await Promise.all([loadTimeline(), loadRelated()]);
      rerenderAll();
      bindPageEvents();
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Não foi possível carregar o incidente.");
    }
  }

  $(document).ready(init);
})();
