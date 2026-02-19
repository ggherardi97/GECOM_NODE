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

function hasOwn(obj, key) {
  return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
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

router.post("/tenants", async (req, res) => {
  try {
    const body = req.body ?? {};
    const payload = {};

    if (isNonEmptyString(body.name)) payload.name = String(body.name).trim();
    if (isNonEmptyString(body.slug)) payload.slug = String(body.slug).trim();
    if (isNonEmptyString(body.company_id)) payload.company_id = String(body.company_id).trim();
    if (hasOwn(body, "status")) payload.status = body.status;

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/tenants`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/tenants error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/tenants", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const url = new URL(`${baseUrl}/tenants`);
    for (const [key, value] of Object.entries(req.query ?? {})) {
      if (value == null) continue;
      if (Array.isArray(value)) value.forEach((v) => url.searchParams.append(key, String(v)));
      else url.searchParams.set(key, String(value));
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/tenants error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};

    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"],
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/tenants/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/tenants/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"],
      });
    }

    const body = req.body ?? {};
    const payload = {};

    if (isNonEmptyString(body.name)) payload.name = String(body.name).trim();
    if (isNonEmptyString(body.slug)) payload.slug = String(body.slug).trim();
    if (hasOwn(body, "company_id")) {
      payload.company_id = body.company_id == null ? null : String(body.company_id).trim();
    }
    if (hasOwn(body, "status")) payload.status = body.status;

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        message: "Validation error. No valid fields to update.",
        allowed: ["name", "slug", "company_id", "status"],
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/tenants/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/tenants/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/tenants/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"],
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/tenants/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/tenants/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
