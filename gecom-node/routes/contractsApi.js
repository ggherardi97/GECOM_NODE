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
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

function backendUrl(path) {
  const base = getBackendBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

function appendQueryParams(url, query) {
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null) continue;
    if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
    else url.searchParams.set(key, String(value));
  }
}

async function proxyJson(req, res, config) {
  const authHeader = getAuthHeader(req);
  const response = await fetch(config.url, {
    method: config.method,
    headers: {
      Accept: "application/json",
      ...(config.withBody ? { "Content-Type": "application/json" } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    ...(config.withBody ? { body: JSON.stringify(req.body || {}) } : {}),
  });

  const data = await readJsonSafe(response);
  return res.status(response.status).json(data || {});
}

router.get("/contracts", async (req, res) => {
  try {
    const url = new URL(backendUrl("/contracts"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/contracts error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/contracts/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/contracts/${encodeURIComponent(String(req.params.id || ""))}`),
    });
  } catch (error) {
    console.error("GET /api/contracts/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/contracts", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "POST", url: backendUrl("/contracts"), withBody: true });
  } catch (error) {
    console.error("POST /api/contracts error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/contracts/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/contracts/${encodeURIComponent(String(req.params.id || ""))}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/contracts/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/contracts/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "DELETE",
      url: backendUrl(`/contracts/${encodeURIComponent(String(req.params.id || ""))}`),
    });
  } catch (error) {
    console.error("DELETE /api/contracts/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/contracts/:id/generate-invoice", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/contracts/${encodeURIComponent(String(req.params.id || ""))}/generate-invoice`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/contracts/:id/generate-invoice error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
