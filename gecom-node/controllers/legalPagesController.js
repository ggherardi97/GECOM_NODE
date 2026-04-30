function normalizeText(value) {
  return String(value ?? "").trim();
}

function getHost(req) {
  return normalizeText(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
}

function resolveBrandName(req) {
  const host = getHost(req);
  if (host.includes("portalgecom.log.br") || host.includes("gecom")) {
    return "GECOM";
  }
  return "Convert Plus";
}

function buildPrivacyDocument(brandName, slug = "privacy-policy") {
  return {
    slug,
    title: "Privacy Policy",
    heading: `Politica de Privacidade - ${brandName}`,
    updatedAt: "21/04/2026",
    paragraphs: [
      "Coletamos dados de cadastro, autenticacao, navegacao e uso da plataforma para executar os servicos contratados, operar o portal e atender as rotinas de comercio exterior dos clientes.",
      "O tratamento de dados observa principios de finalidade, necessidade, seguranca e rastreabilidade, em linha com a LGPD e com as exigencias operacionais aplicaveis ao servico.",
      "As informacoes ficam protegidas com controles de acesso, trilhas de auditoria, segregacao por perfil e medidas de seguranca compativeis com o tipo de servico prestado.",
      "Nao comercializamos dados pessoais. Compartilhamentos ocorrem apenas com fornecedores essenciais para infraestrutura, pagamento, suporte ou obrigacoes legais.",
      "Solicitacoes de correcao, exportacao e exclusao podem ser feitas pelos canais oficiais de atendimento, conforme a legislacao aplicavel.",
    ],
  };
}

function buildTermsDocument(brandName, slug = "terms-of-use") {
  return {
    slug,
    title: "Terms of Use",
    heading: `Termos de Uso - ${brandName}`,
    updatedAt: "21/04/2026",
    paragraphs: [
      "Ao utilizar a plataforma, voce declara que as informacoes fornecidas sao verdadeiras, atualizadas e inseridas por usuario autorizado.",
      "O acesso ao sistema deve respeitar a legislacao vigente, as boas praticas de seguranca da informacao e as politicas operacionais aplicaveis ao servico.",
      "O portal e os recursos digitais de acompanhamento operacional destinam-se ao suporte das rotinas contratadas com a GECOM, incluindo visibilidade documental, status de processos, alertas e registros relacionados a importacao e exportacao.",
      "Credenciais, acessos e compartilhamentos de dados devem ser administrados de forma responsavel pelo cliente, preservando sigilo, conformidade e integridade das informacoes operacionais.",
      "Planos, periodos de avaliacao, cobrancas e renovacoes seguem as condicoes comerciais contratadas no momento do cadastro, assinatura ou ativacao.",
      "Solicitacoes de cancelamento, revisao de plano ou suporte podem ser realizadas pelos canais oficiais disponibilizados na plataforma.",
    ],
  };
}

function renderLegalDocument(req, res, factory) {
  const brandName = resolveBrandName(req);
  const document = factory(brandName);

  return res.render("LegalDocument", {
    layout: false,
    brandName,
    legalDocument: document,
  });
}

function renderExplicitBrandLegalDocument(res, brandName, factory) {
  const document = factory(brandName);

  return res.render("LegalDocument", {
    layout: false,
    brandName,
    legalDocument: document,
  });
}

function buildGecomPrivacyDocument() {
  return buildPrivacyDocument("GECOM", "gecom/privacy-policy");
}

function buildGecomTermsDocument() {
  return buildTermsDocument("GECOM", "gecom/terms-of-use");
}

module.exports = {
  privacyPolicy(req, res) {
    return renderLegalDocument(req, res, buildPrivacyDocument);
  },

  termsOfUse(req, res) {
    return renderLegalDocument(req, res, buildTermsDocument);
  },

  gecomPrivacyPolicy(req, res) {
    return renderExplicitBrandLegalDocument(res, "GECOM", buildGecomPrivacyDocument);
  },

  gecomTermsOfUse(req, res) {
    return renderExplicitBrandLegalDocument(res, "GECOM", buildGecomTermsDocument);
  },
};
