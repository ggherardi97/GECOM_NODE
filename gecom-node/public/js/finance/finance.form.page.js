(function () {
  const { resources, tt, waitForI18nReady, esc, normalizeArray, toMoney, toDateBr, toDateTimeBr, boolLabel, enumLabel } = window.FinanceResources || {};
  const page = window.__financePage || {};
  const config = resources?.[page.key];
  if (!config) return;

  const params = new URLSearchParams(window.location.search || "");
  const state = {
    id: String(params.get("id") || "").trim() || null,
    lookups: {},
    currentRow: null,
    payments: [],
    tabs: [],
    fieldToTab: {},
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
    return String(item?.description || item?.document_number || item?.reference || item?.email || "").trim();
  }

  function translateEnumLabel(enumKey, value, fallback) {
    if (typeof enumLabel === "function") return enumLabel(enumKey, value, fallback);
    return fallback || value || "";
  }

  function resolveLookupDefaultValue(field) {
    if (!field || field.type !== "lookup" || !field.lookup) return "";
    const match = field.defaultLookupMatch;
    if (!match || typeof match !== "object") return "";
    const rows = state.lookups[field.lookup] || [];
    const found = rows.find((item) =>
      Object.entries(match).every(([key, expected]) => String(item?.[key] ?? "").toUpperCase() === String(expected ?? "").toUpperCase()),
    );
    return found?.id ? String(found.id) : "";
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
        label: String(tab.label || "page.finance.tabs.basic"),
        fields,
      });
    });

    const remaining = allFields.filter((field) => !used.has(String(field.name || "")));
    if (remaining.length) {
      tabs.push({
        id: "extra",
        label: "page.finance.tabs.more",
        fields: remaining,
      });
    }

    if (!tabs.length) {
      tabs.push({
        id: "basic",
        label: "page.finance.tabs.basic",
        fields: allFields,
      });
    }

    const normalized = normalizeTabsForUi(tabs);
    return normalized.map((tab, index) => {
      const paneId = `financeTab_${tab.id}_${index}`;
      return Object.assign({}, tab, { paneId });
    });
  }

  function normalizeTabsForUi(rawTabs) {
    let tabs = (rawTabs || []).map((tab) => ({
      id: String(tab.id || "").trim() || "tab",
      label: String(tab.label || "page.finance.tabs.basic"),
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
      label: "page.finance.tabs.more",
      fields: [],
    };
    rest.forEach((tab) => {
      merged.fields = merged.fields.concat(tab.fields || []);
    });

    if (merged.fields.length) keep.push(merged);
    return keep;
  }

  function requiredMark(field) {
    return field.required ? `<span class="finance-required">*</span>` : "";
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
      <div id="${esc(`${hiddenId}__wrap`)}" class="form-group finance-field-wrap" data-field="${esc(field.name)}">
        <label>${esc(label)}${requiredMark(field)}</label>
        <div class="finance-lookup-wrap">
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
            placeholder="${esc(tt("page.finance.common.lookupPlaceholder", "Clique para ver recentes ou digite para buscar"))}"
          />
          <input id="${esc(hiddenId)}" type="hidden" value="${esc(value || "")}" />
          <div id="${esc(menuId)}" class="finance-lookup-menu"></div>
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
        <div id="${esc(`${id}__wrap`)}" class="form-group finance-field-wrap" data-field="${esc(field.name)}">
          <label><input id="${esc(id)}" type="checkbox" ${value ? "checked" : ""}/> ${esc(label)}${requiredMark(field)}</label>
        </div>
      `;
    }

    if (field.type === "textarea") {
      return `
        <div id="${esc(`${id}__wrap`)}" class="form-group finance-field-wrap" data-field="${esc(field.name)}">
          <label>${esc(label)}${requiredMark(field)}</label>
          <textarea id="${esc(id)}" class="form-control" rows="2" ${required}>${esc(value || "")}</textarea>
        </div>
      `;
    }

    if (field.type === "select") {
      const options = (field.options || []).map((opt) => {
        const selected = String(value || field.defaultValue || "") === String(opt) ? "selected" : "";
        return `<option value="${esc(opt)}" ${selected}>${esc(translateEnumLabel(field.enumKey, opt, opt))}</option>`;
      });
      return `
        <div id="${esc(`${id}__wrap`)}" class="form-group finance-field-wrap" data-field="${esc(field.name)}">
          <label>${esc(label)}${requiredMark(field)}</label>
          <select id="${esc(id)}" class="form-control" ${required}>${options.join("")}</select>
        </div>
      `;
    }

    const isMoney = isMoneyField(field);
    const type = isMoney ? "text" : field.type || "text";
    const displayValue = isMoney ? formatMoneyDisplay(value) : value;
    return `
      <div id="${esc(`${id}__wrap`)}" class="form-group finance-field-wrap" data-field="${esc(field.name)}">
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

  function fieldColumnClass(field, options) {
    const opts = options || {};
    if (field?.colClass) return field.colClass;
    const span = Number(field?.boxSpan || field?.span || 0);
    if (span === 12) return "col-sm-12";
    if (span === 6) return "col-sm-6";
    if (span === 4) return "col-sm-4";
    if (field.type === "textarea") return "col-md-12";
    if (field.type === "checkbox") return "col-md-12";
    if (opts.boxLayout && config.layout === "bank-account-rich") return "col-md-6 col-sm-12";
    if (opts.boxLayout) return "col-sm-12";
    return "col-md-6";
  }

  function getFieldsByNames(fieldNames) {
    const source = Array.isArray(config.formFields) ? config.formFields : [];
    const byName = new Map(source.map((field) => [String(field.name || ""), field]));
    return (fieldNames || []).map((name) => byName.get(String(name || ""))).filter(Boolean);
  }

  function renderFieldsGrid(fields, row, prefix, options) {
    return (fields || [])
      .map((field) => {
        const html = field.type === "lookup" ? renderLookupField(field, row, prefix) : renderNormalField(field, row, prefix);
        return `<div class="${fieldColumnClass(field, options)}">${html}</div>`;
      })
      .join("");
  }

  function renderBoxLayout(row) {
    const boxes = Array.isArray(config.layoutBoxes) ? config.layoutBoxes : [];
    const cols = boxes
      .map((box) => {
        const fields = getFieldsByNames(box.fields);
        const colClass =
          config.layout === "bank-account-rich"
            ? "col-lg-12 col-md-12 col-sm-12 finance-box-col"
            : "col-lg-4 col-md-4 col-sm-12 finance-box-col";
        return `
          <div class="${colClass}">
            <section class="finance-box">
              <div class="finance-box-head">
                <h4>${esc(tt(box.title, box.id || "Box"))}</h4>
              </div>
              <div class="finance-box-body">
                <div class="row">${renderFieldsGrid(fields, row || {}, "ff", { boxLayout: true, boxId: box.id })}</div>
              </div>
            </section>
          </div>
        `;
      })
      .join("");
    return `<div class="row finance-box-grid">${cols}</div>`;
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
            return `<div class="${fieldColumnClass(field)}">${html}</div>`;
          })
          .join("");
        return `<div class="${active}" id="${esc(tab.paneId)}"><div class="row">${fieldsHtml}</div></div>`;
      })
      .join("");

    return `
      <ul class="nav nav-tabs finance-form-tabs" id="financeFormTabs">${nav}</ul>
      <div class="tab-content finance-tab-content">${panes}</div>
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
      $menu.html(`<div class="finance-lookup-empty">${esc(tt("page.finance.common.lookupEmpty", "Nenhum registro encontrado."))}</div>`).show();
      return;
    }
    const html = rows
      .map((item) => {
        const label = lookupLabel(item);
        const subtitle = lookupSubtitle(item);
        return `<div class="finance-lookup-item" data-id="${esc(item.id)}" data-label="${esc(label)}">
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
        $input.removeClass("finance-invalid");
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

      $menu.on("mousedown.finlookup", ".finance-lookup-item", function (event) {
        event.preventDefault();
        const id = String($(this).data("id") || "").trim();
        const label = String($(this).data("label") || "").trim();
        if (!id) return;
        $hidden.val(id);
        $input.val(label || id);
        $input.removeClass("finance-invalid");
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
    if (isInvalid) $control.addClass("finance-invalid");
    else $control.removeClass("finance-invalid");
  }

  function activateTabByField(fieldName) {
    const paneId = state.fieldToTab[String(fieldName || "")];
    if (!paneId) return;
    setActiveTabByPane(paneId);
  }

  function setActiveTabByPane(paneId) {
    const id = String(paneId || "").trim();
    if (!id) return;
    $("#financeFormTabs li").removeClass("active");
    $(`#financeFormTabs a[href="#${id}"]`).closest("li").addClass("active");
    $(".finance-tab-content .tab-pane").removeClass("active");
    $(`#${id}`).addClass("active");
  }

  function bindTabClicks($scope) {
    const $tabs = $scope.find("#financeFormTabs a[href^=\"#financeTab_\"]");
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
      throw new Error(`${tt("page.finance.common.fillRequired", "Preencha os campos obrigatorios")}: ${names}`);
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
    const useBoxLayout = config.layout === "three-box" || config.layout === "bank-account-rich";
    $("#financeFormFields").html(useBoxLayout ? renderBoxLayout(row || {}) : renderFormTabs(row || {}));
    const $scope = $("#financeFormFields");
    if (!useBoxLayout) bindTabClicks($scope);
    bindLookupWidgets($scope, "ff", fields);
    bindMoneyMasks($scope, "ff", fields);
    bindValidationClear($scope, "ff", fields);
    bindRecurringVisibility($scope);
    renderAsidePanel(row || {});
  }

  function bindRecurringVisibility($scope) {
    const $toggle = $scope.find("#ff_recurrence_enabled");
    if (!$toggle.length) return;
    const targets = [
      "recurrence_frequency",
      "recurrence_interval",
      "recurrence_day_of_month",
      "recurrence_occurrences",
      "recurrence_end_date",
    ];
    const sync = function () {
      const active = $toggle.is(":checked");
      targets.forEach((fieldName) => {
        const $wrap = $scope.find(`#ff_${fieldName}__wrap`).closest(".col-md-6, .col-md-12");
        $wrap.toggle(active);
      });
    };
    $toggle.off("change.finrec").on("change.finrec", sync);
    sync();
  }

  function formatDateOnly(value) {
    return toDateBr ? toDateBr(value) : value || "-";
  }

  function buildBankAccountActivity(row) {
    const movements = normalizeArray(row?.movements || []).map((item) => ({
      kind: "movement",
      badge: tt("page.finance.activity.bankMovement", "Movimento"),
      title: item?.description || tt("page.finance.activity.bankMovement", "Movimento bancário"),
      subtitle: [item?.category?.name, item?.cost_center?.name].filter(Boolean).join(" • "),
      date: item?.movement_date,
      amount: item?.amount,
      direction: item?.movement_type,
    }));
    const receivablePayments = normalizeArray(row?.receivable_payments || []).map((item) => ({
      kind: "receivable",
      badge: tt("page.finance.activity.receivable", "Recebimento"),
      title: item?.receivable?.title_number || tt("page.finance.activity.receivable", "Recebimento"),
      subtitle: item?.receivable?.company?.company_name || item?.reference || "",
      date: item?.payment_date,
      amount: item?.amount,
      direction: "CREDIT",
    }));
    const payablePayments = normalizeArray(row?.payable_payments || []).map((item) => ({
      kind: "payable",
      badge: tt("page.finance.activity.payable", "Pagamento"),
      title: item?.payable?.payable_number || tt("page.finance.activity.payable", "Pagamento"),
      subtitle: item?.payable?.company?.company_name || item?.reference || "",
      date: item?.payment_date,
      amount: item?.amount,
      direction: "DEBIT",
    }));
    return movements
      .concat(receivablePayments, payablePayments)
      .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime())
      .slice(0, 20);
  }

  function renderAsidePanel(row) {
    const $aside = $("#financeAsidePanel");
    const $grid = $(".finance-rich-grid");
    if (!$aside.length) return;

    if (config.layout !== "bank-account-rich") {
      $aside.hide().empty();
      $grid.removeClass("has-aside");
      return;
    }

    if (!state.id) {
      $grid.removeClass("has-aside");
      $aside.hide().html(`<div class="finance-box-empty">${esc(tt("page.finance.common.saveBeforeRelated", "Salve o registro para visualizar movimentações e liquidações associadas."))}</div>`);
      return;
    }

    const activity = buildBankAccountActivity(row);
    const itemsHtml = activity.length
      ? activity
          .map((item) => {
            const amount = item.amount != null ? toMoney(item.amount) : "-";
            const directionLabel =
              item.direction === "CREDIT"
                ? tt("page.finance.common.credit", "Crédito")
                : item.direction === "DEBIT"
                  ? tt("page.finance.common.debit", "Débito")
                  : "";
            return `
              <div class="finance-activity-item">
                <div class="finance-activity-badge">${esc(item.badge || "-")}</div>
                <div class="finance-activity-meta">
                  <span>${esc(formatDateOnly(item.date))}</span>
                  <span>${esc(directionLabel)} ${esc(amount)}</span>
                </div>
                <div class="finance-activity-title">${esc(item.title || "-")}</div>
                ${item.subtitle ? `<div class="finance-activity-subtitle">${esc(item.subtitle)}</div>` : ""}
              </div>
            `;
          })
          .join("")
      : `<div class="finance-box-empty">${esc(tt("page.finance.common.noRelatedActivity", "Nenhuma transação associada encontrada."))}</div>`;

    $aside
      .show()
      .html(`
        <section class="finance-box">
          <div class="finance-box-head">
            <h4>${esc(tt("page.finance.boxes.relatedActivity", "Movimentações associadas"))}</h4>
          </div>
          <div class="finance-box-body">
            <div class="finance-activity-list">${itemsHtml}</div>
          </div>
        </section>
      `);
    $grid.addClass("has-aside");
  }

  function renderPayments() {
    if (!config.paymentFields) {
      $("#financePaymentsWrap").hide();
      return;
    }

    $("#financePaymentsWrap").show();
    const rows = state.payments || [];
    const html = rows
      .map((payment) => {
        const bank = payment?.bank_account?.name || "-";
        return `<tr data-id="${esc(payment.id)}">
          <td>${esc(toDateTimeBr(payment.payment_date))}</td>
          <td>${esc(toMoney(payment.amount))}</td>
          <td>${esc(translateEnumLabel("financialPaymentMethod", payment.payment_method, payment.payment_method || "-"))}</td>
          <td>${esc(bank)}</td>
          <td>${esc(payment.reference || "-")}</td>
          <td>
            <button class="btn btn-xs btn-default js-payment-edit"><i class="fa fa-pencil"></i></button>
            <button class="btn btn-xs btn-danger js-payment-del"><i class="fa fa-trash"></i></button>
          </td>
        </tr>`;
      })
      .join("");

    $("#financePaymentsBody").html(
      html || `<tr><td colspan="6" class="text-muted">${esc(tt("page.finance.common.noPayments", "Sem pagamentos."))}</td></tr>`,
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
    renderMainForm(row);
    renderPayments();
  }

  async function addOrEditPayment(payment) {
    if (!state.id) {
      alert(tt("page.finance.common.saveBeforePayments", "Salve primeiro o registro."));
      return;
    }

    const isEdit = !!payment?.id;
    const fields = config.paymentFields || [];
    window.SideModal.open({
      title: isEdit ? tt("page.finance.common.editPayment", "Editar pagamento") : tt("page.finance.common.newPayment", "Novo pagamento"),
      html: renderModalFields(fields, payment || {}, "fp"),
      okText: tt("page.finance.common.save", "Salvar"),
      cancelText: tt("page.finance.common.cancel", "Cancelar"),
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
    const ok = await askConfirm(tt("page.finance.common.confirmDeletePayment", "Deseja excluir este pagamento?"));
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
      label: "page.finance.fields.invoice",
      type: "lookup",
      lookup: "invoices",
      required: true,
    };

    window.SideModal.open({
      title: tt("page.finance.common.generateFromInvoice", "Gerar a receber por invoice"),
      html: `
        ${renderLookupField(field, {}, "gen")}
        <div class="form-group"><label>${esc(tt("page.finance.fields.installmentTotal", "Total de parcelas"))}</label><input id="gen_installments" class="form-control" type="number" value="1" min="1"/></div>
        <div class="form-group"><label>${esc(tt("page.finance.fields.intervalDays", "Intervalo em dias"))}</label><input id="gen_interval_days" class="form-control" type="number" value="30" min="1"/></div>
        <div class="form-group"><label>${esc(tt("page.finance.fields.firstDueDate", "Primeiro vencimento"))}</label><input id="gen_first_due_date" class="form-control" type="date"/></div>
      `,
      okText: tt("page.finance.common.generate", "Gerar"),
      cancelText: tt("page.finance.common.cancel", "Cancelar"),
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
            await api(`/api/finance/receivables/from-invoice/${encodeURIComponent(invoiceId)}`, {
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

  $("#btnFinanceBack").on("click", function () {
    window.location.href = page.gridPath;
  });

  $("#btnFinanceNew").on("click", function () {
    window.location.href = page.formPath;
  });

  $("#btnFinanceSave").on("click", async function () {
    try {
      const $scope = $("#financeFormFields");
      const payload = collectPayload(config.formFields || [], "ff", $scope, true);
      if (payload.recurrence_enabled === false) {
        payload.recurrence_frequency = null;
        payload.recurrence_interval = 1;
        payload.recurrence_day_of_month = null;
        payload.recurrence_occurrences = null;
        payload.recurrence_end_date = null;
      }
      const isEdit = !!state.id;
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

  $("#btnFinanceDelete").on("click", async function () {
    if (!state.id) return;
    const ok = await askConfirm(tt("page.finance.common.confirmDeleteOne", "Deseja excluir este registro?"));
    if (!ok) return;
    try {
      await api(`${config.apiBase}/${encodeURIComponent(state.id)}`, { method: "DELETE" });
      window.location.href = page.gridPath;
    } catch (error) {
      alert(error?.message || "Erro ao excluir");
    }
  });

  $("#btnFinanceAddPayment").on("click", function () {
    addOrEditPayment(null);
  });

  $("#btnFinanceGenerateFromInvoice").on("click", function () {
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
    $("#pageName").text(tt(page.titleKey, "Financeiro"));
    $("#subpageName").text(tt(page.titleKey, "Financeiro")).attr("href", page.gridPath);

    await loadLookups();
    renderMainForm({});

    if (state.id) {
      $("#btnFinanceDelete").show();
      $("#btnFinanceNew").show();
      await loadById(state.id);
    } else {
      $("#btnFinanceDelete").hide();
      $("#btnFinanceNew").hide();
      $("#financePaymentsWrap").hide();
    }

    if (page.key === "receivables") $("#btnFinanceGenerateFromInvoice").show();
    else $("#btnFinanceGenerateFromInvoice").hide();
  });
})();
