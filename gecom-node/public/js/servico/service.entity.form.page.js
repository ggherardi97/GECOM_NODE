(function () {
  const api = window.ServiceApi;
  const shared = window.ServiceResources || {};
  const { waitForI18nReady, textFor, esc, normalizeArray, enumLabel, enumOptions } = shared;
  const cfg = window.__SERVICE_PAGE_CONFIG || {};
  if (!api || !cfg) return;

  const params = new URLSearchParams(window.location.search || "");
  const state = {
    id: String(params.get("id") || "").trim() || null,
    currentRow: null,
    draft: {},
    lookups: {},
    lookupRows: {},
  };

  function tt(value, fallback) {
    return textFor(value, fallback);
  }

  function showMessage(kind, text) {
    const $el = $("#serviceEntityMessage");
    $el.removeClass("is-open alert-success alert-danger alert-warning");
    if (!text) return;
    $el.addClass("is-open");
    $el.addClass(kind === "success" ? "alert-success" : kind === "warning" ? "alert-warning" : "alert-danger");
    $el.text(text);
  }

  function getFields() {
    return Array.isArray(cfg.formFields) ? cfg.formFields : [];
  }

  function getField(name) {
    return getFields().find((field) => String(field?.name || "") === String(name || "")) || null;
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  function resolveSingularTitle() {
    const explicit = tt(cfg.titleSingular, "");
    if (explicit) return explicit;
    const baseTitle = tt(cfg.title, "Registro");
    const cleaned = String(baseTitle || "")
      .replace(/^.*-\s*/, "")
      .replace(/^.*\/\s*/, "")
      .trim();
    return cleaned || "Registro";
  }

  function toInputDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function buildPageChrome() {
    const title = tt(cfg.title, "Servico");
    const singular = resolveSingularTitle();
    const currentTitle = state.id ? singular : `${tt({ pt: "Novo", en: "New", es: "Nuevo" }, "Novo")} ${singular}`.trim();

    $("#serviceEntityPageTitle").text(currentTitle);
    $("#serviceEntityFormTitle").text(singular);
    $("#pageName").text(title);
    $("#subpageName").text(title).attr("href", cfg.gridPath || "/servico/incidentes");
    $("#subSecoundPageName").text(currentTitle);
    $("#subpathName").text(currentTitle);
    $("#btnServiceEntityDelete,#btnServiceEntityNew").toggle(!!state.id);
  }

  function fieldValue(field) {
    if (state.draft[field.name] != null) return state.draft[field.name];
    if (state.currentRow?.[field.name] != null) return state.currentRow[field.name];
    return "";
  }

  async function fetchLookup(field) {
    if (!field.lookup?.url) return [];
    if (state.lookups[field.name]) return state.lookups[field.name];
    const data = await api.getJson(field.lookup.url);
    const rows = normalizeArray(data);
    state.lookups[field.name] = rows;
    return rows;
  }

  function optionLabel(field, row) {
    const labelKey = field.lookup?.labelKey || "name";
    return String(row?.[labelKey] || row?.name || row?.title || row?.company_name || row?.full_name || row?.id || "");
  }

  function renderOptions(field) {
    const current = String(fieldValue(field) || "");
    const options = [];
    options.push(`<option value="">${esc(tt({ pt: "Selecione...", en: "Select...", es: "Selecciona..." }, "Selecione..."))}</option>`);

    if (field.optionsGroup) {
      enumOptions(field.optionsGroup).forEach((item) => {
        const selected = current === item.value ? ' selected="selected"' : "";
        options.push(`<option value="${esc(item.value)}"${selected}>${esc(item.label)}</option>`);
      });
      return options.join("");
    }

    if (Array.isArray(field.options)) {
      field.options.forEach((item) => {
        const selected = current === String(item) ? ' selected="selected"' : "";
        options.push(`<option value="${esc(item)}"${selected}>${esc(item)}</option>`);
      });
      return options.join("");
    }

    const rows = state.lookups[field.name] || [];
    rows.forEach((row) => {
      const value = String(row?.[field.lookup?.valueKey || "id"] || row?.id || "");
      const selected = current === value ? ' selected="selected"' : "";
      options.push(`<option value="${esc(value)}"${selected}>${esc(optionLabel(field, row))}</option>`);
    });
    return options.join("");
  }

  function renderField(field) {
    const value = fieldValue(field);
    const printableValue = field.parseAsJson && value && typeof value === "object" ? JSON.stringify(value, null, 2) : value;
    const disabled = field.disabled ? ' disabled="disabled"' : "";
    const required = field.required ? '<span class="service-entity-required">*</span>' : "";
    const label = tt(field.label, field.name);
    const colClass = field.type === "textarea" ? "col-md-12" : "col-md-6";

    if (field.type === "textarea") {
      return `
        <div class="${colClass} service-entity-field" data-field="${esc(field.name)}">
          <label for="serviceEntity_${esc(field.name)}">${esc(label)}${required}</label>
          <textarea id="serviceEntity_${esc(field.name)}" class="form-control" data-name="${esc(field.name)}">${esc(printableValue || "")}</textarea>
        </div>
      `;
    }

    if (field.type === "checkbox") {
      return `
        <div class="${colClass} service-entity-field" data-field="${esc(field.name)}">
          <label for="serviceEntity_${esc(field.name)}">${esc(label)}${required}</label>
          <div style="padding-top:6px;">
            <label style="font-weight:normal;">
              <input id="serviceEntity_${esc(field.name)}" type="checkbox" data-name="${esc(field.name)}"${value ? ' checked="checked"' : ""}${disabled} />
              ${esc(tt({ pt: "Sim", en: "Yes", es: "Si" }, "Sim"))}
            </label>
          </div>
        </div>
      `;
    }

    if (field.type === "select") {
      return `
        <div class="${colClass} service-entity-field" data-field="${esc(field.name)}">
          <label for="serviceEntity_${esc(field.name)}">${esc(label)}${required}</label>
          <select id="serviceEntity_${esc(field.name)}" class="form-control" data-name="${esc(field.name)}"${disabled}>
            ${renderOptions(field)}
          </select>
        </div>
      `;
    }

    const inputType = field.type || "text";
    const normalizedValue = inputType === "datetime-local" ? toInputDateTime(printableValue) : printableValue;
    return `
      <div class="${colClass} service-entity-field" data-field="${esc(field.name)}">
        <label for="serviceEntity_${esc(field.name)}">${esc(label)}${required}</label>
        <input id="serviceEntity_${esc(field.name)}" class="form-control" type="${esc(inputType)}" data-name="${esc(field.name)}" value="${esc(normalizedValue || "")}"${disabled} />
      </div>
    `;
  }

  async function loadLookups() {
    for (const field of getFields()) {
      if (field.type === "select" && field.lookup?.url) {
        await fetchLookup(field);
      }
    }
  }

  function renderForm() {
    $("#serviceEntityFields").html(getFields().map((field) => renderField(field)).join(""));
    bindFieldEvents();
  }

  function resolveLookupRow(field, selectedValue) {
    const rows = state.lookups[field.name] || [];
    return rows.find((row) => String(row?.[field.lookup?.valueKey || "id"] || row?.id || "") === String(selectedValue || "")) || null;
  }

  function applyLookupCopy(field, selectedValue) {
    if (!Array.isArray(field.onChangeCopyTo) || !field.lookup?.url) return;
    const selectedRow = resolveLookupRow(field, selectedValue);
    if (!selectedRow) return;

    field.onChangeCopyTo.forEach((rule) => {
      const source = rule?.from;
      const target = rule?.to;
      if (!source || !target) return;
      const value = selectedRow?.[source];
      const $target = $(`#serviceEntity_${target}`);
      if (!$target.length || value == null) return;
      if ($target.is(":checkbox")) $target.prop("checked", !!value);
      else $target.val(String(value));
    });
  }

  function bindFieldEvents() {
    $("#serviceEntityForm").off("change", "select");
    $("#serviceEntityForm").on("change", "select", function () {
      const name = String($(this).data("name") || "");
      const field = getField(name);
      if (!field) return;
      applyLookupCopy(field, $(this).val());
    });
  }

  function readPayload() {
    const payload = {};
    const missing = [];

    getFields().forEach((field) => {
      if (field.disabled) return;
      const $el = $(`#serviceEntity_${field.name}`);
      if (!$el.length) return;

      let value;
      if (field.type === "checkbox") value = $el.is(":checked");
      else value = String($el.val() || "").trim();

      if (field.required && (value == null || value === "")) missing.push(tt(field.label, field.name));

      if (value == null || value === "") return;

      if (field.parseAsJson) {
        try {
          payload[field.name] = typeof value === "string" ? JSON.parse(value) : value;
        } catch {
          throw new Error(`JSON invalido no campo ${tt(field.label, field.name)}.`);
        }
        return;
      }

      if (field.type === "checkbox") {
        payload[field.name] = !!value;
        return;
      }
      if (field.type === "number") {
        const asNumber = Number(value);
        payload[field.name] = Number.isFinite(asNumber) ? asNumber : null;
        return;
      }
      if (field.type === "datetime-local") {
        const date = new Date(value);
        payload[field.name] = Number.isNaN(date.getTime()) ? value : date.toISOString();
        return;
      }

      payload[field.name] = value;
    });

    if (missing.length) {
      throw new Error(`${tt({ pt: "Preencha os campos obrigatorios", en: "Fill in the required fields", es: "Complete los campos obligatorios" }, "Preencha os campos obrigatorios")}: ${missing.join(", ")}`);
    }

    return payload;
  }

  function renderSummary() {
    const row = state.currentRow || {};
    const items = [
      { label: tt({ pt: "ID", en: "ID", es: "ID" }, "ID"), value: state.id || "-" },
      { label: tt({ pt: "Criado em", en: "Created at", es: "Creado el" }, "Criado em"), value: formatDateTime(row.created_at) },
      { label: tt({ pt: "Atualizado em", en: "Updated at", es: "Actualizado el" }, "Atualizado em"), value: formatDateTime(row.updated_at) },
    ];

    const customSummary = (cfg.columns || [])
      .slice(0, 4)
      .map((column) => ({ label: tt(column.label, column.key), value: formatFieldSummary(column, row) }))
      .filter((item) => item.value && item.value !== "-");

    const html = items.concat(customSummary).map((item) => `
      <div class="service-entity-summary-item">
        <span class="service-entity-summary-label">${esc(item.label)}</span>
        <div class="service-entity-summary-value">${esc(item.value)}</div>
      </div>
    `).join("");

    $("#serviceEntitySummary").html(html || `<div class="service-entity-empty">${esc(tt({ pt: "Salve para ver o resumo.", en: "Save to view the summary.", es: "Guarda para ver el resumen." }, "Salve para ver o resumo."))}</div>`);
  }

  function formatFieldSummary(column, row) {
    const raw = String(column.key || "")
      .split(".")
      .filter(Boolean)
      .reduce((acc, key) => (acc == null ? null : acc[key]), row);
    if (raw == null || raw === "") return "-";
    if (column.enumGroup) return enumLabel(column.enumGroup, raw, raw);
    if (column.type === "boolean") {
      return raw
        ? tt({ pt: "Sim", en: "Yes", es: "Si" }, "Sim")
        : tt({ pt: "Nao", en: "No", es: "No" }, "Nao");
    }
    if (column.type === "datetime" || column.type === "date") return formatDateTime(raw);
    return typeof raw === "object" ? JSON.stringify(raw) : String(raw);
  }

  function renderLinks() {
    if (!state.id || !Array.isArray(cfg.detailLinks) || !cfg.detailLinks.length) {
      $("#serviceEntityLinks").html(`<div class="service-entity-empty">${esc(tt({ pt: "Salve o registro para habilitar atalhos relacionados.", en: "Save the record to enable related shortcuts.", es: "Guarda el registro para habilitar accesos relacionados." }, "Salve o registro para habilitar atalhos relacionados."))}</div>`);
      return;
    }

    const html = cfg.detailLinks
      .filter((item) => item?.type === "link" && item?.href)
      .map((item) => `<a class="btn btn-default btn-block text-left" href="${esc(String(item.href).replace("{id}", encodeURIComponent(state.id)))}"><i class="fa ${esc(item.icon || "fa-link")}"></i> ${esc(tt(item.label, item.label || "Abrir"))}</a>`)
      .join("");

    $("#serviceEntityLinks").html(html || "");
  }

  async function loadRecord() {
    if (!state.id) {
      state.currentRow = null;
      state.draft = {};
      params.forEach((value, key) => {
        if (key !== "id" && getField(key)) state.draft[key] = value;
      });
      return;
    }
    state.currentRow = await api.getJson(`${cfg.apiPath}/${encodeURIComponent(state.id)}`);
  }

  async function saveRecord() {
    try {
      const payload = readPayload();
      const saved = state.id
        ? await api.putJson(`${cfg.apiPath}/${encodeURIComponent(state.id)}`, payload)
        : await api.postJson(cfg.apiPath, payload);

      const savedId = String(saved?.[cfg.idField || "id"] || saved?.id || state.id || "");
      showMessage("success", tt({ pt: "Registro salvo com sucesso.", en: "Record saved successfully.", es: "Registro guardado con exito." }, "Registro salvo com sucesso."));
      if (!state.id && savedId) {
        window.location.href = `${cfg.editPageUrl.replace("{id}", encodeURIComponent(savedId))}`;
        return;
      }
      state.currentRow = saved;
      state.id = savedId || state.id;
      buildPageChrome();
      renderSummary();
      renderLinks();
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Nao foi possivel salvar o registro.");
    }
  }

  async function deleteRecord() {
    if (!state.id) return;
    if (!window.confirm(tt({ pt: "Deseja realmente excluir este registro?", en: "Do you really want to delete this record?", es: "Desea eliminar este registro?" }, "Deseja realmente excluir este registro?"))) {
      return;
    }
    try {
      await api.deleteJson(`${cfg.apiPath}/${encodeURIComponent(state.id)}`);
      window.location.href = cfg.gridPath || "/servico/incidentes";
    } catch (error) {
      console.error(error);
      showMessage("error", error?.message || "Nao foi possivel excluir o registro.");
    }
  }

  function bindEvents() {
    $("#btnServiceEntityBack").on("click", function () {
      window.location.href = cfg.gridPath || "/servico/incidentes";
    });
    $("#btnServiceEntityNew").on("click", function () {
      window.location.href = cfg.newPageUrl || cfg.detailPath;
    });
    $("#btnServiceEntitySave").on("click", saveRecord);
    $("#btnServiceEntityDelete").on("click", deleteRecord);
    $("#serviceEntityForm").on("submit", function (event) {
      event.preventDefault();
      saveRecord();
    });
  }

  async function init() {
    await waitForI18nReady(2000);
    await loadLookups();
    await loadRecord();
    renderForm();
    buildPageChrome();
    renderSummary();
    renderLinks();
    bindEvents();
  }

  $(document).ready(function () {
    init().catch((error) => {
      console.error(error);
      showMessage("error", error?.message || "Nao foi possivel carregar o registro.");
    });
  });
})();
