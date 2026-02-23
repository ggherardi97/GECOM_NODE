(function () {
  // Global auth context (browser-side)
  function safeJsonParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function toBool(value) {
    if (value === true || value === false) return value;
    const v = String(value || "").trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }

  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function canonicalRole(role) {
    const r = normalizeRole(role);
    if (!r) return "";
    if (r === "ADMIN" || r === "ADMINISTRATOR") return "ADMIN";
    if (r === "MANAGER" || r === "GESTOR") return "MANAGER";
    if (r === "USER" || r === "COMMON_USER" || r === "CLIENT") return "USER";
    return r;
  }

  function buildAuthFromLocalStorage() {
    const user = safeJsonParse(localStorage.getItem("currentUser"));
    const roleCandidates = [
      user?.role,
      user?.user_role,
      user?.role_name,
      Array.isArray(user?.roles) ? user.roles[0] : null,
    ]
      .map(canonicalRole)
      .filter(Boolean);

    const hasRole = function (name) {
      return roleCandidates.includes(name);
    };

    const isAdmin = hasRole("ADMIN") || toBool(user?.is_admin) || toBool(user?.isAdmin);
    const isManager =
      !isAdmin &&
      (hasRole("MANAGER") || toBool(user?.is_manager) || toBool(user?.isManager));
    const isUser =
      !isAdmin &&
      !isManager &&
      (hasRole("USER") || toBool(user?.is_user) || toBool(user?.isUser) || true);

    const role = isAdmin ? "ADMIN" : (isManager ? "MANAGER" : "USER");

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
