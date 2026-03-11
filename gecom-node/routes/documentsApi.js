// routes/documentsApi.js
const express = require("express");
const {
  getBackendBaseUrl,
  getAuthHeader,
  readJsonSafe,
  resolveExternalAccessContext,
  denyExternalWrite,
  pickCompanyId,
} = require("./_externalAccess");

const router = express.Router();

function allowManagerExternalUploadWrite(context, req) {
  if (!context?.isExternalManager) return false;

  const method = String(req.method || "").trim().toUpperCase();
  const path = String(req.path || "").toLowerCase();
  if (method !== "POST") return false;

  if (path === "/documents") {
    const itemType = String(req.body?.item_type || "").trim().toUpperCase();
    return itemType === "FILE";
  }

  if (/^\/documents\/[^/]+\/presign-upload$/i.test(path)) return true;
  if (/^\/documents\/[^/]+\/complete-upload$/i.test(path)) return true;

  return false;
}

/**
 * Build a query string for listing documents.
 * We support both parent_id and path for backward-compatibility:
 * - Prefer parent_id for current backends.
 * - Also mirror to path for older backends that still read `path`.
 */
function buildDocumentsListQuery(req) {
  const qs = new URLSearchParams();

  // Preferred param: parent_id (folder navigation)
  const parentId = req.query.parent_id;

  // Backward compatibility param: path
  const path = req.query.path;

  // Keep compatibility with both contracts:
  // - newer: expects parent_id
  // - older: expects path
  if (parentId !== undefined && String(parentId) !== "") {
    qs.set("parent_id", String(parentId));
    qs.set("path", String(parentId));
  } else if (path !== undefined && String(path) !== "") {
    qs.set("parent_id", String(path));
    qs.set("path", String(path));
  }

  const allowed = ["account_id", "related_table", "related_id", "item_type", "q", "take", "skip"];
  for (const key of allowed) {
    if (req.query[key] !== undefined && String(req.query[key]) !== "") {
      qs.set(key, String(req.query[key]));
    }
  }

  return qs;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeTableName(value) {
  return normalizeText(value).toLowerCase();
}

function isProcessTable(value) {
  const table = normalizeTableName(value);
  return table === "process" || table === "processes";
}

function normalizeArrayResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function cloneSearchParams(searchParams) {
  return new URLSearchParams(searchParams?.toString?.() || "");
}

function isRootDocumentsListRequest(req) {
  const parentId = normalizeText(req?.query?.parent_id);
  const path = normalizeText(req?.query?.path);
  const parentKey = parentId || path;
  return parentKey === "null" || parentKey === "";
}

async function fetchDocumentsFromBackend(baseUrl, authHeader, query) {
  const url = `${baseUrl}/documents${query?.toString() ? `?${query.toString()}` : ""}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });

  const data = await readJsonSafe(response);
  return { response, data };
}

async function processBelongsToCompany(baseUrl, authHeader, processId, companyId) {
  const scopedCompanyId = normalizeText(companyId);
  const scopedProcessId = normalizeText(processId);
  if (!scopedCompanyId || !scopedProcessId) return false;

  const response = await fetch(`${baseUrl}/processes/${encodeURIComponent(scopedProcessId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });

  const data = await readJsonSafe(response);
  if (!response.ok) return false;

  const processCompanyId = pickCompanyId(data);
  return !!processCompanyId && String(processCompanyId) === scopedCompanyId;
}

async function listProcessIdsByCompany(baseUrl, authHeader, companyId) {
  const scopedCompanyId = normalizeText(companyId);
  if (!scopedCompanyId) return [];

  const query = new URLSearchParams();
  query.set("company_id", scopedCompanyId);
  query.set("fields", "summary");
  query.set("take", "300");
  query.set("skip", "0");

  const response = await fetch(`${baseUrl}/processes?${query.toString()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });

  const data = await readJsonSafe(response);
  if (!response.ok) return [];

  const rows = normalizeArrayResponse(data);
  const ids = rows
    .map((row) =>
      normalizeText(
        row?.id ||
        row?.process_id ||
        row?.processId ||
        null,
      ),
    )
    .filter(Boolean);

  return Array.from(new Set(ids));
}

function mergeDocumentArraysUnique(itemsA, itemsB) {
  const merged = [];
  const seen = new Set();

  [...(itemsA || []), ...(itemsB || [])].forEach((item) => {
    const id = normalizeText(item?.id || item?.document_id || item?.documentId || "");
    const key = id || JSON.stringify(item || {});
    if (seen.has(key)) return;
    seen.add(key);
    merged.push(item);
  });

  return merged;
}

async function fetchExternalRootDocumentsWithCompanyAndProcessScope(
  baseUrl,
  authHeader,
  baseQuery,
  companyId,
) {
  const companyQuery = cloneSearchParams(baseQuery);
  companyQuery.set("related_table", "company");
  companyQuery.set("related_id", String(companyId));
  companyQuery.delete("account_id");

  const companyFetch = await fetchDocumentsFromBackend(baseUrl, authHeader, companyQuery);
  if (!companyFetch.response.ok) {
    return {
      ok: false,
      status: companyFetch.response.status,
      data: companyFetch.data ?? {},
    };
  }

  const companyRows = normalizeArrayResponse(companyFetch.data);
  const processIds = await listProcessIdsByCompany(baseUrl, authHeader, companyId);
  const cappedProcessIds = processIds.slice(0, 120);

  const processRows = [];
  const chunkSize = 8;
  for (let i = 0; i < cappedProcessIds.length; i += chunkSize) {
    const chunk = cappedProcessIds.slice(i, i + chunkSize);
    const rows = await Promise.all(chunk.map(async (processId) => {
      const processQuery = cloneSearchParams(baseQuery);
      processQuery.set("related_table", "process");
      processQuery.set("related_id", String(processId));
      processQuery.delete("account_id");

      const processFetch = await fetchDocumentsFromBackend(baseUrl, authHeader, processQuery);
      if (!processFetch.response.ok) return [];
      return normalizeArrayResponse(processFetch.data);
    }));

    rows.forEach((list) => processRows.push(...list));
  }

  return {
    ok: true,
    status: 200,
    data: mergeDocumentArraysUnique(companyRows, processRows),
  };
}

async function ensureDocumentInCompanyScope(baseUrl, authHeader, documentId, companyId) {
  const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(documentId)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  });

  const data = await readJsonSafe(response);
  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }

  const relatedTable = String(data?.related_table || data?.relatedTable || "").trim().toLowerCase();
  const relatedId = String(data?.related_id || data?.relatedId || "").trim();
  const documentCompanyId = pickCompanyId(data);

  const scopedCompanyId = String(companyId || "").trim();
  const allowedByRelatedCompany =
    (relatedTable === "company" || relatedTable === "companies") &&
    relatedId &&
    relatedId === scopedCompanyId;

  const allowedByDirectCompany =
    documentCompanyId &&
    String(documentCompanyId) === scopedCompanyId;

  let allowedByRelatedEntityCompany = false;
  if (!allowedByRelatedCompany && !allowedByDirectCompany && relatedId) {
    if (relatedTable === "process" || relatedTable === "processes") {
      const processResp = await fetch(`${baseUrl}/processes/${encodeURIComponent(relatedId)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });
      const processData = await readJsonSafe(processResp);
      if (processResp.ok) {
        const processCompanyId = pickCompanyId(processData);
        allowedByRelatedEntityCompany =
          !!processCompanyId && String(processCompanyId) === scopedCompanyId;
      }
    } else if (relatedTable === "invoice" || relatedTable === "invoices") {
      const invoiceResp = await fetch(`${baseUrl}/invoices/${encodeURIComponent(relatedId)}`, {
        method: "GET",
        headers: {
          Accept: "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
      });
      const invoiceData = await readJsonSafe(invoiceResp);
      if (invoiceResp.ok) {
        const invoiceCompanyId = pickCompanyId(invoiceData);
        allowedByRelatedEntityCompany =
          !!invoiceCompanyId && String(invoiceCompanyId) === scopedCompanyId;
      }
    }
  }

  const ok = allowedByRelatedCompany || allowedByDirectCompany || allowedByRelatedEntityCompany;
  if (!ok) {
    return {
      ok: false,
      status: 403,
      data: { message: "Acesso negado para documento de outra empresa." },
    };
  }

  return { ok: true, status: 200, data };
}

// -----------------------------------------------------------------------------// GET /api/documents?account_id=&parent_id=&path=&related_table=&related_id=&item_type=&q=&take=&skip=
// -----------------------------------------------------------------------------
router.get("/documents", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });

    const qs = buildDocumentsListQuery(req);
    if (externalContext.isExternal && externalContext.userCompanyId) {
      const requestedTable = normalizeTableName(req.query?.related_table);
      const requestedRelatedId = normalizeText(req.query?.related_id);
      const requestedParentId = normalizeText(req.query?.parent_id || req.query?.path);
      const isRootListRequest = isRootDocumentsListRequest(req);

      if (isProcessTable(requestedTable) && requestedRelatedId) {
        const allowed = await processBelongsToCompany(
          baseUrl,
          authHeader,
          requestedRelatedId,
          externalContext.userCompanyId,
        );
        if (!allowed) {
          return res.status(403).json({ message: "Acesso negado para documentos de processo de outra empresa." });
        }

        qs.set("related_table", "process");
        qs.set("related_id", requestedRelatedId);
        qs.delete("account_id");
      } else if (!requestedTable && isRootListRequest) {
        const merged = await fetchExternalRootDocumentsWithCompanyAndProcessScope(
          baseUrl,
          authHeader,
          qs,
          externalContext.userCompanyId,
        );
        return res.status(merged.status).json(merged.data ?? {});
      } else if (!requestedTable && requestedParentId && requestedParentId !== "null") {
        // Allow listing folder children when the parent folder/document belongs to the same company.
        const parentAccess = await ensureDocumentInCompanyScope(
          baseUrl,
          authHeader,
          requestedParentId,
          externalContext.userCompanyId,
        );
        if (!parentAccess.ok) {
          return res.status(parentAccess.status).json(parentAccess.data ?? { message: "Acesso negado." });
        }
        qs.delete("account_id");
      } else {
        qs.set("related_table", "company");
        qs.set("related_id", String(externalContext.userCompanyId));
        qs.delete("account_id");
      }
    }

    const { response, data } = await fetchDocumentsFromBackend(baseUrl, authHeader, qs);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/documents error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// POST /api/documents -> backend POST /documents
// -----------------------------------------------------------------------------
router.post("/documents", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res, { allowWriteIf: allowManagerExternalUploadWrite })) return;

    const response = await fetch(`${baseUrl}/documents`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/documents error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// PATCH /api/documents/:id -> backend PATCH /documents/:id
// -----------------------------------------------------------------------------
router.patch("/documents/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("PATCH /api/documents/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// DELETE /api/documents/:id -> backend DELETE /documents/:id
// -----------------------------------------------------------------------------
router.delete("/documents/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/documents/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// POST /api/documents/:id/presign-upload -> backend POST /documents/:id/presign-upload
// Body example:
// {
//   "fileName": "Contrato.pdf",
//   "contentType": "application/pdf",
//   "size": 123456
// }
// -----------------------------------------------------------------------------
router.post("/documents/:id/presign-upload", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res, { allowWriteIf: allowManagerExternalUploadWrite })) return;

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}/presign-upload`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/documents/:id/presign-upload error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// GET /api/documents/:id/presign-download -> backend GET /documents/:id/presign-download
// -----------------------------------------------------------------------------
router.get("/documents/:id/presign-download", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });
    if (externalContext.enforceCompanyScope && externalContext.userCompanyId) {
      const inScope = await ensureDocumentInCompanyScope(
        baseUrl,
        authHeader,
        id,
        externalContext.userCompanyId,
      );
      if (!inScope.ok) return res.status(inScope.status).json(inScope.data ?? {});
    }

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}/presign-download`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("GET /api/documents/:id/presign-download error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// -----------------------------------------------------------------------------// POST /api/documents/:id/complete-upload -> backend PATCH /documents/:id
// Use this after the PUT to R2 succeeds, to mark upload_status as UPLOADED and/or save object_key, etag, etc.
//
// Body example:
// {
//   "upload_status": "UPLOADED",
//   "object_key": "rel/processes/<id>/Contrato.pdf",
//   "etag": "\"abc123\"",
//   "mime_type": "application/pdf",
//   "size_bytes": 123456
// }
// -----------------------------------------------------------------------------
router.post("/documents/:id/complete-upload", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res, { allowWriteIf: allowManagerExternalUploadWrite })) return;

    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ message: "Missing document id" });

    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("POST /api/documents/:id/complete-upload error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
