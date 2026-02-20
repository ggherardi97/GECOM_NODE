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

const servicePages = {
  incidentes: page("incidentes", "ServiÃ§o - Casos", "/api/service/incidents", {
    columns: [
      col("number", "NÃºmero"),
      col("title", "TÃ­tulo"),
      col("status", "Status"),
      col("priority", "Prioridade"),
      col("company_name", "Empresa"),
      col("assignee_name", "ResponsÃ¡vel"),
      col("queue_name", "Fila"),
      col("created_at", "Criado em", "datetime"),
    ],
    formFields: [
      f("title", "TÃ­tulo", "text", true),
      f("description", "DescriÃ§Ã£o", "textarea", false),
      f("status", "Status", "select", false, { options: ["NOVO", "EM_ANDAMENTO", "AGUARDANDO_CLIENTE", "RESOLVIDO", "FECHADO"] }),
      f("priority", "Prioridade", "select", false, { options: ["BAIXA", "MEDIA", "ALTA", "CRITICA"] }),
      f("channel", "Canal", "select", false, { options: ["MANUAL", "EMAIL", "PORTAL", "TELEFONE", "WHATSAPP", "OUTRO"] }),
      f("company_id", "Empresa", "select", false, { lookup: lookup("/api/companies?fields=summary", "id", "company_name") }),
      f("owner_user_id", "Responsavel", "select", false, { lookup: lookup("/api/users", "id", "full_name") }),
      f("queue_id", "Fila", "select", false, { lookup: lookup("/api/service/queues", "id", "name") }),
      f("subject_id", "Assunto", "select", false, { lookup: lookup("/api/service/subjects", "id", "name") }),
      f("asset_id", "Ativo", "select", false, { lookup: lookup("/api/service/assets", "id", "name"), filterByCompanyField: "company_id" }),
      f("sla_policy_id", "SLA Policy", "select", false, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
      f("due_at", "Vencimento", "datetime-local", false),
    ],
    requiredFields: ["title"],
  }),

  filas: page("filas", "ServiÃ§o - Filas", "/api/service/queues", {
    columns: [
      col("name", "Nome"),
      col("email", "Email"),
      col("is_active", "Ativa", "boolean"),
      col("assignment_mode", "Modo de atribuiÃ§Ã£o"),
      col("default_sla_policy_name", "SLA padrÃ£o"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("email", "Email", "email", false),
      f("is_active", "Ativa", "checkbox", false),
      f("assignment_mode", "Modo de atribuiÃ§Ã£o", "select", false, { options: ["ROUND_ROBIN", "MANUAL", "LEAST_LOADED"] }),
      f("default_sla_policy_id", "SLA padrÃ£o", "select", false, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
      f("description", "DescriÃ§Ã£o", "textarea", false),
    ],
    requiredFields: ["name"],
    rowActions: [
      { type: "link", label: "Membros", icon: "fa-users", href: "/servico/filas/membros?queue_id={id}", className: "btn-default" },
    ],
  }),

  filasMembros: page("filas/membros", "ServiÃ§o - Filas / Membros", "/api/service/queues/members", {
    columns: [
      col("queue_name", "Fila"),
      col("user_name", "UsuÃ¡rio"),
      col("role", "Papel"),
      col("is_active", "Ativo", "boolean"),
      col("created_at", "Criado em", "datetime"),
    ],
    formFields: [
      f("queue_id", "Fila", "select", true, { lookup: lookup("/api/service/queues", "id", "name") }),
      f("user_id", "UsuÃ¡rio", "select", true, { lookup: lookup("/api/users", "id", "full_name") }),
      f("role", "Papel", "select", false, { options: ["AGENT", "SUPERVISOR", "OWNER"] }),
      f("is_active", "Ativo", "checkbox", false),
    ],
    requiredFields: ["queue_id", "user_id"],
  }),

  slaPoliticas: page("sla/politicas", "ServiÃ§o - SLA / Policies", "/api/service/sla/policies", {
    columns: [
      col("name", "Nome"),
      col("is_active", "Ativa", "boolean"),
      col("calendar_name", "CalendÃ¡rio"),
      col("description", "DescriÃ§Ã£o"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("is_active", "Ativa", "checkbox", false),
      f("calendar_id", "CalendÃ¡rio", "select", false, { lookup: lookup("/api/service/calendars", "id", "name") }),
      f("description", "DescriÃ§Ã£o", "textarea", false),
    ],
    requiredFields: ["name"],
    rowActions: [
      { type: "link", label: "KPIs", icon: "fa-line-chart", href: "/servico/sla/kpis?policy_id={id}", className: "btn-default" },
    ],
  }),

  slaKpis: page("sla/kpis", "ServiÃ§o - SLA / KPIs", "/api/service/sla/kpis", {
    columns: [
      col("name", "Nome"),
      col("type", "Tipo"),
      col("warning_min", "Warning (min)"),
      col("fail_min", "Fail (min)"),
      col("is_active", "Ativo", "boolean"),
      col("display_order", "Ordem"),
    ],
    formFields: [
      f("policy_id", "Policy", "select", false, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
      f("name", "Nome", "text", true),
      f("type", "Tipo", "select", true, { options: ["FIRST_RESPONSE", "RESOLUTION", "CUSTOM"] }),
      f("warning_min", "Warning (min)", "number", false),
      f("fail_min", "Fail (min)", "number", false),
      f("is_active", "Ativo", "checkbox", false),
      f("display_order", "Ordem", "number", false),
      f("pause_statuses", "Pause statuses (JSON)", "textarea", false),
      f("start_condition", "Start condition", "text", false),
      f("stop_condition", "Stop condition", "text", false),
    ],
    requiredFields: ["name", "type"],
  }),

  assuntos: page("assuntos", "ServiÃ§o - Assuntos", "/api/service/subjects", {
    columns: [
      col("name", "Nome"),
      col("parent_name", "Pai"),
      col("is_active", "Ativo", "boolean"),
      col("default_sla_policy_name", "SLA padrÃ£o"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("parent_id", "Pai", "select", false, { lookup: lookup("/api/service/subjects", "id", "name") }),
      f("is_active", "Ativo", "checkbox", false),
      f("default_sla_policy_id", "SLA policy default", "select", false, { lookup: lookup("/api/service/sla/policies", "id", "name") }),
      f("description", "DescriÃ§Ã£o", "textarea", false),
    ],
    requiredFields: ["name"],
  }),

  ativos: page("ativos", "ServiÃ§o - Ativos", "/api/service/assets", {
    columns: [
      col("name", "Nome"),
      col("company_name", "Empresa"),
      col("status", "Status"),
      col("asset_tag", "Tag"),
      col("serial_number", "Serial"),
      col("warranty_until", "Garantia atÃ©", "date"),
    ],
    formFields: [
      f("company_id", "Empresa", "select", true, { lookup: lookup("/api/companies?fields=summary", "id", "company_name") }),
      f("name", "Nome", "text", true),
      f("status", "Status", "select", false, { options: ["ACTIVE", "INACTIVE", "MAINTENANCE", "RETIRED"] }),
      f("asset_tag", "Asset tag", "text", false),
      f("serial_number", "Serial", "text", false),
      f("purchase_date", "Compra em", "date", false),
      f("warranty_until", "Garantia atÃ©", "date", false),
      f("notes", "Notas", "textarea", false),
    ],
    requiredFields: ["company_id", "name"],
  }),

  calendarios: page("calendarios", "ServiÃ§o - CalendÃ¡rios", "/api/service/calendars", {
    columns: [
      col("name", "Nome"),
      col("timezone", "Timezone"),
      col("is_default", "PadrÃ£o", "boolean"),
      col("is_active", "Ativo", "boolean"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("timezone", "Timezone", "text", false),
      f("is_default", "PadrÃ£o", "checkbox", false),
      f("is_active", "Ativo", "checkbox", false),
      f("description", "DescriÃ§Ã£o", "textarea", false),
    ],
    requiredFields: ["name"],
    rowActions: [
      { type: "link", label: "Regras", icon: "fa-calendar", href: "/servico/calendarios/regras?calendar_id={id}", className: "btn-default" },
      { type: "link", label: "ExceÃ§Ãµes", icon: "fa-calendar-times-o", href: "/servico/calendarios/excecoes?calendar_id={id}", className: "btn-default" },
    ],
  }),

  calendariosRegras: page("calendarios/regras", "ServiÃ§o - CalendÃ¡rios / Regras", "/api/service/calendars/rules", {
    columns: [
      col("calendar_name", "CalendÃ¡rio"),
      col("day_of_week", "Dia"),
      col("is_working_time", "Working", "boolean"),
      col("start_time", "InÃ­cio"),
      col("end_time", "Fim"),
    ],
    formFields: [
      f("calendar_id", "CalendÃ¡rio", "select", true, { lookup: lookup("/api/service/calendars", "id", "name") }),
      f("day_of_week", "Dia da semana", "select", true, { options: ["0", "1", "2", "3", "4", "5", "6"] }),
      f("working", "Working", "checkbox", false),
      f("start_time", "Start (HH:mm)", "time", false),
      f("end_time", "End (HH:mm)", "time", false),
    ],
    requiredFields: ["calendar_id", "day_of_week"],
  }),

  calendariosExcecoes: page("calendarios/excecoes", "ServiÃ§o - CalendÃ¡rios / ExceÃ§Ãµes", "/api/service/calendars/exceptions", {
    columns: [
      col("calendar_name", "CalendÃ¡rio"),
      col("type", "Tipo"),
      col("date_from", "De", "datetime"),
      col("date_to", "Ate", "datetime"),
      col("notes", "Notas"),
    ],
    formFields: [
      f("calendar_id", "CalendÃ¡rio", "select", true, { lookup: lookup("/api/service/calendars", "id", "name") }),
      f("type", "Tipo", "select", true, { options: ["HOLIDAY", "MAINTENANCE", "SPECIAL_HOURS", "OTHER"] }),
      f("date_from", "De", "datetime-local", true),
      f("date_to", "Ate", "datetime-local", true),
      f("notes", "Notas", "textarea", false),
    ],
    requiredFields: ["calendar_id", "type", "date_from", "date_to"],
  }),

  recursos: page("recursos", "ServiÃ§o - Recursos", "/api/service/resources", {
    columns: [
      col("name", "Nome"),
      col("user_name", "UsuÃ¡rio"),
      col("calendar_name", "CalendÃ¡rio"),
      col("is_active", "Ativo", "boolean"),
      col("capacity_per_day", "Capacidade/dia"),
    ],
    formFields: [
      f("user_id", "UsuÃ¡rio", "select", true, { lookup: lookup("/api/users", "id", "full_name") }),
      f("name", "Nome", "text", true),
      f("calendar_id", "CalendÃ¡rio", "select", false, { lookup: lookup("/api/service/calendars", "id", "name") }),
      f("skills", "Skills (JSON/Tags)", "textarea", false),
      f("capacity_per_day", "Capacidade por dia", "number", false),
      f("is_active", "Ativo", "checkbox", false),
    ],
    requiredFields: ["user_id", "name"],
    rowActions: [
      { type: "link", label: "Agendamentos", icon: "fa-clock-o", href: "/servico/recursos/agendamentos?resource_id={id}", className: "btn-default" },
    ],
  }),

  recursosAgendamentos: page("recursos/agendamentos", "ServiÃ§o - Recursos / Agendamentos", "/api/service/resources/appointments", {
    columns: [
      col("resource_name", "Recurso"),
      col("title", "TÃ­tulo"),
      col("start_at", "InÃ­cio", "datetime"),
      col("end_at", "Fim", "datetime"),
      col("status", "Status"),
      col("incident_title", "Caso"),
    ],
    formFields: [
      f("resource_id", "Recurso", "select", true, { lookup: lookup("/api/service/resources", "id", "name") }),
      f("incident_id", "Caso (opcional)", "select", false, { lookup: lookup("/api/service/incidents", "id", "title") }),
      f("title", "TÃ­tulo", "text", true),
      f("start_at", "InÃ­cio", "datetime-local", true),
      f("end_at", "Fim", "datetime-local", true),
      f("status", "Status", "select", false, { options: ["SCHEDULED", "CONFIRMED", "DONE", "CANCELED"] }),
      f("notes", "Notas", "textarea", false),
    ],
    requiredFields: ["resource_id", "title", "start_at", "end_at"],
  }),

  tarefas: page("tarefas", "ServiÃ§o - Tarefas", "/api/service/tasks", {
    columns: [
      col("title", "TÃ­tulo"),
      col("task_type_name", "Tipo"),
      col("status", "Status"),
      col("priority", "Prioridade"),
      col("assignee_name", "ResponsÃ¡vel"),
      col("due_at", "Vencimento", "datetime"),
      col("incident_title", "Caso"),
    ],
    formFields: [
      f("incident_id", "Caso", "select", true, { lookup: lookup("/api/service/incidents", "id", "title") }),
      f("task_type_id", "Tipo", "select", false, { lookup: lookup("/api/service/tasks/types/all", "id", "name"), onChangeCopyTo: [{ from: "channel", to: "type" }, { from: "default_duration_minutes", to: "estimated_minutes" }] }),
      f("title", "TÃ­tulo", "text", true),
      f("description", "DescriÃ§Ã£o", "textarea", false),
      f("status", "Status", "select", false, { options: ["OPEN", "IN_PROGRESS", "DONE", "CANCELED"] }),
      f("priority", "Prioridade", "select", false, { options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] }),
      f("assigned_to_user_id", "Responsavel", "select", false, { lookup: lookup("/api/users", "id", "full_name") }),
      f("type", "Canal", "select", true, { options: ["MANUAL", "EMAIL", "PHONE", "PORTAL", "WHATSAPP", "OTHER"] }),
      f("estimated_minutes", "Minutos estimados", "number", false),
      f("due_at", "Vencimento", "datetime-local", false),
    ],
    requiredFields: ["incident_id", "title", "type"],
  }),

  tarefasTipos: page("tarefas/tipos", "ServiÃ§o - Tarefas / Tipos", "/api/service/tasks/types", {
    listPath: "/api/service/tasks/types/all",
    columns: [
      col("name", "Nome"),
      col("channel", "Canal"),
      col("default_duration_minutes", "Duracao padrao"),
      col("is_active", "Ativo", "boolean"),
    ],
    formFields: [
      f("name", "Nome", "text", true),
      f("channel", "Canal", "select", false, { options: ["MANUAL", "EMAIL", "PHONE", "PORTAL", "WHATSAPP", "OTHER"] }),
      f("default_duration_minutes", "Duracao padrao (min)", "number", false),
      f("is_active", "Ativo", "checkbox", false),
      f("description", "DescriÃ§Ã£o", "textarea", false),
    ],
    requiredFields: ["name"],
  }),
};

function render(viewName, key) {
  return (req, res) => {
    const config = servicePages[key];
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
  recursos: render("recursos", "recursos"),
  recursosAgendamentos: render("recursos-agendamentos", "recursosAgendamentos"),
  tarefas: render("tarefas", "tarefas"),
  tarefasTipos: render("tarefas-tipos", "tarefasTipos"),
};

