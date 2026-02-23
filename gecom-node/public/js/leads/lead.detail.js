(function () {
  const api = window.GECOM_API;

  const state = {
    leadId: "",
    lead: null,
    stages: [],
    activities: [],
    statusOptions: [],
    statusByConfigId: {},
    statusByLegacy: {},
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

  function listToArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
  }

  function normalizeStatusConfigId(value) {
    const id = String(value || "").trim();
    return id || "";
  }

  function normalizeLeadLegacyStatus(value) {
    const status = String(value || "").trim().toUpperCase();
    return status || "";
  }

  function getLeadStatusConfigId(lead) {
    return normalizeStatusConfigId(
      lead?.status_config_id ??
      lead?.statusConfigId ??
      lead?.status_config?.id ??
      lead?.statusConfig?.id ??
      ""
    );
  }

  function getLeadLegacyStatus(lead) {
    const fromConfig = normalizeLeadLegacyStatus(
      lead?.status_config?.legacy_lead_status ??
      lead?.statusConfig?.legacy_lead_status ??
      ""
    );
    if (fromConfig) return fromConfig;
    return normalizeLeadLegacyStatus(lead?.status || "");
  }

  function getLeadStatusLabel(lead) {
    const direct = String(lead?.status_config?.label || lead?.statusConfig?.label || "").trim();
    if (direct) return direct;
    const statusConfigId = getLeadStatusConfigId(lead);
    if (statusConfigId && state.statusByConfigId[statusConfigId]?.label) return state.statusByConfigId[statusConfigId].label;
    const legacy = getLeadLegacyStatus(lead);
    return legacy || "-";
  }

  function getLeadStatusColor(lead) {
    const direct = String(lead?.status_config?.color || lead?.statusConfig?.color || "").trim();
    if (direct) return direct;
    const statusConfigId = getLeadStatusConfigId(lead);
    if (statusConfigId && state.statusByConfigId[statusConfigId]?.color) return String(state.statusByConfigId[statusConfigId].color || "").trim();
    const legacy = getLeadLegacyStatus(lead);
    if (legacy && state.statusByLegacy[legacy]?.color) return String(state.statusByLegacy[legacy].color || "").trim();
    return "";
  }

  function parseLeadIdFromPath() {
    const m = (window.location.pathname || "").match(/^\/leads\/([^/]+)\/?$/);
    return m && m[1] ? decodeURIComponent(m[1]) : "";
  }

  function datePt(v) {
    if (!v) return "-";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR");
  }

  function money(v, c) {
    const n = Number(v || 0);
    if (!Number.isFinite(n)) return "-";
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: c || "BRL" }).format(n);
    } catch {
      return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    }
  }

  function renderLead() {
    const lead = state.lead || {};
    const title = lead?.name || lead?.title || `${lead?.first_name || ""} ${lead?.last_name || ""}`.trim() || "-";
    $("#leadDetailTitle").text(title);
    const statusLabel = getLeadStatusLabel(lead);
    const statusColor = getLeadStatusColor(lead);
    $("#leadDetailStatus").text(statusLabel || "-");
    if (statusColor) {
      $("#leadDetailStatus").attr("style", `background-color:${statusColor};color:#fff;`);
    } else {
      $("#leadDetailStatus").removeAttr("style");
    }
    $("#leadDetailStage").text(lead?.stage?.name || "-");
    $("#leadDetailOwner").text(lead?.owner_user?.full_name || lead?.owner_user_id || "-");

    $("#ldCompany").text(lead?.company_name || "-");
    $("#ldContact").text(`${lead?.first_name || ""} ${lead?.last_name || ""}`.trim() || "-");
    $("#ldEmail").text(lead?.email || "-");
    $("#ldPhone").text(lead?.phone || "-");
    $("#ldSource").text(lead?.source || "-");
    $("#ldValue").text(money(lead?.estimated_value, lead?.currency_code));
    $("#ldCurrency").text(lead?.currency_code || "BRL");
    $("#ldCreatedAt").text(datePt(lead?.created_at));
    $("#ldUpdatedAt").text(datePt(lead?.updated_at));
    $("#ldNotes").text(lead?.notes || "-");
  }

  function renderStageOptions() {
    const sel = $("#leadDetailMoveStage");
    sel.empty();
    state.stages.forEach((s) => {
      sel.append(`<option value="${esc(s.id)}">${esc(s.name || s.id)}</option>`);
    });
    if (state.lead?.stage_id) sel.val(state.lead.stage_id);
  }

  function renderTimeline() {
    const box = $("#leadTimeline");
    box.empty();
    box.append(`
      <li>
        <strong>${esc(t("page.leads.detail.createdAt", "Criado em"))}</strong>
        <div>${esc(datePt(state.lead?.created_at))}</div>
      </li>
      <li>
        <strong>${esc(t("page.leads.detail.updatedAt", "Atualizado em"))}</strong>
        <div>${esc(datePt(state.lead?.updated_at))}</div>
      </li>
    `);

    state.activities.forEach((a) => {
      box.append(`
        <li>
          <strong>${esc(a?.subject || a?.type || t("page.leads.detail.activity", "Atividade"))}</strong>
          <div>${esc(a?.description || "-")}</div>
          <small>${esc(datePt(a?.created_at))}</small>
        </li>
      `);
    });
  }

  async function loadData() {
    const [lead, stages, activities, statusConfigs] = await Promise.all([
      api.get(`/api/leads/${encodeURIComponent(state.leadId)}`),
      api.get("/api/leads/stages"),
      api.get(`/api/leads/${encodeURIComponent(state.leadId)}/activities`).catch(() => []),
      api.get("/api/status-configs?entity=LEAD&active=true").catch(() => []),
    ]);
    state.lead = lead;
    state.stages = listToArray(stages);
    state.activities = listToArray(activities);
    state.statusOptions = listToArray(statusConfigs)
      .map((row) => ({
        status_config_id: String(row?.id || "").trim(),
        legacy_status: normalizeLeadLegacyStatus(row?.legacy_lead_status),
        label: String(row?.label || "").trim(),
        color: String(row?.color || "").trim(),
      }))
      .filter((x) => x.status_config_id && x.label);
    state.statusByConfigId = {};
    state.statusByLegacy = {};
    state.statusOptions.forEach((x) => {
      state.statusByConfigId[String(x.status_config_id)] = x;
      if (x.legacy_status && !state.statusByLegacy[String(x.legacy_status)]) state.statusByLegacy[String(x.legacy_status)] = x;
    });
  }

  async function moveStage() {
    const stageId = String($("#leadDetailMoveStage").val() || "").trim();
    if (!stageId) return;
    try {
      await api.post(`/api/leads/${encodeURIComponent(state.leadId)}/stage`, { stage_id: stageId });
      await loadData();
      renderLead();
      renderStageOptions();
      renderTimeline();
      toast(t("page.leads.messages.stageUpdated", "Estágio atualizado"), "success");
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.stageUpdateError", "Falha ao atualizar estágio"), "error");
    }
  }

  async function markWon() {
    try {
      await api.post(`/api/leads/${encodeURIComponent(state.leadId)}/convert`, {});
      await loadData();
      renderLead();
      renderTimeline();
      toast(t("page.leads.messages.statusUpdated", "Status atualizado"), "success");
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.statusUpdateError", "Falha ao atualizar status"), "error");
    }
  }

  async function markLost() {
    const reason = window.prompt(t("page.leads.detail.lostReasonPrompt", "Informe o motivo da perda:"), "");
    if (reason == null) return;
    try {
      const disqualified = state.statusByLegacy.DISQUALIFIED || state.statusByLegacy.LOST || null;
      const payload = {
        status: disqualified?.legacy_status || "DISQUALIFIED",
        disqualify_reason: String(reason || "").trim() || null,
      };
      if (disqualified?.status_config_id) payload.status_config_id = disqualified.status_config_id;
      await api.patch(`/api/leads/${encodeURIComponent(state.leadId)}`, payload);
      await loadData();
      renderLead();
      renderTimeline();
      toast(t("page.leads.messages.statusUpdated", "Status atualizado"), "success");
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.statusUpdateError", "Falha ao atualizar status"), "error");
    }
  }

  function bindEvents() {
    $("#leadDetailBack").on("click", () => { window.location.href = "/leads/pipeline"; });
    $("#leadDetailEdit").on("click", () => { window.location.href = `/leads/${encodeURIComponent(state.leadId)}/edit`; });
    $("#leadDetailWin").on("click", markWon);
    $("#leadDetailLose").on("click", markLost);
    $("#leadDetailMoveBtn").on("click", moveStage);
  }

  async function init() {
    state.leadId = parseLeadIdFromPath();
    if (!state.leadId) {
      toast(t("page.leads.messages.invalidLead", "Lead inválido"), "error");
      window.location.href = "/leads";
      return;
    }

    $("#pageName").text(t("page.leads.detail.title", "Detalhes do Lead"));
    $("#subpageName").text(t("page.leads.detail.title", "Detalhes do Lead"));
    bindEvents();

    try {
      await loadData();
      renderLead();
      renderStageOptions();
      renderTimeline();
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.loadError", "Erro ao carregar lead"), "error");
    }
  }

  $(document).ready(init);
})();
