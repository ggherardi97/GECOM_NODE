const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

function loadAiApiScript(context) {
  const filePath = path.join(process.cwd(), "public/js/common/aiApi.js");
  const source = fs.readFileSync(filePath, "utf8");
  vm.runInNewContext(source, context, { filename: "aiApi.js" });
}

function createContext(overrides) {
  const ctx = {
    window: {},
    fetch: async () => ({ ok: true, text: async () => "{}", status: 200 }),
    localStorage: { getItem: () => null },
    sessionStorage: { getItem: () => null },
    ...overrides,
  };
  ctx.window = Object.assign({}, ctx.window, {
    __features: { enableAI: true },
  });
  return ctx;
}

test("getAiDashboard uses GECOM_API when available", async () => {
  let called = 0;
  let capturedUrl = "";
  let capturedPayload = null;

  const context = createContext({
    window: {
      GECOM_API: {
        post: async (url, payload) => {
          called += 1;
          capturedUrl = url;
          capturedPayload = payload;
          return { ok: true, widgets: [] };
        },
      },
    },
  });

  loadAiApiScript(context);
  const result = await context.window.GECOM_AI_API.getAiDashboard("teste dashboard");

  assert.equal(called, 1);
  assert.equal(capturedUrl, "/api/ai/dashboard");
  assert.equal(capturedPayload.naturalLanguage, "teste dashboard");
  assert.deepEqual(result, { ok: true, widgets: [] });
});

test("getAiGridFilter uses fetch fallback and sends JSON", async () => {
  let requestBody = null;
  const context = createContext({
    fetch: async (_url, init) => {
      requestBody = JSON.parse(String(init.body || "{}"));
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ definition_json: { filters: [] } }),
      };
    },
  });

  loadAiApiScript(context);
  const result = await context.window.GECOM_AI_API.getAiGridFilter({
    entityName: "invoices",
    naturalLanguage: "somente ativos",
  });

  assert.equal(requestBody.entityName, "invoices");
  assert.equal(requestBody.naturalLanguage, "somente ativos");
  assert.equal(JSON.stringify(result.definition_json), JSON.stringify({ filters: [] }));
});

test("getAiHomeSearch throws status 400 with backend message", async () => {
  const context = createContext({
    fetch: async () => ({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: "prompt inválido" }),
    }),
  });

  loadAiApiScript(context);
  await assert.rejects(
    () => context.window.GECOM_AI_API.getAiHomeSearch("x"),
    (err) => {
      assert.equal(err.status, 400);
      assert.equal(err.message, "prompt inválido");
      return true;
    }
  );
});

test("feature flag disabled throws 403", async () => {
  const context = createContext();
  context.window.__features.enableAI = false;
  loadAiApiScript(context);

  await assert.rejects(
    () => context.window.GECOM_AI_API.getAiDashboard("qualquer"),
    (err) => {
      assert.equal(err.status, 403);
      return true;
    }
  );
});
