function page(pathKey, title, apiPath, options) {
  return {
    pathKey,
    title,
    apiPath,
    listPath: options?.listPath || null,
    idField: options?.idField || "id",
    columns: options?.columns || [],
    formFields: options?.formFields || [],
    requiredFields: options?.requiredFields || [],
    rowActions: options?.rowActions || [],
  };
}

function col(key, label, type) {
  return { key, label: label || key, type: type || "text" };
}

function f(name, label, type, required, extra) {
  return Object.assign({ name, label, type: type || "text", required: !!required }, extra || {});
}

function lookup(url, valueKey, labelKey) {
  return { url, valueKey: valueKey || "id", labelKey: labelKey || "name" };
}

const incidentStatusOptions = ["NEW", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_INTERNAL", "RESOLVED", "CANCELLED"];
const incidentPriorityOptions = ["LOW", "NORMAL", "HIGH", "URGENT"];
const incidentChannelOptions = ["EMAIL", "PHONE", "WHATSAPP", "PORTAL", "INTERNAL", "API"];

const servicePages = {
  incidentes: page("incidentes", "Serviço - Incidentes", "/api/service/incidents", {
    columns: [
      col("number", "Número"),
      col("title", "Título"),
      col("status", "Status"),
      col("priority", "Prioridade"),
      col("company.company_name", "Empresa"),
      col("queue.name", "Fila"),
      col("created_at", "Criado em", "datetime"),
    ],
    formFields: [
      f("number", "Número", "text", true),
      f("title", "Título", "text", true),
      f("description", "Descrição", "textarea", false),
      f("status", "Status", "select", false, { options: incidentStatusOptions }),
      f("priority", "Prioridade", "select", false, { options: incidentPriorityOptions }),
      f("channel", "Canal", "select", false, { options: incidentChannelOptions }),
      f("company_id", "Empresa", "select", true, { lookup: lookup("/api/companies?fields=summary", "id", "company_name") }),
      f("owner_user_id", "Responsável", "select", false, { lookup: lookup("/api/users", "id", "full_name") }),
      f("opened_by_user_id", "Aberto por", "select", false, { lookup: lookup("/api/users", "id", "full_name") }),
      f("queue_id", "Fila", "select", false, { lookup: lookup("/api/service/queues", "id", "name") }),
      f("subject_id", "Assunto", "select", false, { lookup: lookup("/api/service/subjects", "id", "name") }),
      f("asset_id", "Ativo", "select", false, { lookup: lookup("/api/service/assets", "id", "name"), filterByCompanyField: "company_id" }),
      f("sla_policy_id", "Política SLA", "select", false, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
      f("due_at", "Vencimento", "datetime-local", false),
      f("resolved_at", "Resolvido em", "datetime-local", false),
      f("closed_at", "Fechado em", "datetime-local", false),
    ],
    requiredFields: ["number", "title", "company_id"],
  }),

  slaPoliticas: page("sla/politicas", "Serviço - SLA / Políticas", "/api/service/sla/policies", {
    columns: [
      col("name", "Nome"),
      col("is_active", "Ativa", "boolean"),
      col("business_calendar_id", "Calendário"),
      col("description", "Descrição"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("description", "Descrição", "textarea", false),
      f("is_active", "Ativa", "checkbox", false),
      f("business_calendar_id", "Calendário", "select", false, { lookup: lookup("/api/service/calendars", "id", "name") }),
      f("apply_when_json", "Condição (JSON)", "textarea", false, { parseAsJson: true }),
    ],
    requiredFields: ["name"],
    rowActions: [
      { type: "link", label: "KPIs", icon: "fa-line-chart", href: "/servico/sla/kpis?sla_policy_id={id}", className: "btn-default" },
      { type: "link", label: "Instâncias", icon: "fa-bolt", href: "/servico/sla/instancias?sla_policy_id={id}", className: "btn-default" },
    ],
  }),

  slaKpis: page("sla/kpis", "Serviço - SLA / KPIs", "/api/service/sla/kpis", {
    columns: [
      col("sla_policy.name", "Política"),
      col("name", "Nome"),
      col("kpi_type", "Tipo"),
      col("warning_after_minutes", "Aviso (min)"),
      col("fail_after_minutes", "Estouro (min)"),
      col("sort_order", "Ordem"),
      col("is_active", "Ativo", "boolean"),
    ],
    formFields: [
      f("sla_policy_id", "Política", "select", true, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
      f("name", "Nome", "text", true),
      f("kpi_type", "Tipo", "select", true, { options: ["FIRST_RESPONSE", "RESOLUTION", "CUSTOM"] }),
      f("start_condition", "Condição de início", "text", true),
      f("start_status", "Status de início", "select", false, { options: incidentStatusOptions }),
      f("stop_condition", "Condição de parada", "text", true),
      f("stop_status", "Status de parada", "select", false, { options: incidentStatusOptions }),
      f("pause_when_status_in", "Pausar quando status in (JSON)", "textarea", false, { parseAsJson: true }),
      f("warning_after_minutes", "Aviso (min)", "number", true),
      f("fail_after_minutes", "Estouro (min)", "number", true),
      f("sort_order", "Ordem", "number", false),
      f("is_active", "Ativo", "checkbox", false),
    ],
    requiredFields: ["sla_policy_id", "name", "kpi_type", "start_condition", "stop_condition", "warning_after_minutes", "fail_after_minutes"],
  }),

  slaInstancias: page("sla/instancias", "Serviço - SLA / Instâncias", "/api/service/sla/instances", {
    columns: [
      col("incident.title", "Incidente"),
      col("sla_policy.name", "Política"),
      col("status", "Status"),
      col("started_at", "Início", "datetime"),
      col("completed_at", "Conclusão", "datetime"),
      col("created_at", "Criado em", "datetime"),
    ],
    formFields: [
      f("incident_id", "Incidente", "select", true, { lookup: lookup("/api/service/incidents", "id", "title") }),
      f("sla_policy_id", "Política", "select", true, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
      f("status", "Status", "select", false, { options: ["RUNNING", "PAUSED", "MET", "BREACHED", "CANCELLED"] }),
      f("started_at", "Início", "datetime-local", false),
      f("paused_at", "Pausado em", "datetime-local", false),
      f("completed_at", "Concluído em", "datetime-local", false),
    ],
    requiredFields: ["incident_id", "sla_policy_id"],
    rowActions: [
      { type: "link", label: "KPIs da instância", icon: "fa-list", href: "/servico/sla/instancias-kpi?sla_instance_id={id}", className: "btn-default" },
    ],
  }),

  slaInstanciasKpi: page("sla/instancias-kpi", "Serviço - SLA / KPIs da Instância", "/api/service/sla/instance-kpis", {
    columns: [
      col("sla_kpi.name", "KPI"),
      col("sla_instance_id", "Instância"),
      col("status", "Status"),
      col("target_at", "Meta", "datetime"),
      col("warning_at", "Aviso", "datetime"),
      col("breached_at", "Estourou em", "datetime"),
      col("elapsed_minutes", "Min. corridos"),
    ],
    formFields: [
      f("sla_instance_id", "Instância SLA", "select", true, { lookup: lookup("/api/service/sla/instances", "id", "id") }),
      f("sla_kpi_id", "KPI", "select", true, { lookup: lookup("/api/service/sla/kpis", "id", "name") }),
      f("status", "Status", "select", false, { options: ["RUNNING", "PAUSED", "MET", "BREACHED"] }),
      f("target_at", "Meta", "datetime-local", true),
      f("warning_at", "Aviso", "datetime-local", false),
      f("met_at", "Atingido em", "datetime-local", false),
      f("breached_at", "Estourou em", "datetime-local", false),
      f("elapsed_minutes", "Minutos corridos", "number", false),
      f("last_tick_at", "Último tick", "datetime-local", false),
    ],
    requiredFields: ["sla_instance_id", "sla_kpi_id", "target_at"],
  }),

  slaEventos: page("sla/eventos", "Serviço - SLA / Eventos", "/api/service/sla/events", {
    columns: [
      col("incident.title", "Incidente"),
      col("event_type", "Evento"),
      col("occurred_at", "Ocorrido em", "datetime"),
      col("sla_instance_kpi_id", "KPI da instância"),
    ],
    formFields: [
      f("incident_id", "Incidente", "select", true, { lookup: lookup("/api/service/incidents", "id", "title") }),
      f("sla_instance_kpi_id", "KPI da instância", "select", false, { lookup: lookup("/api/service/sla/instance-kpis", "id", "id") }),
      f("event_type", "Tipo do evento", "select", true, { options: ["START", "PAUSE", "RESUME", "WARNING", "BREACH", "MET", "RECALC", "CANCEL"] }),
      f("occurred_at", "Ocorrido em", "datetime-local", false),
      f("metadata_json", "Metadados (JSON)", "textarea", false, { parseAsJson: true }),
    ],
    requiredFields: ["incident_id", "event_type"],
  }),

  filas: page("filas", "Serviço - Filas", "/api/service/queues", {
    columns: [
      col("name", "Nome"),
      col("email", "E-mail"),
      col("is_active", "Ativa", "boolean"),
      col("assignment_mode", "Modo de atribuição"),
      col("default_sla_policy_id", "SLA padrão"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("email", "E-mail", "email", false),
      f("is_active", "Ativa", "checkbox", false),
      f("assignment_mode", "Modo de atribuição", "select", false, { options: ["MANUAL", "ROUND_ROBIN", "LEAST_BUSY"] }),
      f("default_sla_policy_id", "SLA padrão", "select", false, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
    ],
    requiredFields: ["name"],
    rowActions: [
      { type: "link", label: "Membros", icon: "fa-users", href: "/servico/filas/membros?queue_id={id}", className: "btn-default" },
    ],
  }),

  filasMembros: page("filas/membros", "Serviço - Filas / Membros", "/api/service/queues/members", {
    columns: [
      col("queue.name", "Fila"),
      col("user.full_name", "Usuário"),
      col("role", "Papel"),
      col("is_active", "Ativo", "boolean"),
      col("created_at", "Criado em", "datetime"),
    ],
    formFields: [
      f("queue_id", "Fila", "select", true, { lookup: lookup("/api/service/queues", "id", "name") }),
      f("user_id", "Usuário", "select", true, { lookup: lookup("/api/users", "id", "full_name") }),
      f("role", "Papel", "select", false, { options: ["AGENT", "SUPERVISOR"] }),
      f("is_active", "Ativo", "checkbox", false),
    ],
    requiredFields: ["queue_id", "user_id"],
  }),

  ativos: page("ativos", "Serviço - Ativos", "/api/service/assets", {
    columns: [
      col("name", "Nome"),
      col("company.company_name", "Empresa"),
      col("status", "Status"),
      col("asset_tag", "Tag"),
      col("serial_number", "Serial"),
      col("warranty_end_date", "Garantia até", "date"),
    ],
    formFields: [
      f("company_id", "Empresa", "select", true, { lookup: lookup("/api/companies?fields=summary", "id", "company_name") }),
      f("name", "Nome", "text", true),
      f("status", "Status", "select", false, { options: ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"] }),
      f("asset_tag", "Asset tag", "text", false),
      f("serial_number", "Serial", "text", false),
      f("category", "Categoria", "text", false),
      f("purchase_date", "Compra em", "date", false),
      f("warranty_end_date", "Garantia até", "date", false),
      f("notes", "Notas", "textarea", false),
    ],
    requiredFields: ["company_id", "name"],
  }),

  assuntos: page("assuntos", "Serviço - Assuntos", "/api/service/subjects", {
    columns: [
      col("name", "Nome"),
      col("parent.name", "Pai"),
      col("is_active", "Ativo", "boolean"),
      col("default_sla_policy_id", "SLA padrão"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("parent_id", "Pai", "select", false, { lookup: lookup("/api/service/subjects", "id", "name") }),
      f("path", "Caminho", "text", false),
      f("is_active", "Ativo", "checkbox", false),
      f("default_sla_policy_id", "SLA padrão", "select", false, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
    ],
    requiredFields: ["name"],
  }),

  calendarios: page("calendarios", "Serviço - Calendários", "/api/service/calendars", {
    columns: [
      col("name", "Nome"),
      col("timezone", "Timezone"),
      col("is_default", "Padrão", "boolean"),
      col("is_active", "Ativo", "boolean"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("timezone", "Timezone", "text", false),
      f("is_default", "Padrão", "checkbox", false),
      f("is_active", "Ativo", "checkbox", false),
    ],
    requiredFields: ["name"],
    rowActions: [
      { type: "link", label: "Regras", icon: "fa-calendar", href: "/servico/calendarios/regras?calendar_id={id}", className: "btn-default" },
      { type: "link", label: "Exceções", icon: "fa-calendar-times-o", href: "/servico/calendarios/excecoes?calendar_id={id}", className: "btn-default" },
    ],
  }),

  calendariosRegras: page("calendarios/regras", "Serviço - Calendários / Regras", "/api/service/calendars/rules", {
    columns: [
      col("calendar_id", "Calendário"),
      col("day_of_week", "Dia da semana"),
      col("is_working_time", "Horário útil", "boolean"),
      col("start_time", "Início"),
      col("end_time", "Fim"),
    ],
    formFields: [
      f("calendar_id", "Calendário", "select", true, { lookup: lookup("/api/service/calendars", "id", "name") }),
      f("day_of_week", "Dia da semana", "select", true, { options: ["0", "1", "2", "3", "4", "5", "6"] }),
      f("is_working_time", "Horário útil", "checkbox", false),
      f("start_time", "Início (HH:mm)", "time", true),
      f("end_time", "Fim (HH:mm)", "time", true),
    ],
    requiredFields: ["calendar_id", "day_of_week", "start_time", "end_time"],
  }),

  calendariosExcecoes: page("calendarios/excecoes", "Serviço - Calendários / Exceções", "/api/service/calendars/exceptions", {
    columns: [
      col("calendar_id", "Calendário"),
      col("type", "Tipo"),
      col("date_from", "De", "datetime"),
      col("date_to", "Até", "datetime"),
      col("notes", "Notas"),
    ],
    formFields: [
      f("calendar_id", "Calendário", "select", true, { lookup: lookup("/api/service/calendars", "id", "name") }),
      f("type", "Tipo", "select", true, { options: ["HOLIDAY", "SPECIAL_HOURS", "BLACKOUT"] }),
      f("date_from", "De", "datetime-local", true),
      f("date_to", "Até", "datetime-local", true),
      f("notes", "Notas", "textarea", false),
    ],
    requiredFields: ["calendar_id", "type", "date_from", "date_to"],
  }),

  recursos: page("recursos", "Serviço - Recursos", "/api/service/resources", {
    columns: [
      col("name", "Nome"),
      col("user.full_name", "Usuário"),
      col("calendar.name", "Calendário"),
      col("is_active", "Ativo", "boolean"),
      col("capacity_per_day", "Capacidade/dia"),
    ],
    formFields: [
      f("user_id", "Usuário", "select", true, { lookup: lookup("/api/users", "id", "full_name") }),
      f("name", "Nome", "text", true),
      f("calendar_id", "Calendário", "select", false, { lookup: lookup("/api/service/calendars", "id", "name") }),
      f("skills_json", "Skills (JSON)", "textarea", false, { parseAsJson: true }),
      f("capacity_per_day", "Capacidade por dia", "number", false),
      f("is_active", "Ativo", "checkbox", false),
    ],
    requiredFields: ["user_id", "name"],
    rowActions: [
      { type: "link", label: "Agendamentos", icon: "fa-clock-o", href: "/servico/recursos/agendamentos?resource_id={id}", className: "btn-default" },
    ],
  }),

  recursosAgendamentos: page("recursos/agendamentos", "Serviço - Recursos / Agendamentos", "/api/service/resources/appointments", {
    columns: [
      col("resource.name", "Recurso"),
      col("title", "Título"),
      col("start_at", "Início", "datetime"),
      col("end_at", "Fim", "datetime"),
      col("status", "Status"),
      col("incident.title", "Incidente"),
    ],
    formFields: [
      f("resource_id", "Recurso", "select", true, { lookup: lookup("/api/service/resources", "id", "name") }),
      f("incident_id", "Incidente (opcional)", "select", false, { lookup: lookup("/api/service/incidents", "id", "title") }),
      f("title", "Título", "text", true),
      f("start_at", "Início", "datetime-local", true),
      f("end_at", "Fim", "datetime-local", true),
      f("status", "Status", "select", false, { options: ["SCHEDULED", "DONE", "CANCELLED", "NO_SHOW"] }),
      f("notes", "Notas", "textarea", false),
    ],
    requiredFields: ["resource_id", "title", "start_at", "end_at"],
  }),

  tarefas: page("tarefas", "Serviço - Tarefas", "/api/service/tasks", {
    columns: [
      col("title", "Título"),
      col("task_type.name", "Tipo"),
      col("type", "Canal"),
      col("status", "Status"),
      col("priority", "Prioridade"),
      col("assigned_to_user.full_name", "Responsável"),
      col("due_at", "Vencimento", "datetime"),
      col("incident.title", "Incidente"),
    ],
    formFields: [
      f("incident_id", "Incidente", "select", true, { lookup: lookup("/api/service/incidents", "id", "title") }),
      f("task_type_id", "Tipo de tarefa", "select", false, { lookup: lookup("/api/service/tasks/types/all", "id", "name"), onChangeCopyTo: [{ from: "channel", to: "type" }, { from: "default_duration_minutes", to: "estimated_minutes" }] }),
      f("title", "Título", "text", true),
      f("description", "Descrição", "textarea", false),
      f("type", "Canal", "select", true, { options: ["SERVICE", "CALL", "EMAIL", "WHATSAPP", "VISIT", "INTERNAL"] }),
      f("status", "Status", "select", false, { options: ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"] }),
      f("priority", "Prioridade", "select", false, { options: incidentPriorityOptions }),
      f("assigned_to_user_id", "Responsável", "select", false, { lookup: lookup("/api/users", "id", "full_name") }),
      f("estimated_minutes", "Minutos estimados", "number", false),
      f("actual_minutes", "Minutos reais", "number", false),
      f("due_at", "Vencimento", "datetime-local", false),
      f("started_at", "Início", "datetime-local", false),
      f("completed_at", "Conclusão", "datetime-local", false),
    ],
    requiredFields: ["incident_id", "title", "type"],
  }),

  tarefasTipos: page("tarefas/tipos", "Serviço - Tarefas / Tipos", "/api/service/tasks/types", {
    listPath: "/api/service/tasks/types/all",
    columns: [
      col("name", "Nome"),
      col("channel", "Canal"),
      col("default_duration_minutes", "Duração padrão"),
      col("is_active", "Ativo", "boolean"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("channel", "Canal", "select", false, { options: ["SERVICE", "CALL", "EMAIL", "WHATSAPP", "VISIT", "INTERNAL"] }),
      f("default_duration_minutes", "Duração padrão (min)", "number", false),
      f("is_active", "Ativo", "checkbox", false),
    ],
    requiredFields: ["name"],
  }),
};

function render(viewName, key) {
  return (req, res) => {
    const config = servicePages[key] || null;
    res.render(`servico/${viewName}`, { servicePage: config });
  };
}

module.exports = {
  incidentes: render("incidentes", "incidentes"),
  slaPoliticas: render("sla-politicas", "slaPoliticas"),
  slaKpis: render("sla-kpis", "slaKpis"),
  slaInstancias: render("sla-instancias", "slaInstancias"),
  slaInstanciasKpi: render("sla-instancias-kpi", "slaInstanciasKpi"),
  slaEventos: render("sla-eventos", "slaEventos"),
  filas: render("filas", "filas"),
  filasMembros: render("filas-membros", "filasMembros"),
  ativos: render("ativos", "ativos"),
  assuntos: render("assuntos", "assuntos"),
  calendarios: render("calendarios", "calendarios"),
  calendariosRegras: render("calendarios-regras", "calendariosRegras"),
  calendariosExcecoes: render("calendarios-excecoes", "calendariosExcecoes"),
  agendaAtividades: (req, res) => res.render("servico/agenda-atividades"),
  recursos: render("recursos", "recursos"),
  recursosAgendamentos: render("recursos-agendamentos", "recursosAgendamentos"),
  tarefas: render("tarefas", "tarefas"),
  tarefasTipos: render("tarefas-tipos", "tarefasTipos"),
};
