(function () {
  const CUSTOM_PLAN_ID = "__CUSTOM__";

  const state = {
    selectedPlanId: null,
    selectedPlanName: null,
    selectedPlanPrice: 0,
    selectedPlanType: null,
    isSubmitting: false,
    plansLoaded: false,
    plans: [],
    modules: [],
    customModuleIds: []
  };

  const loaderMessages = [
    "Estamos preparando seu ambiente...",
    "Criando configuracoes de seguranca...",
    "Configurando empresa e usuario administrador...",
    "Finalizando seu acesso inicial..."
  ];

  let loaderTimer = null;
  let loaderMessageIndex = 0;

  function getEl(id) {
    return document.getElementById(id);
  }

  function getValue(id) {
    const el = getEl(id);
    return el ? el.value : "";
  }

  function isChecked(id) {
    const el = getEl(id);
    return !!(el && el.checked);
  }

  function safeClosest(target, selector) {
    if (!target) return null;
    if (typeof target.closest === "function") return target.closest(selector);
    if (target.parentElement && typeof target.parentElement.closest === "function") {
      return target.parentElement.closest(selector);
    }
    return null;
  }

  function normalizeArray(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.data)) return data.data;
    if (data && Array.isArray(data.rows)) return data.rows;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function normalizeString(value) {
    return String(value || "").trim();
  }

  function normalizeMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) return 0;
    return amount;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatMoney(value) {
    return normalizeMoney(value).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL"
    });
  }

  function showMessage(title, text, type) {
    if (typeof window.swal === "function") {
      window.swal(title, text, type);
      return;
    }
    window.alert(`${title}: ${text}`);
  }

  function slugifyCompanyName(name) {
    const normalized = normalizeString(name)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 45);

    if (normalized) return normalized;
    return `tenant-${Date.now()}`;
  }

  function toPublicPlan(raw) {
    const source = raw || {};
    const modules = normalizeArray(source.modules).map((item) => {
      const moduleRow = item || {};
      return {
        id: normalizeString(moduleRow.id),
        code: normalizeString(moduleRow.code),
        name_pt_br: normalizeString(moduleRow.name_pt_br),
        description_pt_br: normalizeString(moduleRow.description_pt_br),
        monthly_price: normalizeMoney(moduleRow.monthly_price),
        sort_order: Number(moduleRow.sort_order || 0)
      };
    });

    return {
      id: normalizeString(source.id),
      code: normalizeString(source.code),
      name: normalizeString(source.name),
      description: normalizeString(source.description),
      monthly_price: normalizeMoney(source.monthly_price),
      modules
    };
  }

  function toPublicModule(raw) {
    const source = raw || {};
    return {
      id: normalizeString(source.id),
      code: normalizeString(source.code),
      name_pt_br: normalizeString(source.name_pt_br),
      description_pt_br: normalizeString(source.description_pt_br),
      monthly_price: normalizeMoney(source.monthly_price)
    };
  }

  function showLandingStage() {
    const hero = getEl("heroSection");
    const features = getEl("featuresPublic");
    const plans = getEl("plansStage");
    if (hero) hero.classList.remove("section-hidden");
    if (features) features.classList.remove("section-hidden");
    if (plans) plans.classList.remove("is-active");
  }

  function showPlansStage() {
    const hero = getEl("heroSection");
    const features = getEl("featuresPublic");
    const plans = getEl("plansStage");
    if (hero) hero.classList.add("section-hidden");
    if (features) features.classList.add("section-hidden");
    if (plans) plans.classList.add("is-active");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function showPlanChooser() {
    const listWrap = getEl("plansListWrap");
    const formWrap = getEl("registerFormWrap");
    if (listWrap) listWrap.classList.remove("is-hidden");
    if (formWrap) formWrap.classList.remove("is-active");
  }

  async function readJsonSafe(response) {
    const text = await response.text().catch(() => "");
    if (!text) return {};

    try {
      return JSON.parse(text);
    } catch (_error) {
      return { message: text };
    }
  }

  async function postJson(url, payload) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      credentials: "include",
      body: JSON.stringify(payload || {})
    });

    const data = await readJsonSafe(response);
    if (!response.ok) {
      const message = data && data.message ? data.message : `Falha na chamada ${url}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  async function getJson(url) {
    const response = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include"
    });

    const data = await readJsonSafe(response);
    if (!response.ok) {
      const message = data && data.message ? data.message : `Falha na chamada ${url}`;
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  }

  function renderCustomModulesChecklist() {
    const container = document.getElementById("customModulesChecklist");
    if (!container) return;

    const modules = state.modules.slice().sort((a, b) => {
      if (a.monthly_price !== b.monthly_price) return a.monthly_price - b.monthly_price;
      return a.name_pt_br.localeCompare(b.name_pt_br, "pt-BR");
    });

    if (modules.length === 0) {
      container.innerHTML = '<div class="col-sm-12"><span class="text-muted">Nenhum modulo publico disponivel.</span></div>';
      document.getElementById("customPlanTotal").textContent = formatMoney(0);
      return;
    }

    container.innerHTML = modules
      .map((module) => {
        const checked = state.customModuleIds.includes(module.id) ? "checked" : "";
        return `
          <div class="col-sm-6">
            <div class="custom-module-option">
              <label>
                <input type="checkbox" class="custom-module-checkbox" value="${esc(module.id)}" ${checked} />
                <strong>${esc(module.name_pt_br || module.code)}</strong><br />
                <span class="text-muted">${esc(module.description_pt_br || "")}</span><br />
                <span class="custom-module-price">${esc(formatMoney(module.monthly_price))}/mes</span>
              </label>
            </div>
          </div>
        `;
      })
      .join("");

    updateCustomPlanTotal();
  }

  function getCustomPlanTotal() {
    return state.customModuleIds.reduce((total, moduleId) => {
      const module = state.modules.find((row) => row.id === moduleId);
      return total + normalizeMoney(module ? module.monthly_price : 0);
    }, 0);
  }

  function updateCustomPlanTotal() {
    const total = getCustomPlanTotal();
    const totalEl = document.getElementById("customPlanTotal");
    if (totalEl) totalEl.textContent = formatMoney(total);

    if (state.selectedPlanType === "custom") {
      state.selectedPlanPrice = total;
      const chip = document.getElementById("selectedPlanChip");
      if (chip) chip.textContent = `${state.selectedPlanName} - ${formatMoney(total)}/mes`;
    }
  }

  function toggleCustomBuilder(show) {
    const builder = getEl("customPlanBuilder");
    if (builder) builder.classList.toggle("section-hidden", !show);
  }

  function renderPlansGrid() {
    const container = document.getElementById("dynamicPlansContainer");
    if (!container) return;

    const cards = state.plans.map((plan) => {
      const features = normalizeArray(plan.modules)
        .slice()
        .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
        .map((module) => `<li>${esc(module.name_pt_br || module.code)}</li>`)
        .join("");

      return `
        <div class="col-lg-4 col-md-6">
          <div class="plan-card" data-plan-id="${esc(plan.id)}" data-plan-name="${esc(plan.name)}" data-plan-type="standard">
            <h3 class="plan-name">${esc(plan.name)}</h3>
            <div class="plan-price">${esc(formatMoney(plan.monthly_price))} <small>/mes</small></div>
            <p class="text-muted">${esc(plan.description || "Plano pronto para iniciar seu ambiente.")}</p>
            <ul class="plan-list">${features || "<li>Sem modulos listados.</li>"}</ul>
            <button class="btn btn-primary btn-plan plan-select-btn" data-plan-id="${esc(plan.id)}">
              Selecionar plano
            </button>
          </div>
        </div>
      `;
    });

    cards.push(`
      <div class="col-lg-4 col-md-6">
        <div class="plan-card" data-plan-id="${CUSTOM_PLAN_ID}" data-plan-name="Plano custom" data-plan-type="custom">
          <h3 class="plan-name">Crie seu plano</h3>
          <div class="plan-price">Voce escolhe <small>modulo a modulo</small></div>
          <p class="text-muted">Monte um plano sob medida escolhendo os modulos que precisa e veja o total mensal.</p>
          <ul class="plan-list">
            <li>Escolha os modulos desejados</li>
            <li>Total mensal calculado automaticamente</li>
            <li>Plano exclusivo associado ao seu tenant</li>
          </ul>
          <button class="btn btn-primary btn-plan plan-select-btn" data-plan-id="${CUSTOM_PLAN_ID}">
            Montar plano custom
          </button>
        </div>
      </div>
    `);

    const emptyWarning = state.plans.length === 0
      ? '<div class="col-lg-12"><div class="alert alert-warning">Nao ha planos prontos publicados. Voce ainda pode montar um plano custom.</div></div>'
      : "";

    container.innerHTML = `<div class="row">${emptyWarning}${cards.join("")}</div>`;
  }

  function renderPlansLoading() {
    const container = document.getElementById("dynamicPlansContainer");
    if (!container) return;
    container.innerHTML = `
      <div class="row">
        <div class="col-lg-12">
          <div class="alert alert-info">Carregando planos disponiveis...</div>
        </div>
      </div>
    `;
  }

  async function loadPublicCatalog(forceReload) {
    if (state.plansLoaded && !forceReload) return;

    const [plansResponse, modulesResponse] = await Promise.all([
      getJson("/api/public/billing/plans"),
      getJson("/api/public/billing/modules")
    ]);

    state.plans = normalizeArray(plansResponse).map(toPublicPlan).filter((plan) => plan.id);
    state.modules = normalizeArray(modulesResponse).map(toPublicModule).filter((module) => module.id);
    state.customModuleIds = state.customModuleIds.filter((id) => state.modules.some((row) => row.id === id));
    state.plansLoaded = true;

    renderPlansGrid();
    renderCustomModulesChecklist();
  }

  function openRegisterForSelection(planCard) {
    document.querySelectorAll(".plan-card").forEach((card) => card.classList.remove("selected"));
    planCard.classList.add("selected");

    const planId = normalizeString(planCard.getAttribute("data-plan-id"));
    const planName = normalizeString(planCard.getAttribute("data-plan-name"));
    const planType = normalizeString(planCard.getAttribute("data-plan-type")) || "standard";

    state.selectedPlanId = planId;
    state.selectedPlanName = planName;
    state.selectedPlanType = planType === "custom" ? "custom" : "standard";

    if (state.selectedPlanType === "custom") {
      state.selectedPlanPrice = getCustomPlanTotal();
    } else {
      const plan = state.plans.find((row) => row.id === planId);
      state.selectedPlanPrice = normalizeMoney(plan ? plan.monthly_price : 0);
    }

    const chip = document.getElementById("selectedPlanChip");
    if (chip) {
      chip.textContent = `${state.selectedPlanName} - ${formatMoney(state.selectedPlanPrice)}/mes`;
    }

    const categoryInput = document.getElementById("companyCategoryInput");
    if (categoryInput) {
      categoryInput.value = state.selectedPlanType === "custom" ? "Plano custom" : state.selectedPlanName;
    }

    toggleCustomBuilder(state.selectedPlanType === "custom");
    updateCustomPlanTotal();

    const listWrap = getEl("plansListWrap");
    const formWrap = getEl("registerFormWrap");
    if (listWrap) listWrap.classList.add("is-hidden");
    if (formWrap) {
      formWrap.classList.add("is-active");
      formWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  async function syncCurrentUserFromMe() {
    const meResp = await fetch("/api/auth/me", {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include"
    });

    const me = await readJsonSafe(meResp);
    if (!meResp.ok || !me || !me.id) return;

    localStorage.setItem("currentUser", JSON.stringify(me));
    localStorage.setItem("currentUserId", String(me.id));
    if (me.company_id != null) {
      localStorage.setItem("companyId", String(me.company_id));
    }
  }

  function setSubmitState(isLoading) {
    state.isSubmitting = isLoading;
    const btn = document.getElementById("confirmBtn");
    if (!btn) return;

    btn.disabled = isLoading;
    btn.innerHTML = isLoading
      ? '<i class="fa fa-spinner fa-spin"></i> Processando...'
      : '<i class="fa fa-check"></i> Confirmar cadastro';

    if (isLoading) {
      showLoader();
    } else {
      hideLoader();
    }
  }

  function showLoader() {
    const overlay = document.getElementById("publicRegisterSpinner");
    const textEl = document.getElementById("publicRegisterSpinnerText");
    if (!overlay || !textEl) return;

    loaderMessageIndex = 0;
    textEl.textContent = loaderMessages[loaderMessageIndex];
    overlay.classList.add("is-visible");
    overlay.setAttribute("aria-hidden", "false");

    if (loaderTimer) clearInterval(loaderTimer);
    loaderTimer = setInterval(function () {
      loaderMessageIndex = (loaderMessageIndex + 1) % loaderMessages.length;
      textEl.textContent = loaderMessages[loaderMessageIndex];
    }, 1900);
  }

  function hideLoader() {
    const overlay = document.getElementById("publicRegisterSpinner");
    if (!overlay) return;

    overlay.classList.remove("is-visible");
    overlay.setAttribute("aria-hidden", "true");

    if (loaderTimer) {
      clearInterval(loaderTimer);
      loaderTimer = null;
    }
  }

  function validateFormPayload() {
    const companyName = normalizeString(getValue("companyNameInput"));
    const userName = normalizeString(getValue("userNameInput"));
    const email = normalizeString(getValue("emailInput"));
    const phone = normalizeString(getValue("phoneInput"));
    const password = normalizeString(getValue("passwordInput"));
    const companyNumber = normalizeString(getValue("companyNumberInput"));
    const companySector = normalizeString(getValue("companySectorInput"));
    const companyCategory = normalizeString(getValue("companyCategoryInput"));
    const street = normalizeString(getValue("addressStreetInput"));
    const number = normalizeString(getValue("addressNumberInput"));
    const city = normalizeString(getValue("addressCityInput"));
    const stateUf = normalizeString(getValue("addressStateInput"));
    const postalCode = normalizeString(getValue("addressPostalCodeInput"));
    const country = normalizeString(getValue("addressCountryInput"));
    const language = normalizeString(getValue("companyLanguageInput")) || "pt-BR";
    const acceptTerms = isChecked("acceptTermsInput");

    if (!state.selectedPlanId || !state.selectedPlanType) throw new Error("Selecione um plano antes de confirmar.");
    if (!companyName) throw new Error("Nome da empresa e obrigatorio.");
    if (!userName) throw new Error("Nome do utilizador e obrigatorio.");
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail valido.");
    if (!phone) throw new Error("Telefone e obrigatorio.");
    if (!password || password.length < 8) throw new Error("A senha do admin deve ter no minimo 8 caracteres.");
    if (!companyNumber) throw new Error("CNPJ / Company Number e obrigatorio.");
    if (!companySector) throw new Error("Setor e obrigatorio.");
    if (!companyCategory) throw new Error("Categoria e obrigatoria.");
    if (!street || !number || !city || !stateUf || !postalCode || !country) throw new Error("Preencha todos os dados de endereco.");
    if (!acceptTerms) throw new Error("Voce precisa aceitar os termos para continuar.");
    if (state.selectedPlanType === "custom" && state.customModuleIds.length === 0) {
      throw new Error("Selecione ao menos um modulo para o plano custom.");
    }

    const payload = {
      tenant_name: companyName,
      tenant_slug: slugifyCompanyName(companyName),
      company_name: companyName,
      company_phone: phone,
      company_number: companyNumber,
      company_sector: companySector,
      company_category: companyCategory,
      company_address_street: street,
      company_address_number: number,
      company_address_city: city,
      company_address_country: country,
      company_address_state: stateUf,
      company_address_postalcode: postalCode,
      company_language: language,
      admin_full_name: userName,
      admin_email: email,
      admin_password: password,
      admin_phone: phone,
      acept_terms: acceptTerms
    };

    if (state.selectedPlanType === "custom") {
      payload.custom_module_ids = state.customModuleIds.slice();
    } else {
      payload.selected_plan_id = state.selectedPlanId;
    }

    return payload;
  }

  async function onSubmitForm(event) {
    event.preventDefault();
    if (state.isSubmitting) return;

    try {
      const signupPayload = validateFormPayload();
      setSubmitState(true);

      await postJson("/auth/signup", signupPayload);
      await syncCurrentUserFromMe();

      swal({
        title: "Cadastro concluido!",
        text: "Seu ambiente foi criado e sua sessao ja esta autenticada.",
        type: "success"
      }, function () {
        window.location.href = "/Default";
      });
    } catch (error) {
      console.error("[PublicRegister] submit error:", error);
      const msg = error && error.message ? error.message : "Nao foi possivel concluir o cadastro.";
      showMessage("Falha no cadastro", msg, "error");
    } finally {
      setSubmitState(false);
    }
  }

  async function openPlansFromHero() {
    showPlansStage();
    renderPlansLoading();
    try {
      await loadPublicCatalog(false);
    } catch (error) {
      console.error("[PublicRegister] failed to load catalog:", error);
      const message = error && error.message ? error.message : "Nao foi possivel carregar os planos.";
      showMessage("Falha ao carregar planos", message, "error");
    }
  }

  function installEvents() {
    const heroButton = getEl("btnExperimentHero");
    if (heroButton) heroButton.addEventListener("click", openPlansFromHero);

    document.addEventListener("click", function (event) {
      const btn = safeClosest(event.target, ".plan-select-btn");
      if (!btn) return;

      const card = btn.closest(".plan-card");
      if (!card) return;

      openRegisterForSelection(card);
    });

    const customChecklist = getEl("customModulesChecklist");
    if (customChecklist) customChecklist.addEventListener("change", function (event) {
      const checkbox = safeClosest(event.target, ".custom-module-checkbox");
      if (!checkbox) return;

      const moduleId = normalizeString(checkbox.value);
      if (!moduleId) return;

      if (checkbox.checked) {
        if (!state.customModuleIds.includes(moduleId)) {
          state.customModuleIds.push(moduleId);
        }
      } else {
        state.customModuleIds = state.customModuleIds.filter((id) => id !== moduleId);
      }

      updateCustomPlanTotal();
    });

    const backButton = getEl("btnBackPlans");
    if (backButton) backButton.addEventListener("click", function () {
      showPlanChooser();
      const plansStage = getEl("plansStage");
      if (plansStage) plansStage.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    const form = getEl("publicRegisterForm");
    if (form) form.addEventListener("submit", onSubmitForm);
  }

  async function bootstrap() {
    window.__openRegisterPlans = openPlansFromHero;
    installEvents();

    if (window.WOW) {
      try {
        new window.WOW().init();
      } catch (error) {
        console.error("[PublicRegister] WOW init error:", error);
      }
    }

    try {
      await loadPublicCatalog(false);
    } catch (error) {
      console.error("[PublicRegister] preload catalog error:", error);
    }

    showLandingStage();
  }

  if (window.jQuery && typeof window.jQuery === "function") {
    window.jQuery(bootstrap);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
