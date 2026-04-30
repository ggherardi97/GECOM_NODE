(function () {
  const api = window.GECOM_API;

  const state = {
    isEdit: false,
    leadId: "",
    lead: null,
    stages: [],
    owners: [],
    companies: [],
    activities: [],
    statusOptions: [],
    statusByValue: {},
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
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function toast(message, type) {
    if (window.toastr && typeof window.toastr[type || "info"] === "function") {
      window.toastr[type || "info"](message);
      return;
    }
    alert(message);
  }

  function showMessage(kind, text) {
    const $el = $("#leadMessage");
    $el.removeClass("is-open alert-success alert-danger alert-warning");
    if (!text) return;
    $el.addClass("is-open");
    $el.addClass(kind === "success" ? "alert-success" : kind === "warning" ? "alert-warning" : "alert-danger");
    $el.text(text);
  }

  function parseQueryId() {
    const path = window.location.pathname || "";
    const mEdit = path.match(/^\/leads\/([^/]+)\/edit\/?$/);
    const mDetail = path.match(/^\/leads\/([^/]+)\/?$/);
    if (mEdit && mEdit[1]) return decodeURIComponent(mEdit[1]);
    if (mDetail && mDetail[1] && path.endsWith("/edit")) return decodeURIComponent(mDetail[1]);
    return "";
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
    return getLeadLegacyStatus(lead) || "-";
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

  function parseLegacyStatusFromSelection(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (raw.startsWith("legacy:")) return normalizeLeadLegacyStatus(raw.slice("legacy:".length));
    const mapped = state.statusByValue[raw];
    if (mapped?.legacy_status) return normalizeLeadLegacyStatus(mapped.legacy_status);
    return normalizeLeadLegacyStatus(raw);
  }

  function indexStatusOptions() {
    state.statusByValue = {};
    state.statusByConfigId = {};
    state.statusByLegacy = {};
    (state.statusOptions || []).forEach((opt) => {
      const value = String(opt?.value || "").trim();
      if (!value) return;
      state.statusByValue[value] = opt;
      if (opt?.status_config_id) state.statusByConfigId[String(opt.status_config_id)] = opt;
      if (opt?.legacy_status && !state.statusByLegacy[String(opt.legacy_status)]) {
        state.statusByLegacy[String(opt.legacy_status)] = opt;
      }
    });
  }

  function getDefaultLeadStatusSelection() {
    const preferred =
      state.statusByLegacy.NEW ||
      state.statusByLegacy.WORKING ||
      state.statusByLegacy.QUALIFIED ||
      state.statusOptions[0] ||
      null;
    return preferred ? String(preferred.value || "") : "";
  }

  function buildStatusPayloadFromSelection(value) {
    const selected = String(value || "").trim();
    const option = state.statusByValue[selected] || null;
    const status_config_id = normalizeStatusConfigId(option?.status_config_id);
    const legacy_status = option?.legacy_status ? normalizeLeadLegacyStatus(option.legacy_status) : parseLegacyStatusFromSelection(selected);

    const payload = {};
    if (status_config_id) payload.status_config_id = status_config_id;
    if (legacy_status) payload.status = legacy_status;
    else payload.status = "NEW";
    return payload;
  }

  function normalizeLeadType(value) {
    const raw = String(value || "").trim().toUpperCase();
    const map = {
      EMPRESA: "COMPANY",
      COMPANY: "COMPANY",
      PESSOA: "PERSON",
      PERSON: "PERSON",
    };
    return map[raw] || "COMPANY";
  }

  function normalizeLeadSource(value) {
    const raw = String(value || "").trim().toUpperCase();
    const map = {
      MANUAL: "MANUAL",
      WEBSITE: "WEBSITE",
      INDICATION: "INDICATION",
      IMPORT: "IMPORT",
      OTHER: "OTHER",
      REFERRAL: "INDICATION",
      SOCIAL: "OTHER",
      PHONE: "MANUAL",
      EMAIL: "MANUAL",
    };
    return map[raw] || null;
  }

  function parseMoneyInput(value) {
    const raw = String(value || "").trim();
    if (!raw) return null;
    const normalized = raw
      .replace(/\s/g, "")
      .replace(/\./g, "")
      .replace(/,/g, ".")
      .replace(/[^0-9.-]/g, "");
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function formatMoneyPtBr(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "";
    return new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  function formatMoneyTypingPtBr(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    const n = Number(digits) / 100;
    if (!Number.isFinite(n)) return "";
    return formatMoneyPtBr(n);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR");
  }

  function formatInputDateTime(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  function money(value, currency) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "-";
    try {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency || "BRL" }).format(n);
    } catch {
      return formatMoneyPtBr(n);
    }
  }

  function readForm() {
    const statusSelection = String($("#leadStatus").val() || "").trim();
    const statusPayload = buildStatusPayloadFromSelection(statusSelection);
    return {
      name: String($("#leadName").val() || "").trim(),
      type: normalizeLeadType($("#leadType").val()),
      company_name: String($("#leadCompany").val() || "").trim() || null,
      first_name: String($("#leadFirstName").val() || "").trim() || null,
      last_name: String($("#leadLastName").val() || "").trim() || null,
      email: String($("#leadEmail").val() || "").trim() || null,
      phone: String($("#leadPhone").val() || "").trim() || null,
      source: normalizeLeadSource($("#leadSource").val()),
      stage_id: String($("#leadStage").val() || "").trim() || null,
      owner_user_id: String($("#leadOwner").val() || "").trim() || null,
      estimated_value: parseMoneyInput($("#leadValue").val()),
      currency_code: String($("#leadCurrency").val() || "").trim() || "BRL",
      next_action_at: String($("#leadNextAction").val() || "").trim() || null,
      notes: String($("#leadNotes").val() || "").trim() || null,
      ...statusPayload,
    };
  }

  function fillForm(lead) {
    $("#leadName").val(lead?.name || "");
    $("#leadType").val(normalizeLeadType(lead?.type));
    $("#leadCompany").val(lead?.company_name || "");
    $("#leadFirstName").val(lead?.first_name || "");
    $("#leadLastName").val(lead?.last_name || "");
    $("#leadEmail").val(lead?.email || "");
    $("#leadPhone").val(lead?.phone || "");
    $("#leadSource").val(normalizeLeadSource(lead?.source) || "");
    $("#leadStage").val(lead?.stage_id || lead?.stage?.id || "");
    const statusConfigId = getLeadStatusConfigId(lead);
    const legacyStatus = getLeadLegacyStatus(lead) || "NEW";
    let selectedStatus = "";
    if (statusConfigId) {
      const byConfig = state.statusByConfigId[statusConfigId];
      selectedStatus = byConfig?.value || statusConfigId;
      ensureLeadStatusOption(selectedStatus, lead?.status_config?.label || byConfig?.label || selectedStatus, legacyStatus, statusConfigId);
    } else {
      const byLegacy = state.statusByLegacy[legacyStatus];
      selectedStatus = byLegacy?.value || `legacy:${legacyStatus}`;
      ensureLeadStatusOption(selectedStatus, byLegacy?.label || legacyStatus, legacyStatus, byLegacy?.status_config_id || "");
    }
    $("#leadStatus").val(selectedStatus || getDefaultLeadStatusSelection());
    $("#leadOwner").val(lead?.owner_user_id || "");
    $("#leadValue").val(lead?.estimated_value != null ? formatMoneyPtBr(lead.estimated_value) : "");
    $("#leadCurrency").val(lead?.currency_code || "BRL");
    $("#leadNextAction").val(lead?.next_action_at ? formatInputDateTime(lead.next_action_at) : "");
    $("#leadNotes").val(lead?.notes || "");
  }

  function validate(payload) {
    if (!payload.name) return t("page.leads.validation.nameRequired", "Nome do lead e obrigatorio");
    if (!payload.type || !["COMPANY", "PERSON"].includes(String(payload.type).toUpperCase())) {
      return "Tipo invalido. Use COMPANY ou PERSON.";
    }
    if (!payload.stage_id) return t("page.leads.validation.stageRequired", "Estagio e obrigatorio");
    if (!payload.status_config_id && !payload.status) return t("page.leads.validation.statusRequired", "Status e obrigatorio");

    if (state.statusOptions.length > 0) {
      const selected = String($("#leadStatus").val() || "").trim();
      if (selected && !state.statusByValue[selected]) {
        return t("page.leads.validation.statusRequired", "Status e obrigatorio");
      }
    }

    if (payload.source && !["MANUAL", "WEBSITE", "INDICATION", "IMPORT", "OTHER"].includes(payload.source)) {
      return "Source invalido. Use MANUAL, WEBSITE, INDICATION, IMPORT ou OTHER.";
    }

    if (payload.email) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);
      if (!ok) return t("page.leads.validation.emailInvalid", "E-mail invalido");
    }

    if (payload.phone) {
      const ok = /^[0-9()+\-\s]{8,20}$/.test(payload.phone);
      if (!ok) return t("page.leads.validation.phoneInvalid", "Telefone invalido");
    }

    return null;
  }

  async function loadStages() {
    state.stages = listToArray(await api.get("/api/leads/stages"));
    const sel = $("#leadStage");
    sel.empty();
    state.stages.forEach((s) => {
      sel.append(`<option value="${esc(s.id)}">${esc(s.name || s.id)}</option>`);
    });
  }

  async function loadOwners() {
    state.owners = listToArray(await api.get("/api/users"));
    const sel = $("#leadOwner");
    sel.empty().append(`<option value="">${esc(t("page.leads.form.selectOwner", "Selecione"))}</option>`);
    state.owners.forEach((u) => {
      const id = String(u?.id || "").trim();
      if (!id) return;
      const name = String(u?.full_name || u?.name || u?.email || id);
      sel.append(`<option value="${esc(id)}">${esc(name)}</option>`);
    });
  }

  async function loadCompanies() {
    try {
      state.companies = listToArray(await api.get("/api/companies?fields=summary"));
      const datalist = $("#leadCompanies");
      datalist.empty();
      state.companies.forEach((c) => {
        const name = String(c?.company_name || c?.name || "").trim();
        if (!name) return;
        datalist.append(`<option value="${esc(name)}"></option>`);
      });
    } catch (e) {
      console.warn("loadCompanies warning:", e);
    }
  }

  function renderLeadStatuses(selectedValue) {
    const sel = $("#leadStatus");
    sel.empty();

    const options = state.statusOptions.length
      ? state.statusOptions
      : [
          { value: "legacy:NEW", status_config_id: "", legacy_status: "NEW", label: t("page.leads.form.status.new", "Novo"), color: "" },
          { value: "legacy:WORKING", status_config_id: "", legacy_status: "WORKING", label: t("page.leads.form.status.working", "Em andamento"), color: "" },
          { value: "legacy:QUALIFIED", status_config_id: "", legacy_status: "QUALIFIED", label: t("page.leads.form.status.qualified", "Qualificado"), color: "" },
          { value: "legacy:DISQUALIFIED", status_config_id: "", legacy_status: "DISQUALIFIED", label: t("page.leads.form.status.disqualified", "Desqualificado"), color: "" },
          { value: "legacy:CONVERTED", status_config_id: "", legacy_status: "CONVERTED", label: t("page.leads.form.status.converted", "Convertido"), color: "" },
        ];

    options.forEach((s) => {
      const value = String(s.value || "").trim();
      if (!value) return;
      const label = String(s.label || value);
      const legacy = String(s.legacy_status || "").trim().toUpperCase();
      const statusConfigId = String(s.status_config_id || "").trim();
      sel.append(`<option value="${esc(value)}" data-legacy="${esc(legacy)}" data-status-config-id="${esc(statusConfigId)}">${esc(label)}</option>`);
    });

    if (selectedValue && sel.find(`option[value="${selectedValue}"]`).length) {
      sel.val(selectedValue);
      return;
    }
    const defaultValue = getDefaultLeadStatusSelection();
    if (defaultValue && sel.find(`option[value="${defaultValue}"]`).length) sel.val(defaultValue);
    else if (sel.find("option:first").length) sel.val(sel.find("option:first").val());
  }

  function ensureLeadStatusOption(value, label, legacyStatus, statusConfigId) {
    const normalized = String(value || "").trim();
    if (!normalized) return;
    const sel = $("#leadStatus");
    if (sel.find(`option[value="${normalized}"]`).length) return;
    sel.append(
      `<option value="${esc(normalized)}" data-legacy="${esc(String(legacyStatus || "").trim().toUpperCase())}" data-status-config-id="${esc(String(statusConfigId || "").trim())}">${esc(String(label || normalized))}</option>`
    );
  }

  async function loadStatusOptions() {
    try {
      const data = await api.get("/api/status-configs?entity=LEAD&active=true");
      const list = listToArray(data);
      state.statusOptions = list
        .map((row) => ({
          value: String(row?.id || "").trim(),
          status_config_id: String(row?.id || "").trim(),
          legacy_status: String(row?.legacy_lead_status || "").trim().toUpperCase(),
          label: String(row?.label || "").trim(),
          color: String(row?.color || "").trim(),
          sort: Number(row?.sort_order || 0),
        }))
        .filter((x) => x.value && x.label)
        .sort((a, b) => a.sort - b.sort);
    } catch (e) {
      console.warn("loadStatusOptions fallback:", e);
      state.statusOptions = [];
    }
    if (!state.statusOptions.length) {
      state.statusOptions = [
        { value: "legacy:NEW", status_config_id: "", legacy_status: "NEW", label: t("page.leads.form.status.new", "Novo"), color: "", sort: 0 },
        { value: "legacy:WORKING", status_config_id: "", legacy_status: "WORKING", label: t("page.leads.form.status.working", "Em andamento"), color: "", sort: 1 },
        { value: "legacy:QUALIFIED", status_config_id: "", legacy_status: "QUALIFIED", label: t("page.leads.form.status.qualified", "Qualificado"), color: "", sort: 2 },
        { value: "legacy:DISQUALIFIED", status_config_id: "", legacy_status: "DISQUALIFIED", label: t("page.leads.form.status.disqualified", "Desqualificado"), color: "", sort: 3 },
        { value: "legacy:CONVERTED", status_config_id: "", legacy_status: "CONVERTED", label: t("page.leads.form.status.converted", "Convertido"), color: "", sort: 4 },
      ];
    }
    indexStatusOptions();
    renderLeadStatuses();
  }

  async function loadActivities() {
    if (!state.isEdit || !state.leadId) {
      state.activities = [];
      return;
    }
    try {
      state.activities = listToArray(await api.get(`/api/leads/${encodeURIComponent(state.leadId)}/activities`));
    } catch (e) {
      console.warn("loadActivities warning:", e);
      state.activities = [];
    }
  }

  async function loadLead() {
    if (!state.isEdit || !state.leadId) return;
    state.lead = await api.get(`/api/leads/${encodeURIComponent(state.leadId)}`);
    fillForm(state.lead);
  }

  function renderSummary() {
    const lead = state.lead || readForm();
    const title = lead?.name || `${lead?.first_name || ""} ${lead?.last_name || ""}`.trim() || "-";
    const statusLabel = getLeadStatusLabel(lead);
    const stageLabel =
      state.stages.find((stage) => String(stage?.id || "") === String(lead?.stage_id || ""))?.name ||
      lead?.stage?.name ||
      "-";
    const ownerLabel =
      state.owners.find((owner) => String(owner?.id || "") === String(lead?.owner_user_id || ""))?.full_name ||
      lead?.owner_user?.full_name ||
      lead?.owner_user?.name ||
      "-";
    const companyLabel = lead?.company_name || "-";
    const createdAt = state.lead?.created_at ? formatDateTime(state.lead.created_at) : "-";
    const updatedAt = state.lead?.updated_at ? formatDateTime(state.lead.updated_at) : "-";
    const statusColor = getLeadStatusColor(lead);
    const statusStyle = statusColor ? ` style="background:${esc(statusColor)};color:#fff;"` : "";

    $("#leadSummary").html(`
      <div class="lead-summary-stack">
        <span class="lead-summary-pill"><i class="fa fa-bullseye"></i> ${esc(title)}</span>
        <span class="lead-summary-pill"${statusStyle}><i class="fa fa-flag"></i> ${esc(statusLabel || "-")}</span>
      </div>
      <div class="lead-summary-grid">
        <div class="lead-summary-item">
          <span class="lead-summary-label">${esc(t("page.leads.columns.stage", "Estagio"))}</span>
          <div class="lead-summary-value">${esc(stageLabel)}</div>
        </div>
        <div class="lead-summary-item">
          <span class="lead-summary-label">${esc(t("page.leads.columns.owner", "Responsavel"))}</span>
          <div class="lead-summary-value">${esc(ownerLabel)}</div>
        </div>
        <div class="lead-summary-item">
          <span class="lead-summary-label">${esc(t("page.leads.columns.company", "Empresa"))}</span>
          <div class="lead-summary-value">${esc(companyLabel)}</div>
        </div>
        <div class="lead-summary-item">
          <span class="lead-summary-label">${esc(t("page.leads.columns.source", "Origem"))}</span>
          <div class="lead-summary-value">${esc(lead?.source || "-")}</div>
        </div>
        <div class="lead-summary-item">
          <span class="lead-summary-label">${esc(t("page.leads.columns.value", "Valor"))}</span>
          <div class="lead-summary-value">${esc(money(lead?.estimated_value, lead?.currency_code || "BRL"))}</div>
        </div>
        <div class="lead-summary-item">
          <span class="lead-summary-label">${esc(t("page.leads.detail.createdAt", "Criado em"))}</span>
          <div class="lead-summary-value">${esc(createdAt)}</div>
        </div>
        <div class="lead-summary-item">
          <span class="lead-summary-label">${esc(t("page.leads.detail.updatedAt", "Atualizado em"))}</span>
          <div class="lead-summary-value">${esc(updatedAt)}</div>
        </div>
      </div>
    `);
  }

  function timelineItem(icon, color, title, description, meta) {
    return `
      <div class="lead-timeline-item">
        <div class="lead-timeline-icon" style="background:${esc(color)};">
          <i class="fa ${esc(icon)}"></i>
        </div>
        <div class="lead-timeline-content">
          <div class="lead-timeline-title">${esc(title)}</div>
          ${meta ? `<div class="lead-timeline-meta">${esc(meta)}</div>` : ""}
          ${description ? `<div class="lead-timeline-description">${esc(description)}</div>` : ""}
        </div>
      </div>
    `;
  }

  function renderTimeline() {
    const $host = $("#leadTimeline");
    if (!state.isEdit || !state.leadId) {
      $host.html(`<div class="lead-empty-state">${esc(t("page.leads.messages.saveToSeeTimeline", "Salve o lead para habilitar o historico."))}</div>`);
      return;
    }

    const items = [];
    items.push(
      timelineItem(
        "fa-plus-circle",
        "#1ab394",
        t("page.leads.detail.createdAt", "Criado em"),
        state.lead?.name || "-",
        formatDateTime(state.lead?.created_at)
      )
    );

    if (state.lead?.updated_at) {
      items.push(
        timelineItem(
          "fa-refresh",
          "#23c6c8",
          t("page.leads.detail.updatedAt", "Atualizado em"),
          getLeadStatusLabel(state.lead),
          formatDateTime(state.lead.updated_at)
        )
      );
    }

    state.activities.forEach((activity) => {
      items.push(
        timelineItem(
          "fa-comment-o",
          "#1c84c6",
          activity?.subject || activity?.type || t("page.leads.detail.activity", "Atividade"),
          activity?.description || "-",
          formatDateTime(activity?.created_at)
        )
      );
    });

    $host.html(items.length ? `<div class="lead-timeline-list">${items.join("")}</div>` : `<div class="lead-empty-state">${esc(t("page.leads.detail.timelineEmpty", "Nenhum evento encontrado."))}</div>`);
  }

  function refreshPageChrome() {
    const pageTitle = state.isEdit
      ? t("page.leads.form.editTitle", "Editar Lead")
      : t("page.leads.form.newTitle", "Novo Lead");
    $("#pageName").text(pageTitle);
    $("#subpageName").text(pageTitle);
    $("#leadPageTitle").text(pageTitle);
    $("#leadFormCardTitle").text(state.isEdit ? t("page.leads.detail.mainInfo", "Ficha do lead") : t("page.leads.form.title", "Novo Lead"));
    $("#leadFormCardSubtitle").text(t("page.leads.form.sectionBasic", "Dados principais e qualificacao comercial."));
    $("#leadTimelineTitle").text(t("page.leads.detail.timeline", "Timeline"));
    $("#leadSummaryTitle").text(t("page.leads.detail.mainInfo", "Resumo"));
    $("#leadBackBtn").text(t("page.leads.common.cancel", "Cancelar"));
    $("#leadSaveBtn").html(`<i class="fa fa-check"></i> ${esc(t("page.leads.form.save", "Salvar"))}`);
    $("#leadNewBtn").toggle(state.isEdit);
  }

  async function saveLead() {
    const payload = readForm();
    const err = validate(payload);
    if (err) {
      showMessage("warning", err);
      toast(err, "warning");
      return;
    }

    const $btn = $("#leadSaveBtn");
    const oldHtml = $btn.html();
    $btn.prop("disabled", true).html(`<i class="fa fa-spinner fa-spin"></i> ${esc(t("page.leads.common.save", "Salvando..."))}`);
    showMessage("", "");

    try {
      let saved;
      if (state.isEdit) {
        saved = await api.patch(`/api/leads/${encodeURIComponent(state.leadId)}`, payload);
      } else {
        saved = await api.post("/api/leads", payload);
      }
      const id = String(saved?.id || state.leadId || "").trim();
      toast(t("page.leads.messages.saved", "Lead salvo com sucesso"), "success");
      showMessage("success", t("page.leads.messages.saved", "Lead salvo com sucesso"));
      if (id) window.location.href = `/leads/${encodeURIComponent(id)}/edit`;
      else window.location.href = "/leads/pipeline";
    } catch (e) {
      console.error(e);
      showMessage("error", e?.message || t("page.leads.messages.saveError", "Erro ao salvar lead"));
      toast(e?.message || t("page.leads.messages.saveError", "Erro ao salvar lead"), "error");
    } finally {
      $btn.prop("disabled", false).html(oldHtml);
    }
  }

  function bindEvents() {
    $("#leadBackBtn").on("click", function () {
      window.location.href = state.isEdit && state.leadId ? `/leads/${encodeURIComponent(state.leadId)}` : "/leads/pipeline";
    });

    $("#leadNewBtn").on("click", function () {
      window.location.href = "/leads/new";
    });

    $("#leadSaveBtn").on("click", function () {
      saveLead();
    });

    $("#leadValue").on("input", function () {
      this.value = formatMoneyTypingPtBr(this.value);
      renderSummary();
    });

    $("#leadValue").on("blur", function () {
      const n = parseMoneyInput(this.value);
      this.value = n == null ? "" : formatMoneyPtBr(n);
      renderSummary();
    });

    $("#leadFormFields")
      .on("input change", "input,select,textarea", function () {
        renderSummary();
      });
  }

  async function init() {
    const path = window.location.pathname || "";
    state.isEdit = /\/leads\/[^/]+\/edit\/?$/.test(path);
    state.leadId = parseQueryId();

    refreshPageChrome();
    bindEvents();

    try {
      await Promise.all([loadStages(), loadOwners(), loadCompanies(), loadStatusOptions()]);
      if (state.isEdit) {
        await Promise.all([loadLead(), loadActivities()]);
      } else {
        $("#leadType").val("COMPANY");
        const defaultStatus = getDefaultLeadStatusSelection();
        if (defaultStatus && $("#leadStatus option").length) $("#leadStatus").val(defaultStatus);
        if ($("#leadStage option:first").length) $("#leadStage").val($("#leadStage option:first").val());
        state.lead = null;
      }
      renderSummary();
      renderTimeline();
    } catch (e) {
      console.error(e);
      showMessage("error", e?.message || t("page.leads.messages.loadError", "Erro ao carregar formulario"));
      toast(e?.message || t("page.leads.messages.loadError", "Erro ao carregar formulario"), "error");
    }
  }

  $(document).ready(init);
})();
