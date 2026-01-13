// routes/companiesApi.js
const express = require("express");

const router = express.Router();

function getBackendBaseUrl() {
  const baseUrl = process.env.API_BASE_URL || process.env.BACKEND_API_BASE_URL;
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

/* -------------------- GET /companies -------------------- */
router.get("/companies", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/companies`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/companies error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- GET /companies/:id -------------------- */
router.get("/companies/:id", async (req, res) => {
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

    const response = await fetch(`${baseUrl}/companies/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/companies/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- POST /companies -------------------- */
router.post("/companies", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/companies`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(req.body ?? {})
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/companies error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- PATCH /companies/:id -------------------- */
router.patch("/companies/:id", async (req, res) => {
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

    const response = await fetch(`${baseUrl}/companies/${encodeURIComponent(id)}`, {
      method: "PATCH",
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
    console.error("PATCH /api/companies/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- DELETE /companies/:id -------------------- */
// Soft delete a company (marks as deleted)
router.delete("/companies/:id", async (req, res) => {
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

    const response = await fetch(`${baseUrl}/companies/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);

    // If backend returns 204 No Content, keep it as empty object
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/companies/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;