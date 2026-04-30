(function () {
  const api = window.ServiceApi;
  const shared = window.ServiceResources || {};
  const { waitForI18nReady, textFor, esc, normalizeArray, enumLabel, enumOptions } = shared;
  const cfg = window.__SERVICE_PAGE_CONFIG || {};
  if (!api || !cfg) return;

  const columns = ["OPEN", "IN_PROGRESS", "WAITING", "DONE", "CANCELLED"];
  const state = { tasks: [] };

  function tt(value, fallback) {
    return textFor(value, fallback);
  }

  function formatDateTime(value) {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
  }

  async function loadTasks() {
    const data = await api.getJson(cfg.apiPath || "/api/service/tasks");
    state.tasks = normalizeArray(data);
    renderBoard();
  }

  function renderBoard() {
    const statusLabels = enumOptions("taskStatus").reduce((acc, item) => {
      acc[item.value] = item.label;
      return acc;
    }, {});

    const html = columns
      .map((status) => {
        const items = state.tasks.filter((task) => String(task?.status || "OPEN") === status);
        const cards = items
          .map((task) => `
            <div class="service-task-card" data-id="${esc(task.id)}">
              <h5>${esc(task.title || "Tarefa sem titulo")}</h5>
              <div class="service-task-card-meta">${esc(task.task_type?.name || enumLabel("taskChannel", task.type || "", task.type || "-"))}</div>
              <div class="service-task-card-meta">${esc(enumLabel("priority", task.priority || "", task.priority || "-"))}</div>
              <div class="service-task-card-meta">${esc(task.assigned_to_user?.full_name || "-")}</div>
              <div class="service-task-card-meta">${esc(formatDateTime(task.due_at))}</div>
            </div>
          `)
          .join("");

        return `
          <section class="service-task-kanban-col" data-status="${esc(status)}">
            <div class="service-task-kanban-head">
              <h4>${esc(statusLabels[status] || status)}</h4>
              <small>${esc(String(items.length))} itens</small>
            </div>
            <div class="service-task-kanban-cards">
              ${cards || `<div class="service-task-empty">${esc(tt({ pt: "Sem tarefas", en: "No tasks", es: "Sin tareas" }, "Sem tarefas"))}</div>`}
            </div>
          </section>
        `;
      })
      .join("");

    $("#taskKanbanBoard").html(html);

    if ($.fn.sortable) {
      $(".service-task-kanban-cards")
        .sortable({
          connectWith: ".service-task-kanban-cards",
          items: ".service-task-card",
          placeholder: "service-task-empty",
          stop: async function (_event, ui) {
            const taskId = String(ui.item.data("id") || "");
            const nextStatus = String(ui.item.closest(".service-task-kanban-col").data("status") || "");
            if (!taskId || !nextStatus) return;
            try {
              await api.putJson(`/api/service/tasks/${encodeURIComponent(taskId)}`, { status: nextStatus });
              await loadTasks();
            } catch (error) {
              console.error(error);
              await loadTasks();
              alert(error?.message || "Nao foi possivel mover a tarefa.");
            }
          },
        })
        .disableSelection();
    }
  }

  function bindEvents() {
    $("#btnTaskKanbanList").on("click", function () {
      window.location.href = cfg.gridPath || "/servico/tarefas";
    });
    $("#btnTaskKanbanRefresh").on("click", loadTasks);
    $("#btnTaskKanbanNew").on("click", function () {
      window.location.href = cfg.newPageUrl || "/servico/tarefas/ficha";
    });
    $("#taskKanbanBoard").on("click", ".service-task-card", function () {
      const id = String($(this).data("id") || "");
      if (id) window.location.href = String(cfg.editPageUrl || "/servico/tarefas/ficha?id={id}").replace("{id}", encodeURIComponent(id));
    });
  }

  async function init() {
    await waitForI18nReady(2000);
    $("#pageName").text(tt(cfg.title, "Tarefas"));
    $("#subpageName").text(tt(cfg.title, "Tarefas")).attr("href", cfg.gridPath || "/servico/tarefas");
    $("#subSecoundPageName").text("Kanban");
    $("#subpathName").text("Kanban");
    bindEvents();
    await loadTasks();
  }

  $(document).ready(function () {
    init().catch((error) => {
      console.error(error);
      $("#taskKanbanBoard").html(`<div class="service-task-empty">${esc(error?.message || "Nao foi possivel carregar o kanban.")}</div>`);
    });
  });
})();
