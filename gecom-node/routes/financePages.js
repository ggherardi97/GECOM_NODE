const express = require("express");

const router = express.Router();

const resources = {
  costCenters: {
    key: "costCenters",
    resource: "cost-centers",
    gridPath: "/FinanceCostCenters",
    formPath: "/NewFinanceCostCenter",
    entityName: "financial_cost_centers",
    titleKey: "page.finance.costCenters.title",
  },
  categories: {
    key: "categories",
    resource: "categories",
    gridPath: "/FinanceCategories",
    formPath: "/NewFinanceCategory",
    entityName: "financial_categories",
    titleKey: "page.finance.categories.title",
  },
  bankAccounts: {
    key: "bankAccounts",
    resource: "bank-accounts",
    gridPath: "/FinanceBankAccounts",
    formPath: "/NewFinanceBankAccount",
    entityName: "financial_bank_accounts",
    titleKey: "page.finance.bankAccounts.title",
  },
  bankMovements: {
    key: "bankMovements",
    resource: "bank-movements",
    gridPath: "/FinanceBankMovements",
    formPath: "/NewFinanceBankMovement",
    entityName: "financial_bank_movements",
    titleKey: "page.finance.bankMovements.title",
  },
  receivables: {
    key: "receivables",
    resource: "receivables",
    gridPath: "/FinanceReceivables",
    formPath: "/NewFinanceReceivable",
    entityName: "financial_receivables",
    titleKey: "page.finance.receivables.title",
  },
  payables: {
    key: "payables",
    resource: "payables",
    gridPath: "/FinancePayables",
    formPath: "/NewFinancePayable",
    entityName: "financial_payables",
    titleKey: "page.finance.payables.title",
  },
};

function renderGrid(res, config) {
  return res.render("finance/FinanceGrid", { financePage: config });
}

function renderForm(res, config) {
  return res.render("finance/FinanceForm", { financePage: config });
}

router.get(["/FinanceCostCenters", "/finance/cost-centers"], (req, res) => renderGrid(res, resources.costCenters));
router.get(["/NewFinanceCostCenter", "/finance/cost-centers/new"], (req, res) => renderForm(res, resources.costCenters));
router.get("/finance/cost-centers/:id/edit", (req, res) =>
  res.redirect(`${resources.costCenters.formPath}?id=${encodeURIComponent(String(req.params.id || ""))}`),
);

router.get(["/FinanceCategories", "/finance/categories"], (req, res) => renderGrid(res, resources.categories));
router.get(["/NewFinanceCategory", "/finance/categories/new"], (req, res) => renderForm(res, resources.categories));
router.get("/finance/categories/:id/edit", (req, res) =>
  res.redirect(`${resources.categories.formPath}?id=${encodeURIComponent(String(req.params.id || ""))}`),
);

router.get(["/FinanceBankAccounts", "/finance/bank-accounts"], (req, res) => renderGrid(res, resources.bankAccounts));
router.get(["/NewFinanceBankAccount", "/finance/bank-accounts/new"], (req, res) => renderForm(res, resources.bankAccounts));
router.get("/finance/bank-accounts/:id/edit", (req, res) =>
  res.redirect(`${resources.bankAccounts.formPath}?id=${encodeURIComponent(String(req.params.id || ""))}`),
);

router.get(["/FinanceBankMovements", "/finance/bank-movements"], (req, res) => renderGrid(res, resources.bankMovements));
router.get(["/NewFinanceBankMovement", "/finance/bank-movements/new"], (req, res) => renderForm(res, resources.bankMovements));
router.get("/finance/bank-movements/:id/edit", (req, res) =>
  res.redirect(`${resources.bankMovements.formPath}?id=${encodeURIComponent(String(req.params.id || ""))}`),
);

router.get(["/FinanceReceivables", "/finance/receivables"], (req, res) => renderGrid(res, resources.receivables));
router.get(["/NewFinanceReceivable", "/finance/receivables/new"], (req, res) => renderForm(res, resources.receivables));
router.get("/finance/receivables/:id/edit", (req, res) =>
  res.redirect(`${resources.receivables.formPath}?id=${encodeURIComponent(String(req.params.id || ""))}`),
);

router.get(["/FinancePayables", "/finance/payables"], (req, res) => renderGrid(res, resources.payables));
router.get(["/NewFinancePayable", "/finance/payables/new"], (req, res) => renderForm(res, resources.payables));
router.get("/finance/payables/:id/edit", (req, res) =>
  res.redirect(`${resources.payables.formPath}?id=${encodeURIComponent(String(req.params.id || ""))}`),
);

router.get(["/FinanceCashFlow", "/finance/cash-flow"], (req, res) => res.render("finance/FinanceCashFlow"));

module.exports = router;
