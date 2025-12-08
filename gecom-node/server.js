// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');

const authRoutes = require('./routes/auth');
const clientsRoutes = require('./routes/clients');      // Router que renderiza páginas de clients (via controller)
const clientsApiRoutes = require('./routes/clientsApi'); // API JSON: /api/clients

const clientsCtrl = require('./controllers/clientsController'); // Para rotas diretas que renderizam EJS

const app = express();

/* ---------- View engine (EJS + layouts) ---------- */
app.use(expressLayouts);
app.set('layout', 'layout'); // usa views/layout.ejs como master
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ---------- Middlewares ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // se precisar ler form posts

/* ---------- Static files ---------- */
// Serve tudo que estiver em /public
app.use(express.static(path.join(__dirname, 'public')));
// Alias explícito para /Assets apontando pra /public/Assets
app.use('/Assets', express.static(path.join(__dirname, 'public/Assets')));

/* ---------- API ---------- */
app.use('/api/clients', clientsApiRoutes); // GET /api/clients?search=&startDate=&endDate=&page=&pageSize=
app.use('/api', authRoutes);               // suas rotas de autenticação sob /api

/* ---------- Páginas (EJS) ---------- */
// Clients (render pelo controller com dados do banco)
//app.get('/clientes', clientsCtrl.renderClients);     
app.get('/clientes', (req, res) => res.render('clientes'));              // lista
//app.get('/ClientDetails/:id', clientsCtrl.renderClientDetails);  // detalhe

// Demais páginas “estáticas” (se quiser, depois pode trocar por controllers)
app.get('/ClientDetails', (req, res) => res.render('ClientDetails'));
app.get('/NewClient',     (req, res) => res.render('NewClient'));
app.get('/MyDocuments',   (req, res) => res.render('MyDocuments'));
app.get('/Default',       (req, res) => res.render('Default'));
app.get('/Processos',     (req, res) => res.render('Processos'));
app.get('/NovoProcesso',  (req, res) => res.render('NovoProcesso'));
app.get('/ProcessDetail', (req, res) => res.render('ProcessDetail'));
app.get('/',              (req, res) => res.render('Login', { layout: false }));
app.get('/PublicProcessDetail', (req, res) => res.render('PublicProcessDetail', { layout: false }));

/* ---------- Routers adicionais ---------- */
// Mantém o router /clients (ex.: /clients e /clients/:id) – opcional se já usa /clientes acima
app.use('/clients', clientsRoutes);

/* ---------- 404 e erro genérico (opcional, mas útil) ---------- */
app.use((req, res) => res.status(404).send('Not Found'));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
