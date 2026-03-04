(function () {
  function safeJsonParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function toBool(value) {
    if (value === true || value === false) return value;
    var v = String(value || "").trim().toLowerCase();
    return v === "true" || v === "1" || v === "yes";
  }

  function normalizeRole(role) {
    return String(role || "").trim().toUpperCase();
  }

  function canonicalRole(role) {
    var r = normalizeRole(role);
    if (!r) return "";
    if (r === "ADMIN" || r === "ADMINISTRATOR") return "ADMIN";
    if (r === "MANAGER" || r === "GESTOR") return "MANAGER";
    if (r === "USER" || r === "COMMON_USER" || r === "CLIENT") return "USER";
    if (r === "CUSTOMER" || r === "CLIENTE") return "CUSTOMER";
    return r;
  }

  function actionKey(action) {
    var a = String(action || "").trim().toUpperCase();
    if (a === "READ") return "can_read";
    if (a === "CREATE") return "can_create";
    if (a === "UPDATE") return "can_update";
    if (a === "DELETE") return "can_delete";
    return "";
  }

  function fallbackCan(role, action) {
    var r = canonicalRole(role);
    var a = String(action || "").trim().toUpperCase();
    if (r === "ADMIN") return true;
    if (r === "MANAGER") {
      return a === "READ" || a === "CREATE" || a === "UPDATE";
    }
    return a === "READ";
  }

  function deriveRoleFlags(auth) {
    var role = canonicalRole(auth.role || "");
    var isAdmin = role === "ADMIN" || toBool(auth.user && (auth.user.is_admin || auth.user.isAdmin));
    var isManager = !isAdmin && (role === "MANAGER" || toBool(auth.user && (auth.user.is_manager || auth.user.isManager)));
    var isUser = !isAdmin && !isManager;
    return {
      role: isAdmin ? "ADMIN" : (isManager ? "MANAGER" : (role || "USER")),
      isAdmin: isAdmin,
      isManager: isManager,
      isUser: isUser,
    };
  }

  function buildAuthFromLocalStorage() {
    var user = safeJsonParse(localStorage.getItem("currentUser"));
    var roleCandidates = [
      user && user.role,
      user && user.user_role,
      user && user.role_name,
      Array.isArray(user && user.roles) ? user.roles[0] : null,
    ].map(canonicalRole).filter(Boolean);

    var role = roleCandidates[0] || "USER";
    var auth = {
      user: user || null,
      role: role,
      roles: roleCandidates.slice(),
      isAdmin: false,
      isManager: false,
      isUser: true,
      companyId: user && (user.company_id || user.companyId) || null,
      permission_map: {},
      permissions: [],
      access_roles: [],
      permissionsLoaded: false,
    };

    return Object.assign(auth, deriveRoleFlags(auth));
  }

  function mergeAccessPayload(payload) {
    if (!payload || typeof payload !== "object") return;
    var current = window.__auth || buildAuthFromLocalStorage();
    var roleCodes = Array.isArray(payload.roles)
      ? payload.roles.map(function (r) { return canonicalRole(r && (r.code || r.role || r.name)); }).filter(Boolean)
      : [];
    var currentRole = roleCodes[0] || canonicalRole(payload.legacy_role || current.role);

    var next = Object.assign({}, current, {
      role: currentRole || current.role,
      roles: roleCodes.length ? roleCodes : (current.roles || []),
      access_roles: Array.isArray(payload.roles) ? payload.roles : [],
      permission_map: payload.permission_map && typeof payload.permission_map === "object" ? payload.permission_map : {},
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
      permissionsLoaded: true,
    });

    Object.assign(next, deriveRoleFlags(next));
    window.__auth = next;
  }

  async function refreshAccessFromApi() {
    var path = String(window.location.pathname || "").toLowerCase();
    var isPublic =
      path === "/" ||
      path.includes("landingpage") ||
      path.includes("publicprocessdetail") ||
      path === "/admin/billing" ||
      path === "/admin/plans-modules";

    if (isPublic) return window.__auth;
    if (!window.__auth || !window.__auth.user) return window.__auth;

    try {
      var resp = await fetch("/api/me/access", {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!resp.ok) return window.__auth;
      var data = await resp.json().catch(function () { return {}; });
      mergeAccessPayload(data);
      return window.__auth;
    } catch {
      return window.__auth;
    }
  }

  window.__auth = buildAuthFromLocalStorage();

  window.Auth = {
    refresh: function () {
      window.__auth = buildAuthFromLocalStorage();
      refreshAccessFromApi();
      return window.__auth;
    },
    requireLogin: function () {
      if (!window.__auth || !window.__auth.user) {
        window.location.href = "/";
        return false;
      }
      return true;
    },
    hasAnyRole: function (roles) {
      var target = Array.isArray(roles) ? roles.map(function (r) { return canonicalRole(r); }) : [];
      var role = canonicalRole(window.__auth && window.__auth.role || "");
      if (!role) return false;
      return target.includes(role);
    },
    can: function (resource, action) {
      var auth = window.__auth || {};
      var entity = String(resource || "").trim().toLowerCase();
      var key = actionKey(action);
      if (!entity || !key) return false;

      if (auth.permissionsLoaded) {
        var map = auth.permission_map && auth.permission_map[entity];
        if (map && Object.prototype.hasOwnProperty.call(map, key)) {
          return map[key] === true;
        }
        return false;
      }

      return fallbackCan(auth.role, action);
    },
    refreshAccess: refreshAccessFromApi,
  };

  var path = String(window.location.pathname || "").toLowerCase();
  var isPublic =
    path === "/" ||
    path.includes("landingpage") ||
    path.includes("publicprocessdetail") ||
    path === "/admin/billing" ||
    path === "/admin/plans-modules";

  if (!isPublic) {
    window.Auth.requireLogin();
    refreshAccessFromApi();
  }
})();
