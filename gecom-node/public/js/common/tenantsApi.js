(function () {
  if (window.GECOM_TENANTS_API) return;

  function hasOwn(obj, key) {
    return obj != null && Object.prototype.hasOwnProperty.call(obj, key);
  }

  function toNonEmptyString(value) {
    if (typeof value !== "string") return null;
    const out = value.trim();
    return out.length > 0 ? out : null;
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

  async function request(method, path, payload) {
    const init = {
      method,
      headers: { Accept: "application/json" },
      credentials: "same-origin",
    };

    if (payload !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(payload);
    }

    const response = await fetch(path, init);
    const data = await readJsonSafe(response);

    if (!response.ok) {
      const error = new Error(data?.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function normalizeTenantCreatePayload(input) {
    const body = input || {};
    const payload = {};

    const name = toNonEmptyString(body.name);
    const slug = toNonEmptyString(body.slug);
    const companyId = toNonEmptyString(body.company_id);

    if (name) payload.name = name;
    if (slug) payload.slug = slug;
    if (companyId) payload.company_id = companyId;
    if (hasOwn(body, "status")) payload.status = body.status;

    return payload;
  }

  function normalizeTenantUpdatePayload(input) {
    const body = input || {};
    const payload = {};

    const name = toNonEmptyString(body.name);
    const slug = toNonEmptyString(body.slug);

    if (name) payload.name = name;
    if (slug) payload.slug = slug;
    if (hasOwn(body, "company_id")) {
      payload.company_id = body.company_id == null ? null : String(body.company_id).trim();
    }
    if (hasOwn(body, "status")) payload.status = body.status;

    return payload;
  }

  function ensureId(id) {
    const normalized = toNonEmptyString(String(id || ""));
    if (!normalized) throw new Error("Tenant id is required.");
    return normalized;
  }

  window.GECOM_TENANTS_API = {
    create: (payload) => request("POST", "/api/tenants", normalizeTenantCreatePayload(payload)),
    listMine: () => request("GET", "/api/tenants"),
    getById: (id) => request("GET", `/api/tenants/${encodeURIComponent(ensureId(id))}`),
    update: (id, payload) => request("PATCH", `/api/tenants/${encodeURIComponent(ensureId(id))}`, normalizeTenantUpdatePayload(payload)),
    remove: (id) => request("DELETE", `/api/tenants/${encodeURIComponent(ensureId(id))}`),
  };
})();
