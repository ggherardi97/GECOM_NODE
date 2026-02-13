(function () {
  const api = window.GECOM_API;

  const state = {
    leadId: "",
    lead: null,
    stages: [],
    activities: [],
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
    $("#leadDetailStatus").text(lead?.status || "-");
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
    const [lead, stages, activities] = await Promise.all([
      api.get(`/api/leads/${encodeURIComponent(state.leadId)}`),
      api.get("/api/leads/stages"),
      api.get(`/api/leads/${encodeURIComponent(state.leadId)}/activities`).catch(() => []),
    ]);
    state.lead = lead;
    state.stages = listToArray(stages);
    state.activities = listToArray(activities);
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
      await api.patch(`/api/leads/${encodeURIComponent(state.leadId)}`, {
        status: "DISQUALIFIED",
        disqualify_reason: String(reason || "").trim() || null,
      });
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
