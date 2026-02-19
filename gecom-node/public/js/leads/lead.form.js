(function () {
  const api = window.GECOM_API;

  const state = {
    isEdit: false,
    leadId: "",
    stages: [],
    owners: [],
    companies: [],
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
      status: String($("#leadStatus").val() || "").trim() || "NEW",
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
    $("#leadStatus").val(lead?.status || "NEW");
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
    if (!payload.status) return t("page.leads.validation.statusRequired", "Status e obrigatorio");

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

    try {
      await Promise.all([loadStages(), loadOwners(), loadCompanies()]);
      if (!state.isEdit) {
        $("#leadType").val("COMPANY");
        if ($("#leadStatus option[value='NEW']").length) $("#leadStatus").val("NEW");
        if ($("#leadStage option:first").length) $("#leadStage").val($("#leadStage option:first").val());
      } else {
        await loadLead();
      }
      initWizard();
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.loadError", "Erro ao carregar formulario"), "error");
    }
  }

  $(document).ready(init);
})();
