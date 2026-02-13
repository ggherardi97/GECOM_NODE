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
  if (headerAuth && headerAuth.startsWith("Bearer ")) return headerAuth;

  const token = req.cookies?.token || req.cookies?.access_token;
  if (token) return `Bearer ${token}`;

  return null;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
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

function backendUrl(path) {
  const baseUrl = getBackendBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function appendQueryParams(url, query) {
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((v) => url.searchParams.append(key, String(v)));
    } else {
      url.searchParams.set(key, String(value));
    }
  }
}

async function proxyJson(req, res, config) {
  const authHeader = getAuthHeader(req);
  const response = await fetch(config.url, {
    method: config.method,
    headers: {
      Accept: "application/json",
      ...(config.withBody ? { "Content-Type": "application/json" } : {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
    ...(config.withBody ? { body: JSON.stringify(req.body ?? {}) } : {}),
  });

  const data = await readJsonSafe(response);
  return res.status(response.status).json(data ?? {});
}

router.get("/leads/stages", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "GET", url: backendUrl("/leads/stages") });
  } catch (error) {
    console.error("GET /api/leads/stages error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/leads/stages", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "POST", url: backendUrl("/leads/stages"), withBody: true });
  } catch (error) {
    console.error("POST /api/leads/stages error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/leads/stages/:stageId", async (req, res) => {
  try {
    const { stageId } = req.params ?? {};
    if (!isNonEmptyString(stageId)) return res.status(400).json({ message: "Validation error.", missing: ["stageId"] });
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/leads/stages/${encodeURIComponent(stageId)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/leads/stages/:stageId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/leads", async (req, res) => {
  try {
    const url = new URL(backendUrl("/leads"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/leads error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/leads/:leadId", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}`),
    });
  } catch (error) {
    console.error("GET /api/leads/:leadId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/leads", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "POST", url: backendUrl("/leads"), withBody: true });
  } catch (error) {
    console.error("POST /api/leads error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/leads/:leadId", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/leads/:leadId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/leads/:leadId", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PUT /api/leads/:leadId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/leads/:leadId/stage", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });

    const raw = req.body ?? {};
    const stageId = raw.stage_id ?? raw.stageId ?? raw.target_stage_id ?? raw.targetStageId ?? raw.stage;
    req.body = {
      ...(stageId ? { stage_id: stageId } : {}),
      ...(raw.note != null ? { note: raw.note } : {}),
    };

    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}/stage`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/leads/:leadId/stage error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/leads/:leadId/stage", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });

    const raw = req.body ?? {};
    const stageId = raw.stage_id ?? raw.stageId ?? raw.target_stage_id ?? raw.targetStageId ?? raw.stage;
    req.body = {
      ...(stageId ? { stage_id: stageId } : {}),
      ...(raw.note != null ? { note: raw.note } : {}),
    };

    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}/stage`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/leads/:leadId/stage error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/leads/:leadId/status", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });

    const raw = req.body ?? {};
    const status = String(raw.status || "").toUpperCase();
    if (status === "WON" || status === "CONVERTED") {
      req.body = {
        ...(raw.company_id ? { company_id: raw.company_id } : {}),
        ...(raw.contact_id ? { contact_id: raw.contact_id } : {}),
      };
      return await proxyJson(req, res, {
        method: "POST",
        url: backendUrl(`/leads/${encodeURIComponent(leadId)}/convert`),
        withBody: true,
      });
    }

    req.body = {
      status: "DISQUALIFIED",
      ...(raw.reason != null ? { disqualify_reason: raw.reason } : {}),
      ...(raw.notes != null ? { notes: raw.notes } : {}),
    };

    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/leads/:leadId/status error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/leads/:leadId/convert", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}/convert`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/leads/:leadId/convert error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/leads/:leadId/activities", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}/activities`),
    });
  } catch (error) {
    console.error("GET /api/leads/:leadId/activities error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/leads/:leadId/activities", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}/activities`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/leads/:leadId/activities error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/leads/activities/:activityId", async (req, res) => {
  try {
    const { activityId } = req.params ?? {};
    if (!isNonEmptyString(activityId)) return res.status(400).json({ message: "Validation error.", missing: ["activityId"] });
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/leads/activities/${encodeURIComponent(activityId)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/leads/activities/:activityId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/leads/meta/tags", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "GET", url: backendUrl("/leads/meta/tags") });
  } catch (error) {
    console.error("GET /api/leads/meta/tags error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/leads/meta/tags", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "POST", url: backendUrl("/leads/meta/tags"), withBody: true });
  } catch (error) {
    console.error("POST /api/leads/meta/tags error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/leads/:leadId/tags", async (req, res) => {
  try {
    const { leadId } = req.params ?? {};
    if (!isNonEmptyString(leadId)) return res.status(400).json({ message: "Validation error.", missing: ["leadId"] });
    return await proxyJson(req, res, {
      method: "PUT",
      url: backendUrl(`/leads/${encodeURIComponent(leadId)}/tags`),
      withBody: true,
    });
  } catch (error) {
    console.error("PUT /api/leads/:leadId/tags error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
