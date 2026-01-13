// routes/processesApi.js
const express = require("express");

const router = express.Router();

function getBackendBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;
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
  if (token) {
    return `Bearer ${token}`;
  }

  return null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

/* -------------------- GET /api/processes -------------------- */
router.get("/processes", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/processes`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/processes error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- GET /api/processes/:id -------------------- */
router.get("/processes/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};

    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"]
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/processes/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/processes/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- GET /api/processes/:id/events -------------------- */
router.get("/processes/:id/events", async (req, res) => {
  try {
    const { id } = req.params ?? {};

    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"]
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(
      `${baseUrl}/processes/${encodeURIComponent(id)}/events`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {})
        }
      }
    );

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/processes/:id/events error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- POST /api/processes -------------------- */
router.post("/processes", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    // No hard validation here; backend is source of truth.
    // But we still forward exactly what the UI sends.
    const response = await fetch(`${baseUrl}/processes`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(req.body ?? {})
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/processes error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- PATCH /api/processes/:id/status -------------------- */
router.patch("/processes/:id/status", async (req, res) => {
  try {
    const { id } = req.params ?? {};

    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"]
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(
      `${baseUrl}/processes/${encodeURIComponent(id)}/status`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {})
        },
        body: JSON.stringify(req.body ?? {})
      }
    );

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/processes/:id/status error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- DELETE /api/processes/:id -------------------- */
router.delete("/processes/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};

    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"]
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/processes/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/processes/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
