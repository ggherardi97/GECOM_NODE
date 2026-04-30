const express = require("express");

const router = express.Router();
const POSTAL_CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const RATE_LIMIT_WINDOW_MS = 1000 * 60 * 10;
const RATE_LIMIT_MAX_REQUESTS = 30;
const postalLookupCache = new Map();
const postalLookupRateLimit = new Map();

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function buildFormattedAddress(parts) {
  return parts
    .map((value) => normalizeText(value))
    .filter(Boolean)
    .join(", ");
}

async function readJsonSafe(response) {
  const text = await response.text().catch(() => "");
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function pickAddressComponent(components, type, useShortName) {
  const list = Array.isArray(components) ? components : [];
  const component = list.find(
    (entry) => Array.isArray(entry?.types) && entry.types.includes(type),
  );
  if (!component) return "";
  return String(useShortName ? component.short_name : component.long_name || "").trim();
}

async function fetchViaCep(postalCode) {
  const response = await fetch(`https://viacep.com.br/ws/${encodeURIComponent(postalCode)}/json/`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });

  const data = await readJsonSafe(response);
  if (!response.ok || !data || data.erro) return null;

  return {
    postalCode: normalizeText(data.cep || postalCode),
    street: normalizeText(data.logradouro),
    number: "",
    district: normalizeText(data.bairro),
    city: normalizeText(data.localidade),
    stateUf: normalizeText(data.uf),
    country: "Brasil",
    formattedAddress: buildFormattedAddress([
      data.logradouro,
      data.bairro,
      `${data.localidade || ""} ${data.uf || ""}`.trim(),
      "Brasil",
    ]),
    placeId: "",
    source: "viacep",
  };
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0];
  return normalizeText(forwardedFor || req.ip || req.socket?.remoteAddress || "unknown");
}

function isRateLimited(req) {
  const now = Date.now();
  const clientIp = getClientIp(req);
  const current = postalLookupRateLimit.get(clientIp);

  if (!current || now > current.resetAt) {
    postalLookupRateLimit.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX_REQUESTS) return true;

  return false;
}

function readPostalCache(postalCode) {
  const cached = postalLookupCache.get(postalCode);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    postalLookupCache.delete(postalCode);
    return null;
  }

  return cached.payload;
}

function writePostalCache(postalCode, payload) {
  postalLookupCache.set(postalCode, {
    expiresAt: Date.now() + POSTAL_CACHE_TTL_MS,
    payload,
  });
}

router.get("/public/google/geocode/postal", async (req, res) => {
  try {
    const postalCode = onlyDigits(req.query?.postalCode).slice(0, 8);
    if (postalCode.length !== 8) {
      return res.status(400).json({ message: "Validation error. Invalid postalCode." });
    }

    if (isRateLimited(req)) {
      return res.status(429).json({ message: "Too many postal code lookups. Please try again later." });
    }

    const cached = readPostalCache(postalCode);
    if (cached) {
      return res.status(200).json(cached);
    }

    const viaCepData = await fetchViaCep(postalCode).catch(() => null);
    if (viaCepData) {
      writePostalCache(postalCode, viaCepData);
      return res.status(200).json(viaCepData);
    }

    const key = normalizeText(process.env.GOOGLE_SERVER_KEY);
    if (!key) {
      return res.status(503).json({ message: "Postal code lookup temporarily unavailable." });
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", postalCode);
    url.searchParams.set("components", `country:BR|postal_code:${postalCode}`);
    url.searchParams.set("region", "br");
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("key", key);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const data = await readJsonSafe(response);
    if (!response.ok) {
      return res.status(response.status).json(data ?? { message: "Google Geocoding error" });
    }

    const status = String(data?.status || "").toUpperCase();
    if (status !== "OK") {
      const message = data?.error_message || data?.message || `Google Geocoding status: ${status || "UNKNOWN"}`;
      const code = status === "ZERO_RESULTS" ? 404 : 400;
      return res.status(code).json({ message, status });
    }

    const result = Array.isArray(data?.results) && data.results.length ? data.results[0] : null;
    if (!result) {
      return res.status(404).json({ message: "Postal code not found." });
    }

    const components = Array.isArray(result.address_components) ? result.address_components : [];
    const city =
      pickAddressComponent(components, "locality", false) ||
      pickAddressComponent(components, "administrative_area_level_2", false) ||
      pickAddressComponent(components, "sublocality_level_1", false);

    const payload = {
      postalCode: pickAddressComponent(components, "postal_code", false) || postalCode,
      street: pickAddressComponent(components, "route", false),
      number: pickAddressComponent(components, "street_number", false),
      district:
        pickAddressComponent(components, "sublocality_level_1", false) ||
        pickAddressComponent(components, "neighborhood", false),
      city,
      stateUf: pickAddressComponent(components, "administrative_area_level_1", true),
      country: pickAddressComponent(components, "country", false),
      formattedAddress: String(result.formatted_address || "").trim(),
      placeId: String(result.place_id || "").trim(),
      source: "google",
    };

    writePostalCache(postalCode, payload);
    return res.status(200).json(payload);
  } catch (error) {
    console.error("GET /public/google/geocode/postal error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
