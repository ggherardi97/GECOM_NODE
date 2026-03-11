const EXTERNAL_ROLE_TOKENS = ["EXTERNO", "EXTERNAL"];
const MANAGER_ROLE_TOKENS = ["MANAGER", "GESTOR"];

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
  const text = await response.text().catch(() => "");
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeForCompare(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function toId(value) {
  const s = normalizeText(value);
  return s || null;
}

function toRoleTokens(roleEntry) {
  if (!roleEntry) return [];
  if (typeof roleEntry === "string") return [roleEntry];

  if (typeof roleEntry === "object") {
    return [
      roleEntry.code,
      roleEntry.name,
      roleEntry.role,
      roleEntry.legacy_role,
      roleEntry.legacyRole,
      roleEntry.label,
    ].filter(Boolean);
  }

  return [];
}

function hasExternalRole(roles) {
  if (!Array.isArray(roles) || !roles.length) return false;

  return roles.some((entry) => {
    const tokens = toRoleTokens(entry);
    return tokens.some((token) => {
      const normalized = normalizeForCompare(token);
      return EXTERNAL_ROLE_TOKENS.some((needle) => normalized.includes(needle));
    });
  });
}

function hasManagerExternalRole(roles) {
  if (!Array.isArray(roles) || !roles.length) return false;

  return roles.some((entry) => {
    const tokens = toRoleTokens(entry).map(normalizeForCompare);
    const hasExternal = tokens.some((token) =>
      EXTERNAL_ROLE_TOKENS.some((needle) => token.includes(needle)),
    );
    const hasManager = tokens.some((token) =>
      MANAGER_ROLE_TOKENS.some((needle) => token.includes(needle)),
    );
    return hasExternal && hasManager;
  });
}

function pickCompanyId(data) {
  return (
    toId(data?.company_id) ||
    toId(data?.companyId) ||
    toId(data?.company?.id) ||
    toId(data?.company?.company_id) ||
    null
  );
}

function buildBackendHeaders(req, authHeader, includeAuth = true) {
  const cookieHeader = normalizeText(req?.headers?.cookie);
  return {
    Accept: "application/json",
    ...(includeAuth && authHeader ? { Authorization: authHeader } : {}),
    ...(cookieHeader ? { Cookie: cookieHeader } : {}),
  };
}

async function resolveExternalAccessContext(req, options = {}) {
  if (req.__externalAccessContext) return req.__externalAccessContext;

  const baseUrl = options.baseUrl || getBackendBaseUrl();
  const authHeader = getAuthHeader(req);

  const context = {
    isExternal: false,
    isExternalManager: false,
    enforceCompanyScope: false,
    userCompanyId: null,
    tenantCompanyId: null,
    tenantId: null,
  };

  if (!authHeader) {
    req.__externalAccessContext = context;
    return context;
  }

  try {
    const accessResp = await fetch(`${baseUrl}/me/access`, {
      method: "GET",
      headers: buildBackendHeaders(req, authHeader, true),
    });
    if (!accessResp.ok) {
      req.__externalAccessContext = context;
      return context;
    }

    const accessData = await readJsonSafe(accessResp);
    const roles = Array.isArray(accessData?.roles) ? accessData.roles : [];
    const isExternal = hasExternalRole(roles);
    const isExternalManager = hasManagerExternalRole(roles);

    if (!isExternal) {
      req.__externalAccessContext = context;
      return context;
    }

    const tenantId = toId(accessData?.tenant_id || accessData?.tenantId);

    const meResp = await fetch(`${baseUrl}/auth/me`, {
      method: "GET",
      headers: buildBackendHeaders(req, authHeader, true),
    });
    const meData = meResp.ok ? await readJsonSafe(meResp) : {};
    const userCompanyId = pickCompanyId(meData);

    let tenantCompanyId = null;
    if (tenantId) {
      const tenantResp = await fetch(`${baseUrl}/tenants/${encodeURIComponent(tenantId)}`, {
        method: "GET",
        headers: buildBackendHeaders(req, authHeader, true),
      });
      const tenantData = tenantResp.ok ? await readJsonSafe(tenantResp) : {};
      tenantCompanyId = pickCompanyId(tenantData);
    }

    const hasUserCompany = Boolean(userCompanyId);
    const tenantCompanyKnown = Boolean(tenantCompanyId);
    const isDifferentTenantCompany =
      hasUserCompany &&
      tenantCompanyKnown &&
      String(userCompanyId) !== String(tenantCompanyId);

    const enforceCompanyScope =
      hasUserCompany && (!tenantCompanyKnown || isDifferentTenantCompany);

    const resolved = {
      isExternal: true,
      isExternalManager,
      enforceCompanyScope,
      userCompanyId,
      tenantCompanyId,
      tenantId,
    };

    req.__externalAccessContext = resolved;
    return resolved;
  } catch (error) {
    console.warn("[externalAccess] failed to resolve context:", error?.message || error);
    req.__externalAccessContext = context;
    return context;
  }
}

function isReadMethod(method) {
  const upper = String(method || "").trim().toUpperCase();
  return upper === "GET" || upper === "HEAD" || upper === "OPTIONS";
}

function denyExternalWrite(context, req, res, options = {}) {
  if (!context?.isExternal) return false;
  if (isReadMethod(req.method)) return false;

  if (typeof options.allowWriteIf === "function") {
    try {
      if (options.allowWriteIf(context, req) === true) return false;
    } catch {
      // ignore custom rule errors and proceed with deny flow
    }
  }

  const method = String(req.method || "").trim().toUpperCase();
  const path = String(req.path || req.originalUrl || "");
  const allowPostPaths = Array.isArray(options.allowPostPaths) ? options.allowPostPaths : [];
  const isAllowedPost =
    method === "POST" &&
    allowPostPaths.some((rule) => {
      if (rule instanceof RegExp) return rule.test(path);
      return String(rule) === path;
    });

  if (isAllowedPost) return false;

  res.status(403).json({
    message: context?.isExternalManager
      ? "Acesso negado: Manager Externo possui escrita restrita."
      : "Acesso negado: User Externo possui apenas permissao de leitura.",
  });
  return true;
}

function forceCompanyIdParam(query, companyId) {
  if (!companyId) return;
  query.set("company_id", String(companyId));
}

function normalizeArrayResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function itemMatchesCompanyScope(item, companyId) {
  const targetCompanyId = toId(companyId);
  if (!targetCompanyId) return false;

  const candidates = [];
  const pushCandidate = (value) => {
    const id = toId(value);
    if (id) candidates.push(id);
  };

  pushCandidate(item?.company_id);
  pushCandidate(item?.companyId);

  const source = item?.source_data ?? item?.sourceData ?? {};
  pushCandidate(source?.company_id);
  pushCandidate(source?.companyId);

  Object.entries(source).forEach(([key, value]) => {
    if (/company_?id$/i.test(String(key || ""))) pushCandidate(value);
  });

  const relatedTable = normalizeForCompare(source?.related_table || source?.relatedTable);
  if (relatedTable === "COMPANY" || relatedTable === "COMPANIES") {
    pushCandidate(source?.related_id || source?.relatedId);
  }

  if (!candidates.length) return false;
  return candidates.some((candidate) => String(candidate) === String(targetCompanyId));
}

function filterCalendarItemsByCompany(data, companyId) {
  const rows = normalizeArrayResponse(data);
  const filtered = rows.filter((item) => itemMatchesCompanyScope(item, companyId));

  if (Array.isArray(data)) return filtered;
  if (Array.isArray(data?.items)) return { ...(data || {}), items: filtered };
  if (Array.isArray(data?.rows)) return { ...(data || {}), rows: filtered };
  if (Array.isArray(data?.data)) return { ...(data || {}), data: filtered };
  return filtered;
}

module.exports = {
  getBackendBaseUrl,
  getAuthHeader,
  readJsonSafe,
  resolveExternalAccessContext,
  denyExternalWrite,
  forceCompanyIdParam,
  filterCalendarItemsByCompany,
  pickCompanyId,
};
