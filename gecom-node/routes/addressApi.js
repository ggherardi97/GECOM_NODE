// routes/addressApi.js
const express = require("express");
const router = express.Router();

function getGoogleApiKey() {
  const key = process.env.API_KEY_GOOGLE;
  if (!key) {
    throw new Error("Missing API_KEY_GOOGLE in .env");
  }
  return key;
}

function normalizePostalCode(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 8);
}

function pickComponent(components, type) {
  const found = components.find((c) => (c.types || []).includes(type));
  return found ? found.long_name : "";
}

// GET /api/address/lookup?postalcode=01001000
router.get("/address/lookup", async (req, res) => {
  try {
    const postalcode = normalizePostalCode(req.query.postalcode);
    if (!postalcode || postalcode.length < 8) {
      return res.status(400).json({ message: "Invalid postalcode" });
    }

    const apiKey = getGoogleApiKey();

    // Using Geocoding API with components filter (Brazil)
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?components=postal_code:${postalcode}|country:BR` +
      `&key=${encodeURIComponent(apiKey)}` +
      `&language=pt-BR`;

    const response = await fetch(url);
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        message: "Google Geocoding API error",
        details: data,
      });
    }

    if (!data.results || data.results.length === 0) {
      return res.status(404).json({ message: "Address not found for postalcode" });
    }

    const best = data.results[0];
    const components = best.address_components || [];

    const street = pickComponent(components, "route");
    const neighborhood = pickComponent(components, "sublocality") || pickComponent(components, "sublocality_level_1");
    const city =
      pickComponent(components, "locality") ||
      pickComponent(components, "administrative_area_level_2");
    const state = pickComponent(components, "administrative_area_level_1");
    const country = pickComponent(components, "country");

    return res.json({
      postalcode,
      street,
      neighborhood,
      city,
      state,
      country,
      formatted_address: best.formatted_address || "",
    });
  } catch (error) {
    console.error("GET /api/address/lookup error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
