// routes/notificationsApi.js
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

/**
 * GET /api/notifications/my?unread_only=true
 * Proxies backend: GET /notifications/my
 */
router.get("/notifications/my", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const qs = new URLSearchParams();
    if (req.query.unread_only !== undefined && req.query.unread_only !== "") {
      qs.set("unread_only", String(req.query.unread_only));
    }

    const url = `${baseUrl}/notifications/my${qs.toString() ? `?${qs.toString()}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/notifications/my error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/notifications/admin?company_id=&is_active=&q=&include_expired=
 * Proxies backend: GET /notifications/admin
 */
router.get("/notifications/admin", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const qs = new URLSearchParams();
    if (req.query.company_id) qs.set("company_id", String(req.query.company_id));
    if (req.query.is_active !== undefined && req.query.is_active !== "") {
      qs.set("is_active", String(req.query.is_active));
    }
    if (req.query.q) qs.set("q", String(req.query.q));
    if (req.query.include_expired !== undefined && req.query.include_expired !== "") {
      qs.set("include_expired", String(req.query.include_expired));
    }

    const url = `${baseUrl}/notifications/admin${qs.toString() ? `?${qs.toString()}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/notifications/admin error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * GET /api/notifications/:id
 * Proxies backend: (não existe no meu controller por default)
 * -> Se você quiser, cria no backend também. Mantive aqui porque às vezes você usa no front.
 */
router.get("/notifications/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const notificationId = String(req.params.id || "").trim();
    if (!notificationId) return res.status(400).json({ message: "Missing notification id" });

    const response = await fetch(`${baseUrl}/notifications/${encodeURIComponent(notificationId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/notifications/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/notifications
 * Proxies backend: POST /notifications
 */
router.post("/notifications", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/notifications`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(req.body ?? {})
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/notifications error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * PATCH /api/notifications/:id
 * Proxies backend: PATCH /notifications/:id
 */
router.patch("/notifications/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const notificationId = String(req.params.id || "").trim();
    if (!notificationId) return res.status(400).json({ message: "Missing notification id" });

    const response = await fetch(`${baseUrl}/notifications/${encodeURIComponent(notificationId)}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(req.body ?? {})
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/notifications/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * DELETE /api/notifications/:id
 * Proxies backend: DELETE /notifications/:id
 */
router.delete("/notifications/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const notificationId = String(req.params.id || "").trim();
    if (!notificationId) return res.status(400).json({ message: "Missing notification id" });

    const response = await fetch(`${baseUrl}/notifications/${encodeURIComponent(notificationId)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/notifications/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/**
 * POST /api/notifications/:id/read
 * Proxies backend: POST /notifications/:id/read
 */
router.post("/notifications/:id/read", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const notificationId = String(req.params.id || "").trim();
    if (!notificationId) return res.status(400).json({ message: "Missing notification id" });

    const response = await fetch(`${baseUrl}/notifications/${encodeURIComponent(notificationId)}/read`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/notifications/:id/read error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;