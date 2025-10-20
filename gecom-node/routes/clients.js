// routes/clients.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/clientsController');

// Lista de clientes (renderiza a view clientes.ejs com dados do banco)
router.get('/', ctrl.renderClients);

// Detalhe por id
router.get('/:id', ctrl.renderClientDetails);

module.exports = router;
