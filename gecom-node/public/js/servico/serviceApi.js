(function () {
  if (window.ServiceApi) return;

  async function readJsonSafe(response) {
    const text = await response.text().catch(() => "");
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  async function request(method, url, body) {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      credentials: "include",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });

    const data = await readJsonSafe(response);
    if (!response.ok) {
      const error = new Error(data?.message || `HTTP ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  window.ServiceApi = {
    getJson: (url) => request("GET", url),
    postJson: (url, body) => request("POST", url, body),
    putJson: (url, body) => request("PATCH", url, body),
    deleteJson: (url) => request("DELETE", url),
  };
})();
