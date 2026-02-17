(function () {
  if (window.GecomAI && typeof window.GecomAI.openGridFilterModal === "function") return;

  function ensureModal() {
    if (document.getElementById("ai_gridFilterModal")) return;

    const html = `
      <div class="modal fade" id="ai_gridFilterModal" tabindex="-1" role="dialog" aria-hidden="true">
        <div class="modal-dialog" role="document" style="max-width: 640px;">
          <div class="modal-content">
            <div class="modal-header">
              <h4 class="modal-title">Filtro com IA</h4>
              <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                <span aria-hidden="true">&times;</span>
              </button>
            </div>
            <div class="modal-body">
              <div id="aiGridFilterAlert" class="alert alert-danger" style="display:none; margin-bottom:10px;"></div>

              <div class="form-group">
                <label for="aiGridFilterPrompt">Descreva os filtros desejados</label>
                <textarea id="aiGridFilterPrompt" class="form-control" rows="4" placeholder="Ex.: mostrar apenas itens ativos, criados nos últimos 30 dias, ordenados por data desc"></textarea>
              </div>

              <div class="form-group" style="margin-bottom:0;">
                <label>Explicação</label>
                <div id="aiGridFilterExplanation" class="well well-sm" style="min-height:60px; margin-bottom:0; white-space:pre-wrap;"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-white" data-dismiss="modal" id="aiGridFilterCancelBtn">Cancelar</button>
              <button type="button" class="btn btn-primary" id="aiGridFilterApplyBtn">Aplicar</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML("beforeend", html);
  }

  function setLoading(isLoading) {
    const applyBtn = document.getElementById("aiGridFilterApplyBtn");
    const cancelBtn = document.getElementById("aiGridFilterCancelBtn");
    const prompt = document.getElementById("aiGridFilterPrompt");

    if (applyBtn) {
      applyBtn.disabled = !!isLoading;
      applyBtn.textContent = isLoading ? "Gerando..." : "Aplicar";
    }
    if (cancelBtn) cancelBtn.disabled = !!isLoading;
    if (prompt) prompt.disabled = !!isLoading;
  }

  function showError(message) {
    const alertBox = document.getElementById("aiGridFilterAlert");
    if (!alertBox) return;
    alertBox.className = "alert alert-danger";
    alertBox.style.display = "block";
    alertBox.textContent = message || "Erro ao gerar filtro.";
  }

  function showSuccess(message) {
    const alertBox = document.getElementById("aiGridFilterAlert");
    if (!alertBox) return;
    alertBox.className = "alert alert-success";
    alertBox.style.display = "block";
    alertBox.textContent = message || "Filtro aplicado com sucesso.";
  }

  function clearMessages() {
    const alertBox = document.getElementById("aiGridFilterAlert");
    if (alertBox) {
      alertBox.className = "alert alert-danger";
      alertBox.style.display = "none";
      alertBox.textContent = "";
    }
    setExplanation("");
  }

  function setExplanation(text) {
    const explanation = document.getElementById("aiGridFilterExplanation");
    if (!explanation) return;
    explanation.textContent = String(text || "");
  }

  async function postGridFilter(payload) {
    if (window.GECOM_AI_API && typeof window.GECOM_AI_API.getAiGridFilter === "function") {
      return window.GECOM_AI_API.getAiGridFilter(payload || {});
    }

    const response = await fetch("/api/ai/grid-filter", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      credentials: "same-origin",
      body: JSON.stringify(payload || {}),
    });

    const raw = await response.text().catch(() => "");
    let data = {};
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = { message: raw };
      }
    }

    if (!response.ok) {
      throw new Error(data?.message || "Falha ao consultar IA.");
    }
    return data || {};
  }

  function bindApply(entityName) {
    const applyBtn = document.getElementById("aiGridFilterApplyBtn");
    if (!applyBtn) return;

    applyBtn.onclick = async function () {
      clearMessages();

      const promptEl = document.getElementById("aiGridFilterPrompt");
      const naturalLanguage = String(promptEl?.value || "").trim();
      if (!naturalLanguage) {
        showError("Informe um prompt para gerar o filtro.");
        return;
      }

      if (!window.SavedViewsGrid || typeof window.SavedViewsGrid.getCurrentDefinition !== "function") {
        showError("SavedViewsGrid não disponível.");
        return;
      }

      setLoading(true);
      try {
        const currentDefinition = window.SavedViewsGrid.getCurrentDefinition(entityName) || {};
        const data = await postGridFilter({
          entityName,
          naturalLanguage,
          currentViewDefinitionJson: currentDefinition,
        });

        const definition = data?.definition_json || {};
        const explanation = data?.explanation_ptbr || "";
        setExplanation(explanation);

        if (typeof window.SavedViewsGrid.applyExternalDefinition !== "function") {
          throw new Error("SavedViewsGrid.applyExternalDefinition não disponível.");
        }

        await window.SavedViewsGrid.applyExternalDefinition(entityName, definition, "IA");
        showSuccess("Filtro aplicado. Você pode revisar a explicação e fechar quando quiser.");
      } catch (err) {
        showError(err?.message || "Falha ao aplicar filtro com IA.");
      } finally {
        setLoading(false);
      }
    };
  }

  function openGridFilterModal(args) {
    const entityName = String(args?.entityName || "").trim();
    if (!entityName) {
      alert("Entity inválida para filtro com IA.");
      return;
    }

    if (window.__features && window.__features.enableAI === false) {
      alert("Funcionalidade de IA desabilitada.");
      return;
    }

    ensureModal();
    clearMessages();
    setLoading(false);

    const promptEl = document.getElementById("aiGridFilterPrompt");
    if (promptEl) promptEl.value = "";

    bindApply(entityName);
    $("#ai_gridFilterModal").modal("show");
    setTimeout(function () {
      const el = document.getElementById("aiGridFilterPrompt");
      if (el) el.focus();
    }, 150);
  }

  window.GecomAI = {
    openGridFilterModal: openGridFilterModal,
  };
})();
