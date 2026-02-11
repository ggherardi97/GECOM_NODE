// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const cookieParser = require('cookie-parser');

/* ---------- i18n (i18next) ---------- */
const i18next = require('i18next');
const i18nextFsBackend = require('i18next-fs-backend');
const i18nextHttpMiddleware = require('i18next-http-middleware');

const authRoutes = require('./routes/auth');
const companiesApiRoutes = require("./routes/companiesApi");
const processApiRoutes = require("./routes/processApi");
const cnpjApiRoutes = require('./routes/cnpjApi');
const invoicesApiRoutes = require('./routes/invoicesApi');
const productsApiRoutes = require('./routes/productsApi');
const currenciesApiRoutes = require('./routes/currenciesApi');
const processTypesApi = require("./routes/processTypesApi");

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
// Increase payload limits (needed for base64 images in JSON)
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use(cookieParser());

/* ---------- i18n setup MUST come after cookieParser (for cookie detection) ---------- */
i18next
  .use(i18nextFsBackend)
  .use(i18nextHttpMiddleware.LanguageDetector)
  .init({
    fallbackLng: 'pt-BR',
    preload: ['pt-BR', 'en', 'es'],
    supportedLngs: ['pt-BR', 'en', 'es'],
    ns: ['common'],
    defaultNS: 'common',
    backend: {
      loadPath: path.join(__dirname, 'locales/{{lng}}/{{ns}}.json'),
    },
    detection: {
      // Priority: ?lang=en -> cookie -> browser header -> fallback
      order: ['querystring', 'cookie', 'header'],
      lookupQuerystring: 'lang',
      lookupCookie: 'gecom_lang',
      caches: ['cookie'], // auto set cookie if detected from query/header
      cookieSameSite: 'lax',
    },
  });

// Attach i18n to request
app.use(i18nextHttpMiddleware.handle(i18next));

// Make translation helpers available in all EJS views
app.use((req, res, next) => {
  res.locals.t = req.t;
  res.locals.lang = req.language || 'pt-BR';
  res.locals.i18n = req.i18n;
  next();
});

/* ---------- Static files ---------- */
app.use(express.static(path.join(__dirname, 'public')));
app.use('/Assets', express.static(path.join(__dirname, 'public/Assets')));
app.use('/locales', express.static(path.join(__dirname, 'locales')));

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
app.use("/api", require("./routes/documentsApi"));
app.use("/api", require("./routes/transportTypesApi"));
app.use("/api", require("./routes/transportsApi"));
app.use("/api", require("./routes/transportStatusesApi"));

/* ---------- Páginas (EJS) ---------- */
app.get('/clientes', (req, res) => res.render('clientes'));
app.get('/ClientDetails', (req, res) => res.render('ClientDetails'));
app.get('/NewClient', (req, res) => res.render('NewClient'));
app.get('/MyDocuments', (req, res) => res.render('MyDocuments'));
app.get('/Default', (req, res) => res.render('Default'));
app.get('/Processos', (req, res) => res.render('Processos'));
app.get('/NovoProcesso', (req, res) => res.render('NovoProcesso'));
app.get('/ProcessDetail', (req, res) => res.render('ProcessDetail'));
app.get(['/Products', '/products'], (req, res) => res.render('Products'));
app.get(['/Invoices', '/invoices'], (req, res) => res.render('Invoices'));
app.get(['/NewInvoice', '/newinvoice'], (req, res) => res.render('NewInvoice'));
app.get('/ProductDetail', (req, res) => res.render('ProductDetail'));
app.get('/NewProduct', (req, res) => res.render('NewProduct'));
app.get("/Profile", (req, res) => res.render("Profile"));

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
