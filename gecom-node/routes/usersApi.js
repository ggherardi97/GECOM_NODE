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

/* -------------------- GET /api/users (list/filter) -------------------- */
/**
 * Forwards to BACKEND: GET {BACKEND}/users?...
 * Supports filters like:
 * - /api/users?company_id=...
 * - /api/users?email=...
 * - /api/users?search=...
 */
router.get("/users", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(req.query ?? {})) {
      if (v == null) continue;
      const s = String(v).trim();
      if (!s) continue;
      qs.set(k, s);
    }

    const url = qs.toString() ? `${baseUrl}/users?${qs.toString()}` : `${baseUrl}/users`;

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
    console.error("GET /api/users error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

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
    const { full_name, email, password, role, status, phonenumber, first_access, company_id, profile_picture } = req.body ?? {};

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

    // ✅ profile picture (optional)
    if (isNonEmptyString(profile_picture)) payload.profile_picture = String(profile_picture);

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

    // ✅ profile picture (base64/dataURL)
    if (hasOwn(body, "profile_picture")) payload.profile_picture = body.profile_picture == null ? null : String(body.profile_picture);

    if (Object.keys(payload).length === 0) {
      return res.status(400).json({
        message: "Validation error. No valid fields to update.",
        allowed: ["full_name", "email", "role", "status", "phonenumber", "first_access", "password", "company_id", "profile_picture"],
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

router.get("/users/by-email", async (req, res) => {
  try {
    const email = String(req.query?.email || "").trim();

    if (!isNonEmptyString(email)) {
      return res.status(400).json({
        message: "Validation error. Missing or invalid query parameter.",
        missing: ["email"],
      });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    async function callBackend(path) {
      const response = await fetch(`${baseUrl}${path}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });

      const data = await readJsonSafe(response);
      return { response, data };
    }

    let result = await callBackend(`/users/by-email?email=${encodeURIComponent(email)}`);
    if (result.response.ok) return res.status(200).json(result.data ?? {});

    result = await callBackend(`/users?email=${encodeURIComponent(email)}`);
    if (result.response.ok) {
      const rows = Array.isArray(result.data)
        ? result.data
        : (result.data?.data ?? result.data?.rows ?? result.data?.users ?? []);

      const first = Array.isArray(rows) ? rows[0] : null;
      if (first) return res.status(200).json(first);
    }

    result = await callBackend(`/users?search=${encodeURIComponent(email)}`);
    if (result.response.ok) {
      const rows = Array.isArray(result.data)
        ? result.data
        : (result.data?.data ?? result.data?.rows ?? result.data?.users ?? []);

      const first = Array.isArray(rows) ? rows[0] : null;
      if (first) return res.status(200).json(first);
    }

    return res.status(404).json({
      message: "User not found by email.",
      email,
    });
  } catch (error) {
    console.error("GET /api/users/by-email error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- GET /api/auth/me -------------------- */
/**
 * Forwards to BACKEND: GET {BACKEND_API_BASE_URL}/auth/me
 * Sends cookies through (refresh_token is HttpOnly) so backend can resolve current user.
 */
router.get("/auth/me", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();

    // Forward cookies to backend (refresh_token lives in HttpOnly cookie)
    const cookieHeader = req.headers.cookie || "";

    const response = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: cookieHeader,
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/auth/me error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
/* -------------------- GET /api/users/:id/profile-picture -------------------- */
/**
 * Forwards to BACKEND: GET {BACKEND}/users/:id/profile-picture
 * Returns only the profile picture (base64/dataURL) to keep pages fast.
 */
router.get("/users/:id/profile-picture", async (req, res) => {
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

    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(id)}/profile-picture`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/users/:id/profile-picture error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});
/* -------------------- GET /api/users/me/profile-picture -------------------- */
router.get("/users/me/profile-picture", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/users/me/profile-picture`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/users/me/profile-picture error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- PATCH /api/users/me/profile-picture -------------------- */
router.patch("/users/me/profile-picture", async (req, res) => {
  try {
    const body = req.body ?? {};
    const base64 = body.base64 == null ? "" : String(body.base64);

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/users/me/profile-picture`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ base64 }),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/users/me/profile-picture error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- GET /api/users/:id/profile-picture -------------------- */
router.get("/users/:id/profile-picture", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    if (!isNonEmptyString(id)) {
      return res.status(400).json({ message: "Validation error. Missing id." });
    }

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(id)}/profile-picture`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/users/:id/profile-picture error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- PATCH /api/users/:id/profile-picture -------------------- */
router.patch("/users/:id/profile-picture", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    if (!isNonEmptyString(id)) {
      return res.status(400).json({ message: "Validation error. Missing id." });
    }

    const body = req.body ?? {};
    const base64 = body.base64 == null ? "" : String(body.base64);

    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/users/${encodeURIComponent(id)}/profile-picture`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify({ base64 }),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/users/:id/profile-picture error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;