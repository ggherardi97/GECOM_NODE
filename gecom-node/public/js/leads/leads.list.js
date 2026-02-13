(function () {
  const api = window.GECOM_API;

  const state = {
    leads: [],
    filtered: [],
    owners: [],
    page: 1,
    pageSize: 20,
    totalPages: 1,
    sort: { field: "", dir: "asc" },
    filters: {
      q: "",
      owner_user_id: "",
      status: "",
      source: "",
      created_from: "",
      created_to: "",
    },
    savedView: {
      viewId: null,
      name: "",
      columns: [],
      columns_order: [],
      filters: [],
      sort: [],
      pageSize: 20,
    },
  };

  function t(key, fallback) {
    try {
      if (typeof window.t === "function") return window.t(key, { defaultValue: fallback || key });
    } catch {}
    return fallback || key;
  }

  function esc(v) {
    if (v == null) return "";
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function toast(message, type) {
    if (window.toastr && typeof window.toastr[type || "info"] === "function") {
      window.toastr[type || "info"](message);
      return;
    }
    alert(message);
  }

  function datePt(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  }

  function money(v, cc) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return "";
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: cc || "BRL" }).format(n);
    } catch {
      return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    }
  }

  function parsePtDate(value, endOfDay) {
    const raw = String(value || "").trim();
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  function listToArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  function getLeadTitle(lead) {
    return lead?.name || lead?.title || `${lead?.first_name || ""} ${lead?.last_name || ""}`.trim() || "-";
  }

  function getOwner(lead) {
    return lead?.owner_user?.full_name || lead?.owner?.full_name || lead?.owner_name || lead?.owner_user_id || "";
  }

  function normalizeForCompare(v) {
    if (v == null) return "";
    return String(v).toLowerCase();
  }

  function matchesFilters(lead) {
    const q = normalizeForCompare(state.filters.q).trim();
    const owner = String(state.filters.owner_user_id || "").trim();
    const status = normalizeForCompare(state.filters.status).trim();
    const source = normalizeForCompare(state.filters.source).trim();
    const from = parsePtDate(state.filters.created_from, false);
    const to = parsePtDate(state.filters.created_to, true);

    const hay = normalizeForCompare([
      getLeadTitle(lead),
      lead?.company_name,
      lead?.email,
      lead?.phone,
      getOwner(lead),
      lead?.source,
      lead?.status,
    ].join(" "));

    if (q && !hay.includes(q)) return false;
    if (owner && String(lead?.owner_user_id || "") !== owner) return false;
    if (status && normalizeForCompare(lead?.status) !== status) return false;
    if (source && normalizeForCompare(lead?.source) !== source) return false;

    if (from || to) {
      const created = lead?.created_at ? new Date(lead.created_at) : null;
      if (!created || Number.isNaN(created.getTime())) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
    }

    return true;
  }

  function sortFiltered() {
    const { field, dir } = state.sort;
    if (!field) return;
    const factor = dir === "desc" ? -1 : 1;
    state.filtered.sort((a, b) => {
      let av;
      let bv;
      if (field === "estimated_value") {
        av = Number(a[field] || 0);
        bv = Number(b[field] || 0);
      } else if (field === "created_at") {
        av = new Date(a.created_at || 0).getTime();
        bv = new Date(b.created_at || 0).getTime();
      } else if (field === "owner") {
        av = normalizeForCompare(getOwner(a));
        bv = normalizeForCompare(getOwner(b));
      } else if (field === "stage") {
        av = normalizeForCompare(a?.stage?.name || "");
        bv = normalizeForCompare(b?.stage?.name || "");
      } else {
        av = normalizeForCompare(a[field] || (field === "name" ? getLeadTitle(a) : ""));
        bv = normalizeForCompare(b[field] || (field === "name" ? getLeadTitle(b) : ""));
      }
      if (av < bv) return -1 * factor;
      if (av > bv) return 1 * factor;
      return 0;
    });
  }

  function recalc() {
    state.filtered = state.leads.filter(matchesFilters);
    sortFiltered();
    state.totalPages = Math.max(1, Math.ceil(state.filtered.length / state.pageSize));
    if (state.page > state.totalPages) state.page = state.totalPages;
  }

  function renderPager() {
    $("#leadListPageInfo").text(`${state.page} / ${state.totalPages}`);
    $("#leadListPrev").prop("disabled", state.page <= 1);
    $("#leadListNext").prop("disabled", state.page >= state.totalPages);
  }

  function renderTable() {
    const tbody = $("#leadListRows");
    tbody.empty();

    recalc();
    const start = (state.page - 1) * state.pageSize;
    const pageRows = state.filtered.slice(start, start + state.pageSize);

    if (!pageRows.length) {
      tbody.append(`<tr><td colspan="11">${esc(t("page.leads.list.noResults", "Nenhum lead encontrado"))}</td></tr>`);
      renderPager();
      return;
    }

    pageRows.forEach((lead, idx) => {
      tbody.append(`
        <tr data-id="${esc(lead.id)}" class="lead-row">
          <td>${start + idx + 1}</td>
          <td>${esc(getLeadTitle(lead))}</td>
          <td>${esc(lead.company_name || "-")}</td>
          <td>${esc(lead.email || "-")}</td>
          <td>${esc(lead.phone || "-")}</td>
          <td>${esc(lead.status || "-")}</td>
          <td>${esc(lead.stage?.name || "-")}</td>
          <td>${esc(getOwner(lead) || "-")}</td>
          <td>${esc(lead.source || "-")}</td>
          <td>${esc(money(lead.estimated_value, lead.currency_code))}</td>
          <td>
            <button type="button" class="btn btn-xs btn-default js-open"><i class="fa fa-eye"></i></button>
            <button type="button" class="btn btn-xs btn-primary js-edit"><i class="fa fa-pencil"></i></button>
          </td>
        </tr>
      `);
    });

    renderPager();
  }

  function getAllColumnKeys() {
    return $("#leadListHeaderRow th.sortable")
      .map(function () { return String($(this).data("sort-key") || ""); })
      .get()
      .filter(Boolean);
  }

  function captureFiltersForSavedView() {
    const f = [];
    if (state.filters.q) f.push({ field: "q", op: "contains", value: state.filters.q });
    if (state.filters.owner_user_id) f.push({ field: "owner_user_id", op: "eq", value: state.filters.owner_user_id });
    if (state.filters.status) f.push({ field: "status", op: "eq", value: state.filters.status });
    if (state.filters.source) f.push({ field: "source", op: "eq", value: state.filters.source });
    if (state.filters.created_from) f.push({ field: "created_at", op: "gte", value: state.filters.created_from });
    if (state.filters.created_to) f.push({ field: "created_at", op: "lte", value: state.filters.created_to });
    return f;
  }

  function applyFiltersFromSavedView(def) {
    state.filters = { q: "", owner_user_id: "", status: "", source: "", created_from: "", created_to: "" };
    (def.filters || []).forEach((x) => {
      const field = String(x.field || "");
      const value = String(x.value || "");
      const op = String(x.op || "").toLowerCase();
      if (!value) return;
      if (field === "q") state.filters.q = value;
      if (field === "owner_user_id") state.filters.owner_user_id = value;
      if (field === "status") state.filters.status = value;
      if (field === "source") state.filters.source = value;
      if (field === "created_at" && op === "gte") state.filters.created_from = value;
      if (field === "created_at" && op === "lte") state.filters.created_to = value;
    });

    $("#leadListSearch").val(state.filters.q);
    $("#leadListOwner").val(state.filters.owner_user_id);
    $("#leadListStatus").val(state.filters.status);
    $("#leadListSource").val(state.filters.source);
    const range = state.filters.created_from && state.filters.created_to ? `${state.filters.created_from} - ${state.filters.created_to}` : "";
    $("#leadListCreatedRange").val(range);
  }

  function applySortFromSavedView(def) {
    const first = Array.isArray(def.sort) ? def.sort[0] : null;
    if (!first) {
      state.sort = { field: "", dir: "asc" };
      return;
    }
    state.sort.field = String(first.field || "");
    state.sort.dir = String(first.dir || "asc").toLowerCase() === "desc" ? "desc" : "asc";
  }

  function updateSortIndicators() {
    $("#leadListHeaderRow th.sortable .sort-indicator").text("");
    if (!state.sort.field) return;
    const th = $(`#leadListHeaderRow th.sortable[data-sort-key='${state.sort.field}']`);
    th.find(".sort-indicator").text(state.sort.dir === "asc" ? "▲" : "▼");
  }

  async function loadOwners() {
    const users = listToArray(await api.get("/api/users"));
    state.owners = users;
    const sel = $("#leadListOwner");
    sel.empty().append(`<option value="">${esc(t("page.leads.filters.allOwners", "Todos os responsáveis"))}</option>`);
    users.forEach((u) => {
      const id = String(u?.id || "").trim();
      if (!id) return;
      const nm = String(u?.full_name || u?.name || u?.email || id);
      sel.append(`<option value="${esc(id)}">${esc(nm)}</option>`);
    });
  }

  async function loadLeads() {
    const data = await api.get("/api/leads");
    state.leads = listToArray(data);
  }

  function bindRows() {
    $("#leadListRows").off("click").on("click", "button", function () {
      const row = $(this).closest("tr");
      const id = String(row.data("id") || "");
      if (!id) return;
      if ($(this).hasClass("js-open")) window.location.href = `/leads/${encodeURIComponent(id)}`;
      if ($(this).hasClass("js-edit")) window.location.href = `/leads/${encodeURIComponent(id)}/edit`;
    });

    $("#leadListRows").on("dblclick", "tr.lead-row", function () {
      const id = String($(this).data("id") || "");
      if (id) window.location.href = `/leads/${encodeURIComponent(id)}`;
    });
  }

  function initDateRange() {
    const $r = $("#leadListCreatedRange");
    if (!$r.length || !$.fn.daterangepicker || !window.moment) return;
    if ($r.data("daterangepicker")) $r.data("daterangepicker").remove();
    $r.daterangepicker({
      autoUpdateInput: false,
      locale: {
        format: "DD/MM/YYYY",
        cancelLabel: t("page.leads.common.clear", "Limpar"),
        applyLabel: t("page.leads.common.apply", "Aplicar"),
        fromLabel: t("page.leads.common.from", "De"),
        toLabel: t("page.leads.common.to", "Até"),
        daysOfWeek: ["Do", "Se", "Te", "Qa", "Qi", "Se", "Sa"],
        monthNames: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"],
      },
    });

    $r.on("apply.daterangepicker", function (_ev, picker) {
      state.filters.created_from = picker.startDate.format("DD/MM/YYYY");
      state.filters.created_to = picker.endDate.format("DD/MM/YYYY");
      $(this).val(`${state.filters.created_from} - ${state.filters.created_to}`);
      state.page = 1;
      renderTable();
    });
    $r.on("cancel.daterangepicker", function () {
      state.filters.created_from = "";
      state.filters.created_to = "";
      $(this).val("");
      state.page = 1;
      renderTable();
    });
    $("#leadListCreatedRangeBtn").on("click", function (e) {
      e.preventDefault();
      if ($r.data("daterangepicker")) $r.data("daterangepicker").show();
    });
  }

  function bindFilters() {
    $("#leadListSearch").on("input", function () {
      state.filters.q = String(this.value || "");
      state.page = 1;
      renderTable();
    });
    $("#leadListOwner").on("change", function () {
      state.filters.owner_user_id = String(this.value || "");
      state.page = 1;
      renderTable();
    });
    $("#leadListStatus").on("change", function () {
      state.filters.status = String(this.value || "");
      state.page = 1;
      renderTable();
    });
    $("#leadListSource").on("change", function () {
      state.filters.source = String(this.value || "");
      state.page = 1;
      renderTable();
    });
    $("#leadListFiltersClear").on("click", function () {
      state.filters = { q: "", owner_user_id: "", status: "", source: "", created_from: "", created_to: "" };
      $("#leadListSearch,#leadListCreatedRange").val("");
      $("#leadListOwner,#leadListStatus,#leadListSource").val("");
      state.page = 1;
      renderTable();
    });
  }

  function bindSort() {
    $("#leadListHeaderRow th.sortable").on("click", function () {
      const key = String($(this).data("sort-key") || "");
      if (!key) return;
      if (state.sort.field === key) state.sort.dir = state.sort.dir === "asc" ? "desc" : "asc";
      else state.sort = { field: key, dir: "asc" };
      updateSortIndicators();
      renderTable();
    });
  }

  function bindPager() {
    $("#leadListPrev").on("click", function () {
      if (state.page > 1) {
        state.page -= 1;
        renderTable();
      }
    });
    $("#leadListNext").on("click", function () {
      if (state.page < state.totalPages) {
        state.page += 1;
        renderTable();
      }
    });
    $("#leadListPageSize").on("change", function () {
      const n = Number(this.value || 20);
      state.pageSize = n > 0 ? n : 20;
      state.page = 1;
      renderTable();
    });
  }

  function tryTriggerAny(selectors) {
    for (const s of selectors) {
      const el = $(s);
      if (el.length) {
        el.trigger("click");
        return true;
      }
    }
    return false;
  }

  function ensureSavedViewsExtraButtons() {
    const host = $("#leadsSavedViewsHost");
    if (!host.length) return;
    const actions = host.find(".sv-actions").length ? host.find(".sv-actions").first() : host;

    if (!$("#btnSaveCurrentLeadsView").length) {
      actions.append(`
        <button id="btnSaveCurrentLeadsView" class="btn btn-white btn-xs sv-actionbar-btn" style="margin-left: 8px;" title="${esc(t("page.layout.savedViews.saveCurrentTitle", "Salvar a view atual"))}">
          <i class="fa fa-check"></i> ${esc(t("page.layout.savedViews.saveLabel", "Salvar"))}
        </button>
      `);
    }

    if (!$("#btnDeleteCurrentLeadsView").length) {
      actions.append(`
        <button id="btnDeleteCurrentLeadsView" class="btn btn-danger btn-xs sv-actionbar-btn" style="margin-left: 6px; display:none;" title="${esc(t("page.layout.savedViews.deleteCurrentTitle", "Excluir esta view"))}">
          <i class="fa fa-trash"></i> ${esc(t("page.layout.savedViews.deleteLabel", "Deletar view"))}
        </button>
      `);
    }

    if (state.savedView.viewId) $("#btnDeleteCurrentLeadsView").show();
    else $("#btnDeleteCurrentLeadsView").hide();

    $("#btnSaveCurrentLeadsView").off("click.svSaveCurrent").on("click.svSaveCurrent", function (e) {
      e.preventDefault();
      e.stopPropagation();

      const did = tryTriggerAny(["#sv_btnSave", "[data-action='save']", ".sv-btn-save"]);
      if (did) return;

      if (state.savedView.viewId) {
        (async () => {
          try {
            const payload = {
              name: state.savedView.name || undefined,
              definition_json: {
                columns: state.savedView.columns,
                columns_order: state.savedView.columns_order,
                filters: captureFiltersForSavedView(),
                sort: state.sort.field ? [{ field: state.sort.field, dir: state.sort.dir }] : [],
                pageSize: state.pageSize,
              },
            };
            await api.put(`/api/saved-views/${encodeURIComponent(state.savedView.viewId)}`, payload);
            if (typeof window.SavedViewsGrid?.reload === "function") window.SavedViewsGrid.reload();
            toast(t("page.leads.messages.saved", "View salva"), "success");
          } catch (err) {
            console.error(err);
            toast(err?.message || t("page.leads.messages.savedViewsError", "Falha ao salvar view"), "error");
          }
        })();
        return;
      }

      tryTriggerAny(["#sv_btnSaveAs", "[data-action='saveas']", ".sv-btn-saveas"]);
    });

    $("#btnDeleteCurrentLeadsView").off("click.svDeleteCurrent").on("click.svDeleteCurrent", function (e) {
      e.preventDefault();
      e.stopPropagation();
      if (!state.savedView.viewId) return;

      if (!confirm(t("page.layout.savedViews.deleteCurrentConfirm", "Excluir a view selecionada?"))) return;

      const did = tryTriggerAny(["#sv_btnDelete", "[data-action='delete']", ".sv-btn-delete"]);
      if (did) return;

      (async () => {
        try {
          await api.delete(`/api/saved-views/${encodeURIComponent(state.savedView.viewId)}`);
          state.savedView.viewId = null;
          state.savedView.name = "";
          if (typeof window.SavedViewsGrid?.reload === "function") window.SavedViewsGrid.reload();
        } catch (err) {
          console.error(err);
          toast(err?.message || t("page.leads.messages.savedViewsError", "Falha ao excluir view"), "error");
        }
      })();
    });
  }

  function initSavedViews() {
    if (!window.SavedViewsGrid) return;
    const allKeys = getAllColumnKeys();
    state.savedView.columns = allKeys.slice();
    state.savedView.columns_order = allKeys.slice();

    window.SavedViewsGrid.init({
      entityName: "leads",
      hostSelector: "#leadsSavedViewsHost",
      tableSelector: "#leadsListTable",
      headerRowSelector: "#leadsListTable thead tr:eq(1)",
      filtersRowSelector: "#leadsListTable thead tr:eq(0)",
      getAllColumnKeys: () => getAllColumnKeys(),
      fallbackViewName: "",
      includeFallbackOption: false,
      fallbackDefinition: { columns: allKeys.slice(), columns_order: allKeys.slice(), filters: [], sort: [], pageSize: state.pageSize },
      getCurrentState: () => {
        const domOrder = $("#leadListHeaderRow th.sortable").map(function () { return String($(this).data("sort-key") || ""); }).get().filter(Boolean);
        const visible = $("#leadListHeaderRow th.sortable:visible").map(function () { return String($(this).data("sort-key") || ""); }).get().filter(Boolean);
        state.savedView.columns_order = domOrder.length ? domOrder : state.savedView.columns_order;
        state.savedView.columns = visible.length ? visible : state.savedView.columns;
        state.savedView.filters = captureFiltersForSavedView();
        state.savedView.sort = state.sort.field ? [{ field: state.sort.field, dir: state.sort.dir }] : [];
        state.savedView.pageSize = state.pageSize;
        return Object.assign({}, state.savedView);
      },
      applyState: ({ viewId, name, definition }) => {
        state.savedView.viewId = viewId;
        state.savedView.name = name || "";
        applyFiltersFromSavedView(definition || {});
        applySortFromSavedView(definition || {});
        if (definition?.pageSize) {
          state.pageSize = Number(definition.pageSize) || state.pageSize;
          $("#leadListPageSize").val(String(state.pageSize));
        }
        state.page = 1;
        updateSortIndicators();
        renderTable();
        ensureSavedViewsExtraButtons();
      },
      onAfterApply: () => {
        updateSortIndicators();
        renderTable();
        ensureSavedViewsExtraButtons();
      },
    }).catch((e) => {
      console.error(e);
      toast(t("page.leads.messages.savedViewsError", "Falha ao carregar views salvas"), "warning");
    });

    setTimeout(ensureSavedViewsExtraButtons, 100);
  }

  async function init() {
    $("#pageName").text(t("page.leads.list.title", "Leads - Lista"));
    $("#subpageName").text(t("page.leads.list.title", "Leads - Lista"));

    try {
      await Promise.all([loadOwners(), loadLeads()]);
      bindRows();
      bindFilters();
      bindSort();
      bindPager();
      initDateRange();
      initSavedViews();
      updateSortIndicators();
      renderTable();
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.loadError", "Erro ao carregar leads"), "error");
    }
  }

  $(document).ready(init);
})();
