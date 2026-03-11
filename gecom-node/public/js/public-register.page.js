(function () {
  window.__publicRegisterMainScriptLoaded = true;
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
    customModuleIds: [],
    lastCnpjFetched: null,
    cnpjLookupInFlight: false,
    lastPostalLookup: null,
    postalLookupInFlight: false,
    googleApiLoading: null,
    googleGeocoder: null,
    googleAddressAutocompleteReady: false,
    stripeJsLoading: null,
    stripe: null,
    stripeElements: null,
    stripeCardElement: null,
    paymentSessionId: null,
    paymentClientSecret: null,
    paymentPublishableKey: null,
    paymentRequiresCard: true,
    paymentCouponCode: "",
    cachedSignupPayload: null,
    isFinalizingPayment: false
  };

  const loaderMessages = [
    "Estamos preparando seu ambiente...",
    "Criando configurações de segurança...",
    "Configurando empresa e usuário administrador...",
    "Finalizando seu acesso inicial..."
  ];

  let loaderTimer = null;
  let loaderMessageIndex = 0;

  // Ensure hero CTA always has an action, even if bootstrap fails later.
  window.__openRegisterPlans = function () {
    return openPlansFromHero();
  };

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

  function onlyDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function getPaymentCouponCode() {
    return normalizeString(getValue("paymentCouponInput")).toUpperCase();
  }

  function getPersonType() {
    const checked = document.querySelector('input[name="personTypeInput"]:checked');
    return String(checked && checked.value ? checked.value : "PJ").toUpperCase() === "PF" ? "PF" : "PJ";
  }

  function isLegalEntity() {
    return getPersonType() === "PJ";
  }

  function formatCnpj(value) {
    const digits = onlyDigits(value).slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  function formatCpf(value) {
    const digits = onlyDigits(value).slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  function formatCep(value) {
    const digits = onlyDigits(value).slice(0, 8);
    return digits.replace(/^(\d{5})(\d)/, "$1-$2");
  }

  function getGoogleMapsKey() {
    const direct = normalizeString(window.__PUBLIC_REGISTER_GOOGLE_KEY);
    if (direct) return direct;
    const meta = document.querySelector('meta[name="google-maps-key"]');
    return normalizeString(meta && meta.content ? meta.content : "");
  }

  function loadGoogleMapsApi() {
    if (window.google && window.google.maps) return Promise.resolve(true);
    if (state.googleApiLoading) return state.googleApiLoading;

    const key = getGoogleMapsKey();
    if (!key) return Promise.resolve(false);

    state.googleApiLoading = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = function () {
        resolve(!!(window.google && window.google.maps));
      };
      script.onerror = function () {
        resolve(false);
      };
      document.head.appendChild(script);
    }).then((loaded) => {
      if (!loaded) state.googleApiLoading = null;
      return loaded;
    });

    return state.googleApiLoading;
  }

  async function ensureGoogleGeocoder() {
    const loaded = await loadGoogleMapsApi();
    if (!loaded || !window.google || !window.google.maps || !window.google.maps.Geocoder) return null;

    if (!state.googleGeocoder) {
      state.googleGeocoder = new window.google.maps.Geocoder();
    }
    return state.googleGeocoder;
  }

  function readGoogleAddressComponent(components, type, useShortName) {
    const list = Array.isArray(components) ? components : [];
    const component = list.find((entry) => Array.isArray(entry.types) && entry.types.includes(type));
    if (!component) return "";
    if (useShortName) return normalizeString(component.short_name);
    return normalizeString(component.long_name);
  }

  function extractAddressFromGooglePlace(place) {
    const components = Array.isArray(place && place.address_components) ? place.address_components : [];
    const city =
      readGoogleAddressComponent(components, "locality", false) ||
      readGoogleAddressComponent(components, "administrative_area_level_2", false) ||
      readGoogleAddressComponent(components, "sublocality_level_1", false);

    return {
      street: readGoogleAddressComponent(components, "route", false),
      number: readGoogleAddressComponent(components, "street_number", false),
      city,
      stateUf: readGoogleAddressComponent(components, "administrative_area_level_1", true),
      postalCode: formatCep(readGoogleAddressComponent(components, "postal_code", false)),
      country: readGoogleAddressComponent(components, "country", false) || "Brasil"
    };
  }

  function applyAddressDataIfEmpty(addressData) {
    if (!addressData) return;
    if (addressData.street) setIfEmpty("addressStreetInput", addressData.street);
    if (addressData.number) setIfEmpty("addressNumberInput", addressData.number);
    if (addressData.city) setIfEmpty("addressCityInput", addressData.city);
    if (addressData.stateUf) setIfEmpty("addressStateInput", addressData.stateUf);
    if (addressData.postalCode) setIfEmpty("addressPostalCodeInput", addressData.postalCode);
    if (addressData.country) setIfEmpty("addressCountryInput", addressData.country);
  }

  async function geocodePostalCode(postalDigits) {
    const response = await fetch(
      `/api/public/google/geocode/postal?postalCode=${encodeURIComponent(postalDigits)}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        credentials: "include"
      }
    );

    const data = await readJsonSafe(response);
    if (!response.ok) {
      const message = data && data.message ? data.message : "CEP nao encontrado no Google.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data || {};
  }

  async function tryAutoFillFromPostalCode(showAlertOnFail) {
    const postalInput = getEl("addressPostalCodeInput");
    if (!postalInput) return;

    const postalDigits = onlyDigits(postalInput.value);
    if (postalDigits.length !== 8) return;
    if (state.postalLookupInFlight) return;
    if (state.lastPostalLookup === postalDigits) return;

    state.postalLookupInFlight = true;
    try {
      const addressData = await geocodePostalCode(postalDigits);
      addressData.postalCode = formatCep(postalDigits);
      applyAddressDataIfEmpty(addressData);
      state.lastPostalLookup = postalDigits;
    } catch (error) {
      if (showAlertOnFail) {
        showMessage("Endereço", "Não foi possível auto preencher pelo CEP. Continue manualmente.", "warning");
      }
    } finally {
      state.postalLookupInFlight = false;
    }
  }

  async function installGoogleAddressAutocomplete() {
    return false;
  }

  function setPaymentError(message) {
    const errorEl = getEl("paymentCardError");
    if (!errorEl) return;
    errorEl.textContent = normalizeString(message || "");
  }

  function applyPaymentModeUi(requiresCard, appliedCouponCode) {
    state.paymentRequiresCard = !!requiresCard;
    const normalizedCoupon = normalizeString(appliedCouponCode).toUpperCase();

    const cardGroup = getEl("paymentCardGroup");
    if (cardGroup) {
      cardGroup.classList.toggle("section-hidden", !state.paymentRequiresCard);
    }

    const noChargeHint = getEl("paymentNoChargeHint");
    if (noChargeHint) {
      const showHint = !state.paymentRequiresCard && normalizedCoupon === "NEVERPAY";
      noChargeHint.classList.toggle("section-hidden", !showHint);
    }

    if (!state.paymentRequiresCard) {
      setPaymentError("");
    }

    const confirmBtn = getEl("paymentConfirmBtn");
    if (confirmBtn && !state.isFinalizingPayment) {
      confirmBtn.innerHTML = getPaymentButtonLabel(false);
    }
  }

  function getPaymentButtonLabel(isLoading) {
    if (isLoading) {
      return state.paymentRequiresCard
        ? '<i class="fa fa-spinner fa-spin"></i> Validando...'
        : '<i class="fa fa-spinner fa-spin"></i> Concluindo...';
    }

    return state.paymentRequiresCard
      ? '<i class="fa fa-lock"></i> Validar cartão e concluir cadastro'
      : '<i class="fa fa-check"></i> Concluir cadastro sem cobrança';
  }

  function resetPaymentStep() {
    state.paymentSessionId = null;
    state.paymentClientSecret = null;
    state.paymentRequiresCard = true;
    state.paymentCouponCode = "";
    state.cachedSignupPayload = null;
    state.isFinalizingPayment = false;
    setPaymentError("");
    applyPaymentModeUi(true, "");

    const couponInput = getEl("paymentCouponInput");
    if (couponInput) couponInput.value = "";

    const paymentWrap = getEl("paymentStepWrap");
    if (paymentWrap) paymentWrap.classList.add("section-hidden");

    const confirmBtn = getEl("confirmBtn");
    if (confirmBtn) confirmBtn.classList.remove("section-hidden");
  }

  function showPaymentStep() {
    const paymentWrap = getEl("paymentStepWrap");
    if (paymentWrap) paymentWrap.classList.remove("section-hidden");

    const confirmBtn = getEl("confirmBtn");
    if (confirmBtn) confirmBtn.classList.add("section-hidden");

    if (paymentWrap) {
      paymentWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function showDataStep() {
    const paymentWrap = getEl("paymentStepWrap");
    if (paymentWrap) paymentWrap.classList.add("section-hidden");

    const confirmBtn = getEl("confirmBtn");
    if (confirmBtn) confirmBtn.classList.remove("section-hidden");
  }

  function setPaymentSubmitState(isLoading) {
    state.isFinalizingPayment = isLoading;
    const btn = getEl("paymentConfirmBtn");
    if (!btn) return;

    btn.disabled = isLoading;
    btn.innerHTML = getPaymentButtonLabel(isLoading);
  }

  function loadStripeJs() {
    if (window.Stripe) return Promise.resolve(true);
    if (state.stripeJsLoading) return state.stripeJsLoading;

    state.stripeJsLoading = new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/";
      script.async = true;
      script.onload = function () {
        resolve(!!window.Stripe);
      };
      script.onerror = function () {
        resolve(false);
      };
      document.head.appendChild(script);
    }).then((ok) => {
      if (!ok) state.stripeJsLoading = null;
      return ok;
    });

    return state.stripeJsLoading;
  }

  async function ensureStripeCardElement(publishableKey) {
    const key = normalizeString(publishableKey);
    if (!key) throw new Error("Stripe publishable key nao disponivel.");

    const loaded = await loadStripeJs();
    if (!loaded || !window.Stripe) {
      throw new Error("Não foi possível carregar o Stripe.js.");
    }

    if (!state.stripe || state.paymentPublishableKey !== key) {
      state.paymentPublishableKey = key;
      state.stripe = window.Stripe(key);
      state.stripeElements = state.stripe.elements({ locale: "pt-BR" });
      state.stripeCardElement = null;
    }

    if (!state.stripeCardElement) {
      state.stripeCardElement = state.stripeElements.create("card", {
        hidePostalCode: true,
      });
      state.stripeCardElement.mount("#paymentCardElement");
      state.stripeCardElement.on("change", function (event) {
        setPaymentError(event && event.error ? event.error.message : "");
      });
    }
  }

  function setIfEmpty(id, value) {
    const el = getEl(id);
    if (!el) return;
    if (normalizeString(el.value).length > 0) return;
    el.value = String(value == null ? "" : value);
  }

  function showCnpjLoading(isLoading) {
    const el = getEl("companyCnpjHelp");
    if (!el) return;
    el.style.display = isLoading ? "block" : "none";
  }

  function applyPersonTypeMode() {
    const isPj = isLegalEntity();
    const input = getEl("companyNumberInput");
    const label = getEl("companyNumberLabel");
    const btn = getEl("btnLookupCnpj");
    const help = getEl("companyCnpjHelp");

    if (!input || !label || !btn) return;

    state.lastCnpjFetched = null;
    state.cnpjLookupInFlight = false;
    showCnpjLoading(false);

    if (isPj) {
      label.textContent = "CNPJ";
      input.placeholder = "12.345.678/0001-90";
      input.maxLength = 18;
      input.value = formatCnpj(input.value);
      btn.style.display = "";
      btn.disabled = false;
      if (help) help.textContent = "Consultando CNPJ...";
      return;
    }

    label.textContent = "CPF";
    input.placeholder = "000.000.000-00";
    input.maxLength = 14;
    input.value = formatCpf(input.value);
    btn.style.display = "none";
    btn.disabled = true;
    if (help) help.textContent = "Consulta automatica disponivel apenas para CNPJ.";
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

  function getFriendlyCnpjErrorMessage(error) {
    const fallback = "Por motivos de seguranca, digite seus dados manualmente.";
    const status = Number(error && error.status);
    const raw = normalizeString(error && error.message ? error.message : "");
    const lower = raw.toLowerCase();

    if (status === 429 || status === 403 || status === 503) return fallback;
    if (!lower) return fallback;

    const limitHints = ["limite", "limit", "quota", "rate", "429", "too many", "exced", "temporar"];
    if (limitHints.some((hint) => lower.includes(hint))) return fallback;

    return raw;
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

  async function fetchCompanyByCnpj(cnpjDigits) {
    const response = await fetch(`/api/cnpj/lookup?cnpj=${encodeURIComponent(cnpjDigits)}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      credentials: "include"
    });

    const data = await readJsonSafe(response);
    if (!response.ok) {
      const message = data && data.message ? data.message : "Falha na consulta do CNPJ.";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    return data || {};
  }

  async function tryAutoFillFromCnpj(showAlertOnFail) {
    if (!isLegalEntity()) return;

    const rawValue = getValue("companyNumberInput");
    const cnpjDigits = onlyDigits(rawValue);
    if (cnpjDigits.length !== 14) return;
    if (state.lastCnpjFetched === cnpjDigits) return;
    if (state.cnpjLookupInFlight) return;

    state.cnpjLookupInFlight = true;
    showCnpjLoading(true);
    try {
      const data = await fetchCompanyByCnpj(cnpjDigits);
      state.lastCnpjFetched = cnpjDigits;

      const activityText =
        data && data.atividade_principal && data.atividade_principal.text
          ? data.atividade_principal.text
          : "";

      setIfEmpty("companyNameInput", data.nome || data.fantasia || "");
      setIfEmpty("companySectorInput", activityText);
      setIfEmpty("addressStreetInput", data.logradouro || "");
      setIfEmpty("addressNumberInput", data.numero || "");
      setIfEmpty("addressCityInput", data.municipio || "");
      setIfEmpty("addressStateInput", data.uf || "");
      if (data.cep) setIfEmpty("addressPostalCodeInput", formatCep(data.cep));
      setIfEmpty("addressCountryInput", "Brasil");
    } catch (error) {
      if (showAlertOnFail) {
        const message = getFriendlyCnpjErrorMessage(error);
        showMessage("Falha no CNPJ", message, "error");
      }
    } finally {
      state.cnpjLookupInFlight = false;
      showCnpjLoading(false);
    }
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
    resetPaymentStep();
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
      container.innerHTML = '<div class="col-sm-12"><span class="text-muted">Nenhum módulo público disponível.</span></div>';
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
            <ul class="plan-list">${features || "<li>Sem módulos listados.</li>"}</ul>
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
          <div class="plan-price">Você escolhe <small>módulo a módulo</small></div>
          <p class="text-muted">Monte um plano sob medida escolhendo os módulos que precisa e veja o total mensal.</p>
          <ul class="plan-list">
            <li>Escolha os módulos desejados</li>
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
      ? '<div class="col-lg-12"><div class="alert alert-warning">Não há planos prontos publicados. Você ainda pode montar um plano custom.</div></div>'
      : "";

    container.innerHTML = `<div class="row">${emptyWarning}${cards.join("")}</div>`;
  }

  function renderPlansLoading() {
    const container = document.getElementById("dynamicPlansContainer");
    if (!container) return;
    container.innerHTML = `
      <div class="row">
        <div class="col-lg-12">
          <div class="alert alert-info">Carregando planos disponíveis...</div>
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
    resetPaymentStep();

    const listWrap = getEl("plansListWrap");
    const formWrap = getEl("registerFormWrap");
    if (listWrap) listWrap.classList.add("is-hidden");
    if (formWrap) {
      formWrap.classList.add("is-active");
      formWrap.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  window.__publicOpenRegisterForSelection = openRegisterForSelection;

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
      ? '<i class="fa fa-spinner fa-spin"></i> Preparando pagamento...'
      : '<i class="fa fa-arrow-right"></i> Continuar para pagamento';

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
    const companyNumberDigits = onlyDigits(companyNumber);
    const personType = getPersonType();
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
    if (!companyName) throw new Error("Nome da empresa é obrigatório.");
    if (!userName) throw new Error("Nome do utilizador é obrigatório.");
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("Informe um e-mail válido.");
    if (!phone) throw new Error("Telefone é obrigatório.");
    if (!password || password.length < 8) throw new Error("A senha do admin deve ter no mínimo 8 caracteres.");
    if (personType === "PJ" && companyNumberDigits.length !== 14) {
      throw new Error("Informe um CNPJ válido com 14 dígitos.");
    }
    if (personType === "PF" && companyNumberDigits.length !== 11) {
      throw new Error("Informe um CPF válido com 11 dígitos.");
    }
    if (!companySector) throw new Error("Setor é obrigatório.");
    if (!companyCategory) throw new Error("Categoria é obrigatória.");
    if (!street || !number || !city || !stateUf || !postalCode || !country) throw new Error("Preencha todos os dados de endereço.");
    if (!acceptTerms) throw new Error("Você precisa aceitar os termos para continuar.");
    if (state.selectedPlanType === "custom" && state.customModuleIds.length === 0) {
      throw new Error("Selecione ao menos um módulo para o plano custom.");
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

    if (personType === "PF") {
      payload.company_cpf = companyNumber;
    }

    if (state.selectedPlanType === "custom") {
      payload.custom_module_ids = state.customModuleIds.slice();
    } else {
      payload.selected_plan_id = state.selectedPlanId;
    }

    return payload;
  }

  async function prepareSignupPaymentSession(signupPayload, couponCode, clearCardField) {
    const normalizedCoupon = normalizeString(couponCode).toUpperCase();
    const preparePayload = Object.assign({}, signupPayload || {});
    if (normalizedCoupon) {
      preparePayload.coupon_code = normalizedCoupon;
    }

    const paymentSession = await postJson("/auth/signup/payment/prepare", preparePayload);
    if (!paymentSession || !paymentSession.session_id) {
      throw new Error("Falha ao iniciar etapa de pagamento.");
    }

    state.cachedSignupPayload = signupPayload;
    state.paymentSessionId = normalizeString(paymentSession.session_id);
    state.paymentCouponCode = normalizedCoupon;

    const requiresPayment = paymentSession.requires_payment !== false;
    applyPaymentModeUi(requiresPayment, normalizedCoupon);

    if (!requiresPayment) {
      state.paymentClientSecret = null;
      return paymentSession;
    }

    state.paymentClientSecret = normalizeString(paymentSession.setup_intent_client_secret);
    if (!state.paymentClientSecret) {
      throw new Error("Não foi possível preparar a validação do cartão.");
    }

    await ensureStripeCardElement(paymentSession.stripe_publishable_key);
    if (clearCardField && state.stripeCardElement && typeof state.stripeCardElement.clear === "function") {
      state.stripeCardElement.clear();
    }

    return paymentSession;
  }

  async function onSubmitForm(event) {
    event.preventDefault();
    if (state.isSubmitting) return;

    try {
      const signupPayload = validateFormPayload();
      const couponCode = getPaymentCouponCode();
      setSubmitState(true);
      await prepareSignupPaymentSession(signupPayload, couponCode, true);
      setPaymentError("");
      showPaymentStep();
    } catch (error) {
      console.error("[PublicRegister] submit error:", error);
      const msg = error && error.message ? error.message : "Não foi possível iniciar o pagamento.";
      showMessage("Falha no cadastro", msg, "error");
    } finally {
      setSubmitState(false);
    }
  }

  async function completeSignupWithPayment() {
    if (state.isFinalizingPayment) return;

    try {
      setPaymentSubmitState(true);
      showLoader();
      setPaymentError("");

      const signupPayload = validateFormPayload();
      const couponCode = getPaymentCouponCode();
      await prepareSignupPaymentSession(signupPayload, couponCode, false);

      if (!state.paymentSessionId) {
        throw new Error("Sessão de pagamento inválida. Tente novamente.");
      }

      if (!state.paymentRequiresCard) {
        await postJson("/auth/signup/payment/complete", {
          session_id: state.paymentSessionId,
        });

        await syncCurrentUserFromMe();
        swal({
          title: "Cadastro concluído!",
          text: "Seu ambiente foi criado e sua sessão já está autenticada.",
          type: "success"
        }, function () {
          window.location.href = "/Default";
        });
        return;
      }

      if (!state.stripe || !state.paymentClientSecret || !state.stripeCardElement) {
        throw new Error("Não foi possível iniciar validação do cartão. Recarregue a tela e tente novamente.");
      }

      const billingName = normalizeString(getValue("userNameInput")) || normalizeString(getValue("companyNameInput"));
      const billingEmail = normalizeString(getValue("emailInput"));
      const billingPhone = normalizeString(getValue("phoneInput"));
      const billingAddress = {
        line1: normalizeString(getValue("addressStreetInput")) || undefined,
        city: normalizeString(getValue("addressCityInput")) || undefined,
        state: normalizeString(getValue("addressStateInput")) || undefined,
        postal_code: onlyDigits(getValue("addressPostalCodeInput")) || undefined,
        country: "BR",
      };

      const stripeResult = await state.stripe.confirmCardSetup(state.paymentClientSecret, {
        payment_method: {
          card: state.stripeCardElement,
          billing_details: {
            name: billingName || undefined,
            email: billingEmail || undefined,
            phone: billingPhone || undefined,
            address: billingAddress,
          },
        },
      });

      if (stripeResult.error) {
        throw new Error(stripeResult.error.message || "Cartão não validado. Verifique os dados.");
      }

      const setupIntent = stripeResult && stripeResult.setupIntent ? stripeResult.setupIntent : null;
      if (!setupIntent || setupIntent.status !== "succeeded") {
        throw new Error("Cartão não validado pelo Stripe.");
      }

      const paymentMethodId =
        typeof setupIntent.payment_method === "string"
          ? setupIntent.payment_method
          : (setupIntent.payment_method && setupIntent.payment_method.id) || "";
      if (!paymentMethodId) {
        throw new Error("Método de pagamento não encontrado no setup intent.");
      }

      await postJson("/auth/signup/payment/complete", {
        session_id: state.paymentSessionId,
        setup_intent_id: setupIntent.id,
        payment_method_id: paymentMethodId,
      });

      await syncCurrentUserFromMe();
      swal({
        title: "Cadastro concluído!",
        text: "Seu ambiente foi criado com trial de 7 dias e sua sessão já está autenticada.",
        type: "success"
      }, function () {
        window.location.href = "/Default";
      });
    } catch (error) {
      console.error("[PublicRegister] payment complete error:", error);
      const fallbackMsg = state.paymentRequiresCard
        ? "Não foi possível validar o cartão."
        : "Não foi possível concluir o cadastro.";
      const msg = error && error.message ? error.message : fallbackMsg;
      if (state.paymentRequiresCard) {
        setPaymentError(msg);
      } else {
        setPaymentError("");
      }
      showMessage("Falha no pagamento", msg, "error");
    } finally {
      hideLoader();
      setPaymentSubmitState(false);
    }
  }

  async function openPlansFromHero() {
    showPlansStage();
    if (state.plansLoaded) {
      renderPlansGrid();
      return;
    }

    renderPlansLoading();
    try {
      await loadPublicCatalog(false);
    } catch (error) {
      console.error("[PublicRegister] failed to load catalog:", error);
      const message = error && error.message ? error.message : "Não foi possível carregar os planos.";
      showMessage("Falha ao carregar planos", message, "error");
    }
  }

  function installEvents() {
    if (window.__publicRegisterHandlersReady) return;

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
    if (form) {
      form.addEventListener("submit", onSubmitForm);
      form.__mainSubmitBound = true;
    }

    const paymentBackBtn = getEl("paymentBackBtn");
    if (paymentBackBtn) {
      paymentBackBtn.addEventListener("click", function () {
        showDataStep();
        setPaymentError("");
      });
    }

    const paymentConfirmBtn = getEl("paymentConfirmBtn");
    if (paymentConfirmBtn) {
      paymentConfirmBtn.addEventListener("click", function () {
        completeSignupWithPayment();
      });
    }

    const paymentCouponInput = getEl("paymentCouponInput");
    if (paymentCouponInput) {
      paymentCouponInput.addEventListener("blur", function () {
        paymentCouponInput.value = normalizeString(paymentCouponInput.value).toUpperCase();
      });
    }

    const cnpjInput = getEl("companyNumberInput");
    if (cnpjInput) {
      cnpjInput.addEventListener("input", function () {
        const masked = isLegalEntity() ? formatCnpj(cnpjInput.value) : formatCpf(cnpjInput.value);
        cnpjInput.value = masked;
      });
      cnpjInput.addEventListener("blur", function () {
        if (isLegalEntity()) tryAutoFillFromCnpj(false);
      });
    }

    const cnpjBtn = getEl("btnLookupCnpj");
    if (cnpjBtn) {
      cnpjBtn.addEventListener("click", function () {
        if (isLegalEntity()) tryAutoFillFromCnpj(true);
      });
    }

    const postalInput = getEl("addressPostalCodeInput");
    if (postalInput) {
      postalInput.addEventListener("input", function () {
        postalInput.value = formatCep(postalInput.value);
        state.lastPostalLookup = null;
      });
      postalInput.addEventListener("blur", function () {
        tryAutoFillFromPostalCode(false);
      });
    }

    document.querySelectorAll('input[name="personTypeInput"]').forEach(function (radio) {
      radio.addEventListener("change", applyPersonTypeMode);
    });

    window.__publicRegisterHandlersReady = true;
  }

  async function bootstrap() {
    window.__openRegisterPlans = openPlansFromHero;
    window.__publicRegisterMainReady = true;
    installEvents();
    applyPersonTypeMode();
    resetPaymentStep();
    showLandingStage();
    installGoogleAddressAutocomplete().catch(function (error) {
      console.warn("[PublicRegister] Google address autocomplete unavailable:", error);
    });

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
  }

  function startBootstrapOnce() {
    if (window.__publicRegisterMainBootstrapped) return;
    window.__publicRegisterMainBootstrapped = true;
    Promise.resolve(bootstrap()).catch(function (error) {
      console.error("[PublicRegister] bootstrap fatal error:", error);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startBootstrapOnce, { once: true });
  } else {
    startBootstrapOnce();
  }
})();
