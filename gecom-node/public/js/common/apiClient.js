(function () {
  if (window.GECOM_API) return;

  function getBearerToken() {
    try {
      const raw =
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("token") ||
        sessionStorage.getItem("access_token");
      return raw ? String(raw) : "";
    } catch {
      return "";
    }
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

  async function request(method, url, payload) {
    const headers = { Accept: "application/json" };
    const token = getBearerToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const init = {
      method,
      headers,
      credentials: "same-origin",
    };

    if (payload !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(payload ?? {});
    }

    const res = await fetch(url, init);
    const data = await readJsonSafe(res);

    if (res.status === 401) {
      const error = new Error(data?.message || "Unauthorized");
      error.status = 401;
      throw error;
    }

    if (!res.ok) {
      const error = new Error(data?.message || `HTTP ${res.status}`);
      error.status = res.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  window.GECOM_API = {
    get: (url) => request("GET", url),
    post: (url, payload) => request("POST", url, payload),
    patch: (url, payload) => request("PATCH", url, payload),
    put: (url, payload) => request("PUT", url, payload),
    delete: (url) => request("DELETE", url),
  };
})();
