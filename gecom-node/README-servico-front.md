# Módulo Serviço (Front)

## Rotas front (páginas)
- `/servico/incidentes`
- `/servico/sla/politicas`
- `/servico/sla/kpis`
- `/servico/sla/instancias`
- `/servico/sla/instancias-kpi`
- `/servico/sla/eventos`
- `/servico/filas`
- `/servico/filas/membros`
- `/servico/ativos`
- `/servico/assuntos`
- `/servico/calendarios`
- `/servico/calendarios/regras`
- `/servico/calendarios/excecoes`
- `/servico/recursos`
- `/servico/recursos/agendamentos`
- `/servico/tarefas`
- `/servico/tarefas/tipos`

## Componentes criados
- `routes/servicePages.js`: rotas EJS do módulo.
- `controllers/servicePagesController.js`: controllers de render das páginas com metadados de CRUD.
- `views/servico/*.ejs`: views do módulo (base + páginas).
- `public/js/servico/crud.page.js`: lógica genérica de CRUD (listar/criar/editar/excluir).
- `routes/serviceApi.js`: proxy BFF para `/api/service/*`, com remoção de `tenant_id` do payload.

## Endpoints backend utilizados
- Incidentes: `/service/incidents`
- SLA policies: `/service/sla/policies`
- SLA kpis: `/service/sla/kpis`
- SLA instances: `/service/sla/instances`
- SLA instance-kpis: `/service/sla/instance-kpis`
- SLA events: `/service/sla/events`
- Filas: `/service/queues`
- Filas membros: `/service/queues/members`
- Ativos: `/service/assets`
- Assuntos: `/service/subjects`
- Calendários: `/service/calendars`
- Calendários regras: `/service/calendars/rules`
- Calendários exceções: `/service/calendars/exceptions`
- Recursos: `/service/resources`
- Recursos agendamentos: `/service/resources/appointments`
- Tarefas: `/service/tasks`
- Tarefas tipos: `/service/tasks/types` e listagem em `/service/tasks/types/all`

## Observações
- Autenticação é reaproveitada do projeto (Bearer/cookies já existentes no BFF).
- Em erro `401/403`, o front redireciona para login (`/`).
- `tenant_id`/`tenantId` é removido no proxy antes de enviar ao backend.
