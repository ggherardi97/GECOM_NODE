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

  function boolLabel(value) {
    return value ? tt("page.hr.common.yes", "Sim") : tt("page.hr.common.no", "Nao");
  }

  const resources = {
    departments: {
      apiBase: "/api/hr/departments",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "code", label: "page.hr.fields.code" },
        { key: "manager_name", label: "page.hr.fields.manager" },
        { key: "parent_name", label: "page.hr.fields.parentDepartment" },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "code", label: "page.hr.fields.code", type: "text" },
        { name: "parent_department_id", label: "page.hr.fields.parentDepartment", type: "lookup", lookup: "departments" },
        { name: "manager_employee_id", label: "page.hr.fields.manager", type: "lookup", lookup: "employees" },
        { name: "description", label: "page.hr.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["name", "code"] },
        { id: "structure", label: "page.hr.tabs.structure", fields: ["parent_department_id", "manager_employee_id"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {
        departments: "/api/hr/departments",
        employees: "/api/hr/employees?is_active=true",
      },
    },
    positions: {
      apiBase: "/api/hr/positions",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "code", label: "page.hr.fields.code" },
        { key: "level", label: "page.hr.fields.level" },
        { key: "is_leadership", label: "page.hr.fields.isLeadership", format: boolLabel },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "code", label: "page.hr.fields.code", type: "text" },
        { name: "level", label: "page.hr.fields.level", type: "number", step: "1" },
        { name: "is_leadership", label: "page.hr.fields.isLeadership", type: "checkbox", defaultValue: false },
        { name: "description", label: "page.hr.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["name", "code", "level", "is_leadership"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {},
    },
    workLocations: {
      apiBase: "/api/hr/work-locations",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "code", label: "page.hr.fields.code" },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "code", label: "page.hr.fields.code", type: "text" },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["name", "code"] }],
      lookupSources: {},
    },
    employmentStatuses: {
      apiBase: "/api/hr/employment-statuses",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "code", label: "page.hr.fields.code" },
        { key: "color", label: "page.hr.fields.color" },
        { key: "is_default", label: "page.hr.fields.isDefault", format: boolLabel },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "code", label: "page.hr.fields.code", type: "text", required: true },
        { name: "color", label: "page.hr.fields.color", type: "text" },
        { name: "sort_order", label: "page.hr.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "is_default", label: "page.hr.fields.isDefault", type: "checkbox", defaultValue: false },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["name", "code", "color", "sort_order", "is_default"] }],
      lookupSources: {},
    },
    documentTypes: {
      apiBase: "/api/hr/document-types",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "code", label: "page.hr.fields.code" },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "code", label: "page.hr.fields.code", type: "text", required: true },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["name", "code"] }],
      lookupSources: {},
    },
    maritalStatuses: {
      apiBase: "/api/hr/marital-statuses",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "code", label: "page.hr.fields.code" },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "code", label: "page.hr.fields.code", type: "text", required: true },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["name", "code"] }],
      lookupSources: {},
    },
    employees: {
      apiBase: "/api/hr/employees",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "employee_number", label: "page.hr.fields.employeeNumber" },
        { key: "full_name", label: "page.hr.fields.fullName" },
        { key: "employment_status_name", label: "page.hr.fields.employmentStatus" },
        { key: "email_work", label: "page.hr.fields.workEmail" },
      ],
      formFields: [
        { name: "employee_number", label: "page.hr.fields.employeeNumber", type: "text" },
        { name: "full_name", label: "page.hr.fields.fullName", type: "text", required: true },
        { name: "preferred_name", label: "page.hr.fields.preferredName", type: "text" },
        { name: "employment_status_id", label: "page.hr.fields.employmentStatus", type: "lookup", lookup: "employmentStatuses", required: true },
        { name: "user_id", label: "page.hr.fields.user", type: "lookup", lookup: "users" },
        { name: "email_work", label: "page.hr.fields.workEmail", type: "text" },
        { name: "phone_work", label: "page.hr.fields.workPhone", type: "text" },
        { name: "phone_mobile", label: "page.hr.fields.mobilePhone", type: "text" },
        { name: "birth_date", label: "page.hr.fields.birthDate", type: "date" },
        { name: "gender", label: "page.hr.fields.gender", type: "select", options: ["MALE", "FEMALE", "OTHER"] },
        { name: "marital_status_id", label: "page.hr.fields.maritalStatus", type: "lookup", lookup: "maritalStatuses" },
        { name: "document_type_id", label: "page.hr.fields.documentType", type: "lookup", lookup: "documentTypes" },
        { name: "document_number", label: "page.hr.fields.documentNumber", type: "text" },
        { name: "nationality", label: "page.hr.fields.nationality", type: "text" },
        { name: "notes", label: "page.hr.fields.notes", type: "textarea" },
      ],
      formTabs: [
        { id: "general", label: "page.hr.tabs.general", fields: ["employee_number", "full_name", "preferred_name", "employment_status_id", "user_id"] },
        { id: "contact", label: "page.hr.tabs.contact", fields: ["email_work", "phone_work", "phone_mobile", "birth_date", "gender", "marital_status_id", "document_type_id", "document_number", "nationality"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["notes"] },
      ],
      lookupSources: {
        employmentStatuses: "/api/hr/employment-statuses?is_active=true",
        maritalStatuses: "/api/hr/marital-statuses?is_active=true",
        documentTypes: "/api/hr/document-types?is_active=true",
        users: "/api/users",
      },
    },
    assignments: {
      apiBase: "/api/hr/department-assignments",
      gridColumns: [
        { key: "employee_name", label: "page.hr.fields.employee" },
        { key: "department_name", label: "page.hr.fields.department" },
        { key: "position_name", label: "page.hr.fields.position" },
        { key: "start_date", label: "page.hr.fields.startDate", format: toDateBr },
        { key: "end_date", label: "page.hr.fields.endDate", format: toDateBr },
      ],
      formFields: [
        { name: "employee_id", label: "page.hr.fields.employee", type: "lookup", lookup: "employees", required: true },
        { name: "department_id", label: "page.hr.fields.department", type: "lookup", lookup: "departments", required: true },
        { name: "position_id", label: "page.hr.fields.position", type: "lookup", lookup: "positions", required: true },
        { name: "manager_employee_id", label: "page.hr.fields.manager", type: "lookup", lookup: "employees" },
        { name: "work_location_id", label: "page.hr.fields.workLocation", type: "lookup", lookup: "workLocations" },
        { name: "start_date", label: "page.hr.fields.startDate", type: "date", required: true },
        { name: "end_date", label: "page.hr.fields.endDate", type: "date" },
        { name: "cost_center", label: "page.hr.fields.costCenter", type: "text" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["employee_id", "department_id", "position_id", "start_date", "end_date"] },
        { id: "structure", label: "page.hr.tabs.structure", fields: ["manager_employee_id", "work_location_id", "cost_center"] },
      ],
      lookupSources: {
        employees: "/api/hr/employees?is_active=true",
        departments: "/api/hr/departments?is_active=true",
        positions: "/api/hr/positions?is_active=true",
        workLocations: "/api/hr/work-locations?is_active=true",
      },
    },
    workSchedules: {
      apiBase: "/api/hr/work-schedules",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "weekly_minutes", label: "page.hr.fields.weeklyMinutes" },
        { key: "is_default", label: "page.hr.fields.isDefault", format: boolLabel },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "weekly_minutes", label: "page.hr.fields.weeklyMinutes", type: "number", step: "1" },
        { name: "is_default", label: "page.hr.fields.isDefault", type: "checkbox", defaultValue: false },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["name", "weekly_minutes", "is_default"] }],
      lookupSources: {},
    },
    employeeScheduleAssignments: {
      apiBase: "/api/hr/employee-schedule-assignments",
      gridColumns: [
        { key: "employee_name", label: "page.hr.fields.employee" },
        { key: "work_schedule_name", label: "page.hr.fields.workSchedule" },
        { key: "start_date", label: "page.hr.fields.startDate", format: toDateBr },
        { key: "end_date", label: "page.hr.fields.endDate", format: toDateBr },
      ],
      formFields: [
        { name: "employee_id", label: "page.hr.fields.employee", type: "lookup", lookup: "employees", required: true },
        { name: "work_schedule_id", label: "page.hr.fields.workSchedule", type: "lookup", lookup: "workSchedules", required: true },
        { name: "start_date", label: "page.hr.fields.startDate", type: "date", required: true },
        { name: "end_date", label: "page.hr.fields.endDate", type: "date" },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["employee_id", "work_schedule_id", "start_date", "end_date"] }],
      lookupSources: {
        employees: "/api/hr/employees?is_active=true",
        workSchedules: "/api/hr/work-schedules?is_active=true",
      },
    },
    leaveTypes: {
      apiBase: "/api/hr/leave-types",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "code", label: "page.hr.fields.code" },
        { key: "requires_approval", label: "page.hr.fields.requiresApproval", format: boolLabel },
        { key: "allow_hourly", label: "page.hr.fields.allowHourly", format: boolLabel },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "code", label: "page.hr.fields.code", type: "text", required: true },
        { name: "color", label: "page.hr.fields.color", type: "text" },
        { name: "sort_order", label: "page.hr.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "requires_approval", label: "page.hr.fields.requiresApproval", type: "checkbox", defaultValue: true },
        { name: "is_paid", label: "page.hr.fields.isPaid", type: "checkbox", defaultValue: true },
        { name: "counts_as_vacation", label: "page.hr.fields.countsAsVacation", type: "checkbox", defaultValue: false },
        { name: "allow_hourly", label: "page.hr.fields.allowHourly", type: "checkbox", defaultValue: false },
        { name: "max_days_per_year", label: "page.hr.fields.maxDaysPerYear", type: "number", step: "1" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["name", "code", "color", "sort_order"] },
        { id: "rules", label: "page.hr.tabs.rules", fields: ["requires_approval", "is_paid", "counts_as_vacation", "allow_hourly", "max_days_per_year"] },
      ],
      lookupSources: {},
    },
    leaveRequests: {
      apiBase: "/api/hr/leave-requests",
      gridColumns: [
        { key: "employee_name", label: "page.hr.fields.employee" },
        { key: "leave_type_name", label: "page.hr.fields.leaveType" },
        { key: "start_datetime", label: "page.hr.fields.startDateTime", format: toDateTimeBr },
        { key: "end_datetime", label: "page.hr.fields.endDateTime", format: toDateTimeBr },
        { key: "status", label: "page.hr.fields.status" },
      ],
      formFields: [
        { name: "employee_id", label: "page.hr.fields.employee", type: "lookup", lookup: "employees", required: true },
        { name: "leave_type_id", label: "page.hr.fields.leaveType", type: "lookup", lookup: "leaveTypes", required: true },
        { name: "start_datetime", label: "page.hr.fields.startDateTime", type: "datetime-local", required: true },
        { name: "end_datetime", label: "page.hr.fields.endDateTime", type: "datetime-local", required: true },
        { name: "status", label: "page.hr.fields.status", type: "select", options: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELED"], defaultValue: "DRAFT" },
        { name: "approver_employee_id", label: "page.hr.fields.approver", type: "lookup", lookup: "employees" },
        { name: "reason", label: "page.hr.fields.reason", type: "textarea" },
        { name: "decision_reason", label: "page.hr.fields.decisionReason", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["employee_id", "leave_type_id", "start_datetime", "end_datetime", "status"] },
        { id: "approval", label: "page.hr.tabs.approval", fields: ["approver_employee_id", "decision_reason"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["reason"] },
      ],
      lookupSources: {
        employees: "/api/hr/employees?is_active=true",
        leaveTypes: "/api/hr/leave-types?is_active=true",
      },
    },
    skillCategories: {
      apiBase: "/api/hr/skill-categories",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "sort_order", label: "page.hr.fields.sortOrder" },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "sort_order", label: "page.hr.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["name", "sort_order"] }],
      lookupSources: {},
    },
    skills: {
      apiBase: "/api/hr/skills",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "category_name", label: "page.hr.fields.skillCategory" },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "category_id", label: "page.hr.fields.skillCategory", type: "lookup", lookup: "skillCategories" },
        { name: "description", label: "page.hr.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["name", "category_id"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {
        skillCategories: "/api/hr/skill-categories?is_active=true",
      },
    },
    employeeSkills: {
      apiBase: "/api/hr/employee-skills",
      gridColumns: [
        { key: "employee_name", label: "page.hr.fields.employee" },
        { key: "skill_name", label: "page.hr.fields.skill" },
        { key: "proficiency_level", label: "page.hr.fields.proficiencyLevel" },
        { key: "years_experience", label: "page.hr.fields.yearsExperience" },
      ],
      formFields: [
        { name: "employee_id", label: "page.hr.fields.employee", type: "lookup", lookup: "employees", required: true },
        { name: "skill_id", label: "page.hr.fields.skill", type: "lookup", lookup: "skills", required: true },
        { name: "proficiency_level", label: "page.hr.fields.proficiencyLevel", type: "select", options: ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"], defaultValue: "BEGINNER" },
        { name: "years_experience", label: "page.hr.fields.yearsExperience", type: "number", step: "1" },
        { name: "notes", label: "page.hr.fields.notes", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["employee_id", "skill_id", "proficiency_level", "years_experience"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["notes"] },
      ],
      lookupSources: {
        employees: "/api/hr/employees?is_active=true",
        skills: "/api/hr/skills?is_active=true",
      },
    },
    certifications: {
      apiBase: "/api/hr/certifications",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "issuer", label: "page.hr.fields.issuer" },
        { key: "validity_months", label: "page.hr.fields.validityMonths" },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "issuer", label: "page.hr.fields.issuer", type: "text" },
        { name: "validity_months", label: "page.hr.fields.validityMonths", type: "number", step: "1" },
        { name: "description", label: "page.hr.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["name", "issuer", "validity_months"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {},
    },
    employeeCertifications: {
      apiBase: "/api/hr/employee-certifications",
      gridColumns: [
        { key: "employee_name", label: "page.hr.fields.employee" },
        { key: "certification_name", label: "page.hr.fields.certification" },
        { key: "expires_at", label: "page.hr.fields.expiresAt", format: toDateBr },
        { key: "status", label: "page.hr.fields.status" },
      ],
      formFields: [
        { name: "employee_id", label: "page.hr.fields.employee", type: "lookup", lookup: "employees", required: true },
        { name: "certification_id", label: "page.hr.fields.certification", type: "lookup", lookup: "certifications", required: true },
        { name: "issued_at", label: "page.hr.fields.issuedAt", type: "date" },
        { name: "expires_at", label: "page.hr.fields.expiresAt", type: "date" },
        { name: "certificate_number", label: "page.hr.fields.certificateNumber", type: "text" },
        { name: "status", label: "page.hr.fields.status", type: "select", options: ["VALID", "EXPIRED", "REVOKED"], defaultValue: "VALID" },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["employee_id", "certification_id", "issued_at", "expires_at", "certificate_number", "status"] }],
      lookupSources: {
        employees: "/api/hr/employees?is_active=true",
        certifications: "/api/hr/certifications?is_active=true",
      },
    },
    lifecycleTemplates: {
      apiBase: "/api/hr/lifecycle/templates",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.hr.fields.name" },
        { key: "type", label: "page.hr.fields.type" },
        { key: "description", label: "page.hr.fields.description" },
      ],
      formFields: [
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "type", label: "page.hr.fields.type", type: "select", options: ["ONBOARDING", "OFFBOARDING"], required: true },
        { name: "description", label: "page.hr.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["name", "type"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {},
    },
    lifecycleStages: {
      apiBase: "/api/hr/lifecycle/stages",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "template_name", label: "page.hr.fields.lifecycleTemplate" },
        { key: "name", label: "page.hr.fields.name" },
        { key: "sort_order", label: "page.hr.fields.sortOrder" },
      ],
      formFields: [
        { name: "template_id", label: "page.hr.fields.lifecycleTemplate", type: "lookup", lookup: "lifecycleTemplates", required: true },
        { name: "name", label: "page.hr.fields.name", type: "text", required: true },
        { name: "sort_order", label: "page.hr.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "wip_limit", label: "page.hr.fields.wipLimit", type: "number", step: "1" },
        { name: "color", label: "page.hr.fields.color", type: "text" },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["template_id", "name", "sort_order", "wip_limit", "color"] }],
      lookupSources: {
        lifecycleTemplates: "/api/hr/lifecycle/templates?is_active=true",
      },
    },
    lifecycleTasks: {
      apiBase: "/api/hr/lifecycle/tasks",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "template_name", label: "page.hr.fields.lifecycleTemplate" },
        { key: "title", label: "page.hr.fields.title" },
        { key: "responsible_role", label: "page.hr.fields.responsibleRole" },
        { key: "stage_name", label: "page.hr.fields.stage" },
      ],
      formFields: [
        { name: "template_id", label: "page.hr.fields.lifecycleTemplate", type: "lookup", lookup: "lifecycleTemplates", required: true },
        { name: "stage_id", label: "page.hr.fields.stage", type: "lookup", lookup: "lifecycleStages" },
        { name: "title", label: "page.hr.fields.title", type: "text", required: true },
        { name: "responsible_role", label: "page.hr.fields.responsibleRole", type: "select", options: ["HR", "MANAGER", "IT", "FINANCE", "EMPLOYEE"], defaultValue: "HR" },
        { name: "due_days_after_start", label: "page.hr.fields.dueDaysAfterStart", type: "number", step: "1" },
        { name: "requires_attachment", label: "page.hr.fields.requiresAttachment", type: "checkbox", defaultValue: false },
        { name: "is_mandatory", label: "page.hr.fields.isMandatory", type: "checkbox", defaultValue: true },
        { name: "sort_order", label: "page.hr.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "description", label: "page.hr.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["template_id", "stage_id", "title", "responsible_role", "due_days_after_start", "sort_order"] },
        { id: "rules", label: "page.hr.tabs.rules", fields: ["requires_attachment", "is_mandatory"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {
        lifecycleTemplates: "/api/hr/lifecycle/templates?is_active=true",
        lifecycleStages: "/api/hr/lifecycle/stages?is_active=true",
      },
    },
    employeeLifecycles: {
      apiBase: "/api/hr/lifecycle/employee-lifecycles",
      gridColumns: [
        { key: "employee_name", label: "page.hr.fields.employee" },
        { key: "template_name", label: "page.hr.fields.lifecycleTemplate" },
        { key: "start_date", label: "page.hr.fields.startDate", format: toDateBr },
        { key: "status", label: "page.hr.fields.status" },
      ],
      formFields: [
        { name: "employee_id", label: "page.hr.fields.employee", type: "lookup", lookup: "employees", required: true },
        { name: "template_id", label: "page.hr.fields.lifecycleTemplate", type: "lookup", lookup: "lifecycleTemplates", required: true },
        { name: "start_date", label: "page.hr.fields.startDate", type: "date", required: true },
        { name: "target_end_date", label: "page.hr.fields.targetEndDate", type: "date" },
        { name: "status", label: "page.hr.fields.status", type: "select", options: ["ACTIVE", "COMPLETED", "CANCELED"], defaultValue: "ACTIVE" },
        { name: "current_stage_id", label: "page.hr.fields.stage", type: "lookup", lookup: "lifecycleStages" },
      ],
      formTabs: [{ id: "basic", label: "page.hr.tabs.basic", fields: ["employee_id", "template_id", "start_date", "target_end_date", "status", "current_stage_id"] }],
      lookupSources: {
        employees: "/api/hr/employees?is_active=true",
        lifecycleTemplates: "/api/hr/lifecycle/templates?is_active=true",
        lifecycleStages: "/api/hr/lifecycle/stages?is_active=true",
      },
    },
    employeeLifecycleTasks: {
      apiBase: "/api/hr/lifecycle/employee-lifecycle-tasks",
      gridColumns: [
        { key: "employee_lifecycle_id", label: "page.hr.fields.lifecycleInstance" },
        { key: "title", label: "page.hr.fields.title" },
        { key: "stage_name", label: "page.hr.fields.stage" },
        { key: "status", label: "page.hr.fields.status" },
        { key: "due_date", label: "page.hr.fields.dueDate", format: toDateBr },
      ],
      formFields: [
        { name: "employee_lifecycle_id", label: "page.hr.fields.lifecycleInstance", type: "lookup", lookup: "employeeLifecycles", required: true },
        { name: "template_task_id", label: "page.hr.fields.templateTask", type: "lookup", lookup: "lifecycleTasks" },
        { name: "stage_id", label: "page.hr.fields.stage", type: "lookup", lookup: "lifecycleStages" },
        { name: "title", label: "page.hr.fields.title", type: "text", required: true },
        { name: "responsible_employee_id", label: "page.hr.fields.responsibleEmployee", type: "lookup", lookup: "employees" },
        { name: "due_date", label: "page.hr.fields.dueDate", type: "date" },
        { name: "status", label: "page.hr.fields.status", type: "select", options: ["OPEN", "DOING", "DONE", "BLOCKED", "CANCELED"], defaultValue: "OPEN" },
        { name: "sort_order", label: "page.hr.fields.sortOrder", type: "number", step: "1", defaultValue: 0 },
        { name: "notes", label: "page.hr.fields.notes", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.hr.tabs.basic", fields: ["employee_lifecycle_id", "template_task_id", "stage_id", "title", "responsible_employee_id", "due_date", "status", "sort_order"] },
        { id: "notes", label: "page.hr.tabs.notes", fields: ["notes"] },
      ],
      lookupSources: {
        employeeLifecycles: "/api/hr/lifecycle/employee-lifecycles",
        lifecycleTasks: "/api/hr/lifecycle/tasks?is_active=true",
        lifecycleStages: "/api/hr/lifecycle/stages?is_active=true",
        employees: "/api/hr/employees?is_active=true",
      },
    },
  };

  global.HrResources = {
    resources,
    tt,
    waitForI18nReady,
    esc,
    normalizeArray,
    toDateBr,
    toDateTimeBr,
    boolLabel,
  };
})(window);
