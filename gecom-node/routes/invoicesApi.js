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

    // Se backend devolveu erro, repassa a msg real
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/invoices error (BFF):", error);

    // ✅ devolve erro real pra você ver no browser
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

    // Se o backend retornar 204 (no content), devolve no content também
    if (response.status === 204) return res.status(204).send();

    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/invoices/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

module.exports = router;