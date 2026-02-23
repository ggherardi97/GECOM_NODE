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

async function proxy(req, res, method, path, body) {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(method !== "GET" && method !== "DELETE" ? { "Content-Type": "application/json" } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      ...(method !== "GET" && method !== "DELETE" ? { body: JSON.stringify(body ?? {}) } : {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error(`statusConfigsApi ${method} ${path} error:`, error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
}

router.get("/status-configs", async (req, res) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (value == null || value === "") continue;
    qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return proxy(req, res, "GET", `/status-configs${suffix}`);
});

router.post("/status-configs/seed-defaults", async (req, res) => {
  return proxy(req, res, "POST", "/status-configs/seed-defaults", req.body);
});

router.post("/status-configs", async (req, res) => {
  return proxy(req, res, "POST", "/status-configs", req.body);
});

router.patch("/status-configs/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "id invalido" });
  return proxy(req, res, "PATCH", `/status-configs/${encodeURIComponent(id)}`, req.body);
});

router.delete("/status-configs/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "id invalido" });
  return proxy(req, res, "DELETE", `/status-configs/${encodeURIComponent(id)}`);
});

module.exports = router;

