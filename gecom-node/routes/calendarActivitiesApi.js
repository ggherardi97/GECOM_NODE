const express = require("express");
const {
  getBackendBaseUrl,
  getAuthHeader,
  readJsonSafe,
  resolveExternalAccessContext,
  denyExternalWrite,
  filterCalendarItemsByCompany,
  pickCompanyId,
} = require("./_externalAccess");

const router = express.Router();

function normalizeArrayResponse(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

async function proxyCalendarActivities(req, res) {
  try {
    const baseUrl = getBackendBaseUrl();
    const authHeader = getAuthHeader(req);
    const externalContext = await resolveExternalAccessContext(req, { baseUrl });

    if (denyExternalWrite(externalContext, req, res)) return;

    const path = req.originalUrl.replace(/^\/api/, "");
    const backendUrl = `${baseUrl}${path}`;
    const parsedUrl = new URL(backendUrl);
    const pathname = String(parsedUrl.pathname || "");
    const hasBody = !["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase());

    const response = await fetch(backendUrl, {
      method: req.method,
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      ...(hasBody ? { body: JSON.stringify(req.body || {}) } : {}),
    });

    let data = await readJsonSafe(response);
    if (
      response.ok &&
      externalContext.enforceCompanyScope &&
      externalContext.userCompanyId
    ) {
      const scopedCompanyId = String(externalContext.userCompanyId);
      if (pathname.endsWith("/calendar-activities/events")) {
        data = filterCalendarItemsByCompany(data, scopedCompanyId);
      } else if (/\/calendar-activities\/lookups\/companies$/i.test(pathname)) {
        const rows = normalizeArrayResponse(data).filter((item) => {
          const companyId =
            pickCompanyId(item) ||
            String(item?.id || "").trim() ||
            String(item?.value || "").trim();
          return companyId && String(companyId) === scopedCompanyId;
        });

        if (Array.isArray(data)) data = rows;
        else if (Array.isArray(data?.items)) data = { ...(data || {}), items: rows };
        else if (Array.isArray(data?.rows)) data = { ...(data || {}), rows };
        else if (Array.isArray(data?.data)) data = { ...(data || {}), data: rows };
        else data = rows;
      }
    }

    return res.status(response.status).json(data || {});
  } catch (error) {
    console.error(`${req.method} ${req.originalUrl} proxy error:`, error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

router.use("/calendar-activities", proxyCalendarActivities);

module.exports = router;
