const apiClient = require("./apiClient");

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

async function forgotPassword(email) {
    return apiClient.post("/auth/forgot-password", { email });
}

async function resetPassword({ userId, token, newPassword, confirmPassword }) {
    return apiClient.post("/auth/reset-password", {
        user_id: userId,
        token,
        new_password: newPassword,
        confirm_password: confirmPassword
    });
}

module.exports = {
    login,
    signup,
    refresh,
    forgotPassword,
    resetPassword
};
