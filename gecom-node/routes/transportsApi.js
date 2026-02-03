// routes/transportsApi.js
const express = require("express");
const router = express.Router();
const { createProxyHandler } = require("../services/apiProxy");

// ------------------------------
// Transports API proxy routes
// Base: /api (mounted in server.js)
// ------------------------------

// GET /api/transports -> backend GET /transports
// (querystring passthrough if your proxy forwards it)
router.get("/transports", createProxyHandler({ backendPath: "/transports" }));

// GET /api/transports/:id -> backend GET /transports/:id
router.get("/transports/:id", (req, res, next) => {
  const handler = createProxyHandler({ backendPath: `/transports/${req.params.id}` });
  return handler(req, res, next);
});

// POST /api/transports -> backend POST /transports
router.post("/transports", createProxyHandler({ backendPath: "/transports" }));

// PATCH /api/transports/:id -> backend PATCH /transports/:id
router.patch("/transports/:id", (req, res, next) => {
  const handler = createProxyHandler({ backendPath: `/transports/${req.params.id}` });
  return handler(req, res, next);
});

// DELETE /api/transports/:id -> backend DELETE /transports/:id
router.delete("/transports/:id", (req, res, next) => {
  const handler = createProxyHandler({ backendPath: `/transports/${req.params.id}` });
  return handler(req, res, next);
});

// ------------------------------
// Custom filters
// ------------------------------

// GET /api/transports/by-process/:processId -> backend GET /transports?process_id=...
router.get("/transports/by-process/:processId", (req, res, next) => {
  const processId = encodeURIComponent(req.params.processId);
  const handler = createProxyHandler({ backendPath: `/transports?process_id=${processId}` });
  return handler(req, res, next);
});

// Optional: generic search passthrough
// GET /api/transports/search?process_id=...&transport_status_id=...&transport_type_id=...
router.get("/transports/search", createProxyHandler({ backendPath: "/transports" }));

module.exports = router;