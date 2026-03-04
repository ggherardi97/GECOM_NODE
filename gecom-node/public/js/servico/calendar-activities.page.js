(function () {
  const api = window.ServiceApi;
  if (!api) return;

  const state = {
    definitions: [],
    byType: new Map(),
    selectedTypes: new Set(),
    lookupCache: new Map(),
  };

  function esc(value) {
    if (value == null) return "";
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function listToArray(data) {
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.items)) return data.items;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data?.rows)) return data.rows;
    return [];
  }

  function showFormError(message) {
    const el = $("#activityFormError");
    el.removeClass("is-open");
    if (!message) return;
    el.text(String(message));
    el.addClass("is-open");
  }

  function handleError(err, fallback) {
    console.error(err);
    if (err?.status === 401 || err?.status === 403) {
      window.location.href = "/";
      return;
    }
    showFormError(err?.message || fallback || "Falha ao processar a operação.");
  }

  function setPageHeader() {
    try {
      $("#pageName").text("Calendário de Atividades");
      $("#subpageName").text("Serviço");
      $("#subpageName").attr("href", "/servico/agenda");
      $("#path").hide();
      $("#subpath").hide();
    } catch {
      // ignore
    }
  }

  function openSide() {
    $("#activitySideOverlay").addClass("is-open");
    $("#activitySidePanel").addClass("is-open").attr("aria-hidden", "false");
  }

  function closeSide() {
    $("#activitySideOverlay").removeClass("is-open");
    $("#activitySidePanel").removeClass("is-open").attr("aria-hidden", "true");
    $("#activityTypeInput").val("");
    $("#activityFormFields").empty();
    showFormError("");
  }

  function renderFilters() {
    const host = $("#activityFilters");
    host.empty();

    state.definitions.forEach((def) => {
      const checked = state.selectedTypes.has(def.type) ? "checked" : "";
      host.append(`
        <label class="activity-filter-item" data-type="${esc(def.type)}">
          <input type="checkbox" class="js-activity-filter" data-type="${esc(def.type)}" ${checked} />
          <span class="activity-filter-color" style="background:${esc(def.color)};"></span>
          <span class="activity-filter-label">${esc(def.label)}</span>
        </label>
      `);
    });
  }

  function renderAddMenu() {
    const menu = $("#calendarAddMenu");
    menu.empty();

    state.definitions.forEach((def) => {
      menu.append(`
        <li>
          <a href="#" class="js-add-activity" data-type="${esc(def.type)}">
            <i class="fa fa-circle" style="color:${esc(def.color)};"></i>
            ${esc(def.label)}
          </a>
        </li>
      `);
    });

    menu.find(".js-add-activity").on("click", function (ev) {
      ev.preventDefault();
      const type = String($(this).data("type") || "").trim();
      if (!type) return;
      openCreateForm(type);
    });
  }

  function renderField(field) {
    const required = field.required ? '<span style="color:#ed5565;"> *</span>' : "";
    const dataReq = field.required ? 'data-required="1"' : 'data-required="0"';
    const colClass = field.type === "textarea" ? "col-md-12" : "col-md-6";

    if (field.type === "textarea") {
      return `
        <div class="${colClass}">
          <div class="form-group">
            <label for="af_${esc(field.name)}">${esc(field.label)}${required}</label>
            <textarea id="af_${esc(field.name)}" class="form-control" rows="3" data-name="${esc(field.name)}" data-type="${esc(field.type)}" ${dataReq}></textarea>
          </div>
        </div>
      `;
    }

    if (field.type === "checkbox") {
      return `
        <div class="${colClass}">
          <div class="form-group">
            <label style="font-weight:normal; margin-top:24px;">
              <input id="af_${esc(field.name)}" type="checkbox" data-name="${esc(field.name)}" data-type="${esc(field.type)}" ${dataReq} />
              ${esc(field.label)}
            </label>
          </div>
        </div>
      `;
    }

    if (field.type === "select") {
      const options = Array.isArray(field.options)
        ? field.options
            .map((opt) => `<option value="${esc(opt.value)}">${esc(opt.label || opt.value)}</option>`)
            .join("")
        : "";

      return `
        <div class="${colClass}">
          <div class="form-group">
            <label for="af_${esc(field.name)}">${esc(field.label)}${required}</label>
            <select id="af_${esc(field.name)}" class="form-control" data-name="${esc(field.name)}" data-type="${esc(field.type)}" ${dataReq}>
              <option value="">Selecione...</option>
              ${options}
            </select>
          </div>
        </div>
      `;
    }

    if (field.type === "lookup") {
      const depends = field.depends_on ? `data-depends-on="${esc(field.depends_on)}"` : "";
      return `
        <div class="${colClass}">
          <div class="form-group">
            <label for="af_${esc(field.name)}_label">${esc(field.label)}${required}</label>
            <div class="activity-lookup-wrap">
              <input
                id="af_${esc(field.name)}_label"
                type="text"
                class="form-control js-lookup-label"
                autocomplete="off"
                placeholder="Clique para listar ou digite para buscar"
                data-name="${esc(field.name)}"
                data-type="lookup"
                data-lookup="${esc(field.lookup || "")}" ${depends}
                ${dataReq}
              />
              <input id="af_${esc(field.name)}" type="hidden" data-hidden-for="${esc(field.name)}" />
            </div>
          </div>
        </div>
      `;
    }

    const inputType = field.type === "datetime-local" || field.type === "date" || field.type === "time" || field.type === "number"
      ? field.type
      : "text";

    return `
      <div class="${colClass}">
        <div class="form-group">
          <label for="af_${esc(field.name)}">${esc(field.label)}${required}</label>
          <input id="af_${esc(field.name)}" class="form-control" type="${esc(inputType)}" data-name="${esc(field.name)}" data-type="${esc(field.type)}" ${dataReq} />
        </div>
      </div>
    `;
  }

  function openCreateForm(type) {
    const def = state.byType.get(type);
    if (!def) return;

    $("#activityTypeInput").val(def.type);
    $("#activitySideTitle").text(`Nova atividade - ${def.label}`);

    const html = (def.fields || []).map((field) => renderField(field)).join("");
    $("#activityFormFields").html(html);
    showFormError("");

    bindLookupFields(def);
    openSide();
  }

  function getDependsValue(input) {
    const dependsOn = String($(input).data("depends-on") || "").trim();
    if (!dependsOn) return "";

    const depInput = $("#af_" + dependsOn);
    if (!depInput.length) return "";
    return String(depInput.val() || "").trim();
  }

  async function fetchLookupRows(lookup, query, relatedTable) {
    const key = `${lookup}::${query || ""}::${relatedTable || ""}`;
    if (state.lookupCache.has(key)) return state.lookupCache.get(key);

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    params.set("limit", "20");
    if (relatedTable) params.set("related_table", relatedTable);

    const data = await api.getJson(`/api/calendar-activities/lookups/${encodeURIComponent(lookup)}?${params.toString()}`);
    const rows = listToArray(data);
    state.lookupCache.set(key, rows);
    return rows;
  }

  function bindLookupFields(def) {
    (def.fields || [])
      .filter((field) => field.type === "lookup")
      .forEach((field) => {
        const $labelInput = $("#af_" + field.name + "_label");
        const $hidden = $("#af_" + field.name);
        if (!$labelInput.length || !$hidden.length) return;

        try { $labelInput.typeahead("destroy"); } catch { /* ignore */ }

        $labelInput.typeahead({
          minLength: 0,
          items: 12,
          autoSelect: false,
          source: function (query, process) {
            const relatedTable = getDependsValue($labelInput);
            if (field.lookup === "event_related" && !relatedTable) {
              process([]);
              return;
            }

            fetchLookupRows(field.lookup, String(query || "").trim(), relatedTable)
              .then((rows) => process(rows))
              .catch(() => process([]));
          },
          displayText: function (item) {
            return String(item?.label || item?.id || "");
          },
          afterSelect: function (item) {
            $hidden.val(String(item?.id || ""));
            $labelInput.val(String(item?.label || item?.id || ""));
          },
        });

        $labelInput.off("input.lookup").on("input.lookup", function () {
          $hidden.val("");
        });

        $labelInput.off("focus.lookup").on("focus.lookup", function () {
          if (!String($(this).val() || "").trim()) {
            try { $(this).typeahead("lookup"); } catch { /* ignore */ }
          }
        });

        if (field.depends_on) {
          $("#af_" + field.depends_on)
            .off("change.lookupdep_" + field.name)
            .on("change.lookupdep_" + field.name, function () {
              $hidden.val("");
              $labelInput.val("");
            });
        }
      });
  }

  function normalizePayloadValue(type, raw, checked) {
    if (type === "checkbox") return !!checked;

    const value = String(raw == null ? "" : raw).trim();
    if (!value) return null;

    if (type === "number") {
      const n = Number(value.replace(",", "."));
      return Number.isFinite(n) ? n : null;
    }

    if (type === "datetime-local") {
      const dt = new Date(value);
      return Number.isNaN(dt.getTime()) ? value : dt.toISOString();
    }

    return value;
  }

  function toDateObject(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "object" && typeof value.toDate === "function") {
      const d = value.toDate();
      return d instanceof Date ? d : null;
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  function formatDateTime(value) {
    const d = toDateObject(value);
    if (!d) return "-";
    return d.toLocaleString("pt-BR");
  }

  function formatDate(value) {
    const d = toDateObject(value);
    if (!d) return "-";
    return d.toLocaleDateString("pt-BR");
  }

  function firstNonEmpty() {
    for (let i = 0; i < arguments.length; i += 1) {
      const value = arguments[i];
      if (value == null) continue;
      const text = String(value).trim();
      if (text) return text;
    }
    return "";
  }

  function formatEventFieldValue(value) {
    if (value == null || value === "") return "-";
    if (Array.isArray(value)) {
      const list = value.map((item) => String(item == null ? "" : item).trim()).filter(Boolean);
      return list.length ? list.join(", ") : "-";
    }
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  function openEventDetails(event) {
    const source = event?.source_data && typeof event.source_data === "object" ? event.source_data : {};
    const related = firstNonEmpty(
      source.related_name,
      source.company_name,
      source.contract_name,
      source.resource_name,
      source.employee_name,
      source.incident_title,
    );
    const status = firstNonEmpty(source.status, source.finished === true ? "Concluído" : "");
    const details = [
      { label: "Tipo", value: firstNonEmpty(event?.activity_label, event?.activity_type) || "-" },
      { label: "Título", value: firstNonEmpty(event?.title, source.title) || "-" },
      { label: "Início", value: formatDateTime(event?.start || source.start || source.start_at || source.start_datetime) },
      { label: "Fim", value: event?.allDay ? formatDate(event?.end) : formatDateTime(event?.end || source.end || source.end_at || source.end_datetime) },
      { label: "Dia inteiro", value: event?.allDay ? "Sim" : "Não" },
      { label: "Status", value: status || "-" },
      { label: "Relacionado", value: related || "-" },
      { label: "Descrição", value: firstNonEmpty(source.description, source.notes, source.reason) || "-" },
    ];

    $("#activityEventDetailTitle").text(firstNonEmpty(event?.title, source.title, "Detalhes do evento"));

    const listHtml = details
      .map((item) => (
        `<tr>
          <th style="width:160px;">${esc(item.label)}</th>
          <td>${esc(formatEventFieldValue(item.value))}</td>
        </tr>`
      ))
      .join("");

    $("#activityEventDetailRows").html(listHtml);

    const raw = source && Object.keys(source).length ? JSON.stringify(source, null, 2) : "";
    if (raw) {
      $("#activityEventRawBox").show();
      $("#activityEventRaw").text(raw);
    } else {
      $("#activityEventRawBox").hide();
      $("#activityEventRaw").text("");
    }

    $("#activityEventDetailModal").modal("show");
  }

  function buildPayload(def) {
    const payload = {};

    for (const field of def.fields || []) {
      if (field.type === "lookup") {
        const idValue = String($("#af_" + field.name).val() || "").trim();
        if (!idValue && field.required) {
          throw new Error(`Campo obrigatório: ${field.label}`);
        }
        if (idValue) payload[field.name] = idValue;
        continue;
      }

      const $input = $("#af_" + field.name);
      if (!$input.length) continue;

      const value = normalizePayloadValue(field.type, $input.val(), $input.is(":checked"));
      if ((value === null || value === "") && field.required) {
        throw new Error(`Campo obrigatório: ${field.label}`);
      }
      if (value !== null && value !== "") payload[field.name] = value;
    }

    return payload;
  }

  function getSelectedTypesCsv() {
    return Array.from(state.selectedTypes).join(",");
  }

  async function fetchCalendarEvents(startDate, endDate) {
    if (!state.selectedTypes.size) return [];

    const params = new URLSearchParams();
    params.set("start", startDate.toISOString());
    params.set("end", endDate.toISOString());
    params.set("types", getSelectedTypesCsv());

    const data = await api.getJson(`/api/calendar-activities/events?${params.toString()}`);
    const rows = listToArray(data);

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      start: row.start,
      end: row.end || null,
      allDay: !!row.allDay,
      color: row.color,
      textColor: row.textColor || "#fff",
      activity_type: row.activity_type,
      activity_label: row.activity_label,
      source_data: row.source_data || null,
    }));
  }

  function refetchCalendar() {
    const cal = $("#calendarActivities");
    if (!cal.data("fullCalendar")) return;
    cal.fullCalendar("refetchEvents");
  }

  function initCalendar() {
    const cal = $("#calendarActivities");
    if (cal.data("fullCalendar")) {
      cal.fullCalendar("destroy");
    }

    cal.fullCalendar({
      header: {
        left: "prev,next today",
        center: "title",
        right: "month,agendaWeek,agendaDay",
      },
      firstDay: 1,
      monthNames: [
        "Janeiro",
        "Fevereiro",
        "Março",
        "Abril",
        "Maio",
        "Junho",
        "Julho",
        "Agosto",
        "Setembro",
        "Outubro",
        "Novembro",
        "Dezembro",
      ],
      monthNamesShort: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"],
      dayNames: ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"],
      dayNamesShort: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
      allDayText: "Dia inteiro",
      eventLimitText: "mais",
      timeFormat: "H:mm",
      axisFormat: "H:mm",
      buttonText: {
        today: "Hoje",
        month: "Mês",
        week: "Semana",
        day: "Dia",
      },
      height: "auto",
      editable: false,
      events: function (start, end, timezone, callback) {
        fetchCalendarEvents(start.toDate(), end.toDate())
          .then((events) => callback(events))
          .catch((err) => {
            console.error(err);
            callback([]);
          });
      },
      eventRender: function (event, element) {
        const label = String(event.activity_label || "Atividade");
        const title = String(event.title || "");
        element.attr("title", `${label}: ${title}`);
      },
      eventClick: function (event) {
        openEventDetails(event);
        return false;
      },
    });
  }

  async function loadDefinitions() {
    const data = await api.getJson("/api/calendar-activities/definitions");
    const types = Array.isArray(data?.types) ? data.types : listToArray(data);

    state.definitions = types.filter((item) => item && item.type);
    state.byType = new Map(state.definitions.map((item) => [item.type, item]));
    state.selectedTypes = new Set(state.definitions.map((item) => item.type));
  }

  function bindEvents() {
    $("#activitySideOverlay, #activitySideClose, #activityCancelBtn").on("click", function () {
      closeSide();
    });

    $("#calendarRefreshBtn").on("click", function () {
      refetchCalendar();
    });

    $("#activityFilters").on("change", ".js-activity-filter", function () {
      const type = String($(this).data("type") || "").trim();
      if (!type) return;

      if ($(this).is(":checked")) state.selectedTypes.add(type);
      else state.selectedTypes.delete(type);

      refetchCalendar();
    });

    $("#activitySelectAll").on("click", function () {
      state.selectedTypes = new Set(state.definitions.map((item) => item.type));
      renderFilters();
      refetchCalendar();
    });

    $("#activityClearAll").on("click", function () {
      state.selectedTypes = new Set();
      renderFilters();
      refetchCalendar();
    });

    $("#activityForm").on("submit", async function (ev) {
      ev.preventDefault();
      showFormError("");

      try {
        const type = String($("#activityTypeInput").val() || "").trim();
        const def = state.byType.get(type);
        if (!def) throw new Error("Tipo de atividade inválido.");

        const payload = buildPayload(def);
        await api.postJson(`/api/calendar-activities/${encodeURIComponent(type)}`, payload);

        closeSide();
        refetchCalendar();
      } catch (err) {
        handleError(err, "Não foi possível salvar a atividade.");
      }
    });
  }

  async function init() {
    try {
      setPageHeader();
      await loadDefinitions();
      renderFilters();
      renderAddMenu();
      initCalendar();
      bindEvents();
    } catch (err) {
      console.error(err);
      showFormError(err?.message || "Falha ao inicializar calendário.");
    }
  }

  $(init);
})();
