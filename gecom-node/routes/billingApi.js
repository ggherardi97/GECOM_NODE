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
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
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

router.get("/admin/billing/modules", async (req, res) => {
  try {
    const url = new URL(backendUrl("/admin/billing/modules"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/admin/billing/modules error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/public/billing/modules", async (req, res) => {
  try {
    const url = new URL(backendUrl("/public/billing/modules"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/public/billing/modules error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/public/billing/plans", async (req, res) => {
  try {
    const url = new URL(backendUrl("/public/billing/plans"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/public/billing/plans error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/billing/modules", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/admin/billing/modules"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/admin/billing/modules error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/billing/modules/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/admin/billing/modules/${encodeURIComponent(String(req.params.id || ""))}`),
    });
  } catch (error) {
    console.error("GET /api/admin/billing/modules/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/billing/modules/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PUT",
      url: backendUrl(`/admin/billing/modules/${encodeURIComponent(String(req.params.id || ""))}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PUT /api/admin/billing/modules/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/billing/plans", async (req, res) => {
  try {
    const url = new URL(backendUrl("/admin/billing/plans"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/admin/billing/plans error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/billing/plans", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/admin/billing/plans"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/admin/billing/plans error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/billing/plans/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/admin/billing/plans/${encodeURIComponent(String(req.params.id || ""))}`),
    });
  } catch (error) {
    console.error("GET /api/admin/billing/plans/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/billing/plans/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PUT",
      url: backendUrl(`/admin/billing/plans/${encodeURIComponent(String(req.params.id || ""))}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PUT /api/admin/billing/plans/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/billing/plans/:id/modules", async (req, res) => {
  try {
    const planId = encodeURIComponent(String(req.params.id || ""));
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/admin/billing/plans/${planId}/modules`),
    });
  } catch (error) {
    console.error("GET /api/admin/billing/plans/:id/modules error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/billing/plans/:id/modules", async (req, res) => {
  try {
    const planId = encodeURIComponent(String(req.params.id || ""));
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/admin/billing/plans/${planId}/modules`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/admin/billing/plans/:id/modules error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/billing/plan-modules/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PUT",
      url: backendUrl(`/admin/billing/plan-modules/${encodeURIComponent(String(req.params.id || ""))}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PUT /api/admin/billing/plan-modules/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/admin/billing/plan-modules/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "DELETE",
      url: backendUrl(`/admin/billing/plan-modules/${encodeURIComponent(String(req.params.id || ""))}`),
    });
  } catch (error) {
    console.error("DELETE /api/admin/billing/plan-modules/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/billing/tenants/:tenantId/subscription", async (req, res) => {
  try {
    const tenantId = encodeURIComponent(String(req.params.tenantId || ""));
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/admin/billing/tenants/${tenantId}/subscription`),
    });
  } catch (error) {
    console.error("GET /api/admin/billing/tenants/:tenantId/subscription error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/billing/tenants/:tenantId/subscription", async (req, res) => {
  try {
    const tenantId = encodeURIComponent(String(req.params.tenantId || ""));
    return await proxyJson(req, res, {
      method: "PUT",
      url: backendUrl(`/admin/billing/tenants/${tenantId}/subscription`),
      withBody: true,
    });
  } catch (error) {
    console.error("PUT /api/admin/billing/tenants/:tenantId/subscription error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/billing/tenants/:tenantId/overrides", async (req, res) => {
  try {
    const tenantId = encodeURIComponent(String(req.params.tenantId || ""));
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/admin/billing/tenants/${tenantId}/overrides`),
    });
  } catch (error) {
    console.error("GET /api/admin/billing/tenants/:tenantId/overrides error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/admin/billing/tenants/:tenantId/overrides/:moduleId", async (req, res) => {
  try {
    const tenantId = encodeURIComponent(String(req.params.tenantId || ""));
    const moduleId = encodeURIComponent(String(req.params.moduleId || ""));
    return await proxyJson(req, res, {
      method: "PUT",
      url: backendUrl(`/admin/billing/tenants/${tenantId}/overrides/${moduleId}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PUT /api/admin/billing/tenants/:tenantId/overrides/:moduleId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/tenants/search", async (req, res) => {
  try {
    const url = new URL(backendUrl("/admin/tenants/search"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/admin/tenants/search error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/me/modules", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl("/me/modules"),
    });
  } catch (error) {
    console.error("GET /api/me/modules error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
