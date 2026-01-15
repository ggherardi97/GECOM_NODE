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
    if (!hasOwn(req.body, "password")) missing.push("password"); // allow empty string password

    if (missing.length > 0) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid fields.",
        missing,
      });
    }

    const payload = {
      full_name: String(full_name).trim(),
      email: String(email).trim(),
      password: String(password ?? ""),
      role: isNonEmptyString(role) ? String(role).trim() : "USER",
      status: isNonEmptyString(status) ? String(status).trim() : "ACTIVE",
    };

    if (isNonEmptyString(phonenumber)) payload.phonenumber = String(phonenumber).trim();
    if (hasOwn(req.body, "first_access")) payload.first_access = req.body.first_access;

    // ✅ allow link user -> company (N users -> 1 company)
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
    const payload = {};

    if (isNonEmptyString(body.full_name)) payload.full_name = String(body.full_name).trim();
    if (isNonEmptyString(body.email)) payload.email = String(body.email).trim();
    if (isNonEmptyString(body.role)) payload.role = String(body.role).trim();
    if (isNonEmptyString(body.status)) payload.status = String(body.status).trim();
    if (isNonEmptyString(body.phonenumber)) payload.phonenumber = String(body.phonenumber).trim();
    if (hasOwn(body, "first_access")) payload.first_access = body.first_access;
    if (isNonEmptyString(body.password)) payload.password = String(body.password);

    // ✅ allow update membership
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
