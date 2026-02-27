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

  function tt(key, fallback) {
    try {
      if (global.t) return global.t(key, { defaultValue: fallback });
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

  function toDateBr(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleDateString("pt-BR");
  }

  function toDateTimeBr(value) {
    if (!value) return "-";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "-";
    return d.toLocaleString("pt-BR");
  }

  function toMoney(value) {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return "0,00";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function boolLabel(value) {
    return value ? tt("page.po.common.yes", "Sim") : tt("page.po.common.no", "Nao");
  }

  const resources = {
    projectStatuses: {
      apiBase: "/api/project-operations/project-statuses",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.po.fields.name" },
        { key: "code", label: "page.po.fields.code" },
        { key: "color", label: "page.po.fields.color" },
        { key: "is_default", label: "page.po.fields.isDefault", format: boolLabel },
      ],
      formFields: [
        { name: "name", label: "page.po.fields.name", type: "text", required: true },
        { name: "code", label: "page.po.fields.code", type: "text", required: true },
        { name: "color", label: "page.po.fields.color", type: "text" },
        { name: "sort_order", label: "page.po.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "is_default", label: "page.po.fields.isDefault", type: "checkbox", defaultValue: false },
      ],
      formTabs: [{ id: "basic", label: "page.po.tabs.basic", fields: ["name", "code", "color", "sort_order", "is_default"] }],
      lookupSources: {},
    },
    deliverableStatuses: {
      apiBase: "/api/project-operations/deliverable-statuses",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.po.fields.name" },
        { key: "code", label: "page.po.fields.code" },
        { key: "color", label: "page.po.fields.color" },
        { key: "is_default", label: "page.po.fields.isDefault", format: boolLabel },
      ],
      formFields: [
        { name: "name", label: "page.po.fields.name", type: "text", required: true },
        { name: "code", label: "page.po.fields.code", type: "text", required: true },
        { name: "color", label: "page.po.fields.color", type: "text" },
        { name: "sort_order", label: "page.po.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "is_default", label: "page.po.fields.isDefault", type: "checkbox", defaultValue: false },
      ],
      formTabs: [{ id: "basic", label: "page.po.tabs.basic", fields: ["name", "code", "color", "sort_order", "is_default"] }],
      lookupSources: {},
    },
    workOrderStatuses: {
      apiBase: "/api/project-operations/work-order-statuses",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.po.fields.name" },
        { key: "code", label: "page.po.fields.code" },
        { key: "color", label: "page.po.fields.color" },
        { key: "is_default", label: "page.po.fields.isDefault", format: boolLabel },
      ],
      formFields: [
        { name: "name", label: "page.po.fields.name", type: "text", required: true },
        { name: "code", label: "page.po.fields.code", type: "text", required: true },
        { name: "color", label: "page.po.fields.color", type: "text" },
        { name: "sort_order", label: "page.po.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "is_default", label: "page.po.fields.isDefault", type: "checkbox", defaultValue: false },
      ],
      formTabs: [{ id: "basic", label: "page.po.tabs.basic", fields: ["name", "code", "color", "sort_order", "is_default"] }],
      lookupSources: {},
    },
    resourceRoles: {
      apiBase: "/api/project-operations/resource-roles",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.po.fields.name" },
        { key: "code", label: "page.po.fields.code" },
        { key: "description", label: "page.po.fields.description" },
      ],
      formFields: [
        { name: "name", label: "page.po.fields.name", type: "text", required: true },
        { name: "code", label: "page.po.fields.code", type: "text" },
        { name: "description", label: "page.po.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.po.tabs.basic", fields: ["name", "code"] },
        { id: "notes", label: "page.po.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {},
    },
    projects: {
      apiBase: "/api/project-operations/projects",
      gridColumns: [
        { key: "code", label: "page.po.fields.code" },
        { key: "name", label: "page.po.fields.name" },
        { key: "status_name", label: "page.po.fields.status" },
        { key: "owner_user_name", label: "page.po.fields.owner" },
        { key: "target_end_date", label: "page.po.fields.targetEndDate", format: toDateBr },
      ],
      formFields: [
        { name: "code", label: "page.po.fields.code", type: "text" },
        { name: "name", label: "page.po.fields.name", type: "text", required: true },
        { name: "status_id", label: "page.po.fields.status", type: "lookup", lookup: "projectStatuses" },
        { name: "owner_user_id", label: "page.po.fields.owner", type: "lookup", lookup: "users" },
        { name: "company_id", label: "page.po.fields.company", type: "lookup", lookup: "companies" },
        { name: "start_date", label: "page.po.fields.startDate", type: "date" },
        { name: "target_end_date", label: "page.po.fields.targetEndDate", type: "date" },
        { name: "actual_end_date", label: "page.po.fields.actualEndDate", type: "date" },
        { name: "description", label: "page.po.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "general", label: "page.po.tabs.general", fields: ["code", "name", "status_id", "owner_user_id"] },
        { id: "planning", label: "page.po.tabs.planning", fields: ["company_id", "start_date", "target_end_date", "actual_end_date"] },
        { id: "notes", label: "page.po.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {
        projectStatuses: "/api/project-operations/project-statuses?is_active=true",
        users: "/api/users",
        companies: "/api/companies",
      },
    },
    projectProcesses: {
      apiBase: "/api/project-operations/project-processes",
      gridColumns: [
        { key: "project_name", label: "page.po.fields.project" },
        { key: "process_number", label: "page.po.fields.process" },
        { key: "sort_order", label: "page.po.fields.sortOrder" },
      ],
      formFields: [
        { name: "project_id", label: "page.po.fields.project", type: "lookup", lookup: "projects", required: true },
        { name: "process_id", label: "page.po.fields.process", type: "lookup", lookup: "processes", required: true },
        { name: "sort_order", label: "page.po.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
      ],
      formTabs: [{ id: "basic", label: "page.po.tabs.basic", fields: ["project_id", "process_id", "sort_order"] }],
      lookupSources: {
        projects: "/api/project-operations/projects",
        processes: "/api/processes",
      },
    },
    milestones: {
      apiBase: "/api/project-operations/milestones",
      gridColumns: [
        { key: "process_number", label: "page.po.fields.process" },
        { key: "title", label: "page.po.fields.title" },
        { key: "due_date", label: "page.po.fields.dueDate", format: toDateBr },
        { key: "status", label: "page.po.fields.status" },
      ],
      formFields: [
        { name: "process_id", label: "page.po.fields.process", type: "lookup", lookup: "processes", required: true },
        { name: "title", label: "page.po.fields.title", type: "text", required: true },
        { name: "status", label: "page.po.fields.status", type: "select", options: ["PLANNED", "DONE", "CANCELED"], defaultValue: "PLANNED" },
        { name: "due_date", label: "page.po.fields.dueDate", type: "date" },
        { name: "sort_order", label: "page.po.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "description", label: "page.po.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.po.tabs.basic", fields: ["process_id", "title", "status", "due_date", "sort_order"] },
        { id: "notes", label: "page.po.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {
        processes: "/api/processes",
      },
    },
    deliverables: {
      apiBase: "/api/project-operations/deliverables",
      gridColumns: [
        { key: "process_number", label: "page.po.fields.process" },
        { key: "title", label: "page.po.fields.title" },
        { key: "due_date", label: "page.po.fields.dueDate", format: toDateBr },
        { key: "value_amount", label: "page.po.fields.valueAmount", format: toMoney },
        { key: "status_name", label: "page.po.fields.status" },
      ],
      formFields: [
        { name: "process_id", label: "page.po.fields.process", type: "lookup", lookup: "processes", required: true },
        { name: "title", label: "page.po.fields.title", type: "text", required: true },
        { name: "status_id", label: "page.po.fields.status", type: "lookup", lookup: "deliverableStatuses" },
        { name: "due_date", label: "page.po.fields.dueDate", type: "date" },
        { name: "value_amount", label: "page.po.fields.valueAmount", type: "number", step: "0.01" },
        { name: "currency_id", label: "page.po.fields.currency", type: "lookup", lookup: "currencies" },
        { name: "description", label: "page.po.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.po.tabs.basic", fields: ["process_id", "title", "status_id", "due_date"] },
        { id: "amounts", label: "page.po.tabs.amounts", fields: ["value_amount", "currency_id"] },
        { id: "notes", label: "page.po.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {
        processes: "/api/processes",
        deliverableStatuses: "/api/project-operations/deliverable-statuses?is_active=true",
        currencies: "/api/currencies?is_active=true",
      },
    },
    checklists: {
      apiBase: "/api/project-operations/checklists",
      gridColumns: [
        { key: "process_number", label: "page.po.fields.process" },
        { key: "name", label: "page.po.fields.name" },
        { key: "items_count", label: "page.po.fields.itemsCount" },
      ],
      formFields: [
        { name: "process_id", label: "page.po.fields.process", type: "lookup", lookup: "processes", required: true },
        { name: "name", label: "page.po.fields.name", type: "text", required: true },
      ],
      formTabs: [{ id: "basic", label: "page.po.tabs.basic", fields: ["process_id", "name"] }],
      lookupSources: {
        processes: "/api/processes",
      },
    },
    checklistItems: {
      apiBase: "/api/project-operations/checklist-items",
      gridColumns: [
        { key: "checklist_name", label: "page.po.fields.checklist" },
        { key: "title", label: "page.po.fields.title" },
        { key: "status", label: "page.po.fields.status" },
        { key: "assigned_user_name", label: "page.po.fields.assignedUser" },
        { key: "due_date", label: "page.po.fields.dueDate", format: toDateBr },
      ],
      formFields: [
        { name: "checklist_id", label: "page.po.fields.checklist", type: "lookup", lookup: "checklists", required: true },
        { name: "title", label: "page.po.fields.title", type: "text", required: true },
        { name: "status", label: "page.po.fields.status", type: "select", options: ["OPEN", "DONE", "BLOCKED"], defaultValue: "OPEN" },
        { name: "is_required", label: "page.po.fields.isRequired", type: "checkbox", defaultValue: true },
        { name: "assigned_user_id", label: "page.po.fields.assignedUser", type: "lookup", lookup: "users" },
        { name: "due_date", label: "page.po.fields.dueDate", type: "date" },
        { name: "sort_order", label: "page.po.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
      ],
      formTabs: [
        { id: "basic", label: "page.po.tabs.basic", fields: ["checklist_id", "title", "status", "is_required"] },
        { id: "assignment", label: "page.po.tabs.assignment", fields: ["assigned_user_id", "due_date", "sort_order"] },
      ],
      lookupSources: {
        checklists: "/api/project-operations/checklists",
        users: "/api/users",
      },
    },
    workOrders: {
      apiBase: "/api/project-operations/work-orders",
      gridColumns: [
        { key: "code", label: "page.po.fields.code" },
        { key: "title", label: "page.po.fields.title" },
        { key: "project_name", label: "page.po.fields.project" },
        { key: "process_number", label: "page.po.fields.process" },
        { key: "priority", label: "page.po.fields.priority" },
        { key: "status_name", label: "page.po.fields.status" },
      ],
      formFields: [
        { name: "code", label: "page.po.fields.code", type: "text" },
        { name: "title", label: "page.po.fields.title", type: "text", required: true },
        { name: "priority", label: "page.po.fields.priority", type: "select", options: ["LOW", "MEDIUM", "HIGH"], defaultValue: "MEDIUM" },
        { name: "status_id", label: "page.po.fields.status", type: "lookup", lookup: "workOrderStatuses" },
        { name: "owner_user_id", label: "page.po.fields.owner", type: "lookup", lookup: "users" },
        { name: "project_id", label: "page.po.fields.project", type: "lookup", lookup: "projects" },
        { name: "process_id", label: "page.po.fields.process", type: "lookup", lookup: "processes" },
        { name: "planned_start", label: "page.po.fields.plannedStart", type: "datetime-local" },
        { name: "planned_end", label: "page.po.fields.plannedEnd", type: "datetime-local" },
        { name: "actual_start", label: "page.po.fields.actualStart", type: "datetime-local" },
        { name: "actual_end", label: "page.po.fields.actualEnd", type: "datetime-local" },
        { name: "estimated_hours", label: "page.po.fields.estimatedHours", type: "number", step: "0.01" },
        { name: "description", label: "page.po.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "general", label: "page.po.tabs.general", fields: ["code", "title", "priority", "status_id", "owner_user_id"] },
        { id: "links", label: "page.po.tabs.links", fields: ["project_id", "process_id"] },
        { id: "planning", label: "page.po.tabs.planning", fields: ["planned_start", "planned_end", "actual_start", "actual_end", "estimated_hours", "description"] },
      ],
      lookupSources: {
        workOrderStatuses: "/api/project-operations/work-order-statuses?is_active=true",
        users: "/api/users",
        projects: "/api/project-operations/projects",
        processes: "/api/processes",
      },
    },
    workOrderAssignments: {
      apiBase: "/api/project-operations/work-order-assignments",
      gridColumns: [
        { key: "work_order_code", label: "page.po.fields.workOrder" },
        { key: "resource_name", label: "page.po.fields.resource" },
        { key: "role_name", label: "page.po.fields.role" },
        { key: "allocation_percent", label: "page.po.fields.allocationPercent" },
        { key: "planned_hours", label: "page.po.fields.plannedHours", format: toMoney },
      ],
      formFields: [
        { name: "work_order_id", label: "page.po.fields.workOrder", type: "lookup", lookup: "workOrders", required: true },
        { name: "resource_id", label: "page.po.fields.resource", type: "lookup", lookup: "resources", required: true },
        { name: "role_id", label: "page.po.fields.role", type: "lookup", lookup: "resourceRoles" },
        { name: "allocation_percent", label: "page.po.fields.allocationPercent", type: "number", step: "1" },
        { name: "planned_hours", label: "page.po.fields.plannedHours", type: "number", step: "0.01" },
      ],
      formTabs: [
        { id: "basic", label: "page.po.tabs.basic", fields: ["work_order_id", "resource_id", "role_id"] },
        { id: "planning", label: "page.po.tabs.planning", fields: ["allocation_percent", "planned_hours"] },
      ],
      lookupSources: {
        workOrders: "/api/project-operations/work-orders",
        resources: "/api/service/resources?is_active=true",
        resourceRoles: "/api/project-operations/resource-roles?is_active=true",
      },
    },
    workOrderAppointments: {
      apiBase: "/api/project-operations/work-order-appointments",
      gridColumns: [
        { key: "work_order_code", label: "page.po.fields.workOrder" },
        { key: "appointment_title", label: "page.po.fields.appointment" },
        { key: "resource_name", label: "page.po.fields.resource" },
        { key: "appointment_start_at", label: "page.po.fields.startDateTime", format: toDateTimeBr },
        { key: "appointment_status", label: "page.po.fields.status" },
      ],
      formFields: [
        { name: "work_order_id", label: "page.po.fields.workOrder", type: "lookup", lookup: "workOrders", required: true },
        { name: "appointment_id", label: "page.po.fields.appointment", type: "lookup", lookup: "appointments", required: true },
      ],
      formTabs: [{ id: "basic", label: "page.po.tabs.basic", fields: ["work_order_id", "appointment_id"] }],
      lookupSources: {
        workOrders: "/api/project-operations/work-orders",
        appointments: "/api/service/resources/appointments",
      },
    },
  };

  global.PoResources = {
    resources,
    tt,
    waitForI18nReady,
    esc,
    normalizeArray,
    toDateBr,
    toDateTimeBr,
    toMoney,
    boolLabel,
  };
})(window);
