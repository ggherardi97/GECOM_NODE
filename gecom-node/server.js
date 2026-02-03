// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/auth');
const companiesApiRoutes = require("./routes/companiesApi");
const processApiRoutes = require("./routes/processApi");
const cnpjApiRoutes = require('./routes/cnpjApi');
const invoicesApiRoutes = require('./routes/invoicesApi');
const productsApiRoutes = require('./routes/productsApi');
const currenciesApiRoutes = require('./routes/currenciesApi');
const processTypesApi = require("./routes/processTypesApi");


console.log("invoicesApiRoutes typeof:", typeof invoicesApiRoutes);
console.log("productsApiRoutes typeof:", typeof productsApiRoutes);
console.log("currenciesApiRoutes typeof:", typeof currenciesApiRoutes);


const usersApiPath = require.resolve(path.join(__dirname, "routes", "usersApi"));
const usersApiRoutes = require(usersApiPath);

const app = express();

/* ---------- View engine (EJS + layouts) ---------- */
app.use(expressLayouts);
app.set('layout', 'layout'); 
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
// BigInt-safe JSON helper for EJS (views)
app.locals.safeJson = function safeJson(value) {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
};

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
app.use("/api", processApiRoutes);
app.use('/api', cnpjApiRoutes);
app.use('/api', invoicesApiRoutes);
app.use('/api', productsApiRoutes);
app.use('/api', currenciesApiRoutes);
app.use('/api', companiesApiRoutes);
app.use("/api", processTypesApi);
app.use("/api", require("./routes/eventsApi"));
app.use("/api", require("./routes/transportTypesApi"));
app.use("/api", require("./routes/transportsApi"));
app.use("/api", require("./routes/transportStatusesApi"));

/* ---------- Páginas (EJS) ---------- */
app.get('/clientes', (req, res) => res.render('clientes')); 
app.get('/ClientDetails', (req, res) => res.render('ClientDetails'));
app.get('/NewClient',     (req, res) => res.render('NewClient'));
app.get('/MyDocuments',   (req, res) => res.render('MyDocuments'));
app.get('/Default',       (req, res) => res.render('Default'));
app.get('/Processos',     (req, res) => res.render('Processos'));
app.get('/NovoProcesso',  (req, res) => res.render('NovoProcesso'));
app.get('/ProcessDetail', (req, res) => res.render('ProcessDetail'));
app.get(['/Products', '/products'], (req, res) => res.render('Products'));
app.get(['/Invoices', '/invoices'], (req, res) => res.render('Invoices'));
app.get(['/NewInvoice', '/newinvoice'], (req, res) => res.render('NewInvoice'));
app.get('/ProductDetail', (req, res) => res.render('ProductDetail'));
app.get('/NewProduct', (req, res) => res.render('NewProduct'));

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
