(function () {
  const { resources, tt, waitForI18nReady, esc, normalizeArray, toMoney, toDateBr, toDateTimeBr, boolLabel } = window.PoResources || {};
  const page = window.__poPage || {};
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
      item?.company_name ||
        item?.process_number ||
        item?.title ||
        item?.name ||
        item?.code ||
        item?.full_name ||
        item?.email ||
        item?.appointment?.title ||
        item?.email ||
        item?.id ||
        "",
    ).trim();
  }

  function lookupSubtitle(item) {
    return String(item?.description || item?.process_number || item?.title || item?.code || "").trim();
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

  function getAllColumnKeys() {
    return (config.gridColumns || []).map((col) => String(col.key || "")).filter(Boolean);
  }

  function getColumnDef(key) {
    return columnMap.get(String(key || "")) || { key: String(key || "") };
  }

  function getHeaderKeysInOrder(includeHidden) {
    const keys = [];
    $("#poGridHeader th.sortable").each(function () {
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
    const $all = $("#poSelectAll");
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
    $("#poGridHeader th.sortable").each(function () {
      const key = String($(this).data("sort-key") || "");
      const $ind = $(this).find(".sort-indicator");
      if (!$ind.length) return;
      if (state.sortKey === key) $ind.text(state.sortDir === "asc" ? "^" : "v");
      else $ind.text("");
    });
  }

  function extractValue(row, key) {
    if (!row) return "";
    if (key === "project_name") return row.project?.name || "";
    if (key === "process_number") return row.process?.process_number || "";
    if (key === "status_name") return row.status?.name || row.status || "";
    if (key === "owner_user_name") return row.owner_user?.full_name || "";
    if (key === "company_name") return row.company?.company_name || "";
    if (key === "currency_code") return row.currency?.code || "";
    if (key === "checklist_name") return row.checklist?.name || "";
    if (key === "assigned_user_name") return row.assigned_user?.full_name || "";
    if (key === "work_order_code") return row.work_order?.code || "";
    if (key === "resource_name") return row.resource?.name || row.appointment?.resource?.name || "";
    if (key === "role_name") return row.role?.name || "";
    if (key === "appointment_title") return row.appointment?.title || "";
    if (key === "appointment_start_at") return row.appointment?.start_at || "";
    if (key === "appointment_status") return row.appointment?.status || "";
    if (key === "items_count") return row._count?.items ?? "";
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

    $("#poGridBody").html(
      bodyHtml || `<tr><td colspan="${(visibleKeys.length || 0) + 1}" class="text-muted">${esc(tt("page.po.common.empty", "Nenhum registro encontrado."))}</td></tr>`,
    );
    $("#poSelectedCount").text(String(state.selectedIds.size));
    $("#poBulkActions").toggle(state.selectedIds.size > 0);
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
            <div class="po-lookup-wrap">
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
                placeholder="${esc(tt("page.po.common.lookupPlaceholder", "Clique para ver recentes ou digite para buscar"))}"
              />
              <input id="${esc(id)}" type="hidden" value="${esc(raw || "")}" />
              <div id="${esc(menuId)}" class="po-lookup-menu"></div>
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
        $input.removeClass("po-invalid");
        if (timer) clearTimeout(timer);
        const term = String($(this).val() || "");
        timer = setTimeout(() => search(term), 180);
      });

      $menu.on("mousedown.modlookup", ".po-lookup-item", function (event) {
        event.preventDefault();
        const id = String($(this).data("id") || "").trim();
        const label = String($(this).data("label") || "").trim();
        if (!id) return;
        $hidden.val(id);
        $input.val(label || id).removeClass("po-invalid");
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
        if (field.type === "lookup") $root.find(lookupId).addClass("po-invalid").trigger("focus");
      }

      if (field.type !== "checkbox" && !field.required && String(payload[field.name] || "").trim() === "") payload[field.name] = null;
    });

    if (missing.length) {
      const names = missing.map((field) => tt(field.label, field.name)).join(", ");
      throw new Error(`${tt("page.po.common.fillRequired", "Preencha os campos obrigatorios")}: ${names}`);
    }

    return payload;
  }

  function getBulkEditableFields() {
    const allowed = new Set(["status", "status_id", "owner_user_id", "assigned_user_id", "priority"]);
    return (config.formFields || []).filter((field) => allowed.has(String(field?.name || "")));
  }

  function renderBulkModalForm(fields) {
    return (fields || [])
      .map((field) => {
        const id = `bulk_${field.name}`;
        const lookupId = `${id}__lookup`;
        const menuId = `${id}__menu`;
        const label = tt(field.label, field.name);

        if (field.type === "select") {
          const options = [`<option value="">${esc(tt("page.po.common.noChange", "Sem alteracao"))}</option>`]
            .concat((field.options || []).map((opt) => `<option value="${esc(opt)}">${esc(opt)}</option>`));
          return `<div class="form-group"><label>${esc(label)}</label><select id="${esc(id)}" class="form-control">${options.join("")}</select></div>`;
        }

        if (field.type === "lookup") {
          return `<div class="form-group">
            <label>${esc(label)}</label>
            <div class="po-lookup-wrap">
              <input
                id="${esc(lookupId)}"
                class="form-control js-modal-lookup-input"
                type="text"
                autocomplete="off"
                value=""
                data-field="${esc(field.name)}"
                data-lookup="${esc(field.lookup || "")}"
                data-target="#${esc(id)}"
                data-menu="#${esc(menuId)}"
                data-required="0"
                placeholder="${esc(tt("page.po.common.lookupPlaceholder", "Clique para ver recentes ou digite para buscar"))}"
              />
              <input id="${esc(id)}" type="hidden" value="" />
              <div id="${esc(menuId)}" class="po-lookup-menu"></div>
            </div>
          </div>`;
        }

        return `<div class="form-group"><label>${esc(label)}</label><input id="${esc(id)}" class="form-control" type="text" /></div>`;
      })
      .join("");
  }

  function collectBulkPayload(fields, $root) {
    const payload = {};
    (fields || []).forEach((field) => {
      const id = `#bulk_${field.name}`;
      const raw = field.type === "lookup" ? String($root.find(id).val() || "").trim() : $root.find(id).val();
      const normalized = normalizeModalValue(field, raw);
      const text = String(normalized == null ? "" : normalized).trim();
      if (!text) return;
      payload[field.name] = normalized;
    });
    return payload;
  }

  async function quickEditSelected() {
    const ids = Array.from(state.selectedIds);
    if (ids.length !== 1) return alert(tt("page.po.common.selectOne", "Selecione exatamente um registro."));
    const id = ids[0];
    const row = state.rows.find((r) => String(r.id) === id);
    if (!row) return;

    window.SideModal.open({
      title: tt("page.po.common.quickEdit", "Edicao rapida"),
      html: renderModalForm(config.formFields || [], row),
      okText: tt("page.po.common.save", "Salvar"),
      cancelText: tt("page.po.common.cancel", "Cancelar"),
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

  async function bulkUpdateSelected() {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) return alert(tt("page.po.common.selectAny", "Selecione ao menos um registro."));

    const fields = getBulkEditableFields();
    if (!fields.length) {
      return alert(tt("page.po.common.bulkNotAvailable", "Atualizacao em massa nao disponivel para esta tela."));
    }

    window.SideModal.open({
      title: tt("page.po.common.bulkUpdate", "Atualizacao em massa"),
      html: renderBulkModalForm(fields),
      okText: tt("page.po.common.apply", "Aplicar"),
      cancelText: tt("page.po.common.cancel", "Cancelar"),
      onOpen: function (ctx) {
        const $root = ctx?.root || $("#dynamicModalBody");
        bindModalLookups($root, fields);
      },
      onOk: async function (ctx) {
        try {
          const $root = ctx?.root || $("#dynamicModalBody");
          const payload = collectBulkPayload(fields, $root);
          if (!Object.keys(payload).length) {
            throw new Error(tt("page.po.common.bulkSelectField", "Selecione ao menos um campo para atualizar."));
          }
          for (const id of ids) {
            await api(`${config.apiBase}/${encodeURIComponent(id)}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          }
          state.selectedIds.clear();
          await loadRows();
          return false;
        } catch (error) {
          alert(error?.message || "Erro ao atualizar em massa");
          return true;
        }
      },
    });
  }

  async function deleteSelected() {
    const ids = Array.from(state.selectedIds);
    if (!ids.length) return;
    const confirmed = await (async function () {
      const result = window.confirm(tt("page.po.common.confirmDeleteMany", "Deseja excluir os registros selecionados?"));
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
          `<th data-field="${esc(col.key)}"><input class="form-control input-sm js-filter" data-key="${esc(col.key)}" data-filter="${esc(col.key)}" placeholder="${esc(tt("page.po.common.filter", "Filtrar"))}" /></th>`,
      )
      .join("");

    $("#poGridHeader").html(`<th class="sv-fixed-col" data-sv-fixed="left" data-field="__select" style="width:40px;"><input id="poSelectAll" type="checkbox"/></th>${headerHtml}`);
    $("#poGridFilters").html(`<th class="sv-fixed-col" data-sv-fixed="left" data-field="__select"></th>${filterHtml}`);
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
    $("#poGridFilters .js-filter").val("");

    const filters = Array.isArray(definition?.filters) ? definition.filters : [];
    filters.forEach((f) => {
      const key = String(f?.field || "").trim();
      if (!key || !columnMap.has(key)) return;
      const value = String(f?.value || "");
      state.filters[key] = value;
      $(`#poGridFilters .js-filter[data-key="${key}"]`).val(value);
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
    $("#poGridHeader th.sortable").each(function () {
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
    const host = $("#poSavedViewsHost");
    if (!host.length) return;

    const actions = host.find(".sv-actions").length ? host.find(".sv-actions").first() : host;
    if (!$("#btnPoSaveCurrentView").length) {
      actions.append(`
        <button id="btnPoSaveCurrentView" class="btn btn-white btn-xs sv-actionbar-btn" style="margin-left: 8px;">
          <i class="fa fa-check"></i> ${esc(tt("page.po.common.save", "Salvar"))}
        </button>
      `);
    }

    $("#btnPoSaveCurrentView")
      .off("click.poSaveCurrent")
      .on("click.poSaveCurrent", async function (e) {
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
      entityName: String(page.entityName || `po_${page.key || "grid"}`),
      hostSelector: "#poSavedViewsHost",
      tableSelector: "#poGridTable",
      headerRowSelector: "#poGridHeader",
      filtersRowSelector: "#poGridFilters",
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

  $(document).on("change", "#poSelectAll", function () {
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

  $(document).on("click", "#poGridHeader .sortable", function () {
    const key = String($(this).data("sort-key") || "");
    if (!key) return;
    if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
    else {
      state.sortKey = key;
      state.sortDir = "asc";
    }
    renderTable();
  });

  $(document).on("click", "#poGridBody tr", function (e) {
    if ($(e.target).closest("input,button,a,label").length) return;
    const id = String($(this).data("id") || "");
    if (!id) return;
    window.location.href = `${page.formPath}?id=${encodeURIComponent(id)}`;
  });

  $(document).off("click.poCols").on("click.poCols", "#sv_btnColumns, .sv-btn-columns, [data-action='columns']", function () {
    setTimeout(patchColumnsModalLabels, 60);
  });

  $(document).off("shown.bs.modal.poCols").on("shown.bs.modal.poCols", ".modal", function () {
    setTimeout(patchColumnsModalLabels, 60);
  });

  $("#btnPoRefresh").on("click", loadRows);
  $("#btnPoNew").on("click", function () {
    window.location.href = page.formPath;
  });
  $("#btnPoQuickEdit").on("click", quickEditSelected);
  $("#btnPoBulkUpdate").on("click", bulkUpdateSelected);
  $("#btnPoDelete").on("click", deleteSelected);
  $("#btnPoClearSelection").on("click", function () {
    state.selectedIds.clear();
    renderTable();
  });

  $(document).ready(async function () {
    if (typeof waitForI18nReady === "function") await waitForI18nReady();
    $("#pageName").text(tt(page.titleKey, "Project & Operations"));
    $("#subpageName").text(tt(page.titleKey, "Project & Operations")).attr("href", page.gridPath);
    setupHeaders();
    await loadLookups();
    await loadRows();
    await initSavedViews();
  });
})();

