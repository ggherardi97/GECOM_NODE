// routes/savedViewsApi.js
const express = require("express");
const router = express.Router();

function getBackendBaseUrl() {
  const baseUrl = process.env.API_BASE_URL;
  if (!baseUrl) throw new Error("Missing API_BASE_URL env var.");
  return baseUrl.replace(/\/$/, "");
}

function getAuthHeader(req) {
  const headerAuth = req.headers.authorization;
  if (headerAuth && headerAuth.startsWith("Bearer ")) return headerAuth;

  const token = req.cookies?.token || req.cookies?.access_token;
  if (token) return `Bearer ${token}`;

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

function backendUrl(path) {
  const baseUrl = getBackendBaseUrl();
  // ✅ DO NOT prefix /api here. /api exists only on the front (BFF).
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

/* -------------------- GET /api/saved-views -------------------- */
router.get("/saved-views", async (req, res) => {
  try {
    const authHeader = getAuthHeader(req);

    const url = new URL(backendUrl("/saved-views"));
    const query = req.query ?? {};
    for (const [key, value] of Object.entries(query)) {
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
    console.error("GET /api/saved-views error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- GET /api/saved-views/:id -------------------- */
router.get("/saved-views/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    if (!isNonEmptyString(id)) {
      return res.status(400).json({ message: "Validation error.", missing: ["id"] });
    }

    const authHeader = getAuthHeader(req);

    const response = await fetch(backendUrl(`/saved-views/${encodeURIComponent(id)}`), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/saved-views/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- POST /api/saved-views -------------------- */
router.post("/saved-views", async (req, res) => {
  try {
    const authHeader = getAuthHeader(req);

    const response = await fetch(backendUrl("/saved-views"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/saved-views error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- PATCH /api/saved-views/:id -------------------- */
router.patch("/saved-views/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    if (!isNonEmptyString(id)) {
      return res.status(400).json({ message: "Validation error.", missing: ["id"] });
    }

    const authHeader = getAuthHeader(req);

    const response = await fetch(backendUrl(`/saved-views/${encodeURIComponent(id)}`), {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/saved-views/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- DELETE /api/saved-views/:id -------------------- */
router.delete("/saved-views/:id", async (req, res) => {
  try {
    const { id } = req.params ?? {};
    if (!isNonEmptyString(id)) {
      return res.status(400).json({ message: "Validation error.", missing: ["id"] });
    }

    const authHeader = getAuthHeader(req);

    const response = await fetch(backendUrl(`/saved-views/${encodeURIComponent(id)}`), {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/saved-views/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- GET /api/saved-views/default/:entityName -------------------- */
router.get("/saved-views/default/:entityName", async (req, res) => {
  try {
    const { entityName } = req.params ?? {};
    if (!isNonEmptyString(entityName)) {
      return res.status(400).json({ message: "Validation error.", missing: ["entityName"] });
    }

    const authHeader = getAuthHeader(req);

    const response = await fetch(backendUrl(`/saved-views/default/${encodeURIComponent(entityName)}`), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/saved-views/default/:entityName error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- PUT /api/saved-views/default/:entityName/:savedViewId -------------------- */
router.put("/saved-views/default/:entityName/:savedViewId", async (req, res) => {
  try {
    const { entityName, savedViewId } = req.params ?? {};
    if (!isNonEmptyString(entityName) || !isNonEmptyString(savedViewId)) {
      return res.status(400).json({
        message: "Validation error.",
        missing: [
          ...(isNonEmptyString(entityName) ? [] : ["entityName"]),
          ...(isNonEmptyString(savedViewId) ? [] : ["savedViewId"]),
        ],
      });
    }

    const authHeader = getAuthHeader(req);

    const response = await fetch(
      backendUrl(`/saved-views/default/${encodeURIComponent(entityName)}/${encodeURIComponent(savedViewId)}`),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(req.body ?? {}),
      }
    );

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PUT /api/saved-views/default/:entityName/:savedViewId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

/* -------------------- DELETE /api/saved-views/default/:entityName -------------------- */
router.delete("/saved-views/default/:entityName", async (req, res) => {
  try {
    const { entityName } = req.params ?? {};
    if (!isNonEmptyString(entityName)) {
      return res.status(400).json({ message: "Validation error.", missing: ["entityName"] });
    }

    const authHeader = getAuthHeader(req);

    const response = await fetch(backendUrl(`/saved-views/default/${encodeURIComponent(entityName)}`), {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/saved-views/default/:entityName error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;