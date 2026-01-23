// routes/productsApi.js
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

// GET /api/products?currency_id=&is_active=&q=
router.get("/products", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const qs = new URLSearchParams();
    if (req.query.currency_id) qs.set("currency_id", String(req.query.currency_id));
    if (req.query.is_active !== undefined && req.query.is_active !== "") {
      qs.set("is_active", String(req.query.is_active));
    }
    if (req.query.q) qs.set("q", String(req.query.q));

    const url = `${baseUrl}/products${qs.toString() ? `?${qs.toString()}` : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/products error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// GET /api/products/:id
router.get("/products/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const productId = String(req.params.id || "").trim();
    if (!productId) return res.status(400).json({ message: "Missing product id" });

    const response = await fetch(`${baseUrl}/products/${encodeURIComponent(productId)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      }
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/products/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ PATCH /api/products/:id  -> proxies backend PATCH /products/:id
router.patch("/products/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const productId = String(req.params.id || "").trim();
    if (!productId) return res.status(400).json({ message: "Missing product id" });

    const response = await fetch(`${baseUrl}/products/${encodeURIComponent(productId)}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(req.body ?? {})
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/products/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ POST /api/products  -> proxies backend POST /products
router.post("/products", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const response = await fetch(`${baseUrl}/products`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: JSON.stringify(req.body ?? {})
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/products error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ❌ DELETE /api/products/:id  -> proxies backend DELETE /products/:id
router.delete("/products/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);

    const productId = String(req.params.id || "").trim();
    if (!productId) {
      return res.status(400).json({ message: "Missing product id" });
    }

    const response = await fetch(
      `${baseUrl}/products/${encodeURIComponent(productId)}`,
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {})
        }
      }
    );

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/products/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;