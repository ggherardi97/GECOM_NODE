(function () {
  const api = window.ServiceApi;
  if (!api) return;

  const state = {
    connected: false,
    connection: null,
    calendars: [],
    popup: null,
  };

  function esc(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("pt-BR");
  }

  function setAlert(message, level) {
    const box = $("#googleCalendarAlert");
    box.removeClass("alert-info alert-success alert-danger is-open");
    if (!message) {
      box.text("");
      return;
    }
    box.addClass(`alert-${level || "info"} is-open`);
    box.text(String(message));
  }

  function setButtonsEnabled(connected) {
    $("#googleCalendarSaveBtn").prop("disabled", !connected);
    $("#googleCalendarSyncBtn").prop("disabled", !connected);
    $("#googleCalendarDisconnectBtn").toggle(!!connected);
  }

  function updateStatusUi() {
    const pill = $("#googleCalendarStatusPill");
    const inlineStatus = $("#googleCalendarInlineStatus");
    const openBtn = $("#googleCalendarOpenBtn");
    const connectBtn = $("#googleCalendarConnectBtn");
    const connected = !!state.connected;
    const connection = state.connection || {};
    const email = String(connection.google_email || "").trim();
    const calendarName = String(connection.google_calendar_name || "").trim();

    pill.toggleClass("is-connected", connected);
    pill.find("span:last").text(
      connected
        ? `Google Agenda conectada${email ? `: ${email}` : ""}`
        : "Google Agenda não conectada"
    );

    openBtn.html(
      connected
        ? '<i class="fa fa-google"></i> Gerenciar Google'
        : '<i class="fa fa-google"></i> Conectar Google'
    );
    connectBtn
      .toggleClass("btn-primary", !connected)
      .toggleClass("btn-white", connected)
      .html(
        connected
          ? '<i class="fa fa-google"></i> Reconectar Google'
          : '<i class="fa fa-google"></i> Entrar com Google'
      );

    $("#googleCalendarEmail").text(connected ? (email || "Conta Google conectada") : "Nenhuma conta conectada");
    $("#googleCalendarSyncLabel").text(
      `Última sincronização: ${connected ? formatDateTime(connection.last_sync_at) : "-"}`
    );
    $("#googleCalendarExpiryLabel").text(
      `Token válido até: ${connected ? formatDateTime(connection.token_expires_at) : "-"}`
    );

    inlineStatus
      .toggleClass("label-default", !connected)
      .toggleClass("label-primary", connected)
      .text(connected ? (calendarName || "Conectada") : "Desconectada");

    setButtonsEnabled(connected);
  }

  function populateCalendarSelect() {
    const select = $("#googleCalendarSelect");
    const connection = state.connection || {};
    const selectedId = String(connection.google_calendar_id || "").trim();
    const items = Array.isArray(state.calendars) ? state.calendars : [];

    select.empty();
    select.append('<option value="">Selecione...</option>');

    items.forEach((item) => {
      const label = item.primary ? `${item.label} (Principal)` : item.label;
      select.append(
        `<option value="${esc(item.id)}"${selectedId && selectedId === item.id ? " selected" : ""}>${esc(label)}</option>`
      );
    });

    if (selectedId && !items.some((item) => item.id === selectedId)) {
      select.append(`<option value="${esc(selectedId)}" selected>${esc(connection.google_calendar_name || selectedId)}</option>`);
    }
  }

  function syncFormFromConnection() {
    const connection = state.connection || {};
    $("#googleLookbackDays").val(String(connection.lookback_days || 30));
    $("#googleImportDescription").prop("checked", connection.import_description !== false);
    $("#googleImportPrivate").prop("checked", !!connection.import_private_events);
    populateCalendarSelect();
  }

  function openPanel() {
    $("#googleCalendarOverlay").addClass("is-open");
    $("#googleCalendarPanel").addClass("is-open").attr("aria-hidden", "false");
  }

  function closePanel() {
    $("#googleCalendarOverlay").removeClass("is-open");
    $("#googleCalendarPanel").removeClass("is-open").attr("aria-hidden", "true");
  }

  async function loadCalendars() {
    if (!state.connected) {
      state.calendars = [];
      populateCalendarSelect();
      return;
    }

    const data = await api.getJson("/api/google-calendar/calendars");
    state.calendars = Array.isArray(data?.items) ? data.items : [];
    populateCalendarSelect();
  }

  async function loadStatus(options) {
    const data = await api.getJson("/api/google-calendar/status");
    state.connected = !!data?.connected;
    state.connection = data?.connection || null;
    updateStatusUi();
    syncFormFromConnection();

    if (state.connected) {
      await loadCalendars();
    } else {
      state.calendars = [];
      syncFormFromConnection();
    }

    if (options?.message) {
      setAlert(options.message, options.level || "success");
    }
  }

  function refetchCalendar() {
    const cal = $("#calendarActivities");
    if (!cal.length || !cal.data("fullCalendar")) return;
    cal.fullCalendar("refetchEvents");
  }

  function openGooglePopup() {
    setAlert("", "info");
    const returnTo = encodeURIComponent(window.location.href);
    const url = `/api/google-calendar/connect?return_to=${returnTo}`;
    state.popup = window.open(
      url,
      "googleCalendarOAuth",
      "width=620,height=760,resizable=yes,scrollbars=yes"
    );
    if (!state.popup) {
      setAlert("O navegador bloqueou a janela de autenticação do Google.", "danger");
    }
  }

  async function handleSave() {
    const payload = {
      google_calendar_id: String($("#googleCalendarSelect").val() || "").trim(),
      lookback_days: Number($("#googleLookbackDays").val() || 30),
      import_description: $("#googleImportDescription").is(":checked"),
      import_private_events: $("#googleImportPrivate").is(":checked"),
    };

    await api.postJson("/api/google-calendar/settings", payload);
    await loadStatus({ message: "Preferências salvas.", level: "success" });
  }

  async function handleSync() {
    const data = await api.postJson("/api/google-calendar/sync-now", {});
    refetchCalendar();
    await loadStatus({
      message: `Sincronização concluída. ${Number(data?.imported || 0)} evento(s) importado(s).`,
      level: "success",
    });
  }

  async function handleDisconnect() {
    await api.postJson("/api/google-calendar/disconnect", {});
    refetchCalendar();
    state.connected = false;
    state.connection = null;
    state.calendars = [];
    updateStatusUi();
    syncFormFromConnection();
    setAlert("Conta Google desconectada.", "success");
  }

  function bindEvents() {
    $("#googleCalendarOpenBtn").on("click", function () {
      openPanel();
      setAlert("", "info");
    });

    $("#googleCalendarOverlay, #googleCalendarClose").on("click", function () {
      closePanel();
    });

    $("#googleCalendarConnectBtn").on("click", function () {
      openGooglePopup();
    });

    $("#googleCalendarSaveBtn").on("click", function () {
      handleSave().catch((error) => {
        console.error(error);
        setAlert(error?.message || "Falha ao salvar preferências do Google Agenda.", "danger");
      });
    });

    $("#googleCalendarSyncBtn").on("click", function () {
      handleSync().catch((error) => {
        console.error(error);
        setAlert(error?.message || "Falha ao sincronizar agenda do Google.", "danger");
      });
    });

    $("#googleCalendarDisconnectBtn").on("click", function () {
      handleDisconnect().catch((error) => {
        console.error(error);
        setAlert(error?.message || "Falha ao desconectar conta Google.", "danger");
      });
    });

    window.addEventListener("message", function (event) {
      const payload = event?.data || {};
      if (payload.type !== "gecom:google-calendar-connection") return;

      const ok = payload.ok === true;
      loadStatus({
        message: String(payload.message || (ok ? "Conta conectada." : "Falha ao conectar conta Google.")),
        level: ok ? "success" : "danger",
      })
        .then(() => {
          if (ok) {
            openPanel();
            refetchCalendar();
          }
        })
        .catch((error) => {
          console.error(error);
          setAlert(error?.message || "Falha ao atualizar status da conexão Google.", "danger");
        });
    });
  }

  async function init() {
    updateStatusUi();
    bindEvents();
    try {
      await loadStatus();
    } catch (error) {
      console.error(error);
      setAlert(error?.message || "Não foi possível carregar o status da Google Agenda.", "danger");
    }
  }

  $(init);
})();
