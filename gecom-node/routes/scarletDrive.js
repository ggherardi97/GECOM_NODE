const express = require("express");

const router = express.Router();

const HOST_OPTIONS = Object.freeze(["Diogo", "Gustavo", "Gill", "Renan", "Leonardo", "Natalie"]);
const LIMIT_TOTAL = 120;
const LIMIT_PER_HOST = 24;
const MAX_POSITIVE_VOTES_PER_VOTER = 5;

function getBackendBaseUrl() {
  const baseUrl = process.env.API_BASE_URL || process.env.BACKEND_API_BASE_URL;
  if (!baseUrl) {
    throw new Error("Missing BACKEND_API_BASE_URL (or API_BASE_URL) env var.");
  }
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

function getForwardedIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  const realIp = String(req.headers["x-real-ip"] || "").trim();
  const fallback = String(req.ip || req.socket?.remoteAddress || "").replace(/^::ffff:/i, "").trim();
  return forwarded || realIp || fallback || "";
}

async function proxyScarletDriveRequest(targetUrl, req, forwardedIp) {
  const method = String(req.method || "GET").toUpperCase();
  return fetch(targetUrl, {
    method,
    headers: {
      Accept: "application/json",
      ...(method !== "GET" && method !== "HEAD" ? { "Content-Type": "application/json" } : {}),
      ...(forwardedIp ? { "x-forwarded-for": forwardedIp, "x-real-ip": forwardedIp } : {}),
    },
    body: method !== "GET" && method !== "HEAD" ? JSON.stringify(req.body ?? {}) : undefined,
  });
}

router.get("/ScarletDrive", (req, res) => {
  res.render("ScarletDrive", {
    layout: false,
    scarletHosts: HOST_OPTIONS,
    maxGuests: LIMIT_TOTAL,
    maxPerHost: LIMIT_PER_HOST,
    maxPositiveVotesPerVoter: MAX_POSITIVE_VOTES_PER_VOTER,
  });
});

router.use("/api/scarlet-drive", async (req, res) => {
  try {
    const baseUrl = getBackendBaseUrl();
    const forwardedIp = getForwardedIp(req);
    const primaryUrl = `${baseUrl}/public/scarlet-drive${req.url}`;
    let response = await proxyScarletDriveRequest(primaryUrl, req, forwardedIp);
    let payload = await readJsonSafe(response);

    if (response.status === 404) {
      const fallbackUrl = `${baseUrl}/scarlet-drive${req.url}`;
      response = await proxyScarletDriveRequest(fallbackUrl, req, forwardedIp);
      payload = await readJsonSafe(response);
    }

    return res.status(response.status).json(payload ?? {});
  } catch (error) {
    console.error("ScarletDrive proxy error:", error);
    return res.status(500).json({ message: "Erro interno no ScarletDrive." });
  }
});

module.exports = router;
