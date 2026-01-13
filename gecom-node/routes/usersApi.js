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

/* -------------------- GET /api/users/:id -------------------- */
// Forwards to BACKEND_API_BASE_URL/users/{id}
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

    const text = await response.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text ? { message: text } : null;
    }

    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/users/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// POST /api/users  -> forwards to BACKEND_API_BASE_URL/users
router.post("/users", async (req, res) => {
  try {
    const { full_name, email, password, role, status } = req.body ?? {};

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

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const payload = {
      full_name: String(full_name).trim(),
      email: String(email).trim(),
      password: String(password),
      role: isNonEmptyString(role) ? String(role).trim() : "USER",
      status: isNonEmptyString(status) ? String(status).trim() : "ACTIVE",
    };

    const response = await fetch(`${baseUrl}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text ? { message: text } : null;
    }

    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/users error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- PATCH /api/users/:id -------------------- */
// Forwards to BACKEND_API_BASE_URL/users/{id}
router.patch("/users/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};

    if (!isNonEmptyString(id)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid path parameter.",
        missing: ["id"],
      });
    }

    // Allow partial updates; only forward known fields if present
    const { full_name, email, role, status, password } = req.body ?? {};

    const payload = {};
    if (isNonEmptyString(full_name)) payload.full_name = String(full_name).trim();
    if (isNonEmptyString(email)) payload.email = String(email).trim();
    if (isNonEmptyString(role)) payload.role = String(role).trim();
    if (isNonEmptyString(status)) payload.status = String(status).trim();
    // Optional: only if your backend supports updating password via PATCH
    if (isNonEmptyString(password)) payload.password = String(password);

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        message: "Validation error. No valid fields to update.",
        allowed: ["full_name", "email", "role", "status", "password"],
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

    const text = await response.text();

    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text ? { message: text } : null;
    }

    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/users/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- DELETE /api/users/:id -------------------- */
// Removes a user
router.delete("/users/:id", async (req, res) => {
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

    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/users/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;