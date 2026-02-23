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

async function fetchCurrentUserMe(baseUrl, authHeader, req) {
  try {
    const response = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(req?.headers?.cookie ? { Cookie: req.headers.cookie } : {}),
      },
    });
    if (!response.ok) return null;
    return await readJsonSafe(response);
  } catch {
    return null;
  }
}

async function fetchCompanyById(baseUrl, authHeader, companyId, req) {
  const id = String(companyId || "").trim();
  if (!id) return null;

  try {
    const response = await fetch(`${baseUrl}/companies/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(req?.headers?.cookie ? { Cookie: req.headers.cookie } : {}),
      },
    });
    if (!response.ok) return null;
    return await readJsonSafe(response);
  } catch {
    return null;
  }
}

async function fetchCompanyLogoDataUri(baseUrl, authHeader, companyId) {
  const id = String(companyId || "").trim();
  if (!id) return null;

  try {
    const resp = await fetch(`${baseUrl}/companies/${encodeURIComponent(id)}/logo`, {
      method: "GET",
      headers: {
        Accept: "*/*",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (!resp.ok || resp.status === 204) return null;
    const ctype = resp.headers.get("content-type") || "image/png";
    const arr = await resp.arrayBuffer();
    if (!arr || arr.byteLength === 0) return null;

    const base64 = Buffer.from(arr).toString("base64");
    return `data:${ctype};base64,${base64}`;
  } catch {
    return null;
  }
}

function hasCompanyLogoHint(company) {
  return Boolean(
    company?.logo ||
    company?.logo_url ||
    company?.logoUrl ||
    company?.has_logo === true ||
    company?.hasLogo === true ||
    company?.logo_updated_at ||
    company?.logoUpdatedAt
  );
}

function buildFromCompanyBlock(company) {
  const c = company || {};
  const name =
    c.company_name ||
    c.fantasy_name ||
    c.legal_name ||
    c.name ||
    "GECOM";

  const phone = c.phone || c.phonenumber || "-";

  const addr1 =
    c.address_line ||
    [c.address_street, c.address_number].filter(Boolean).join(", ") ||
    "-";

  const addr2 = [
    c.address_district,
    c.address_city,
    c.address_state,
    c.address_postal_code || c.address_postalcode,
    c.address_country,
  ]
    .filter(Boolean)
    .join(" - ");

  return {
    name: String(name || "GECOM"),
    addr1: String(addr1 || "-"),
    addr2: String(addr2 || ""),
    phone: String(phone || "-"),
  };
}

function clampTaxRate01(value) {
  const n = Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function toNumberSafe(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

function buildCloneInvoicePayload(sourceInvoice) {
  const inv = sourceInvoice || {};
  const apiLines = Array.isArray(inv.invoice_lines) ? inv.invoice_lines : [];

  const lines = apiLines.map((line) => ({
    product_id: line?.product_id ? String(line.product_id).trim() : null,
    description: String(line?.description || "").trim(),
    unit: String(line?.unit || "").trim(),
    unit_price: String(Math.max(0, toNumberSafe(line?.unit_price, 0))),
    quantity: String(Math.max(1, parseInt(String(line?.quantity ?? "1"), 10) || 1)),
    tax_rate: String(clampTaxRate01(line?.tax_rate)),
    discount_amount: String(Math.max(0, toNumberSafe(line?.discount_amount, 0))),
  }));

  return {
    company_id: inv?.company_id ? String(inv.company_id).trim() : null,
    currency_id: inv?.currency_id ? String(inv.currency_id).trim() : null,
    quote_at: inv?.quote_at || null,
    due_at: inv?.due_at || null,
    exchange_rate: inv?.exchange_rate ?? null,
    status: 0, // cloned invoices should start as draft
    discount_percent: Math.max(0, Math.min(100, toNumberSafe(inv?.discount_percent, 0))),
    version: 1,
    notes: String(inv?.notes || ""),
    terms: String(inv?.terms || ""),
    billing_address_line1: String(inv?.billing_address_line1 || ""),
    billing_address_line2: String(inv?.billing_address_line2 || ""),
    billing_address_city: String(inv?.billing_address_city || ""),
    billing_address_state: String(inv?.billing_address_state || ""),
    billing_address_postal_code: String(inv?.billing_address_postal_code || ""),
    billing_address_country: String(inv?.billing_address_country || ""),
    lines,
  };
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

  const gross = qty * unitPrice;

  // Line discount is value (amount). Fallback to percent for legacy rows.
  let lineDiscountAmount = toNumber(l?.discount_amount);
  if (!lineDiscountAmount && toNumber(l?.discount_percent) > 0) {
    const lineDiscountPercent = Math.max(0, Math.min(100, toNumber(l?.discount_percent)));
    lineDiscountAmount = gross * (lineDiscountPercent / 100);
  }
  if (lineDiscountAmount > gross) lineDiscountAmount = gross;

  const taxableBase = Math.max(0, gross - lineDiscountAmount);

  // Tax amount should be added; prefer persisted tax_amount when available.
  const lineTax = toNumber(l?.tax_amount) || (taxableBase * taxRate);
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


    const me = await fetchCurrentUserMe(baseUrl, authHeader, req);
    const senderCompanyId =
      me?.company_id ||
      me?.companyId ||
      me?.company?.id ||
      me?.company?.company_id ||
      null;

    const senderCompany = await fetchCompanyById(baseUrl, authHeader, senderCompanyId, req);

    let companyLogoDataUri = null;
    try {
      const companyIdForLogo = senderCompany?.id || senderCompany?.company_id || senderCompanyId;
      if (companyIdForLogo) {
        companyLogoDataUri = await fetchCompanyLogoDataUri(
          baseUrl,
          authHeader,
          companyIdForLogo
        );
      }
    } catch {
      companyLogoDataUri = null;
    }

const viewModel = {
  invoice,
  company,
  companyLogoDataUri,
  from: buildFromCompanyBlock(senderCompany),
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

// GET /api/invoices?company_id=&status=&status_config_id=
router.get("/invoices", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const qs = new URLSearchParams();
    if (req.query.company_id) qs.set("company_id", String(req.query.company_id));
    if (req.query.status) qs.set("status", String(req.query.status));
    if (req.query.status_config_id) qs.set("status_config_id", String(req.query.status_config_id));
    if (req.query.fields) qs.set("fields", String(req.query.fields));

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

// POST /api/invoices/:id/clone
router.post("/invoices/:id/clone", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const sourceId = String(req.params.id || "").trim();

    if (!sourceId) {
      return res.status(400).json({ message: "Invoice id inválido." });
    }

    const sourceResp = await fetch(`${baseUrl}/invoices/${encodeURIComponent(sourceId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const sourceData = await readJsonSafe(sourceResp);
    if (!sourceResp.ok) {
      return res.status(sourceResp.status).json(sourceData ?? {});
    }

    const payload = buildCloneInvoicePayload(sourceData);
    if (!payload.company_id || !payload.currency_id) {
      return res.status(422).json({ message: "Não foi possível clonar: invoice sem company_id ou currency_id." });
    }

    const createResp = await fetch(`${baseUrl}/invoices`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    const created = await readJsonSafe(createResp);
    if (!createResp.ok) {
      return res.status(createResp.status).json(created ?? {});
    }

    return res.status(201).json({
      ...(created || {}),
      source_invoice_id: sourceId,
    });
  } catch (error) {
    console.error("POST /api/invoices/:id/clone error:", error);
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
