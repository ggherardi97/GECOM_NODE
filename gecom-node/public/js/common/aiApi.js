(function () {
  if (window.GECOM_AI_API) return;

  function isEnabled() {
    if (window.__features && window.__features.enableAI === false) return false;
    return true;
  }

  function ensureEnabled() {
    if (isEnabled()) return;
    const error = new Error("IA desabilitada no front-end.");
    error.status = 403;
    throw error;
  }

  function toHttpError(message, status, data) {
    const error = new Error(message || `HTTP ${status}`);
    error.status = Number(status || 500);
    error.data = data;
    return error;
  }

  async function post(path, payload) {
    ensureEnabled();

    if (window.GECOM_API && typeof window.GECOM_API.post === "function") {
      try {
        return await window.GECOM_API.post(`/api/ai/${path}`, payload || {});
      } catch (err) {
        if (err && typeof err.status === "number") throw err;
        throw toHttpError(err?.message || "Falha na requisição de IA.", 500);
      }
    }

    const response = await fetch(`/api/ai/${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(payload || {}),
    });

    const raw = await response.text().catch(() => "");
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }
    }

    if (!response.ok) {
      throw toHttpError(data?.message || "Falha na requisição de IA.", response.status, data);
    }

    return data || {};
  }

  async function getAiDashboard(prompt, extraPayload) {
    const text = String(prompt || "").trim();
    const entityHints = Array.isArray(extraPayload?.entityHints)
      ? extraPayload.entityHints
      : Array.isArray(extraPayload?.entity_hints)
      ? extraPayload.entity_hints
      : undefined;

    const payload = { naturalLanguage: text };
    if (Array.isArray(entityHints)) payload.entityHints = entityHints;
    return post("dashboard", payload);
  }

  async function getAiHomeSearch(query, extraPayload) {
    const text = String(query || "").trim();
    const entities = Array.isArray(extraPayload?.entities)
      ? extraPayload.entities
      : Array.isArray(extraPayload?.entityHints)
      ? extraPayload.entityHints
      : undefined;

    const payload = { query: text };
    if (Array.isArray(entities)) payload.entities = entities;
    return post("home-search", payload);
  }

  async function getAiGridFilter(input) {
    if (typeof input === "string") {
      const text = String(input || "").trim();
      return post("grid-filter", { naturalLanguage: text });
    }

    const raw = Object.assign({}, input || {});
    const text = String(raw.naturalLanguage || raw.natural_language || raw.prompt || raw.query || "").trim();
    const entity = raw.entityName || raw.entity_name;
    const def = raw.currentViewDefinitionJson || raw.current_view_definition_json;
    const payload = {
      entityName: String(entity || "").trim(),
      naturalLanguage: text,
    };
    if (def && typeof def === "object") payload.currentViewDefinitionJson = def;
    return post("grid-filter", payload);
  }

  window.GECOM_AI_API = {
    getAiDashboard,
    getAiHomeSearch,
    getAiGridFilter,
  };
})();
