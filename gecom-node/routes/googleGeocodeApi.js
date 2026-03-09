const express = require("express");

const router = express.Router();

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
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
    postalCode: String(data.cep || postalCode || "").trim(),
    street: String(data.logradouro || "").trim(),
    number: "",
    district: String(data.bairro || "").trim(),
    city: String(data.localidade || "").trim(),
    stateUf: String(data.uf || "").trim(),
    country: "Brasil",
    formattedAddress: "",
    placeId: "",
    source: "viacep",
  };
}

router.get("/public/google/geocode/postal", async (req, res) => {
  try {
    const postalCode = onlyDigits(req.query?.postalCode).slice(0, 8);
    if (postalCode.length !== 8) {
      return res.status(400).json({ message: "Validation error. Invalid postalCode." });
    }

    const key = String(process.env.GOOGLE_SERVER_KEY || process.env.GOOGLE_KEY || "").trim();
    if (!key) {
      return res.status(500).json({ message: "Missing GOOGLE_KEY env var." });
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
      // Common in browser-restricted keys used server-side: fallback to ViaCEP.
      if (status === "REQUEST_DENIED") {
        const viaCepData = await fetchViaCep(postalCode);
        if (viaCepData) return res.status(200).json(viaCepData);
      }

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

    return res.status(200).json({
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
    });
  } catch (error) {
    console.error("GET /public/google/geocode/postal error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
