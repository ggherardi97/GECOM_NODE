(() => {
  const state = {
    companies: [],
    list: [],
    selected: null,
    page: 1,
    take: 20,
    skip: 0,
    filterStatus: "",
    filterType: ""
  };

  const draftStatuses = new Set(["DRAFT"]);
  let itemMode = "create";
  let costMode = "create";

  function escapeHtml(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showLoading(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = on ? "inline-block" : "none";
  }

  function showGlobalSpinner(on) {
    const el = document.getElementById("globalSpinner");
    if (!el) return;
    if (on) {
      el.classList.add("is-visible");
      el.setAttribute("aria-hidden", "false");
    } else {
      el.classList.remove("is-visible");
      el.setAttribute("aria-hidden", "true");
    }
  }

  function readJsonSafe(resp) {
    return resp.text().then((txt) => {
      if (!txt) return {};
      try { return JSON.parse(txt); } catch { return { message: txt }; }
    });
  }

  async function apiGet(url) {
    const r = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
    const d = await readJsonSafe(r);
    if (!r.ok) throw new Error(d?.message || "Falha na requisicao.");
    return d;
  }

  async function apiPost(url, body) {
    const r = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    const d = await readJsonSafe(r);
    if (!r.ok) throw new Error(d?.message || "Falha na requisicao.");
    return d;
  }

  async function apiPatch(url, body) {
    const r = await fetch(url, {
      method: "PATCH",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {})
    });
    const d = await readJsonSafe(r);
    if (!r.ok) throw new Error(d?.message || "Falha na requisicao.");
    return d;
  }

  async function apiDelete(url) {
    const r = await fetch(url, { method: "DELETE", headers: { Accept: "application/json" } });
    if (r.status === 204) return {};
    const d = await readJsonSafe(r);
    if (!r.ok) throw new Error(d?.message || "Falha na requisicao.");
    return d;
  }

  function normalizeListResponse(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.trade_simulations)) return data.trade_simulations;
    return [];
  }

  function normalizeDetailResponse(data) {
    if (!data || typeof data !== "object") return {};
    if (data.data && typeof data.data === "object" && !Array.isArray(data.data)) return data.data;
    return data;
  }

  function extractItems(sim) {
    const candidates = [sim?.items, sim?.trade_simulation_items, sim?.tradeSimulationItems, sim?.itens];
    return candidates.find((x) => Array.isArray(x)) || [];
  }

  function extractCosts(sim) {
    const candidates = [sim?.costs, sim?.additional_costs, sim?.trade_simulation_costs, sim?.custos];
    return candidates.find((x) => Array.isArray(x)) || [];
  }

  function extractTaxes(sim) {
    const candidates = [
      sim?.taxes,
      sim?.calculation?.taxes,
      sim?.result?.taxes,
      sim?.calculation_result?.taxes
    ];
    return candidates.find((x) => Array.isArray(x)) || [];
  }

  function extractByTax(sim) {
    return (
      sim?.by_tax_type ||
      sim?.calculation?.by_tax_type ||
      sim?.result?.by_tax_type ||
      sim?.calculation_result?.by_tax_type ||
      {}
    );
  }

  function extractTotalTaxes(sim) {
    const v =
      sim?.total_taxes_brl ??
      sim?.calculation?.total_taxes_brl ??
      sim?.result?.total_taxes_brl ??
      sim?.calculation_result?.total_taxes_brl ??
      0;
    return toNumber(v);
  }

  function toNumber(v) {
    const n = Number(String(v ?? "").replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }

  function toFixedString(v, decimals) {
    return toNumber(v).toFixed(decimals);
  }

  function moneyBr(v, currency) {
    const n = toNumber(v);
    try {
      if (currency) {
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(n);
      }
    } catch {}
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
  }

  function bindDecimalMasks(root) {
    const host = root || document;
    host.querySelectorAll(".js-decimal").forEach((el) => {
      if (el.dataset.maskBound === "1") return;
      el.dataset.maskBound = "1";
      const decimals = Number(el.dataset.decimals || "2");
      el.addEventListener("input", () => {
        let s = String(el.value || "");
        s = s.replace(/[^\d.,-]/g, "");
        s = s.replace(/(?!^)-/g, "");
        el.value = s;
      });
      el.addEventListener("blur", () => {
        const n = toNumber(el.value);
        el.value = toFixedString(n, decimals);
      });
    });
  }

  function detectPathId() {
    const parts = String(window.location.pathname || "").split("/").filter(Boolean);
    if (parts.length >= 2 && parts[0].toLowerCase() === "calculo-aduaneiro") {
      const id = parts[1] || "";
      return id ? id : null;
    }
    return null;
  }

  async function loadCompanies() {
    const data = await apiGet("/api/companies?fields=summary");
    const rows = Array.isArray(data) ? data : (data?.data || data?.rows || []);
    state.companies = rows.map((c) => ({
      id: String(c?.id || ""),
      name: String(c?.company_name || c?.fantasy_name || c?.name || c?.id || "").trim()
    })).filter((x) => x.id);

    const $company = $("#company_id");
    $company.empty();
    $company.append('<option value="">Selecione...</option>');
    state.companies.forEach((c) => {
      $company.append(`<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`);
    });
  }

  async function loadList() {
    showGlobalSpinner(true);
    try {
      const qs = new URLSearchParams();
      qs.set("take", String(state.take));
      qs.set("skip", String(state.skip));
      if (state.filterStatus) qs.set("status", state.filterStatus);
      if (state.filterType) qs.set("type", state.filterType);

      const data = await apiGet(`/api/trade-simulations?${qs.toString()}`);
      state.list = normalizeListResponse(data);
      renderList();
      $("#listPageInfo").text(`Pagina ${state.page}`);
    } finally {
      showGlobalSpinner(false);
    }
  }

  function renderList() {
    const $host = $("#simList");
    $host.empty();
    if (!state.list.length) {
      $host.html('<div class="ca-empty">Nenhuma simulacao encontrada.</div>');
      return;
    }
    state.list.forEach((s) => {
      const id = String(s?.id || "");
      const isActive = String(state.selected?.id || "") === id;
      const type = String(s?.type || "-");
      const status = String(s?.status || "-");
      const mode = String(s?.calculation_mode || "-");
      const companyName = String(s?.company_name || s?.company?.company_name || s?.company_id || "-");
      const html = `
        <div class="ca-list-item ${isActive ? "active" : ""}" data-id="${escapeHtml(id)}">
          <div><strong>${escapeHtml(type)}</strong> <span class="label label-default">${escapeHtml(status)}</span></div>
          <div class="ca-muted">Company: ${escapeHtml(companyName)}</div>
          <div class="ca-muted">Modo: ${escapeHtml(mode)}</div>
        </div>
      `;
      $host.append(html);
    });

    $host.find(".ca-list-item").off("click").on("click", async function () {
      const id = String($(this).data("id") || "");
      if (!id) return;
      await openSimulation(id, true);
    });
  }

  function setEditorVisible(on) {
    $("#editorEmpty").toggle(!on);
    $("#editorRoot").toggle(!!on);
  }

  function fillHeader(sim) {
    $("#simId").val(sim?.id || "");
    $("#simTitle").text(`Calculo Aduaneiro - ${String(sim?.id || "").slice(0, 8) || "novo"}`);
    $("#company_id").val(sim?.company_id || "");
    $("#type").val(sim?.type || "IMPORT");
    $("#status").val(sim?.status || "DRAFT");
    $("#calculation_mode").val(sim?.calculation_mode || "RULES");
    $("#currency").val(sim?.currency || "USD");
    $("#exchange_rate").val(toFixedString(sim?.exchange_rate || 1, 6));
    $("#incoterm").val(sim?.incoterm || "");
    $("#origin_country").val(sim?.origin_country || "");
    $("#destination_state").val(sim?.destination_state || "");
    $("#customs_value").val(toFixedString(sim?.customs_value || 0, 2));
    $("#freight_international").val(toFixedString(sim?.freight_international || 0, 2));
    $("#insurance_international").val(toFixedString(sim?.insurance_international || 0, 2));
    $("#other_additions").val(toFixedString(sim?.other_additions || 0, 2));
    $("#icms_rate").val(toFixedString(sim?.icms_rate || 0, 6));
  }

  function isDraft(sim) {
    return draftStatuses.has(String(sim?.status || ""));
  }

  function applyDraftLock() {
    const canEdit = isDraft(state.selected);
    $("#simHeaderForm :input").prop("disabled", !canEdit);
    $("#btnSaveHeader").prop("disabled", !canEdit);
    $("#btnAddItem").prop("disabled", !canEdit);
    $("#btnAddCost").prop("disabled", !canEdit);
  }

  function renderItems() {
    const sim = state.selected || {};
    const items = extractItems(sim);
    const canEdit = isDraft(sim);
    const $tbody = $("#itemsTbody");
    $tbody.empty();
    if (!items.length) {
      $tbody.html('<tr><td colspan="11" class="text-center text-muted">Nenhum item adicionado.</td></tr>');
      return;
    }
    items.forEach((x, i) => {
      const id = String(x?.id || "");
      const row = `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(x?.description || "")}</td>
          <td>${escapeHtml(x?.ncm || "")}</td>
          <td class="text-right">${escapeHtml(toFixedString(x?.quantity || 0, 4))}</td>
          <td class="text-right">${escapeHtml(toFixedString(x?.unit_price || 0, 2))}</td>
          <td class="text-right">${escapeHtml(toFixedString(x?.item_value || (toNumber(x?.quantity) * toNumber(x?.unit_price)), 2))}</td>
          <td class="text-right">${escapeHtml(toFixedString(x?.freight_allocated || 0, 2))}</td>
          <td class="text-right">${escapeHtml(toFixedString(x?.insurance_allocated || 0, 2))}</td>
          <td class="text-right">${escapeHtml(toFixedString(x?.customs_value_allocated || 0, 2))}</td>
          <td>${escapeHtml(x?.notes || "")}</td>
          <td class="ca-grid-actions">
            <button class="btn btn-white btn-xs btn-edit-item" data-id="${escapeHtml(id)}" ${canEdit ? "" : "disabled"}><i class="fa fa-pencil"></i></button>
            <button class="btn btn-danger btn-xs btn-del-item" data-id="${escapeHtml(id)}" ${canEdit ? "" : "disabled"}><i class="fa fa-trash"></i></button>
          </td>
        </tr>
      `;
      $tbody.append(row);
    });
  }

  function renderCosts() {
    const sim = state.selected || {};
    const costs = extractCosts(sim);
    const canEdit = isDraft(sim);
    const $tbody = $("#costsTbody");
    $tbody.empty();
    if (!costs.length) {
      $tbody.html('<tr><td colspan="9" class="text-center text-muted">Nenhum custo adicional.</td></tr>');
      return;
    }
    costs.forEach((x, i) => {
      const id = String(x?.id || "");
      const row = `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(x?.cost_type || "")}</td>
          <td class="text-right">${escapeHtml(toFixedString(x?.amount || 0, 2))}</td>
          <td>${escapeHtml(x?.currency || "")}</td>
          <td class="text-right">${escapeHtml(toFixedString(x?.exchange_rate || 0, 6))}</td>
          <td>${x?.is_in_icms_base ? "Sim" : "Nao"}</td>
          <td>${escapeHtml(x?.allocation_method || "")}</td>
          <td>${escapeHtml(x?.notes || "")}</td>
          <td class="ca-grid-actions">
            <button class="btn btn-white btn-xs btn-edit-cost" data-id="${escapeHtml(id)}" ${canEdit ? "" : "disabled"}><i class="fa fa-pencil"></i></button>
            <button class="btn btn-danger btn-xs btn-del-cost" data-id="${escapeHtml(id)}" ${canEdit ? "" : "disabled"}><i class="fa fa-trash"></i></button>
          </td>
        </tr>
      `;
      $tbody.append(row);
    });
  }

  function renderCalculation() {
    const sim = state.selected || {};
    $("#kpiTotalTaxes").text(moneyBr(extractTotalTaxes(sim), "BRL"));

    const byTax = extractByTax(sim) || {};
    const entries = Array.isArray(byTax)
      ? byTax.map((x) => [String(x?.tax_type || x?.name || "-"), toNumber(x?.amount || x?.value || 0)])
      : Object.entries(byTax);

    const $host = $("#byTaxHost");
    $host.empty();
    if (!entries.length) {
      $host.html('<div class="ca-muted" style="margin-bottom:8px;">Sem totalizadores por tributo.</div>');
    } else {
      entries.forEach(([k, v]) => {
        $host.append(`
          <div class="ca-kpi">
            <div class="ca-muted">${escapeHtml(String(k || "-"))}</div>
            <div class="v">${escapeHtml(moneyBr(v, "BRL"))}</div>
          </div>
        `);
      });
    }

    const taxes = extractTaxes(sim);
    const $tbody = $("#taxesTbody");
    $tbody.empty();
    if (!taxes.length) {
      $tbody.html('<tr><td colspan="5" class="text-center text-muted">Sem impostos calculados.</td></tr>');
      return;
    }
    taxes.forEach((tx) => {
      const taxType = tx?.tax_type || tx?.type || tx?.name || "-";
      const base = tx?.base ?? tx?.tax_base ?? 0;
      const rate = tx?.rate ?? tx?.aliquot ?? tx?.tax_rate ?? 0;
      const amount = tx?.amount ?? tx?.value ?? tx?.tax_value ?? 0;
      const itemId = tx?.item_id || tx?.simulation_item_id || "-";
      $tbody.append(`
        <tr>
          <td>${escapeHtml(String(taxType))}</td>
          <td class="text-right">${escapeHtml(toFixedString(base, 2))}</td>
          <td class="text-right">${escapeHtml((toNumber(rate) * 100).toFixed(2))}%</td>
          <td class="text-right">${escapeHtml(toFixedString(amount, 2))}</td>
          <td>${escapeHtml(String(itemId))}</td>
        </tr>
      `);
    });
  }

  function renderAll() {
    if (!state.selected) {
      setEditorVisible(false);
      return;
    }
    setEditorVisible(true);
    fillHeader(state.selected);
    applyDraftLock();
    renderItems();
    renderCosts();
    renderCalculation();
    renderList();
  }

  function normalizeHeaderPayload() {
    return {
      company_id: String($("#company_id").val() || "").trim() || null,
      type: String($("#type").val() || "").trim() || "IMPORT",
      status: String($("#status").val() || "").trim() || "DRAFT",
      calculation_mode: String($("#calculation_mode").val() || "").trim() || "RULES",
      currency: String($("#currency").val() || "").trim().toUpperCase() || "USD",
      exchange_rate: toFixedString($("#exchange_rate").val(), 6),
      incoterm: String($("#incoterm").val() || "").trim() || null,
      origin_country: String($("#origin_country").val() || "").trim().toUpperCase() || null,
      destination_state: String($("#destination_state").val() || "").trim().toUpperCase() || null,
      customs_value: toFixedString($("#customs_value").val(), 2),
      freight_international: toFixedString($("#freight_international").val(), 2),
      insurance_international: toFixedString($("#insurance_international").val(), 2),
      other_additions: toFixedString($("#other_additions").val(), 2),
      icms_rate: toFixedString($("#icms_rate").val(), 6),
    };
  }

  async function openSimulation(id, updateUrl) {
    showGlobalSpinner(true);
    try {
      const data = await apiGet(`/api/trade-simulations/${encodeURIComponent(id)}`);
      state.selected = normalizeDetailResponse(data);
      renderAll();
      if (updateUrl) {
        window.history.replaceState({}, "", `/calculo-aduaneiro/${encodeURIComponent(String(state.selected?.id || id))}`);
      }
    } catch (e) {
      alert(e?.message || "Falha ao carregar simulacao.");
    } finally {
      showGlobalSpinner(false);
    }
  }

  async function createSimulation() {
    const fallbackCompanyId = state.companies[0]?.id || null;
    const payload = {
      company_id: fallbackCompanyId,
      type: "IMPORT",
      status: "DRAFT",
      calculation_mode: "RULES",
      currency: "USD",
      exchange_rate: "1.000000",
      incoterm: "FOB",
      origin_country: "US",
      destination_state: "SP",
      customs_value: "0.00",
      freight_international: "0.00",
      insurance_international: "0.00",
      other_additions: "0.00",
      icms_rate: "0.180000"
    };
    showGlobalSpinner(true);
    try {
      const created = normalizeDetailResponse(await apiPost("/api/trade-simulations", payload));
      const id = String(created?.id || "").trim();
      if (!id) throw new Error("Criacao concluida, mas sem ID.");
      await loadList();
      await openSimulation(id, true);
    } catch (e) {
      alert(e?.message || "Falha ao criar simulacao.");
    } finally {
      showGlobalSpinner(false);
    }
  }

  async function saveHeader() {
    if (!state.selected?.id) return;
    if (!isDraft(state.selected)) {
      alert("Simulacao nao esta em DRAFT.");
      return;
    }
    const payload = normalizeHeaderPayload();
    showLoading("calcLoading", true);
    try {
      await apiPatch(`/api/trade-simulations/${encodeURIComponent(state.selected.id)}`, payload);
      await openSimulation(state.selected.id, false);
      await loadList();
    } catch (e) {
      alert(e?.message || "Falha ao salvar cabecalho.");
    } finally {
      showLoading("calcLoading", false);
    }
  }

  async function calculateSimulation() {
    if (!state.selected?.id) return;
    showLoading("calcLoading", true);
    try {
      await apiPost(`/api/trade-simulations/${encodeURIComponent(state.selected.id)}/calculate`, {
        calculation_mode: String($("#calculation_mode").val() || "RULES")
      });
      await openSimulation(state.selected.id, false);
      await loadList();
    } catch (e) {
      alert(e?.message || "Falha no calculo da simulacao.");
    } finally {
      showLoading("calcLoading", false);
    }
  }

  async function duplicateSimulation() {
    if (!state.selected) return;
    const copy = normalizeHeaderPayload();
    copy.status = "DRAFT";
    showGlobalSpinner(true);
    try {
      const created = normalizeDetailResponse(await apiPost("/api/trade-simulations", copy));
      const newId = String(created?.id || "").trim();
      if (!newId) throw new Error("Nao foi possivel criar copia.");
      const items = extractItems(state.selected);
      const costs = extractCosts(state.selected);
      for (const item of items) {
        await apiPost(`/api/trade-simulations/${encodeURIComponent(newId)}/items`, {
          description: item?.description || "",
          ncm: item?.ncm || "",
          quantity: toFixedString(item?.quantity || 0, 4),
          unit_price: toFixedString(item?.unit_price || 0, 2),
          item_value: toFixedString(item?.item_value || (toNumber(item?.quantity) * toNumber(item?.unit_price)), 2),
          freight_allocated: toFixedString(item?.freight_allocated || 0, 2),
          insurance_allocated: toFixedString(item?.insurance_allocated || 0, 2),
          customs_value_allocated: toFixedString(item?.customs_value_allocated || 0, 2),
          notes: item?.notes || ""
        });
      }
      for (const cost of costs) {
        await apiPost(`/api/trade-simulations/${encodeURIComponent(newId)}/costs`, {
          cost_type: cost?.cost_type || "",
          amount: toFixedString(cost?.amount || 0, 2),
          currency: String(cost?.currency || "USD"),
          exchange_rate: toFixedString(cost?.exchange_rate || 1, 6),
          is_in_icms_base: !!cost?.is_in_icms_base,
          allocation_method: cost?.allocation_method || "",
          notes: cost?.notes || ""
        });
      }
      await loadList();
      await openSimulation(newId, true);
    } catch (e) {
      alert(e?.message || "Falha ao duplicar simulacao.");
    } finally {
      showGlobalSpinner(false);
    }
  }

  function computeItemValuePreview() {
    const q = toNumber($("#item_quantity").val());
    const p = toNumber($("#item_unit_price").val());
    $("#item_item_value").val(toFixedString(q * p, 2));
  }

  function openItemModal(item) {
    itemMode = item ? "edit" : "create";
    $("#itemModalTitle").text(item ? "Editar Item" : "Novo Item");
    $("#item_id").val(item?.id || "");
    $("#item_description").val(item?.description || "");
    $("#item_ncm").val(item?.ncm || "");
    $("#item_quantity").val(toFixedString(item?.quantity || 0, 4));
    $("#item_unit_price").val(toFixedString(item?.unit_price || 0, 2));
    $("#item_item_value").val(toFixedString(item?.item_value || (toNumber(item?.quantity) * toNumber(item?.unit_price)), 2));
    $("#item_freight_allocated").val(toFixedString(item?.freight_allocated || 0, 2));
    $("#item_insurance_allocated").val(toFixedString(item?.insurance_allocated || 0, 2));
    $("#item_customs_value_allocated").val(toFixedString(item?.customs_value_allocated || 0, 2));
    $("#item_notes").val(item?.notes || "");
    $("#itemModal").modal("show");
  }

  async function saveItemModal() {
    const simId = String(state.selected?.id || "");
    if (!simId) return;
    if (!isDraft(state.selected)) return alert("Somente DRAFT permite editar itens.");

    const payload = {
      description: String($("#item_description").val() || "").trim(),
      ncm: String($("#item_ncm").val() || "").trim(),
      quantity: toFixedString($("#item_quantity").val(), 4),
      unit_price: toFixedString($("#item_unit_price").val(), 2),
      item_value: toFixedString($("#item_item_value").val(), 2),
      freight_allocated: toFixedString($("#item_freight_allocated").val(), 2),
      insurance_allocated: toFixedString($("#item_insurance_allocated").val(), 2),
      customs_value_allocated: toFixedString($("#item_customs_value_allocated").val(), 2),
      notes: String($("#item_notes").val() || "").trim()
    };

    showLoading("itemsLoading", true);
    try {
      const itemId = String($("#item_id").val() || "");
      if (itemMode === "edit" && itemId) {
        await apiPatch(`/api/trade-simulations/${encodeURIComponent(simId)}/items/${encodeURIComponent(itemId)}`, payload);
      } else {
        await apiPost(`/api/trade-simulations/${encodeURIComponent(simId)}/items`, payload);
      }
      $("#itemModal").modal("hide");
      await openSimulation(simId, false);
    } catch (e) {
      alert(e?.message || "Falha ao salvar item.");
    } finally {
      showLoading("itemsLoading", false);
    }
  }

  async function deleteItem(itemId) {
    const simId = String(state.selected?.id || "");
    if (!simId || !itemId) return;
    if (!isDraft(state.selected)) return alert("Somente DRAFT permite editar itens.");
    if (!confirm("Confirma excluir item?")) return;
    showLoading("itemsLoading", true);
    try {
      await apiDelete(`/api/trade-simulations/${encodeURIComponent(simId)}/items/${encodeURIComponent(itemId)}`);
      await openSimulation(simId, false);
    } catch (e) {
      alert(e?.message || "Falha ao excluir item.");
    } finally {
      showLoading("itemsLoading", false);
    }
  }

  function openCostModal(cost) {
    costMode = cost ? "edit" : "create";
    $("#costModalTitle").text(cost ? "Editar Custo" : "Novo Custo");
    $("#cost_id").val(cost?.id || "");
    $("#cost_type").val(cost?.cost_type || "");
    $("#cost_amount").val(toFixedString(cost?.amount || 0, 2));
    $("#cost_currency").val(cost?.currency || "USD");
    $("#cost_exchange_rate").val(toFixedString(cost?.exchange_rate || 1, 6));
    $("#cost_is_in_icms_base").val(cost?.is_in_icms_base ? "true" : "false");
    $("#cost_allocation_method").val(cost?.allocation_method || "");
    $("#cost_notes").val(cost?.notes || "");
    $("#costModal").modal("show");
  }

  async function saveCostModal() {
    const simId = String(state.selected?.id || "");
    if (!simId) return;
    if (!isDraft(state.selected)) return alert("Somente DRAFT permite editar custos.");

    const payload = {
      cost_type: String($("#cost_type").val() || "").trim(),
      amount: toFixedString($("#cost_amount").val(), 2),
      currency: String($("#cost_currency").val() || "").trim().toUpperCase(),
      exchange_rate: toFixedString($("#cost_exchange_rate").val(), 6),
      is_in_icms_base: String($("#cost_is_in_icms_base").val()) === "true",
      allocation_method: String($("#cost_allocation_method").val() || "").trim(),
      notes: String($("#cost_notes").val() || "").trim()
    };

    showLoading("costsLoading", true);
    try {
      const costId = String($("#cost_id").val() || "");
      if (costMode === "edit" && costId) {
        await apiPatch(`/api/trade-simulations/${encodeURIComponent(simId)}/costs/${encodeURIComponent(costId)}`, payload);
      } else {
        await apiPost(`/api/trade-simulations/${encodeURIComponent(simId)}/costs`, payload);
      }
      $("#costModal").modal("hide");
      await openSimulation(simId, false);
    } catch (e) {
      alert(e?.message || "Falha ao salvar custo.");
    } finally {
      showLoading("costsLoading", false);
    }
  }

  async function deleteCost(costId) {
    const simId = String(state.selected?.id || "");
    if (!simId || !costId) return;
    if (!isDraft(state.selected)) return alert("Somente DRAFT permite editar custos.");
    if (!confirm("Confirma excluir custo?")) return;
    showLoading("costsLoading", true);
    try {
      await apiDelete(`/api/trade-simulations/${encodeURIComponent(simId)}/costs/${encodeURIComponent(costId)}`);
      await openSimulation(simId, false);
    } catch (e) {
      alert(e?.message || "Falha ao excluir custo.");
    } finally {
      showLoading("costsLoading", false);
    }
  }

  async function runTtceLookup() {
    const payload = {
      ncm: String($("#ttce_ncm").val() || "").trim(),
      customsValue: toFixedString($("#ttce_customs_value").val(), 2),
      currency: String($("#ttce_currency").val() || "USD").trim().toUpperCase(),
      originCountry: String($("#ttce_origin_country").val() || "").trim().toUpperCase(),
      destinationState: String($("#ttce_destination_state").val() || "").trim().toUpperCase()
    };

    showLoading("ttceLoading", true);
    try {
      const data = await apiPost("/api/trade-simulations/ttce/lookup", payload);
      const taxes = Array.isArray(data?.taxes)
        ? data.taxes
        : (Array.isArray(data?.normalized_taxes) ? data.normalized_taxes : []);
      const $tbody = $("#ttceTaxesTbody");
      $tbody.empty();
      if (!taxes.length) {
        $tbody.html('<tr><td colspan="4" class="text-center text-muted">Sem retorno de impostos.</td></tr>');
      } else {
        taxes.forEach((tx) => {
          $tbody.append(`
            <tr>
              <td>${escapeHtml(String(tx?.tax_type || tx?.type || tx?.name || "-"))}</td>
              <td class="text-right">${escapeHtml(toFixedString(tx?.base ?? tx?.tax_base ?? 0, 2))}</td>
              <td class="text-right">${escapeHtml((toNumber(tx?.rate ?? tx?.aliquot ?? tx?.tax_rate ?? 0) * 100).toFixed(2))}%</td>
              <td class="text-right">${escapeHtml(toFixedString(tx?.amount ?? tx?.value ?? tx?.tax_value ?? 0, 2))}</td>
            </tr>
          `);
        });
      }
      $("#ttceRaw").text(JSON.stringify(data, null, 2));
    } catch (e) {
      alert(e?.message || "Falha na consulta TTCE.");
    } finally {
      showLoading("ttceLoading", false);
    }
  }

  function bindEvents() {
    $("#btnNewSimulation, #btnNewSimulationTop").on("click", createSimulation);
    $("#btnSaveHeader").on("click", saveHeader);
    $("#btnCalculate").on("click", calculateSimulation);
    $("#btnDuplicate").on("click", duplicateSimulation);
    $("#btnAddItem").on("click", () => openItemModal(null));
    $("#btnAddCost").on("click", () => openCostModal(null));
    $("#btnSaveItemModal").on("click", saveItemModal);
    $("#btnSaveCostModal").on("click", saveCostModal);
    $("#btnTtceLookup").on("click", runTtceLookup);
    $("#item_quantity, #item_unit_price").on("input change", computeItemValuePreview);

    $("#filterStatus").on("change", async function () {
      state.filterStatus = String($(this).val() || "");
      state.page = 1;
      state.skip = 0;
      await loadList();
    });
    $("#filterType").on("change", async function () {
      state.filterType = String($(this).val() || "");
      state.page = 1;
      state.skip = 0;
      await loadList();
    });

    $("#btnPrevPage").on("click", async function () {
      if (state.page <= 1) return;
      state.page -= 1;
      state.skip = (state.page - 1) * state.take;
      await loadList();
    });
    $("#btnNextPage").on("click", async function () {
      state.page += 1;
      state.skip = (state.page - 1) * state.take;
      await loadList();
    });

    $("#itemsTbody").on("click", ".btn-edit-item", function () {
      const id = String($(this).data("id") || "");
      const item = extractItems(state.selected).find((x) => String(x?.id || "") === id);
      if (item) openItemModal(item);
    });
    $("#itemsTbody").on("click", ".btn-del-item", async function () {
      const id = String($(this).data("id") || "");
      await deleteItem(id);
    });

    $("#costsTbody").on("click", ".btn-edit-cost", function () {
      const id = String($(this).data("id") || "");
      const cost = extractCosts(state.selected).find((x) => String(x?.id || "") === id);
      if (cost) openCostModal(cost);
    });
    $("#costsTbody").on("click", ".btn-del-cost", async function () {
      const id = String($(this).data("id") || "");
      await deleteCost(id);
    });
  }

  async function init() {
    try {
      if ($("#pageName").length) {
        $("#pageName").text("Calculo Aduaneiro");
        $("#subpageName").text("Calculo Aduaneiro");
        $("#subpageName").attr("href", "/calculo-aduaneiro");
      }
      bindDecimalMasks(document);
      bindEvents();
      await loadCompanies();
      await loadList();

      const pathId = detectPathId();
      if (pathId) {
        await openSimulation(pathId, false);
      }
    } catch (e) {
      console.error(e);
      alert(e?.message || "Falha ao iniciar tela de Calculo Aduaneiro.");
    }
  }

  init();
})();
