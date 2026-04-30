(function () {
  function detectLocale() {
    const raw = String(window.__AI_HUB_PAGE?.lang || "pt-BR").toLowerCase();
    if (raw.startsWith("en")) return "en";
    if (raw.startsWith("es")) return "es";
    return "pt-BR";
  }

  const locale = detectLocale();
  const copy = {
    "pt-BR": {
      pageTitle: "IA",
      hubTitle: "Converse com a IA",
      hubSubtitle:
        "Peça dashboards, relatórios, criação de registros e informações do sistema em linguagem natural. Se faltar algo importante, a IA pergunta antes.",
      welcome:
        'Voce pode pedir algo como: "Crie um dashboard executivo", "Crie um novo registro", "Monte um relatorio operacional" ou "Liste itens que precisam de atencao".',
      promptLabel: "Prompt da IA",
      placeholder: "Ex: Crie um dashboard com os principais indicadores do mes.",
      send: "Enviar para IA",
      clear: "Limpar conversa",
      helper:
        "Exemplos: criar dashboards, criar registros, listar itens, montar relatorios e resumir informacoes importantes.",
      userLabel: "Você",
      assistantLabel: "IA",
      analyzing: "Analisando seu pedido...",
      draftTitle: "Confirme a ação",
      draftConfirm: "Confirmar e criar",
      draftRefine: "Ajustar no chat",
      draftAdjust: "Me diga no chat o que deseja ajustar e eu refaço antes de criar.",
      resultTitle: "Resultado",
      noData: "Sem dados.",
      moduleMissing: "Módulo de IA não carregado.",
      genericError: "Erro ao consultar a IA.",
      unauthorized: "Sua sessão expirou. Faça login novamente.",
      forbidden: "Você não tem permissão para usar IA.",
      voiceTitle: "Falar no microfone",
      voiceUnsupported: "Seu navegador não suporta ditado por voz nesta tela.",
      voiceIdle: "Microfone pronto para transcrever sua fala.",
      voiceListening: "Ouvindo... fale agora.",
      voiceAppend: "Transcrição adicionada ao prompt.",
      voiceDenied: "Não foi possível acessar o microfone. Verifique a permissão do navegador.",
      voiceNoSpeech: "Não consegui ouvir nada. Tente falar mais perto do microfone.",
      voiceError: "Não foi possível transcrever o áudio agora.",
      openModule: "Abrir módulo",
      createdRecord: "Registro criado",
      suggestions: [
        "Crie um dashboard com os principais indicadores do mes",
        "Crie um novo registro com os campos principais ja preenchidos",
        "Monte um relatorio com os itens pendentes dos ultimos 30 dias",
        "Liste os registros que precisam de atencao hoje",
      ],
    },
    en: {
      pageTitle: "AI",
      hubTitle: "Chat with AI",
      hubSubtitle:
        "Ask for dashboards, reports, new records and system information in natural language. If something important is missing, AI will ask before proceeding.",
      welcome:
        'You can ask things like: "Create an executive dashboard", "Create a new record", "Build an operational report" or "List items that need attention".',
      promptLabel: "AI Prompt",
      placeholder: "Example: Create a dashboard with the main indicators for this month.",
      send: "Send to AI",
      clear: "Clear conversation",
      helper:
        "Examples: create dashboards, create records, list items, build reports and summarize important information.",
      userLabel: "You",
      assistantLabel: "AI",
      analyzing: "Analyzing your request...",
      draftTitle: "Confirm the action",
      draftConfirm: "Confirm and create",
      draftRefine: "Adjust in chat",
      draftAdjust: "Tell me what you want to adjust and I will refine it before creating.",
      resultTitle: "Result",
      noData: "No data.",
      moduleMissing: "AI module not loaded.",
      genericError: "Error while calling AI.",
      unauthorized: "Your session expired. Please log in again.",
      forbidden: "You do not have permission to use AI.",
      voiceTitle: "Speak with microphone",
      voiceUnsupported: "Your browser does not support voice dictation on this screen.",
      voiceIdle: "Microphone ready to transcribe your speech.",
      voiceListening: "Listening... speak now.",
      voiceAppend: "Transcription added to the prompt.",
      voiceDenied: "Could not access the microphone. Please check your browser permission.",
      voiceNoSpeech: "I could not hear anything. Try speaking closer to the microphone.",
      voiceError: "Could not transcribe the audio right now.",
      openModule: "Open module",
      createdRecord: "Record created",
      suggestions: [
        "Create a dashboard with the main indicators for this month",
        "Create a new record with the main fields already filled",
        "Build a report with pending items from the last 30 days",
        "List the records that need attention today",
      ],
    },
    es: {
      pageTitle: "IA",
      hubTitle: "Conversa con la IA",
      hubSubtitle:
        "Pide dashboards, informes, creación de registros e información del sistema en lenguaje natural. Si falta algo importante, la IA preguntará antes.",
      welcome:
        'Puedes pedir algo como: "Crea un dashboard ejecutivo", "Crea un nuevo registro", "Monta un informe operativo" o "Lista elementos que necesitan atencion".',
      promptLabel: "Prompt de la IA",
      placeholder: "Ej.: Crea un dashboard con los principales indicadores del mes.",
      send: "Enviar a la IA",
      clear: "Limpiar conversación",
      helper:
        "Ejemplos: crear dashboards, crear registros, listar elementos, montar informes y resumir informacion importante.",
      userLabel: "Tú",
      assistantLabel: "IA",
      analyzing: "Analizando tu solicitud...",
      draftTitle: "Confirma la acción",
      draftConfirm: "Confirmar y crear",
      draftRefine: "Ajustar en el chat",
      draftAdjust: "Dime qué quieres ajustar y lo refino antes de crear.",
      resultTitle: "Resultado",
      noData: "Sin datos.",
      moduleMissing: "El módulo de IA no se cargó.",
      genericError: "Error al consultar la IA.",
      unauthorized: "Tu sesión expiró. Inicia sesión nuevamente.",
      forbidden: "No tienes permiso para usar la IA.",
      voiceTitle: "Hablar con el micrófono",
      voiceUnsupported: "Tu navegador no soporta dictado por voz en esta pantalla.",
      voiceIdle: "Micrófono listo para transcribir tu voz.",
      voiceListening: "Escuchando... habla ahora.",
      voiceAppend: "Transcripción añadida al prompt.",
      voiceDenied: "No se pudo acceder al micrófono. Revisa el permiso del navegador.",
      voiceNoSpeech: "No pude escuchar nada. Intenta hablar más cerca del micrófono.",
      voiceError: "No se pudo transcribir el audio ahora.",
      openModule: "Abrir módulo",
      createdRecord: "Registro creado",
      suggestions: [
        "Crea un dashboard con los principales indicadores del mes",
        "Crea un nuevo registro con los campos principales ya completados",
        "Monta un informe con los elementos pendientes de los ultimos 30 dias",
        "Lista los registros que necesitan atencion hoy",
      ],
    },
  };

  const text = copy[locale] || copy["pt-BR"];
  const state = {
    messages: [],
    pending: false,
    draft: null,
    voiceRecognition: null,
    voiceSupported: false,
    voiceListening: false,
  };

  function esc(v) {
    if (v == null) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showPending(show) {
    state.pending = !!show;
    $("#aiHubPendingWrap").toggle(!!show);
    $("#btnAiHubSend").prop("disabled", !!show);
    syncVoiceButton();
  }

  function renderThread() {
    const $thread = $("#aiHubThread");
    if (!$thread.length) return;
    if (!state.messages.length) {
      $thread.html(`<div class="ai-hub-empty">${esc(text.welcome)}</div>`);
      return;
    }

    $thread.html(
      state.messages
        .map((message) => {
          const isUser = message.role === "user";
          const roleLabel = isUser ? text.userLabel : text.assistantLabel;
          return `
            <div class="ai-hub-message ${isUser ? "is-user" : "is-assistant"}">
              <div class="ai-hub-bubble">
                <span class="ai-hub-role">${esc(roleLabel)}</span>
                <div>${esc(message.content).replace(/\n/g, "<br>")}</div>
              </div>
            </div>
          `;
        })
        .join("")
    );
    $thread.scrollTop($thread[0].scrollHeight);
  }

  function addMessage(role, content) {
    const clean = String(content || "").trim();
    if (!clean) return;
    state.messages.push({ role: role === "assistant" ? "assistant" : "user", content: clean });
    renderThread();
  }

  function setVoiceStatus(message, tone) {
    const $status = $("#aiHubVoiceStatus");
    $status.text(String(message || "").trim());
    $status.removeClass("is-error is-active");
    if (tone === "error") $status.addClass("is-error");
    if (tone === "active") $status.addClass("is-active");
  }

  function appendPromptText(transcript) {
    const clean = String(transcript || "").trim();
    if (!clean) return;
    const current = String($("#aiHubPrompt").val() || "");
    const spacer = current && !/\s$/.test(current) ? " " : "";
    $("#aiHubPrompt").val(current + spacer + clean).trigger("focus");
  }

  function syncVoiceButton() {
    const $button = $("#btnAiHubVoice");
    const disabled = !state.voiceSupported || state.pending;
    $button.prop("disabled", disabled);
    $button.toggleClass("is-listening", !!state.voiceListening);
    $button.attr("title", !state.voiceSupported ? text.voiceUnsupported : state.voiceListening ? text.voiceListening : text.voiceTitle);
  }

  function stopVoiceRecognition() {
    if (!state.voiceRecognition || !state.voiceListening) return;
    try {
      state.voiceRecognition.stop();
    } catch {}
    state.voiceListening = false;
    syncVoiceButton();
  }

  function initVoiceRecognition() {
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof SpeechRecognitionCtor !== "function") {
      state.voiceSupported = false;
      state.voiceRecognition = null;
      setVoiceStatus(text.voiceUnsupported, "error");
      syncVoiceButton();
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = String(window.__AI_HUB_PAGE?.lang || "pt-BR");
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = function () {
      state.voiceListening = true;
      syncVoiceButton();
      setVoiceStatus(text.voiceListening, "active");
    };

    recognition.onend = function () {
      state.voiceListening = false;
      syncVoiceButton();
      if (state.voiceSupported && !state.pending) {
        setVoiceStatus(text.voiceIdle, "");
      }
    };

    recognition.onerror = function (event) {
      state.voiceListening = false;
      syncVoiceButton();
      const code = String(event?.error || "").toLowerCase();
      if (code === "not-allowed" || code === "service-not-allowed") {
        setVoiceStatus(text.voiceDenied, "error");
        return;
      }
      if (code === "no-speech") {
        setVoiceStatus(text.voiceNoSpeech, "error");
        return;
      }
      setVoiceStatus(text.voiceError, "error");
    };

    recognition.onresult = function (event) {
      const transcript = Array.from(event?.results || [])
        .map((result) => Array.from(result || []).map((alt) => alt?.transcript || "").join(" "))
        .join(" ")
        .trim();
      if (!transcript) {
        setVoiceStatus(text.voiceNoSpeech, "error");
        return;
      }
      appendPromptText(transcript);
      setVoiceStatus(text.voiceAppend, "");
    };

    state.voiceSupported = true;
    state.voiceRecognition = recognition;
    setVoiceStatus(text.voiceIdle, "");
    syncVoiceButton();
  }

  function clearDraft() {
    state.draft = null;
    $("#aiHubDraftConfirmation").removeClass("is-visible");
    $("#aiHubDraftSummary").text("");
    $("#aiHubDraftMeta").empty();
  }

  function renderDraft(draft, summary) {
    state.draft = draft || null;
    if (!state.draft) {
      clearDraft();
      return;
    }

    const entityName = String(draft?.record_draft?.entity_name || draft?.entity_name || "");
    const valueCount = Object.keys(draft?.record_draft?.values || draft?.values || {}).length;
    $("#aiHubDraftSummary").text(String(summary || ""));
    $("#aiHubDraftMeta").html(
      [
        entityName ? `<span class="ai-hub-chip">${esc(entityName)}</span>` : "",
        `<span class="ai-hub-chip">${esc(String(valueCount))} campos</span>`,
      ]
        .filter(Boolean)
        .join("")
    );
    $("#aiHubDraftConfirmation").addClass("is-visible");
  }

  function clearArtifact() {
    $("#aiHubArtifact").removeClass("is-visible");
    $("#aiHubArtifactTitle").text(text.resultTitle);
    $("#aiHubArtifactSummary").text("");
    $("#aiHubArtifactMeta").empty();
    $("#aiHubArtifactBody").empty();
    $("#aiHubArtifactActions").empty();
  }

  function widgetType(widget) {
    return String(widget?.type || widget?.widget_type || "").toLowerCase();
  }

  function unwrapWidgets(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.widgets)) return payload.widgets;
    if (Array.isArray(payload?.dashboardSpec?.widgets)) return payload.dashboardSpec.widgets;
    if (Array.isArray(payload?.data?.widgets)) return payload.data.widgets;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function normalizeChartData(widget) {
    const labels = Array.isArray(widget?.labels) ? widget.labels : Array.isArray(widget?.data?.labels) ? widget.data.labels : [];
    const directValues = Array.isArray(widget?.values) ? widget.values : Array.isArray(widget?.data?.values) ? widget.data.values : [];
    const series = Array.isArray(widget?.series) ? widget.series : Array.isArray(widget?.data?.series) ? widget.data.series : [];
    const datasets = Array.isArray(widget?.datasets) ? widget.datasets : Array.isArray(widget?.data?.datasets) ? widget.data.datasets : [];

    if (datasets.length) return { labels, datasets };
    if (series.length) {
      return {
        labels,
        datasets: series.map((s, i) => ({
          label: s?.name || s?.label || `Serie ${i + 1}`,
          data: Array.isArray(s?.data) ? s.data : [],
        })),
      };
    }
    return {
      labels,
      datasets: [{ label: widget?.title || "Dados", data: directValues }],
    };
  }

  function renderKpi($target, widget) {
    $target.append(`
      <div class="ai-hub-widget">
        <div class="ai-hub-widget-title">${esc(widget?.title || "Indicador")}</div>
        <div class="ai-hub-kpi-value">${esc(widget?.value ?? widget?.kpi_value ?? 0)} ${esc(widget?.suffix || "")}</div>
      </div>
    `);
  }

  function renderChart($target, widget, chartType) {
    const chartId = `aiHubChart_${Math.random().toString(36).slice(2)}`;
    $target.append(`
      <div class="ai-hub-widget">
        <div class="ai-hub-widget-title">${esc(widget?.title || "Gráfico")}</div>
        <canvas id="${chartId}" height="130"></canvas>
      </div>
    `);

    if (typeof window.Chart !== "function") return;
    const ctx = document.getElementById(chartId);
    if (!ctx) return;

    const normalized = normalizeChartData(widget);
    const palettes = ["#1ab394", "#1c84c6", "#f8ac59", "#ed5565", "#23c6c8", "#f7a54a"];
    const datasets = normalized.datasets.map((ds, idx) => ({
      label: ds.label || `Serie ${idx + 1}`,
      data: Array.isArray(ds.data) ? ds.data.map(toNumber) : [],
      backgroundColor: chartType === "line" ? "transparent" : palettes[idx % palettes.length],
      borderColor: palettes[idx % palettes.length],
      borderWidth: 2,
      fill: chartType !== "line",
    }));

    new window.Chart(ctx, {
      type: chartType,
      data: { labels: normalized.labels || [], datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: true },
      },
    });
  }

  function renderTopN($target, widget) {
    const items = Array.isArray(widget?.items) ? widget.items : Array.isArray(widget?.data?.items) ? widget.data.items : [];
    const rows = items
      .map((item) => {
        const label = esc(item?.label || item?.name || item?.title || "-");
        const value = esc(item?.value ?? item?.count ?? "");
        return `<li><strong>${label}</strong> <span class="pull-right">${value}</span></li>`;
      })
      .join("");

    $target.append(`
      <div class="ai-hub-widget">
        <div class="ai-hub-widget-title">${esc(widget?.title || "Lista")}</div>
        <ul style="margin:0; padding-left:18px;">${rows || `<li>${esc(text.noData)}</li>`}</ul>
      </div>
    `);
  }

  function renderDashboardArtifact(artifact) {
    const widgets = unwrapWidgets(artifact?.data || artifact || {});
    const $body = $("#aiHubArtifactBody").empty();
    const $grid = $('<div class="ai-hub-widget-grid"></div>');
    widgets.forEach((widget) => {
      const type = widgetType(widget);
      if (type === "kpi") return renderKpi($grid, widget);
      if (type === "timeseries" || type === "time_series" || type === "line") return renderChart($grid, widget, "line");
      if (type === "bar") return renderChart($grid, widget, "bar");
      if (type === "pie" || type === "donut") return renderChart($grid, widget, "pie");
      if (type === "topn" || type === "top_n" || type === "list") return renderTopN($grid, widget);
      renderKpi($grid, widget);
    });

    if (!widgets.length) {
      $body.html(`<div class="alert alert-warning">${esc(text.noData)}</div>`);
      return;
    }
    $body.append($grid);
  }

  function renderTableArtifact(artifact) {
    const columns = Array.isArray(artifact?.columns) ? artifact.columns : [];
    const rows = Array.isArray(artifact?.rows) ? artifact.rows : [];
    const header = columns.map((column) => `<th>${esc(column?.label || column?.name || "-")}</th>`).join("");
    const body = rows
      .map((row) => {
        const cells = columns
          .map((column) => `<td>${esc(row?.[column?.name] ?? "-")}</td>`)
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    $("#aiHubArtifactBody").html(`
      <div class="ai-hub-grid-table-wrap">
        <table class="ai-hub-grid-table">
          <thead><tr>${header}</tr></thead>
          <tbody>${body || `<tr><td colspan="${Math.max(columns.length, 1)}">${esc(text.noData)}</td></tr>`}</tbody>
        </table>
      </div>
    `);
  }

  function renderCreatedArtifact(artifact) {
    const recordId = String(artifact?.recordId || "");
    const entityLabel = String(artifact?.entityLabel || artifact?.entityName || "");
    const record = artifact?.record && typeof artifact.record === "object" ? artifact.record : null;
    const lines = record
      ? Object.keys(record)
          .slice(0, 8)
          .map((key) => `<tr><th>${esc(key)}</th><td>${esc(record[key])}</td></tr>`)
          .join("")
      : "";

    $("#aiHubArtifactBody").html(`
      <div class="alert alert-success" style="margin-bottom:14px;">${esc(text.createdRecord)}: ${esc(entityLabel)} ${recordId ? `#${esc(recordId)}` : ""}</div>
      ${
        lines
          ? `<div class="ai-hub-grid-table-wrap"><table class="ai-hub-grid-table"><tbody>${lines}</tbody></table></div>`
          : ""
      }
    `);
  }

  function renderArtifact(artifact) {
    if (!artifact || typeof artifact !== "object") {
      clearArtifact();
      return;
    }

    $("#aiHubArtifact").addClass("is-visible");
    $("#aiHubArtifactTitle").text(String(artifact?.title || text.resultTitle));
    $("#aiHubArtifactSummary").text(String(artifact?.summary || artifact?.insights_ptbr || ""));

    const meta = [];
    if (artifact?.entityLabel) meta.push(`<span class="ai-hub-chip">${esc(artifact.entityLabel)}</span>`);
    if (artifact?.total != null) meta.push(`<span class="ai-hub-chip">${esc(String(artifact.total))} registros</span>`);
    if (artifact?.type) meta.push(`<span class="ai-hub-chip">${esc(String(artifact.type))}</span>`);
    $("#aiHubArtifactMeta").html(meta.join(""));

    const route = String(artifact?.route || "").trim();
    $("#aiHubArtifactActions").html(
      route ? `<a class="btn btn-default btn-sm" href="${esc(route)}"><i class="fa fa-external-link"></i> ${esc(text.openModule)}</a>` : ""
    );

    if (artifact.type === "dashboard") return renderDashboardArtifact(artifact);
    if (artifact.type === "report" || artifact.type === "information") return renderTableArtifact(artifact);
    if (artifact.type === "create_record") return renderCreatedArtifact(artifact);
    $("#aiHubArtifactBody").html(`<div class="alert alert-info">${esc(text.noData)}</div>`);
  }

  function clearConversation() {
    state.messages = [];
    $("#aiHubPrompt").val("");
    renderThread();
    clearDraft();
    clearArtifact();
  }

  async function sendToAi(options) {
    const api = window.GECOM_AI_API;
    if (!api || typeof api.getAiChat !== "function") {
      addMessage("assistant", text.moduleMissing);
      return;
    }

    const confirmed = !!options?.confirmed;
    const prompt = confirmed ? "" : String($("#aiHubPrompt").val() || "").trim();
    if (!confirmed && !prompt) return;

    if (!confirmed) {
      addMessage("user", prompt);
      $("#aiHubPrompt").val("");
    }

    clearArtifact();
    showPending(true);

    try {
      const response = await api.getAiChat({
        lang: window.__AI_HUB_PAGE?.lang || "pt-BR",
        confirmed,
        draft: confirmed ? state.draft : undefined,
        messages: state.messages,
      });

      addMessage("assistant", response?.reply || text.noData);

      if (response?.status === "needs_confirmation" && response?.draft) {
        renderDraft(response.draft, response.summary || "");
      } else {
        clearDraft();
      }

      if (response?.artifact) {
        renderArtifact(response.artifact);
      } else {
        clearArtifact();
      }
    } catch (error) {
      const status = Number(error?.status || 0);
      if (status === 401) addMessage("assistant", text.unauthorized);
      else if (status === 403) addMessage("assistant", text.forbidden);
      else addMessage("assistant", error?.message || text.genericError);
      clearDraft();
      clearArtifact();
    } finally {
      showPending(false);
    }
  }

  function renderSuggestions() {
    $("#aiHubSuggestions").html(
      (text.suggestions || [])
        .map(
          (prompt) =>
            `<button type="button" class="ai-hub-suggestion js-ai-hub-suggestion" data-prompt="${esc(prompt)}">${esc(prompt)}</button>`
        )
        .join("")
    );
  }

  function bindEvents() {
    $("#btnAiHubSend").on("click", function () {
      sendToAi();
    });

    $("#aiHubPrompt").on("keydown", function (event) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendToAi();
      }
    });

    $(document).on("click", ".js-ai-hub-suggestion", function () {
      const prompt = String($(this).data("prompt") || "").trim();
      if (!prompt) return;
      $("#aiHubPrompt").val(prompt).trigger("focus");
    });

    $("#btnAiHubClear").on("click", function () {
      clearConversation();
    });

    $("#btnAiHubConfirm").on("click", function () {
      if (!state.draft) return;
      sendToAi({ confirmed: true });
    });

    $("#btnAiHubRefine").on("click", function () {
      clearDraft();
      addMessage("assistant", text.draftAdjust);
      $("#aiHubPrompt").trigger("focus");
    });

    $("#btnAiHubVoice").on("click", function () {
      if (!state.voiceSupported || !state.voiceRecognition || state.pending) return;
      if (state.voiceListening) {
        stopVoiceRecognition();
        return;
      }
      try {
        state.voiceRecognition.lang = String(window.__AI_HUB_PAGE?.lang || locale || "pt-BR");
        state.voiceRecognition.start();
      } catch {
        setVoiceStatus(text.voiceError, "error");
      }
    });
  }

  $(function () {
    $("#pageName,#subpageName").text(text.pageTitle);
    $("#pageAiTitle").text(text.pageTitle);
    $("#aiHubTitle").text(text.hubTitle);
    $("#aiHubSubtitle").text(text.hubSubtitle);
    $("#aiHubPromptLabel").text(text.promptLabel);
    $("#aiHubPrompt").attr("placeholder", text.placeholder);
    $("#btnAiHubSendText").text(text.send);
    $("#btnAiHubClearText").text(text.clear);
    $("#aiHubHelperText").text(text.helper);
    $("#aiHubPendingText").text(text.analyzing);
    $("#aiHubDraftTitle").text(text.draftTitle);
    $("#btnAiHubConfirmText").text(text.draftConfirm);
    $("#btnAiHubRefineText").text(text.draftRefine);
    $("#aiHubArtifactTitle").text(text.resultTitle);
    $("#btnAiHubVoice").attr("title", text.voiceTitle);

    renderThread();
    renderSuggestions();
    bindEvents();
    initVoiceRecognition();

    try {
      $('[data-toggle="tooltip"]').tooltip();
    } catch {}
  });
})();
