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
    return value ? tt("page.finance.common.yes", "Sim") : tt("page.finance.common.no", "Nao");
  }

  const paymentFields = [
    { name: "payment_date", label: "page.finance.fields.paymentDate", type: "datetime-local" },
    { name: "amount", label: "page.finance.fields.amount", type: "number", step: "0.01", required: true },
    { name: "interest_amount", label: "page.finance.fields.interestAmount", type: "number", step: "0.01" },
    { name: "discount_amount", label: "page.finance.fields.discountAmount", type: "number", step: "0.01" },
    { name: "fee_amount", label: "page.finance.fields.feeAmount", type: "number", step: "0.01" },
    {
      name: "payment_method",
      label: "page.finance.fields.paymentMethod",
      type: "select",
      options: [
        "BANK_TRANSFER",
        "PIX",
        "CREDIT_CARD",
        "DEBIT_CARD",
        "CASH",
        "BOLETO",
        "CHECK",
        "OTHER",
      ],
    },
    { name: "bank_account_id", label: "page.finance.fields.bankAccount", type: "lookup", lookup: "bankAccounts" },
    { name: "reference", label: "page.finance.fields.reference", type: "text" },
    { name: "notes", label: "page.finance.fields.notes", type: "textarea" },
  ];

  const resources = {
    costCenters: {
      apiBase: "/api/finance/cost-centers",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "code", label: "page.finance.fields.code" },
        { key: "name", label: "page.finance.fields.name" },
        { key: "description", label: "page.finance.fields.description" },
      ],
      formFields: [
        { name: "code", label: "page.finance.fields.code", type: "text", required: true },
        { name: "name", label: "page.finance.fields.name", type: "text", required: true },
        { name: "description", label: "page.finance.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.finance.tabs.basic", fields: ["code", "name"] },
        { id: "notes", label: "page.finance.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {},
    },
    categories: {
      apiBase: "/api/finance/categories",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "code", label: "page.finance.fields.code" },
        { key: "name", label: "page.finance.fields.name" },
        { key: "kind", label: "page.finance.fields.kind" },
        { key: "cost_center_name", label: "page.finance.fields.costCenter" },
      ],
      formFields: [
        { name: "code", label: "page.finance.fields.code", type: "text", required: true },
        { name: "name", label: "page.finance.fields.name", type: "text", required: true },
        {
          name: "kind",
          label: "page.finance.fields.kind",
          type: "select",
          options: ["REVENUE", "EXPENSE", "TRANSFER"],
          defaultValue: "EXPENSE",
        },
        { name: "cost_center_id", label: "page.finance.fields.costCenter", type: "lookup", lookup: "costCenters" },
        { name: "parent_category_id", label: "page.finance.fields.parentCategory", type: "lookup", lookup: "categories" },
        { name: "description", label: "page.finance.fields.description", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.finance.tabs.basic", fields: ["code", "name", "kind"] },
        { id: "relations", label: "page.finance.tabs.relations", fields: ["cost_center_id", "parent_category_id"] },
        { id: "notes", label: "page.finance.tabs.notes", fields: ["description"] },
      ],
      lookupSources: {
        costCenters: "/api/finance/cost-centers",
        categories: "/api/finance/categories",
      },
    },
    bankAccounts: {
      apiBase: "/api/finance/bank-accounts",
      forceActiveOnCreate: true,
      gridColumns: [
        { key: "name", label: "page.finance.fields.name" },
        { key: "bank_name", label: "page.finance.fields.bank" },
        { key: "account_number", label: "page.finance.fields.accountNumber" },
        { key: "currency_code", label: "page.finance.fields.currency" },
        { key: "current_balance", label: "page.finance.fields.currentBalance", format: toMoney },
      ],
      formFields: [
        { name: "name", label: "page.finance.fields.name", type: "text", required: true },
        { name: "bank_name", label: "page.finance.fields.bank", type: "text" },
        { name: "agency", label: "page.finance.fields.agency", type: "text" },
        { name: "account_number", label: "page.finance.fields.accountNumber", type: "text" },
        {
          name: "account_type",
          label: "page.finance.fields.accountType",
          type: "select",
          options: ["CASH", "CHECKING", "SAVINGS", "INVESTMENT", "DIGITAL_WALLET"],
          defaultValue: "CHECKING",
        },
        { name: "currency_id", label: "page.finance.fields.currency", type: "lookup", lookup: "currencies", required: true },
        { name: "opening_balance", label: "page.finance.fields.openingBalance", type: "number", step: "0.01" },
        { name: "allow_negative", label: "page.finance.fields.allowNegative", type: "checkbox", defaultValue: false },
        { name: "reconciliation_date", label: "page.finance.fields.reconciliationDate", type: "date" },
        { name: "notes", label: "page.finance.fields.notes", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.finance.tabs.basic", fields: ["name", "bank_name", "agency", "account_number", "account_type"] },
        { id: "relations", label: "page.finance.tabs.relations", fields: ["currency_id"] },
        { id: "amounts", label: "page.finance.tabs.amounts", fields: ["opening_balance", "allow_negative"] },
        { id: "reconciliation", label: "page.finance.tabs.reconciliation", fields: ["reconciliation_date"] },
        { id: "notes", label: "page.finance.tabs.notes", fields: ["notes"] },
      ],
      lookupSources: {
        currencies: "/api/currencies?is_active=true",
      },
    },
    bankMovements: {
      apiBase: "/api/finance/bank-movements",
      gridColumns: [
        { key: "movement_date", label: "page.finance.fields.dateTime", format: toDateTimeBr },
        { key: "bank_account_name", label: "page.finance.fields.bankAccount" },
        { key: "movement_type", label: "page.finance.fields.type" },
        { key: "amount", label: "page.finance.fields.amount", format: toMoney },
        { key: "description", label: "page.finance.fields.description" },
        { key: "reconciled", label: "page.finance.fields.reconciled", format: boolLabel },
      ],
      formFields: [
        { name: "movement_date", label: "page.finance.fields.dateTime", type: "datetime-local" },
        { name: "bank_account_id", label: "page.finance.fields.bankAccount", type: "lookup", lookup: "bankAccounts", required: true },
        { name: "movement_type", label: "page.finance.fields.type", type: "select", options: ["CREDIT", "DEBIT"], required: true },
        { name: "amount", label: "page.finance.fields.amount", type: "number", step: "0.01", required: true },
        { name: "category_id", label: "page.finance.fields.category", type: "lookup", lookup: "categories" },
        { name: "cost_center_id", label: "page.finance.fields.costCenter", type: "lookup", lookup: "costCenters" },
        { name: "description", label: "page.finance.fields.description", type: "textarea" },
        { name: "reference_table", label: "page.finance.fields.referenceTable", type: "text" },
        { name: "reference_id", label: "page.finance.fields.referenceId", type: "text" },
        { name: "reconciled", label: "page.finance.fields.reconciled", type: "checkbox", defaultValue: false },
        { name: "reconciliation_note", label: "page.finance.fields.reconciliationNote", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.finance.tabs.basic", fields: ["movement_date", "movement_type", "amount", "description"] },
        { id: "relations", label: "page.finance.tabs.relations", fields: ["bank_account_id", "category_id", "cost_center_id"] },
        { id: "references", label: "page.finance.tabs.references", fields: ["reference_table", "reference_id"] },
        { id: "reconciliation", label: "page.finance.tabs.reconciliation", fields: ["reconciled", "reconciliation_note"] },
      ],
      lookupSources: {
        bankAccounts: "/api/finance/bank-accounts?is_active=true",
        categories: "/api/finance/categories",
        costCenters: "/api/finance/cost-centers",
      },
    },
    receivables: {
      apiBase: "/api/finance/receivables",
      gridColumns: [
        { key: "title_number", label: "page.finance.fields.titleNumber" },
        { key: "company_name", label: "page.finance.fields.company" },
        { key: "due_date", label: "page.finance.fields.dueDate", format: toDateBr },
        { key: "original_amount", label: "page.finance.fields.originalAmount", format: toMoney },
        { key: "outstanding_amount", label: "page.finance.fields.outstandingAmount", format: toMoney },
        { key: "status", label: "page.finance.fields.status" },
      ],
      formFields: [
        { name: "title_number", label: "page.finance.fields.titleNumber", type: "text", required: true },
        { name: "description", label: "page.finance.fields.description", type: "textarea" },
        { name: "company_id", label: "page.finance.fields.company", type: "lookup", lookup: "companies", required: true },
        { name: "invoice_id", label: "page.finance.fields.invoice", type: "lookup", lookup: "invoices" },
        { name: "document_id", label: "page.finance.fields.document", type: "lookup", lookup: "documents" },
        { name: "currency_id", label: "page.finance.fields.currency", type: "lookup", lookup: "currencies", required: true },
        { name: "category_id", label: "page.finance.fields.category", type: "lookup", lookup: "categories" },
        { name: "cost_center_id", label: "page.finance.fields.costCenter", type: "lookup", lookup: "costCenters" },
        { name: "issue_date", label: "page.finance.fields.issueDate", type: "date" },
        { name: "due_date", label: "page.finance.fields.dueDate", type: "date", required: true },
        { name: "original_amount", label: "page.finance.fields.originalAmount", type: "number", step: "0.01", required: true },
        { name: "installment_number", label: "page.finance.fields.installmentNumber", type: "number", step: "1", defaultValue: 1 },
        { name: "installment_total", label: "page.finance.fields.installmentTotal", type: "number", step: "1", defaultValue: 1 },
        { name: "notes", label: "page.finance.fields.notes", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.finance.tabs.basic", fields: ["title_number", "description"] },
        { id: "relations", label: "page.finance.tabs.relations", fields: ["company_id", "invoice_id", "document_id", "currency_id", "category_id", "cost_center_id"] },
        { id: "schedule", label: "page.finance.tabs.schedule", fields: ["issue_date", "due_date", "installment_number", "installment_total"] },
        { id: "amounts", label: "page.finance.tabs.amounts", fields: ["original_amount"] },
        { id: "notes", label: "page.finance.tabs.notes", fields: ["notes"] },
      ],
      paymentFields,
      lookupSources: {
        companies: "/api/companies",
        invoices: "/api/invoices",
        documents: "/api/documents",
        currencies: "/api/currencies?is_active=true",
        categories: "/api/finance/categories",
        costCenters: "/api/finance/cost-centers",
        bankAccounts: "/api/finance/bank-accounts?is_active=true",
      },
    },
    payables: {
      apiBase: "/api/finance/payables",
      gridColumns: [
        { key: "payable_number", label: "page.finance.fields.payableNumber" },
        { key: "company_name", label: "page.finance.fields.company" },
        { key: "due_date", label: "page.finance.fields.dueDate", format: toDateBr },
        { key: "original_amount", label: "page.finance.fields.originalAmount", format: toMoney },
        { key: "outstanding_amount", label: "page.finance.fields.outstandingAmount", format: toMoney },
        { key: "status", label: "page.finance.fields.status" },
      ],
      formFields: [
        { name: "payable_number", label: "page.finance.fields.payableNumber", type: "text", required: true },
        { name: "description", label: "page.finance.fields.description", type: "textarea" },
        { name: "company_id", label: "page.finance.fields.company", type: "lookup", lookup: "companies" },
        { name: "document_id", label: "page.finance.fields.document", type: "lookup", lookup: "documents" },
        { name: "currency_id", label: "page.finance.fields.currency", type: "lookup", lookup: "currencies", required: true },
        { name: "category_id", label: "page.finance.fields.category", type: "lookup", lookup: "categories" },
        { name: "cost_center_id", label: "page.finance.fields.costCenter", type: "lookup", lookup: "costCenters" },
        { name: "issue_date", label: "page.finance.fields.issueDate", type: "date" },
        { name: "due_date", label: "page.finance.fields.dueDate", type: "date", required: true },
        { name: "original_amount", label: "page.finance.fields.originalAmount", type: "number", step: "0.01", required: true },
        { name: "installment_number", label: "page.finance.fields.installmentNumber", type: "number", step: "1", defaultValue: 1 },
        { name: "installment_total", label: "page.finance.fields.installmentTotal", type: "number", step: "1", defaultValue: 1 },
        { name: "notes", label: "page.finance.fields.notes", type: "textarea" },
      ],
      formTabs: [
        { id: "basic", label: "page.finance.tabs.basic", fields: ["payable_number", "description"] },
        { id: "relations", label: "page.finance.tabs.relations", fields: ["company_id", "document_id", "currency_id", "category_id", "cost_center_id"] },
        { id: "schedule", label: "page.finance.tabs.schedule", fields: ["issue_date", "due_date", "installment_number", "installment_total"] },
        { id: "amounts", label: "page.finance.tabs.amounts", fields: ["original_amount"] },
        { id: "notes", label: "page.finance.tabs.notes", fields: ["notes"] },
      ],
      paymentFields,
      lookupSources: {
        companies: "/api/companies",
        documents: "/api/documents",
        currencies: "/api/currencies?is_active=true",
        categories: "/api/finance/categories",
        costCenters: "/api/finance/cost-centers",
        bankAccounts: "/api/finance/bank-accounts?is_active=true",
      },
    },
  };

  global.FinanceResources = {
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
