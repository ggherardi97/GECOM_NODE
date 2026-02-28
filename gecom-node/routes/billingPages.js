const express = require("express");

const router = express.Router();
const BOOTSTRAP_USER = process.env.BILLING_BOOTSTRAP_USER || "portaladmin";
const BOOTSTRAP_PASSWORD = process.env.BILLING_BOOTSTRAP_PASSWORD || "Q!w2E#r4T%";

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_API_BASE_URL || process.env.API_BASE_URL;
  if (!baseUrl) throw new Error("Missing BACKEND_API_BASE_URL (or API_BASE_URL) env var.");
  return baseUrl.replace(/\/$/, "");
}

function parseBasicCredentials(req) {
  const raw = String(req?.headers?.authorization || "");
  if (!raw.startsWith("Basic ")) return null;
  try {
    const decoded = Buffer.from(raw.slice("Basic ".length).trim(), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx < 0) return null;
    return { username: decoded.slice(0, idx), password: decoded.slice(idx + 1) };
  } catch {
    return null;
  }
}

function hasValidBootstrapCredentials(req) {
  const creds = parseBasicCredentials(req);
  if (!creds) return false;
  return creds.username === BOOTSTRAP_USER && creds.password === BOOTSTRAP_PASSWORD;
}

function challengeBootstrap(res) {
  res.setHeader("WWW-Authenticate", 'Basic realm="GECOM Billing Bootstrap", charset="UTF-8"');
  return res.status(401).send("Authentication required.");
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

async function requireAdminPage(req, res, next) {
  if (hasValidBootstrapCredentials(req)) {
    res.locals.billingBootstrapMode = true;
    res.locals.billingAdminUser = {
      role: "ADMIN",
      full_name: BOOTSTRAP_USER,
      bootstrap: true,
    };
    return next();
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: req.headers.cookie || "",
      },
    });

    if (response.status === 401) {
      return challengeBootstrap(res);
    }

    const user = await readJsonSafe(response);
    if (!response.ok) {
      return res.redirect("/");
    }

    const role = String(user?.role || "").trim().toUpperCase();
    if (role !== "ADMIN") {
      return res.status(404).send("Not Found");
    }

    res.locals.billingBootstrapMode = false;
    res.locals.billingAdminUser = user;
    return next();
  } catch (error) {
    console.error("Admin guard failed for /admin/billing:", error);
    return challengeBootstrap(res);
  }
}

router.get("/admin/billing", requireAdminPage, (req, res) => {
  return res.render("AdminBilling");
});

router.get("/admin/plans-modules", requireAdminPage, (req, res) => {
  return res.redirect("/admin/billing");
});

module.exports = router;
