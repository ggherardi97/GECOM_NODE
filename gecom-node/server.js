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
const savedViewsApi = require("./routes/savedViewsApi");
const kanbanApi = require("./routes/kanbanApi");
const leadsApi = require("./routes/leadsApi");
const aiApi = require("./routes/aiApi");
const serviceApiRoutes = require("./routes/serviceApi");
const statusConfigsApiRoutes = require("./routes/statusConfigsApi");
const tradeSimulationsApiRoutes = require("./routes/tradeSimulationsApi");
const servicePagesRoutes = require("./routes/servicePages");
const opportunitiesApiRoutes = require("./routes/opportunitiesApi");
const contractsApiRoutes = require("./routes/contractsApi");
const priceTablesApiRoutes = require("./routes/priceTablesApi");
const salesApprovalsApiRoutes = require("./routes/salesApprovalsApi");
const salesGoalsApiRoutes = require("./routes/salesGoalsApi");
const billingApiRoutes = require("./routes/billingApi");
const billingPagesRoutes = require("./routes/billingPages");
const automationsApiRoutes = require("./routes/automationsApi");
const financeApiRoutes = require("./routes/financeApi");
const financePagesRoutes = require("./routes/financePages");
const hrApiRoutes = require("./routes/hrApi");
const hrPagesRoutes = require("./routes/hrPages");
const poApiRoutes = require("./routes/poApi");
const poPagesRoutes = require("./routes/poPages");
const adminApiRoutes = require("./routes/adminApi");
const adminPagesRoutes = require("./routes/adminPages");
const scarletDriveRoutes = require("./routes/scarletDrive");

const usersApiPath = require.resolve(path.join(__dirname, "routes", "usersApi"));
const usersApiRoutes = require(usersApiPath);
const tenantsApiRoutes = require("./routes/tenantsApi");

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
    ns: ['common', 'leads'],
    defaultNS: 'common',
    fallbackNS: ['leads'],
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
  res.locals.enableAI = String(process.env.ENABLE_AI || "true").toLowerCase() === "true";
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
app.use("/api", tenantsApiRoutes);
app.use("/api", processApiRoutes);
app.use('/api', cnpjApiRoutes);
app.use('/api', invoicesApiRoutes);
app.use('/api', productsApiRoutes);
app.use('/api', currenciesApiRoutes);
app.use('/api', companiesApiRoutes);
app.use("/api", processTypesApi);
app.use("/api", savedViewsApi);
app.use("/api", kanbanApi);
app.use("/api", require("./routes/eventsApi"));
app.use("/api", require("./routes/documentsApi"));
app.use("/api", require("./routes/transportTypesApi"));
app.use("/api", require("./routes/transportsApi"));
app.use("/api", require("./routes/transportStatusesApi"));
const notificationsApi = require("./routes/notificationsApi");
app.use("/api", notificationsApi);
app.use("/api", leadsApi);
app.use("/api", aiApi);
app.use("/api", serviceApiRoutes);
app.use("/api", statusConfigsApiRoutes);
app.use("/api", tradeSimulationsApiRoutes);
app.use("/api", opportunitiesApiRoutes);
app.use("/api", contractsApiRoutes);
app.use("/api", priceTablesApiRoutes);
app.use("/api", salesApprovalsApiRoutes);
app.use("/api", salesGoalsApiRoutes);
app.use("/api", billingApiRoutes);
app.use("/api", automationsApiRoutes);
app.use("/api", financeApiRoutes);
app.use("/api", hrApiRoutes);
app.use("/api", poApiRoutes);
app.use("/api", adminApiRoutes);
app.use("/", billingPagesRoutes);
app.use("/", servicePagesRoutes);
app.use("/", financePagesRoutes);
app.use("/", hrPagesRoutes);
app.use("/", poPagesRoutes);
app.use("/", adminPagesRoutes);
app.use("/", scarletDriveRoutes);

// Backward-compatible alias for environments calling /cnpj/lookup without /api
app.get("/cnpj/lookup", (req, res) => {
  const qs = new URLSearchParams(req.query || {}).toString();
  const target = `/api/cnpj/lookup${qs ? `?${qs}` : ""}`;
  return res.redirect(307, target);
});

/* ---------- Páginas (EJS) ---------- */
app.get('/clientes', (req, res) => res.render('clientes'));
app.get('/ClientDetails', (req, res) => res.render('ClientDetails'));
app.get('/NewClient', (req, res) => res.render('NewClient'));
app.get('/MyDocuments', (req, res) => res.render('MyDocuments'));
app.get('/Default', (req, res) => res.render('Default'));
app.get(['/AI', '/ai'], (req, res) => res.render('AI'));
app.get('/Processos', (req, res) => res.render('Processos'));
app.get('/NovoProcesso', (req, res) => res.render('NovoProcesso'));
app.get('/ProcessDetail', (req, res) => res.render('ProcessDetail'));
app.get(['/Products', '/products'], (req, res) => res.render('Products'));
app.get(['/Invoices', '/invoices'], (req, res) => res.render('Invoices'));
app.get(['/NewInvoice', '/newinvoice'], (req, res) => res.render('NewInvoice'));
app.get(['/calculo-aduaneiro', '/CalculoAduaneiro'], (req, res) => res.render('CalculoAduaneiro'));
app.get('/calculo-aduaneiro/:id', (req, res) => res.render('CalculoAduaneiro'));
app.get(['/configuracoes/status', '/Configuracoes/Status'], (req, res) => res.render('StatusConfigs'));
app.get('/ProductDetail', (req, res) => res.render('ProductDetail'));
app.get('/NewProduct', (req, res) => res.render('NewProduct'));
app.get(['/MyActivities', '/my-activities', '/MinhasAtividades'], (req, res) => res.render('MyActivities'));
app.get("/Profile", (req, res) => res.render("Profile"));
app.get("/NewNotification", (req, res) => res.render("NewNotification"));
app.get(["/Notifications", "/notifications"], (req, res) => res.render("Notifications"));
app.get("/leads/pipeline", (req, res) => res.render("leads/leads-pipeline"));
app.get("/leads/new", (req, res) => res.render("leads/lead-form"));
app.get("/leads/:id/edit", (req, res) => res.render("leads/lead-form"));
app.get("/leads/:id", (req, res) => res.render("leads/lead-detail"));
app.get("/leads", (req, res) => res.render("leads/leads-list"));
app.get(['/Opportunities', '/opportunities'], (req, res) => res.render('Opportunities'));
app.get(['/NewOpportunity', '/new-opportunity'], (req, res) => res.render('NewOpportunity'));
app.get(['/Contracts', '/contracts'], (req, res) => res.render('Contracts'));
app.get(['/NewContract', '/new-contract'], (req, res) => res.render('NewContract'));
app.get(['/SalesApprovals', '/sales-approvals'], (req, res) => res.render('SalesApprovals'));
app.get(['/NewSalesApproval', '/new-sales-approval'], (req, res) => res.render('NewSalesApproval'));
app.get(['/PriceTables', '/price-tables'], (req, res) => res.render('PriceTables'));
app.get(['/NewPriceTable', '/new-price-table'], (req, res) => res.render('NewPriceTable'));
app.get(['/SalesGoals', '/sales-goals'], (req, res) => res.render('SalesGoals'));
app.get(['/NewSalesGoal', '/new-sales-goal'], (req, res) => res.render('NewSalesGoal'));
app.get(['/SalesCommissions', '/sales-commissions'], (req, res) => res.render('SalesCommissions'));
app.get(['/NewSalesCommission', '/new-sales-commission'], (req, res) => res.render('NewSalesCommission'));
app.get('/automations', (req, res) => res.render('automations/index'));
app.get('/automations/new', (req, res) => res.render('automations/new'));
app.get('/automations/:id/builder', (req, res) => res.render('automations/builder'));

app.get('/', (req, res) => res.render('Login', { layout: false }));
app.get('/PublicProcessDetail', (req, res) => res.render('PublicProcessDetail', { layout: false }));
app.get('/LandingPage', (req, res) => res.render('LandingPage', { layout: false }));
app.get(['/cadastro', '/register'], (req, res) => res.render('PublicRegister', { layout: false }));

/* ---------- 404 e erro genérico (opcional, mas útil) ---------- */
app.use((req, res) => res.status(404).send('Not Found'));
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

/* ---------- Start ---------- */
const PORT = process.env.PORT || 3100;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
