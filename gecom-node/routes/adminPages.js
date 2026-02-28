const express = require("express");

const router = express.Router();

function getBackendBaseUrl() {
  const baseUrl = process.env.BACKEND_API_BASE_URL || process.env.API_BASE_URL;
  if (!baseUrl) throw new Error("Missing BACKEND_API_BASE_URL (or API_BASE_URL) env var.");
  return baseUrl.replace(/\/$/, "");
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
  try {
    const response = await fetch(`${getBackendBaseUrl()}/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Cookie: req.headers.cookie || "",
      },
    });

    if (response.status === 401) return res.redirect("/");

    const user = await readJsonSafe(response);
    if (!response.ok) return res.redirect("/");

    const role = String(user?.role || "").trim().toUpperCase();
    if (role !== "ADMIN") {
      return res.status(404).send("Not Found");
    }

    res.locals.adminConfigUser = user;
    return next();
  } catch (error) {
    console.error("Admin guard failed for /configuracoes:", error);
    return res.redirect("/");
  }
}

router.get("/configuracoes", requireAdminPage, (req, res) => {
  return res.render("configuracoes");
});

module.exports = router;
