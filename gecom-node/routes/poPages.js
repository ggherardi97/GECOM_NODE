const express = require("express");

const router = express.Router();

const resources = {
  projectStatuses: {
    key: "projectStatuses",
    resource: "project-statuses",
    gridPath: "/POProjectStatuses",
    formPath: "/NewPOProjectStatus",
    entityName: "po_project_statuses",
    titleKey: "page.po.projectStatuses.title",
  },
  deliverableStatuses: {
    key: "deliverableStatuses",
    resource: "deliverable-statuses",
    gridPath: "/PODeliverableStatuses",
    formPath: "/NewPODeliverableStatus",
    entityName: "po_deliverable_statuses",
    titleKey: "page.po.deliverableStatuses.title",
  },
  workOrderStatuses: {
    key: "workOrderStatuses",
    resource: "work-order-statuses",
    gridPath: "/POWorkOrderStatuses",
    formPath: "/NewPOWorkOrderStatus",
    entityName: "po_work_order_statuses",
    titleKey: "page.po.workOrderStatuses.title",
  },
  resourceRoles: {
    key: "resourceRoles",
    resource: "resource-roles",
    gridPath: "/POResourceRoles",
    formPath: "/NewPOResourceRole",
    entityName: "po_resource_roles",
    titleKey: "page.po.resourceRoles.title",
  },
  projects: {
    key: "projects",
    resource: "projects",
    gridPath: "/POProjects",
    formPath: "/NewPOProject",
    entityName: "po_projects",
    titleKey: "page.po.projects.title",
  },
  projectProcesses: {
    key: "projectProcesses",
    resource: "project-processes",
    gridPath: "/POProjectProcesses",
    formPath: "/NewPOProjectProcess",
    entityName: "po_project_processes",
    titleKey: "page.po.projectProcesses.title",
  },
  milestones: {
    key: "milestones",
    resource: "milestones",
    gridPath: "/POMilestones",
    formPath: "/NewPOMilestone",
    entityName: "po_milestones",
    titleKey: "page.po.milestones.title",
  },
  deliverables: {
    key: "deliverables",
    resource: "deliverables",
    gridPath: "/PODeliverables",
    formPath: "/NewPODeliverable",
    entityName: "po_deliverables",
    titleKey: "page.po.deliverables.title",
  },
  checklists: {
    key: "checklists",
    resource: "checklists",
    gridPath: "/POChecklists",
    formPath: "/NewPOChecklist",
    entityName: "po_checklists",
    titleKey: "page.po.checklists.title",
  },
  checklistItems: {
    key: "checklistItems",
    resource: "checklist-items",
    gridPath: "/POChecklistItems",
    formPath: "/NewPOChecklistItem",
    entityName: "po_checklist_items",
    titleKey: "page.po.checklistItems.title",
  },
  workOrders: {
    key: "workOrders",
    resource: "work-orders",
    gridPath: "/POWorkOrders",
    formPath: "/NewPOWorkOrder",
    entityName: "po_work_orders",
    titleKey: "page.po.workOrders.title",
  },
  workOrderAssignments: {
    key: "workOrderAssignments",
    resource: "work-order-assignments",
    gridPath: "/POWorkOrderAssignments",
    formPath: "/NewPOWorkOrderAssignment",
    entityName: "po_work_order_assignments",
    titleKey: "page.po.workOrderAssignments.title",
  },
  workOrderAppointments: {
    key: "workOrderAppointments",
    resource: "work-order-appointments",
    gridPath: "/POWorkOrderAppointments",
    formPath: "/NewPOWorkOrderAppointment",
    entityName: "po_work_order_appointments",
    titleKey: "page.po.workOrderAppointments.title",
  },
};

function renderGrid(res, config) {
  return res.render("po/PoGrid", { poPage: config });
}

function renderForm(res, config) {
  return res.render("po/PoForm", { poPage: config });
}

Object.values(resources).forEach((config) => {
  router.get([config.gridPath, `/project-operations/${config.resource}`], (req, res) => renderGrid(res, config));
  router.get([config.formPath, `/project-operations/${config.resource}/new`], (req, res) => renderForm(res, config));
  router.get(`/project-operations/${config.resource}/:id/edit`, (req, res) =>
    res.redirect(`${config.formPath}?id=${encodeURIComponent(String(req.params.id || ""))}`),
  );
});

module.exports = router;
