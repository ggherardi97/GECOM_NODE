(function () {
  const state = {
    meta: null,
    integrations: [],
    selectedIntegrationId: null,
    conversations: [],
    selectedConversationId: null,
    selectedConversation: null,
    messages: [],
    notes: [],
    templates: [],
    selectedTemplateId: null,
    campaigns: [],
    selectedCampaignId: null,
    selectedCampaign: null,
    campaignRecipientsDraft: [],
    activeStep: "1",
    inboxPollTimer: null,
  };

  const INTENTS = ["BUDGET", "QUOTE", "PRICE", "SUPPORT", "FINANCE", "GENERAL", "SPAM"];
  const STEP_META = {
    "1": {
      title: "Conexao WhatsApp",
      description: "Preencha apenas o essencial da instancia. Os campos tecnicos podem ficar no avancado.",
    },
    "2": {
      title: "Funil e automacao",
      description: "Defina quem recebe, para onde vai o lead e o que deve automatizar.",
    },
    "3": {
      title: "IA e respostas",
      description: "Personalize a triagem da IA e a primeira resposta automatica do comercial.",
    },
    "4": {
      title: "Webhook e testes",
      description: "Conecte o webhook e valide a instancia com um teste rapido.",
    },
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function prettyJson(value) {
    if (value == null || value === "") return "";
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function looksLikeQrImagePayload(value) {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (/^data:image\/[a-zA-Z0-9.+-]+;base64,[a-zA-Z0-9+/=\r\n]+$/i.test(raw)) return true;

    const compact = raw.replace(/\s+/g, "");
    if (compact.length < 100) return false;
    if (!/^[a-zA-Z0-9+/=]+$/.test(compact)) return false;

    return compact.startsWith("iVBOR") || compact.startsWith("/9j/") || compact.startsWith("R0lGOD");
  }

  async function api(path, options) {
    const response = await fetch(path, Object.assign({ headers: { Accept: "application/json" } }, options || {}));
    const text = await response.text().catch(() => "");
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
    if (!response.ok) {
      const error = new Error(data?.message || "Falha na operacao.");
      error.status = response.status;
      error.payload = data;
      throw error;
    }
    return data;
  }

  function setHeader() {
    try {
      $("#pageName").text("WhatsApp Sales");
      $("#subpageName").text("Sales").attr("href", "/sales/whatsapp");
      $("#path").hide();
      $("#subpath").hide();
    } catch {}
  }

  function selectedIntegration() {
    return state.integrations.find((item) => String(item.id) === String(state.selectedIntegrationId)) || null;
  }

  function integrationHasSavedApiKey() {
    const current = selectedIntegration();
    return !!(current && (current.has_api_key || current.api_key_masked));
  }

  function showMessage(text, isError) {
    $("#waFormMessage").text(text || "").css("color", isError ? "#d9534f" : "#557383");
  }

  function showAlert(title, text, type) {
    const safeTitle = String(title || "Aviso");
    const safeText = String(text || "");
    const safeType = String(type || "info");

    if (typeof window.swal === "function") {
      window.swal({
        title: safeTitle,
        text: safeText,
        type: safeType,
        confirmButtonColor: "#1ab394",
      });
      return;
    }

    if (window.Swal && typeof window.Swal.fire === "function") {
      window.Swal.fire({
        title: safeTitle,
        text: safeText,
        icon: safeType === "error" ? "error" : (safeType === "success" ? "success" : "info"),
        confirmButtonColor: "#1ab394",
      });
      return;
    }

    window.alert([safeTitle, safeText].filter(Boolean).join("\n\n"));
  }

  function normalizeRows(data) {
    return Array.isArray(data) ? data : (Array.isArray(data?.items) ? data.items : []);
  }

  function serializeKeywordRules(rules) {
    return normalizeRows(rules)
      .map((rule) => {
        const keywords = normalizeRows(rule?.keywords).map((item) => String(item || "").trim()).filter(Boolean);
        const responseText = String(rule?.responseText || "").trim();
        if (!keywords.length || !responseText) return "";
        return `${keywords.join(", ")} => ${responseText}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  function parseKeywordRules(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.includes("=>") ? "=>" : (line.includes("|") ? "|" : null);
        if (!separator) return null;
        const parts = line.split(separator);
        if (parts.length < 2) return null;
        const keywords = String(parts[0] || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);
        const responseText = parts.slice(1).join(separator).trim();
        if (!keywords.length || !responseText) return null;
        return { keywords, responseText };
      })
      .filter(Boolean);
  }

  function serializeQuickReplies(rows) {
    return normalizeRows(rows)
      .map((row) => {
        const label = String(row?.label || "").trim();
        const text = String(row?.text || row?.responseText || "").trim();
        if (!label || !text) return "";
        return `${label} => ${text}`;
      })
      .filter(Boolean)
      .join("\n");
  }

  function parseQuickReplies(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split("=>");
        if (parts.length < 2) return null;
        const label = String(parts[0] || "").trim();
        const replyText = parts.slice(1).join("=>").trim();
        if (!label || !replyText) return null;
        return { label, text: replyText };
      })
      .filter(Boolean);
  }

  function serializeKeywordList(rows) {
    return normalizeRows(rows).map((item) => String(item || "").trim()).filter(Boolean).join(", ");
  }

  function parseKeywordList(text) {
    return String(text || "")
      .split(/[,\n]/)
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  }

  function consentLabel(value) {
    const rows = normalizeRows(state.meta?.consent_statuses || []);
    return rows.find((item) => String(item.value) === String(value || ""))?.label || (value || "Nao definido");
  }

  function campaignStatusLabel(value) {
    const rows = normalizeRows(state.meta?.campaign_statuses || []);
    return rows.find((item) => String(item.value) === String(value || ""))?.label || (value || "Rascunho");
  }

  function templateScopeLabel(value) {
    const rows = normalizeRows(state.meta?.template_scopes || []);
    return rows.find((item) => String(item.value) === String(value || ""))?.label || (value || "Ambos");
  }

  function recipientStatusLabel(value) {
    const map = {
      PENDING: "Pendente",
      SENT: "Enviado",
      FAILED: "Falhou",
      SKIPPED: "Ignorado",
    };
    return map[String(value || "").toUpperCase()] || (value || "-");
  }

  function currentUserId() {
    return String(
      state.meta?.current_user?.id ||
      window.__auth?.id ||
      window.__auth?.user_id ||
      window.__auth?.user?.id ||
      ""
    ).trim();
  }

  function currentConversation() {
    return state.selectedConversation || state.conversations.find((item) => String(item.id) === String(state.selectedConversationId)) || null;
  }

  function currentConversationQuickReplies() {
    const conversation = currentConversation();
    const integration = state.integrations.find((item) => String(item.id) === String(conversation?.integration_id || "")) || selectedIntegration();
    const settingsReplies = normalizeRows(integration?.settings_json?.quickReplyTemplates || []);
    const templateReplies = normalizeRows(state.templates || [])
      .filter((item) => item.is_active !== false && ["INBOX", "BOTH"].includes(String(item.usage_scope || "BOTH")))
      .map((item) => ({ label: item.name, text: item.message_text }));
    return settingsReplies.concat(templateReplies);
  }

  function conversationAvatarUrl(item) {
    const value = String(
      item?.contact_avatar_url ||
      item?.avatar_url ||
      item?.profile_picture_url ||
      ""
    ).trim();
    if (!value) return "";
    if (looksLikeQrImagePayload(value)) {
      return value.startsWith("data:") ? value : `data:image/png;base64,${value}`;
    }
    return value;
  }

  function conversationInitials(item) {
    const name = String(item?.contact_name || item?.contact_phone || "").trim();
    if (!name) return "?";
    const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
    const initials = parts.map((part) => part.charAt(0).toUpperCase()).join("");
    return initials || name.slice(0, 2).toUpperCase();
  }

  function providerDefaults() {
    return Object.assign({
      provider: state.meta?.default_provider || "ZAPI",
      api_base_url: "",
      session_name: "",
      api_key: "",
      provider_client_token: "",
    }, state.meta?.connection_defaults || {});
  }

  function applyProviderUi(provider) {
    const normalized = String(provider || "ZAPI").trim().toUpperCase();
    const isZapi = normalized === "ZAPI" || normalized === "Z-API";
    $("#waProviderReadonly").text(isZapi ? "Z-API" : normalized || "Provider padrao");
    $("#waBaseUrlLabel").text(isZapi ? "Base URL da Z-API" : "API Base URL");
    $("#waApiKeyLabel").text(isZapi ? "Token da instancia" : "API Key");
    $("#waSessionLabel").text(isZapi ? "Instance ID" : "Session");
    $("#waBaseUrl").attr("placeholder", isZapi ? "https://api.z-api.io" : "https://api.iazapapi.com.br/api-XXX/v2");
    $("#waApiKey").attr("placeholder", isZapi ? "token da instancia" : "cole a chave aqui");
    $("#waSessionName").attr("placeholder", isZapi ? "3F05E074C9D991296196022729239B50" : "convert-plus-main");
    $("#waProviderHelp").text(
      isZapi
        ? "Use Instance ID e token da instancia. Se a conta parceira estiver ativa, esses dados podem ser gerados automaticamente."
        : "Use a base da API e a credencial do provider. A sessao pode variar conforme o parceiro."
    );
  }

  function partnerEnabled() {
    return !!state.meta?.partner_config?.enabled;
  }

  function updateMetrics() {
    $("#waMetricIntegrations").text(state.integrations.length);
    $("#waMetricConversations").text(state.conversations.length);
    $("#waMetricQualified").text(state.conversations.filter((item) => String(item.status || "").includes("QUAL")).length);
    $("#waMetricLeads").text(state.conversations.filter((item) => item.lead_id).length);
  }

  function shouldDockSetup() {
    const current = selectedIntegration();
    return !!(current && current.is_active);
  }

  function syncDockLayout() {
    const page = $(".wa-sales-page");
    const stage = page.find(".wa-stage");
    if (!stage.length) return;

    if (!page.hasClass("is-docked")) {
      stage.css("min-height", "");
      return;
    }

    const flyoutHeight = page.find(".wa-setup-shell").outerHeight(true) || 0;
    const mainHeight = page.find(".wa-stage > .wa-shell > .wa-card").last().outerHeight(true) || 0;
    const targetHeight = Math.max(flyoutHeight, mainHeight);
    stage.css("min-height", targetHeight ? `${Math.ceil(targetHeight)}px` : "");
  }

  function applyDockState() {
    $(".wa-sales-page").toggleClass("is-docked", shouldDockSetup());
    syncDockLayout();
  }

  function renderIntentChecks(hostSelector, selectedValues) {
    const host = $(hostSelector);
    host.empty();
    INTENTS.forEach((intent) => {
      const checked = (selectedValues || []).includes(intent) ? "checked" : "";
      host.append(
        `<label class="wa-chip"><input type="checkbox" value="${esc(intent)}" ${checked} /> <span>${esc(intent)}</span></label>`
      );
    });
  }

  function collectIntentChecks(hostSelector) {
    return $(hostSelector).find("input:checked").map(function () { return String(this.value); }).get();
  }

  function fillSelect($select, rows, valueField, labelField, placeholder) {
    const current = String($select.val() || "");
    const options = [`<option value="">${esc(placeholder || "Selecione...")}</option>`];
    normalizeRows(rows).forEach((row) => {
      options.push(`<option value="${esc(row[valueField])}">${esc(row[labelField])}</option>`);
    });
    $select.html(options.join(""));
    if (current) $select.val(current);
  }

  function renderIntegrationsList() {
    const host = $("#waIntegrationsList");
    host.empty();
    if (!state.integrations.length) {
      host.html('<div class="wa-empty">Nenhuma instancia configurada ainda.</div>');
      return;
    }
    state.integrations.forEach((item) => {
      const active = String(item.id) === String(state.selectedIntegrationId) ? "is-active" : "";
      const pill = item.is_active ? "Ativa" : "Inativa";
      host.append(`
        <button type="button" class="${active}" data-id="${esc(item.id)}">
          <h5>${esc(item.name)}</h5>
          <p>${esc(item.provider || "ZAPI")} • ${esc(item.phone_number || "sem numero")}</p>
          <p><span class="wa-status-pill ${item.is_active ? "" : "is-off"}">${esc(pill)}</span></p>
        </button>
      `);
    });
    host.find("button").on("click", function () {
      state.selectedIntegrationId = String($(this).data("id") || "");
      renderIntegrationsList();
      fillIntegrationForm();
      Promise.all([loadConversations(), loadTemplates(), loadCampaigns()]).catch(handleError);
    });
  }

  function defaultFormValues() {
    const defaults = state.meta?.settings_defaults || {};
    const connection = providerDefaults();
    return {
      name: "WhatsApp Comercial",
      provider: connection.provider || "ZAPI",
      api_base_url: connection.api_base_url || "",
      api_key: connection.api_key || "",
      session_name: connection.session_name || "",
      phone_number: "",
      classifier_prompt: "",
      auto_reply_prompt: "",
      fallback_reply_text: "",
      default_owner_user_id: "",
      default_stage_id: "",
      is_active: true,
      settings_json: Object.assign({}, defaults, {
        providerClientToken: connection.provider_client_token || defaults.providerClientToken || "",
        keywordReplyRules: defaults.keywordReplyRules || [],
      }),
    };
  }

  function fillIntegrationForm() {
    const row = selectedIntegration() || defaultFormValues();
    const settings = Object.assign({}, state.meta?.settings_defaults || {}, row.settings_json || {});
    $("#waName").val(row.name || "");
    $("#waProvider").val(row.provider || state.meta?.default_provider || "ZAPI");
    $("#waBaseUrl").val(row.api_base_url || "");
    $("#waApiKey").val(row.api_key || "");
    $("#waApiKey").attr(
      "placeholder",
      row.has_api_key || row.api_key_masked
        ? "Credencial ja salva. Preencha apenas se quiser trocar."
        : "cole a credencial aqui"
    );
    $("#waSessionName").val(row.session_name || "");
    $("#waProviderClientToken").val(settings.providerClientToken || "");
    $("#waPhoneNumber").val(row.phone_number || "");
    $("#waOwnerUser").val(row.default_owner_user_id || "");
    $("#waStage").val(row.default_stage_id || "");
    $("#waClassifyWithAi").prop("checked", settings.classifyWithAi !== false);
    $("#waAutoCreateLead").prop("checked", settings.autoCreateLead !== false);
    $("#waCreateLeadActivity").prop("checked", settings.createLeadActivity !== false);
    $("#waNotifyTeam").prop("checked", settings.notifyTeam !== false);
    $("#waAutoReplyEnabled").prop("checked", !!settings.autoReplyEnabled);
    $("#waIsActive").prop("checked", row.is_active !== false);
    $("#waNotificationUsers").val(settings.notificationUserIds || []);
    $("#waAssistantTone").val(settings.assistantTone || "");
    $("#waActivitySubjectTemplate").val(settings.activitySubjectTemplate || "");
    $("#waBusinessContext").val(settings.businessContext || "");
    $("#waClassifierPrompt").val(row.classifier_prompt || "");
    $("#waAutoReplyPrompt").val(row.auto_reply_prompt || "");
    $("#waFallbackReply").val(row.fallback_reply_text || "");
    $("#waKeywordReplyRules").val(serializeKeywordRules(settings.keywordReplyRules || []));
    $("#waQuickReplyTemplates").val(serializeQuickReplies(settings.quickReplyTemplates || []));
    $("#waCampaignFooterText").val(settings.campaignFooterText || "");
    $("#waOptOutKeywords").val(serializeKeywordList(settings.optOutKeywords || []));
    $("#waWebhookBaseUrl").val(settings.webhookBaseUrl || state.meta?.public_webhook_base_url || "");
    $("#waWebhookPreview").val(row.webhook_url_preview || "Salve a instancia para gerar a URL.");
    applyProviderUi($("#waProvider").val());
    renderPartnerState();
    renderIntentChecks("#waCreateLeadIntentGroup", settings.createLeadOnIntents || []);
    renderIntentChecks("#waAutoReplyIntentGroup", settings.autoReplyOnIntents || []);
    renderStepCards();
    renderDiagnostics();
    applyDockState();
  }

  function renderPartnerState() {
    const enabled = partnerEnabled();
    $("#waProvisionBtn").toggle(enabled);
    $("#waApiKeyWrap").toggle(!enabled);
    $("#waSessionWrap").toggle(!enabled);
    $("#waAdvancedConnection").toggle(!enabled);
  }

  function gatherPayload() {
    return {
      name: String($("#waName").val() || "").trim(),
      provider: String($("#waProvider").val() || state.meta?.default_provider || "ZAPI").trim(),
      api_base_url: String($("#waBaseUrl").val() || "").trim(),
      api_key: String($("#waApiKey").val() || "").trim(),
      session_name: String($("#waSessionName").val() || "").trim() || null,
      phone_number: String($("#waPhoneNumber").val() || "").trim() || null,
      default_owner_user_id: String($("#waOwnerUser").val() || "").trim() || null,
      default_stage_id: String($("#waStage").val() || "").trim() || null,
      classifier_prompt: String($("#waClassifierPrompt").val() || "").trim() || null,
      auto_reply_prompt: String($("#waAutoReplyPrompt").val() || "").trim() || null,
      fallback_reply_text: String($("#waFallbackReply").val() || "").trim() || null,
      is_active: $("#waIsActive").is(":checked"),
      settings_json: {
        businessContext: String($("#waBusinessContext").val() || "").trim(),
        assistantTone: String($("#waAssistantTone").val() || "").trim(),
        webhookBaseUrl: String($("#waWebhookBaseUrl").val() || "").trim(),
        providerClientToken: String($("#waProviderClientToken").val() || "").trim(),
        campaignFooterText: String($("#waCampaignFooterText").val() || "").trim(),
        optOutKeywords: parseKeywordList($("#waOptOutKeywords").val()),
        classifyWithAi: $("#waClassifyWithAi").is(":checked"),
        autoCreateLead: $("#waAutoCreateLead").is(":checked"),
        createLeadActivity: $("#waCreateLeadActivity").is(":checked"),
        notifyTeam: $("#waNotifyTeam").is(":checked"),
        notificationUserIds: [].concat($("#waNotificationUsers").val() || []),
        createLeadOnIntents: collectIntentChecks("#waCreateLeadIntentGroup"),
        autoReplyEnabled: $("#waAutoReplyEnabled").is(":checked"),
        autoReplyOnIntents: collectIntentChecks("#waAutoReplyIntentGroup"),
        keywordReplyRules: parseKeywordRules($("#waKeywordReplyRules").val()),
        quickReplyTemplates: parseQuickReplies($("#waQuickReplyTemplates").val()),
        defaultLeadType: "PERSON",
        activitySubjectTemplate: String($("#waActivitySubjectTemplate").val() || "").trim(),
      },
    };
  }

  function getStepState() {
    const payload = gatherPayload();
    const hasSavedKey = integrationHasSavedApiKey();
    const settings = payload.settings_json || {};
    const providerLabel = String(payload.provider || "").trim() || "ZAPI";
    const ownerText = $("#waOwnerUser option:selected").text().trim();
    const stageText = $("#waStage option:selected").text().trim();
    const notifyCount = (settings.notificationUserIds || []).length;
    const leadIntents = (settings.createLeadOnIntents || []).length;
    const autoReplyIntents = (settings.autoReplyOnIntents || []).length;
    const keywordRuleCount = (settings.keywordReplyRules || []).length;
    const quickReplyCount = (settings.quickReplyTemplates || []).length;
    const webhookReady = String($("#waWebhookPreview").val() || "").trim();

    return {
      "1": {
        done: !!(payload.name && (payload.api_key || hasSavedKey) && payload.session_name),
        summary: payload.name
          ? `${payload.name} • ${providerLabel}${payload.phone_number ? ` • ${payload.phone_number}` : ""}`
          : "Defina o nome, a credencial do numero e os dados principais da conexao.",
      },
      "2": {
        done: !!(payload.default_owner_user_id && payload.default_stage_id),
        summary: ownerText || stageText
          ? `${ownerText || "Sem owner"} • ${stageText || "Sem etapa"} • ${leadIntents} intencoes criam lead`
          : "Escolha owner, etapa padrao e as automacoes principais do comercial.",
      },
      "3": {
        done: !!(settings.businessContext || payload.auto_reply_prompt || payload.fallback_reply_text || keywordRuleCount || quickReplyCount),
        summary: settings.businessContext
          ? `${settings.businessContext.slice(0, 90)}${settings.businessContext.length > 90 ? "..." : ""}`
          : `Tom ${settings.assistantTone || "consultivo"} • ${autoReplyIntents} intencoes com resposta automatica`,
      },
      "4": {
        done: !!(String($("#waWebhookBaseUrl").val() || "").trim()),
        summary: webhookReady
          ? webhookReady
          : `Webhook ${String($("#waWebhookBaseUrl").val() || "").trim() || "ainda sem base publica"} • ${notifyCount} usuarios notificados`,
      },
    };
  }

  function renderStepCards() {
    const steps = getStepState();
    Object.keys(steps).forEach((step) => {
      const info = steps[step];
      const card = $(`#waStepCard${step}`);
      const status = $(`#waStepStatus${step}`);
      const summary = $(`#waStepSummary${step}`);
      card.toggleClass("is-done", !!info.done);
      status
        .text(info.done ? "Feito" : "Pendente")
        .toggleClass("is-done", !!info.done);
      summary.text(info.summary || "");
    });
  }

  function renderDiagnostics() {
    const current = selectedIntegration();
    const host = $("#waDiagnosticsPanel");
    if (!current) {
      host.html('<div class="wa-muted">Selecione uma instancia para ver diagnosticos de webhook, IA e atividade recente.</div>');
      return;
    }

    const payload = current.last_connection_payload || {};
    const debug = payload.webhook_debug || {};
    const lastInbound = current.last_inbound_at || "-";
    const lastOutbound = current.last_outbound_at || "-";
    const lastWebhookStatus = debug.status
      ? String(debug.status)
      : (payload && payload.webhook && payload.webhook.value === true ? "CONFIGURADO" : "Sem registro");
    const lastWebhookAt = debug.received_at || current.last_connection_at || "-";
    const webhookReason = debug.reason || debug.error || "";
    const bodyPreview = debug.body_preview || debug.normalized?.bodyText || "";

    host.html(`
      <div class="wa-detail-head" style="margin-bottom:12px;">
        <div>
          <h4 class="wa-section-title" style="margin-bottom:4px;">Diagnostico da instancia</h4>
          <div class="wa-muted">Aqui voce acompanha se o webhook bateu, se a IA classificou e quando a ultima atividade aconteceu.</div>
        </div>
        <div class="wa-status-pill ${current.is_active ? "" : "is-off"}">${esc(current.status || (current.is_active ? "ATIVA" : "INATIVA"))}</div>
      </div>
      <div class="wa-diag-grid">
        <div class="wa-diag-item"><label>Ultimo webhook</label><div>${esc(lastWebhookStatus)}</div></div>
        <div class="wa-diag-item"><label>Recebido em</label><div>${esc(lastWebhookAt)}</div></div>
        <div class="wa-diag-item"><label>Ultima entrada</label><div>${esc(lastInbound)}</div></div>
        <div class="wa-diag-item"><label>Ultima saida</label><div>${esc(lastOutbound)}</div></div>
      </div>
      ${webhookReason ? `<div class="wa-muted" style="margin-top:10px;"><strong>Observacao:</strong> ${esc(webhookReason)}</div>` : ""}
      ${bodyPreview ? `<div class="wa-muted" style="margin-top:8px;"><strong>Preview:</strong> ${esc(bodyPreview)}</div>` : ""}
      <details class="wa-json-box"${debug && Object.keys(debug).length ? "" : " open"}>
        <summary>Ultimo payload tecnico</summary>
        <pre>${esc(prettyJson(debug && Object.keys(debug).length ? debug : payload || {} ) || "Ainda sem payload registrado.")}</pre>
      </details>
    `);
  }

  function openDiagnosticsModal() {
    renderDiagnostics();
    if (typeof $("#waDiagnosticsModal").modal === "function") {
      $("#waDiagnosticsModal").modal("show");
    }
  }

  function openStepModal(step) {
    const meta = STEP_META[String(step)] || STEP_META["1"];
    state.activeStep = String(step);
    $("#waModalStepBadge").text(String(step));
    $("#waModalTitle").text(meta.title);
    $("#waModalDescription").text(meta.description);
    $(".wa-step-modal-section").hide();
    $(`.wa-step-modal-section[data-step="${esc(step)}"]`).show();
    $("#waStepModal").addClass("is-open");
  }

  function closeStepModal() {
    $("#waStepModal").removeClass("is-open");
  }

  async function saveIntegration(closeModalAfterSave) {
    const payload = gatherPayload();
    if (!payload.name) throw new Error("Preencha ao menos o nome da instancia.");

    const current = selectedIntegration();
    const usePartnerProvision = !current && partnerEnabled();
    const hasSavedKey = integrationHasSavedApiKey();

    if (!usePartnerProvision && !payload.api_key && !hasSavedKey) {
      throw new Error("Informe a credencial principal da instancia.");
    }
    if (!usePartnerProvision && !payload.session_name) throw new Error("Informe a sessao / instance ID.");

    if (!payload.api_base_url) {
      const defaults = providerDefaults();
      payload.api_base_url = defaults.api_base_url || "https://api.z-api.io";
    }

    const method = current ? "PATCH" : "POST";
    const url = current
      ? `/api/sales/whatsapp/integrations/${encodeURIComponent(current.id)}`
      : usePartnerProvision
        ? "/api/sales/whatsapp/integrations/provision"
        : "/api/sales/whatsapp/integrations";
    if (current && !payload.api_key) delete payload.api_key;

    const saved = await api(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    await loadIntegrations(saved.id);
    await Promise.all([loadTemplates(), loadCampaigns()]);
    renderStepCards();
    showMessage("Configuracao salva com sucesso.");
    if (closeModalAfterSave) closeStepModal();
  }

  async function provisionIntegration() {
    if (!partnerEnabled()) throw new Error("Conta parceira nao configurada.");
    const payload = gatherPayload();
    if (!payload.name) throw new Error("Informe o nome da instancia.");

    const saved = await api("/api/sales/whatsapp/integrations/provision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    await loadIntegrations(saved.id);
    await Promise.all([loadTemplates(), loadCampaigns()]);
    renderStepCards();
    showMessage("Instancia criada automaticamente com sucesso.");
    openStepModal("4");
  }

  async function loadMeta() {
    state.meta = await api("/api/sales/whatsapp/meta");
    fillSelect($("#waProvider"), state.meta.providers || [], "value", "label", "Selecione o provider");
    fillSelect($("#waOwnerUser"), state.meta.users || [], "id", "full_name", "Selecione o owner");
    fillSelect($("#waStage"), state.meta.stages || [], "id", "name", "Selecione a etapa");
    fillSelect($("#waStatusFilter"), state.meta.conversation_statuses || [], "value", "label", "Todos os status");
    fillSelect($("#waTemplateCategory"), state.meta.template_categories || [], "value", "label", "Categoria");
    fillSelect($("#waTemplateScope"), state.meta.template_scopes || [], "value", "label", "Uso");
    const userOptions = normalizeRows(state.meta.users || []).map((user) =>
      `<option value="${esc(user.id)}">${esc(user.full_name)}${user.role ? ` • ${esc(user.role)}` : ""}</option>`
    );
    $("#waNotificationUsers").html(userOptions.join(""));
    $("#waProvider").val(state.meta.default_provider || providerDefaults().provider || "ZAPI");
    $("#waProvider").prop("disabled", true);
    applyProviderUi($("#waProvider").val());
  }

  async function loadIntegrations(preferredId) {
    state.integrations = normalizeRows(await api("/api/sales/whatsapp/integrations"));
    state.selectedIntegrationId = preferredId || state.selectedIntegrationId || state.integrations[0]?.id || null;
    renderIntegrationsList();
    fillIntegrationForm();
    renderDiagnostics();
    applyDockState();
  }

  function normalizePhoneLocal(value) {
    return String(value || "").replace(/\D/g, "").trim();
  }

  function selectedTemplate() {
    return state.templates.find((item) => String(item.id) === String(state.selectedTemplateId)) || null;
  }

  function selectedCampaignSummary() {
    return state.campaigns.find((item) => String(item.id) === String(state.selectedCampaignId)) || null;
  }

  function resetTemplateForm() {
    state.selectedTemplateId = null;
    $("#waTemplateName").val("");
    $("#waTemplateCategory").val("GENERAL");
    $("#waTemplateScope").val("BOTH");
    $("#waTemplateText").val("");
    $("#waTemplateActive").prop("checked", true);
    renderTemplatesList();
  }

  function fillCampaignTemplateOptions() {
    const current = String($("#waCampaignTemplate").val() || "");
    const options = [`<option value="">Sem template base</option>`].concat(
      normalizeRows(state.templates || [])
        .filter((item) => item.is_active !== false && ["CAMPAIGN", "BOTH"].includes(String(item.usage_scope || "BOTH")))
        .map((item) => `<option value="${esc(item.id)}">${esc(item.name)} â€¢ ${esc(templateScopeLabel(item.usage_scope))}</option>`)
    );
    $("#waCampaignTemplate").html(options.join(""));
    if (current) $("#waCampaignTemplate").val(current);
  }

  function renderTemplatesList() {
    const host = $("#waTemplatesList");
    host.empty();
    if (!state.templates.length) {
      host.html('<div class="wa-empty">Nenhum template salvo para esta operação.</div>');
      return;
    }
    state.templates.forEach((item) => {
      const active = String(item.id) === String(state.selectedTemplateId) ? "is-active" : "";
      host.append(`
        <button type="button" class="${active}" data-id="${esc(item.id)}">
          <h5>${esc(item.name)}</h5>
          <p>${esc(item.category || "GENERAL")} • ${esc(templateScopeLabel(item.usage_scope))}</p>
          <p>${esc(String(item.message_text || "").slice(0, 110))}${String(item.message_text || "").length > 110 ? "..." : ""}</p>
        </button>
      `);
    });
    host.find("button").on("click", function () {
      state.selectedTemplateId = String($(this).data("id") || "");
      fillTemplateForm();
      renderTemplatesList();
    });
  }

  function fillTemplateForm() {
    const template = selectedTemplate();
    if (!template) {
      resetTemplateForm();
      return;
    }
    $("#waTemplateName").val(template.name || "");
    $("#waTemplateCategory").val(template.category || "GENERAL");
    $("#waTemplateScope").val(template.usage_scope || "BOTH");
    $("#waTemplateText").val(template.message_text || "");
    $("#waTemplateActive").prop("checked", template.is_active !== false);
  }

  async function loadTemplates() {
    const params = new URLSearchParams();
    if (state.selectedIntegrationId) params.set("integration_id", state.selectedIntegrationId);
    state.templates = normalizeRows(await api(`/api/sales/whatsapp/templates?${params.toString()}`));
    if (!state.templates.some((item) => String(item.id) === String(state.selectedTemplateId))) {
      state.selectedTemplateId = state.templates[0]?.id || null;
    }
    renderTemplatesList();
    fillTemplateForm();
    fillCampaignTemplateOptions();
    renderQuickReplies();
  }

  async function saveTemplate() {
    const payload = {
      integration_id: state.selectedIntegrationId || null,
      name: String($("#waTemplateName").val() || "").trim(),
      category: String($("#waTemplateCategory").val() || "GENERAL").trim(),
      usage_scope: String($("#waTemplateScope").val() || "BOTH").trim(),
      message_text: String($("#waTemplateText").val() || "").trim(),
      is_active: $("#waTemplateActive").is(":checked"),
    };
    if (!payload.name || !payload.message_text) throw new Error("Preencha nome e mensagem do template.");
    const current = selectedTemplate();
    const saved = await api(current ? `/api/sales/whatsapp/templates/${encodeURIComponent(current.id)}` : "/api/sales/whatsapp/templates", {
      method: current ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadTemplates();
    state.selectedTemplateId = saved?.id || state.selectedTemplateId;
    fillTemplateForm();
    showMessage("Template salvo com sucesso.");
  }

  function upsertCampaignRecipient(recipient) {
    const phone = normalizePhoneLocal(recipient?.phone_number || recipient?.phone_number_normalized);
    if (!phone) return false;
    const next = Object.assign({}, recipient, {
      phone_number_normalized: phone,
      phone_number: String(recipient?.phone_number || phone).trim(),
      contact_name: String(recipient?.contact_name || recipient?.name || `Contato ${phone}`).trim(),
      snapshot_opt_in_status: String(recipient?.snapshot_opt_in_status || "UNKNOWN").trim() || "UNKNOWN",
    });
    const idx = state.campaignRecipientsDraft.findIndex((item) => normalizePhoneLocal(item.phone_number_normalized || item.phone_number) === phone);
    if (idx >= 0) state.campaignRecipientsDraft[idx] = Object.assign({}, state.campaignRecipientsDraft[idx], next);
    else state.campaignRecipientsDraft.push(next);
    renderCampaignRecipients();
    return true;
  }

  function renderCampaignRecipients() {
    const host = $("#waCampaignRecipients");
    host.empty();
    if (!state.campaignRecipientsDraft.length) {
      host.html('<div class="wa-empty" style="grid-column:1/-1;">Nenhum destinatário adicionado ainda.</div>');
      return;
    }
    state.campaignRecipientsDraft.forEach((recipient) => {
      host.append(`
        <div class="wa-recipient-item" data-phone="${esc(recipient.phone_number_normalized || recipient.phone_number)}">
          <strong>${esc(recipient.contact_name || recipient.phone_number)}</strong>
          <p>${esc(recipient.phone_number || recipient.phone_number_normalized || "-")}</p>
          <p>${esc(consentLabel(recipient.snapshot_opt_in_status))}${recipient.source_label ? ` • ${esc(recipient.source_label)}` : ""}</p>
          ${recipient.send_status ? `<p>Status: ${esc(recipientStatusLabel(recipient.send_status))}</p>` : ""}
          <div class="wa-inline-actions">
            <button type="button" class="btn btn-white btn-xs js-wa-campaign-recipient-remove"><i class="fa fa-times"></i> Remover</button>
          </div>
        </div>
      `);
    });
  }

  function resetCampaignForm() {
    state.selectedCampaignId = null;
    state.selectedCampaign = null;
    state.campaignRecipientsDraft = [];
    $("#waCampaignName").val("");
    $("#waCampaignTemplate").val("");
    $("#waCampaignStatus").val("DRAFT");
    $("#waCampaignText").val("");
    $("#waCampaignStatusPill").text("Rascunho").addClass("is-off");
    renderCampaignsList();
    renderCampaignRecipients();
  }

  function renderCampaignsList() {
    const host = $("#waCampaignsList");
    host.empty();
    if (!state.campaigns.length) {
      host.html('<div class="wa-empty">Nenhuma campanha criada ainda.</div>');
      return;
    }
    state.campaigns.forEach((item) => {
      const active = String(item.id) === String(state.selectedCampaignId) ? "is-active" : "";
      host.append(`
        <button type="button" class="${active}" data-id="${esc(item.id)}">
          <h5>${esc(item.name)}</h5>
          <p>${esc(campaignStatusLabel(item.status))} • ${esc(item.recipients_total || 0)} destinatários</p>
          <p>Enviadas ${esc(item.sent_total || 0)} • Falhas ${esc(item.failed_total || 0)} • Skip ${esc(item.skipped_total || 0)}</p>
        </button>
      `);
    });
    host.find("button").on("click", function () {
      loadCampaignDetail(String($(this).data("id") || "")).catch(handleError);
    });
  }

  function fillCampaignForm() {
    const campaign = state.selectedCampaign || null;
    if (!campaign) {
      resetCampaignForm();
      return;
    }
    $("#waCampaignName").val(campaign.name || "");
    $("#waCampaignTemplate").val(campaign.template_id || "");
    $("#waCampaignStatus").val(campaign.status || "DRAFT");
    $("#waCampaignText").val(campaign.message_text || "");
    $("#waCampaignStatusPill").text(campaignStatusLabel(campaign.status)).toggleClass("is-off", String(campaign.status || "") === "DRAFT");
    state.campaignRecipientsDraft = normalizeRows(campaign.recipients || []).map((item) => Object.assign({}, item));
    renderCampaignRecipients();
  }

  async function loadCampaigns(preferredId) {
    const params = new URLSearchParams();
    if (state.selectedIntegrationId) params.set("integration_id", state.selectedIntegrationId);
    state.campaigns = normalizeRows(await api(`/api/sales/whatsapp/campaigns?${params.toString()}`));
    state.selectedCampaignId = preferredId || state.selectedCampaignId || state.campaigns[0]?.id || null;
    renderCampaignsList();
    fillCampaignTemplateOptions();
    if (state.selectedCampaignId) {
      await loadCampaignDetail(state.selectedCampaignId);
    } else {
      resetCampaignForm();
    }
  }

  async function loadCampaignDetail(campaignId) {
    if (!campaignId) {
      resetCampaignForm();
      return;
    }
    state.selectedCampaign = await api(`/api/sales/whatsapp/campaigns/${encodeURIComponent(campaignId)}`);
    state.selectedCampaignId = state.selectedCampaign?.id || campaignId;
    renderCampaignsList();
    fillCampaignForm();
  }

  async function saveCampaign() {
    if (!state.selectedIntegrationId) throw new Error("Selecione uma instância antes de criar campanha.");
    const payload = {
      integration_id: state.selectedIntegrationId,
      template_id: String($("#waCampaignTemplate").val() || "").trim() || null,
      name: String($("#waCampaignName").val() || "").trim(),
      message_text: String($("#waCampaignText").val() || "").trim(),
      audience_mode: "MANUAL",
      recipients: state.campaignRecipientsDraft.map((item) => ({
        conversation_id: item.conversation_id || null,
        lead_id: item.lead_id || null,
        phone_number: item.phone_number || item.phone_number_normalized,
        contact_name: item.contact_name || null,
        company_name: item.company_name || null,
        source_label: item.source_label || null,
        snapshot_opt_in_status: item.snapshot_opt_in_status || "UNKNOWN",
      })),
    };
    if (!payload.name) throw new Error("Informe o nome da campanha.");
    if (!payload.message_text && !payload.template_id) throw new Error("Escreva a mensagem da campanha ou escolha um template.");

    const current = state.selectedCampaign;
    const saved = await api(current ? `/api/sales/whatsapp/campaigns/${encodeURIComponent(current.id)}` : "/api/sales/whatsapp/campaigns", {
      method: current ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadCampaigns(saved?.id || current?.id || null);
    showMessage("Campanha salva com sucesso.");
  }

  async function launchCampaign() {
    if (!state.selectedCampaignId) throw new Error("Salve a campanha antes de disparar.");
    await api(`/api/sales/whatsapp/campaigns/${encodeURIComponent(state.selectedCampaignId)}/launch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resend_failed: false }),
    });
    await loadCampaigns(state.selectedCampaignId);
    showMessage("Campanha disparada.");
  }

  function addCurrentConversationToCampaign() {
    const conversation = currentConversation();
    if (!conversation) throw new Error("Selecione uma conversa para adicionar.");
    upsertCampaignRecipient({
      conversation_id: conversation.id,
      lead_id: conversation.lead_id || null,
      phone_number: conversation.contact_phone || conversation.contact_phone_normalized,
      phone_number_normalized: conversation.contact_phone_normalized,
      contact_name: conversation.contact_name || conversation.contact_phone,
      source_label: "Conversa atual",
      snapshot_opt_in_status: conversation.marketing_opt_in_status || "UNKNOWN",
    });
  }

  function addOptInsToCampaign() {
    const rows = normalizeRows(state.conversations || []).filter((item) => String(item.marketing_opt_in_status || "") === "OPTED_IN");
    if (!rows.length) throw new Error("Nenhum contato com opt-in ativo na inbox atual.");
    rows.forEach((conversation) => {
      upsertCampaignRecipient({
        conversation_id: conversation.id,
        lead_id: conversation.lead_id || null,
        phone_number: conversation.contact_phone || conversation.contact_phone_normalized,
        phone_number_normalized: conversation.contact_phone_normalized,
        contact_name: conversation.contact_name || conversation.contact_phone,
        source_label: "Inbox filtrada",
        snapshot_opt_in_status: conversation.marketing_opt_in_status || "OPTED_IN",
      });
    });
  }

  function addManualRecipientToCampaign() {
    const phone = String($("#waCampaignManualPhone").val() || "").trim();
    if (!normalizePhoneLocal(phone)) throw new Error("Informe um telefone válido.");
    upsertCampaignRecipient({
      phone_number: phone,
      phone_number_normalized: phone,
      contact_name: String($("#waCampaignManualName").val() || "").trim() || phone,
      source_label: "Manual",
      snapshot_opt_in_status: "UNKNOWN",
    });
    $("#waCampaignManualName").val("");
    $("#waCampaignManualPhone").val("");
  }

  async function loadQrCode() {
    const current = selectedIntegration();
    if (!current) throw new Error("Crie ou selecione uma instancia antes de gerar o QR Code.");
    const data = await api(`/api/sales/whatsapp/integrations/${encodeURIComponent(current.id)}/qrcode`);
    if (data.connected) {
      $("#waQrContainer").html('<div class="wa-status-pill">Numero ja conectado</div>');
      return;
    }

    const raw = String(data.qr_code || "").trim();
    if (!raw) {
      const qrError = String(data.qr_error || "").trim();
      const detail = qrError ? `<div class="wa-muted" style="margin-top:8px;">${esc(qrError)}</div>` : "";
      $("#waQrContainer").html('<div class="wa-empty">QR Code indisponivel no momento. Tente novamente em alguns segundos.</div>');
      if (detail) {
        $("#waQrContainer").append(detail);
      }
      return;
    }

    if (!looksLikeQrImagePayload(raw)) {
      $("#waQrContainer").html(`
        <div class="wa-empty">A Z-API nao retornou uma imagem valida para o QR Code.</div>
        <div class="wa-muted" style="margin-top:8px;">${esc(raw)}</div>
      `);
      return;
    }

    const src = raw.startsWith("data:") ? raw : `data:image/png;base64,${raw}`;
    $("#waQrContainer").html(`
      <div style="text-align:center;">
        <img src="${esc(src)}" alt="QR Code WhatsApp" style="max-width:280px; width:100%; border-radius:16px; border:1px solid #dce7e2; background:#fff; padding:12px;" />
        <div class="wa-muted" style="margin-top:10px;">Abra o WhatsApp do numero, entre em dispositivos conectados e leia este QR Code.</div>
      </div>
    `);
  }

  async function loadConversations() {
    const params = new URLSearchParams();
    if (state.selectedIntegrationId) params.set("integration_id", state.selectedIntegrationId);
    const q = String($("#waConversationSearch").val() || "").trim();
    const ownership = String($("#waOwnershipFilter").val() || "ALL").trim();
    const status = String($("#waStatusFilter").val() || "").trim();
    if (q) params.set("q", q);
    if (ownership && ownership !== "ALL") params.set("ownership", ownership);
    if (status) params.set("status", status);
    state.conversations = normalizeRows(await api(`/api/sales/whatsapp/conversations?${params.toString()}`));
    if (!state.conversations.some((item) => String(item.id) === String(state.selectedConversationId))) {
      state.selectedConversationId = state.conversations[0]?.id || null;
    }
    renderConversations();
    updateMetrics();
    renderDiagnostics();
    applyDockState();
    if (state.selectedConversationId) {
      await loadConversationDetail(state.selectedConversationId);
    } else {
      state.selectedConversation = null;
      state.notes = [];
      renderConversationDetail(null);
      renderMessages([]);
    }
  }

  function renderConversations() {
    const host = $("#waConversationsList");
    host.empty();
    if (!state.conversations.length) {
      host.html('<div class="wa-empty">Nenhuma conversa encontrada para esta instancia.</div>');
      return;
    }
    state.conversations.forEach((item) => {
      const active = String(item.id) === String(state.selectedConversationId) ? "is-active" : "";
      const ownerName = item.owner_user?.full_name || "";
      const unread = Number(item.unread_count || 0);
      const notesCount = Number(item.notes_count || 0);
      const avatarUrl = conversationAvatarUrl(item);
      const avatarHtml = avatarUrl
        ? `<img src="${esc(avatarUrl)}" alt="${esc(item.contact_name || item.contact_phone || "Contato")}" />`
        : esc(conversationInitials(item));
      host.append(`
        <button type="button" class="${active}" data-id="${esc(item.id)}">
          <div class="wa-list-entry">
            <div class="wa-list-avatar">${avatarHtml}</div>
            <div class="wa-list-main">
          <div class="wa-list-topline">
            <h5>${esc(item.contact_name || item.contact_phone)}</h5>
            ${unread ? `<span class="wa-badge-soft is-unread">${esc(unread)} nova${unread > 1 ? "s" : ""}</span>` : ""}
          </div>
          <p>${esc(item.classification_intent || item.status || "Novo")} • ${esc(item.last_message_preview || "Sem previa")}</p>
          <div class="wa-list-bottomline">
            ${item.lead ? `<span class="wa-status-pill">Lead: ${esc(item.lead.name)}</span>` : `<span class="wa-status-pill is-off">Sem lead</span>`}
            <span class="wa-badge-soft">${ownerName ? `Owner: ${esc(ownerName)}` : "Sem owner"}</span>
            <span class="wa-badge-soft">${esc(consentLabel(item.marketing_opt_in_status || "UNKNOWN"))}</span>
            ${notesCount ? `<span class="wa-badge-soft">${esc(notesCount)} nota${notesCount > 1 ? "s" : ""}</span>` : ""}
          </div>
            </div>
          </div>
        </button>
      `);
    });
    host.find("button").on("click", function () {
      state.selectedConversationId = String($(this).data("id") || "");
      renderConversations();
      loadConversationDetail(state.selectedConversationId).catch(handleError);
    });
  }

  async function loadConversationDetail(conversationId) {
    const [conversation, messages, notes] = await Promise.all([
      api(`/api/sales/whatsapp/conversations/${encodeURIComponent(conversationId)}`),
      api(`/api/sales/whatsapp/conversations/${encodeURIComponent(conversationId)}/messages`),
      api(`/api/sales/whatsapp/conversations/${encodeURIComponent(conversationId)}/notes`),
    ]);
    const rows = normalizeRows(messages);
    state.selectedConversation = conversation || null;
    state.notes = normalizeRows(notes);
    state.conversations = state.conversations.map((item) =>
      String(item.id) === String(conversation?.id || "") ? Object.assign({}, item, conversation) : item
    );
    renderConversations();
    renderConversationDetail(conversation, rows, state.notes);
    renderMessages(rows);
    renderQuickReplies();
  }

  function renderConversationDetail(conversation, messages, notes) {
    if (!conversation) {
      state.selectedConversation = null;
      state.notes = [];
      $("#waConversationMeta").html('<div class="wa-empty">Selecione uma conversa para visualizar as mensagens e responder.</div>');
      $("#waQuickReplies").html("");
      return;
    }
    const extractedJson = conversation.extracted_json || {};
    const lastInboundAi = (messages || []).slice().reverse().find((msg) =>
      String(msg.direction || "").toUpperCase() === "INBOUND" && msg.ai_result_json
    );
    const confidence = conversation.classification_confidence == null ? "-" : String(conversation.classification_confidence);
    const ownerOptions = [`<option value="">Sem owner</option>`]
      .concat(normalizeRows(state.meta?.users || []).map((user) => (
        `<option value="${esc(user.id)}" ${String(user.id) === String(conversation.owner_user_id || "") ? "selected" : ""}>${esc(user.full_name)}</option>`
      )))
      .join("");
    const statusOptions = [`<option value="">Selecione</option>`]
      .concat(normalizeRows(state.meta?.conversation_statuses || []).map((item) => (
        `<option value="${esc(item.value)}" ${String(item.value) === String(conversation.status || "") ? "selected" : ""}>${esc(item.label)}</option>`
      )))
      .join("");
    const consentStatus = String(conversation.marketing_opt_in_status || "UNKNOWN");
    $("#waConversationMeta").html(`
      <div class="wa-detail-head">
        <div>
          <h4 class="wa-section-title">${esc(conversation.contact_name || conversation.contact_phone)}</h4>
          <div class="wa-muted">${esc(conversation.contact_phone || "")}</div>
        </div>
        <div class="wa-actions">
          <span class="wa-status-pill ${conversation.lead_id ? "" : "is-off"}">${esc(conversation.classification_intent || conversation.status || "Novo")}</span>
          <button type="button" class="btn btn-white btn-sm" id="waClaimBtn">Assumir</button>
          <button type="button" class="btn btn-white btn-sm" id="waReleaseBtn">Liberar</button>
        </div>
      </div>
      <div class="wa-ops-grid">
        <div class="wa-ops-cell">
          <label>Owner</label>
          <select id="waConversationOwner">${ownerOptions}</select>
        </div>
        <div class="wa-ops-cell">
          <label>Status</label>
          <select id="waConversationStatus">${statusOptions}</select>
        </div>
        <div class="wa-ops-cell">
          <label>Lead vinculado</label>
          <div>${conversation.lead ? esc(conversation.lead.name) : "Nenhum lead vinculado"}</div>
        </div>
        <div class="wa-ops-cell">
          <label>Confianca IA</label>
          <div>${esc(confidence)}</div>
        </div>
        <div class="wa-ops-cell">
          <label>Marketing</label>
          <div>${esc(consentLabel(consentStatus))}</div>
        </div>
      </div>
      <div class="wa-consent-row">
        <span class="wa-badge-soft">${esc(consentLabel(consentStatus))}</span>
        ${conversation.marketing_opt_in_source ? `<span class="wa-badge-soft">Origem: ${esc(conversation.marketing_opt_in_source)}</span>` : ""}
        <button type="button" class="btn btn-white btn-sm" id="waOptInBtn"><i class="fa fa-check-circle"></i> Marcar opt-in</button>
        <button type="button" class="btn btn-white btn-sm" id="waOptOutBtn"><i class="fa fa-ban"></i> Marcar opt-out</button>
      </div>
      <div class="wa-grid-2" style="margin-top:12px;">
        <div><label>Resumo da IA</label><div>${esc(conversation.classification_summary || "Ainda sem resumo.")}</div></div>
        <div><label>Intencao</label><div>${esc(conversation.classification_intent || "Ainda nao classificada")}</div></div>
      </div>
      <div class="wa-note-box">
        <div class="wa-note-row" style="justify-content:space-between;">
          <div>
            <h4 class="wa-section-title" style="margin-bottom:4px;">Notas internas</h4>
            <div class="wa-muted">Registre contexto comercial sem expor isso ao cliente.</div>
          </div>
          <span class="wa-badge-soft">${esc((notes || []).length)} nota${(notes || []).length === 1 ? "" : "s"}</span>
        </div>
        <div class="wa-note-compose" style="margin-top:12px;">
          <textarea id="waInternalNoteInput" placeholder="Ex.: cliente pediu retorno comercial ainda hoje."></textarea>
          <button type="button" class="btn btn-white" id="waAddNoteBtn"><i class="fa fa-sticky-note"></i> Salvar nota</button>
        </div>
        <div class="wa-note-list" id="waNotesList"></div>
      </div>
      <details class="wa-json-box">
        <summary>Log da IA da conversa</summary>
        <pre>${esc(prettyJson(extractedJson) || "Ainda sem extracao registrada.")}</pre>
      </details>
      <details class="wa-json-box">
        <summary>Ultima analise por mensagem</summary>
        <pre>${esc(prettyJson(lastInboundAi?.ai_result_json) || "Ainda nao ha analise de mensagem inbound nesta conversa.")}</pre>
      </details>
    `);
    renderNotes(notes);
  }

  function renderNotes(notes) {
    const host = $("#waNotesList");
    host.empty();
    const rows = normalizeRows(notes);
    if (!rows.length) {
      host.html('<div class="wa-empty">Nenhuma nota interna registrada para esta conversa.</div>');
      return;
    }
    rows.forEach((note) => {
      host.append(`
        <div class="wa-note-item">
          <strong>${esc(note.user?.full_name || note.user?.email || "Equipe")}</strong>
          <small class="wa-muted" style="display:block; margin-top:4px;">${esc(note.created_at || "")}</small>
          <p>${esc(note.note_text || "")}</p>
        </div>
      `);
    });
  }

  function renderQuickReplies() {
    const host = $("#waQuickReplies");
    host.empty();
    const rows = currentConversationQuickReplies();
    if (!rows.length) return;
    rows.forEach((item) => {
      host.append(`<button type="button" class="wa-quick-reply" data-text="${esc(item.text)}">${esc(item.label)}</button>`);
    });
    host.find("button").on("click", function () {
      const text = String($(this).data("text") || "");
      $("#waReplyInput").val(text).trigger("focus");
    });
  }

  function renderMessages(messages) {
    state.messages = messages || [];
    const host = $("#waMessagesPanel");
    host.empty();
    if (!state.messages.length) {
      host.html('<div class="wa-empty">Sem mensagens nesta conversa.</div>');
      return;
    }
    state.messages.forEach((msg) => {
      const cls = String(msg.direction || "").toUpperCase() === "OUTBOUND" ? "out" : "in";
      host.append(`
        <div class="wa-bubble ${cls}">
          <div>${esc(msg.body_text || msg.media_url || "[mensagem sem conteudo de texto]")}</div>
          <small>${esc(msg.message_type || "TEXT")} • ${esc(msg.created_at || "")}</small>
        </div>
      `);
    });
    host.scrollTop(host.prop("scrollHeight"));
  }

  async function handleReply() {
    if (!state.selectedConversationId) throw new Error("Selecione uma conversa.");
    const message = String($("#waReplyInput").val() || "").trim();
    if (!message) throw new Error("Digite a mensagem antes de responder.");
    await api(`/api/sales/whatsapp/conversations/${encodeURIComponent(state.selectedConversationId)}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    $("#waReplyInput").val("");
    await loadConversations();
  }

  async function handleWorkflowUpdate(patch) {
    if (!state.selectedConversationId) throw new Error("Selecione uma conversa.");
    await api(`/api/sales/whatsapp/conversations/${encodeURIComponent(state.selectedConversationId)}/workflow`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch || {}),
    });
    await loadConversations();
  }

  async function handleClaimConversation() {
    if (!state.selectedConversationId) throw new Error("Selecione uma conversa.");
    await api(`/api/sales/whatsapp/conversations/${encodeURIComponent(state.selectedConversationId)}/claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await loadConversations();
  }

  async function handleReleaseConversation() {
    if (!state.selectedConversationId) throw new Error("Selecione uma conversa.");
    await api(`/api/sales/whatsapp/conversations/${encodeURIComponent(state.selectedConversationId)}/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    await loadConversations();
  }

  async function handleAddNote() {
    if (!state.selectedConversationId) throw new Error("Selecione uma conversa.");
    const noteText = String($("#waInternalNoteInput").val() || "").trim();
    if (!noteText) throw new Error("Digite a nota interna antes de salvar.");
    await api(`/api/sales/whatsapp/conversations/${encodeURIComponent(state.selectedConversationId)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note_text: noteText }),
    });
    $("#waInternalNoteInput").val("");
    await loadConversationDetail(state.selectedConversationId);
    await loadConversations();
  }

  async function handleConsentUpdate(status) {
    if (!state.selectedConversationId) throw new Error("Selecione uma conversa.");
    const source = status === "OPTED_IN" ? "OPERADOR" : "OPERADOR";
    await api(`/api/sales/whatsapp/conversations/${encodeURIComponent(state.selectedConversationId)}/consent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        marketing_opt_in_status: status,
        marketing_opt_in_source: source,
      }),
    });
    await loadConversationDetail(state.selectedConversationId);
    await loadConversations();
  }

  async function handleConnect() {
    const current = selectedIntegration();
    if (!current) throw new Error("Salve uma instancia antes de conectar.");
    const result = await api(`/api/sales/whatsapp/integrations/${encodeURIComponent(current.id)}/connect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "connect",
        webhook_base_url: String($("#waWebhookBaseUrl").val() || "").trim(),
      }),
    });
    showMessage(`Webhook conectado. Status do provider: ${result.provider_status || "-"}.`);
    await loadIntegrations(current.id);
    renderStepCards();
  }

  async function handleTestSend() {
    const current = selectedIntegration();
    if (!current) throw new Error("Salve uma instancia antes do teste.");
    await api(`/api/sales/whatsapp/integrations/${encodeURIComponent(current.id)}/test-send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: String($("#waTestMessage").val() || "").trim(),
        phone_number: String($("#waTestPhone").val() || "").trim(),
      }),
    });
    showMessage("Mensagem de teste enviada.");
    await loadConversations();
  }

  async function handleReprocess() {
    if (!state.selectedConversationId) throw new Error("Selecione uma conversa.");
    await api(`/api/sales/whatsapp/conversations/${encodeURIComponent(state.selectedConversationId)}/reprocess`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    showMessage("Conversa reprocessada com IA.");
    await loadConversations();
  }

  function resetNewIntegration() {
    state.selectedIntegrationId = null;
    renderIntegrationsList();
    fillIntegrationForm();
    renderStepCards();
    showMessage("Nova configuracao pronta para preenchimento.");
    renderDiagnostics();
    applyDockState();
  }

  function startInboxPolling() {
    if (state.inboxPollTimer) {
      clearInterval(state.inboxPollTimer);
      state.inboxPollTimer = null;
    }
    state.inboxPollTimer = window.setInterval(function () {
      if (document.hidden) return;
      if ($("#waStepModal").hasClass("is-open")) return;
      if (!state.selectedIntegrationId) return;
      loadConversations().catch(function () {});
    }, 12000);
  }

  function bindLiveSummaryUpdates() {
    $(document).on("change keyup", "#waName, #waProvider, #waBaseUrl, #waApiKey, #waSessionName, #waProviderClientToken, #waPhoneNumber, #waOwnerUser, #waStage, #waAssistantTone, #waActivitySubjectTemplate, #waBusinessContext, #waClassifierPrompt, #waAutoReplyPrompt, #waFallbackReply, #waKeywordReplyRules, #waQuickReplyTemplates, #waCampaignFooterText, #waOptOutKeywords, #waWebhookBaseUrl", function () {
      renderStepCards();
    });
    $(document).on("change", "#waClassifyWithAi, #waAutoCreateLead, #waCreateLeadActivity, #waNotifyTeam, #waAutoReplyEnabled, #waIsActive, #waNotificationUsers, #waCreateLeadIntentGroup input, #waAutoReplyIntentGroup input", function () {
      renderStepCards();
    });
  }

  function handleError(error) {
    const message = String(error?.message || "Falha ao processar a operacao.");
    showMessage(message, true);
    showAlert("Nao foi possivel concluir", message, "error");
  }

  $(document).ready(function () {
    setHeader();
    bindLiveSummaryUpdates();

    $("#waSaveBtn").on("click", function () { saveIntegration(false).catch(handleError); });
    $("#waModalSaveBtn").on("click", function () { saveIntegration(true).catch(handleError); });
    $("#waProvisionBtn").on("click", function () { provisionIntegration().catch(handleError); });
    $("#waConnectBtn, #waModalConnectBtn").on("click", function () { handleConnect().catch(handleError); });
    $("#waTestSendBtn, #waModalTestSendBtn").on("click", function () { handleTestSend().catch(handleError); });
    $("#waShowQrBtn").on("click", function () { loadQrCode().catch(handleError); });
    $("#waReplyBtn").on("click", function () { handleReply().catch(handleError); });
    $("#waReprocessBtn").on("click", function () { handleReprocess().catch(handleError); });
    $("#waNewIntegrationBtn").on("click", resetNewIntegration);
    $("#waRefreshInboxBtn").on("click", function () { loadConversations().catch(handleError); });
    $("#waOpenDiagnosticsBtn").on("click", openDiagnosticsModal);
    $("#waOwnershipFilter, #waStatusFilter").on("change", function () {
      loadConversations().catch(handleError);
    });
    $("#waConversationSearch").on("change keyup", function (ev) {
      if (ev.type === "keyup" && ev.key !== "Enter") return;
      loadConversations().catch(handleError);
    });
    $(document).on("change", "#waConversationOwner", function () {
      handleWorkflowUpdate({ owner_user_id: String($(this).val() || "").trim() || null }).catch(handleError);
    });
    $(document).on("change", "#waConversationStatus", function () {
      const value = String($(this).val() || "").trim();
      if (!value) return;
      handleWorkflowUpdate({ status: value }).catch(handleError);
    });
    $(document).on("click", "#waClaimBtn", function () {
      handleClaimConversation().catch(handleError);
    });
    $(document).on("click", "#waReleaseBtn", function () {
      handleReleaseConversation().catch(handleError);
    });
    $(document).on("click", "#waAddNoteBtn", function () {
      handleAddNote().catch(handleError);
    });
    $(document).on("click", "#waOptInBtn", function () {
      handleConsentUpdate("OPTED_IN").catch(handleError);
    });
    $(document).on("click", "#waOptOutBtn", function () {
      handleConsentUpdate("OPTED_OUT").catch(handleError);
    });
    $("#waTemplateNewBtn").on("click", resetTemplateForm);
    $("#waTemplateSaveBtn").on("click", function () { saveTemplate().catch(handleError); });
    $("#waCampaignNewBtn").on("click", resetCampaignForm);
    $("#waCampaignSaveBtn").on("click", function () { saveCampaign().catch(handleError); });
    $("#waCampaignLaunchBtn").on("click", function () { launchCampaign().catch(handleError); });
    $("#waCampaignAddCurrentBtn").on("click", function () { try { addCurrentConversationToCampaign(); } catch (error) { handleError(error); } });
    $("#waCampaignAddOptInsBtn").on("click", function () { try { addOptInsToCampaign(); } catch (error) { handleError(error); } });
    $("#waCampaignAddManualBtn").on("click", function () { try { addManualRecipientToCampaign(); } catch (error) { handleError(error); } });
    $("#waCampaignTemplate").on("change", function () {
      const templateId = String($(this).val() || "").trim();
      const template = normalizeRows(state.templates || []).find((item) => String(item.id) === templateId);
      if (template && !String($("#waCampaignText").val() || "").trim()) {
        $("#waCampaignText").val(template.message_text || "");
      }
    });
    $(document).on("click", ".js-wa-campaign-recipient-remove", function () {
      const phone = String($(this).closest(".wa-recipient-item").data("phone") || "");
      state.campaignRecipientsDraft = state.campaignRecipientsDraft.filter((item) => normalizePhoneLocal(item.phone_number_normalized || item.phone_number) !== normalizePhoneLocal(phone));
      renderCampaignRecipients();
    });

    $(".wa-open-step").on("click", function () {
      openStepModal(String($(this).data("step") || "1"));
    });
    $("#waCloseModalBtn, #waModalCloseFootBtn").on("click", closeStepModal);
    $("#waStepModal").on("click", function (ev) {
      if (ev.target === this) closeStepModal();
    });

    $("#waProvider").on("change", function () {
      applyProviderUi(String($(this).val() || ""));
      renderStepCards();
    });

    $(window).on("resize", syncDockLayout);

    Promise.all([loadMeta(), loadIntegrations()])
      .then(function () {
        fillIntegrationForm();
        renderPartnerState();
        renderStepCards();
        renderDiagnostics();
        applyDockState();
        startInboxPolling();
        return Promise.all([loadConversations(), loadTemplates(), loadCampaigns()]);
      })
      .then(updateMetrics)
      .catch(handleError);
  });
})();
