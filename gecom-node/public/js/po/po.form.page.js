(function () {
  const { resources, tt, waitForI18nReady, esc, normalizeArray, toMoney, toDateTimeBr } = window.PoResources || {};
  const page = window.__poPage || {};
  const config = resources?.[page.key];
  if (!config) return;

  const params = new URLSearchParams(window.location.search || "");
  const state = {
    id: String(params.get("id") || "").trim() || null,
    lookups: {},
    currentRow: null,
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

  function lookupSubtitle(item) {
    return String(item?.description || item?.process_number || item?.code || "").trim();
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

    const normalized = normalizeTabsForUi(tabs);
    return normalized.map((tab, index) => {
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
    const rest = tabs.slice(2);
    const merged = {
      id: "more",
      label: "page.po.tabs.more",
      fields: [],
    };
    rest.forEach((tab) => {
      merged.fields = merged.fields.concat(tab.fields || []);
    });

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
    const selectedLabel = selected ? lookupLabel(selected) : rel ? lookupLabel(rel) : "";
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
        return `<option value="${esc(opt)}" ${selected}>${esc(opt)}</option>`;
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
    return `
      <div id="${esc(`${id}__wrap`)}" class="form-group po-field-wrap" data-field="${esc(field.name)}">
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
        const subtitle = lookupSubtitle(item);
        return `<div class="po-lookup-item" data-id="${esc(item.id)}" data-label="${esc(label)}">
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
    $("#poFormFields").html(renderFormTabs(row || {}));
    const $scope = $("#poFormFields");
    bindTabClicks($scope);
    bindLookupWidgets($scope, "ff", fields);
    bindMoneyMasks($scope, "ff", fields);
    bindValidationClear($scope, "ff", fields);
  }

  async function loadById(id) {
    const row = await api(`${config.apiBase}/${encodeURIComponent(id)}`);
    state.currentRow = row;
    renderMainForm(row);
  }

  $("#btnPoBack").on("click", function () {
    window.location.href = page.gridPath;
  });

  $("#btnPoNew").on("click", function () {
    window.location.href = page.formPath;
  });

  $("#btnPoSave").on("click", async function () {
    try {
      const $scope = $("#poFormFields");
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
      const id = saved?.id || state.id;
      if (id) window.location.href = `${page.formPath}?id=${encodeURIComponent(id)}`;
      else window.location.href = page.gridPath;
    } catch (error) {
      alert(error?.message || "Erro ao salvar");
    }
  });

  $("#btnPoDelete").on("click", async function () {
    if (!state.id) return;
    const ok = await askConfirm(tt("page.po.common.confirmDeleteOne", "Deseja excluir este registro?"));
    if (!ok) return;
    try {
      await api(`${config.apiBase}/${encodeURIComponent(state.id)}`, { method: "DELETE" });
      window.location.href = page.gridPath;
    } catch (error) {
      alert(error?.message || "Erro ao excluir");
    }
  });

  $(document).ready(async function () {
    if (typeof waitForI18nReady === "function") await waitForI18nReady();
    $("#pageName").text(tt(page.titleKey, "Project & Operations"));
    $("#subpageName").text(tt(page.titleKey, "Project & Operations")).attr("href", page.gridPath);

    await loadLookups();
    renderMainForm({});

    if (state.id) {
      $("#btnPoDelete").show();
      $("#btnPoNew").show();
      await loadById(state.id);
    } else {
      $("#btnPoDelete").hide();
      $("#btnPoNew").hide();
    }
  });
})();

