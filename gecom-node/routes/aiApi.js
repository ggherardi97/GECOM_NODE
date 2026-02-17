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
  const baseUrl = getBackendBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
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

router.post("/ai/grid-filter", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/ai/grid-filter"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/ai/grid-filter error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/ai/dashboard", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/ai/dashboard"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/ai/dashboard error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/ai/home-search", async (req, res) => {
  try {
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl("/ai/home-search"),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/ai/home-search error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;

