const express = require("express");

const router = express.Router();

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_API_BASE_URL || process.env.API_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing BACKEND_API_BASE_URL (or API_BASE_URL) env var.");
  }
  return baseUrl.replace(/\/$/, "");
}

function getAuthHeader(req) {
  const headerAuth = req.headers.authorization;
  if (headerAuth && headerAuth.startsWith("Bearer ")) {
    return headerAuth;
  }

  const token = req.cookies?.token || req.cookies?.access_token;
  if (token) return `Bearer ${token}`;

  return null;
}

function sanitizeTenantFields(input) {
  if (Array.isArray(input)) return input.map((item) => sanitizeTenantFields(item));
  if (input == null || typeof input !== "object") return input;

  const out = {};
  for (const [key, value] of Object.entries(input)) {
    const normalized = String(key || "").toLowerCase();
    if (normalized === "tenant_id" || normalized === "tenantid") continue;
    out[key] = sanitizeTenantFields(value);
  }
  return out;
}

async function readBodySafe(response) {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text().catch(() => "");

  if (!text) return { isJson: true, data: {} };
  if (!contentType.includes("application/json")) {
    try {
      return { isJson: true, data: JSON.parse(text) };
    } catch {
      return { isJson: false, data: text };
    }
  }

  try {
    return { isJson: true, data: JSON.parse(text) };
  } catch {
    return { isJson: false, data: text };
  }
}

router.all("/service/*path", async (req, res) => {
  try {
    const rawPath = req.params?.path;
    const wildcard = Array.isArray(rawPath)
      ? rawPath.join("/")
      : String(rawPath || "").replace(/^\/+/, "");
    const backendUrl = new URL(`${getBackendBaseUrl()}/service/${wildcard}`);
    for (const [key, value] of Object.entries(req.query || {})) {
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((v) => backendUrl.searchParams.append(key, String(v)));
      else backendUrl.searchParams.set(key, String(value));
    }

    const authHeader = getAuthHeader(req);
    const method = String(req.method || "GET").toUpperCase();
    const hasBody = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
    const bodyPayload = hasBody ? sanitizeTenantFields(req.body || {}) : undefined;

    const response = await fetch(backendUrl.toString(), {
      method,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(req.headers.cookie ? { Cookie: req.headers.cookie } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(bodyPayload) } : {}),
    });

    const payload = await readBodySafe(response);
    if (payload.isJson) return res.status(response.status).json(payload.data ?? {});
    return res.status(response.status).send(payload.data || "");
  } catch (error) {
    console.error("Service API proxy error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
