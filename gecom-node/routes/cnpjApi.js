// routes/cnpjApi.js
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

/**
 * GET /cnpj/lookup?cnpj=42274696000194
 * Server-side proxy to ReceitaWS (avoids CORS).
 */
router.get("/cnpj/lookup", async (req, res) => {
  try {
    const raw = req.query?.cnpj;
    const cnpj = onlyDigits(raw);

    if (!cnpj || cnpj.length !== 14) {
      return res.status(400).json({
        message: "Validation error. Invalid CNPJ.",
        expected: "14 digits",
      });
    }

    const url = `https://www.receitaws.com.br/v1/cnpj/${encodeURIComponent(cnpj)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        // Some public APIs behave better with a UA
        "User-Agent": "GECOM/1.0 (server-side proxy)",
      },
    });

    const data = await readJsonSafe(response);

    // ReceitaWS sometimes returns 200 + { status: "ERROR" }
    if (!response.ok) {
      return res.status(response.status).json(data ?? { message: "ReceitaWS error" });
    }

    if (data && String(data.status || "").toUpperCase() === "ERROR") {
      return res.status(400).json({
        message: data.message || "ReceitaWS returned an error.",
      });
    }

    // Optional: return only non-sensitive/basic fields (clean output)
    const safe = {
      cnpj: data?.cnpj || cnpj,
      nome: data?.nome || "",
      fantasia: data?.fantasia || "",
      situacao: data?.situacao || "",
      abertura: data?.abertura || "",
      atividade_principal:
        Array.isArray(data?.atividade_principal) && data.atividade_principal.length > 0
          ? data.atividade_principal[0]
          : null,
      cep: data?.cep || "",
      logradouro: data?.logradouro || "",
      numero: data?.numero || "",
      complemento: data?.complemento || "",
      bairro: data?.bairro || "",
      municipio: data?.municipio || "",
      uf: data?.uf || "",
    };

    return res.status(200).json(safe);
  } catch (error) {
    console.error("GET /cnpj/lookup error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router;
