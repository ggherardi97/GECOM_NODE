const express = require("express");
const router = express.Router();
const { createProxyHandler } = require("../services/apiProxy");

/**
 * GET /api/process-types
 * -> backend GET /process-types
 */
router.get("/process-types", createProxyHandler({
  backendPath: "/process-types"
}));

/**
 * GET /api/process-types/:id
 * -> backend GET /process-types/:id
 */
router.get("/process-types/:id", (req, res, next) => {
  const handler = createProxyHandler({
    backendPath: `/process-types/${req.params.id}`
  });

  return handler(req, res, next);
});

/**
 * POST /api/process-types
 * -> backend POST /process-types
 */
router.post("/process-types", createProxyHandler({
  backendPath: "/process-types"
}));

/**
 * PUT /api/process-types/:id
 * -> backend PUT /process-types/:id
 */
router.put("/process-types/:id", (req, res, next) => {
  const handler = createProxyHandler({
    backendPath: `/process-types/${req.params.id}`
  });

  return handler(req, res, next);
});

/**
 * DELETE /api/process-types/:id
 * -> backend DELETE /process-types/:id
 */
router.delete("/process-types/:id", (req, res, next) => {
  const handler = createProxyHandler({
    backendPath: `/process-types/${req.params.id}`
  });

  return handler(req, res, next);
});

module.exports = router;