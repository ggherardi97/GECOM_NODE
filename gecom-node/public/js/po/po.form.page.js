(function () {
  const {
    resources,
    tt,
    waitForI18nReady,
    esc,
    normalizeArray,
    toMoney,
    toDateBr,
    toDateTimeBr,
    boolLabel,
    portalBrand,
  } = window.PoResources || {};
  const page = window.__poPage || {};
  const config = resources?.[page.key];
  if (!config) return;
  const isConvertBrand = String(portalBrand || "").trim().toLowerCase() === "convert";

  const params = new URLSearchParams(window.location.search || "");
  const RICH_RESOURCE_KEYS = new Set(["projects", "workOrders"]);
  const isRichLayout = RICH_RESOURCE_KEYS.has(String(page.key || "").trim());

  const state = {
    id: String(params.get("id") || "").trim() || null,
    lookups: {},
    currentRow: null,
    timeline: [],
    related: null,
    tabs: [],
    fieldToTab: {},
    manualCodeEnabled: false,
  };

  const RICH_VIEW = {
    projects: {
      formTitle: "Ficha do projeto",
      formSubtitle: "Preencha os dados principais do projeto e acompanhe os vínculos no mesmo contexto.",
      timelineTitle: "Timeline",
      timelineSubtitle: "Eventos, atividades e vínculos do projeto aparecem aqui depois do primeiro save.",
      summaryTitle: "Resumo",
      summarySubtitle: "Visão rápida do projeto, do responsável e do volume operacional.",
      detailsTab: "Detalhes",
      relatedTab: "Relacionados",
      timelineMeta: {
        PROJECT_CREATED: { icon: "fa-rocket", color: "#1c84c6", label: "Projeto criado" },
        PROJECT_COMPLETED: { icon: "fa-flag-checkered", color: "#1ab394", label: "Projeto concluído" },
        PROCESS_LINK: { icon: "fa-random", color: "#f8ac59", label: "Processo vinculado" },
        MILESTONE: { icon: "fa-flag", color: "#23a6d5", label: "Marco" },
        DELIVERABLE: { icon: "fa-dropbox", color: "#1ab394", label: "Entrega" },
        CHECKLIST: { icon: "fa-list-ul", color: "#f8ac59", label: "Checklist" },
        WORK_ORDER: { icon: "fa-wrench", color: "#23c6c8", label: "Work order" },
        EVENT: { icon: "fa-calendar", color: "#ed5565", label: "Evento" },
        APPOINTMENT: { icon: "fa-clock-o", color: "#6f42c1", label: "Atividade" },
      },
      related: {
        project_processes: {
          title: "Processos",
          columns: [
            { key: "process.process_number", label: "Processo" },
            { key: "process.exporter", label: "Exporter" },
            { key: "process.importer", label: "Importer" },
            { key: "created_at", label: "Vinculado em", format: "datetime" },
          ],
        },
        work_orders: {
          title: "Work orders",
          columns: [
            { key: "code", label: "Código" },
            { key: "title", label: "Título" },
            { key: "status.name", label: "Status" },
            { key: "owner_user.full_name", label: "Responsável" },
            { key: "_count.assignments", label: "Recursos" },
            { key: "_count.appointments", label: "Atividades" },
          ],
        },
        milestones: {
          title: "Marcos",
          columns: [
            { key: "title", label: "TÃ­tulo" },
            { key: "status", label: "Status" },
            { key: "due_date", label: "Vencimento", format: "date" },
          ],
        },
        deliverables: {
          title: "Entregas",
          columns: [
            { key: "title", label: "TÃ­tulo" },
            { key: "status.name", label: "Status" },
            { key: "due_date", label: "Vencimento", format: "date" },
            { key: "value_amount", label: "Valor", format: "money" },
          ],
        },
        checklists: {
          title: "Checklists",
          columns: [
            { key: "name", label: "Nome" },
            { key: "_count.items", label: "Itens" },
            { key: "updated_at", label: "Atualizado em", format: "datetime" },
          ],
        },
        events: {
          title: "Eventos",
          columns: [
            { key: "title", label: "Título" },
            { key: "type", label: "Tipo" },
            { key: "status", label: "Status" },
            { key: "start_time", label: "Início", format: "datetime" },
            { key: "finished", label: "Concluído", format: "boolean" },
          ],
        },
        activities: {
          title: "Atividades",
          columns: [
            { key: "appointment.title", label: "Título" },
            { key: "work_order.code", label: "Work order" },
            { key: "appointment.resource.name", label: "Recurso" },
            { key: "appointment.status", label: "Status" },
            { key: "appointment.start_at", label: "Início", format: "datetime" },
            { key: "appointment.end_at", label: "Fim", format: "datetime" },
          ],
        },
      },
    },
    workOrders: {
      formTitle: "Ficha da work order",
      formSubtitle: "Gerencie a execução, o planejamento e os vínculos operacionais em uma única tela.",
      timelineTitle: "Timeline",
      timelineSubtitle: "Eventos, alocações e atividades entram aqui depois do primeiro save.",
      summaryTitle: "Resumo",
      summarySubtitle: "Visão rápida da execução, dos vínculos e da carga operacional.",
      detailsTab: "Detalhes",
      relatedTab: "Relacionados",
      timelineMeta: {
        WORK_ORDER_CREATED: { icon: "fa-plus-circle", color: "#1c84c6", label: "Work order criada" },
        WORK_ORDER_STARTED: { icon: "fa-play", color: "#23c6c8", label: "Execução iniciada" },
        WORK_ORDER_COMPLETED: { icon: "fa-check", color: "#1ab394", label: "Work order concluída" },
        ASSIGNMENT: { icon: "fa-users", color: "#f8ac59", label: "Recurso alocado" },
        APPOINTMENT: { icon: "fa-calendar-check-o", color: "#6f42c1", label: "Atividade" },
        EVENT: { icon: "fa-bell", color: "#ed5565", label: "Evento" },
      },
      related: {
        assignments: {
          title: "Recursos",
          columns: [
            { key: "resource.name", label: "Recurso" },
            { key: "role.name", label: "Função" },
            { key: "allocation_percent", label: "Alocação (%)" },
            { key: "planned_hours", label: "Horas planejadas", format: "money" },
            { key: "created_at", label: "Criado em", format: "datetime" },
          ],
        },
        appointments: {
          title: "Atividades",
          columns: [
            { key: "appointment.title", label: "Título" },
            { key: "appointment.resource.name", label: "Recurso" },
            { key: "appointment.status", label: "Status" },
            { key: "appointment.start_at", label: "Início", format: "datetime" },
            { key: "appointment.end_at", label: "Fim", format: "datetime" },
          ],
        },
        events: {
          title: "Eventos",
          columns: [
            { key: "title", label: "Título" },
            { key: "type", label: "Tipo" },
            { key: "status", label: "Status" },
            { key: "start_time", label: "Início", format: "datetime" },
            { key: "finished", label: "Concluído", format: "boolean" },
          ],
        },
      },
    },
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

  function showMessage(kind, text) {
    const $el = $("#poMessage");
    $el.removeClass("is-open alert-success alert-danger alert-warning");
    if (!text) return;
    $el.addClass("is-open");
    $el.addClass(kind === "success" ? "alert-success" : kind === "warning" ? "alert-warning" : "alert-danger");
    $el.text(text);
  }

  function currentRichView() {
    return RICH_VIEW[page.key] || null;
  }

  function getFormHostSelector() {
    return isRichLayout ? "#poFormFieldsRich" : "#poFormFields";
  }

  function getFormHost() {
    return $(getFormHostSelector());
  }

  function getCurrentAuth() {
    return window.__auth || {};
  }

  function getCurrentCompanyId() {
    const auth = getCurrentAuth();
    const authCompanyId = String(
      auth?.company_id ||
        auth?.companyId ||
        auth?.company?.id ||
        auth?.company?.company_id ||
        auth?.user?.company_id ||
        auth?.user?.companyId ||
        "",
    ).trim();
    if (authCompanyId) return authCompanyId;

    try {
      const raw = localStorage.getItem("currentUser");
      const user = raw ? JSON.parse(raw) : {};
      const localCompanyId = String(user?.company_id || user?.companyId || "").trim();
      if (localCompanyId) return localCompanyId;
    } catch {}

    return String(localStorage.getItem("companyId") || "").trim();
  }

  function getCurrentUserId() {
    const auth = getCurrentAuth();
    const authUserId = String(auth?.id || auth?.user_id || auth?.user?.id || auth?.sub || "").trim();
    if (authUserId) return authUserId;

    try {
      const raw = localStorage.getItem("currentUser");
      const user = raw ? JSON.parse(raw) : {};
      const localUserId = String(user?.id || user?.user_id || "").trim();
      if (localUserId) return localUserId;
    } catch {}

    return String(localStorage.getItem("currentUserId") || "").trim();
  }

  function lookupLabel(item) {
    if (item?.number) {
      const number = String(item.number || "").trim();
      const title = String(item.title || "").trim();
      return title ? `${number} - ${title}` : number;
    }
    return String(
      item?.company_name ||
        item?.incident?.number ||
        item?.process_number ||
        item?.title ||
        item?.name ||
        item?.code ||
        item?.full_name ||
        item?.email ||
        item?.id ||
        "",
    ).trim();
  }

  function translateEnumLabel(enumKey, value) {
    const normalizedEnum = String(enumKey || "").trim();
    const normalizedValue = String(value || "").trim();
    if (!normalizedEnum || !normalizedValue) return normalizedValue;
    return tt(`page.po.enums.${normalizedEnum}.${normalizedValue.toLowerCase()}`, normalizedValue);
  }

  function localizedLookupLabel(lookupKey, item) {
    const key = String(lookupKey || "").trim();
    const code = String(item?.code || "").trim();
    if (key === "projectStatuses") return translateEnumLabel("projectStatus", code || lookupLabel(item));
    if (key === "deliverableStatuses") return translateEnumLabel("deliverableStatus", code || lookupLabel(item));
    if (key === "workOrderStatuses") return translateEnumLabel("workOrderStatus", code || lookupLabel(item));
    return lookupLabel(item);
  }

  function lookupSubtitle(item) {
    if (item?.number) {
      return String(item?.company?.company_name || item?.status || "").trim();
    }
    return String(item?.description || item?.incident?.title || item?.process_number || item?.code || "").trim();
  }

  function normalizeText(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function isIntegerField(field) {
    if (field?.type !== "number") return false;
    return String(field?.step || "") === "1" || /(sort_order|allocation_percent)/i.test(String(field?.name || ""));
  }

  function isMoneyField(field) {
    if (field?.type !== "number") return false;
    if (isIntegerField(field)) return false;
    return /(amount|balance|price|total|hours|value)/i.test(String(field?.name || "")) || String(field?.step || "") === "0.01";
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

  function formatDateTime(value) {
    return toDateTimeBr ? toDateTimeBr(value) : value || "-";
  }

  function formatDateOnly(value) {
    return toDateBr ? toDateBr(value) : value || "-";
  }

  function boolText(value) {
    return typeof boolLabel === "function" ? boolLabel(!!value) : value ? "Sim" : "Não";
  }

  function fieldCount(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? String(n) : "0";
  }

  function workOrderPriorityLabel(value) {
    const normalized = String(value || "").trim().toUpperCase();
    if (!normalized) return "-";
    return translateEnumLabel("priority", normalized);
  }

  function resolveLookupDefaultValue(field) {
    if (!field || field.type !== "lookup" || !field.lookup) return "";
    if (String(field.name || "").trim() === "owner_user_id") {
      const currentUserId = getCurrentUserId();
      const rows = state.lookups[field.lookup] || [];
      const foundCurrentUser = rows.find((item) => String(item?.id || "") === currentUserId);
      if (foundCurrentUser?.id) return String(foundCurrentUser.id);
    }
    const match = field.defaultLookupMatch;
    if (!match || typeof match !== "object") return "";
    const rows = state.lookups[field.lookup] || [];
    const found = rows.find((item) =>
      Object.entries(match).every(([key, expected]) => {
        if (typeof expected === "boolean") return Boolean(item?.[key]) === expected;
        return String(item?.[key] ?? "") === String(expected ?? "");
      }),
    );
    return found?.id ? String(found.id) : "";
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
      return resolveLookupDefaultValue(field);
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
        label: String(tab.label || "page.po.tabs.basic"),
        fields,
      });
    });

    const remaining = allFields.filter((field) => !used.has(String(field.name || "")));
    if (remaining.length) {
      tabs.push({
        id: "extra",
        label: "page.po.tabs.more",
        fields: remaining,
      });
    }

    if (!tabs.length) {
      tabs.push({
        id: "basic",
        label: "page.po.tabs.basic",
        fields: allFields,
      });
    }

    return normalizeTabsForUi(tabs).map((tab, index) => {
      const paneId = `poTab_${tab.id}_${index}`;
      return Object.assign({}, tab, { paneId });
    });
  }

  function normalizeTabsForUi(rawTabs) {
    let tabs = (rawTabs || []).map((tab) => ({
      id: String(tab.id || "").trim() || "tab",
      label: String(tab.label || "page.po.tabs.basic"),
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
    const merged = {
      id: "more",
      label: "page.po.tabs.more",
      fields: tabs.slice(2).flatMap((tab) => tab.fields || []),
    };

    if (merged.fields.length) keep.push(merged);
    return keep;
  }

  function requiredMark(field) {
    return field.required ? `<span class="po-required">*</span>` : "";
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
    const selectedLabel = selected
      ? localizedLookupLabel(field.lookup, selected)
      : rel
        ? localizedLookupLabel(field.lookup, rel)
        : "";
    const req = field.required ? "data-required=\"1\"" : "";

    return `
      <div id="${esc(`${hiddenId}__wrap`)}" class="form-group po-field-wrap" data-field="${esc(field.name)}">
        <label>${esc(label)}${requiredMark(field)}</label>
        <div class="po-lookup-wrap">
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
            placeholder="${esc(tt("page.po.common.lookupPlaceholder", "Clique para ver recentes ou digite para buscar"))}"
          />
          <input id="${esc(hiddenId)}" type="hidden" value="${esc(value || "")}" />
          <div id="${esc(menuId)}" class="po-lookup-menu"></div>
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
        <div id="${esc(`${id}__wrap`)}" class="form-group po-field-wrap" data-field="${esc(field.name)}">
          <label><input id="${esc(id)}" type="checkbox" ${value ? "checked" : ""}/> ${esc(label)}${requiredMark(field)}</label>
        </div>
      `;
    }

    if (field.type === "textarea") {
      return `
        <div id="${esc(`${id}__wrap`)}" class="form-group po-field-wrap" data-field="${esc(field.name)}">
          <label>${esc(label)}${requiredMark(field)}</label>
          <textarea id="${esc(id)}" class="form-control" rows="2" ${required}>${esc(value || "")}</textarea>
        </div>
      `;
    }

    if (field.type === "select") {
      const options = (field.options || []).map((opt) => {
        const selected = String(value || field.defaultValue || "") === String(opt) ? "selected" : "";
        return `<option value="${esc(opt)}" ${selected}>${esc(translateEnumLabel(field.enumKey, opt))}</option>`;
      });
      return `
        <div id="${esc(`${id}__wrap`)}" class="form-group po-field-wrap" data-field="${esc(field.name)}">
          <label>${esc(label)}${requiredMark(field)}</label>
          <select id="${esc(id)}" class="form-control" ${required}>${options.join("")}</select>
        </div>
      `;
    }

    const isMoney = isMoneyField(field);
    const type = isMoney ? "text" : field.type || "text";
    const displayValue = isMoney ? formatMoneyDisplay(value) : value;
    const isManualUnlockField = !!field.manualUnlock;
    const isReadOnly = isManualUnlockField && !state.manualCodeEnabled;
    const actionHtml = isManualUnlockField
      ? `<a href="#" class="po-inline-action js-po-code-unlock" data-target="#${esc(id)}">${esc(
          state.manualCodeEnabled ? "Voltar para automático" : "Digitar manualmente",
        )}</a>`
      : "";
    return `
      <div id="${esc(`${id}__wrap`)}" class="form-group po-field-wrap" data-field="${esc(field.name)}">
        <label>${esc(label)}${requiredMark(field)}</label>
        <input
          id="${esc(id)}"
          class="form-control"
          type="${esc(type)}"
          value="${esc(displayValue || "")}"
          ${isReadOnly ? "readonly" : ""}
          ${isReadOnly && field.autoPlaceholder ? `placeholder="${esc(field.autoPlaceholder)}"` : ""}
          ${field.step ? `step="${esc(field.step)}"` : ""}
          ${required}
        />
        ${actionHtml}
      </div>
    `;
  }

  function fieldColumnClass(field) {
    if (field.type === "textarea" || field.type === "checkbox") return "col-md-12";
    return "col-md-6";
  }

  function renderFormTabs(row) {
    const tabs = buildFormTabs();
    state.tabs = tabs;
    state.fieldToTab = {};
    tabs.forEach((tab) => {
      tab.fields.forEach((field) => {
        state.fieldToTab[String(field.name || "")] = tab.paneId;
      });
    });

    const nav = tabs
      .map((tab, idx) => {
        const active = idx === 0 ? "active" : "";
        return `<li class="${active}"><a href="#${esc(tab.paneId)}" data-toggle="tab">${esc(tt(tab.label, tab.id))}</a></li>`;
      })
      .join("");

    const panes = tabs
      .map((tab, idx) => {
        const active = idx === 0 ? "tab-pane active" : "tab-pane";
        const fieldsHtml = tab.fields
          .map((field) => {
            const html = field.type === "lookup" ? renderLookupField(field, row, "ff") : renderNormalField(field, row, "ff");
            const dividerHtml = field.sectionDividerBefore
              ? `<div class="col-md-12"><div class="po-form-divider"><span>${esc(field.sectionDividerBefore)}</span></div></div>`
              : "";
            return `${dividerHtml}<div class="${fieldColumnClass(field)}">${html}</div>`;
          })
          .join("");
        return `<div class="${active}" id="${esc(tab.paneId)}"><div class="row">${fieldsHtml}</div></div>`;
      })
      .join("");

    return `
      <ul class="nav nav-tabs po-form-tabs" id="poFormTabs">${nav}</ul>
      <div class="tab-content po-tab-content">${panes}</div>
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
      $menu.html(`<div class="po-lookup-empty">${esc(tt("page.po.common.lookupEmpty", "Nenhum registro encontrado."))}</div>`).show();
      return;
    }
    const html = rows
      .map((item) => {
        const label = lookupLabel(item);
        const localizedLabel = localizedLookupLabel(lookupKey, item);
        const subtitle = lookupSubtitle(item);
        return `<div class="po-lookup-item" data-id="${esc(item.id)}" data-label="${esc(localizedLabel)}">
          <div><strong>${esc(localizedLabel || label || item.id || "-")}</strong></div>
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

      const lookupKey = String($input.data("lookup") || "").trim();
      const targetSelector = String($input.data("target") || "").trim();
      const menuSelector = String($input.data("menu") || "").trim();
      const $hidden = $scope.find(targetSelector);
      const $menu = $scope.find(menuSelector);
      let timer = null;

      function clearSelected() {
        $hidden.val("");
      }

      function markValid() {
        $input.removeClass("po-invalid");
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

      $menu.on("mousedown.finlookup", ".po-lookup-item", function (event) {
        event.preventDefault();
        const id = String($(this).data("id") || "").trim();
        const label = String($(this).data("label") || "").trim();
        if (!id) return;
        $hidden.val(id);
        $input.val(label || id);
        $input.removeClass("po-invalid");
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
    if (isInvalid) $control.addClass("po-invalid");
    else $control.removeClass("po-invalid");
  }

  function activateTabByField(fieldName) {
    const paneId = state.fieldToTab[String(fieldName || "")];
    if (!paneId) return;
    setActiveTabByPane(paneId);
  }

  function setActiveTabByPane(paneId) {
    const id = String(paneId || "").trim();
    if (!id) return;
    $("#poFormTabs li").removeClass("active");
    $(`#poFormTabs a[href="#${id}"]`).closest("li").addClass("active");
    $(".po-tab-content .tab-pane").removeClass("active");
    $(`#${id}`).addClass("active");
  }

  function bindTabClicks($scope) {
    const $tabs = $scope.find("#poFormTabs a[href^=\"#poTab_\"]");
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
      throw new Error(`${tt("page.po.common.fillRequired", "Preencha os campos obrigatorios")}: ${names}`);
    }

    return payload;
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

  function bindManualCodeToggle($scope) {
    $scope
      .find(".js-po-code-unlock")
      .off("click.pocode")
      .on("click.pocode", function (event) {
        event.preventDefault();
        const $target = $scope.find(String($(this).data("target") || ""));
        const currentValue = $target.length ? String($target.val() || "").trim() : "";
        if (state.manualCodeEnabled && !currentValue && !state.id) {
          state.manualCodeEnabled = false;
        } else {
          state.manualCodeEnabled = !state.manualCodeEnabled;
        }
        renderMainForm(state.currentRow || {});
        const $nextTarget = $scope.find(String($(this).data("target") || ""));
        if (state.manualCodeEnabled && $nextTarget.length) {
          $nextTarget.trigger("focus");
        }
      });
  }

  async function loadLookups() {
    const sources = config.lookupSources || {};
    for (const [key, url] of Object.entries(sources)) {
      try {
        if (key === "users") {
          const companyId = getCurrentCompanyId();
          if (companyId) {
            const company = await api(`/api/companies/${encodeURIComponent(companyId)}`);
            state.lookups[key] = normalizeArray(company?.users || []).filter((row) => String(row?.status || "").toUpperCase() !== "INACTIVE");
            continue;
          }
        }

        if (key === "incidents") {
          state.lookups[key] = normalizeArray(await api("/api/service/incidents"));
          continue;
        }

        state.lookups[key] = normalizeArray(await api(url));
      } catch {
        state.lookups[key] = [];
      }
    }
  }

  async function ensurePoDefaults() {
    if (!String(config?.apiBase || "").includes("/project-operations/")) return;
    try {
      await api("/api/project-operations/setup-defaults", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
    } catch (error) {
      console.warn("PO defaults setup skipped:", error);
    }
  }

  function renderMainForm(row) {
    const fields = config.formFields || [];
    const $host = getFormHost();
    $host.html(renderFormTabs(row || {}));
    bindTabClicks($host);
    bindLookupWidgets($host, "ff", fields);
    bindMoneyMasks($host, "ff", fields);
    bindValidationClear($host, "ff", fields);
    bindManualCodeToggle($host);
  }

  async function loadById(id) {
    state.currentRow = await api(`${config.apiBase}/${encodeURIComponent(id)}`);
  }

  async function loadTimeline() {
    if (!isRichLayout || !state.id) {
      state.timeline = [];
      return;
    }
    try {
      state.timeline = normalizeArray(await api(`${config.apiBase}/${encodeURIComponent(state.id)}/timeline`));
    } catch (error) {
      console.warn("PO timeline unavailable:", error);
      state.timeline = [];
    }
  }

  async function loadRelated() {
    if (!isRichLayout || !state.id) {
      state.related = null;
      return;
    }
    try {
      state.related = await api(`${config.apiBase}/${encodeURIComponent(state.id)}/related`);
    } catch (error) {
      console.warn("PO related unavailable:", error);
      state.related = null;
    }
  }

  function updateLayoutMode() {
    if (isRichLayout) {
      $("#poRichLayout").show();
      $("#poSimpleLayout").hide();
      return;
    }
    $("#poRichLayout").hide();
    $("#poSimpleLayout").show();
  }

  function getByPath(obj, path) {
    return String(path || "")
      .split(".")
      .filter(Boolean)
      .reduce((acc, key) => (acc == null ? null : acc[key]), obj);
  }

  function summaryItemsForCurrentRow() {
    const row = state.currentRow || {};
    if (page.key === "projects") {
      return {
        pills: [
          { icon: "fa-folder-open", text: row.code || "PRJ-..." },
          { icon: "fa-flag", text: row.status?.name || "Sem status" },
        ],
        items: [
          { label: "Projeto", value: row.name || "-" },
          { label: "Empresa", value: row.company?.company_name || "-" },
          { label: "Responsável", value: row.owner_user?.full_name || "-" },
          { label: "Início", value: formatDateOnly(row.start_date) },
          { label: "Fim alvo", value: formatDateOnly(row.target_end_date) },
          { label: "Fim real", value: formatDateOnly(row.actual_end_date) },
          { label: "Marcos", value: fieldCount(row?._count?.milestones) },
          { label: "Entregas", value: fieldCount(row?._count?.deliverables) },
          { label: "Checklists", value: fieldCount(row?._count?.checklists) },
          { label: "Work orders", value: fieldCount(row?._count?.work_orders) },
        ].filter((item) => !(isConvertBrand && item.label === "Processos")),
      };
    }

    return {
      pills: [
        { icon: "fa-wrench", text: row.code || "WO-..." },
        { icon: "fa-bolt", text: workOrderPriorityLabel(row.priority || "MEDIUM") },
      ],
      items: [
        { label: "Título", value: row.title || "-" },
        { label: "Status", value: row.status?.name || "-" },
        { label: "Responsável", value: row.owner_user?.full_name || "-" },
        { label: "Projeto", value: row.project?.name || row.project?.code || "-" },
        { label: "Incidente", value: row.incident?.number || "-" },
        { label: "Início planejado", value: formatDateTime(row.planned_start) },
        { label: "Fim planejado", value: formatDateTime(row.planned_end) },
        { label: "Recursos", value: fieldCount(row?._count?.assignments) },
        { label: "Atividades", value: fieldCount(row?._count?.appointments) },
      ].filter((item) => !(isConvertBrand && item.label === "Processo")),
    };
  }

  function renderSummary() {
    if (!isRichLayout) return;
    const data = summaryItemsForCurrentRow();
    const pills = (data.pills || [])
      .map((item) => `<span class="po-summary-pill"><i class="fa ${esc(item.icon || "fa-circle")}"></i> ${esc(item.text || "-")}</span>`)
      .join("");
    const items = (data.items || [])
      .map(
        (item) => `
          <div class="po-summary-item">
            <span class="po-summary-label">${esc(item.label || "-")}</span>
            <div class="po-summary-value">${esc(item.value || "-")}</div>
          </div>
        `,
      )
      .join("");

    $("#poSummary").html(`
      <div class="po-summary-stack">${pills}</div>
      <div class="po-summary-grid">${items}</div>
    `);
  }

  function renderTimeline() {
    if (!isRichLayout) return;
    const $host = $("#poTimeline");
    const richView = currentRichView();
    if (!state.id) {
      $host.html(`<div class="po-empty-state">${esc("Salve o registro para habilitar a timeline.")}</div>`);
      return;
    }
    if (!Array.isArray(state.timeline) || !state.timeline.length) {
      $host.html(`<div class="po-empty-state">${esc("Nenhum evento relacionado ainda.")}</div>`);
      return;
    }

    const html = state.timeline
      .filter((item) => !(isConvertBrand && item.kind === "PROCESS_LINK"))
      .map((item) => {
        const meta = richView?.timelineMeta?.[item.kind] || { icon: "fa-circle", color: "#1c84c6", label: item.kind };
        const description = item.description && typeof item.description === "object" ? JSON.stringify(item.description) : item.description || "";
        return `
          <div class="po-timeline-item">
            <div class="po-timeline-icon" style="background:${esc(meta.color)};">
              <i class="fa ${esc(meta.icon)}"></i>
            </div>
            <div class="po-timeline-content">
              <div class="po-timeline-title">${esc(item.title || meta.label || item.kind || "-")}</div>
              <div class="po-timeline-meta">${esc(meta.label || item.kind || "-")}${item.subtitle ? ` • ${esc(item.subtitle)}` : ""} • ${esc(formatDateTime(item.occurred_at))}</div>
              ${description ? `<div class="po-timeline-description">${esc(description)}</div>` : ""}
            </div>
          </div>
        `;
      })
      .join("");

    $host.html(`<div class="po-timeline-list">${html}</div>`);
  }

  function formatRelatedValue(column, row) {
    const raw = getByPath(row, column.key);
    if (raw == null || raw === "") return "-";
    if (column.format === "datetime") return formatDateTime(raw);
    if (column.format === "date") return formatDateOnly(raw);
    if (column.format === "money") return toMoney ? toMoney(raw) : String(raw);
    if (column.format === "boolean") return boolText(raw);
    if (typeof raw === "object") return JSON.stringify(raw);
    return String(raw);
  }

  function renderRelatedTable(def, rows) {
    const columns = Array.isArray(def.columns) ? def.columns : [];
    if (!rows.length) {
      return `<div class="po-empty-state">${esc("Nenhum registro encontrado.")}</div>`;
    }

    const thead = columns.map((column) => `<th>${esc(column.label || column.key)}</th>`).join("");
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
    if (!isRichLayout) return;
    const $host = $("#poRelated");
    const richView = currentRichView();
    if (!state.id) {
      $host.html(`<div class="po-empty-state" style="margin-top:16px;">${esc("Salve o registro para visualizar os relacionados.")}</div>`);
      return;
    }

    const related = state.related || {};
    const sections = Object.entries(richView?.related || {})
      .filter(([key]) => !(isConvertBrand && key === "project_processes"))
      .map(([key, def]) => {
      const normalizedDef = def;
      const rows = normalizeArray(related[key] || []);
      return `
        <section class="po-related-section">
          <div class="po-related-head">
            <h4 class="po-related-title">${esc(normalizedDef.title || key)}</h4>
            <span class="po-related-count">${esc(String(rows.length))}</span>
          </div>
          ${renderRelatedTable(normalizedDef, rows)}
        </section>
      `;
    });

    $host.html(`<div class="po-related-grid">${sections.join("") || `<div class="po-empty-state">${esc("Nenhum registro encontrado.")}</div>`}</div>`);
  }

  function updateButtonsState() {
    const hasRecord = !!state.id;
    $("#btnPoDelete").toggle(hasRecord);
    $("#btnPoNew").toggle(hasRecord);
    if (isRichLayout) {
      const $relatedTab = $("#poRelatedTabLink").closest("li");
      $relatedTab.toggle(hasRecord).toggleClass("disabled", !hasRecord);
      if (!hasRecord) {
        $("#poTab_related").removeClass("active");
        $("#poTab_details").addClass("active");
        $("#poMainTabs li").removeClass("active");
        $("#poDetailsTabLink").closest("li").addClass("active");
      }
    }
  }

  function refreshRichChrome() {
    if (!isRichLayout) return;
    const richView = currentRichView();
    $("#poFormCardTitle").text(richView?.formTitle || tt(page.titleKey, "Registro"));
    $("#poFormCardSubtitle").text(richView?.formSubtitle || tt("page.po.common.quickEditHint", ""));
    $("#poTimelineTitle").text(richView?.timelineTitle || "Timeline");
    $("#poTimelineSubtitle").text(richView?.timelineSubtitle || "");
    $("#poSummaryTitle").text(richView?.summaryTitle || "Resumo");
    $("#poSummarySubtitle").text(richView?.summarySubtitle || "");
    $("#poDetailsTabLink").text(richView?.detailsTab || "Detalhes");
    $("#poRelatedTabLink").text(richView?.relatedTab || "Relacionados");
  }

  function bindMainTabs() {
    if (!isRichLayout) return;
    $("#poMainTabs a[data-toggle='tab']")
      .off("click.pomain")
      .on("click.pomain", function (event) {
        const $parent = $(this).closest("li");
        if ($parent.hasClass("disabled")) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
      });
  }

  function rerenderAll() {
    renderMainForm(state.currentRow || {});
    refreshRichChrome();
    renderSummary();
    renderTimeline();
    renderRelated();
    updateButtonsState();
  }

  $("#btnPoBack").on("click", function () {
    window.location.href = page.gridPath;
  });

  $("#btnPoNew").on("click", function () {
    window.location.href = page.formPath;
  });

  $("#btnPoSave").on("click", async function () {
    const $btn = $(this);
    const oldHtml = $btn.html();
    $btn.prop("disabled", true).html('<i class="fa fa-spinner fa-spin"></i> Salvando...');
    showMessage("", "");

    try {
      const $scope = getFormHost();
      const payload = collectPayload(config.formFields || [], "ff", $scope, true);
      const isEdit = !!state.id;
      if (!isEdit && config.forceActiveOnCreate === true) {
        payload.is_active = true;
      }

      const saved = await api(isEdit ? `${config.apiBase}/${encodeURIComponent(state.id)}` : config.apiBase, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      state.id = String(saved?.id || state.id || "").trim() || null;
      if (state.id) {
        window.history.replaceState({}, "", `${page.formPath}?id=${encodeURIComponent(state.id)}`);
        await loadById(state.id);
      } else {
        state.currentRow = saved || null;
      }

      await Promise.all([loadTimeline(), loadRelated()]);
      rerenderAll();
      showMessage("success", "Registro salvo com sucesso.");
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Erro ao salvar.");
    } finally {
      $btn.prop("disabled", false).html(oldHtml);
    }
  });

  $("#btnPoDelete").on("click", async function () {
    if (!state.id) return;
    const ok = await askConfirm(tt("page.po.common.confirmDeleteOne", "Deseja excluir este registro?"));
    if (!ok) return;
    showMessage("", "");
    try {
      await api(`${config.apiBase}/${encodeURIComponent(state.id)}`, { method: "DELETE" });
      window.location.href = page.gridPath;
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Erro ao excluir.");
    }
  });

  $(document).ready(async function () {
    try {
      if (typeof waitForI18nReady === "function") await waitForI18nReady();
      $("#pageName").text(tt(page.titleKey, "Project & Operations"));
      $("#subpageName").text(tt(page.titleKey, "Project & Operations")).attr("href", page.gridPath);
      updateLayoutMode();
      bindMainTabs();
      await ensurePoDefaults();
      await loadLookups();

      if (state.id) {
        await loadById(state.id);
      }
      await Promise.all([loadTimeline(), loadRelated()]);
      rerenderAll();
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Não foi possível carregar o registro.");
    }
  });
})();
