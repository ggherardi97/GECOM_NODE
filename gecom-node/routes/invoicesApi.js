// routes/invoicesApi.js
const express = require("express");
const router = express.Router();

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_API_BASE_URL || process.env.API_BASE_URL;
  if (!baseUrl) throw new Error("Missing BACKEND_API_BASE_URL (or API_BASE_URL) env var.");
  return baseUrl.replace(/\/$/, "");
}

function getAuthHeader(req) {
  const headerAuth = req.headers.authorization;
  if (headerAuth && headerAuth.startsWith("Bearer ")) return headerAuth;

  const token = req.cookies?.token || req.cookies?.access_token;
  if (token) return `Bearer ${token}`;

  return null;
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

// ------------------------------
// Print helpers (server-side)
// ------------------------------
function toNumber(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function formatDatePtBr(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR");
}

function money(value, currencyCode) {
  const n = toNumber(value);
  try {
    if (currencyCode) {
      return new Intl.NumberFormat("pt-BR", { style: "currency", currency: currencyCode }).format(n);
    }
  } catch (e) {
    // ignore invalid currency codes
  }
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function qtyFmt(value) {
  const n = toNumber(value);
  return new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(n);
}

/**
 * IMPORTANT:
 * Your Nest backend returns relations as:
 *   companies, currencies, invoice_lines
 */
function extractCurrencyCode(invoice) {
  const currencies = invoice?.currencies || invoice?.currency || null;
  return (
    currencies?.code ||
    currencies?.iso_code ||
    currencies?.currency_code ||
    invoice?.currency_code ||
    null
  );
}

// ------------------------------
// ✅ PRINT (HTML) - renders EJS
// Route will be available as: /api/invoices/:id/print (if app.use("/api", router))
// ------------------------------
router.get("/invoices/:id/print", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    if (!authHeader) {
      return res.status(401).send("Não autenticado.");
    }

    const invoiceId = String(req.params.id || "").trim();
    if (!invoiceId) {
      return res.status(400).send("Invoice id inválido.");
    }

    const response = await fetch(`${baseUrl}/invoices/${encodeURIComponent(invoiceId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: authHeader,
      },
    });

    const invoice = await readJsonSafe(response);
    if (!response.ok) {
      return res.status(response.status).send(invoice?.message || "Falha ao carregar invoice.");
    }

    const company = invoice?.companies || invoice?.company || null;
    const currencyCode = extractCurrencyCode(invoice);

    const apiLines = Array.isArray(invoice?.invoice_lines) ? invoice.invoice_lines : [];

   let grossSubtotal = 0;
let lineDiscountTotal = 0;
let taxTotal = 0;

// Header discount (%)
const headerDiscountPercent = Math.max(0, Math.min(100, toNumber(invoice?.discount_percent)));

const lines = apiLines.map((l) => {
  const qty = toNumber(l?.quantity);
  const unitPrice = toNumber(l?.unit_price);
  const taxRate = Math.max(0, Math.min(1, toNumber(l?.tax_rate))); // 0..1
  const lineDiscountPercent = Math.max(0, Math.min(100, toNumber(l?.discount_percent)));

  const gross = qty * unitPrice;
  const lineDiscountAmount = gross * (lineDiscountPercent / 100);
  const taxableBase = Math.max(0, gross - lineDiscountAmount);
  const lineTax = taxableBase * taxRate;
  const lineTotal = taxableBase + lineTax;

  grossSubtotal += gross;
  lineDiscountTotal += lineDiscountAmount;
  taxTotal += lineTax;

  return {
    product_name: l?.product_name || "Manual",
    description: l?.description || "",
    quantityFmt: qtyFmt(qty),
    unitPriceFmt: money(unitPrice, currencyCode),
    taxFmt: `${(taxRate * 100).toFixed(2)}%`,
    totalFmt: money(lineTotal, currencyCode),
  };
});

// Header discount amount is applied on GROSS subtotal (same as your NewInvoice)
const headerDiscountAmount = grossSubtotal * (headerDiscountPercent / 100);

// Total = (grossSubtotal - line discounts - header discount) + taxes
const total = Math.max(0, (grossSubtotal - lineDiscountTotal - headerDiscountAmount) + taxTotal);

const totals = {
  subtotalFmt: money(grossSubtotal, currencyCode),
  discountFmt: money(headerDiscountAmount, currencyCode),
  taxFmt: money(taxTotal, currencyCode),
  totalFmt: money(total, currencyCode),
};


const viewModel = {
  invoice,
  company,
  from: {
    name: "GECOM",
    addr1: "-",
    addr2: "",
    phone: "-",
  },
  invoiceDate: formatDatePtBr(invoice?.created_at || invoice?.invoice_date || invoice?.createdAt),
  dueDate: formatDatePtBr(invoice?.due_at || invoice?.due_at),
  lines,
  totals, // ✅ usa o totals já calculado (subtotal, desconto, imposto, total)
};



    // This requires you to have views/InvoicesPrint.ejs created
    return res.render("InvoicesPrint", {
  ...viewModel,
  layout: false, // ✅ disable master layout ONLY for this page
});
  } catch (error) {
    console.error("GET /api/invoices/:id/print error:", error);
    return res.status(500).send("Erro interno ao gerar impressão.");
  }
});

// GET /api/invoices?company_id=&status=
router.get("/invoices", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const qs = new URLSearchParams();
    if (req.query.company_id) qs.set("company_id", String(req.query.company_id));
    if (req.query.status) qs.set("status", String(req.query.status));

    const response = await fetch(`${baseUrl}/invoices?${qs.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// ✅ GET /api/invoices/:id (by id)
router.get("/invoices/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/invoices/${encodeURIComponent(req.params.id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/invoices/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// POST /api/invoices
router.post("/invoices", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    // 🔎 debug (remove depois)
    console.log("[BFF] POST /api/invoices ->", {
      baseUrl,
      hasAuth: !!authHeader,
      bodyKeys: Object.keys(req.body || {}),
    });

    const url = `${baseUrl}/invoices`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const rawText = await response.text();
    let data = {};
    try { data = rawText ? JSON.parse(rawText) : {}; } catch { data = { message: rawText }; }

    // 🔎 debug (remove depois)
    console.log("[BFF] backend response ->", {
      status: response.status,
      statusText: response.statusText,
      body: data,
    });

    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/invoices error (BFF):", error);
    return res.status(500).json({
      message: error?.message || "Erro interno do servidor",
      stack: process.env.NODE_ENV === "production" ? undefined : String(error?.stack || ""),
    });
  }
});

// PATCH /api/invoices/:id
router.patch("/invoices/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/invoices/${encodeURIComponent(req.params.id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/invoices/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

// ✅ DELETE /api/invoices/:id
router.delete("/invoices/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/invoices/${encodeURIComponent(req.params.id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);

    if (response.status === 204) return res.status(204).send();
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/invoices/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

module.exports = router;