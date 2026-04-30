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
  if (headerAuth && headerAuth.startsWith("Bearer ")) return headerAuth;

  const token = req.cookies?.token || req.cookies?.access_token;
  if (token) return `Bearer ${token}`;

  return null;
}

function backendUrl(path) {
  const baseUrl = getBackendBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function appendQueryParams(url, query) {
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, String(v)));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
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

async function proxyJson(req, res, config) {
  const authHeader = getAuthHeader(req);
  const response = await fetch(config.url, {
    method: config.method,
    headers: {
      Accept: "application/json",
      ...(config.withBody ? { "Content-Type": "application/json" } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    ...(config.withBody ? { body: JSON.stringify(req.body ?? {}) } : {}),
  });

  const data = await readJsonSafe(response);
  return res.status(response.status).json(data ?? {});
}

router.get("/sales/whatsapp/meta", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "GET", url: backendUrl("/sales/whatsapp/meta") });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/meta error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/integrations", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "GET", url: backendUrl("/sales/whatsapp/integrations") });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/integrations error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/integrations/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/sales/whatsapp/integrations/${encodeURIComponent(req.params.id)}`),
    });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/integrations/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/integrations", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/sales/whatsapp/integrations"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/integrations error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/integrations/provision", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/sales/whatsapp/integrations/provision"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/integrations/provision error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/sales/whatsapp/integrations/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/sales/whatsapp/integrations/${encodeURIComponent(req.params.id)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/sales/whatsapp/integrations/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/integrations/:id/connect", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/sales/whatsapp/integrations/${encodeURIComponent(req.params.id)}/connect`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/integrations/:id/connect error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/integrations/:id/test-send", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/sales/whatsapp/integrations/${encodeURIComponent(req.params.id)}/test-send`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/integrations/:id/test-send error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/integrations/:id/qrcode", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/sales/whatsapp/integrations/${encodeURIComponent(req.params.id)}/qrcode`),
    });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/integrations/:id/qrcode error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/conversations", async (req, res) => {
  try {
    const url = new URL(backendUrl("/sales/whatsapp/conversations"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/conversations error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/conversations/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}`),
    });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/conversations/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/conversations/:id/messages", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/messages`),
    });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/conversations/:id/messages error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/sales/whatsapp/conversations/:id/workflow", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/workflow`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/sales/whatsapp/conversations/:id/workflow error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/conversations/:id/claim", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/claim`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/conversations/:id/claim error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/conversations/:id/release", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/release`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/conversations/:id/release error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/conversations/:id/reply", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/reply`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/conversations/:id/reply error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/conversations/:id/reprocess", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/reprocess`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/conversations/:id/reprocess error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/conversations/:id/notes", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/notes`),
    });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/conversations/:id/notes error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/conversations/:id/notes", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/notes`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/conversations/:id/notes error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/sales/whatsapp/conversations/:id/consent", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/sales/whatsapp/conversations/${encodeURIComponent(req.params.id)}/consent`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/sales/whatsapp/conversations/:id/consent error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/templates", async (req, res) => {
  try {
    const url = new URL(backendUrl("/sales/whatsapp/templates"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/templates error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/templates", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/sales/whatsapp/templates"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/templates error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/sales/whatsapp/templates/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/sales/whatsapp/templates/${encodeURIComponent(req.params.id)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/sales/whatsapp/templates/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/campaigns", async (req, res) => {
  try {
    const url = new URL(backendUrl("/sales/whatsapp/campaigns"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/campaigns error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/sales/whatsapp/campaigns/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/sales/whatsapp/campaigns/${encodeURIComponent(req.params.id)}`),
    });
  } catch (error) {
    console.error("GET /api/sales/whatsapp/campaigns/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/campaigns", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/sales/whatsapp/campaigns"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/campaigns error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/sales/whatsapp/campaigns/:id", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/sales/whatsapp/campaigns/${encodeURIComponent(req.params.id)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/sales/whatsapp/campaigns/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/campaigns/:id/launch", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/sales/whatsapp/campaigns/${encodeURIComponent(req.params.id)}/launch`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/campaigns/:id/launch error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/sales/whatsapp/webhook/:token", async (req, res) => {
  try {
    const url = new URL(backendUrl(`/sales/whatsapp/webhook/${encodeURIComponent(req.params.token)}`));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, {
      method: "POST",
      url: url.toString(),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/sales/whatsapp/webhook/:token error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
