// routes/transportTypesApi.js
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

/* -------------------- GET /transport-types -------------------- */
router.get("/transport-types", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/transport-types`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/transport-types error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/* -------------------- GET /transport-types/:id -------------------- */
router.get("/transport-types/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/transport-types/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/transport-types/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/* -------------------- POST /transport-types -------------------- */
router.post("/transport-types", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/transport-types`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/transport-types error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/* -------------------- PATCH /transport-types/:id -------------------- */
router.patch("/transport-types/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/transport-types/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/transport-types/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

/* -------------------- DELETE /transport-types/:id -------------------- */
router.delete("/transport-types/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/transport-types/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    // If backend returns 204 No Content, keep it as such
    if (response.status === 204) return res.status(204).send();

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/transport-types/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

module.exports = router;