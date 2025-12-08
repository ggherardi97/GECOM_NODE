// controllers/clientsController.js
const repo = require('../repositories/clientsRepo');

async function renderClients(req, res) {
  try {
    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    const search = String(req.query.search ?? '');

    const data = await repo.listClients({ page, pageSize, search });
    // Render da sua view clientes.ejs
    //res.render('clientes', { data, search });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao carregar clientes.');
  }
}

async function renderClientDetails(req, res) {
  try {
    const id = Number(req.params.id);
    const client = await repo.getClientById(id);
    if (!client) return res.status(404).send('Cliente não encontrado.');
    //res.render('ClientDetails', { client });
  } catch (e) {
    console.error(e);
    res.status(500).send('Erro ao carregar cliente.');
  }
}

module.exports = { renderClients, renderClientDetails };
