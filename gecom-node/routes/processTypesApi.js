const express = require("express");
const {
  getBackendBaseUrl,
  getAuthHeader,
  readJsonSafe,
  resolveExternalAccessContext,
  denyExternalWrite,
} = require("./_externalAccess");

const router = express.Router();

function resolveLocale(req) {
  const raw = String(
    req?.resolvedLanguage ||
    req?.language ||
    req?.locale ||
    req?.i18n?.language ||
    ""
  ).trim().toLowerCase();

  if (raw.startsWith("en")) return "en";
  if (raw.startsWith("es")) return "es";
  return "pt";
}

function translateBuiltInProcessTypeName(value, locale) {
  const raw = String(value || "").trim();
  if (!raw) return raw;

  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  let canonical = "";
  if (["export", "exportacao", "exportacion"].includes(normalized)) canonical = "export";
  else if (["import", "importacao", "importacion"].includes(normalized)) canonical = "import";
  else if (["national", "nacional", "domestic"].includes(normalized)) canonical = "national";
  else return raw;

  const dictionary = {
    pt: { export: "Exportação", import: "Importação", national: "Nacional" },
    en: { export: "Export", import: "Import", national: "National" },
    es: { export: "Exportación", import: "Importación", national: "Nacional" },
  };

  return dictionary[locale]?.[canonical] || raw;
}

function localizeProcessTypePayload(payload, locale) {
  if (!payload || typeof payload !== "object") return payload;
  const localizedName = translateBuiltInProcessTypeName(payload.name, locale);
  return Object.assign({}, payload, {
    raw_name: payload.name,
    name: localizedName,
    display_name: localizedName,
  });
}

function localizeProcessTypeResponse(data, locale) {
  if (Array.isArray(data)) {
    return data.map((row) => localizeProcessTypePayload(row, locale));
  }
  if (Array.isArray(data?.data)) {
    return Object.assign({}, data, {
      data: data.data.map((row) => localizeProcessTypePayload(row, locale)),
    });
  }
  return localizeProcessTypePayload(data, locale);
}

router.get("/process-types", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const locale = resolveLocale(req);

    const response = await fetch(`${baseUrl}/process-types`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(localizeProcessTypeResponse(data ?? {}, locale));
  } catch (error) {
    console.error("GET /api/process-types error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

router.get("/process-types/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const locale = resolveLocale(req);

    const response = await fetch(`${baseUrl}/process-types/${encodeURIComponent(req.params.id)}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    const data = await readJsonSafe(response);
    return res.status(response.status).json(localizeProcessTypeResponse(data ?? {}, locale));
  } catch (error) {
    console.error("GET /api/process-types/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

router.post("/process-types", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

    const response = await fetch(`${baseUrl}/process-types`, {
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
    console.error("POST /api/process-types error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

router.put("/process-types/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

    const response = await fetch(`${baseUrl}/process-types/${encodeURIComponent(req.params.id)}`, {
      method: "PUT",
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
    console.error("PUT /api/process-types/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

router.delete("/process-types/:id", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });
    if (denyExternalWrite(externalContext, req, res)) return;

    const response = await fetch(`${baseUrl}/process-types/${encodeURIComponent(req.params.id)}`, {
      method: "DELETE",
      headers: {
        Accept: "application/json",
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
    });

    if (response.status === 204) return res.status(204).send();

    const data = await readJsonSafe(response);
    return res.status(response.status).json(data ?? {});
  } catch (error) {
    console.error("DELETE /api/process-types/:id error:", error);
    return res.status(500).json({ message: "Erro interno do servidor" });
  }
});

module.exports = router;
