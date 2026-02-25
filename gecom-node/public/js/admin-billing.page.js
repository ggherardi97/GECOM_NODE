(function () {
  const state = {
    modules: [],
    plans: [],
    selectedPlanId: null,
    selectedPlanModules: [],
    selectedTenant: null,
    tenantSubscription: null,
    tenantResolvedModules: [],
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.items)) return data.items;
    return [];
  }

  function showToast(type, message) {
    if (window.toastr && typeof window.toastr[type] === "function") {
      window.toastr[type](message);
      return;
    }
    alert(message);
  }

  function isTruthy(value) {
    return value === true || String(value || "").toLowerCase() === "true";
  }

  function toMoneyNumber(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  }

  function formatMoneyBRL(value) {
    const amount = toMoneyNumber(value);
    return amount.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function toLocalDateTimeInputValue(iso) {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  function fromLocalDateTimeInputValue(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return null;
    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  }

  async function apiRequest(method, url, payload) {
    const response = await fetch(url, {
      method,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(payload !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(payload !== undefined ? { body: JSON.stringify(payload || {}) } : {}),
    });

    const text = await response.text().catch(() => "");
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }

    if (!response.ok) {
      const error = new Error(data?.message || `HTTP ${response.status}`);
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function renderModulesTable() {
    const rows = state.modules
      .map((row) => {
        const activeLabel = row.is_active ? "Sim" : "Nao";
        const toggleLabel = row.is_active ? "Desativar" : "Ativar";
        return `
          <tr>
            <td>${esc(row.code)}</td>
            <td>
              <strong>${esc(row.name_pt_br)}</strong><br />
              <span class="billing-muted">${esc(row.description_pt_br || "")}</span>
            </td>
            <td>${esc(formatMoneyBRL(row.monthly_price))}</td>
            <td>${esc(activeLabel)}</td>
            <td>
              <button class="btn btn-xs btn-default js-edit-module" data-id="${esc(row.id)}">
                <i class="fa fa-pencil"></i> Editar
              </button>
              <button class="btn btn-xs btn-warning js-toggle-module" data-id="${esc(row.id)}">
                ${esc(toggleLabel)}
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    $("#billingModulesBody").html(rows || '<tr><td colspan="5">Nenhum modulo cadastrado.</td></tr>');
  }

  function renderPlansList() {
    const html = state.plans
      .map((plan) => {
        const isSelected = String(plan.id) === String(state.selectedPlanId);
        const activeBadge = plan.is_active
          ? '<span class="label label-primary">Ativo</span>'
          : '<span class="label label-default">Inativo</span>';
        const customBadge = plan.is_custom
          ? ' <span class="label label-warning">Custom</span>'
          : '';
        const count = Number(plan?._count?.plan_modules || 0);
        return `
          <a href="#" class="list-group-item ${isSelected ? "active" : ""} js-select-plan" data-id="${esc(plan.id)}">
            <h4 class="list-group-item-heading">${esc(plan.name)} (${esc(plan.code)})</h4>
            <p class="list-group-item-text">${esc(plan.description || "")}</p>
            <small>${activeBadge}${customBadge} | Preco: ${esc(formatMoneyBRL(plan.monthly_price))} | Modulos: ${esc(count)}</small><br />
            <button class="btn btn-xs btn-white js-edit-plan" data-id="${esc(plan.id)}" style="margin-top: 6px;">
              <i class="fa fa-pencil"></i> Editar
            </button>
          </a>
        `;
      })
      .join("");

    $("#billingPlansList").html(html || '<div class="list-group-item">Nenhum plano cadastrado.</div>');
    fillPlanSelectForSubscription();
  }

  function renderPlanModulesTable() {
    if (!state.selectedPlanId) {
      $("#billingPlanModulesBody").html('<tr><td colspan="5">Selecione um plano.</td></tr>');
      return;
    }

    const rows = state.selectedPlanModules
      .map((row) => {
        return `
          <tr>
            <td>${esc(row?.module?.name_pt_br || "-")}</td>
            <td>${esc(row?.module?.code || "-")}</td>
            <td>
              <input type="number" class="form-control input-sm js-plan-module-sort-order"
                data-id="${esc(row.id)}" value="${esc(row.sort_order)}" />
            </td>
            <td>
              <input type="checkbox" class="js-plan-module-included" data-id="${esc(row.id)}"
                ${row.included ? "checked" : ""} />
            </td>
            <td>
              <button class="btn btn-xs btn-success js-save-plan-module" data-id="${esc(row.id)}">
                Salvar
              </button>
              <button class="btn btn-xs btn-danger js-remove-plan-module" data-id="${esc(row.id)}">
                Remover
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    $("#billingPlanModulesBody").html(rows || '<tr><td colspan="5">Nenhum modulo vinculado ao plano.</td></tr>');
    fillPlanModuleSelect();
  }

  function renderTenantSearchResults(items) {
    const html = items
      .map((tenant) => {
        const companyName = tenant?.company?.company_name || "-";
        return `
          <a href="#" class="list-group-item js-select-tenant" data-id="${esc(tenant.id)}">
            <h4 class="list-group-item-heading">${esc(tenant.name)} (${esc(tenant.slug)})</h4>
            <p class="list-group-item-text">Empresa: ${esc(companyName)}</p>
          </a>
        `;
      })
      .join("");

    $("#billingTenantSearchResults").html(html || '<div class="list-group-item">Nenhum tenant encontrado.</div>');
  }

  function renderTenantOverridesTable() {
    const rows = state.tenantResolvedModules
      .map((row) => {
        const planLabel = row.plan_included ? "Sim" : "Nao";
        const overrideLabel =
          row.override_enabled === null
            ? "Sem override"
            : row.override_enabled
              ? "Habilitado"
              : "Desabilitado";
        const finalLabel = row.final_enabled
          ? '<span class="label label-primary">Habilitado</span>'
          : '<span class="label label-default">Desabilitado</span>';

        return `
          <tr>
            <td>${esc(row.name_pt_br)}</td>
            <td>${esc(row.code)}</td>
            <td>${esc(planLabel)}</td>
            <td>${esc(overrideLabel)}</td>
            <td>${finalLabel}</td>
            <td>${esc(row.source)}</td>
            <td>${esc(row.override_reason || "-")}</td>
            <td>
              <button class="btn btn-xs btn-primary js-edit-override" data-module-id="${esc(row.module_id)}">
                Editar
              </button>
            </td>
          </tr>
        `;
      })
      .join("");

    $("#billingOverridesBody").html(rows || '<tr><td colspan="8">Nenhum modulo para exibir.</td></tr>');
  }

  function fillPlanModuleSelect() {
    const existingIds = new Set(state.selectedPlanModules.map((row) => String(row.module_id)));
    const options = state.modules
      .filter((row) => !existingIds.has(String(row.id)))
      .map((row) => `<option value="${esc(row.id)}">${esc(row.name_pt_br)} (${esc(row.code)})</option>`)
      .join("");

    $("#billingAddPlanModuleSelect").html(options || '<option value="">Sem modulos disponiveis</option>');
  }

  function fillPlanSelectForSubscription() {
    const options = state.plans
      .map((row) => `<option value="${esc(row.id)}">${esc(row.name)} (${esc(row.code)}) - ${esc(formatMoneyBRL(row.monthly_price))}</option>`)
      .join("");
    $("#billingSubscriptionPlanId").html(options || '<option value="">Sem planos</option>');
  }

  function fillSubscriptionForm(subscription) {
    state.tenantSubscription = subscription || null;

    if (!subscription) {
      if (state.plans[0]?.id) $("#billingSubscriptionPlanId").val(String(state.plans[0].id));
      $("#billingSubscriptionStatus").val("ACTIVE");
      $("#billingSubscriptionStartsAt").val("");
      $("#billingSubscriptionEndsAt").val("");
      $("#billingSubscriptionRenewsAt").val("");
      return;
    }

    $("#billingSubscriptionPlanId").val(String(subscription.plan_id || subscription.plan?.id || ""));
    $("#billingSubscriptionStatus").val(String(subscription.status || "ACTIVE"));
    $("#billingSubscriptionStartsAt").val(toLocalDateTimeInputValue(subscription.starts_at));
    $("#billingSubscriptionEndsAt").val(toLocalDateTimeInputValue(subscription.ends_at));
    $("#billingSubscriptionRenewsAt").val(toLocalDateTimeInputValue(subscription.renews_at));
  }

  function getModuleById(moduleId) {
    return state.modules.find((row) => String(row.id) === String(moduleId)) || null;
  }

  function getPlanById(planId) {
    return state.plans.find((row) => String(row.id) === String(planId)) || null;
  }

  async function loadModules() {
    state.modules = normalizeArray(await apiRequest("GET", "/api/admin/billing/modules"));
    renderModulesTable();
    fillPlanModuleSelect();
  }

  async function loadPlans() {
    state.plans = normalizeArray(await apiRequest("GET", "/api/admin/billing/plans"));
    renderPlansList();

    if (!state.selectedPlanId && state.plans[0]?.id) {
      state.selectedPlanId = state.plans[0].id;
    }

    if (state.selectedPlanId) {
      await loadPlanModules(state.selectedPlanId);
    } else {
      renderPlanModulesTable();
    }
  }

  async function loadPlanModules(planId) {
    state.selectedPlanId = planId;
    state.selectedPlanModules = normalizeArray(
      await apiRequest("GET", `/api/admin/billing/plans/${encodeURIComponent(String(planId))}/modules`),
    );

    const plan = getPlanById(planId);
    $("#billingSelectedPlanTitle").text(plan ? `${plan.name} (${plan.code})` : "Plano selecionado");
    renderPlansList();
    renderPlanModulesTable();
  }

  async function searchTenants() {
    const q = String($("#billingTenantSearchInput").val() || "").trim();
    if (!q) {
      showToast("warning", "Digite algo para buscar tenants.");
      return;
    }

    const list = normalizeArray(
      await apiRequest("GET", `/api/admin/tenants/search?q=${encodeURIComponent(q)}`),
    );
    renderTenantSearchResults(list);
  }

  async function selectTenant(tenantId) {
    const q = String($("#billingTenantSearchInput").val() || "").trim();
    const list = normalizeArray(
      await apiRequest("GET", `/api/admin/tenants/search?q=${encodeURIComponent(q || tenantId)}`),
    );
    state.selectedTenant = list.find((row) => String(row.id) === String(tenantId)) || { id: tenantId };

    const label = state.selectedTenant?.name
      ? `${state.selectedTenant.name} (${state.selectedTenant.slug || "-"})`
      : `Tenant ${tenantId}`;
    $("#billingSelectedTenantLabel").text(label);

    await Promise.all([loadTenantSubscription(), loadTenantOverrides()]);
  }

  async function loadTenantSubscription() {
    if (!state.selectedTenant?.id) {
      fillSubscriptionForm(null);
      return;
    }

    const subscription = await apiRequest(
      "GET",
      `/api/admin/billing/tenants/${encodeURIComponent(String(state.selectedTenant.id))}/subscription`,
    );
    fillSubscriptionForm(subscription && subscription.id ? subscription : null);
  }

  async function loadTenantOverrides() {
    if (!state.selectedTenant?.id) {
      state.tenantResolvedModules = [];
      renderTenantOverridesTable();
      return;
    }

    const data = await apiRequest(
      "GET",
      `/api/admin/billing/tenants/${encodeURIComponent(String(state.selectedTenant.id))}/overrides`,
    );
    state.tenantResolvedModules = normalizeArray(data?.modules);
    renderTenantOverridesTable();
  }

  function openModuleModal(module) {
    const isEdit = !!module?.id;
    $("#billingModuleModalTitle").text(isEdit ? "Editar modulo" : "Novo modulo");
    $("#billingModuleId").val(isEdit ? module.id : "");
    $("#billingModuleCode").val(isEdit ? module.code : "");
    $("#billingModuleName").val(isEdit ? module.name_pt_br : "");
    $("#billingModuleDescription").val(isEdit ? module.description_pt_br || "" : "");
    $("#billingModulePrice").val(isEdit ? toMoneyNumber(module.monthly_price) : 0);
    $("#billingModuleActive").prop("checked", isEdit ? !!module.is_active : true);
    $("#billingModuleModal").modal("show");
  }

  function openPlanModal(plan) {
    const isEdit = !!plan?.id;
    $("#billingPlanModalTitle").text(isEdit ? "Editar plano" : "Novo plano");
    $("#billingPlanId").val(isEdit ? plan.id : "");
    $("#billingPlanCode").val(isEdit ? plan.code : "");
    $("#billingPlanName").val(isEdit ? plan.name : "");
    $("#billingPlanDescription").val(isEdit ? plan.description || "" : "");
    $("#billingPlanPrice").val(isEdit ? toMoneyNumber(plan.monthly_price) : 0);
    $("#billingPlanActive").prop("checked", isEdit ? !!plan.is_active : true);
    $("#billingPlanModal").modal("show");
  }

  function openOverrideModal(moduleId) {
    const row = state.tenantResolvedModules.find((item) => String(item.module_id) === String(moduleId));
    if (!row) return;

    const defaultEnabled =
      row.override_enabled === null || row.override_enabled === undefined
        ? !!row.plan_included
        : !!row.override_enabled;

    $("#billingOverrideModuleId").val(String(row.module_id));
    $("#billingOverrideModuleLabel").html(
      `<strong>${esc(row.name_pt_br)}</strong> (${esc(row.code)})`,
    );
    $("#billingOverrideEnabled").val(defaultEnabled ? "true" : "false");
    $("#billingOverrideReason").val(row.override_reason || "");
    $("#billingOverrideModal").modal("show");
  }

  async function saveModuleFromModal() {
    const id = String($("#billingModuleId").val() || "").trim();
    const payload = {
      code: String($("#billingModuleCode").val() || "").trim(),
      name_pt_br: String($("#billingModuleName").val() || "").trim(),
      description_pt_br: String($("#billingModuleDescription").val() || "").trim() || null,
      is_active: $("#billingModuleActive").is(":checked"),
      monthly_price: toMoneyNumber($("#billingModulePrice").val()),
    };

    if (!payload.code || !payload.name_pt_br) {
      showToast("warning", "Preencha codigo e nome do modulo.");
      return;
    }

    if (id) {
      await apiRequest("PUT", `/api/admin/billing/modules/${encodeURIComponent(id)}`, payload);
      showToast("success", "Modulo atualizado.");
    } else {
      await apiRequest("POST", "/api/admin/billing/modules", payload);
      showToast("success", "Modulo criado.");
    }

    $("#billingModuleModal").modal("hide");
    await Promise.all([loadModules(), loadPlans()]);
    if (state.selectedTenant?.id) await loadTenantOverrides();
  }

  async function savePlanFromModal() {
    const id = String($("#billingPlanId").val() || "").trim();
    const payload = {
      code: String($("#billingPlanCode").val() || "").trim(),
      name: String($("#billingPlanName").val() || "").trim(),
      description: String($("#billingPlanDescription").val() || "").trim() || null,
      is_active: $("#billingPlanActive").is(":checked"),
      monthly_price: toMoneyNumber($("#billingPlanPrice").val()),
    };

    if (!payload.code || !payload.name) {
      showToast("warning", "Preencha codigo e nome do plano.");
      return;
    }

    if (id) {
      await apiRequest("PUT", `/api/admin/billing/plans/${encodeURIComponent(id)}`, payload);
      showToast("success", "Plano atualizado.");
    } else {
      await apiRequest("POST", "/api/admin/billing/plans", payload);
      showToast("success", "Plano criado.");
    }

    $("#billingPlanModal").modal("hide");
    await loadPlans();
    if (state.selectedTenant?.id) await loadTenantSubscription();
  }

  async function saveTenantSubscription() {
    if (!state.selectedTenant?.id) {
      showToast("warning", "Selecione um tenant antes de salvar a assinatura.");
      return;
    }

    const planId = String($("#billingSubscriptionPlanId").val() || "").trim();
    if (!planId) {
      showToast("warning", "Selecione um plano.");
      return;
    }

    const payload = {
      plan_id: planId,
      status: String($("#billingSubscriptionStatus").val() || "ACTIVE"),
      starts_at: fromLocalDateTimeInputValue($("#billingSubscriptionStartsAt").val()),
      ends_at: fromLocalDateTimeInputValue($("#billingSubscriptionEndsAt").val()),
      renews_at: fromLocalDateTimeInputValue($("#billingSubscriptionRenewsAt").val()),
    };

    await apiRequest(
      "PUT",
      `/api/admin/billing/tenants/${encodeURIComponent(String(state.selectedTenant.id))}/subscription`,
      payload,
    );
    showToast("success", "Assinatura atualizada.");

    await Promise.all([loadTenantSubscription(), loadTenantOverrides()]);
  }

  async function saveTenantOverrideFromModal() {
    if (!state.selectedTenant?.id) {
      showToast("warning", "Selecione um tenant antes de salvar override.");
      return;
    }

    const moduleId = String($("#billingOverrideModuleId").val() || "").trim();
    if (!moduleId) return;

    const payload = {
      enabled: isTruthy($("#billingOverrideEnabled").val()),
      reason: String($("#billingOverrideReason").val() || "").trim() || null,
    };

    await apiRequest(
      "PUT",
      `/api/admin/billing/tenants/${encodeURIComponent(String(state.selectedTenant.id))}/overrides/${encodeURIComponent(moduleId)}`,
      payload,
    );
    $("#billingOverrideModal").modal("hide");
    showToast("success", "Override salvo.");

    await loadTenantOverrides();
  }

  async function addModuleToSelectedPlan() {
    if (!state.selectedPlanId) {
      showToast("warning", "Selecione um plano.");
      return;
    }

    const moduleId = String($("#billingAddPlanModuleSelect").val() || "").trim();
    if (!moduleId) {
      showToast("warning", "Selecione um modulo para adicionar.");
      return;
    }

    const payload = {
      module_id: moduleId,
      sort_order: Number($("#billingAddPlanModuleSortOrder").val() || 0),
      included: $("#billingAddPlanModuleIncluded").is(":checked"),
    };

    await apiRequest(
      "POST",
      `/api/admin/billing/plans/${encodeURIComponent(String(state.selectedPlanId))}/modules`,
      payload,
    );
    showToast("success", "Modulo vinculado ao plano.");

    await Promise.all([loadPlanModules(state.selectedPlanId), loadPlans()]);
    if (state.selectedTenant?.id) await loadTenantOverrides();
  }

  async function toggleModuleActive(moduleId) {
    const row = getModuleById(moduleId);
    if (!row) return;

    await apiRequest("PUT", `/api/admin/billing/modules/${encodeURIComponent(String(moduleId))}`, {
      is_active: !row.is_active,
    });
    showToast("success", "Status do modulo atualizado.");

    await Promise.all([loadModules(), loadPlans()]);
    if (state.selectedTenant?.id) await loadTenantOverrides();
  }

  async function savePlanModuleLine(planModuleId) {
    const sortOrder = Number(
      $(`.js-plan-module-sort-order[data-id="${planModuleId}"]`).val() || 0,
    );
    const included = $(`.js-plan-module-included[data-id="${planModuleId}"]`).is(":checked");

    await apiRequest(
      "PUT",
      `/api/admin/billing/plan-modules/${encodeURIComponent(String(planModuleId))}`,
      { sort_order: sortOrder, included },
    );
    showToast("success", "Vinculo atualizado.");

    if (state.selectedPlanId) await loadPlanModules(state.selectedPlanId);
    if (state.selectedTenant?.id) await loadTenantOverrides();
  }

  async function removePlanModuleLine(planModuleId) {
    const confirmed = await Promise.resolve(confirm("Deseja remover este modulo do plano?"));
    if (!confirmed) return;

    await apiRequest(
      "DELETE",
      `/api/admin/billing/plan-modules/${encodeURIComponent(String(planModuleId))}`,
    );
    showToast("success", "Vinculo removido.");

    if (state.selectedPlanId) await loadPlanModules(state.selectedPlanId);
    await loadPlans();
    if (state.selectedTenant?.id) await loadTenantOverrides();
  }

  function bindEvents() {
    $("#btnRecarregarModulos").on("click", async () => {
      try {
        await loadModules();
      } catch (error) {
        showToast("error", error.message || "Falha ao atualizar modulos.");
      }
    });

    $("#btnNovoModulo").on("click", () => openModuleModal(null));
    $("#btnSalvarModulo").on("click", async () => {
      try {
        await saveModuleFromModal();
      } catch (error) {
        showToast("error", error.message || "Falha ao salvar modulo.");
      }
    });

    $(document).on("click", ".js-edit-module", function () {
      const moduleId = String($(this).data("id") || "");
      openModuleModal(getModuleById(moduleId));
    });

    $(document).on("click", ".js-toggle-module", async function () {
      const moduleId = String($(this).data("id") || "");
      try {
        await toggleModuleActive(moduleId);
      } catch (error) {
        showToast("error", error.message || "Falha ao atualizar modulo.");
      }
    });

    $("#btnRecarregarPlanos").on("click", async () => {
      try {
        await loadPlans();
      } catch (error) {
        showToast("error", error.message || "Falha ao atualizar planos.");
      }
    });

    $("#btnNovoPlano").on("click", () => openPlanModal(null));
    $("#btnSalvarPlano").on("click", async () => {
      try {
        await savePlanFromModal();
      } catch (error) {
        showToast("error", error.message || "Falha ao salvar plano.");
      }
    });

    $(document).on("click", ".js-edit-plan", function (event) {
      event.preventDefault();
      const planId = String($(this).data("id") || "");
      openPlanModal(getPlanById(planId));
    });

    $(document).on("click", ".js-select-plan", async function (event) {
      event.preventDefault();
      const planId = String($(this).data("id") || "");
      try {
        await loadPlanModules(planId);
      } catch (error) {
        showToast("error", error.message || "Falha ao carregar modulos do plano.");
      }
    });

    $("#btnAdicionarModuloPlano").on("click", async () => {
      try {
        await addModuleToSelectedPlan();
      } catch (error) {
        showToast("error", error.message || "Falha ao vincular modulo ao plano.");
      }
    });

    $(document).on("click", ".js-save-plan-module", async function () {
      const id = String($(this).data("id") || "");
      try {
        await savePlanModuleLine(id);
      } catch (error) {
        showToast("error", error.message || "Falha ao atualizar vinculo.");
      }
    });

    $(document).on("click", ".js-remove-plan-module", async function () {
      const id = String($(this).data("id") || "");
      try {
        await removePlanModuleLine(id);
      } catch (error) {
        showToast("error", error.message || "Falha ao remover vinculo.");
      }
    });

    $("#btnBuscarTenant").on("click", async () => {
      try {
        await searchTenants();
      } catch (error) {
        showToast("error", error.message || "Falha na busca de tenants.");
      }
    });

    $("#billingTenantSearchInput").on("keydown", async function (event) {
      if (event.key !== "Enter") return;
      event.preventDefault();
      try {
        await searchTenants();
      } catch (error) {
        showToast("error", error.message || "Falha na busca de tenants.");
      }
    });

    $(document).on("click", ".js-select-tenant", async function (event) {
      event.preventDefault();
      const tenantId = String($(this).data("id") || "");
      try {
        await selectTenant(tenantId);
      } catch (error) {
        showToast("error", error.message || "Falha ao selecionar tenant.");
      }
    });

    $("#btnSalvarAssinaturaTenant").on("click", async () => {
      try {
        await saveTenantSubscription();
      } catch (error) {
        showToast("error", error.message || "Falha ao salvar assinatura.");
      }
    });

    $(document).on("click", ".js-edit-override", function () {
      const moduleId = String($(this).data("module-id") || "");
      openOverrideModal(moduleId);
    });

    $("#btnSalvarOverride").on("click", async () => {
      try {
        await saveTenantOverrideFromModal();
      } catch (error) {
        showToast("error", error.message || "Falha ao salvar override.");
      }
    });
  }

  async function bootstrap() {
    try {
      if (window.toastr) {
        window.toastr.options = {
          closeButton: true,
          progressBar: true,
          positionClass: "toast-top-right",
          timeOut: 3500,
        };
      }

      $("#pageName").text("Billing");
      $("#subpageName").text("Planos e Modulos").attr("href", "/admin/billing");

      bindEvents();
      await Promise.all([loadModules(), loadPlans()]);
    } catch (error) {
      showToast("error", error.message || "Falha ao inicializar pagina de billing.");
    }
  }

  $(document).ready(bootstrap);
})();
