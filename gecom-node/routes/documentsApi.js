// routes/documentsApi.js
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
  try { return JSON.parse(text); } catch { return { message: text }; }
}

// GET /api/documents?account_id=&path=&related_table=&related_id=&item_type=&q=&take=&skip=
router.get("/documents", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const qs = new URLSearchParams();
    const allowed = ["account_id", "path", "related_table", "related_id", "item_type", "q", "take", "skip"];
    for (const key of allowed) {
      if (req.query[key] !== undefined && req.query[key] !== "") qs.set(key, String(req.query[key]));
    }

    const url = `${baseUrl}/documents${qs.toString() ? `?${qs.toString()}` : ""}`;

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
    console.error("GET /api/documents error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/documents -> backend POST /documents
router.post("/documents", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/documents`, {
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
    console.error("POST /api/documents error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/documents/:id -> backend PATCH /documents/:id
router.patch("/documents/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}`, {
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
    console.error("PATCH /api/documents/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// DELETE /api/documents/:id -> backend DELETE /documents/:id
router.delete("/documents/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/documents/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
