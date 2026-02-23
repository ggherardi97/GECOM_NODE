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

async function forwardJson(req, res, method, backendPath, body) {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const response = await fetch(`${baseUrl}${backendPath}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(method !== "GET" && method !== "DELETE" ? { "Content-Type": "application/json" } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      ...(method !== "GET" && method !== "DELETE" ? { body: JSON.stringify(body ?? {}) } : {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error(`tradeSimulationsApi ${method} ${backendPath} error:`, error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
}

// POST /api/trade-simulations/ttce/lookup
router.post("/trade-simulations/ttce/lookup", async (req, res) => {
  return forwardJson(req, res, "POST", "/trade-simulations/ttce/lookup", req.body);
});

// GET /api/trade-simulations?status=&type=&company_id=&take=&skip=
router.get("/trade-simulations", async (req, res) => {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query || {})) {
    if (value == null || value === "") continue;
    qs.set(key, String(value));
  }
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return forwardJson(req, res, "GET", `/trade-simulations${suffix}`);
});

// POST /api/trade-simulations
router.post("/trade-simulations", async (req, res) => {
  return forwardJson(req, res, "POST", "/trade-simulations", req.body);
});

// GET /api/trade-simulations/:id
router.get("/trade-simulations/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "id inválido" });
  return forwardJson(req, res, "GET", `/trade-simulations/${encodeURIComponent(id)}`);
});

// PATCH /api/trade-simulations/:id
router.patch("/trade-simulations/:id", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "id inválido" });
  return forwardJson(req, res, "PATCH", `/trade-simulations/${encodeURIComponent(id)}`, req.body);
});

// POST /api/trade-simulations/:id/calculate
router.post("/trade-simulations/:id/calculate", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "id inválido" });
  return forwardJson(req, res, "POST", `/trade-simulations/${encodeURIComponent(id)}/calculate`, req.body);
});

// POST /api/trade-simulations/:id/items
router.post("/trade-simulations/:id/items", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "id inválido" });
  return forwardJson(req, res, "POST", `/trade-simulations/${encodeURIComponent(id)}/items`, req.body);
});

// PATCH /api/trade-simulations/:id/items/:itemId
router.patch("/trade-simulations/:id/items/:itemId", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const itemId = String(req.params.itemId || "").trim();
  if (!id || !itemId) return res.status(400).json({ message: "id inválido" });
  return forwardJson(
    req,
    res,
    "PATCH",
    `/trade-simulations/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`,
    req.body
  );
});

// DELETE /api/trade-simulations/:id/items/:itemId
router.delete("/trade-simulations/:id/items/:itemId", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const itemId = String(req.params.itemId || "").trim();
  if (!id || !itemId) return res.status(400).json({ message: "id inválido" });
  return forwardJson(
    req,
    res,
    "DELETE",
    `/trade-simulations/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`
  );
});

// POST /api/trade-simulations/:id/costs
router.post("/trade-simulations/:id/costs", async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id) return res.status(400).json({ message: "id inválido" });
  return forwardJson(req, res, "POST", `/trade-simulations/${encodeURIComponent(id)}/costs`, req.body);
});

// PATCH /api/trade-simulations/:id/costs/:costId
router.patch("/trade-simulations/:id/costs/:costId", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const costId = String(req.params.costId || "").trim();
  if (!id || !costId) return res.status(400).json({ message: "id inválido" });
  return forwardJson(
    req,
    res,
    "PATCH",
    `/trade-simulations/${encodeURIComponent(id)}/costs/${encodeURIComponent(costId)}`,
    req.body
  );
});

// DELETE /api/trade-simulations/:id/costs/:costId
router.delete("/trade-simulations/:id/costs/:costId", async (req, res) => {
  const id = String(req.params.id || "").trim();
  const costId = String(req.params.costId || "").trim();
  if (!id || !costId) return res.status(400).json({ message: "id inválido" });
  return forwardJson(
    req,
    res,
    "DELETE",
    `/trade-simulations/${encodeURIComponent(id)}/costs/${encodeURIComponent(costId)}`
  );
});

module.exports = router;
