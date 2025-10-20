const express = require('express');
const router = express.Router();
const repo = require('../repositories/clientsRepo');

// GET /api/clients?search=&startDate=&endDate=&page=1&pageSize=20
router.get('/', async (req, res) => {
  try {
    const { search = '', startDate = '', endDate = '' } = req.query;
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const data = await repo.listClients({ page, pageSize, search, startDate, endDate });
    res.json({ ok: true, ...data });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Erro ao listar clientes' });
  }
});

module.exports = router;
