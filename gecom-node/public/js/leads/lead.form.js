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
    return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
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

  function readForm() {
    return {
      name: String($("#leadName").val() || "").trim(),
      company_name: String($("#leadCompany").val() || "").trim() || null,
      first_name: String($("#leadFirstName").val() || "").trim() || null,
      last_name: String($("#leadLastName").val() || "").trim() || null,
      email: String($("#leadEmail").val() || "").trim() || null,
      phone: String($("#leadPhone").val() || "").trim() || null,
      source: String($("#leadSource").val() || "").trim() || null,
      stage_id: String($("#leadStage").val() || "").trim() || null,
      status: String($("#leadStatus").val() || "").trim() || "NEW",
      owner_user_id: String($("#leadOwner").val() || "").trim() || null,
      estimated_value: $("#leadValue").val() !== "" ? Number($("#leadValue").val()) : null,
      currency_code: String($("#leadCurrency").val() || "").trim() || "BRL",
      next_action_at: String($("#leadNextAction").val() || "").trim() || null,
      notes: String($("#leadNotes").val() || "").trim() || null,
    };
  }

  function fillForm(lead) {
    $("#leadName").val(lead?.name || "");
    $("#leadCompany").val(lead?.company_name || "");
    $("#leadFirstName").val(lead?.first_name || "");
    $("#leadLastName").val(lead?.last_name || "");
    $("#leadEmail").val(lead?.email || "");
    $("#leadPhone").val(lead?.phone || "");
    $("#leadSource").val(lead?.source || "");
    $("#leadStage").val(lead?.stage_id || lead?.stage?.id || "");
    $("#leadStatus").val(lead?.status || "NEW");
    $("#leadOwner").val(lead?.owner_user_id || "");
    $("#leadValue").val(lead?.estimated_value != null ? String(lead.estimated_value) : "");
    $("#leadCurrency").val(lead?.currency_code || "BRL");
    $("#leadNextAction").val(lead?.next_action_at ? new Date(lead.next_action_at).toISOString().slice(0, 16) : "");
    $("#leadNotes").val(lead?.notes || "");
  }

  function validate(payload) {
    if (!payload.name) return t("page.leads.validation.nameRequired", "Nome do lead é obrigatório");
    if (!payload.stage_id) return t("page.leads.validation.stageRequired", "Estágio é obrigatório");
    if (!payload.status) return t("page.leads.validation.statusRequired", "Status é obrigatório");

    if (payload.email) {
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email);
      if (!ok) return t("page.leads.validation.emailInvalid", "E-mail inválido");
    }

    if (payload.phone) {
      const ok = /^[0-9()+\-\s]{8,20}$/.test(payload.phone);
      if (!ok) return t("page.leads.validation.phoneInvalid", "Telefone inválido");
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

    const btn = $("#leadSaveBtn");
    btn.prop("disabled", true).html(`<i class="fa fa-spinner fa-spin"></i> ${esc(t("page.leads.form.saving", "Salvando..."))}`);

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
    } finally {
      btn.prop("disabled", false).html(`<i class="fa fa-save"></i> ${esc(t("page.leads.form.save", "Salvar"))}`);
    }
  }

  function bindEvents() {
    $("#leadSaveBtn").on("click", saveLead);
    $("#leadCancelBtn").on("click", function () {
      window.location.href = "/leads/pipeline";
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
        if ($("#leadStatus option[value='NEW']").length) $("#leadStatus").val("NEW");
        if ($("#leadStage option:first").length) $("#leadStage").val($("#leadStage option:first").val());
      } else {
        await loadLead();
      }
    } catch (e) {
      console.error(e);
      toast(e?.message || t("page.leads.messages.loadError", "Erro ao carregar formulário"), "error");
    }
  }

  $(document).ready(init);
})();
