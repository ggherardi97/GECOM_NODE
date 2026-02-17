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
  assert.match(content, /\/api\/transports\/\$\{encodeURIComponent\(id\)\}\/tracking\?refresh=/);
  assert.match(content, /\/api\/transports\/\$\{encodeURIComponent\(id\)\}\/tracking\/link/);
  assert.doesNotMatch(content, /\/api\/processes\/\$\{encodeURIComponent\(.*\)\}\/tracking/);
});

test("tracking cache key is scoped by transportId", () => {
  const content = read("views/ProcessDetail.ejs");
  assert.match(content, /JSON\.stringify\(\["tracking", String\(transportId \|\| ""\)\]\)/);
});
