// routes/processesApi.js
const express = require("express");
const {
  getBackendBaseUrl,
  getAuthHeader,
  readJsonSafe,
  resolveExternalAccessContext,
  denyExternalWrite,
  forceCompanyIdParam,
  pickCompanyId,
} = require("./_externalAccess");

const router = express.Router();

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/* -------------------- GET /api/processes -------------------- */
router.get("/processes", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });

    // Forward query params (e.g. ?company_id=...)
    const url = new URL(`${baseUrl}/processes`);
    const query = req.query ?? {};
    for (const [key, value] of Object.entries(query)) {
      if (value == null) continue;

      // support arrays: ?x=a&x=b
      if (Array.isArray(value)) {
        value.forEach((v) => url.searchParams.append(key, String(v)));
      } else {
        url.searchParams.set(key, String(value));
      }
    }
    if (externalContext.enforceCompanyScope && externalContext.userCompanyId) {
      forceCompanyIdParam(url.searchParams, externalContext.userCompanyId);
    }

    const response = await fetch(url.toString(), {
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
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });

    const response = await fetch(`${baseUrl}/processes/${encodeURIComponent(id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    if (response.ok && externalContext.enforceCompanyScope && externalContext.userCompanyId) {
      const processCompanyId = pickCompanyId(data);
      if (!processCompanyId || String(processCompanyId) !== String(externalContext.userCompanyId)) {
        return res.status(403).json({ message: "Acesso negado para processo de outra empresa." });
      }
    }
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
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });

    if (externalContext.enforceCompanyScope && externalContext.userCompanyId) {
      const processResp = await fetch(`${baseUrl}/processes/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });
      const processData = await readJsonSafe(processResp);
      if (!processResp.ok) {
        return res.status(processResp.status).json(processData ?? {});
      }
      const processCompanyId = pickCompanyId(processData);
      if (!processCompanyId || String(processCompanyId) !== String(externalContext.userCompanyId)) {
        return res.status(403).json({ message: "Acesso negado para processo de outra empresa." });
      }
    }

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
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

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
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

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
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

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

/* -------------------- PATCH /api/processes/:id -------------------- */
router.patch("/processes/:id", async (req, res) => {
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
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

    const response = await fetch(`${baseUrl}/processes/${encodeURIComponent(id)}`, {
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
    console.error("PATCH /api/processes/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});


module.exports = router;
