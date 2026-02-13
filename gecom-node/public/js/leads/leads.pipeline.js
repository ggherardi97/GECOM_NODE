(function () {
  const api = window.GECOM_API;

  const state = {
    stages: [],
    leads: [],
    owners: [],
    filters: {
      q: "",
      owner_user_id: "",
      status: "",
      source: "",
      created_from: "",
      created_to: "",
    },
    drag: {
      leadId: null,
      fromStageId: null,
      fromIndex: -1,
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
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message, type) {
    if (window.toastr && typeof window.toastr[type || "info"] === "function") {
      window.toastr[type || "info"](message);
      return;
    }
    alert(message);
  }

  function money(value, currencyCode) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "";
    const code = currencyCode || "BRL";
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: code }).format(n);
    } catch {
      return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    }
  }

  function datePt(v) {
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR");
  }

  function parsePtDate(value, endOfDay) {
    const raw = String(value || "").trim();
    const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), endOfDay ? 23 : 0, endOfDay ? 59 : 0, endOfDay ? 59 : 0, endOfDay ? 999 : 0);
  }

  function statusBadgeClass(status) {
    const s = String(status || "").toUpperCase();
    if (s === "CONVERTED" || s === "WON") return "label label-primary";
    if (s === "DISQUALIFIED" || s === "LOST") return "label label-danger";
    if (s === "WORKING") return "label label-info";
    return "label label-default";
  }

  function getLeadTitle(lead) {
    return lead?.name || lead?.title || `${lead?.first_name || ""} ${lead?.last_name || ""}`.trim() || t("page.leads.common.withoutName", "Sem nome");
  }

  function getOwnerName(lead) {
    return lead?.owner_user?.full_name || lead?.owner?.full_name || lead?.owner_name || lead?.owner_user_id || "";
  }

  function getStageId(lead) {
    return lead?.stage_id || lead?.stage?.id || "";
  }

  function getStageName(lead) {
    return lead?.stage?.name || "";
  }

  function leadMatchesFilters(lead) {
    const q = String(state.filters.q || "").toLowerCase().trim();
    const owner = String(state.filters.owner_user_id || "").trim();
    const status = String(state.filters.status || "").trim().toUpperCase();
    const source = String(state.filters.source || "").trim().toUpperCase();
    const from = parsePtDate(state.filters.created_from, false);
    const to = parsePtDate(state.filters.created_to, true);

    const hay = [
      getLeadTitle(lead),
      lead?.email,
      lead?.phone,
      lead?.company_name,
      getOwnerName(lead),
    ].join(" ").toLowerCase();

    if (q && !hay.includes(q)) return false;
    if (owner && String(lead?.owner_user_id || "") !== owner) return false;
    if (status && String(lead?.status || "").toUpperCase() !== status) return false;
    if (source && String(lead?.source || "").toUpperCase() !== source) return false;

    if (from || to) {
      const created = lead?.created_at ? new Date(lead.created_at) : null;
      if (!created || Number.isNaN(created.getTime())) return false;
      if (from && created < from) return false;
      if (to && created > to) return false;
    }

    return true;
  }

  function groupedByStage() {
    const map = new Map();
    state.stages.forEach((s) => map.set(String(s.id), []));
    state.leads.filter(leadMatchesFilters).forEach((lead) => {
      const sid = String(getStageId(lead) || "");
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid).push(lead);
    });
    return map;
  }

  function renderOwners() {
    const sel = $("#leadOwnerFilter");
    if (!sel.length) return;
    const current = sel.val();
    sel.empty().append(`<option value="">${esc(t("page.leads.filters.allOwners", "Todos os responsáveis"))}</option>`);
    state.owners.forEach((u) => {
      const id = String(u?.id || "").trim();
      const name = String(u?.full_name || u?.name || u?.email || id).trim();
      if (!id) return;
      sel.append(`<option value="${esc(id)}">${esc(name)}</option>`);
    });
    if (current) sel.val(current);
  }

  function cardHtml(lead) {
    return `
      <div class="lead-card" draggable="true" data-lead-id="${esc(lead.id)}" data-stage-id="${esc(getStageId(lead))}">
        <div class="lead-card-top">
          <strong class="lead-title">${esc(getLeadTitle(lead))}</strong>
          <span class="${esc(statusBadgeClass(lead.status))}">${esc(lead.status || "OPEN")}</span>
        </div>
        <div class="lead-sub">${esc(lead.company_name || "-")}</div>
        <div class="lead-meta">
          <span><i class="fa fa-money"></i> ${esc(money(lead.estimated_value, lead.currency_code))}</span>
          <span><i class="fa fa-calendar"></i> ${esc(datePt(lead.next_action_at || lead.created_at))}</span>
        </div>
        <div class="lead-meta">
          <span><i class="fa fa-user"></i> ${esc(getOwnerName(lead))}</span>
          <span><i class="fa fa-flag"></i> ${esc(getStageName(lead))}</span>
        </div>
        <div class="lead-actions">
          <button type="button" class="btn btn-xs btn-default js-edit" title="${esc(t("page.leads.actions.edit", "Editar"))}">
            <i class="fa fa-pencil"></i>
          </button>
          <button type="button" class="btn btn-xs btn-primary js-win" title="${esc(t("page.leads.actions.win", "Ganhar"))}">
            <i class="fa fa-trophy"></i>
          </button>
          <button type="button" class="btn btn-xs btn-danger js-lose" title="${esc(t("page.leads.actions.lose", "Perder"))}">
            <i class="fa fa-times"></i>
          </button>
        </div>
      </div>
    `;
  }

  function renderBoard() {
    const grouped = groupedByStage();
    const wrap = $("#leadsPipelineBoard");
    wrap.empty();

    state.stages.forEach((stage) => {
      const items = grouped.get(String(stage.id)) || [];
      const total = items.reduce((acc, cur) => acc + Number(cur.estimated_value || 0), 0);
      const cards = items.map(cardHtml).join("");
      const col = `
        <div class="lead-column" data-stage-id="${esc(stage.id)}">
          <div class="lead-column-head">
            <h4>${esc(stage.name || "-")}</h4>
            <div class="lead-column-counters">
              <span class="badge badge-info">${items.length}</span>
              <small>${esc(money(total, "BRL"))}</small>
            </div>
          </div>
          <div class="lead-column-body js-dropzone" data-stage-id="${esc(stage.id)}">
            ${cards || `<div class="empty-col">${esc(t("page.leads.pipeline.emptyColumn", "Sem leads neste estágio"))}</div>`}
          </div>
        </div>
      `;
      wrap.append(col);
    });
  }

  function listToArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  async function loadStages() {
    const res = await api.get("/api/leads/stages");
    state.stages = listToArray(res);
  }

  async function loadLeads() {
    const qs = new URLSearchParams();
    if (state.filters.q) qs.set("q", state.filters.q);
    if (state.filters.owner_user_id) qs.set("owner_user_id", state.filters.owner_user_id);
    if (state.filters.status) qs.set("status", state.filters.status);
    if (state.filters.source) qs.set("source", state.filters.source);
    const url = `/api/leads${qs.toString() ? `?${qs.toString()}` : ""}`;
    const res = await api.get(url);
    state.leads = listToArray(res);
  }

  async function loadOwners() {
    const res = await api.get("/api/users");
    state.owners = listToArray(res);
  }

  function setLoading(isLoading) {
    const el = $("#leadsPipelineLoading");
    if (!el.length) return;
    el.toggle(!!isLoading);
  }

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([loadStages(), loadLeads(), loadOwners()]);
      renderOwners();
      renderBoard();
      bindBoardEvents();
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.loadError", "Erro ao carregar leads"), "error");
    } finally {
      setLoading(false);
    }
  }

  function rememberDrag(card) {
    const parent = card.closest(".js-dropzone");
    const siblings = parent ? Array.from(parent.querySelectorAll(".lead-card")) : [];
    state.drag.leadId = card.getAttribute("data-lead-id");
    state.drag.fromStageId = card.getAttribute("data-stage-id") || (parent ? parent.getAttribute("data-stage-id") : "");
    state.drag.fromIndex = siblings.findIndex((el) => el.getAttribute("data-lead-id") === state.drag.leadId);
  }

  function revertLeadPosition() {
    const lead = state.leads.find((x) => String(x.id) === String(state.drag.leadId));
    if (!lead) return;
    lead.stage_id = state.drag.fromStageId || lead.stage_id;
    renderBoard();
    bindBoardEvents();
  }

  async function moveLead(leadId, targetStageId) {
    const lead = state.leads.find((x) => String(x.id) === String(leadId));
    if (!lead) return;
    const from = String(getStageId(lead) || "");
    if (from === String(targetStageId || "")) return;

    lead.stage_id = targetStageId;
    renderBoard();
    bindBoardEvents();

    try {
      await api.post(`/api/leads/${encodeURIComponent(leadId)}/stage`, { stage_id: targetStageId });
      await loadLeads();
      renderBoard();
      bindBoardEvents();
      toast(t("page.leads.messages.stageUpdated", "Estágio atualizado"), "success");
    } catch (e) {
      console.error(e);
      revertLeadPosition();
      toast(e?.message || t("page.leads.messages.stageUpdateError", "Falha ao mover lead"), "error");
    }
  }

  function openStatusModal(mode, leadId) {
    const modal = $("#leadStatusModal");
    const title = mode === "win"
      ? t("page.leads.modal.winTitle", "Marcar lead como ganho")
      : t("page.leads.modal.loseTitle", "Marcar lead como perdido");
    $("#leadStatusTitle").text(title);
    $("#leadStatusLeadId").val(leadId);
    $("#leadStatusMode").val(mode);
    $("#leadStatusReason").val("");
    $("#leadStatusNotes").val("");
    modal.modal("show");
  }

  async function submitStatusModal() {
    const leadId = String($("#leadStatusLeadId").val() || "");
    const mode = String($("#leadStatusMode").val() || "");
    const reason = String($("#leadStatusReason").val() || "");
    const notes = String($("#leadStatusNotes").val() || "");
    if (!leadId || !mode) return;

    try {
      if (mode === "win") {
        await api.post(`/api/leads/${encodeURIComponent(leadId)}/convert`, {});
      } else {
        await api.patch(`/api/leads/${encodeURIComponent(leadId)}`, {
          status: "DISQUALIFIED",
          disqualify_reason: reason || null,
          notes: notes || null,
        });
      }
      $("#leadStatusModal").modal("hide");
      await loadLeads();
      renderBoard();
      bindBoardEvents();
      toast(t("page.leads.messages.statusUpdated", "Status atualizado"), "success");
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.statusUpdateError", "Falha ao atualizar status"), "error");
    }
  }

  function bindBoardEvents() {
    const board = document.getElementById("leadsPipelineBoard");
    if (!board) return;

    board.querySelectorAll(".lead-card").forEach((card) => {
      card.addEventListener("dragstart", (ev) => {
        rememberDrag(card);
        ev.dataTransfer.effectAllowed = "move";
        ev.dataTransfer.setData("text/plain", card.getAttribute("data-lead-id") || "");
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
      });

      card.addEventListener("click", (ev) => {
        const target = ev.target;
        if (target.closest(".js-edit")) {
          ev.preventDefault();
          ev.stopPropagation();
          const id = card.getAttribute("data-lead-id");
          window.location.href = `/leads/${encodeURIComponent(id)}/edit`;
          return;
        }
        if (target.closest(".js-win")) {
          ev.preventDefault();
          ev.stopPropagation();
          openStatusModal("win", card.getAttribute("data-lead-id"));
          return;
        }
        if (target.closest(".js-lose")) {
          ev.preventDefault();
          ev.stopPropagation();
          openStatusModal("lose", card.getAttribute("data-lead-id"));
          return;
        }
        const id = card.getAttribute("data-lead-id");
        if (id) window.location.href = `/leads/${encodeURIComponent(id)}`;
      });
    });

    board.querySelectorAll(".js-dropzone").forEach((zone) => {
      zone.addEventListener("dragover", (ev) => {
        ev.preventDefault();
        zone.classList.add("over");
      });
      zone.addEventListener("dragleave", () => {
        zone.classList.remove("over");
      });
      zone.addEventListener("drop", (ev) => {
        ev.preventDefault();
        zone.classList.remove("over");
        const leadId = ev.dataTransfer.getData("text/plain");
        const stageId = zone.getAttribute("data-stage-id");
        if (leadId && stageId) moveLead(leadId, stageId);
      });
    });
  }

  function bindFilters() {
    $("#leadSearchFilter").on("input", function () {
      state.filters.q = String(this.value || "");
      renderBoard();
      bindBoardEvents();
    });

    $("#leadOwnerFilter").on("change", function () {
      state.filters.owner_user_id = String(this.value || "");
      renderBoard();
      bindBoardEvents();
    });

    $("#leadStatusFilter").on("change", function () {
      state.filters.status = String(this.value || "");
      renderBoard();
      bindBoardEvents();
    });

    $("#leadSourceFilter").on("change", function () {
      state.filters.source = String(this.value || "");
      renderBoard();
      bindBoardEvents();
    });

    $("#leadCreatedRangeFilter").on("apply.daterangepicker", function (_ev, picker) {
      state.filters.created_from = picker.startDate.format("DD/MM/YYYY");
      state.filters.created_to = picker.endDate.format("DD/MM/YYYY");
      $(this).val(`${state.filters.created_from} - ${state.filters.created_to}`);
      renderBoard();
      bindBoardEvents();
    });

    $("#leadCreatedRangeFilter").on("cancel.daterangepicker", function () {
      state.filters.created_from = "";
      state.filters.created_to = "";
      $(this).val("");
      renderBoard();
      bindBoardEvents();
    });

    $("#leadCreatedRangeBtn").on("click", function (e) {
      e.preventDefault();
      const input = $("#leadCreatedRangeFilter");
      if (input.data("daterangepicker")) input.data("daterangepicker").show();
    });

    $("#btnLeadFiltersClear").on("click", function () {
      state.filters = { q: "", owner_user_id: "", status: "", source: "", created_from: "", created_to: "" };
      $("#leadSearchFilter,#leadCreatedRangeFilter").val("");
      $("#leadOwnerFilter,#leadStatusFilter,#leadSourceFilter").val("");
      renderOwners();
      renderBoard();
      bindBoardEvents();
    });
  }

  function bindActions() {
    $("#btnLeadStatusSave").on("click", submitStatusModal);
    $("#btnLeadNew").on("click", () => { window.location.href = "/leads/new"; });
    $("#btnLeadList").on("click", () => { window.location.href = "/leads"; });
  }

  function initDateRange() {
    const $el = $("#leadCreatedRangeFilter");
    if (!$el.length || !$.fn.daterangepicker || !window.moment) return;
    if ($el.data("daterangepicker")) $el.data("daterangepicker").remove();
    $el.daterangepicker({
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
  }

  async function init() {
    $("#pageName").text(t("page.leads.pipeline.title", "Pipeline de Leads"));
    $("#subpageName").text(t("page.leads.pipeline.title", "Pipeline de Leads"));
    bindActions();
    bindFilters();
    initDateRange();
    await refreshAll();
  }

  $(document).ready(init);
})();
