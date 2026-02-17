/* SavedViewsGrid - GECOM (no-clone, fixed columns, stable indices)
   Requirements:
   - jQuery
   - Bootstrap modal (for Save As / Columns)
   - Optional: jQuery UI sortable (for columns drag/drop)
*/
(function () {
  if (window.SavedViewsGrid && window.SavedViewsGrid.__gecom_v2 === true) return;
  const registry = new Map(); // entityName -> { cfg, state }

  const SavedViewsGrid = {
    __gecom_v2: true,

    async init(options) {
      if (!options || !options.entityName) throw new Error("SavedViewsGrid.init: missing entityName.");
      const cfg = normalizeOptions(options);

      const state = {
        views: [],
        currentViewId: null,
        currentName: "",
        fallbackApplied: false,
      };
      registry.set(String(cfg.entityName), { cfg, state });

      renderShell(cfg);
      wireBasicActions(cfg, state);

      // Load views list
      await reloadViews(cfg, state);

      // Select last / default / fallback
      await pickInitialView(cfg, state);

      // Ensure fixed columns never hidden by any later logic
      enforceFixedColumns(cfg);

      return true;
    },

    getCurrentDefinition(entityName) {
      const key = String(entityName || "").trim();
      if (!key) return null;
      const instance = registry.get(key);
      if (!instance || !instance.cfg) return null;

      const raw = instance.cfg.getCurrentState() || {};
      return normalizeDefinition(raw);
    },

    async applyExternalDefinition(entityName, definition, nameLabel) {
      const key = String(entityName || "").trim();
      if (!key) throw new Error("SavedViewsGrid.applyExternalDefinition: missing entityName.");

      const instance = registry.get(key);
      if (!instance || !instance.cfg || !instance.state) {
        throw new Error(`SavedViewsGrid.applyExternalDefinition: grid not initialized for entity '${key}'.`);
      }

      const label = String(nameLabel || "IA").trim() || "IA";
      await applyDefinition(instance.cfg, instance.state, null, label, definition || {}, {
        preservePickerValue: true,
      });
      return true;
    },
  };

  // -------------------- Helpers --------------------
  function normalizeOptions(options) {
    const cfg = Object.assign(
      {
        hostSelector: "",
        tableSelector: "",
        headerRowSelector: "",
        filtersRowSelector: "",

        entityName: "",

        // callbacks
        getAllColumnKeys: null,
        getCurrentState: null,
        applyState: null,
        onAfterApply: null,

        // fallback
        fallbackViewName: "Default",
        includeFallbackOption: true,
        fallbackDefinition: null,
      },
      options || {}
    );

    if (!cfg.hostSelector) throw new Error("SavedViewsGrid.init: missing hostSelector.");
    if (!cfg.tableSelector) throw new Error("SavedViewsGrid.init: missing tableSelector.");
    if (!cfg.headerRowSelector) throw new Error("SavedViewsGrid.init: missing headerRowSelector.");
    if (!cfg.filtersRowSelector) throw new Error("SavedViewsGrid.init: missing filtersRowSelector.");
    if (typeof cfg.getAllColumnKeys !== "function") throw new Error("SavedViewsGrid.init: missing getAllColumnKeys().");
    if (typeof cfg.getCurrentState !== "function") throw new Error("SavedViewsGrid.init: missing getCurrentState().");
    if (typeof cfg.applyState !== "function") throw new Error("SavedViewsGrid.init: missing applyState().");

    cfg.$host = $(cfg.hostSelector);
    cfg.$table = $(cfg.tableSelector);
    cfg.$headerRow = $(cfg.headerRowSelector);
    cfg.$filtersRow = $(cfg.filtersRowSelector);

    if (!cfg.$host.length) throw new Error(`SavedViewsGrid.init: host not found: ${cfg.hostSelector}`);
    if (!cfg.$table.length) throw new Error(`SavedViewsGrid.init: table not found: ${cfg.tableSelector}`);
    if (!cfg.$headerRow.length) throw new Error(`SavedViewsGrid.init: header row not found: ${cfg.headerRowSelector}`);
    if (!cfg.$filtersRow.length) throw new Error(`SavedViewsGrid.init: filters row not found: ${cfg.filtersRowSelector}`);

    return cfg;
  }

  function apiAuthHeaders() {
    // Front BFF already attaches cookies; we just request JSON.
    return { Accept: "application/json", "Content-Type": "application/json" };
  }

  async function readJsonSafe(res) {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  async function apiGet(url) {
    const res = await fetch(url, { method: "GET", headers: apiAuthHeaders() });
    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  }

  async function apiPost(url, body) {
    const res = await fetch(url, { method: "POST", headers: apiAuthHeaders(), body: JSON.stringify(body || {}) });
    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  }

  async function apiPatch(url, body) {
    const res = await fetch(url, { method: "PATCH", headers: apiAuthHeaders(), body: JSON.stringify(body || {}) });
    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  }

  async function apiPut(url, body) {
    const res = await fetch(url, { method: "PUT", headers: apiAuthHeaders(), body: JSON.stringify(body || {}) });
    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  }

  async function apiDelete(url) {
    const res = await fetch(url, { method: "DELETE", headers: apiAuthHeaders() });
    const data = await readJsonSafe(res);
    if (!res.ok) throw new Error(data?.message || "Request failed");
    return data;
  }

  function renderShell(cfg) {
    const html = `
      <div class="sv-bar" style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <div class="sv-left" style="display:flex; align-items:center; gap:8px;">
          <select class="form-control input-sm sv-picker" style="min-width:260px; height:30px;"></select>
          <span class="sv-name text-muted" style="font-size:12px;"></span>
        </div>

        <div class="sv-actions" style="margin-left:auto; display:flex; align-items:center; gap:6px;">
          <button type="button" class="btn btn-white btn-xs sv-btn-columns" title="Colunas">
            <i class="fa fa-columns"></i>
          </button>
          <button type="button" class="btn btn-white btn-xs sv-btn-saveas" id="sv_btnSaveAs" title="Salvar como">
            <i class="fa fa-save"></i>
          </button>
          <button type="button" class="btn btn-white btn-xs sv-btn-default" title="Definir como padrão">
            <i class="fa fa-star"></i>
          </button>
          <button type="button" class="btn btn-white btn-xs sv-btn-delete" title="Excluir view">
            <i class="fa fa-trash"></i>
          </button>
          <button type="button" class="btn btn-white btn-xs sv-btn-ai" title="Filtrar com IA">
            <i class="fa fa-magic"></i>
          </button>
        </div>
      </div>
    `;

    cfg.$host.html(html);
  }

  function wireBasicActions(cfg, state) {
    const $picker = cfg.$host.find(".sv-picker");
    const $btnSaveAs = cfg.$host.find(".sv-btn-saveas");
    const $btnDefault = cfg.$host.find(".sv-btn-default");
    const $btnDelete = cfg.$host.find(".sv-btn-delete");
    const $btnColumns = cfg.$host.find(".sv-btn-columns");
    const $btnAI = cfg.$host.find(".sv-btn-ai");
    const isAIEnabled = !(window.__features && window.__features.enableAI === false);

    $picker.off("change.sv").on("change.sv", async function () {
      const id = String($(this).val() || "");
      if (!id) return;
      if (id === "__fallback__") {
        localStorage.removeItem(`savedViews:last:${cfg.entityName}`);
        await applyFallback(cfg, state);
        return;
      }
      await applyViewById(cfg, state, id);
    });

    $btnSaveAs.off("click.sv").on("click.sv", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openSaveAsModal(cfg, state);
    });

    $btnDefault.off("click.sv").on("click.sv", async function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!state.currentViewId) return;

      try {
        await apiPut(`/api/saved-views/default/${encodeURIComponent(cfg.entityName)}/${encodeURIComponent(state.currentViewId)}`);
        toastInfo("View padrão atualizada.");
      } catch (err) {
        console.error(err);
        alert(err?.message || "Falha ao definir view padrão.");
      }
    });

    $btnDelete.off("click.sv").on("click.sv", async function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!state.currentViewId) return;

      const ok = confirm("Excluir esta view?");
      if (!ok) return;

      try {
        await apiDelete(`/api/saved-views/${encodeURIComponent(state.currentViewId)}`);
        state.currentViewId = null;
        state.currentName = "";
        localStorage.removeItem(`savedViews:last:${cfg.entityName}`);
        await reloadViews(cfg, state);
        await pickInitialView(cfg, state);
      } catch (err) {
        console.error(err);
        alert(err?.message || "Falha ao excluir view.");
      }
    });

    $btnColumns.off("click.sv").on("click.sv", function (e) {
      e.preventDefault();
      e.stopPropagation();
      openColumnsModal(cfg, state);
    });

    if (!isAIEnabled) {
      $btnAI.hide();
      return;
    }

    $btnAI.off("click.sv").on("click.sv", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!window.GecomAI || typeof window.GecomAI.openGridFilterModal !== "function") {
        alert("Módulo de IA não carregado.");
        return;
      }
      window.GecomAI.openGridFilterModal({ entityName: cfg.entityName });
    });
  }

  async function reloadViews(cfg, state) {
    const entityName = encodeURIComponent(cfg.entityName);
    const list = await apiGet(`/api/saved-views?entity_name=${entityName}`);
    state.views = Array.isArray(list) ? list : (list?.data || []);
    renderPicker(cfg, state);
  }

  function renderPicker(cfg, state) {
    const $picker = cfg.$host.find(".sv-picker");
    $picker.empty();

    if (cfg.includeFallbackOption !== false) {
      const fallbackName = cfg.fallbackViewName == null ? "Default" : String(cfg.fallbackViewName);
      $picker.append(`<option value="__fallback__">${escapeHtml(fallbackName)}</option>`);
    }

    (state.views || []).forEach(v => {
      $picker.append(`<option value="${escapeHtml(String(v.id))}">${escapeHtml(String(v.name || ""))}</option>`);
    });

    cfg.$host.find(".sv-name").text(state.currentName ? `(${state.currentName})` : "");
  }

  async function pickInitialView(cfg, state) {
    const $picker = cfg.$host.find(".sv-picker");
    const last = String(localStorage.getItem(`savedViews:last:${cfg.entityName}`) || "");

    let initialId = "";
    if (last && (state.views || []).some(v => String(v.id) === last)) {
      initialId = last;
    } else {
      // try default from backend
      try {
        const def = await apiGet(`/api/saved-views/default/${encodeURIComponent(cfg.entityName)}`);
        if (def?.saved_view_id && (state.views || []).some(v => String(v.id) === String(def.saved_view_id))) {
          initialId = String(def.saved_view_id);
        }
      } catch {
        // ignore
      }
    }

    if (initialId) {
      $picker.val(initialId);
      await applyViewById(cfg, state, initialId);
      return;
    }

    if (cfg.includeFallbackOption === false) {
      const firstId = state.views?.[0]?.id;
      if (firstId != null) {
        $picker.val(String(firstId));
        await applyViewById(cfg, state, String(firstId));
        return;
      }
    }

    // no default => apply fallback
    if (cfg.includeFallbackOption !== false) $picker.val("__fallback__");
    await applyFallback(cfg, state);
  }

  async function applyViewById(cfg, state, id) {
    const view = (state.views || []).find(v => String(v.id) === String(id));
    if (!view) return;

    state.currentViewId = String(view.id);
    state.currentName = String(view.name || "");

    localStorage.setItem(`savedViews:last:${cfg.entityName}`, state.currentViewId);

    const def = view.definition_json || view.definitionJson || {};
    await applyDefinition(cfg, state, state.currentViewId, state.currentName, def);
  }

  async function applyFallback(cfg, state) {
    state.currentViewId = null;
    state.currentName = cfg.fallbackViewName || "Default";

    const def = cfg.fallbackDefinition || {
      columns: cfg.getAllColumnKeys(),
      columns_order: cfg.getAllColumnKeys(),
      filters: [],
      sort: [],
      pageSize: 0,
      quickSearch: "",
    };

    await applyDefinition(cfg, state, null, state.currentName, def);
  }

  async function applyDefinition(cfg, state, viewId, name, definition, options) {
    const opts = Object.assign({ preservePickerValue: false }, options || {});
    const safeDefinition = sanitizeDefinitionForGrid(cfg, definition);

    // 1) Apply columns FIRST (no cloning, keep fixed cols)
    applyColumns(cfg, safeDefinition);

    // 2) Let page apply filters/sort/state (page controls + data model)
    cfg.applyState({
      viewId: viewId,
      name: name,
      definition: safeDefinition,
      _fromColumnsModal: false,
    });

    // 3) Update UI label/picker
    cfg.$host.find(".sv-name").text(name ? `(${name})` : "");
    const $picker = cfg.$host.find(".sv-picker");
    if (!opts.preservePickerValue) {
      if (viewId) $picker.val(String(viewId));
      else if (cfg.includeFallbackOption !== false) $picker.val("__fallback__");
      else $picker.val("");
    }

    // 4) Post apply hook (rebind datepicker, re-run filters, etc.)
    if (typeof cfg.onAfterApply === "function") {
      cfg.onAfterApply();
    }

    // Some pages re-render tbody during applyState/onAfterApply.
    // Re-apply columns after that render to keep header/filter/body aligned.
    applyColumns(cfg, safeDefinition);

    // Always enforce fixed columns visible
    enforceFixedColumns(cfg);
  }

  function normalizeDefinition(rawState) {
    const src = rawState || {};
    return {
      columns: Array.isArray(src.columns) ? src.columns : [],
      columns_order: Array.isArray(src.columns_order) ? src.columns_order : [],
      filters: Array.isArray(src.filters) ? src.filters : [],
      sort: Array.isArray(src.sort) ? src.sort : [],
      pageSize: Number(src.pageSize || 0) || 0,
      quickSearch: String(src.quickSearch || ""),
    };
  }

  function sanitizeDefinitionForGrid(cfg, definition) {
    const src = normalizeDefinition(definition || {});
    const allKeys = cfg.getAllColumnKeys().slice();
    const existing = new Set(allKeys);

    const columns = [];
    (src.columns || []).forEach((k) => {
      const key = String(k || "");
      if (!existing.has(key) || columns.includes(key)) return;
      columns.push(key);
    });

    const columnsOrder = [];
    (src.columns_order || []).forEach((k) => {
      const key = String(k || "");
      if (!existing.has(key) || columnsOrder.includes(key)) return;
      columnsOrder.push(key);
    });

    return {
      columns: columns.length ? columns : allKeys.slice(),
      columns_order: columnsOrder.length ? columnsOrder : (columns.length ? columns.slice() : allKeys.slice()),
      filters: Array.isArray(src.filters) ? src.filters : [],
      sort: Array.isArray(src.sort) ? src.sort : [],
      pageSize: Number(src.pageSize || 0) || 0,
      quickSearch: String(src.quickSearch || ""),
    };
  }

  // -------------------- Column operations --------------------
  function applyColumns(cfg, definition) {
    const def = definition || {};
    const columns = Array.isArray(def.columns) ? def.columns.slice() : [];
    const order = Array.isArray(def.columns_order) ? def.columns_order.slice() : [];

    // Fixed columns (must never be hidden or moved)
    // Mark any TH with data-sv-fixed="left" or "right"
    const fixed = getFixedColumns(cfg);

    // Normalize order: only keys that exist in the table
    const allKeys = cfg.getAllColumnKeys().slice();
    const existing = new Set(allKeys);

    const normalizedOrder = (order.length ? order : columns)
      .map(k => String(k || ""))
      .filter(k => existing.has(k));

    // Keep table structural integrity:
    // order requested first, then append omitted known keys (hidden later if needed).
    const baseOrder = normalizedOrder.length ? normalizedOrder : allKeys.slice();
    const appended = allKeys.filter(k => !baseOrder.includes(k));
    const finalOrder = baseOrder.concat(appended);

    // Visible keys: columns array if present, else all
    const visibleSet = new Set(
      (columns.length ? columns : allKeys).map(k => String(k || "")).filter(k => existing.has(k))
    );

    // Reorder header + filter + tbody cells **by moving nodes**, never recreate
    reorderTableByKeys(cfg, finalOrder, fixed);

    // Hide/show only data columns (sortable ones, keyed)
    setColumnVisibility(cfg, visibleSet, fixed);

    // keep fixed always visible
    enforceFixedColumns(cfg);
  }

  function getFixedColumns(cfg) {
    const fixedLeft = [];
    const fixedRight = [];

    cfg.$headerRow.find("th").each(function (idx) {
      const $th = $(this);
      const fixed = String($th.attr("data-sv-fixed") || "").toLowerCase().trim();
      if (fixed === "left") fixedLeft.push(idx);
      if (fixed === "right") fixedRight.push(idx);
    });

    return { fixedLeft, fixedRight };
  }

  function enforceFixedColumns(cfg) {
    cfg.$headerRow.find("th[data-sv-fixed]").show();
    cfg.$filtersRow.find("th[data-sv-fixed]").show();

    // enforce tbody td for fixed positions as visible too
    const fixedIndexes = [];
    cfg.$headerRow.find("th").each(function (idx) {
      if (String($(this).attr("data-sv-fixed") || "").trim().length > 0) fixedIndexes.push(idx);
    });

    if (fixedIndexes.length) {
      cfg.$table.find("tbody tr").each(function () {
        const $tds = $(this).children("td");
        fixedIndexes.forEach(i => $tds.eq(i).show());
      });
    }
  }

  function reorderTableByKeys(cfg, orderedKeys, fixed) {
    // Build current maps: key -> index (in current DOM)
    const headerMap = new Map();
    cfg.$headerRow.find("th").each(function (i) {
      const key = String($(this).data("sort-key") || "");
      if (key) headerMap.set(key, i);
    });

    const filterMap = new Map();
    cfg.$filtersRow.find("th").each(function (i) {
      // map by looking at header th at same index
      const headerTh = cfg.$headerRow.find("th").eq(i);
      const key = String(headerTh.data("sort-key") || "");
      if (key) filterMap.set(key, i);
    });

    // Capture fixed TH nodes (left/right) from header and filter
    const $headerThs = cfg.$headerRow.children("th");
    const $filterThs = cfg.$filtersRow.children("th");

    const fixedLeftHeader = fixed.fixedLeft.map(i => $headerThs.eq(i));
    const fixedRightHeader = fixed.fixedRight.map(i => $headerThs.eq(i));
    const fixedLeftFilter = fixed.fixedLeft.map(i => $filterThs.eq(i));
    const fixedRightFilter = fixed.fixedRight.map(i => $filterThs.eq(i));
    const fixedIndexSet = new Set([...(fixed.fixedLeft || []), ...(fixed.fixedRight || [])]);

    // Middle nodes by ordered keys
    const middleHeader = [];
    const middleFilter = [];

    orderedKeys.forEach(k => {
      const hi = headerMap.get(k);
      if (hi != null) middleHeader.push($headerThs.eq(hi));

      const fi = filterMap.get(k);
      if (fi != null) middleFilter.push($filterThs.eq(fi));
    });

    // Keep structural columns that do not have sort-key (ex: actions),
    // otherwise header/body can become misaligned after external definitions.
    const looseHeader = [];
    const looseFilter = [];
    $headerThs.each(function (i) {
      const key = String($(this).data("sort-key") || "");
      if (fixedIndexSet.has(i) || key) return;
      looseHeader.push($(this));
      looseFilter.push($filterThs.eq(i));
    });

    // Re-append in correct order (this moves nodes, keeps event handlers & plugins)
    cfg.$headerRow.empty().append(fixedLeftHeader).append(middleHeader).append(looseHeader).append(fixedRightHeader);
    cfg.$filtersRow.empty().append(fixedLeftFilter).append(middleFilter).append(looseFilter).append(fixedRightFilter);

    // Now reorder each tbody row TDs to match new header order:
    // We do it by reconstructing row children order based on key mapping + fixed.
    const newHeaderKeysByIndex = [];
    cfg.$headerRow.find("th").each(function () {
      newHeaderKeysByIndex.push(String($(this).data("sort-key") || ""));
    });

    cfg.$table.find("tbody tr").each(function () {
      const $tr = $(this);
      const $tds = $tr.children("td");

      // We cannot rely on data-sort-key on td, so we reorder by "old index mapping"
      // We'll use the previous headerMap to get old td index per key.
      const fixedLeftTds = fixed.fixedLeft.map(i => $tds.eq(i));
      const fixedRightTds = fixed.fixedRight.map(i => $tds.eq(i));

      const middleTds = [];
      orderedKeys.forEach(k => {
        const oldIndex = headerMap.get(k);
        if (oldIndex != null) middleTds.push($tds.eq(oldIndex));
      });

      const looseTds = [];
      $headerThs.each(function (i) {
        const key = String($(this).data("sort-key") || "");
        if (fixedIndexSet.has(i) || key) return;
        looseTds.push($tds.eq(i));
      });

      $tr.empty().append(fixedLeftTds).append(middleTds).append(looseTds).append(fixedRightTds);
    });
  }

  function setColumnVisibility(cfg, visibleSet, fixed) {
    // We hide/show only keyed columns (sortable/data ones), never fixed.
    const $headerThs = cfg.$headerRow.children("th");
    const $filterThs = cfg.$filtersRow.children("th");

    // Determine fixed positions in current DOM after reorder
    const fixedPositions = new Set();
    cfg.$headerRow.find("th").each(function (idx) {
      const fixedAttr = String($(this).attr("data-sv-fixed") || "").trim();
      if (fixedAttr) fixedPositions.add(idx);
    });

    $headerThs.each(function (idx) {
      const $th = $(this);
      if (fixedPositions.has(idx)) {
        $th.show();
        return;
      }

      const key = String($th.data("sort-key") || "");
      if (!key) {
        // non-key spacer => keep
        $th.show();
        return;
      }

      if (visibleSet.has(key)) $th.show();
      else $th.hide();
    });

    $filterThs.each(function (idx) {
      const $th = $(this);
      if (fixedPositions.has(idx)) {
        $th.show();
        return;
      }

      // Match header key at same index
      const headerKey = String(cfg.$headerRow.children("th").eq(idx).data("sort-key") || "");
      if (!headerKey) {
        $th.show();
        return;
      }

      if (visibleSet.has(headerKey)) $th.show();
      else $th.hide();
    });

    // tbody
    cfg.$table.find("tbody tr").each(function () {
      const $tds = $(this).children("td");

      $tds.each(function (idx) {
        const $td = $(this);
        if (fixedPositions.has(idx)) {
          $td.show();
          return;
        }

        const headerKey = String(cfg.$headerRow.children("th").eq(idx).data("sort-key") || "");
        if (!headerKey) {
          $td.show();
          return;
        }

        if (visibleSet.has(headerKey)) $td.show();
        else $td.hide();
      });
    });
  }

  // -------------------- Modals --------------------
  function openSaveAsModal(cfg, state) {
    ensureSaveAsModal();

    $("#sv_viewNameInput").val("");
    $("#sv_setDefaultChk").prop("checked", false);

    $("#sv_confirmSaveAs")
      .off("click.sv")
      .on("click.sv", async function () {
        try {
          const name = String($("#sv_viewNameInput").val() || "").trim();
          if (!name) {
            alert("Informe um nome para a view.");
            return;
          }

          const setAsDefault = $("#sv_setDefaultChk").is(":checked");
          const currentState = cfg.getCurrentState();

          const definition_json = {
            columns: currentState.columns || [],
            columns_order: currentState.columns_order || [],
            filters: currentState.filters || [],
            sort: currentState.sort || [],
            pageSize: currentState.pageSize || 0,
            quickSearch: currentState.quickSearch || "",
          };

          const created = await apiPost("/api/saved-views", {
            entity_name: cfg.entityName,
            name: name,
            visibility: "PRIVATE",
            definition_json: definition_json,
            set_as_default: setAsDefault,
          });

          if (setAsDefault && created?.id) {
            await apiPut(`/api/saved-views/default/${encodeURIComponent(cfg.entityName)}/${encodeURIComponent(String(created.id))}`);
          }

          $("#sv_saveAsModal").modal("hide");

          await reloadViews(cfg, state);

          if (created?.id) {
            state.currentViewId = String(created.id);
            state.currentName = String(created.name || name);
            localStorage.setItem(`savedViews:last:${cfg.entityName}`, state.currentViewId);
            cfg.$host.find(".sv-picker").val(state.currentViewId);

            const def = created.definition_json || created.definitionJson || definition_json;
            await applyDefinition(cfg, state, state.currentViewId, state.currentName, def);
          }
        } catch (e) {
          console.error(e);
          alert(e?.message || "Falha ao salvar view.");
        }
      });

    $("#sv_saveAsModal").modal("show");
  }

  function ensureSaveAsModal() {
    if ($("#sv_saveAsModal").length) return;

    $("body").append(`
      <div class="modal fade" id="sv_saveAsModal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog" role="document" style="max-width:520px;">
          <div class="modal-content">
            <div class="modal-header">
              <h4 class="modal-title">Salvar view</h4>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div class="modal-body">
              <div class="form-group">
                <label>Nome</label>
                <input id="sv_viewNameInput" class="form-control" placeholder="Ex.: Produtos ativos" />
              </div>

              <div class="checkbox">
                <label>
                  <input type="checkbox" id="sv_setDefaultChk" />
                  Definir como padrão
                </label>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-white" data-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="sv_confirmSaveAs">Salvar</button>
            </div>
          </div>
        </div>
      </div>
    `);
  }

  function openColumnsModal(cfg, state) {
    ensureColumnsModal();

    const allKeys = cfg.getAllColumnKeys();
    const current = cfg.getCurrentState();

    // fixed columns are not part of keys list; they stay fixed anyway
    const visible = new Set((current.columns || []).map(x => String(x || "")));
    const order = Array.isArray(current.columns_order) && current.columns_order.length
      ? current.columns_order.map(x => String(x || ""))
      : allKeys.slice();

    const $list = $("#sv_columnsList");
    $list.empty();

    order.forEach(k => {
      if (!k) return;
      if (!allKeys.includes(k)) return;

      const checked = visible.has(k) ? "checked" : "";
      $list.append(`
        <li class="sv-col-item" data-key="${escapeHtml(k)}" style="display:flex; align-items:center; gap:10px; padding:6px 8px; border:1px solid #e7eaec; border-radius:6px; margin-bottom:6px; background:#fff;">
          <span class="sv-grip" style="cursor:move;"><i class="fa fa-bars"></i></span>
          <label style="margin:0; flex:1; display:flex; align-items:center; gap:8px;">
            <input type="checkbox" class="sv-col-visible" ${checked} />
            <span style="font-family:monospace; font-size:12px;">${escapeHtml(k)}</span>
          </label>
        </li>
      `);
    });

    // Enable drag drop if available
    if ($.fn.sortable) {
      $list.sortable({ handle: ".sv-grip", tolerance: "pointer" });
    }

    $("#sv_confirmColumns")
      .off("click.sv")
      .on("click.sv", async function () {
        try {
          const nextOrder = $("#sv_columnsList .sv-col-item")
            .map(function () { return String($(this).attr("data-key") || ""); })
            .get()
            .filter(Boolean);

          const nextVisible = $("#sv_columnsList .sv-col-item")
            .filter(function () { return $(this).find(".sv-col-visible").is(":checked"); })
            .map(function () { return String($(this).attr("data-key") || ""); })
            .get()
            .filter(Boolean);

          const next = Object.assign({}, current, {
            columns_order: nextOrder,
            columns: nextVisible,
          });

          // Apply columns locally (no save yet)
          applyColumns(cfg, next);

          cfg.applyState({
            viewId: current.viewId || null,
            name: current.name || "",
            definition: next,
            _fromColumnsModal: true,
          });

          $("#sv_columnsModal").modal("hide");

          if (typeof cfg.onAfterApply === "function") cfg.onAfterApply();
          enforceFixedColumns(cfg);
        } catch (e) {
          console.error(e);
          alert(e?.message || "Falha ao aplicar colunas.");
        }
      });

    $("#sv_columnsModal").modal("show");
  }

  function ensureColumnsModal() {
    if ($("#sv_columnsModal").length) return;

    $("body").append(`
      <div class="modal fade" id="sv_columnsModal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog" role="document" style="max-width:620px;">
          <div class="modal-content">
            <div class="modal-header">
              <h4 class="modal-title">Colunas</h4>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div class="modal-body">
              <p class="text-muted" style="margin-bottom:10px;">
                Arraste para reordenar e marque para exibir.
              </p>
              <ul id="sv_columnsList" style="list-style:none; padding-left:0; margin:0;"></ul>
            </div>

            <div class="modal-footer">
              <button type="button" class="btn btn-white" data-dismiss="modal">Cancelar</button>
              <button type="button" class="btn btn-primary" id="sv_confirmColumns">Aplicar</button>
            </div>
          </div>
        </div>
      </div>
    `);
  }

  function escapeHtml(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toastInfo(msg) {
    // simple fallback
    console.log("[SavedViewsGrid]", msg);
  }

  // expose
  window.SavedViewsGrid = SavedViewsGrid;
})();
