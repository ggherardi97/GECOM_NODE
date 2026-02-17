(function () {
  function t(key, fallback) {
    try {
      if (typeof window.t === "function") return window.t(key, { defaultValue: fallback || key });
    } catch {}
    return fallback || key;
  }

  function esc(v) {
    if (v == null) return "";
    return String(v)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showMessage(selector, message, type) {
    const $el = $(selector);
    if (!$el.length) return;
    if (!message) {
      $el.hide().text("").removeClass("alert-danger alert-warning alert-success alert-info");
      return;
    }
    $el
      .removeClass("alert-danger alert-warning alert-success alert-info")
      .addClass(`alert alert-${type || "info"}`)
      .text(message)
      .show();
  }

  function unwrapWidgets(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.widgets)) return payload.widgets;
    if (Array.isArray(payload?.dashboardSpec?.widgets)) return payload.dashboardSpec.widgets;
    if (Array.isArray(payload?.data?.widgets)) return payload.data.widgets;
    return [];
  }

  function widgetType(widget) {
    return String(widget?.type || widget?.widget_type || "").toLowerCase();
  }

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  function renderKpi($target, widget) {
    const title = esc(widget?.title || t("page.ai.widgets.kpi", "Indicador"));
    const rawValue = widget?.value ?? widget?.kpi_value ?? 0;
    const suffix = esc(widget?.suffix || "");
    $target.append(`
      <div class="ai-widget">
        <div class="ai-widget-title">${title}</div>
        <div class="ai-kpi-value">${esc(rawValue)} ${suffix}</div>
      </div>
    `);
  }

  function normalizeChartData(widget) {
    const labels = Array.isArray(widget?.labels) ? widget.labels : (Array.isArray(widget?.data?.labels) ? widget.data.labels : []);
    const directValues = Array.isArray(widget?.values) ? widget.values : (Array.isArray(widget?.data?.values) ? widget.data.values : []);
    const series = Array.isArray(widget?.series) ? widget.series : (Array.isArray(widget?.data?.series) ? widget.data.series : []);
    const datasets = Array.isArray(widget?.datasets) ? widget.datasets : (Array.isArray(widget?.data?.datasets) ? widget.data.datasets : []);

    if (datasets.length) return { labels, datasets };
    if (series.length) {
      return {
        labels,
        datasets: series.map((s, i) => ({
          label: s?.name || s?.label || `${t("page.ai.widgets.series", "Série")} ${i + 1}`,
          data: Array.isArray(s?.data) ? s.data : [],
        })),
      };
    }
    return {
      labels,
      datasets: [{ label: widget?.title || "Dados", data: directValues }],
    };
  }

  function renderChart($target, widget, chartType) {
    const title = esc(widget?.title || t("page.ai.widgets.chart", "Gráfico"));
    const chartId = `aiChart_${Math.random().toString(36).slice(2)}`;
    $target.append(`
      <div class="ai-widget">
        <div class="ai-widget-title">${title}</div>
        <canvas id="${chartId}" height="130"></canvas>
      </div>
    `);

    if (typeof window.Chart !== "function") return;
    const ctx = document.getElementById(chartId);
    if (!ctx) return;

    const normalized = normalizeChartData(widget);
    const palettes = ["#1ab394", "#1c84c6", "#f8ac59", "#ed5565", "#23c6c8", "#f7a54a"];
    const datasets = normalized.datasets.map((ds, idx) => ({
      label: ds.label || `${t("page.ai.widgets.series", "Série")} ${idx + 1}`,
      data: Array.isArray(ds.data) ? ds.data.map(toNumber) : [],
      backgroundColor: chartType === "line" ? "transparent" : palettes[idx % palettes.length],
      borderColor: palettes[idx % palettes.length],
      borderWidth: 2,
      fill: chartType === "line" ? false : true,
    }));

    new window.Chart(ctx, {
      type: chartType,
      data: {
        labels: normalized.labels || [],
        datasets,
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        legend: { display: true },
      },
    });
  }

  function renderTopN($target, widget) {
    const title = esc(widget?.title || t("page.ai.widgets.topN", "Top N"));
    const items = Array.isArray(widget?.items) ? widget.items : (Array.isArray(widget?.data?.items) ? widget.data.items : []);

    const rows = items.map((item) => {
      const label = esc(item?.label || item?.name || item?.title || "-");
      const value = esc(item?.value ?? item?.count ?? "");
      return `<li><strong>${label}</strong> <span class="pull-right">${value}</span></li>`;
    }).join("");

    $target.append(`
      <div class="ai-widget">
        <div class="ai-widget-title">${title}</div>
        <ul style="margin:0; padding-left:18px;">${rows || `<li>${esc(t("page.ai.empty", "Sem dados."))}</li>`}</ul>
      </div>
    `);
  }

  function renderWidget($target, widget) {
    const type = widgetType(widget);
    if (type === "kpi") return renderKpi($target, widget);
    if (type === "timeseries" || type === "time_series" || type === "timeseries" || type === "line") return renderChart($target, widget, "line");
    if (type === "bar") return renderChart($target, widget, "bar");
    if (type === "pie" || type === "donut") return renderChart($target, widget, "pie");
    if (type === "topn" || type === "top_n" || type === "list") return renderTopN($target, widget);
    renderKpi($target, widget);
  }

  async function loadDashboardFromPrompt() {
    const api = window.GECOM_AI_API;
    const prompt = String($("#aiDashboardPrompt").val() || "").trim();
    if (!prompt) {
      showMessage("#aiDashboardMessage", t("page.ai.dashboard.promptRequired", "Informe um prompt para gerar o dashboard."), "warning");
      return;
    }
    if (!api || typeof api.getAiDashboard !== "function") {
      showMessage("#aiDashboardMessage", t("page.ai.errors.moduleMissing", "Módulo de IA não carregado."), "danger");
      return;
    }

    $("#aiDashboardGenerateBtn").prop("disabled", true);
    showMessage("#aiDashboardMessage", t("page.ai.loading", "Carregando..."), "info");
    $("#aiDashboardWidgets").empty().append(`<div class="ai-loading">${esc(t("page.ai.loading", "Carregando..."))}</div>`);

    try {
      const data = await api.getAiDashboard(prompt);
      const widgets = unwrapWidgets(data);
      $("#aiDashboardWidgets").empty();

      if (!widgets.length) {
        showMessage("#aiDashboardMessage", t("page.ai.dashboard.noWidgets", "A IA não retornou widgets para este prompt."), "warning");
        return;
      }

      widgets.forEach((widget) => renderWidget($("#aiDashboardWidgets"), widget));
      showMessage("#aiDashboardMessage", t("page.ai.dashboard.success", "Dashboard gerado com sucesso."), "success");
    } catch (error) {
      const status = Number(error?.status || 0);
      if (status === 401) showMessage("#aiDashboardMessage", t("page.ai.errors.unauthorized", "Sua sessão expirou. Faça login novamente."), "danger");
      else if (status === 403) showMessage("#aiDashboardMessage", t("page.ai.errors.forbidden", "Você não tem permissão para usar IA."), "danger");
      else if (status === 400) showMessage("#aiDashboardMessage", error?.message || t("page.ai.errors.badRequest", "Prompt inválido para IA."), "danger");
      else showMessage("#aiDashboardMessage", error?.message || t("page.ai.errors.generic", "Erro ao consultar a IA."), "danger");
      $("#aiDashboardWidgets").empty();
    } finally {
      $("#aiDashboardGenerateBtn").prop("disabled", false);
    }
  }

  function bindEvents() {
    $("#aiDashboardGenerateBtn").on("click", loadDashboardFromPrompt);
    $("#aiDashboardPrompt").on("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        loadDashboardFromPrompt();
      }
    });

    $(document).on("click", ".js-ai-suggestion", function () {
      const prompt = String($(this).data("prompt") || "").trim();
      if (!prompt) return;
      $("#aiDashboardPrompt").val(prompt);
      loadDashboardFromPrompt();
    });
  }

  $(function () {
    $("#pageName,#subpageName").text(t("page.ai.title", "IA"));

    if (window.__features && window.__features.enableAI === false) {
      showMessage("#aiDashboardMessage", t("page.ai.disabled", "A funcionalidade de IA está desabilitada."), "warning");
      $("#aiDashboardGenerateBtn,#aiDashboardPrompt").prop("disabled", true);
      return;
    }

    bindEvents();
  });
})();
