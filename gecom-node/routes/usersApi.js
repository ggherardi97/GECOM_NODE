// routes/usersApi.js
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
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    // if backend returned non-json error
    return { message: text };
  }
}

/* -------------------- GET /api/users/:id -------------------- */
router.get("/users/:id", async (req, res) => {
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

    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/users/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- POST /api/users -------------------- */
router.post("/users", async (req, res) => {
  try {
    const { full_name, email, password, role, status, phonenumber, first_access, company_id } = req.body ?? {};

    const missing = [];
    if (!isNonEmptyString(full_name)) missing.push("full_name");
    if (!isNonEmptyString(email)) missing.push("email");
    if (!isNonEmptyString(password)) missing.push("password");

    if (missing.length > 0) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid fields.",
        missing,
      });
    }

    const payload = {
      full_name: String(full_name).trim(),
      email: String(email).trim(),
      password: String(password),
      role: isNonEmptyString(role) ? String(role).trim() : "USER",
      status: isNonEmptyString(status) ? String(status).trim() : "ACTIVE",
    };

    // Optional fields if your backend supports them on POST
    if (isNonEmptyString(phonenumber)) payload.phonenumber = String(phonenumber).trim();

    // allow boolean/number/string for first_access
    if (hasOwn(req.body, "first_access")) payload.first_access = req.body.first_access;

    // ✅ NEW: allow linking user -> company (N users : 1 company)
    // Only send if provided and non-empty
    if (isNonEmptyString(company_id)) payload.company_id = String(company_id).trim();

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/users`, {
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
    console.error("POST /api/users error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- PATCH /api/users/:id -------------------- */
router.patch("/users/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};

    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"],
      });
    }

    const body = req.body ?? {};

    // Allow partial updates; only forward known fields if present
    const payload = {};

    if (isNonEmptyString(body.full_name)) payload.full_name = String(body.full_name).trim();
    if (isNonEmptyString(body.email)) payload.email = String(body.email).trim();
    if (isNonEmptyString(body.role)) payload.role = String(body.role).trim();
    if (isNonEmptyString(body.status)) payload.status = String(body.status).trim();

    // ✅ send the correct field name
    if (isNonEmptyString(body.phonenumber)) payload.phonenumber = String(body.phonenumber).trim();

    // first_access might be boolean/number/string (do not block false/0)
    if (hasOwn(body, "first_access")) payload.first_access = body.first_access;

    // Optional: only if your backend supports updating password via PATCH
    if (isNonEmptyString(body.password)) payload.password = String(body.password);

    // ✅ NEW: allow linking user -> company (N users : 1 company)
    if (isNonEmptyString(body.company_id)) payload.company_id = String(body.company_id).trim();

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        message: "Validation error. No valid fields to update.",
        allowed: ["full_name", "email", "role", "status", "phonenumber", "first_access", "password", "company_id"],
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(id)}`, {
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
    console.error("PATCH /api/users/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- DELETE /api/users/:id -------------------- */
router.delete("/users/:id", async (req, res) => {
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

    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/users/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
