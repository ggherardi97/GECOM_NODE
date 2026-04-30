const express = require("express");
const {
  getBackendBaseUrl,
  getAuthHeader,
  readJsonSafe,
  buildBackendHeaders,
} = (() => {
  const base = require("./_externalAccess");
  return {
    ...base,
    buildBackendHeaders(req, authHeader, hasBody) {
      return {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(req?.headers?.cookie ? { Cookie: req.headers.cookie } : {}),
      };
    },
  };
})();

const router = express.Router();

function getBackendApiBaseUrl() {
  const raw = getBackendBaseUrl();
  return /\/api$/i.test(raw) ? raw : `${raw}/api`;
}

router.get("/google-calendar/connect", async (req, res) => {
  try {
    const baseUrl = getBackendApiBaseUrl();
    const authHeader = getAuthHeader(req);
    if (!authHeader) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const qs = new URLSearchParams(req.query || {}).toString();
    const target = `${baseUrl}/google-calendar/connect${qs ? `?${qs}` : ""}`;
    return res.redirect(target);
  } catch (error) {
    console.error("GET /google-calendar/connect proxy error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/google-calendar/callback", async (req, res) => {
  try {
    const baseUrl = getBackendApiBaseUrl();
    const authHeader = getAuthHeader(req);
    const qs = new URLSearchParams(req.query || {}).toString();
    const target = `${baseUrl}/google-calendar/callback${qs ? `?${qs}` : ""}`;

    const response = await fetch(target, {
      method: "GET",
      headers: {
        Accept: "text/html,application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
        ...(req?.headers?.cookie ? { Cookie: req.headers.cookie } : {}),
      },
      redirect: "manual",
    });

    const contentType = response.headers.get("content-type") || "text/html; charset=utf-8";
    const body = await response.text().catch(() => "");
    return res.status(response.status).set("Content-Type", contentType).send(body);
  } catch (error) {
    console.error("GET /google-calendar/callback proxy error:", error);
    return res.status(500).send("Falha ao concluir a conexão com Google Agenda.");
  }
});

async function proxyGoogleCalendar(req, res) {
  try {
    const baseUrl = getBackendApiBaseUrl();
    const authHeader = getAuthHeader(req);
    if (!authHeader) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const backendUrl = `${baseUrl}${req.originalUrl.replace(/^\/api/, "")}`;
    const hasBody = !["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase());

    const response = await fetch(backendUrl, {
      method: req.method,
      headers: buildBackendHeaders(req, authHeader, hasBody),
      ...(hasBody ? { body: JSON.stringify(req.body || {}) } : {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data || {});
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} proxy error:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

router.get("/google-calendar/status", proxyGoogleCalendar);
router.get("/google-calendar/calendars", proxyGoogleCalendar);
router.post("/google-calendar/settings", proxyGoogleCalendar);
router.post("/google-calendar/sync-now", proxyGoogleCalendar);
router.post("/google-calendar/disconnect", proxyGoogleCalendar);

module.exports = router;
