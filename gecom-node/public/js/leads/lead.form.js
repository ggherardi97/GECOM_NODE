(function () {
  const api = window.GECOM_API;

  const state = {
    isEdit: false,
    leadId: "",
    stages: [],
    owners: [],
    companies: [],
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
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function toast(message, type) {
    if (window.toastr && typeof window.toastr[type || "info"] === "function") {
      window.toastr[type || "info"](message);
      return;
    }
    alert(message);
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
      ...statusPayload,
      owner_user_id: String($("#leadOwner").val() || "").trim() || null,
      estimated_value: parseMoneyInput($("#leadValue").val()),
      currency_code: String($("#leadCurrency").val() || "").trim() || "BRL",
      next_action_at: String($("#leadNextAction").val() || "").trim() || null,
      notes: String($("#leadNotes").val() || "").trim() || null,
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
    $("#leadNextAction").val(lead?.next_action_at ? new Date(lead.next_action_at).toISOString().slice(0, 16) : "");
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
      if (!datalist.length) return;
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
    if (!sel.length) return;
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
    if (!sel.length) return;
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

  async function loadLead() {
    if (!state.isEdit || !state.leadId) return;
    const lead = await api.get(`/api/leads/${encodeURIComponent(state.leadId)}`);
    fillForm(lead);
  }

  async function saveLead() {
    const payload = readForm();
    const err = validate(payload);
    if (err) {
      toast(err, "warning");
      return;
    }

    try {
      let saved;
      if (state.isEdit) {
        saved = await api.patch(`/api/leads/${encodeURIComponent(state.leadId)}`, payload);
      } else {
        saved = await api.post("/api/leads", payload);
      }
      const id = String(saved?.id || state.leadId || "").trim();
      toast(t("page.leads.messages.saved", "Lead salvo com sucesso"), "success");
      if (id) window.location.href = `/leads/${encodeURIComponent(id)}`;
      else window.location.href = "/leads/pipeline";
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.saveError", "Erro ao salvar lead"), "error");
    }
  }

  function initWizard() {
    const form = $("#leadWizardForm");
    if (!form.length || typeof form.steps !== "function") return;
    if (form.data("gecomWizardInit")) return;
    form.data("gecomWizardInit", true);

    form.steps({
      bodyTag: "fieldset",
      labels: {
        finish: t("page.leads.form.save", "Salvar"),
        next: t("page.leads.common.next", "Proximo"),
        previous: t("page.leads.common.previous", "Voltar"),
      },
      onStepChanging: function (_event, currentIndex, newIndex) {
        if (newIndex < currentIndex) return true;

        if (currentIndex === 0 && newIndex === 1) {
          const basic = readForm();
          if (!basic.name) {
            toast(t("page.leads.validation.nameRequired", "Nome do lead e obrigatorio"), "warning");
            return false;
          }
          if (!basic.type || !["COMPANY", "PERSON"].includes(String(basic.type).toUpperCase())) {
            toast("Tipo invalido. Use COMPANY ou PERSON.", "warning");
            return false;
          }
        }

        return true;
      },
      onFinishing: function () {
        const payload = readForm();
        const err = validate(payload);
        if (err) {
          toast(err, "warning");
          return false;
        }
        return true;
      },
      onFinished: async function () {
        await saveLead();
      },
    });
  }

  function bindEvents() {
    $("#leadCancelBtn").on("click", function () {
      window.location.href = "/leads/pipeline";
    });

    $("#leadValue").on("input", function () {
      const raw = String(this.value || "");
      this.value = raw.replace(/[^\d.,]/g, "");
    });

    $("#leadValue").on("blur", function () {
      const n = parseMoneyInput(this.value);
      this.value = n == null ? "" : formatMoneyPtBr(n);
    });
  }

  async function init() {
    const path = window.location.pathname || "";
    state.isEdit = /\/leads\/[^/]+\/edit\/?$/.test(path);
    state.leadId = parseQueryId();

    $("#pageName").text(state.isEdit ? t("page.leads.form.editTitle", "Editar Lead") : t("page.leads.form.newTitle", "Novo Lead"));
    $("#subpageName").text(state.isEdit ? t("page.leads.form.editTitle", "Editar Lead") : t("page.leads.form.newTitle", "Novo Lead"));

    bindEvents();
    initWizard();

    try {
      await Promise.all([loadStages(), loadOwners(), loadCompanies(), loadStatusOptions()]);
      if (!state.isEdit) {
        $("#leadType").val("COMPANY");
        const defaultStatus = getDefaultLeadStatusSelection();
        if (defaultStatus && $("#leadStatus option").length) $("#leadStatus").val(defaultStatus);
        if ($("#leadStage option:first").length) $("#leadStage").val($("#leadStage option:first").val());
      } else {
        await loadLead();
      }
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.loadError", "Erro ao carregar formulario"), "error");
    }
  }

  $(document).ready(init);
})();
