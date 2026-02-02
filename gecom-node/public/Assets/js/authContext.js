(function () {
  // Global auth context (browser-side)
  function safeJsonParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function buildAuthFromLocalStorage() {
    const user = safeJsonParse(localStorage.getItem("currentUser"));
    const role = normalizeRole(user?.role);

    const isAdmin = role === "ADMIN";
    const isManager = role === "MANAGER";
    const isUser = role === "USER";

    return {
      user: user || null,
      role: role || "",
      isAdmin: isAdmin,
      isManager: isManager,
      isUser: isUser,
      // useful: companyId if you store it in currentUser
      companyId: user?.company_id || user?.companyId || null
    };
  }

  // Build and expose
  window.__auth = buildAuthFromLocalStorage();

  // Small helpers
  window.Auth = {
    refresh: function () {
      window.__auth = buildAuthFromLocalStorage();
      return window.__auth;
    },
    requireLogin: function () {
      if (!window.__auth?.user) {
        window.location.href = "/";
        return false;
      }
      return true;
    },
    hasAnyRole: function (roles) {
      const r = String(window.__auth?.role || "");
      return Array.isArray(roles) && roles.map(x => String(x).toUpperCase()).includes(r);
    }
  };

  // Auto redirect if token/user missing (optional: you can remove if you prefer)
  // If you have public pages, exclude them by path:
  const path = String(window.location.pathname || "").toLowerCase();
  const isPublic =
    path === "/" ||
    path.includes("landingpage") ||
    path.includes("publicprocessdetail");

  if (!isPublic) {
    window.Auth.requireLogin();
  }
})();