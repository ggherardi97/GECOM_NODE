(function () {
  const DEFAULT_PAGE_SIZE = 20;

  const state = {
    entities: [],
    selectedIds: new Set(),
    page: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    search: "",
    searchTimer: null,
    syncCoreNextLoad: true,
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
  }

  function selectedEntities() {
    const ids = Array.from(state.selectedIds);
    return state.entities.filter((row) => ids.includes(String(row.id)));
  }

  async function api(url, options) {
    const response = await fetch(url, Object.assign({ credentials: "include" }, options || {}));
    const text = await response.text().catch(() => "");
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }
    if (!response.ok) {
      throw new Error(data?.message || ("HTTP " + response.status));
    }
    return data;
  }

  function statusPill(isActive) {
    if (isActive) return '<span class="md-status-pill active">Ativo</span>';
    return '<span class="md-status-pill inactive">Inativo</span>';
  }

  function typePill(entityType) {
    const normalized = String(entityType || "").toUpperCase();
    if (normalized === "CORE") return '<span class="md-status-pill core">CORE</span>';
    if (normalized === "CUSTOM") return '<span class="md-status-pill custom">CUSTOM</span>';
    return esc(normalized || "-");
  }

  function boolText(value) {
    return value ? "Sim" : "Nao";
  }

  function renderTable() {
    const body = $("#mdEntitiesBody");
    if (!state.entities.length) {
      body.html('<tr><td colspan="9" class="text-center">Nenhuma entidade encontrada.</td></tr>');
      return;
    }

    const html = state.entities
      .map((row) => {
        const id = String(row.id || "");
        const checked = state.selectedIds.has(id) ? "checked" : "";
        return `
          <tr data-id="${esc(id)}">
            <td><input type="checkbox" class="md-row-check" data-id="${esc(id)}" ${checked} /></td>
            <td>${esc(row.display_name || "-")}</td>
            <td>${esc(row.name || "-")}</td>
            <td>${typePill(row.entity_type)}</td>
            <td>${esc(boolText(!!row.is_schema_editable))}</td>
            <td>${esc(boolText(!!row.is_field_editable))}</td>
            <td>${esc(boolText(!!row.is_form_editable))}</td>
            <td>${esc(row.published_version == null ? "-" : row.published_version)}</td>
            <td>${statusPill(!!row.is_active)}</td>
          </tr>
        `;
      })
      .join("");

    body.html(html);
    syncCheckAll();
  }

  function renderSearchState() {
    const container = $("#mdSearchState");
    if (!state.search) {
      container.html("");
      return;
    }

    container.html(`
      <span class="md-search-chip">
        Busca: \"${esc(state.search)}\"
        <button type="button" class="btn btn-xs btn-link" id="btnMdSearchStateClear">x</button>
      </span>
    `);
  }

  function pagerButton(label, targetPage, disabled, active) {
    const classes = ["btn", "btn-sm", active ? "btn-primary" : "btn-white", "js-md-page-btn"];

    return `
      <button
        type="button"
        class="${classes.join(" ")}"
        data-page="${esc(targetPage)}"
        ${disabled ? "disabled" : ""}
      >${esc(label)}</button>
    `;
  }

  function renderPager() {
    const wrap = $("#mdPagerWrap");
    const meta = $("#mdPagerMeta");
    const actions = $("#mdPagerActions");

    if (!state.total) {
      wrap.hide();
      meta.text("");
      actions.html("");
      return;
    }

    const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
    const page = Math.min(Math.max(1, state.page), totalPages);
    const start = (page - 1) * state.pageSize + 1;
    const end = Math.min(state.total, page * state.pageSize);

    meta.text(`Mostrando ${start}-${end} de ${state.total} entidades`);

    if (totalPages <= 1) {
      actions.html("");
      wrap.show();
      return;
    }

    const windowStart = Math.max(1, page - 2);
    const windowEnd = Math.min(totalPages, page + 2);
    const buttons = [];

    buttons.push(pagerButton("<", page - 1, page <= 1, false));
    for (let p = windowStart; p <= windowEnd; p += 1) {
      buttons.push(pagerButton(String(p), p, false, p === page));
    }
    buttons.push(pagerButton(">", page + 1, page >= totalPages, false));

    actions.html(buttons.join(""));
    wrap.show();
  }

  function syncCheckAll() {
    const allIds = state.entities.map((row) => String(row.id || ""));
    const selectedVisible = allIds.filter((id) => state.selectedIds.has(id)).length;
    const allSelected = allIds.length > 0 && selectedVisible === allIds.length;
    const noneSelected = selectedVisible === 0;

    const chk = document.getElementById("mdChkAll");
    if (!chk) return;
    chk.checked = allSelected;
    chk.indeterminate = !allSelected && !noneSelected;
  }

  function buildEntitiesUrl() {
    const params = new URLSearchParams();
    params.set("page", String(state.page));
    params.set("page_size", String(state.pageSize || DEFAULT_PAGE_SIZE));
    params.set("sync_core", state.syncCoreNextLoad ? "true" : "false");
    if (state.search) params.set("q", state.search);
    return `/api/metadata/entities?${params.toString()}`;
  }

  async function loadEntities(options) {
    const resetPage = !!options?.resetPage;
    if (resetPage) state.page = 1;

    const payload = await api(buildEntitiesUrl());
    const rows = normalizeArray(payload);
    state.entities = rows;
    state.total = Number(payload?.total || rows.length || 0);
    state.page = Number(payload?.page || state.page || 1);
    state.pageSize = Number(payload?.page_size || state.pageSize || DEFAULT_PAGE_SIZE);
    state.syncCoreNextLoad = false;

    state.selectedIds.clear();
    renderTable();
    renderSearchState();
    renderPager();
  }

  function openDesignerForSelected() {
    const selected = selectedEntities();
    if (selected.length !== 1) {
      window.alert("Selecione exatamente uma entidade para abrir o Designer.");
      return;
    }
    window.location.href = `/configuracoes/metadata-designer/${encodeURIComponent(selected[0].id)}`;
  }

  async function publishSelected() {
    const selected = selectedEntities();
    if (!selected.length) {
      window.alert("Selecione ao menos uma entidade para publicar.");
      return;
    }

    const ok = await window.confirm("Publicar as entidades selecionadas?");
    if (!ok) return;

    for (const row of selected) {
      await api(`/api/metadata/entities/${encodeURIComponent(row.id)}/publish`, {
        method: "POST",
      });
    }

    window.alert("Publicacao concluida.");
    await loadEntities();
  }

  async function saveEntity() {
    const payload = {
      display_name: String($("#mdEntityDisplayName").val() || "").trim(),
      name: String($("#mdEntityName").val() || "").trim(),
      physical_table_name: String($("#mdEntityPhysicalTableName").val() || "").trim(),
      description: String($("#mdEntityDescription").val() || "").trim(),
    };

    if (!payload.display_name || !payload.name) {
      window.alert("Informe Nome de exibicao e Nome interno.");
      return;
    }

    const created = await api("/api/metadata/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    $("#mdEntityModal").modal("hide");
    await loadEntities();
    if (created?.id) {
      window.location.href = `/configuracoes/metadata-designer/${encodeURIComponent(created.id)}`;
    }
  }

  async function cloneSelected() {
    const selected = selectedEntities();
    if (selected.length !== 1) {
      window.alert("Selecione uma entidade CUSTOM para clonar.");
      return;
    }
    const source = selected[0];
    if (String(source.entity_type || "").toUpperCase() !== "CUSTOM") {
      window.alert("Apenas entidades CUSTOM podem ser clonadas.");
      return;
    }

    const suffix = Date.now().toString().slice(-6);
    const clonePayload = {
      name: `${String(source.name || "custom_entity")}_copy_${suffix}`,
      display_name: `${String(source.display_name || "Entidade")} (Copia)`,
      physical_table_name: `${String(source.physical_table_name || source.name || "custom_entity")}_copy_${suffix}`,
      description: source.description || null,
    };

    const clone = await api("/api/metadata/entities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(clonePayload),
    });

    await loadEntities();
    if (clone?.id) {
      window.location.href = `/configuracoes/metadata-designer/${encodeURIComponent(clone.id)}`;
    }
  }

  async function archiveSelected() {
    const selected = selectedEntities();
    if (!selected.length) {
      window.alert("Selecione ao menos uma entidade CUSTOM para arquivar.");
      return;
    }

    for (const row of selected) {
      if (String(row.entity_type || "").toUpperCase() !== "CUSTOM") {
        window.alert("Somente entidades CUSTOM podem ser arquivadas.");
        return;
      }
    }

    const ok = await window.confirm("Arquivar as entidades CUSTOM selecionadas?");
    if (!ok) return;

    for (const row of selected) {
      await api(`/api/metadata/entities/${encodeURIComponent(row.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: false }),
      });
    }

    await loadEntities();
  }

  function bindEvents() {
    $("#btnMdRefresh").on("click", function () {
      state.syncCoreNextLoad = true;
      loadEntities().catch((error) => window.alert(error.message || "Falha ao carregar entidades."));
    });

    $("#btnMdOpenDesigner").on("click", openDesignerForSelected);
    $("#btnMdPublish").on("click", function () {
      publishSelected().catch((error) => window.alert(error.message || "Falha ao publicar entidades."));
    });
    $("#btnMdClone").on("click", function () {
      cloneSelected().catch((error) => window.alert(error.message || "Falha ao clonar entidade."));
    });
    $("#btnMdArchive").on("click", function () {
      archiveSelected().catch((error) => window.alert(error.message || "Falha ao arquivar entidade."));
    });

    $("#btnMdSearchClear").on("click", function () {
      if (!state.search) return;
      state.search = "";
      $("#mdSearchName").val("");
      loadEntities({ resetPage: true }).catch((error) => window.alert(error.message || "Falha ao pesquisar entidades."));
    });

    $("#mdSearchName").on("keydown", function (ev) {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      const term = String($(this).val() || "").trim();
      if (state.search === term) return;
      state.search = term;
      loadEntities({ resetPage: true }).catch((error) => window.alert(error.message || "Falha ao pesquisar entidades."));
    });

    $("#mdSearchName").on("input", function () {
      const term = String($(this).val() || "").trim();
      window.clearTimeout(state.searchTimer);
      state.searchTimer = window.setTimeout(function () {
        if (state.search === term) return;
        state.search = term;
        loadEntities({ resetPage: true }).catch((error) => window.alert(error.message || "Falha ao pesquisar entidades."));
      }, 350);
    });

    $(document).on("click", "#btnMdSearchStateClear", function () {
      state.search = "";
      $("#mdSearchName").val("");
      loadEntities({ resetPage: true }).catch((error) => window.alert(error.message || "Falha ao pesquisar entidades."));
    });

    $(document).on("click", ".js-md-page-btn", function () {
      const target = Number($(this).data("page") || 0);
      const totalPages = Math.max(1, Math.ceil(state.total / state.pageSize));
      if (!Number.isFinite(target) || target < 1 || target > totalPages || target === state.page) return;
      state.page = target;
      loadEntities().catch((error) => window.alert(error.message || "Falha ao trocar pagina."));
    });

    $("#btnMdNewEntity").on("click", function () {
      $("#mdEntityDisplayName").val("");
      $("#mdEntityName").val("");
      $("#mdEntityPhysicalTableName").val("");
      $("#mdEntityDescription").val("");
      $("#mdEntityModal").modal("show");
    });
    $("#btnMdSaveEntity").on("click", function () {
      saveEntity().catch((error) => window.alert(error.message || "Falha ao criar entidade."));
    });

    $("#mdChkAll").on("change", function () {
      const checked = !!this.checked;
      state.entities.forEach((row) => {
        const id = String(row.id || "");
        if (!id) return;
        if (checked) state.selectedIds.add(id);
        else state.selectedIds.delete(id);
      });
      renderTable();
    });

    $(document).on("change", ".md-row-check", function (ev) {
      ev.stopPropagation();
      const id = String($(this).data("id") || "");
      if (!id) return;
      if (this.checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      syncCheckAll();
    });

    $(document).on("click", "#metadataEntitiesTable tbody tr", function (ev) {
      const target = ev.target;
      if (target && target.tagName === "INPUT") return;
      const id = String($(this).data("id") || "");
      if (!id) return;
      if (state.selectedIds.has(id)) state.selectedIds.delete(id);
      else state.selectedIds.add(id);
      renderTable();
    });
  }

  $(function () {
    $("#masterHeader").hide();
    $("#pageName").text("Designer de Tabelas e Formularios");
    $("#subpageName").text("Configuracoes").attr("href", "/configuracoes");
    $("#path").show();
    $("#subSecoundPageName").text("Metadata Designer").attr("href", "/configuracoes/metadata-designer");

    bindEvents();
    loadEntities().catch((error) => {
      window.alert(error.message || "Falha ao carregar entidades.");
    });
  });
})();
