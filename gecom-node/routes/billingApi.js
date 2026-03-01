const express = require("express");

const router = express.Router();
const BOOTSTRAP_USER = process.env.BILLING_BOOTSTRAP_USER || "portaladmin";
const BOOTSTRAP_PASSWORD = process.env.BILLING_BOOTSTRAP_PASSWORD || "Q!w2E#r4T%";
const BOOTSTRAP_COOKIE = "gecom_billing_bootstrap";
const LOOP_GUARD_HEADER = "x-gecom-bff-hop";

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_API_BASE_URL || process.env.API_BASE_URL;
  if (!baseUrl) throw new Error("Missing BACKEND_API_BASE_URL (or API_BASE_URL) env var.");
  return baseUrl.replace(/\/$/, "");
}

function getBearerAuthHeader(req) {
  const headerAuth = req.headers.authorization;
  if (headerAuth && headerAuth.startsWith("Bearer ")) return headerAuth;
  const token = req.cookies?.token || req.cookies?.access_token;
  if (token) return `Bearer ${token}`;
  return null;
}

function getBasicAuthHeader(req) {
  const headerAuth = String(req?.headers?.authorization || "");
  if (headerAuth.startsWith("Basic ")) return headerAuth;
  if (String(req?.cookies?.[BOOTSTRAP_COOKIE] || "") === "1") {
    const raw = `${BOOTSTRAP_USER}:${BOOTSTRAP_PASSWORD}`;
    return `Basic ${Buffer.from(raw, "utf8").toString("base64")}`;
  }
  return null;
}

function shouldUseBootstrapBilling(req) {
  return !getBearerAuthHeader(req);
}

function billingBackendPath(req, suffix) {
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  if (shouldUseBootstrapBilling(req)) {
    return `/public/bootstrap/billing${normalizedSuffix}`;
  }
  return `/admin/billing${normalizedSuffix}`;
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
  // Prevent recursive proxy loops when BACKEND_API_BASE_URL points to the same public domain.
  if (String(req.headers?.[LOOP_GUARD_HEADER] || "") === "1") {
    return res.status(508).json({
      message:
        "Loop detectado no proxy de billing. Configure BACKEND_API_BASE_URL/API_BASE_URL do frontend para URL interna do backend.",
    });
  }

  const bearerAuth = getBearerAuthHeader(req);
  const basicAuth = config.allowBasicAuth ? getBasicAuthHeader(req) : null;
  const authHeader = bearerAuth || basicAuth || null;
  const response = await fetch(config.url, {
    method: config.method,
    headers: {
      Accept: "application/json",
      [LOOP_GUARD_HEADER]: "1",
      ...(config.withBody ? { "Content-Type": "application/json" } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    ...(config.withBody ? { body: JSON.stringify(req.body || {}) } : {}),
  });

  const wwwAuthenticate = response.headers.get("www-authenticate");
  if (wwwAuthenticate) {
    res.setHeader("WWW-Authenticate", wwwAuthenticate);
  }

  const data = await readJsonSafe(response);
  return res.status(response.status).json(data || {});
}

router.get("/admin/billing/modules", async (req, res) => {
  try {
    const url = new URL(backendUrl(billingBackendPath(req, "/modules")));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, {
      method: "GET",
      url: url.toString(),
      allowBasicAuth: shouldUseBootstrapBilling(req),
    });
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
      url: backendUrl(billingBackendPath(req, "/modules")),
      withBody: true,
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
      url: backendUrl(
        billingBackendPath(req, `/modules/${encodeURIComponent(String(req.params.id || ""))}`),
      ),
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
      url: backendUrl(
        billingBackendPath(req, `/modules/${encodeURIComponent(String(req.params.id || ""))}`),
      ),
      withBody: true,
      allowBasicAuth: shouldUseBootstrapBilling(req),
    });
  } catch (error) {
    console.error("PUT /api/admin/billing/modules/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/admin/billing/plans", async (req, res) => {
  try {
    const url = new URL(backendUrl(billingBackendPath(req, "/plans")));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, {
      method: "GET",
      url: url.toString(),
      allowBasicAuth: shouldUseBootstrapBilling(req),
    });
  } catch (error) {
    console.error("GET /api/admin/billing/plans error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/admin/billing/plans", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(billingBackendPath(req, "/plans")),
      withBody: true,
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
      url: backendUrl(
        billingBackendPath(req, `/plans/${encodeURIComponent(String(req.params.id || ""))}`),
      ),
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
      url: backendUrl(
        billingBackendPath(req, `/plans/${encodeURIComponent(String(req.params.id || ""))}`),
      ),
      withBody: true,
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
      url: backendUrl(billingBackendPath(req, `/plans/${planId}/modules`)),
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
      url: backendUrl(billingBackendPath(req, `/plans/${planId}/modules`)),
      withBody: true,
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
      url: backendUrl(
        billingBackendPath(req, `/plan-modules/${encodeURIComponent(String(req.params.id || ""))}`),
      ),
      withBody: true,
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
      url: backendUrl(
        billingBackendPath(req, `/plan-modules/${encodeURIComponent(String(req.params.id || ""))}`),
      ),
      allowBasicAuth: shouldUseBootstrapBilling(req),
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
