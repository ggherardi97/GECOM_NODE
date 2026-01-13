// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const companiesApiRoutes = require("./routes/companiesApi");

const usersApiPath = require.resolve(path.join(__dirname, "routes", "usersApi"));
console.log("usersApi resolved to:", usersApiPath);

const usersApiRoutes = require(usersApiPath);
console.log("usersApiRoutes typeof:", typeof usersApiRoutes);

const app = express();

/* ---------- View engine (EJS + layouts) ---------- */
app.use(expressLayouts);
app.set('layout', 'layout'); 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

/* ---------- Middlewares ---------- */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

/* ---------- Static files ---------- */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/Assets', express.static(path.join(__dirname, 'public/Assets')));

/* ---------- API (BFF) ---------- */
app.use('/auth', authRoutes);
app.use("/api", companiesApiRoutes);
app.use("/api", usersApiRoutes);

/* ---------- Páginas (EJS) ---------- */
app.get('/clientes', (req, res) => res.render('clientes')); 
app.get('/ClientDetails', (req, res) => res.render('ClientDetails'));
app.get('/NewClient',     (req, res) => res.render('NewClient'));
app.get('/MyDocuments',   (req, res) => res.render('MyDocuments'));
app.get('/Default',       (req, res) => res.render('Default'));
app.get('/Processos',     (req, res) => res.render('Processos'));
app.get('/NovoProcesso',  (req, res) => res.render('NovoProcesso'));
app.get('/ProcessDetail', (req, res) => res.render('ProcessDetail'));

app.get('/', (req, res) => res.render('Login', { layout: false }));
app.get('/PublicProcessDetail', (req, res) => res.render('PublicProcessDetail', { layout: false }));
app.get('/LandingPage', (req, res) => res.render('LandingPage', { layout: false }));

/* ---------- 404 e erro genérico (opcional, mas útil) ---------- */
app.use((req, res) => res.status(404).send('Not Found'));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
