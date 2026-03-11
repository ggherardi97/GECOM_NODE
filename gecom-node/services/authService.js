const apiClient = require("./apiClient");

function buildPortalHeaders(portalContext) {
    const context = portalContext || {};
    const headers = {};

    if (context.host) {
        headers["x-forwarded-host"] = String(context.host);
    }

    if (context.protocol) {
        headers["x-forwarded-proto"] = String(context.protocol);
    }

    return headers;
}

async function login(email, password) {
    // Important: do NOT parse tokens here
    // Backend sets cookies via Set-Cookie header
    const response = await apiClient.post("/auth", {
        email,
        password
    }, {
        withCredentials: true
    });

    return response;
}

async function refresh(refreshToken) {
    // Swagger: { "refresh_token": "..." }
    return apiClient.post("/auth/refresh-token", { refresh_token: refreshToken });
}

async function signup(payload) {
    return apiClient.post("/auth/signup", payload, {
        withCredentials: true
    });
}

async function signupPaymentPrepare(payload) {
    return apiClient.post("/auth/signup/payment/prepare", payload, {
        withCredentials: true
    });
}

async function signupPaymentComplete(payload) {
    return apiClient.post("/auth/signup/payment/complete", payload, {
        withCredentials: true
    });
}

async function forgotPassword(email, portalContext) {
    return apiClient.post("/auth/forgot-password", { email }, {
        headers: buildPortalHeaders(portalContext)
    });
}

async function resetPassword({ userId, token, newPassword, confirmPassword }, portalContext) {
    return apiClient.post("/auth/reset-password", {
        user_id: userId,
        token,
        new_password: newPassword,
        confirm_password: confirmPassword
    }, {
        headers: buildPortalHeaders(portalContext)
    });
}

module.exports = {
    login,
    signup,
    signupPaymentPrepare,
    signupPaymentComplete,
    refresh,
    forgotPassword,
    resetPassword
};
