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
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

/**
 * Build a query string for listing documents.
 * We support both parent_id and path for backward-compatibility:
 * - If parent_id is provided, we send it as `path` to the backend (since your controller currently reads `path` as parent_id).
 * - If only path is provided, we pass it through as-is.
 */
function buildDocumentsListQuery(req) {
  const qs = new URLSearchParams();

  // Preferred param: parent_id (folder navigation)
  const parentId = req.query.parent_id;

  // Backward compatibility param: path (your backend reads it and maps to parent_id)
  const path = req.query.path;

  // Keep current backend contract: it expects query param "path" but uses it as parent_id.
  if (parentId !== undefined && String(parentId) !== "") {
    qs.set("path", String(parentId));
  } else if (path !== undefined && String(path) !== "") {
    qs.set("path", String(path));
  }

  const allowed = ["account_id", "related_table", "related_id", "item_type", "q", "take", "skip"];
  for (const key of allowed) {
    if (req.query[key] !== undefined && String(req.query[key]) !== "") {
      qs.set(key, String(req.query[key]));
    }
  }

  return qs;
}

// -----------------------------------------------------------------------------// GET /api/documents?account_id=&parent_id=&path=&related_table=&related_id=&item_type=&q=&take=&skip=
// -----------------------------------------------------------------------------
router.get("/documents", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const qs = buildDocumentsListQuery(req);
    const url = `${baseUrl}/documents${qs.toString() ? `?${qs.toString()}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// POST /api/documents -> backend POST /documents
// -----------------------------------------------------------------------------
router.post("/documents", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/documents`, {
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
    console.error("POST /api/documents error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// PATCH /api/documents/:id -> backend PATCH /documents/:id
// -----------------------------------------------------------------------------
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
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/documents/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// DELETE /api/documents/:id -> backend DELETE /documents/:id
// -----------------------------------------------------------------------------
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
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/documents/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// POST /api/documents/:id/presign-upload -> backend POST /documents/:id/presign-upload
// Body example:
// {
//   "fileName": "Contrato.pdf",
//   "contentType": "application/pdf",
//   "size": 123456
// }
// -----------------------------------------------------------------------------
router.post("/documents/:id/presign-upload", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}/presign-upload`, {
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
    console.error("POST /api/documents/:id/presign-upload error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// GET /api/documents/:id/presign-download -> backend GET /documents/:id/presign-download
// -----------------------------------------------------------------------------
router.get("/documents/:id/presign-download", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}/presign-download`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/documents/:id/presign-download error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// POST /api/documents/:id/complete-upload -> backend PATCH /documents/:id
// Use this after the PUT to R2 succeeds, to mark upload_status as UPLOADED and/or save object_key, etag, etc.
//
// Body example:
// {
//   "upload_status": "UPLOADED",
//   "object_key": "rel/processes/<id>/Contrato.pdf",
//   "etag": "\"abc123\"",
//   "mime_type": "application/pdf",
//   "size_bytes": 123456
// }
// -----------------------------------------------------------------------------
router.post("/documents/:id/complete-upload", async (req, res) => {
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
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/documents/:id/complete-upload error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
