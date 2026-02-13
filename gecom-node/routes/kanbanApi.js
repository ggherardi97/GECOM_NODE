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

router.get("/kanban/boards", async (req, res) => {
  try {
    const url = new URL(backendUrl("/kanban/boards"));
    appendQueryParams(url, req.query);
    return await proxyJson(req, res, { method: "GET", url: url.toString() });
  } catch (error) {
    console.error("GET /api/kanban/boards error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/kanban/boards/:boardId", async (req, res) => {
  try {
    const { boardId } = req.params ?? {};
    if (!isNonEmptyString(boardId)) return res.status(400).json({ message: "Validation error.", missing: ["boardId"] });
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/kanban/boards/${encodeURIComponent(boardId)}`),
    });
  } catch (error) {
    console.error("GET /api/kanban/boards/:boardId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/kanban/boards", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "POST", url: backendUrl("/kanban/boards"), withBody: true });
  } catch (error) {
    console.error("POST /api/kanban/boards error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/kanban/boards/:boardId", async (req, res) => {
  try {
    const { boardId } = req.params ?? {};
    if (!isNonEmptyString(boardId)) return res.status(400).json({ message: "Validation error.", missing: ["boardId"] });
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/kanban/boards/${encodeURIComponent(boardId)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/kanban/boards/:boardId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/kanban/boards/:boardId", async (req, res) => {
  try {
    const { boardId } = req.params ?? {};
    if (!isNonEmptyString(boardId)) return res.status(400).json({ message: "Validation error.", missing: ["boardId"] });
    return await proxyJson(req, res, {
      method: "DELETE",
      url: backendUrl(`/kanban/boards/${encodeURIComponent(boardId)}`),
    });
  } catch (error) {
    console.error("DELETE /api/kanban/boards/:boardId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/kanban/boards/:boardId/columns", async (req, res) => {
  try {
    const { boardId } = req.params ?? {};
    if (!isNonEmptyString(boardId)) return res.status(400).json({ message: "Validation error.", missing: ["boardId"] });
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/kanban/boards/${encodeURIComponent(boardId)}/columns`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/kanban/boards/:boardId/columns error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/kanban/columns/:columnId", async (req, res) => {
  try {
    const { columnId } = req.params ?? {};
    if (!isNonEmptyString(columnId)) return res.status(400).json({ message: "Validation error.", missing: ["columnId"] });
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/kanban/columns/${encodeURIComponent(columnId)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/kanban/columns/:columnId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/kanban/columns/:columnId", async (req, res) => {
  try {
    const { columnId } = req.params ?? {};
    if (!isNonEmptyString(columnId)) return res.status(400).json({ message: "Validation error.", missing: ["columnId"] });
    return await proxyJson(req, res, {
      method: "DELETE",
      url: backendUrl(`/kanban/columns/${encodeURIComponent(columnId)}`),
    });
  } catch (error) {
    console.error("DELETE /api/kanban/columns/:columnId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/kanban/cards", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "POST", url: backendUrl("/kanban/cards"), withBody: true });
  } catch (error) {
    console.error("POST /api/kanban/cards error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.patch("/kanban/cards/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params ?? {};
    if (!isNonEmptyString(cardId)) return res.status(400).json({ message: "Validation error.", missing: ["cardId"] });
    return await proxyJson(req, res, {
      method: "PATCH",
      url: backendUrl(`/kanban/cards/${encodeURIComponent(cardId)}`),
      withBody: true,
    });
  } catch (error) {
    console.error("PATCH /api/kanban/cards/:cardId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/kanban/cards/:cardId/move", async (req, res) => {
  try {
    const { cardId } = req.params ?? {};
    if (!isNonEmptyString(cardId)) return res.status(400).json({ message: "Validation error.", missing: ["cardId"] });

    // Normalize payload for backend DTO and drop unsupported fields.
    const raw = req.body ?? {};
    const normalized = {};
    const targetColumnId =
      raw.target_column_id ??
      raw.targetColumnId ??
      raw.to_column_id ??
      raw.toColumnId ??
      raw.column_id ??
      raw.columnId;
    const targetOrder =
      raw.target_order ??
      raw.targetOrder ??
      raw.to_sort_order ??
      raw.toSortOrder ??
      raw.sort_order ??
      raw.sortOrder;

    if (targetColumnId != null) normalized.target_column_id = targetColumnId;
    if (targetOrder != null && targetOrder !== "") normalized.target_order = Number(targetOrder);
    req.body = normalized;

    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/kanban/cards/${encodeURIComponent(cardId)}/move`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/kanban/cards/:cardId/move error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/kanban/cards/:cardId", async (req, res) => {
  try {
    const { cardId } = req.params ?? {};
    if (!isNonEmptyString(cardId)) return res.status(400).json({ message: "Validation error.", missing: ["cardId"] });
    return await proxyJson(req, res, {
      method: "DELETE",
      url: backendUrl(`/kanban/cards/${encodeURIComponent(cardId)}`),
    });
  } catch (error) {
    console.error("DELETE /api/kanban/cards/:cardId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/kanban/cards/:cardId/comments", async (req, res) => {
  try {
    const { cardId } = req.params ?? {};
    if (!isNonEmptyString(cardId)) return res.status(400).json({ message: "Validation error.", missing: ["cardId"] });
    return await proxyJson(req, res, {
      method: "GET",
      url: backendUrl(`/kanban/cards/${encodeURIComponent(cardId)}/comments`),
    });
  } catch (error) {
    console.error("GET /api/kanban/cards/:cardId/comments error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/kanban/cards/:cardId/comments", async (req, res) => {
  try {
    const { cardId } = req.params ?? {};
    if (!isNonEmptyString(cardId)) return res.status(400).json({ message: "Validation error.", missing: ["cardId"] });
    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/kanban/cards/${encodeURIComponent(cardId)}/comments`),
      withBody: true,
    });
  } catch (error) {
    console.error("POST /api/kanban/cards/:cardId/comments error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.put("/kanban/cards/:cardId/assignees", async (req, res) => {
  try {
    const { cardId } = req.params ?? {};
    if (!isNonEmptyString(cardId)) return res.status(400).json({ message: "Validation error.", missing: ["cardId"] });
    return await proxyJson(req, res, {
      method: "PUT",
      url: backendUrl(`/kanban/cards/${encodeURIComponent(cardId)}/assignees`),
      withBody: true,
    });
  } catch (error) {
    console.error("PUT /api/kanban/cards/:cardId/assignees error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/kanban/tags", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "GET", url: backendUrl("/kanban/tags") });
  } catch (error) {
    console.error("GET /api/kanban/tags error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/kanban/tags", async (req, res) => {
  try {
    return await proxyJson(req, res, { method: "POST", url: backendUrl("/kanban/tags"), withBody: true });
  } catch (error) {
    console.error("POST /api/kanban/tags error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/kanban/cards/:cardId/tags/:tagId", async (req, res) => {
  try {
    const { cardId, tagId } = req.params ?? {};
    if (!isNonEmptyString(cardId) || !isNonEmptyString(tagId)) {
      return res.status(400).json({
        message: "Validation error.",
        missing: [
          ...(isNonEmptyString(cardId) ? [] : ["cardId"]),
          ...(isNonEmptyString(tagId) ? [] : ["tagId"]),
        ],
      });
    }

    return await proxyJson(req, res, {
      method: "POST",
      url: backendUrl(`/kanban/cards/${encodeURIComponent(cardId)}/tags/${encodeURIComponent(tagId)}`),
    });
  } catch (error) {
    console.error("POST /api/kanban/cards/:cardId/tags/:tagId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

router.delete("/kanban/cards/:cardId/tags/:tagId", async (req, res) => {
  try {
    const { cardId, tagId } = req.params ?? {};
    if (!isNonEmptyString(cardId) || !isNonEmptyString(tagId)) {
      return res.status(400).json({
        message: "Validation error.",
        missing: [
          ...(isNonEmptyString(cardId) ? [] : ["cardId"]),
          ...(isNonEmptyString(tagId) ? [] : ["tagId"]),
        ],
      });
    }

    return await proxyJson(req, res, {
      method: "DELETE",
      url: backendUrl(`/kanban/cards/${encodeURIComponent(cardId)}/tags/${encodeURIComponent(tagId)}`),
    });
  } catch (error) {
    console.error("DELETE /api/kanban/cards/:cardId/tags/:tagId error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
