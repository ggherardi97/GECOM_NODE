// routes/eventsApi.js
const express = require("express");
const router = express.Router();
const { createProxyHandler } = require("../services/apiProxy");

// ------------------------------
// Events API proxy routes
// Base: /api (mounted in server.js)
// ------------------------------

// GET /api/events -> backend GET /events
// Supports querystring passthrough (e.g. ?type=1&status=0) if your proxy keeps req.query.
router.get("/events", createProxyHandler({ backendPath: "/events" }));

// GET /api/events/:id -> backend GET /events/:id
router.get("/events/:id", (req, res, next) => {
  const handler = createProxyHandler({ backendPath: `/events/${req.params.id}` });
  return handler(req, res, next);
});

// POST /api/events -> backend POST /events
router.post("/events", createProxyHandler({ backendPath: "/events" }));

// PATCH /api/events/:id -> backend PATCH /events/:id
router.patch("/events/:id", (req, res, next) => {
  const handler = createProxyHandler({ backendPath: `/events/${req.params.id}` });
  return handler(req, res, next);
});

// DELETE /api/events/:id -> backend DELETE /events/:id
router.delete("/events/:id", (req, res, next) => {
  const handler = createProxyHandler({ backendPath: `/events/${req.params.id}` });
  return handler(req, res, next);
});

// ------------------------------
// Custom filters
// ------------------------------

// GET /api/events/by-process/:processId -> backend GET /events?process_id=...
router.get("/events/by-process/:processId", (req, res, next) => {
  const processId = encodeURIComponent(req.params.processId);
  const handler = createProxyHandler({ backendPath: `/events?process_id=${processId}` });
  return handler(req, res, next);
});

// GET /api/events/by-client/:clientId -> backend GET /events?client_id=...
router.get("/events/by-client/:clientId", (req, res, next) => {
  const clientId = encodeURIComponent(req.params.clientId);
  const handler = createProxyHandler({ backendPath: `/events?client_id=${clientId}` });
  return handler(req, res, next);
});

// (Optional) Generic search endpoint that just forwards to /events
// Use it like: GET /api/events/search?process_id=...&type=...&status=...
router.get("/events/search", createProxyHandler({ backendPath: "/events" }));

module.exports = router;