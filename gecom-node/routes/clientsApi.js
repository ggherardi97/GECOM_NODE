const express = require("express");
const router = express.Router();
const { createProxyHandler } = require("../services/apiProxy");

// GET /api/clients -> backend GET /clients (ajuste o path conforme seu backend)
router.get("/clients", createProxyHandler({ backendPath: "/clients" }));

// Example: GET /api/clients/:id -> backend GET /clients/:id
router.get("/clients/:id", (req, res, next) => {
    // You can compose dynamic path:
    const handler = createProxyHandler({ backendPath: `/clients/${req.params.id}` });
    return handler(req, res, next);
});

// Example: POST /api/clients -> backend POST /clients
router.post("/clients", createProxyHandler({ backendPath: "/clients" }));

module.exports = router;
