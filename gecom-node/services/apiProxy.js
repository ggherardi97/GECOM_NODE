const apiClient = require("./apiClient");

/**
 * Extract "name=value" from a Set-Cookie header line.
 * Example: "access_token=abc; Path=/; HttpOnly" -> "access_token=abc"
 */
function pickCookiePair(setCookieLine) {
    if (!setCookieLine || typeof setCookieLine !== "string") {
        return null;
    }

    const firstPart = setCookieLine.split(";")[0]?.trim();
    return firstPart || null;
}

/**
 * Merge the original Cookie header with new cookies from Set-Cookie.
 * New cookies override existing ones with the same name.
 */
function mergeCookies(originalCookieHeader, setCookieLines) {
    const cookieMap = new Map();

    // Load original cookies
    if (originalCookieHeader) {
        const pairs = originalCookieHeader.split(";").map(p => p.trim()).filter(Boolean);
        for (const pair of pairs) {
            const eqIndex = pair.indexOf("=");
            if (eqIndex > 0) {
                const name = pair.substring(0, eqIndex).trim();
                const value = pair.substring(eqIndex + 1).trim();
                cookieMap.set(name, value);
            }
        }
    }

    // Apply new cookies from Set-Cookie
    const lines = Array.isArray(setCookieLines) ? setCookieLines : (setCookieLines ? [setCookieLines] : []);
    for (const line of lines) {
        const cookiePair = pickCookiePair(line);
        if (!cookiePair) continue;

        const eqIndex = cookiePair.indexOf("=");
        if (eqIndex > 0) {
            const name = cookiePair.substring(0, eqIndex).trim();
            const value = cookiePair.substring(eqIndex + 1).trim();
            cookieMap.set(name, value);
        }
    }

    // Rebuild Cookie header
    const merged = [];
    for (const [name, value] of cookieMap.entries()) {
        merged.push(`${name}=${value}`);
    }

    return merged.join("; ");
}

/**
 * Forward Set-Cookie headers from backend to browser.
 * If res already has Set-Cookie, merge arrays.
 */
function forwardSetCookies(res, setCookieLines) {
    if (!setCookieLines) return;

    const newLines = Array.isArray(setCookieLines) ? setCookieLines : [setCookieLines];
    const existing = res.getHeader("Set-Cookie");

    if (!existing) {
        res.setHeader("Set-Cookie", newLines);
        return;
    }

    const existingLines = Array.isArray(existing) ? existing : [existing];
    res.setHeader("Set-Cookie", [...existingLines, ...newLines]);
}

/**
 * Call backend with cookie header and optional body/params.
 */
async function callBackend({ method, url, cookieHeader, params, data, extraHeaders }) {
    return apiClient.request({
        method,
        url,
        params,
        data,
        // We control status handling ourselves
        validateStatus: () => true,
        headers: {
            ...(extraHeaders || {}),
            ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
    });
}

/**
 * Express handler factory:
 * Proxies requests to backendPath and refreshes token on 401 once.
 *
 * Usage:
 *   router.get("/clients", createProxyHandler({ backendPath: "/clients" }));
 */
function createProxyHandler({ backendPath }) {
    return async (req, res) => {
        const method = (req.method || "GET").toUpperCase();

        // Forward query params
        const params = req.query;

        // Forward JSON body (for POST/PUT/PATCH)
        const data = ["POST", "PUT", "PATCH"].includes(method) ? req.body : undefined;

        // Browser -> Node cookie header
        const originalCookieHeader = req.headers.cookie || "";

        // (Optional) You can forward some headers too
        const extraHeaders = {};
        if (req.headers["content-type"]) {
            extraHeaders["Content-Type"] = req.headers["content-type"];
        }

        // 1) First attempt
        let apiResponse = await callBackend({
            method,
            url: backendPath,
            cookieHeader: originalCookieHeader,
            params,
            data,
            extraHeaders
        });

        // Always forward any Set-Cookie headers from backend
        forwardSetCookies(res, apiResponse.headers?.["set-cookie"]);

        // 2) If unauthorized, try refresh once
        if (apiResponse.status === 401) {
            const refreshToken = req.cookies?.refresh_token;

            if (!refreshToken) {
                return res.status(401).json({ message: "Unauthorized (missing refresh_token cookie)." });
            }

            // Call refresh endpoint (Swagger requires body: { refresh_token })
            const refreshResponse = await callBackend({
                method: "POST",
                url: "/auth/refresh-token",
                cookieHeader: originalCookieHeader,
                data: { refresh_token: refreshToken },
                extraHeaders: { "Content-Type": "application/json" }
            });

            forwardSetCookies(res, refreshResponse.headers?.["set-cookie"]);

            if (refreshResponse.status !== 200) {
                // Refresh failed -> return original unauthorized
                return res.status(401).json(refreshResponse.data || { message: "Refresh token failed." });
            }

            // Build a new cookie header for retry using Set-Cookie from refresh
            const refreshedCookieHeader = mergeCookies(
                originalCookieHeader,
                refreshResponse.headers?.["set-cookie"]
            );

            // Retry original request once with updated cookies
            apiResponse = await callBackend({
                method,
                url: backendPath,
                cookieHeader: refreshedCookieHeader,
                params,
                data,
                extraHeaders
            });

            forwardSetCookies(res, apiResponse.headers?.["set-cookie"]);
        }

        // 3) Return response to the browser
        // Forward status and body.
        // If backend returns non-JSON sometimes, you can improve this later.
        return res.status(apiResponse.status).send(apiResponse.data);
    };
}

module.exports = {
    createProxyHandler
};
