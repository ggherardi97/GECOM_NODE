(function () {
  const page = window.__financeImportPage || {};
  const labels = page.labels || {};
  const fin = window.FinanceResources || {};
  const toMoney = typeof fin.toMoney === "function" ? fin.toMoney : (v) => String(v ?? "");
  const toDateBr = typeof fin.toDateBr === "function" ? fin.toDateBr : (v) => String(v || "");
  const enumLabel = typeof fin.enumLabel === "function" ? fin.enumLabel : (_key, value) => String(value || "");

  const state = {
    jobs: [],
    selectedJobId: null,
    selectedLineId: null,
    bankAccounts: [],
    categories: [],
    costCenters: [],
    companies: [],
    receivables: [],
    payables: [],
  };

  function api(url, options) {
    return fetch(url, Object.assign({ credentials: "include" }, options || {})).then(async (resp) => {
      const text = await resp.text().catch(() => "");
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { message: text };
      }
      if (!resp.ok) throw new Error(data?.message || `HTTP ${resp.status}`);
      return data || {};
    });
  }

  function notify(message) {
    window.alert(message);
  }

  function currentJob() {
    return state.jobs.find((job) => String(job.id) === String(state.selectedJobId)) || null;
  }

  function currentLine() {
    const job = currentJob();
    if (!job) return null;
    return (job.lines || []).find((line) => String(line.id) === String(state.selectedLineId)) || null;
  }

  function optionList(items, valueKey, labelFn, emptyLabel) {
    const rows = [`<option value="">${emptyLabel || "-"}</option>`];
    (items || []).forEach((item) => {
      rows.push(`<option value="${String(item?.[valueKey] || "")}">${String(labelFn(item) || "")}</option>`);
    });
    return rows.join("");
  }

  function bankAccountLabel(item) {
    return [item?.name, item?.bank_name, item?.account_number].filter(Boolean).join(" - ");
  }

  function companyLabel(item) {
    return [item?.company_name, item?.company_number].filter(Boolean).join(" - ");
  }

  function receivableLabel(item) {
    return [item?.title_number, item?.company?.company_name || item?.company_name].filter(Boolean).join(" - ");
  }

  function payableLabel(item) {
    return [item?.payable_number, item?.company?.company_name || item?.company_name].filter(Boolean).join(" - ");
  }

  function renderFilters() {
    const opts = [
      ["", labels.allStatuses || "Todos"],
      ["APPROVED", labels.filterApproved || "Aprovadas"],
      ["SUGGESTED", labels.filterSuggested || "Sugeridas"],
      ["APPLIED", labels.filterApplied || "Aplicadas"],
      ["IGNORED", labels.filterIgnored || "Ignoradas"],
      ["ERROR", labels.filterError || "Erro"],
    ];
    $("#fiStatusFilter").html(opts.map(([value, text]) => `<option value="${value}">${text}</option>`).join(""));
  }

  function renderUploadLookups() {
    $("#fiBankAccount").html(optionList(state.bankAccounts, "id", bankAccountLabel, "-"));
    $("#fiReviewCategory").html(optionList(state.categories, "id", (item) => [item.code, item.name].filter(Boolean).join(" - "), "-"));
    $("#fiReviewCostCenter").html(optionList(state.costCenters, "id", (item) => [item.code, item.name].filter(Boolean).join(" - "), "-"));
    $("#fiReviewCompany").html(optionList(state.companies, "id", companyLabel, "-"));
    $("#fiReviewReceivable").html(optionList(state.receivables, "id", receivableLabel, "-"));
    $("#fiReviewPayable").html(optionList(state.payables, "id", payableLabel, "-"));

    const suggestionKinds = [
      "CREATE_MOVEMENT",
      "MATCH_RECEIVABLE_PAYMENT",
      "MATCH_PAYABLE_PAYMENT",
      "CREATE_RECEIVABLE",
      "CREATE_PAYABLE",
      "TRANSFER",
      "IGNORE",
    ];
    const suggestionStatuses = ["SUGGESTED", "APPROVED", "APPLIED", "IGNORED", "ERROR"];
    $("#fiReviewSuggestionKind").html(
      suggestionKinds.map((item) => `<option value="${item}">${enumLabel("financialImportSuggestionKind", item, item)}</option>`).join(""),
    );
    $("#fiReviewSuggestionStatus").html(
      suggestionStatuses.map((item) => `<option value="${item}">${enumLabel("financialImportSuggestionStatus", item, item)}</option>`).join(""),
    );
  }

  function renderJobs() {
    const rows = state.jobs || [];
    if (!rows.length) {
      $("#fiJobsList").html(`<div class="fi-empty">${labels.jobsEmpty || "Nenhuma importação"}</div>`);
      return;
    }

    $("#fiJobsList").html(
      rows
        .map((job) => {
          const active = String(job.id) === String(state.selectedJobId) ? "active" : "";
          const summary = job.parsed_summary || {};
          return `
            <div class="fi-job-item ${active}" data-job-id="${job.id}">
              <div class="fi-job-top">
                <div>
                  <strong>${job.source_name || "-"}</strong>
                  <small>${job.bank_account?.name || "-"}</small>
                </div>
                <span class="fi-pill">${enumLabel("financialImportJobStatus", job.status, job.status)}</span>
              </div>
              <div class="fi-job-meta" style="margin-top:10px;">
                <small>${enumLabel("financialImportSourceType", job.source_type, job.source_type)}</small>
                <small>${summary.total_lines || job.lines_total || 0} linhas</small>
              </div>
            </div>
          `;
        })
        .join(""),
    );
  }

  function filteredLines() {
    const job = currentJob();
    const wanted = String($("#fiStatusFilter").val() || "");
    const rows = job?.lines || [];
    if (!wanted) return rows;
    return rows.filter((line) => String(line.suggestion_status || "") === wanted);
  }

  function renderSummary() {
    const job = currentJob();
    const metrics = job?.metrics || {};
    $("#fiSummaryLines").text(metrics.total || 0);
    $("#fiSummaryCredits").text(toMoney(metrics.credit_amount || 0));
    $("#fiSummaryDebits").text(toMoney(metrics.debit_amount || 0));
    $("#fiSummaryApplied").text(metrics.applied || 0);
  }

  function renderLines() {
    const rows = filteredLines();
    if (!rows.length) {
      $("#fiLinesBody").html(`<tr><td colspan="7" class="fi-empty">${labels.emptyState || "Sem linhas"}</td></tr>`);
      return;
    }

    $("#fiLinesBody").html(
      rows
        .map((line) => {
          const active = String(line.id) === String(state.selectedLineId) ? "active" : "";
          const description = [line.description, line.counterparty_name].filter(Boolean).join(" • ");
          return `
            <tr class="${active}" data-line-id="${line.id}">
              <td>${toDateBr(line.transaction_date)}</td>
              <td>${enumLabel("financialMovementType", line.movement_type, line.movement_type)}</td>
              <td>${description || "-"}</td>
              <td>${toMoney(line.amount || 0)}</td>
              <td>${enumLabel("financialImportSuggestionKind", line.suggestion_kind, line.suggestion_kind)}</td>
              <td>${line.confidence_score || 0}</td>
              <td>${enumLabel("financialImportSuggestionStatus", line.suggestion_status, line.suggestion_status)}</td>
            </tr>
          `;
        })
        .join(""),
    );
  }

  function renderReview() {
    const line = currentLine();
    if (!line) {
      $("#fiReviewEmpty").show();
      $("#fiReviewPanel").hide();
      return;
    }
    $("#fiReviewEmpty").hide();
    $("#fiReviewPanel").show();
    $("#fiReviewSuggestionKind").val(line.suggestion_kind || "CREATE_MOVEMENT");
    $("#fiReviewSuggestionStatus").val(line.suggestion_status || "SUGGESTED");
    $("#fiReviewCategory").val(line.suggested_category_id || "");
    $("#fiReviewCostCenter").val(line.suggested_cost_center_id || "");
    $("#fiReviewCompany").val(line.suggested_company_id || "");
    $("#fiReviewReceivable").val(line.matched_receivable_id || "");
    $("#fiReviewPayable").val(line.matched_payable_id || "");
    $("#fiReviewNote").val(line.review_note || "");
    $("#fiReviewReasoning").text(line.ai_reasoning || "-");
  }

  async function loadLookups() {
    const [bankAccounts, categories, costCenters, companies, receivables, payables] = await Promise.all([
      api("/api/finance/bank-accounts?is_active=true"),
      api("/api/finance/categories"),
      api("/api/finance/cost-centers"),
      api("/api/companies"),
      api("/api/finance/receivables?status=OPEN"),
      api("/api/finance/payables?status=OPEN"),
    ]);
    state.bankAccounts = Array.isArray(bankAccounts) ? bankAccounts : [];
    state.categories = Array.isArray(categories) ? categories : [];
    state.costCenters = Array.isArray(costCenters) ? costCenters : [];
    state.companies = Array.isArray(companies) ? companies : [];
    state.receivables = Array.isArray(receivables) ? receivables : [];
    state.payables = Array.isArray(payables) ? payables : [];
    renderUploadLookups();
  }

  async function loadJobs(selectId) {
    const jobs = await api("/api/finance/import-jobs");
    state.jobs = Array.isArray(jobs) ? jobs : [];
    if (selectId) state.selectedJobId = selectId;
    else if (!state.selectedJobId && state.jobs[0]?.id) state.selectedJobId = state.jobs[0].id;
    renderJobs();
    if (state.selectedJobId) await loadJobDetail(state.selectedJobId);
    else {
      renderSummary();
      renderLines();
      renderReview();
    }
  }

  async function loadJobDetail(jobId) {
    if (!jobId) return;
    const job = await api(`/api/finance/import-jobs/${encodeURIComponent(jobId)}`);
    const idx = state.jobs.findIndex((item) => String(item.id) === String(jobId));
    if (idx >= 0) state.jobs[idx] = Object.assign({}, state.jobs[idx], job);
    else state.jobs.unshift(job);
    state.selectedJobId = jobId;
    renderJobs();
    if (!(job.lines || []).some((line) => String(line.id) === String(state.selectedLineId))) {
      state.selectedLineId = job.lines?.[0]?.id || null;
    }
    renderSummary();
    renderLines();
    renderReview();
  }

  async function uploadImport() {
    const bankAccountId = String($("#fiBankAccount").val() || "");
    const file = $("#fiFile")[0]?.files?.[0];
    if (!bankAccountId) return notify(labels.noBankAccount || "Selecione a conta.");
    if (!file) return notify(labels.noFile || "Selecione um arquivo.");

    const form = new FormData();
    form.append("bank_account_id", bankAccountId);
    form.append("file", file);

    const response = await fetch("/api/finance/import-jobs/upload", {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const text = await response.text().catch(() => "");
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }
    if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);

    $("#fiFile").val("");
    notify(labels.uploadSuccess || "Importado.");
    await loadJobs(data?.id || data?.job?.id || data?.id);
    if (data?.id) await loadJobDetail(data.id);
    if (data?.job?.id) await loadJobDetail(data.job.id);
  }

  async function saveReview(forceApproved) {
    const line = currentLine();
    const job = currentJob();
    if (!line || !job) return notify(labels.noLine || "Selecione uma linha.");

    const payload = {
      suggestion_kind: $("#fiReviewSuggestionKind").val() || null,
      suggestion_status: forceApproved ? "APPROVED" : $("#fiReviewSuggestionStatus").val() || null,
      suggested_category_id: $("#fiReviewCategory").val() || null,
      suggested_cost_center_id: $("#fiReviewCostCenter").val() || null,
      suggested_company_id: $("#fiReviewCompany").val() || null,
      matched_receivable_id: $("#fiReviewReceivable").val() || null,
      matched_payable_id: $("#fiReviewPayable").val() || null,
      review_note: $("#fiReviewNote").val() || null,
    };
    await api(`/api/finance/import-jobs/${encodeURIComponent(job.id)}/lines/${encodeURIComponent(line.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
    });
    notify(labels.reviewSaved || "Revisão salva.");
    await loadJobDetail(job.id);
  }

  async function reanalyzeJob() {
    const job = currentJob();
    if (!job) return;
    await api(`/api/finance/import-jobs/${encodeURIComponent(job.id)}/reanalyze`, { method: "POST" });
    await loadJobDetail(job.id);
  }

  async function applyJob(applyApprovedOnly) {
    const job = currentJob();
    if (!job) return;
    const result = await api(`/api/finance/import-jobs/${encodeURIComponent(job.id)}/apply`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ apply_approved_only: applyApprovedOnly }),
    });
    notify((result?.errors || []).length ? `${labels.applySuccess || "Aplicado."} ${(result.errors || []).length} erro(s).` : (labels.applySuccess || "Aplicado."));
    await loadJobDetail(job.id);
  }

  $("#fiJobsList").on("click", ".fi-job-item", function () {
    const jobId = $(this).data("job-id");
    loadJobDetail(jobId);
  });

  $("#fiLinesBody").on("click", "tr[data-line-id]", function () {
    state.selectedLineId = $(this).data("line-id");
    renderLines();
    renderReview();
  });

  $("#fiStatusFilter").on("change", function () {
    renderLines();
  });

  $("#btnFinanceImportUpload").on("click", function () {
    uploadImport().catch((error) => notify(error?.message || "Erro ao importar."));
  });
  $("#btnFinanceImportRefresh").on("click", function () {
    loadJobs(state.selectedJobId).catch((error) => notify(error?.message || "Erro ao atualizar."));
  });
  $("#btnFinanceImportReanalyze").on("click", function () {
    reanalyzeJob().catch((error) => notify(error?.message || "Erro ao reanalisar."));
  });
  $("#btnFinanceImportSaveReview").on("click", function () {
    saveReview(false).catch((error) => notify(error?.message || "Erro ao salvar."));
  });
  $("#btnFinanceImportApproveLine").on("click", function () {
    saveReview(true).catch((error) => notify(error?.message || "Erro ao aprovar."));
  });
  $("#btnFinanceImportApplyApproved").on("click", function () {
    applyJob(true).catch((error) => notify(error?.message || "Erro ao aplicar."));
  });
  $("#btnFinanceImportApplyAll").on("click", function () {
    applyJob(false).catch((error) => notify(error?.message || "Erro ao aplicar tudo."));
  });

  renderFilters();
  loadLookups()
    .then(() => loadJobs())
    .catch((error) => notify(error?.message || "Erro ao carregar importações."));
})();
