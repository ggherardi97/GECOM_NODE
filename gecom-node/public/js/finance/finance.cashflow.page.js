(function () {
  const { tt, waitForI18nReady, esc, toMoney, normalizeArray } = window.FinanceResources || {};
  const state = {
    trendChart: null,
    methodsChart: null,
  };

  function api(url, opts) {
    return fetch(url, Object.assign({ credentials: "include" }, opts || {}))
      .then(async (resp) => {
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

  function renderDays(days) {
    const html = (days || [])
      .map((day) => {
        return `<tr>
          <td>${esc(day.date)}</td>
          <td class="text-right">${esc(toMoney(day.incoming))}</td>
          <td class="text-right">${esc(toMoney(day.outgoing))}</td>
          <td class="text-right">${esc(toMoney(day.net))}</td>
          <td class="text-right"><strong>${esc(toMoney(day.projected_balance))}</strong></td>
        </tr>`;
      })
      .join("");

    $("#financeCashFlowBody").html(
      html || `<tr><td colspan="5" class="cashflow-empty-row">${esc(tt("page.finance.common.empty", "Nenhum registro encontrado."))}</td></tr>`,
    );
  }

  function shortDate(value) {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
  }

  function paymentMethodLabel(method) {
    const key = String(method || "").trim().toUpperCase();
    const map = {
      PIX: tt("page.finance.paymentMethod.pix", "PIX"),
      CREDIT_CARD: tt("page.finance.paymentMethod.creditCard", "Cartao de credito"),
      DEBIT_CARD: tt("page.finance.paymentMethod.debitCard", "Cartao de debito"),
      BANK_TRANSFER: tt("page.finance.paymentMethod.bankTransfer", "Transferencia bancaria"),
      BOLETO: tt("page.finance.paymentMethod.boleto", "Boleto"),
      CASH: tt("page.finance.paymentMethod.cash", "Dinheiro"),
      CHECK: tt("page.finance.paymentMethod.check", "Cheque"),
      OTHER: tt("page.finance.paymentMethod.other", "Outros"),
    };
    return map[key] || key || tt("page.finance.paymentMethod.other", "Outros");
  }

  function chartOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 260 },
      legend: { display: true, position: "bottom" },
    };
  }

  function renderTrendChart(days) {
    const topDays = (days || []).slice(0, 10);
    const labels = topDays.map((day) => shortDate(day.date));
    const projected = topDays.map((day) => Number(day.projected_balance || 0));
    const incoming = topDays.map((day) => Number(day.incoming || 0));
    const outgoing = topDays.map((day) => Number(day.outgoing || 0));

    const $canvas = $("#cfTrendChart");
    if (!$canvas.length || typeof Chart === "undefined") return;
    if (state.trendChart) state.trendChart.destroy();

    state.trendChart = new Chart($canvas[0].getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: tt("page.finance.cashFlow.projectedBalance", "Saldo projetado"),
            data: projected,
            borderColor: "#1ab394",
            backgroundColor: "rgba(26,179,148,0.08)",
            borderWidth: 2,
            fill: true,
            tension: 0.25,
          },
          {
            label: tt("page.finance.cashFlow.incoming", "Entradas"),
            data: incoming,
            borderColor: "#1c84c6",
            backgroundColor: "rgba(28,132,198,0.06)",
            borderWidth: 2,
            fill: false,
            tension: 0.25,
          },
          {
            label: tt("page.finance.cashFlow.outgoing", "Saidas"),
            data: outgoing,
            borderColor: "#ed5565",
            backgroundColor: "rgba(237,85,101,0.06)",
            borderWidth: 2,
            fill: false,
            tension: 0.25,
          },
        ],
      },
      options: Object.assign(chartOptions(), {
        scales: {
          yAxes: [
            {
              ticks: {
                callback: function (value) {
                  return toMoney(value);
                },
              },
            },
          ],
        },
        tooltips: {
          callbacks: {
            label: function (tooltipItem, data) {
              const dataset = data.datasets?.[tooltipItem.datasetIndex];
              return `${dataset?.label || ""}: ${toMoney(tooltipItem.yLabel)}`;
            },
          },
        },
      }),
    });
  }

  function renderMethodsChart(items) {
    const list = (items || []).slice(0, 8);
    const labels = list.map((item) => paymentMethodLabel(item.method));
    const values = list.map((item) => Number(item.count || 0));
    const hasData = values.some((v) => v > 0);

    const $canvas = $("#cfMethodsChart");
    if (!$canvas.length || typeof Chart === "undefined") return;
    if (state.methodsChart) state.methodsChart.destroy();

    const palette = ["#1c84c6", "#1ab394", "#f8ac59", "#ed5565", "#23c6c8", "#b5b8cf", "#f7a35c", "#8085e9"];
    state.methodsChart = new Chart($canvas[0].getContext("2d"), {
      type: "pie",
      data: {
        labels: hasData ? labels : [tt("page.finance.cashFlow.noPaymentData", "Sem dados")],
        datasets: [
          {
            data: hasData ? values : [1],
            backgroundColor: hasData ? palette.slice(0, values.length) : ["#d9dee4"],
            borderWidth: 0,
          },
        ],
      },
      options: chartOptions(),
    });

    const listHtml = hasData
      ? list
          .map((item) => `<li><span>${esc(paymentMethodLabel(item.method))}</span><strong>${esc(String(item.count || 0))}</strong></li>`)
          .join("")
      : `<li><span>${esc(tt("page.finance.cashFlow.noPaymentData", "Sem dados"))}</span><strong>0</strong></li>`;
    $("#cfMethodsList").html(listHtml);
  }

  function inRange(dateValue, from, to) {
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;
    const point = date.getTime();

    if (from) {
      const start = new Date(`${from}T00:00:00`).getTime();
      if (!Number.isNaN(start) && point < start) return false;
    }
    if (to) {
      const end = new Date(`${to}T23:59:59`).getTime();
      if (!Number.isNaN(end) && point > end) return false;
    }
    return true;
  }

  async function fetchDetailsInBatches(basePath, ids, batchSize) {
    const out = [];
    const safeBatch = Math.max(1, Number(batchSize || 10));
    for (let i = 0; i < ids.length; i += safeBatch) {
      const chunk = ids.slice(i, i + safeBatch);
      const rows = await Promise.all(
        chunk.map((id) =>
          api(`${basePath}/${encodeURIComponent(id)}`).catch(() => null),
        ),
      );
      out.push(...rows.filter(Boolean));
    }
    return out;
  }

  function countMethodsFromDetails(rows, from, to, map) {
    (rows || []).forEach((row) => {
      const payments = normalizeArray ? normalizeArray(row?.payments) : Array.isArray(row?.payments) ? row.payments : [];
      payments.forEach((payment) => {
        if (!inRange(payment?.payment_date, from, to)) return;
        const key = String(payment?.payment_method || "OTHER").toUpperCase();
        map[key] = (map[key] || 0) + 1;
      });
    });
  }

  async function loadPaymentMethods(from, to) {
    const empty = [];
    try {
      const [receivablesRaw, payablesRaw] = await Promise.all([api("/api/finance/receivables"), api("/api/finance/payables")]);
      const receivables = normalizeArray ? normalizeArray(receivablesRaw) : Array.isArray(receivablesRaw) ? receivablesRaw : [];
      const payables = normalizeArray ? normalizeArray(payablesRaw) : Array.isArray(payablesRaw) ? payablesRaw : [];
      const map = {};
      const receivableIds = receivables
        .filter((row) => Number(row?._count?.payments || 0) > 0 && row?.id)
        .map((row) => String(row.id));
      const payableIds = payables
        .filter((row) => Number(row?._count?.payments || 0) > 0 && row?.id)
        .map((row) => String(row.id));

      const [receivableDetails, payableDetails] = await Promise.all([
        fetchDetailsInBatches("/api/finance/receivables", receivableIds, 8),
        fetchDetailsInBatches("/api/finance/payables", payableIds, 8),
      ]);
      countMethodsFromDetails(receivableDetails, from, to, map);
      countMethodsFromDetails(payableDetails, from, to, map);

      return Object.keys(map)
        .map((key) => ({ method: key, count: map[key] }))
        .sort((a, b) => b.count - a.count);
    } catch {
      return empty;
    }
  }

  function renderCharts(projection, methods) {
    renderTrendChart(projection?.days || []);
    renderMethodsChart(methods || []);
  }

  async function loadProjection() {
    try {
      const from = String($("#cfFrom").val() || "").trim();
      const to = String($("#cfTo").val() || "").trim();
      const qs = new URLSearchParams();
      if (from) qs.set("from", from);
      if (to) qs.set("to", to);
      const [data, methods] = await Promise.all([
        api(`/api/finance/cash-flow/projection?${qs.toString()}`),
        loadPaymentMethods(from, to),
      ]);

      $("#cfOpening").text(toMoney(data?.opening_balance));
      $("#cfIncoming").text(toMoney(data?.total_incoming));
      $("#cfOutgoing").text(toMoney(data?.total_outgoing));
      $("#cfClosing").text(toMoney(data?.closing_balance));
      renderDays(data?.days || []);
      renderCharts(data, methods);
    } catch (e) {
      alert(e?.message || "Erro ao carregar fluxo de caixa");
    }
  }

  $("#btnCashFlowRefresh").on("click", loadProjection);

  $(document).ready(async function () {
    if (typeof waitForI18nReady === "function") await waitForI18nReady();
    $("#masterHeader").hide();
    $("#pageName").text(tt("page.finance.cashFlow.title", "Fluxo de caixa projetado"));
    $("#subpageName")
      .text(tt("page.finance.cashFlow.title", "Fluxo de caixa projetado"))
      .attr("href", "/FinanceCashFlow");

    const today = new Date();
    const from = today.toISOString().slice(0, 10);
    const toDate = new Date(today.getTime());
    toDate.setDate(toDate.getDate() + 60);
    const to = toDate.toISOString().slice(0, 10);
    $("#cfFrom").val(from);
    $("#cfTo").val(to);

    await loadProjection();
  });
})();
