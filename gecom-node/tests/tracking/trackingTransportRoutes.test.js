const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), "utf8");
}

test("BFF exposes tracking endpoints by transportId", () => {
  const content = read("routes/transportsApi.js");
  assert.match(content, /router\.get\("\/transports\/:id\/tracking"/);
  assert.match(content, /router\.put\("\/transports\/:id\/tracking\/link"/);
  assert.match(content, /router\.delete\("\/transports\/:id\/tracking\/link"/);
});

test("frontend tracking uses transport routes and not process routes", () => {
  const content = read("views/ProcessDetail.ejs");
  assert.match(content, /\/api\/transports\/\$\{encodeURIComponent\(id\)\}\/tracking\?refresh=false/);
  assert.doesNotMatch(content, /\/api\/processes\/\$\{encodeURIComponent\(.*\)\}\/tracking/);
});

test("marine tracking refresh is wired to transport rows", () => {
  const content = read("views/ProcessDetail.ejs");
  assert.match(content, /function isMarineTrafficTransportRow\(transport\)/);
  assert.match(content, /extractMarineTrafficTrackingInfoFromTransport\(transport\)/);
  assert.match(content, /tryFetchMarineTrafficIdentifierFromTracking\(row\?\.id\)/);
  assert.match(content, /window\.refreshMarineTrackingCard\(transportsCache\);/);
});

test("marine tracking action buttons use IMO/MMSI and ship id", () => {
  const content = read("views/ProcessDetail.ejs");
  assert.match(content, /id="marineTrafficDetailsBtn"/);
  assert.match(content, /id="marineTrafficTrackBtn"/);
  assert.match(content, /id="marineTrafficShipId"/);
  assert.match(content, /function resolveMarineTrackingInfo\(transportsInput\)/);
  assert.match(content, /function buildMarineTrafficDetailsUrl\(externalIdentifier\)/);
  assert.match(content, /function buildMarineTrafficTrackUrl\(shipId\)/);
  assert.match(content, /ais\/home\/shipid:/);
  assert.match(content, /Tracking IMO\/MMSI/);
  assert.match(content, /Ship ID/);
});

test("tracking tabs toggle with transport presence", () => {
  const content = read("views/ProcessDetail.ejs");
  assert.match(content, /marineTrackingTabLink/);
  assert.match(content, /airTrackingTabLink/);
  assert.match(content, /updateTrackingTabsVisibility\(transportsInput\)/);
  assert.match(content, /hasMarine = transports\.some/);
  assert.match(content, /hasAir = transports\.some/);
});

test("transport create modal exposes tracking fields and link flow", () => {
  const content = read("views/ProcessDetail.ejs");
  assert.match(content, /id="selTrackingMode"/);
  assert.match(content, /id="selTrackingProvider"/);
  assert.match(content, /id="txtTrackingExternalId"/);
  assert.match(content, /id="txtShipId"/);
  assert.match(content, /Tracking IMO\/MMSI/);
  assert.match(content, /placeholder="IMO ou MMSI do navio"/);
  assert.match(content, /placeholder="SHIP_ID do MarineTraffic"/);
  assert.match(content, /resolveTransportTrackingDefaults\(typeId, types\)/);
  assert.match(content, /apiPut\(`\/api\/transports\/\$\{encodeURIComponent\(transportId\)\}\/tracking\/link`/);
  assert.match(content, /ship_id: shipId \|\| null/);
});

test("transport edit modal exposes tracking fields and link flow", () => {
  const content = read("views/ProcessDetail.ejs");
  assert.match(content, /function openEditTransportModal\(t\)/);
  assert.match(content, /currentTrackingMode/);
  assert.match(content, /currentTrackingProvider/);
  assert.match(content, /currentTrackingExternalId/);
  assert.match(content, /currentShipId/);
  assert.match(content, /Tracking IMO\/MMSI/);
  assert.match(content, /id="txtShipId"/);
  assert.match(content, /apiPut\(`\/api\/transports\/\$\{encodeURIComponent\(id\)\}\/tracking\/link`/);
  assert.match(content, /apiDelete\(`\/api\/transports\/\$\{encodeURIComponent\(id\)\}\/tracking\/link`/);
  assert.match(content, /ship_id: shipId \|\| null/);
});

test("novoprocesso transport wizard uses side modal table flow", () => {
  const content = read("views/NovoProcesso.ejs");
  assert.match(content, /renderTransportTable\(\);/);
  assert.match(content, /function openTransportSideModal\(editIndex\)/);
  assert.match(content, /async function ensureProcessCreated\(\)/);
  assert.match(content, /function validateProcessCreateFields\(\)/);
  assert.match(content, /isUuidLike\(value\)/);
  assert.match(content, /function resolveProcessTypeIdFromUi\(\)/);
  assert.match(content, /class="btn btn-primary btn-xs2" id="btnAddTransport"/);
  assert.match(content, /btn-edit-transport/);
  assert.match(content, /btn-delete-transport/);
  assert.match(content, /bindTransportTableActionsOnce\(\);/);
  assert.match(content, /transportModalTrackingExternalId/);
  assert.match(content, /transportModalShipId/);
  assert.match(content, /Tracking IMO\/MMSI/);
  assert.match(content, /Ship ID/);
  assert.match(content, /País de origem/);
  assert.match(content, /Previsão de embarque/);
  assert.doesNotMatch(content, /initSelect2\(\$\(rootEl\)\.find\('#transportModalType'\)/);
  assert.doesNotMatch(content, /initSelect2\(\$\(rootEl\)\.find\('#transportModalStatus'\)/);
  assert.doesNotMatch(content, /initSelect2\(\$\(rootEl\)\.find\('#transportModalTrackingMode'\)/);
  assert.doesNotMatch(content, /initSelect2\(\$\(rootEl\)\.find\('#transportModalTrackingProvider'\)/);
  assert.match(content, /appendTo:\s*\$menuContainer\.length\s*\?\s*\$menuContainer\s*:\s*null/);
});

test("dynamic modal constrains select2 dropdown width", () => {
  const content = read("views/layout.ejs");
  assert.match(content, /overflow-x:\s*hidden;/);
  assert.match(content, /\.dynamic-modal \.select2-container/);
  assert.match(content, /width:\s*100%\s*!important;/);
  assert.match(content, /z-index:\s*1000001\s*!important;/);
});

test("client details exposes resend access link flow", () => {
  const content = read("views/ClientDetails.ejs");
  assert.match(content, /Reenviar link de acesso/);
  assert.match(content, /resendUserAccessLink\(userId\)/);
  assert.match(content, /\/api\/users\/\$\{encodeURIComponent\(userId\)\}\/resend-access-link/);
  assert.match(content, /Ao reenviar o link de acesso a senha será resetada, deseja prosseguir\?/);
  assert.match(content, /onContactResendAccess\(index\)/);
  assert.match(content, /fa-envelope/);
});

test("users api proxies resend access link endpoint", () => {
  const content = read("routes/usersApi.js");
  assert.match(content, /router\.post\("\/users\/:id\/resend-access-link"/);
  assert.match(content, /\/users\/\$\{encodeURIComponent\(id\)\}\/resend-access-link/);
});
