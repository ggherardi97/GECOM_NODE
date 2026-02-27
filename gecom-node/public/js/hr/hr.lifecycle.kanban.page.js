(function () {
  const { tt, normalizeArray } = window.HrResources || {};

  function t(key, fallback) {
    if (typeof tt === "function") return tt(key, fallback);
    return fallback;
  }

  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: "include" }, opts || {})).then(async (resp) => {
      const text = await resp.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data;
    });
  }

  const state = {
    employees: [],
    lifecycle: null,
    stages: [],
    tasks: [],
  };

  function getStatusByColumn(index, total) {
    if (index >= total - 1) return "DONE";
    if (index <= 0) return "OPEN";
    return "DOING";
  }

  function badgeText(stage, tasks) {
    const count = tasks.filter((task) => String(task.stage_id || "") === String(stage.id || "")).length;
    return String(count);
  }

  function renderBoard() {
    const $board = $("#hrKanbanBoard");
    if (!$board.length) return;

    if (!state.lifecycle) {
      $board.html(`<div class="alert alert-info">${t("page.hr.lifecycleKanban.noData", "Nenhum lifecycle ativo encontrado para os filtros.")}</div>`);
      return;
    }

    const cols = state.stages || [];
    const tasks = state.tasks || [];

    if (!cols.length) {
      $board.html(`<div class="alert alert-warning">${t("page.hr.lifecycleKanban.noStages", "Template sem colunas configuradas.")}</div>`);
      return;
    }

    const html = cols
      .map((stage, idx) => {
        const cards = tasks
          .filter((task) => String(task.stage_id || "") === String(stage.id || ""))
          .map((task) => {
            const due = task?.due_date ? new Date(task.due_date).toLocaleDateString("pt-BR") : "-";
            const responsible = task?.responsible_employee?.full_name || "-";
            return `
              <div class="hr-kanban-card"
                draggable="true"
                data-task-id="${String(task.id || "")}" 
                data-stage-id="${String(stage.id || "")}">
                <h5>${String(task.title || "")}</h5>
                <div class="hr-kanban-meta">${t("page.hr.fields.dueDate", "Prazo")}: ${due}</div>
                <div class="hr-kanban-meta">${t("page.hr.fields.responsibleEmployee", "Responsavel")}: ${responsible}</div>
                <div class="hr-kanban-meta">${t("page.hr.fields.status", "Status")}: ${String(task.status || "OPEN")}</div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="hr-kanban-col" data-stage-id="${String(stage.id || "")}" data-stage-index="${idx}">
            <div class="hr-kanban-col-header">
              <span>${String(stage.name || "-")}</span>
              <span class="label label-default">${badgeText(stage, tasks)}</span>
            </div>
            <div class="hr-kanban-col-body">
              ${cards || `<div class="hr-kanban-empty">${t("page.hr.lifecycleKanban.emptyColumn", "Sem tarefas")}</div>`}
            </div>
          </div>
        `;
      })
      .join("");

    $board.html(html);
    bindBoardEvents();
  }

  function bindBoardEvents() {
    let draggedTaskId = null;

    $(".hr-kanban-card")
      .off("dragstart.hrk dragend.hrk click.hrk")
      .on("dragstart.hrk", function (event) {
        draggedTaskId = String($(this).data("task-id") || "");
        event.originalEvent.dataTransfer.effectAllowed = "move";
        $(this).css("opacity", 0.55);
      })
      .on("dragend.hrk", function () {
        $(this).css("opacity", 1);
      })
      .on("click.hrk", function () {
        const taskId = String($(this).data("task-id") || "");
        openTaskModal(taskId);
      });

    $(".hr-kanban-col-body")
      .off("dragover.hrk drop.hrk")
      .on("dragover.hrk", function (event) {
        event.preventDefault();
        event.originalEvent.dataTransfer.dropEffect = "move";
      })
      .on("drop.hrk", async function (event) {
        event.preventDefault();
        const taskId = String(draggedTaskId || "").trim();
        if (!taskId) return;

        const $col = $(this).closest(".hr-kanban-col");
        const stageId = String($col.data("stage-id") || "").trim();
        const stageIndex = Number($col.data("stage-index") || 0);
        const status = getStatusByColumn(stageIndex, state.stages.length);

        try {
          await api(`/api/hr/lifecycle/employee-lifecycle-tasks/${encodeURIComponent(taskId)}/move`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage_id: stageId, status }),
          });
          await loadKanban();
        } catch (error) {
          alert(error?.message || t("page.hr.common.error", "Erro ao mover tarefa"));
        } finally {
          draggedTaskId = null;
        }
      });
  }

  async function openTaskModal(taskId) {
    const task = (state.tasks || []).find((row) => String(row.id || "") === String(taskId || ""));
    if (!task) return;

    const stageOptions = (state.stages || [])
      .map((stage) => `<option value="${String(stage.id)}" ${String(task.stage_id || "") === String(stage.id) ? "selected" : ""}>${String(stage.name || "")}</option>`)
      .join("");

    const html = `
      <div class="form-group">
        <label>${t("page.hr.fields.title", "Titulo")}</label>
        <input type="text" class="form-control" value="${String(task.title || "").replace(/\"/g, "&quot;")}" disabled>
      </div>
      <div class="form-group">
        <label>${t("page.hr.fields.stage", "Etapa")}</label>
        <select id="hrTaskModalStage" class="form-control">${stageOptions}</select>
      </div>
      <div class="form-group">
        <label>${t("page.hr.fields.status", "Status")}</label>
        <select id="hrTaskModalStatus" class="form-control">
          ${["OPEN", "DOING", "DONE", "BLOCKED", "CANCELED"].map((s) => `<option value="${s}" ${String(task.status || "") === s ? "selected" : ""}>${s}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>${t("page.hr.fields.dueDate", "Prazo")}</label>
        <input id="hrTaskModalDueDate" type="date" class="form-control" value="${task.due_date ? String(task.due_date).slice(0, 10) : ""}">
      </div>
      <div class="form-group">
        <label>${t("page.hr.fields.notes", "Observacoes")}</label>
        <textarea id="hrTaskModalNotes" class="form-control" rows="3">${String(task.notes || "")}</textarea>
      </div>
    `;

    if (!window.SideModal || typeof window.SideModal.open !== "function") {
      window.location.href = `/hr/lifecycle/employee-lifecycle-tasks/${encodeURIComponent(taskId)}/edit`;
      return;
    }

    await window.SideModal.open({
      title: t("page.hr.lifecycleKanban.editTask", "Editar tarefa"),
      html,
      okText: t("page.hr.common.save", "Salvar"),
      cancelText: t("page.hr.common.cancel", "Cancelar"),
      onOk: async () => {
        const payload = {
          stage_id: String($("#hrTaskModalStage").val() || "").trim() || null,
          status: String($("#hrTaskModalStatus").val() || "OPEN").trim(),
          due_date: String($("#hrTaskModalDueDate").val() || "").trim() || null,
          notes: String($("#hrTaskModalNotes").val() || "").trim() || null,
        };

        await api(`/api/hr/lifecycle/employee-lifecycle-tasks/${encodeURIComponent(taskId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        await loadKanban();
      },
    });
  }

  async function loadEmployees() {
    const rows = normalizeArray(await api("/api/hr/employees?is_active=true&page_size=200"));
    state.employees = rows;
    const html = ["<option value=\"\">Selecione...</option>"]
      .concat(
        rows.map((row) => {
          const label = String(row.full_name || row.employee_number || row.id || "");
          return `<option value="${String(row.id || "")}">${label}</option>`;
        }),
      )
      .join("");

    $("#hrKanbanEmployee").html(html);
  }

  async function loadKanban() {
    const employeeId = String($("#hrKanbanEmployee").val() || "").trim();
    const type = String($("#hrKanbanType").val() || "ONBOARDING").trim();

    const qs = new URLSearchParams();
    if (employeeId) qs.set("employee_id", employeeId);
    if (type) qs.set("type", type);

    const data = await api(`/api/hr/lifecycle/kanban?${qs.toString()}`);
    state.lifecycle = data?.lifecycle || null;
    state.stages = normalizeArray(data?.stages);
    state.tasks = normalizeArray(data?.tasks);
    renderBoard();
  }

  async function init() {
    try {
      await loadEmployees();
      await loadKanban();
    } catch (error) {
      $("#hrKanbanBoard").html(`<div class="alert alert-danger">${error?.message || t("page.hr.common.error", "Erro ao carregar kanban")}</div>`);
    }

    $("#hrKanbanEmployee, #hrKanbanType").on("change", loadKanban);
    $("#btnHrKanbanRefresh").on("click", loadKanban);
  }

  $(init);
})();
