// routes/auth.js
const express = require("express");
const router = express.Router();
const authService = require("../services/authService");

function forwardSetCookie(apiResponse, res) {
    const setCookieHeader = apiResponse.headers?.["set-cookie"];
    if (setCookieHeader) {
        res.setHeader("Set-Cookie", setCookieHeader);
    }
}

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Email and password are required." });
        }

        const apiResponse = await authService.login(email, password);
        forwardSetCookie(apiResponse, res);

        return res.status(200).json(apiResponse.data);
    }
    catch (error) {
        const status = error.response?.status || 500;
        const data = error.response?.data || { message: "Internal server error" };

        console.error("Login error:", status, data);
        return res.status(status).json(data);
    }
});

router.post("/refresh-token", async (req, res) => {
    try {
        const refreshToken = req.cookies?.refresh_token;

        if (!refreshToken) {
            return res.status(401).json({ message: "Missing refresh token." });
        }

        const apiResponse = await authService.refresh(refreshToken);
        forwardSetCookie(apiResponse, res);

        return res.status(200).json(apiResponse.data);
    }
    catch (error) {
        const status = error.response?.status || 500;
        const data = error.response?.data || { message: "Internal server error" };

        console.error("Refresh token error:", status, data);
        return res.status(status).json(data);
    }
});

router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required." });
        }

        const apiResponse = await authService.forgotPassword(email);

        // Usually forgot-password does not set cookies, but no harm forwarding if it does
        forwardSetCookie(apiResponse, res);

        return res.status(apiResponse.status).json(apiResponse.data);
    }
    catch (error) {
        const status = error.response?.status || 500;
        const data = error.response?.data || { message: "Internal server error" };

        console.error("Forgot password error:", status, data);
        return res.status(status).json(data);
    }
});

router.post("/reset-password", async (req, res) => {
    try {
        const { user_id, token, new_password, confirm_password } = req.body;

        if (!user_id || !token || !new_password || !confirm_password) {
            return res.status(400).json({
                message: "user_id, token, new_password and confirm_password are required."
            });
        }

        const apiResponse = await authService.resetPassword({
            userId: user_id,
            token,
            newPassword: new_password,
            confirmPassword: confirm_password
        });

        const setCookieHeader = apiResponse.headers?.["set-cookie"];
        if (setCookieHeader) {
            res.setHeader("Set-Cookie", setCookieHeader);
        }

        return res.status(apiResponse.status).json(apiResponse.data);
    }
    catch (error) {
        const status = error.response?.status || 500;
        const data = error.response?.data || { message: "Internal server error" };

        console.error("Reset password error:", status, data);
        return res.status(status).json(data);
    }
});

router.post("/logout", (req, res) => {
    res.clearCookie("access_token");
    res.clearCookie("refresh_token");
    return res.status(200).json({ success: true });
});

module.exports = router;
