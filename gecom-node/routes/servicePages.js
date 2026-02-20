const express = require("express");
const controller = require("../controllers/servicePagesController");

const router = express.Router();

router.get("/servico/incidentes", controller.incidentes);
router.get("/servico/sla/politicas", controller.slaPoliticas);
router.get("/servico/sla/kpis", controller.slaKpis);
router.get("/servico/sla/instancias", controller.slaInstancias);
router.get("/servico/sla/instancias-kpi", controller.slaInstanciasKpi);
router.get("/servico/sla/eventos", controller.slaEventos);
router.get("/servico/filas", controller.filas);
router.get("/servico/filas/membros", controller.filasMembros);
router.get("/servico/ativos", controller.ativos);
router.get("/servico/assuntos", controller.assuntos);
router.get("/servico/calendarios", controller.calendarios);
router.get("/servico/calendarios/regras", controller.calendariosRegras);
router.get("/servico/calendarios/excecoes", controller.calendariosExcecoes);
router.get("/servico/recursos", controller.recursos);
router.get("/servico/recursos/agendamentos", controller.recursosAgendamentos);
router.get("/servico/tarefas", controller.tarefas);
router.get("/servico/tarefas/tipos", controller.tarefasTipos);

module.exports = router;
