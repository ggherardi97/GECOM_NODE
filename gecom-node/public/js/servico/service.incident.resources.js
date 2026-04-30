(function (global) {
  function isI18nReady() {
    return !!(global.i18next && global.i18next.isInitialized && typeof global.i18next.t === "function");
  }

  function waitForI18nReady(timeoutMs) {
    const timeout = Number(timeoutMs || 2500);
    if (typeof global.t === "function" || isI18nReady()) return Promise.resolve();

    return new Promise((resolve) => {
      const started = Date.now();
      const timer = setInterval(() => {
        if (typeof global.t === "function" || isI18nReady()) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - started >= timeout) {
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

  function tt(key, fallback) {
    try {
      if (typeof global.t === "function") return global.t(key, { defaultValue: fallback });
      if (isI18nReady()) return global.i18next.t(key, { defaultValue: fallback });
    } catch {}
    return fallback;
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
    status: {
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
    channel: {
      EMAIL: { pt: "E-mail", en: "Email", es: "Correo" },
      PHONE: { pt: "Telefone", en: "Phone", es: "Teléfono" },
      WHATSAPP: { pt: "WhatsApp", en: "WhatsApp", es: "WhatsApp" },
      PORTAL: { pt: "Portal", en: "Portal", es: "Portal" },
      INTERNAL: { pt: "Interno", en: "Internal", es: "Interno" },
      API: { pt: "API", en: "API", es: "API" },
    },
    impact: {
      LOW: { pt: "Baixo", en: "Low", es: "Bajo" },
      MEDIUM: { pt: "Médio", en: "Medium", es: "Medio" },
      HIGH: { pt: "Alto", en: "High", es: "Alto" },
      CRITICAL: { pt: "Crítico", en: "Critical", es: "Crítico" },
    },
    urgency: {
      LOW: { pt: "Baixa", en: "Low", es: "Baja" },
      MEDIUM: { pt: "Média", en: "Medium", es: "Media" },
      HIGH: { pt: "Alta", en: "High", es: "Alta" },
      IMMEDIATE: { pt: "Imediata", en: "Immediate", es: "Inmediata" },
    },
    taskStatus: {
      OPEN: { pt: "Aberta", en: "Open", es: "Abierta" },
      IN_PROGRESS: { pt: "Em andamento", en: "In progress", es: "En progreso" },
      WAITING: { pt: "Em espera", en: "Waiting", es: "En espera" },
      DONE: { pt: "Concluída", en: "Done", es: "Hecha" },
      CANCELLED: { pt: "Cancelada", en: "Cancelled", es: "Cancelada" },
    },
    taskType: {
      SERVICE: { pt: "Atendimento", en: "Service", es: "Servicio" },
      CALL: { pt: "Ligação", en: "Call", es: "Llamada" },
      EMAIL: { pt: "E-mail", en: "Email", es: "Correo" },
      WHATSAPP: { pt: "WhatsApp", en: "WhatsApp", es: "WhatsApp" },
      VISIT: { pt: "Visita", en: "Visit", es: "Visita" },
      INTERNAL: { pt: "Interna", en: "Internal", es: "Interna" },
    },
    appointmentStatus: {
      SCHEDULED: { pt: "Agendado", en: "Scheduled", es: "Programado" },
      DONE: { pt: "Concluído", en: "Done", es: "Realizado" },
      CANCELLED: { pt: "Cancelado", en: "Cancelled", es: "Cancelado" },
      NO_SHOW: { pt: "Não compareceu", en: "No-show", es: "No se presentó" },
    },
    slaEventType: {
      START: { pt: "Início", en: "Start", es: "Inicio" },
      PAUSE: { pt: "Pausa", en: "Pause", es: "Pausa" },
      RESUME: { pt: "Retomada", en: "Resume", es: "Reanudar" },
      WARNING: { pt: "Aviso", en: "Warning", es: "Aviso" },
      BREACH: { pt: "Violação", en: "Breach", es: "Incumplimiento" },
      MET: { pt: "Cumprido", en: "Met", es: "Cumplido" },
      RECALC: { pt: "Recalcular", en: "Recalculate", es: "Recalcular" },
      CANCEL: { pt: "Cancelar", en: "Cancel", es: "Cancelar" },
    },
    slaInstanceStatus: {
      RUNNING: { pt: "Em execução", en: "Running", es: "En ejecución" },
      PAUSED: { pt: "Pausado", en: "Paused", es: "Pausado" },
      MET: { pt: "Cumprido", en: "Met", es: "Cumplido" },
      BREACHED: { pt: "Violado", en: "Breached", es: "Incumplido" },
      CANCELLED: { pt: "Cancelado", en: "Cancelled", es: "Cancelado" },
    },
    timelineKind: {
      INCIDENT_CREATED: { pt: "Incidente criado", en: "Incident created", es: "Incidente creado" },
      INCIDENT_RESOLVED: { pt: "Incidente resolvido", en: "Incident resolved", es: "Incidente resuelto" },
      INCIDENT_CLOSED: { pt: "Incidente fechado", en: "Incident closed", es: "Incidente cerrado" },
      TASK: { pt: "Tarefa relacionada", en: "Related task", es: "Tarea relacionada" },
      APPOINTMENT: { pt: "Agendamento relacionado", en: "Related appointment", es: "Cita relacionada" },
      SLA_EVENT: { pt: "Evento de SLA", en: "SLA event", es: "Evento de SLA" },
    },
  };

  function enumLabel(group, value) {
    const key = String(value || "").trim();
    if (!key) return "-";
    const label = enumLabels[group]?.[key];
    return textFor(label, key);
  }

  function enumOptions(group) {
    const source = enumLabels[group] || {};
    return Object.keys(source).map((value) => ({
      value,
      label: textFor(source[value], value),
    }));
  }

  const resources = {
    incidents: {
      title: { pt: "Incidentes", en: "Incidents", es: "Incidentes" },
      titleSingular: { pt: "Incidente", en: "Incident", es: "Incidente" },
      detailCardTitle: { pt: "Ficha do incidente", en: "Incident form", es: "Ficha del incidente" },
      detailCardSubtitle: {
        pt: "Preencha os dados principais do atendimento.",
        en: "Fill in the main service details.",
        es: "Complete los datos principales del caso.",
      },
      timelineTitle: { pt: "Timeline", en: "Timeline", es: "Timeline" },
      timelineSubtitle: {
        pt: "Os eventos do caso aparecem aqui após o primeiro save.",
        en: "Case events appear here after the first save.",
        es: "Los eventos del caso aparecen aquí después del primer guardado.",
      },
      summaryTitle: { pt: "Resumo", en: "Summary", es: "Resumen" },
      summarySubtitle: {
        pt: "Visão rápida do status e dos vínculos principais.",
        en: "Quick view of status and main relationships.",
        es: "Vista rápida del estado y los vínculos principales.",
      },
      detailTab: { pt: "Detalhes", en: "Details", es: "Detalles" },
      relatedTab: { pt: "Relacionados", en: "Related", es: "Relacionados" },
      formTabs: [
        { id: "main", label: { pt: "Principal", en: "Main", es: "Principal" }, fields: ["number", "title", "company_id", "status", "priority", "channel"] },
        { id: "routing", label: { pt: "Atendimento", en: "Routing", es: "Atención" }, fields: ["queue_id", "subject_id", "owner_user_id", "opened_by_user_id", "asset_id", "contact_id"] },
        { id: "planning", label: { pt: "Datas e SLA", en: "Dates and SLA", es: "Fechas y SLA" }, fields: ["due_at", "resolved_at", "closed_at", "sla_policy_id", "impact", "urgency"] },
        { id: "notes", label: { pt: "Descrição", en: "Description", es: "Descripción" }, fields: ["description"] },
      ],
      fields: [
        { name: "number", label: { pt: "Número", en: "Number", es: "Número" }, type: "text", disabled: true },
        { name: "title", label: { pt: "Título", en: "Title", es: "Título" }, type: "text", required: true },
        { name: "company_id", label: { pt: "Empresa", en: "Company", es: "Empresa" }, type: "lookup", lookup: "companies", required: true },
        { name: "status", label: { pt: "Status", en: "Status", es: "Estado" }, type: "select", optionsGroup: "status", defaultValue: "NEW" },
        { name: "priority", label: { pt: "Prioridade", en: "Priority", es: "Prioridad" }, type: "select", optionsGroup: "priority", defaultValue: "NORMAL" },
        { name: "channel", label: { pt: "Canal", en: "Channel", es: "Canal" }, type: "select", optionsGroup: "channel", defaultValue: "PORTAL" },
        { name: "queue_id", label: { pt: "Fila", en: "Queue", es: "Cola" }, type: "lookup", lookup: "queues" },
        { name: "subject_id", label: { pt: "Assunto", en: "Subject", es: "Asunto" }, type: "lookup", lookup: "subjects" },
        { name: "owner_user_id", label: { pt: "Responsável", en: "Owner", es: "Responsable" }, type: "lookup", lookup: "users" },
        { name: "opened_by_user_id", label: { pt: "Aberto por", en: "Opened by", es: "Abierto por" }, type: "lookup", lookup: "users" },
        { name: "asset_id", label: { pt: "Ativo", en: "Asset", es: "Activo" }, type: "lookup", lookup: "assets", filterBy: "company_id" },
        { name: "contact_id", label: { pt: "Contato", en: "Contact", es: "Contacto" }, type: "text" },
        { name: "due_at", label: { pt: "Vencimento", en: "Due at", es: "Vencimiento" }, type: "datetime-local" },
        { name: "resolved_at", label: { pt: "Resolvido em", en: "Resolved at", es: "Resuelto en" }, type: "datetime-local" },
        { name: "closed_at", label: { pt: "Fechado em", en: "Closed at", es: "Cerrado en" }, type: "datetime-local" },
        { name: "sla_policy_id", label: { pt: "Política SLA", en: "SLA policy", es: "Política SLA" }, type: "lookup", lookup: "slaPolicies" },
        { name: "impact", label: { pt: "Impacto", en: "Impact", es: "Impacto" }, type: "select", optionsGroup: "impact" },
        { name: "urgency", label: { pt: "Urgência", en: "Urgency", es: "Urgencia" }, type: "select", optionsGroup: "urgency" },
        { name: "description", label: { pt: "Descrição", en: "Description", es: "Descripción" }, type: "textarea" },
      ],
      lookupSources: {
        companies: "/api/companies?fields=summary",
        users: "/api/users",
        queues: "/api/service/queues",
        subjects: "/api/service/subjects",
        assets: "/api/service/assets",
        slaPolicies: "/api/service/sla/policies",
      },
      related: {
        tasks: {
          title: { pt: "Tarefas", en: "Tasks", es: "Tareas" },
          columns: [
            { key: "title", label: { pt: "Título", en: "Title", es: "Título" } },
            { key: "task_type.name", label: { pt: "Tipo", en: "Type", es: "Tipo" } },
            { key: "status", label: { pt: "Status", en: "Status", es: "Estado" }, enumGroup: "taskStatus" },
            { key: "priority", label: { pt: "Prioridade", en: "Priority", es: "Prioridad" }, enumGroup: "priority" },
            { key: "assigned_to_user.full_name", label: { pt: "Responsável", en: "Owner", es: "Responsable" } },
            { key: "due_at", label: { pt: "Vencimento", en: "Due at", es: "Vencimiento" }, format: "datetime" },
          ],
        },
        appointments: {
          title: { pt: "Agendamentos", en: "Appointments", es: "Citas" },
          columns: [
            { key: "title", label: { pt: "Título", en: "Title", es: "Título" } },
            { key: "resource.name", label: { pt: "Recurso", en: "Resource", es: "Recurso" } },
            { key: "status", label: { pt: "Status", en: "Status", es: "Estado" }, enumGroup: "appointmentStatus" },
            { key: "start_at", label: { pt: "Início", en: "Start", es: "Inicio" }, format: "datetime" },
            { key: "end_at", label: { pt: "Fim", en: "End", es: "Fin" }, format: "datetime" },
          ],
        },
        work_orders: {
          title: { pt: "Work Orders", en: "Work orders", es: "Ordenes de trabajo" },
          columns: [
            { key: "code", label: { pt: "CÃ³digo", en: "Code", es: "CÃ³digo" } },
            { key: "title", label: { pt: "TÃ­tulo", en: "Title", es: "TÃ­tulo" } },
            { key: "status.name", label: { pt: "Status", en: "Status", es: "Estado" } },
            { key: "owner_user.full_name", label: { pt: "ResponsÃ¡vel", en: "Owner", es: "Responsable" } },
            { key: "planned_start", label: { pt: "Planejado para", en: "Planned for", es: "Planificado para" }, format: "datetime" },
          ],
        },
        sla_events: {
          title: { pt: "Eventos de SLA", en: "SLA events", es: "Eventos de SLA" },
          columns: [
            { key: "event_type", label: { pt: "Evento", en: "Event", es: "Evento" }, enumGroup: "slaEventType" },
            { key: "sla_instance_kpi.sla_kpi.name", label: { pt: "KPI", en: "KPI", es: "KPI" } },
            { key: "occurred_at", label: { pt: "Ocorrido em", en: "Occurred at", es: "Ocurrió en" }, format: "datetime" },
          ],
        },
      },
      timelineMeta: {
        INCIDENT_CREATED: { icon: "fa-ticket", color: "#1c84c6" },
        INCIDENT_RESOLVED: { icon: "fa-check", color: "#1ab394" },
        INCIDENT_CLOSED: { icon: "fa-lock", color: "#6f42c1" },
        TASK: { icon: "fa-tasks", color: "#f8ac59" },
        APPOINTMENT: { icon: "fa-calendar", color: "#23c6c8" },
        SLA_EVENT: { icon: "fa-bolt", color: "#ed5565" },
      },
      messages: {
        loading: { pt: "Carregando...", en: "Loading...", es: "Cargando..." },
        save: { pt: "Salvar", en: "Save", es: "Guardar" },
        saving: { pt: "Salvando...", en: "Saving...", es: "Guardando..." },
        delete: { pt: "Excluir", en: "Delete", es: "Eliminar" },
        createWorkOrder: { pt: "Gerar work order", en: "Create work order", es: "Crear work order" },
        new: { pt: "Novo", en: "New", es: "Nuevo" },
        back: { pt: "Voltar", en: "Back", es: "Volver" },
        saveSuccess: { pt: "Incidente salvo com sucesso.", en: "Incident saved successfully.", es: "Incidente guardado con éxito." },
        deleteSuccess: { pt: "Incidente excluído com sucesso.", en: "Incident deleted successfully.", es: "Incidente eliminado con éxito." },
        saveBeforeTimeline: {
          pt: "Salve o incidente para habilitar a timeline.",
          en: "Save the incident to enable the timeline.",
          es: "Guarda el incidente para habilitar la timeline.",
        },
        saveBeforeRelated: {
          pt: "Salve o incidente para visualizar os relacionados.",
          en: "Save the incident to view related records.",
          es: "Guarda el incidente para ver los relacionados.",
        },
        noTimeline: { pt: "Nenhum evento relacionado ainda.", en: "No related events yet.", es: "Todavía no hay eventos relacionados." },
        noRecords: { pt: "Nenhum registro encontrado.", en: "No records found.", es: "No se encontraron registros." },
        selectPlaceholder: { pt: "Selecione...", en: "Select...", es: "Selecciona..." },
        requiredPrefix: { pt: "Preencha os campos obrigatórios", en: "Fill in the required fields", es: "Complete los campos obligatorios" },
        confirmDelete: { pt: "Deseja realmente excluir este incidente?", en: "Do you really want to delete this incident?", es: "¿Realmente deseas eliminar este incidente?" },
      },
    },
  };

  global.ServiceIncidentResources = {
    resources,
    waitForI18nReady,
    tt,
    esc,
    normalizeArray,
    textFor,
    currentLang,
    enumLabel,
    enumOptions,
  };
})(window);
