(function (global) {
  if (global.ServiceResources) return;

  function isI18nReady() {
    return !!(global.i18next && global.i18next.isInitialized && typeof global.i18next.t === "function");
  }

  function waitForI18nReady(timeoutMs) {
    const timeout = Number(timeoutMs || 2500);
    if (typeof global.t === "function" || isI18nReady()) return Promise.resolve();
    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (typeof global.t === "function" || isI18nReady() || Date.now() - started >= timeout) {
          clearInterval(timer);
          resolve();
        }
      }, 50);
    });
  }

  function currentLang() {
    const raw = String(global.i18next?.resolvedLanguage || global.i18next?.language || document.documentElement?.lang || "pt-BR")
      .toLowerCase()
      .trim();
    if (raw.startsWith("en")) return "en";
    if (raw.startsWith("es")) return "es";
    return "pt";
  }

  function textFor(value, fallback) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const lang = currentLang();
      return String(value[lang] || value.pt || value.en || value.es || fallback || "").trim();
    }
    if (typeof value === "string" && value) return value;
    return String(fallback || "").trim();
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
  }

  const enumLabels = {
    incidentStatus: {
      NEW: { pt: "Novo", en: "New", es: "Nuevo" },
      IN_PROGRESS: { pt: "Em andamento", en: "In progress", es: "En progreso" },
      WAITING_CUSTOMER: { pt: "Aguardando cliente", en: "Waiting for customer", es: "Esperando al cliente" },
      WAITING_INTERNAL: { pt: "Aguardando interno", en: "Waiting internal", es: "Esperando interno" },
      RESOLVED: { pt: "Resolvido", en: "Resolved", es: "Resuelto" },
      CANCELLED: { pt: "Cancelado", en: "Cancelled", es: "Cancelado" },
    },
    priority: {
      LOW: { pt: "Baixa", en: "Low", es: "Baja" },
      NORMAL: { pt: "Normal", en: "Normal", es: "Normal" },
      HIGH: { pt: "Alta", en: "High", es: "Alta" },
      URGENT: { pt: "Urgente", en: "Urgent", es: "Urgente" },
    },
    queueAssignmentMode: {
      MANUAL: { pt: "Manual", en: "Manual", es: "Manual" },
      ROUND_ROBIN: { pt: "Round robin", en: "Round robin", es: "Round robin" },
      LEAST_BUSY: { pt: "Menor carga", en: "Least busy", es: "Menor carga" },
    },
    queueMemberRole: {
      AGENT: { pt: "Agente", en: "Agent", es: "Agente" },
      SUPERVISOR: { pt: "Supervisor", en: "Supervisor", es: "Supervisor" },
    },
    assetStatus: {
      ACTIVE: { pt: "Ativo", en: "Active", es: "Activo" },
      INACTIVE: { pt: "Inativo", en: "Inactive", es: "Inactivo" },
      MAINTENANCE: { pt: "Manutencao", en: "Maintenance", es: "Mantenimiento" },
      RETIRED: { pt: "Aposentado", en: "Retired", es: "Retirado" },
    },
    slaKpiType: {
      FIRST_RESPONSE: { pt: "Primeira resposta", en: "First response", es: "Primera respuesta" },
      RESOLUTION: { pt: "Resolucao", en: "Resolution", es: "Resolucion" },
      CUSTOM: { pt: "Personalizado", en: "Custom", es: "Personalizado" },
    },
    slaInstanceStatus: {
      RUNNING: { pt: "Em execucao", en: "Running", es: "En ejecucion" },
      PAUSED: { pt: "Pausado", en: "Paused", es: "Pausado" },
      MET: { pt: "Cumprido", en: "Met", es: "Cumplido" },
      BREACHED: { pt: "Violado", en: "Breached", es: "Incumplido" },
      CANCELLED: { pt: "Cancelado", en: "Cancelled", es: "Cancelado" },
    },
    slaInstanceKpiStatus: {
      RUNNING: { pt: "Em execucao", en: "Running", es: "En ejecucion" },
      PAUSED: { pt: "Pausado", en: "Paused", es: "Pausado" },
      MET: { pt: "Cumprido", en: "Met", es: "Cumplido" },
      BREACHED: { pt: "Violado", en: "Breached", es: "Incumplido" },
    },
    slaEventType: {
      START: { pt: "Inicio", en: "Start", es: "Inicio" },
      PAUSE: { pt: "Pausa", en: "Pause", es: "Pausa" },
      RESUME: { pt: "Retomada", en: "Resume", es: "Reanudar" },
      WARNING: { pt: "Aviso", en: "Warning", es: "Aviso" },
      BREACH: { pt: "Violacao", en: "Breach", es: "Incumplimiento" },
      MET: { pt: "Cumprido", en: "Met", es: "Cumplido" },
      RECALC: { pt: "Recalcular", en: "Recalculate", es: "Recalcular" },
      CANCEL: { pt: "Cancelar", en: "Cancel", es: "Cancelar" },
    },
    weekday: {
      "0": { pt: "Domingo", en: "Sunday", es: "Domingo" },
      "1": { pt: "Segunda-feira", en: "Monday", es: "Lunes" },
      "2": { pt: "Terca-feira", en: "Tuesday", es: "Martes" },
      "3": { pt: "Quarta-feira", en: "Wednesday", es: "Miercoles" },
      "4": { pt: "Quinta-feira", en: "Thursday", es: "Jueves" },
      "5": { pt: "Sexta-feira", en: "Friday", es: "Viernes" },
      "6": { pt: "Sabado", en: "Saturday", es: "Sabado" },
    },
    calendarExceptionType: {
      HOLIDAY: { pt: "Feriado", en: "Holiday", es: "Feriado" },
      SPECIAL_HOURS: { pt: "Horario especial", en: "Special hours", es: "Horario especial" },
      BLACKOUT: { pt: "Bloqueio", en: "Blackout", es: "Bloqueo" },
    },
    appointmentStatus: {
      SCHEDULED: { pt: "Agendado", en: "Scheduled", es: "Programado" },
      DONE: { pt: "Concluido", en: "Done", es: "Realizado" },
      CANCELLED: { pt: "Cancelado", en: "Cancelled", es: "Cancelado" },
      NO_SHOW: { pt: "Nao compareceu", en: "No-show", es: "No se presento" },
    },
    taskChannel: {
      SERVICE: { pt: "Atendimento", en: "Service", es: "Servicio" },
      CALL: { pt: "Ligacao", en: "Call", es: "Llamada" },
      EMAIL: { pt: "E-mail", en: "Email", es: "Correo" },
      WHATSAPP: { pt: "WhatsApp", en: "WhatsApp", es: "WhatsApp" },
      VISIT: { pt: "Visita", en: "Visit", es: "Visita" },
      INTERNAL: { pt: "Interno", en: "Internal", es: "Interno" },
    },
    taskStatus: {
      OPEN: { pt: "Aberta", en: "Open", es: "Abierta" },
      IN_PROGRESS: { pt: "Em andamento", en: "In progress", es: "En progreso" },
      WAITING: { pt: "Em espera", en: "Waiting", es: "En espera" },
      DONE: { pt: "Concluida", en: "Done", es: "Hecha" },
      CANCELLED: { pt: "Cancelada", en: "Cancelled", es: "Cancelada" },
    },
  };

  function enumLabel(group, value, fallback) {
    const key = String(value == null ? "" : value).trim();
    if (!key) return String(fallback || "-");
    return textFor(enumLabels[group]?.[key], fallback || key);
  }

  function enumOptions(group) {
    const source = enumLabels[group] || {};
    return Object.keys(source).map((value) => ({ value, label: textFor(source[value], value) }));
  }

  global.ServiceResources = {
    waitForI18nReady,
    currentLang,
    textFor,
    esc,
    normalizeArray,
    enumLabel,
    enumOptions,
  };
})(window);
