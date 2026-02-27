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

async function proxyProjectOperations(req, res) {
  try {
    const authHeader = getAuthHeader(req);
    const path = req.originalUrl.replace(/^\/api/, "");
    const backendUrl = `${getBackendBaseUrl()}${path}`;
    const hasBody = !["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase());

    const response = await fetch(backendUrl, {
      method: req.method,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
        ...(hasBody ? { body: JSON.stringify(req.body || {}) } : {}),
      });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data || {});
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} proxy error:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

router.use("/project-operations", proxyProjectOperations);

module.exports = router;
