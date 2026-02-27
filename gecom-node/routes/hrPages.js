const express = require("express");

const router = express.Router();

const resources = {
  departments: {
    key: "departments",
    resource: "departments",
    gridPath: "/HRDepartments",
    formPath: "/NewHRDepartment",
    entityName: "hr_departments",
    titleKey: "page.hr.departments.title",
  },
  positions: {
    key: "positions",
    resource: "positions",
    gridPath: "/HRPositions",
    formPath: "/NewHRPosition",
    entityName: "hr_positions",
    titleKey: "page.hr.positions.title",
  },
  workLocations: {
    key: "workLocations",
    resource: "work-locations",
    gridPath: "/HRWorkLocations",
    formPath: "/NewHRWorkLocation",
    entityName: "hr_work_locations",
    titleKey: "page.hr.workLocations.title",
  },
  employmentStatuses: {
    key: "employmentStatuses",
    resource: "employment-statuses",
    gridPath: "/HREmploymentStatuses",
    formPath: "/NewHREmploymentStatus",
    entityName: "hr_employment_statuses",
    titleKey: "page.hr.employmentStatuses.title",
  },
  documentTypes: {
    key: "documentTypes",
    resource: "document-types",
    gridPath: "/HRDocumentTypes",
    formPath: "/NewHRDocumentType",
    entityName: "hr_document_types",
    titleKey: "page.hr.documentTypes.title",
  },
  maritalStatuses: {
    key: "maritalStatuses",
    resource: "marital-statuses",
    gridPath: "/HRMaritalStatuses",
    formPath: "/NewHRMaritalStatus",
    entityName: "hr_marital_statuses",
    titleKey: "page.hr.maritalStatuses.title",
  },
  employees: {
    key: "employees",
    resource: "employees",
    gridPath: "/HREmployees",
    formPath: "/NewHREmployee",
    entityName: "hr_employees",
    titleKey: "page.hr.employees.title",
  },
  assignments: {
    key: "assignments",
    resource: "department-assignments",
    gridPath: "/HRAssignments",
    formPath: "/NewHRAssignment",
    entityName: "hr_department_assignments",
    titleKey: "page.hr.assignments.title",
  },
  workSchedules: {
    key: "workSchedules",
    resource: "work-schedules",
    gridPath: "/HRWorkSchedules",
    formPath: "/NewHRWorkSchedule",
    entityName: "hr_work_schedules",
    titleKey: "page.hr.workSchedules.title",
  },
  employeeScheduleAssignments: {
    key: "employeeScheduleAssignments",
    resource: "employee-schedule-assignments",
    gridPath: "/HREmployeeScheduleAssignments",
    formPath: "/NewHREmployeeScheduleAssignment",
    entityName: "hr_employee_schedule_assignments",
    titleKey: "page.hr.employeeScheduleAssignments.title",
  },
  leaveTypes: {
    key: "leaveTypes",
    resource: "leave-types",
    gridPath: "/HRLeaveTypes",
    formPath: "/NewHRLeaveType",
    entityName: "hr_leave_types",
    titleKey: "page.hr.leaveTypes.title",
  },
  leaveRequests: {
    key: "leaveRequests",
    resource: "leave-requests",
    gridPath: "/HRLeaveRequests",
    formPath: "/NewHRLeaveRequest",
    entityName: "hr_leave_requests",
    titleKey: "page.hr.leaveRequests.title",
  },
  skillCategories: {
    key: "skillCategories",
    resource: "skill-categories",
    gridPath: "/HRSkillCategories",
    formPath: "/NewHRSkillCategory",
    entityName: "hr_skill_categories",
    titleKey: "page.hr.skillCategories.title",
  },
  skills: {
    key: "skills",
    resource: "skills",
    gridPath: "/HRSkills",
    formPath: "/NewHRSkill",
    entityName: "hr_skills",
    titleKey: "page.hr.skills.title",
  },
  employeeSkills: {
    key: "employeeSkills",
    resource: "employee-skills",
    gridPath: "/HREmployeeSkills",
    formPath: "/NewHREmployeeSkill",
    entityName: "hr_employee_skills",
    titleKey: "page.hr.employeeSkills.title",
  },
  certifications: {
    key: "certifications",
    resource: "certifications",
    gridPath: "/HRCertifications",
    formPath: "/NewHRCertification",
    entityName: "hr_certifications",
    titleKey: "page.hr.certifications.title",
  },
  employeeCertifications: {
    key: "employeeCertifications",
    resource: "employee-certifications",
    gridPath: "/HREmployeeCertifications",
    formPath: "/NewHREmployeeCertification",
    entityName: "hr_employee_certifications",
    titleKey: "page.hr.employeeCertifications.title",
  },
  lifecycleTemplates: {
    key: "lifecycleTemplates",
    resource: "lifecycle/templates",
    gridPath: "/HRLifecycleTemplates",
    formPath: "/NewHRLifecycleTemplate",
    entityName: "hr_lifecycle_templates",
    titleKey: "page.hr.lifecycleTemplates.title",
  },
  lifecycleStages: {
    key: "lifecycleStages",
    resource: "lifecycle/stages",
    gridPath: "/HRLifecycleStages",
    formPath: "/NewHRLifecycleStage",
    entityName: "hr_lifecycle_stages",
    titleKey: "page.hr.lifecycleStages.title",
  },
  lifecycleTasks: {
    key: "lifecycleTasks",
    resource: "lifecycle/tasks",
    gridPath: "/HRLifecycleTasks",
    formPath: "/NewHRLifecycleTask",
    entityName: "hr_lifecycle_tasks",
    titleKey: "page.hr.lifecycleTasks.title",
  },
  employeeLifecycles: {
    key: "employeeLifecycles",
    resource: "lifecycle/employee-lifecycles",
    gridPath: "/HREmployeeLifecycles",
    formPath: "/NewHREmployeeLifecycle",
    entityName: "hr_employee_lifecycles",
    titleKey: "page.hr.employeeLifecycles.title",
  },
  employeeLifecycleTasks: {
    key: "employeeLifecycleTasks",
    resource: "lifecycle/employee-lifecycle-tasks",
    gridPath: "/HREmployeeLifecycleTasks",
    formPath: "/NewHREmployeeLifecycleTask",
    entityName: "hr_employee_lifecycle_tasks",
    titleKey: "page.hr.employeeLifecycleTasks.title",
  },
};

function renderGrid(res, config) {
  return res.render("hr/HrGrid", { hrPage: config });
}

function renderForm(res, config) {
  return res.render("hr/HrForm", { hrPage: config });
}

Object.values(resources).forEach((config) => {
  router.get([config.gridPath, `/hr/${config.resource}`], (req, res) => renderGrid(res, config));
  router.get([config.formPath, `/hr/${config.resource}/new`], (req, res) => renderForm(res, config));
  router.get(`/hr/${config.resource}/:id/edit`, (req, res) =>
    res.redirect(`${config.formPath}?id=${encodeURIComponent(String(req.params.id || ""))}`),
  );
});

router.get(["/HRLifecycleKanban", "/hr/lifecycle/kanban"], (req, res) => res.render("hr/HrLifecycleKanban"));

module.exports = router;
