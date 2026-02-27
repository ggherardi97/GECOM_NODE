(function () {
  const { resources, tt, waitForI18nReady, esc, normalizeArray, toMoney, toDateBr, toDateTimeBr, boolLabel } = window.HrResources || {};
  const page = window.__hrPage || {};
  const config = resources?.[page.key];

  if (!config) return;

  const columnMap = new Map((config.gridColumns || []).map((col) => [String(col.key || ""), col]));

  const state = {
    rows: [],
    filteredRows: [],
    selectedIds: new Set(),
    sortKey: "",
    sortDir: "asc",
    filters: {},
    lookups: {},
    savedView: {
      viewId: null,
      name: "",
      columns: [],
      columns_order: [],
      filters: [],
      sort: [],
      pageSize: 0,
    },
  };

  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: "include" }, opts || {}))
      .then(async (resp) => {
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

  function bindMoneyMasks($root, prefix, fields) {
    (fields || [])
      .filter((field) => isMoneyField(field))
      .forEach((field) => {
        const id = `#${prefix}_${field.name}`;
        const $input = $root.find(id);
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

  function recentScore(item) {
    const keys = ["updated_at", "created_at", "issue_date", "due_date", "movement_date", "payment_date", "date"];
    for (const key of keys) {
      const raw = item?.[key];
      if (!raw) continue;
      const ts = new Date(raw).getTime();
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

  function getAllColumnKeys() {
    return (config.gridColumns || []).map((col) => String(col.key || "")).filter(Boolean);
  }

  function getColumnDef(key) {
    return columnMap.get(String(key || "")) || { key: String(key || "") };
  }

  function getHeaderKeysInOrder(includeHidden) {
    const keys = [];
    $("#hrGridHeader th.sortable").each(function () {
      const key = String($(this).data("sort-key") || "").trim();
      if (!key) return;
      if (!includeHidden && !$(this).is(":visible")) return;
      keys.push(key);
    });
    return keys.length ? keys : getAllColumnKeys();
  }

  function normalizeSortValue(value, key) {
    if (value == null) return "";
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return asNumber;
    if (String(key || "").includes("date")) {
      const ts = new Date(value).getTime();
      if (!Number.isNaN(ts)) return ts;
    }
    return String(value).toLowerCase();
  }

  function syncSelectAllCheckbox() {
    const $all = $("#hrSelectAll");
    if (!$all.length) return;

    const visibleIds = state.filteredRows.map((row) => String(row?.id || "")).filter(Boolean);
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

  function updateSortIndicators() {
    $("#hrGridHeader th.sortable").each(function () {
      const key = String($(this).data("sort-key") || "");
      const $ind = $(this).find(".sort-indicator");
      if (!$ind.length) return;
      if (state.sortKey === key) $ind.text(state.sortDir === "asc" ? "^" : "v");
      else $ind.text("");
    });
  }

  function extractValue(row, key) {
    if (!row) return "";
    if (key === "company_name") return row.company?.company_name || "";
    if (key === "currency_code") return row.currency?.code || "";
    if (key === "cost_center_name") return row.cost_center?.name || "";
    if (key === "bank_account_name") return row.bank_account?.name || "";
    if (String(key).endsWith("_name")) {
      const base = String(key).replace(/_name$/i, "");
      const rel = row?.[base];
      if (rel && typeof rel === "object") return rel.full_name || rel.name || rel.code || "";
    }
    if (String(key).endsWith("_code")) {
      const base = String(key).replace(/_code$/i, "");
      const rel = row?.[base];
      if (rel && typeof rel === "object") return rel.code || "";
    }
    if (String(key).endsWith("_number")) {
      const base = String(key).replace(/_number$/i, "");
      const rel = row?.[base];
      if (rel && typeof rel === "object") return rel.employee_number || rel.number || "";
    }
    return row[key];
  }

  function formatCell(col, value) {
    if (col.format) return col.format(value);
    if (value == null || value === "") return "-";
    if (String(col.key).includes("date") && String(value).includes("T")) return toDateTimeBr(value);
    if (String(col.key).includes("date")) return toDateBr(value);
    if (typeof value === "boolean") return boolLabel(value);
    if (typeof value === "number") return toMoney(value);
    return String(value);
  }

  function applyFiltersAndSort() {
    const list = state.rows.filter((row) => {
      return Object.entries(state.filters).every(([key, raw]) => {
        const filter = String(raw || "").trim().toLowerCase();
        if (!filter) return true;
        const value = String(formatCell(getColumnDef(key), extractValue(row, key)) || "").toLowerCase();
        return value.includes(filter);
      });
    });

    if (state.sortKey) {
      const sortKey = state.sortKey;
      list.sort((a, b) => {
        const av = normalizeSortValue(extractValue(a, sortKey), sortKey);
        const bv = normalizeSortValue(extractValue(b, sortKey), sortKey);
        if (av < bv) return state.sortDir === "asc" ? -1 : 1;
        if (av > bv) return state.sortDir === "asc" ? 1 : -1;
        return 0;
      });
    }

    state.filteredRows = list;
  }

  function renderTable() {
    applyFiltersAndSort();
    const visibleKeys = getHeaderKeysInOrder(false);

    const bodyHtml = state.filteredRows
      .map((row) => {
        const id = String(row.id || "");
        const checked = state.selectedIds.has(id) ? "checked" : "";
        const cells = visibleKeys
          .map((key) => {
            const col = getColumnDef(key);
            const raw = extractValue(row, key);
            const out = formatCell(col, raw);
            return `<td data-field="${esc(key)}">${esc(out)}</td>`;
          })
          .join("");
        return `<tr data-id="${esc(id)}"><td class="sv-fixed-col" data-sv-fixed="left"><input type="checkbox" class="js-row-check" data-id="${esc(id)}" ${checked} /></td>${cells}</tr>`;
      })
      .join("");

    $("#hrGridBody").html(
      bodyHtml || `<tr><td colspan="${(visibleKeys.length || 0) + 1}" class="text-muted">${esc(tt("page.hr.common.empty", "Nenhum registro encontrado."))}</td></tr>`,
    );
    $("#hrSelectedCount").text(String(state.selectedIds.size));
    $("#hrBulkActions").toggle(state.selectedIds.size > 0);
    syncSelectAllCheckbox();
    updateSortIndicators();
  }

  async function loadLookups() {
    const sources = config.lookupSources || {};
    const entries = Object.entries(sources);
    for (const [key, url] of entries) {
      try {
        state.lookups[key] = normalizeArray(await api(url));
      } catch {
        state.lookups[key] = [];
      }
    }
  }

  function renderModalForm(fields, data) {
    return fields
      .map((field) => {
        const id = `fm_${field.name}`;
        const lookupId = `${id}__lookup`;
        const menuId = `${id}__menu`;
        const label = tt(field.label, field.name);
        const raw = data?.[field.name];
        if (field.type === "checkbox") {
          return `<div class="form-group"><label><input id="${esc(id)}" type="checkbox" ${raw ? "checked" : ""}/> ${esc(label)}</label></div>`;
        }
        if (field.type === "textarea") {
          return `<div class="form-group"><label>${esc(label)}</label><textarea id="${esc(id)}" class="form-control" rows="2">${esc(raw || "")}</textarea></div>`;
        }
        if (field.type === "select") {
          const options = (field.options || []).map((opt) => {
            const selected = String(raw ?? field.defaultValue ?? "") === String(opt) ? "selected" : "";
            return `<option value="${esc(opt)}" ${selected}>${esc(opt)}</option>`;
          });
          return `<div class="form-group"><label>${esc(label)}</label><select id="${esc(id)}" class="form-control">${options.join("")}</select></div>`;
        }
        if (field.type === "lookup") {
          const rows = state.lookups[field.lookup] || [];
          const selected = rows.find((item) => String(item?.id || "") === String(raw || ""));
          const selectedLabel = selected ? lookupLabel(selected) : "";
          return `<div class="form-group">
            <label>${esc(label)}</label>
            <div class="hr-lookup-wrap">
              <input
                id="${esc(lookupId)}"
                class="form-control js-modal-lookup-input"
                type="text"
                autocomplete="off"
                value="${esc(selectedLabel)}"
                data-field="${esc(field.name)}"
                data-lookup="${esc(field.lookup || "")}"
                data-target="#${esc(id)}"
                data-menu="#${esc(menuId)}"
                data-required="${field.required ? "1" : "0"}"
                placeholder="${esc(tt("page.hr.common.lookupPlaceholder", "Clique para ver recentes ou digite para buscar"))}"
              />
              <input id="${esc(id)}" type="hidden" value="${esc(raw || "")}" />
              <div id="${esc(menuId)}" class="hr-lookup-menu"></div>
            </div>
          </div>`;
        }
        const isMoney = isMoneyField(field);
        const type = isMoney ? "text" : field.type || "text";
        const value = isMoney ? formatMoneyDisplay(raw || field.defaultValue || "") : raw || field.defaultValue || "";
        return `<div class="form-group"><label>${esc(label)}</label><input id="${esc(id)}" class="form-control" type="${esc(type)}" value="${esc(value)}" ${field.step ? `step="${esc(field.step)}"` : ""}/></div>`;
      })
      .join("");
  }

  function bindModalLookups($root, fields) {
    const map = new Map((fields || []).map((field) => [String(field.name || ""), field]));
    $root.find(".js-modal-lookup-input").each(function () {
      const $input = $(this);
      const fieldName = String($input.data("field") || "").trim();
      const field = map.get(fieldName);
      if (!field) return;

      const targetSelector = String($input.data("target") || "");
      const menuSelector = String($input.data("menu") || "");
      const lookupKey = String($input.data("lookup") || field.lookup || "");
      const $hidden = $root.find(targetSelector);
      const $menu = $root.find(menuSelector);
      let timer = null;

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

      $input.off(".modlookup");
      $menu.off(".modlookup");

      $input.on("focus.modlookup", function () {
        openRecent();
      });

      $input.on("input.modlookup", function () {
        $hidden.val("");
        $input.removeClass("hr-invalid");
        if (timer) clearTimeout(timer);
        const term = String($(this).val() || "");
        timer = setTimeout(() => search(term), 180);
      });

      $menu.on("mousedown.modlookup", ".hr-lookup-item", function (event) {
        event.preventDefault();
        const id = String($(this).data("id") || "").trim();
        const label = String($(this).data("label") || "").trim();
        if (!id) return;
        $hidden.val(id);
        $input.val(label || id).removeClass("hr-invalid");
        $menu.hide();
      });

      $input.on("blur.modlookup", function () {
        setTimeout(() => $menu.hide(), 140);
      });
    });
  }

  function normalizeModalValue(field, value) {
    if (field.type !== "number") return value;
    if (isMoneyField(field)) return toMoneyApiString(value);
    if (isIntegerField(field)) {
      const n = parseLocaleNumber(value);
      return n == null ? null : Math.trunc(n);
    }
    const n = parseLocaleNumber(value);
    return n == null ? null : n;
  }

  function collectModalPayload(fields, $root) {
    const payload = {};
    const missing = [];
    fields.forEach((field) => {
      const id = `#fm_${field.name}`;
      const lookupId = `#fm_${field.name}__lookup`;
      if (field.type === "checkbox") payload[field.name] = $root.find(id).is(":checked");
      else if (field.type === "lookup") payload[field.name] = String($root.find(id).val() || "").trim();
      else payload[field.name] = $root.find(id).val();

      payload[field.name] = normalizeModalValue(field, payload[field.name]);

      const requiredMissing =
        field.required &&
        (field.type === "checkbox"
          ? !payload[field.name]
          : String(payload[field.name] == null ? "" : payload[field.name]).trim() === "");

      if (requiredMissing) {
        missing.push(field);
        if (field.type === "lookup") $root.find(lookupId).addClass("hr-invalid").trigger("focus");
      }

      if (field.type !== "checkbox" && !field.required && String(payload[field.name] || "").trim() === "") payload[field.name] = null;
    });

    if (missing.length) {
      const names = missing.map((field) => tt(field.label, field.name)).join(", ");
      throw new Error(`${tt("page.hr.common.fillRequired", "Preencha os campos obrigatorios")}: ${names}`);
    }

    return payload;
  }

  async function quickEditSelected() {
    const ids = Array.from(state.selectedIds);
    if (ids.length !== 1) return alert(tt("page.hr.common.selectOne", "Selecione exatamente um registro."));
    const id = ids[0];
    const row = state.rows.find((r) => String(r.id) === id);
    if (!row) return;

    window.SideModal.open({
      title: tt("page.hr.common.quickEdit", "Edicao rapida"),
      html: renderModalForm(config.formFields || [], row),
      okText: tt("page.hr.common.save", "Salvar"),
      cancelText: tt("page.hr.common.cancel", "Cancelar"),
      onOpen: function (ctx) {
        const $root = ctx?.root || $("#dynamicModalBody");
        bindModalLookups($root, config.formFields || []);
        bindMoneyMasks($root, "fm", config.formFields || []);
      },
      onOk: async function (ctx) {
        try {
          const $root = ctx?.root || $("#dynamicModalBody");
          const payload = collectModalPayload(config.formFields || [], $root);
          await api(`${config.apiBase}/${encodeURIComponent(id)}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          await loadRows();
          return false;
        } catch (e) {
          alert(e?.message || "Erro ao salvar");
          return true;
        }
      },
    });
  }

  async function deleteSelected() {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) return;
    const confirmed = await (async function () {
      const result = window.confirm(tt("page.hr.common.confirmDeleteMany", "Deseja excluir os registros selecionados?"));
      if (result && typeof result.then === "function") return !!(await result);
      return !!result;
    })();
    if (!confirmed) return;

    try {
      for (const id of ids) {
        await api(`${config.apiBase}/${encodeURIComponent(id)}`, { method: "DELETE" });
      }
      state.selectedIds.clear();
      await loadRows();
    } catch (e) {
      alert(e?.message || "Erro ao excluir");
    }
  }

  async function loadRows() {
    state.rows = normalizeArray(await api(config.apiBase));
    const existingIds = new Set(state.rows.map((row) => String(row?.id || "")).filter(Boolean));
    Array.from(state.selectedIds).forEach((id) => {
      if (!existingIds.has(id)) state.selectedIds.delete(id);
    });
    renderTable();
  }

  function setupHeaders() {
    const cols = config.gridColumns || [];
    const headerHtml = cols
      .map(
        (col) =>
          `<th class="sortable" data-sort-key="${esc(col.key)}" data-field="${esc(col.key)}">${esc(tt(col.label, col.key))} <span class="sort-indicator"></span></th>`,
      )
      .join("");
    const filterHtml = cols
      .map(
        (col) =>
          `<th data-field="${esc(col.key)}"><input class="form-control input-sm js-filter" data-key="${esc(col.key)}" data-filter="${esc(col.key)}" placeholder="${esc(tt("page.hr.common.filter", "Filtrar"))}" /></th>`,
      )
      .join("");

    $("#hrGridHeader").html(`<th class="sv-fixed-col" data-sv-fixed="left" data-field="__select" style="width:40px;"><input id="hrSelectAll" type="checkbox"/></th>${headerHtml}`);
    $("#hrGridFilters").html(`<th class="sv-fixed-col" data-sv-fixed="left" data-field="__select"></th>${filterHtml}`);
    updateSortIndicators();
  }

  function captureFiltersForSavedView() {
    const filters = [];
    Object.keys(state.filters).forEach((key) => {
      const value = String(state.filters[key] || "").trim();
      if (!value) return;
      filters.push({ field: key, op: "contains", value });
    });
    return filters;
  }

  function applyFiltersFromSavedView(definition) {
    state.filters = {};
    $("#hrGridFilters .js-filter").val("");

    const filters = Array.isArray(definition?.filters) ? definition.filters : [];
    filters.forEach((f) => {
      const key = String(f?.field || "").trim();
      if (!key || !columnMap.has(key)) return;
      const value = String(f?.value || "");
      state.filters[key] = value;
      $(`#hrGridFilters .js-filter[data-key="${key}"]`).val(value);
    });
  }

  function applySortFromSavedView(definition) {
    const first = Array.isArray(definition?.sort) ? definition.sort[0] : null;
    const key = String(first?.field || "").trim();
    if (!key) {
      state.sortKey = "";
      state.sortDir = "asc";
      updateSortIndicators();
      return;
    }
    state.sortKey = key;
    state.sortDir = String(first?.dir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
    updateSortIndicators();
  }

  function getCurrentSavedViewState() {
    const domOrder = getHeaderKeysInOrder(true);
    const visible = getHeaderKeysInOrder(false);
    state.savedView.columns_order = domOrder.length ? domOrder : state.savedView.columns_order;
    state.savedView.columns = visible.length ? visible : state.savedView.columns;
    state.savedView.filters = captureFiltersForSavedView();
    state.savedView.sort = state.sortKey ? [{ field: state.sortKey, dir: state.sortDir }] : [];
    return Object.assign({}, state.savedView);
  }

  function patchColumnsModalLabels() {
    const labelByField = new Map();
    $("#hrGridHeader th.sortable").each(function () {
      const field = String($(this).data("sort-key") || "");
      if (!field) return;
      const text = $(this).clone().children().remove().end().text();
      const label = String(text || "").replace(/\s+/g, " ").trim();
      if (label) labelByField.set(field, label);
    });

    const modal = $(".modal:visible");
    if (!modal.length) return;

    modal.find("li, .sv-col-item, .sv-columns-item, label").each(function () {
      const el = $(this);
      const raw = String(el.text() || "").trim();
      if (!raw || !labelByField.has(raw)) return;

      const label = labelByField.get(raw);
      const span = el.find(".sv-col-name, .sv-label, .col-name, .name").first();
      if (span.length) {
        span.text(label);
        return;
      }

      const nodes = el.contents().filter(function () {
        return this.nodeType === 3;
      });
      if (nodes.length) nodes.last().replaceWith(` ${label}`);
    });
  }

  function tryTriggerAny(selectors) {
    for (const selector of selectors) {
      const el = $(selector);
      if (el.length) {
        el.trigger("click");
        return true;
      }
    }
    return false;
  }

  function ensureSavedViewsExtraButtons() {
    const host = $("#hrSavedViewsHost");
    if (!host.length) return;

    const actions = host.find(".sv-actions").length ? host.find(".sv-actions").first() : host;
    if (!$("#btnHrSaveCurrentView").length) {
      actions.append(`
        <button id="btnHrSaveCurrentView" class="btn btn-white btn-xs sv-actionbar-btn" style="margin-left: 8px;">
          <i class="fa fa-check"></i> ${esc(tt("page.hr.common.save", "Salvar"))}
        </button>
      `);
    }

    $("#btnHrSaveCurrentView")
      .off("click.hrSaveCurrent")
      .on("click.hrSaveCurrent", async function (e) {
        e.preventDefault();
        e.stopPropagation();

        if (state.savedView.viewId) {
          try {
            const definition = getCurrentSavedViewState();
            await api(`/api/saved-views/${encodeURIComponent(state.savedView.viewId)}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: state.savedView.name || undefined,
                definition_json: definition,
              }),
            });
          } catch (err) {
            console.error(err);
            alert(err?.message || "Falha ao salvar a view.");
          }
          return;
        }

        tryTriggerAny(["#sv_btnSaveAs", ".sv-btn-saveas", "[data-action='saveas']"]);
      });
  }

  async function initSavedViews() {
    if (!window.SavedViewsGrid || typeof window.SavedViewsGrid.init !== "function") return;

    const allKeys = getAllColumnKeys();
    state.savedView.columns = allKeys.slice();
    state.savedView.columns_order = allKeys.slice();

    await window.SavedViewsGrid.init({
      entityName: String(page.entityName || `hr_${page.key || "grid"}`),
      hostSelector: "#hrSavedViewsHost",
      tableSelector: "#hrGridTable",
      headerRowSelector: "#hrGridHeader",
      filtersRowSelector: "#hrGridFilters",
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
      getCurrentState: () => getCurrentSavedViewState(),
      applyState: ({ viewId, name, definition, _fromColumnsModal }) => {
        state.savedView.viewId = viewId;
        state.savedView.name = name || "";

        if (_fromColumnsModal === true) {
          renderTable();
          updateSortIndicators();
          setTimeout(patchColumnsModalLabels, 60);
          return;
        }

        applyFiltersFromSavedView(definition || {});
        applySortFromSavedView(definition || {});
        renderTable();
      },
      onAfterApply: () => {
        renderTable();
        updateSortIndicators();
        ensureSavedViewsExtraButtons();
        setTimeout(patchColumnsModalLabels, 60);
      },
    });

    ensureSavedViewsExtraButtons();
    setTimeout(patchColumnsModalLabels, 100);
  }

  $(document).on("change", ".js-row-check", function () {
    const id = String($(this).data("id") || "");
    if (!id) return;
    if (this.checked) state.selectedIds.add(id);
    else state.selectedIds.delete(id);
    renderTable();
  });

  $(document).on("change", "#hrSelectAll", function () {
    const checked = !!this.checked;
    state.selectedIds.clear();
    if (checked) state.filteredRows.forEach((row) => state.selectedIds.add(String(row.id)));
    renderTable();
  });

  $(document).on("input", ".js-filter", function () {
    const key = String($(this).data("key") || "");
    state.filters[key] = $(this).val();
    renderTable();
  });

  $(document).on("click", "#hrGridHeader .sortable", function () {
    const key = String($(this).data("sort-key") || "");
    if (!key) return;
    if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    else {
      state.sortKey = key;
      state.sortDir = "asc";
    }
    renderTable();
  });

  $(document).on("click", "#hrGridBody tr", function (e) {
    if ($(e.target).closest("input,button,a,label").length) return;
    const id = String($(this).data("id") || "");
    if (!id) return;
    window.location.href = `${page.formPath}?id=${encodeURIComponent(id)}`;
  });

  $(document).off("click.hrCols").on("click.hrCols", "#sv_btnColumns, .sv-btn-columns, [data-action='columns']", function () {
    setTimeout(patchColumnsModalLabels, 60);
  });

  $(document).off("shown.bs.modal.hrCols").on("shown.bs.modal.hrCols", ".modal", function () {
    setTimeout(patchColumnsModalLabels, 60);
  });

  $("#btnHrRefresh").on("click", loadRows);
  $("#btnHrNew").on("click", function () {
    window.location.href = page.formPath;
  });
  $("#btnHrQuickEdit").on("click", quickEditSelected);
  $("#btnHrDelete").on("click", deleteSelected);
  $("#btnHrClearSelection").on("click", function () {
    state.selectedIds.clear();
    renderTable();
  });

  $(document).ready(async function () {
    if (typeof waitForI18nReady === "function") await waitForI18nReady();
    $("#pageName").text(tt(page.titleKey, "Hriro"));
    $("#subpageName").text(tt(page.titleKey, "Hriro")).attr("href", page.gridPath);
    setupHeaders();
    await loadLookups();
    await loadRows();
    await initSavedViews();
  });
})();

