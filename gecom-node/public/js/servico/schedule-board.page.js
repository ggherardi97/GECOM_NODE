(function () {
  const api = window.ServiceApi;
  if (!api) return;

  const state = {
    date: toDateInput(new Date()),
    board: null,
    selectedWorkOrderId: null,
    dayStartHour: 7,
    dayEndHour: 19,
  };

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toDateInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function toDateTimeInput(date) {
    const copy = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return copy.toISOString().slice(0, 16);
  }

  function fmtDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function fmtHour(date) {
    return String(date.getHours()).padStart(2, '0') + ':00';
  }

  function priorityColor(priority) {
    switch (String(priority || '').toUpperCase()) {
      case 'HIGH':
        return '#f8ac59';
      case 'URGENT':
        return '#ed5565';
      case 'LOW':
        return '#1ab394';
      default:
        return '#1c84c6';
    }
  }

  function appointmentColor(item) {
    if (item?.incident) return '#daf7ec';
    return '#dff0ff';
  }

  async function loadBoard() {
    const query = new URLSearchParams({ date: state.date });
    state.board = await api.getJson(`/api/service/schedule-board?${query.toString()}`);
    render();
  }

  function render() {
    const board = state.board || {};
    $('#metricResources').text(String(board.metrics?.resources || 0));
    $('#metricAppointments').text(String(board.metrics?.appointments || 0));
    $('#metricUnscheduled').text(String(board.metrics?.unscheduled_work_orders || 0));
    renderBacklog(board.unscheduled_work_orders || []);
    renderGrid(board.resources || []);
    bindBoardInteractions();
  }

  function renderBacklog(items) {
    const html = (items || []).length
      ? items
          .map((item) => {
            const selected = state.selectedWorkOrderId === String(item.id) ? ' is-selected' : '';
            const durationMinutes = resolveDurationMinutes(item);
            return `
              <div class="board-work-card${selected}" data-work-order-id="${esc(item.id)}" data-duration-minutes="${esc(durationMinutes)}">
                <div class="board-work-meta">
                  <span class="board-work-code">${esc(item.code || 'WO')}</span>
                  <span class="board-work-priority" style="background:${esc(priorityColor(item.priority))}22; color:${esc(priorityColor(item.priority))};">
                    ${esc(String(item.priority || 'MEDIUM').toUpperCase())}
                  </span>
                </div>
                <div class="board-work-title">${esc(item.title || 'Work order sem título')}</div>
                <div class="board-work-text">${esc(item.description || item.incident?.title || 'Sem descrição adicional.')}</div>
                <div class="board-work-footer">
                  ${item.incident ? `<span class="board-badge"><i class="fa fa-ticket"></i> ${esc(item.incident.number || item.incident.title || 'Incidente')}</span>` : ''}
                  <span class="board-badge"><i class="fa fa-clock-o"></i> ${esc(String(durationMinutes))} min</span>
                  <span class="board-badge"><i class="fa fa-users"></i> ${esc(String((item.assignments || []).length || 0))} recursos</span>
                </div>
                <div class="board-work-actions">
                  <button class="btn btn-xs btn-primary btn-board-suggest" data-work-order-id="${esc(item.id)}">
                    <i class="fa fa-magic"></i> Sugestões
                  </button>
                  <a class="btn btn-xs btn-default" href="/project-operations/work-orders/${encodeURIComponent(String(item.id || ''))}/edit">
                    <i class="fa fa-external-link"></i> Abrir
                  </a>
                </div>
              </div>
            `;
          })
          .join('')
      : `<div class="schedule-empty">Nenhuma work order sem agenda neste dia.</div>`;

    $('#scheduleBacklog').html(html);
  }

  function renderGrid(resources) {
    const startHour = state.dayStartHour;
    const endHour = state.dayEndHour;
    const totalHours = endHour - startHour;
    const gridStyle = `--resource-count:${Math.max(1, resources.length)};`;
    const timeHead = `<div class="schedule-time-head"></div>`;
    const timeLane = `
      <div class="schedule-time-col">
        ${timeHead}
        <div class="schedule-lane">
          ${Array.from({ length: totalHours }, (_, index) => `<div class="schedule-slot-label" style="position:absolute;top:${index * 60}px;left:0;right:0;">${esc(String(startHour + index).padStart(2, '0') + ':00')}</div>`).join('')}
        </div>
      </div>
    `;

    const resourceCols = (resources || [])
      .map((resource) => {
        const appointmentsHtml = (resource.appointments || [])
          .map((appointment) => renderAppointment(resource, appointment))
          .join('');
        const slotsHtml = Array.from({ length: totalHours }, (_, index) => {
          const slotHour = startHour + index;
          return `<div class="schedule-slot js-schedule-slot" data-resource-id="${esc(resource.id)}" data-hour="${esc(slotHour)}" style="top:${index * 60}px;"></div>`;
        }).join('');

        const metaBits = [
          resource.user?.full_name || '',
          resource.can_receive_cases === false ? 'Sem distribuição automática' : 'Recebe casos',
          resource.calendar?.name || 'Sem calendário',
        ].filter(Boolean);

        return `
          <div class="schedule-resource-col">
            <div class="schedule-resource-head">
              <div class="schedule-resource-name">${esc(resource.name || 'Recurso')}</div>
              <div class="schedule-resource-meta">${esc(metaBits.join(' • '))}</div>
            </div>
            <div class="schedule-lane" data-resource-id="${esc(resource.id)}">
              ${slotsHtml}
              ${appointmentsHtml}
            </div>
          </div>
        `;
      })
      .join('');

    $('#scheduleBoardGrid').attr('style', gridStyle).html(timeLane + resourceCols);
  }

  function renderAppointment(resource, appointment) {
    const start = new Date(appointment.start_at);
    const end = new Date(appointment.end_at);
    const laneTop = ((start.getHours() + start.getMinutes() / 60) - state.dayStartHour) * 60;
    const laneHeight = Math.max(36, ((end.getTime() - start.getTime()) / 60000));
    const workOrder = appointment.work_order || {};
    return `
      <div
        class="schedule-appointment"
        data-appointment-id="${esc(appointment.id)}"
        data-work-order-id="${esc(workOrder.id || '')}"
        data-resource-id="${esc(resource.id)}"
        data-duration-minutes="${esc(Math.max(30, Math.round((end.getTime() - start.getTime()) / 60000)))}"
        style="top:${Math.max(0, laneTop)}px;height:${laneHeight}px;background:${esc(appointmentColor(appointment))};border-left:4px solid ${esc(resource.board_color || '#1c84c6')};"
        title="${esc(fmtDateTime(appointment.start_at) + ' - ' + fmtDateTime(appointment.end_at))}"
      >
        <div class="schedule-appointment-title">${esc(workOrder.code || appointment.title || 'Agendamento')}</div>
        <div class="schedule-appointment-meta">${esc(fmtDateTime(appointment.start_at))} • ${esc(appointment.incident?.number || appointment.incident?.title || 'Sem incidente')}</div>
      </div>
    `;
  }

  function bindBoardInteractions() {
    $('.board-work-card')
      .off('click')
      .on('click', function (event) {
        if ($(event.target).closest('.btn-board-suggest, a').length) return;
        const id = String($(this).data('work-order-id') || '');
        state.selectedWorkOrderId = state.selectedWorkOrderId === id ? null : id;
        renderBacklog((state.board && state.board.unscheduled_work_orders) || []);
        bindBoardInteractions();
      })
      .draggable({
        helper: 'clone',
        appendTo: 'body',
        revert: 'invalid',
        zIndex: 20000,
        start: function () {
          $('.schedule-lane').addClass('is-over');
        },
        stop: function () {
          $('.schedule-lane').removeClass('is-over');
        },
      });

    $('.schedule-appointment')
      .draggable({
        helper: 'clone',
        appendTo: 'body',
        revert: 'invalid',
        zIndex: 20000,
        start: function () {
          $('.schedule-lane').addClass('is-over');
        },
        stop: function () {
          $('.schedule-lane').removeClass('is-over');
        },
      });

    $('.js-schedule-slot')
      .droppable({
        accept: '.board-work-card, .schedule-appointment',
        hoverClass: 'is-over',
        drop: async function (_event, ui) {
          const $slot = $(this);
          const resourceId = String($slot.data('resource-id') || '');
          const hour = Number($slot.data('hour'));
          const startAt = new Date(`${state.date}T${String(hour).padStart(2, '0')}:00:00`);
          const $source = $(ui.draggable);
          const durationMinutes = Number($source.data('duration-minutes') || 60) || 60;
          const endAt = new Date(startAt.getTime() + durationMinutes * 60000);

          try {
            if ($source.hasClass('board-work-card')) {
              await api.postJson('/api/service/schedule-board/book', {
                work_order_id: String($source.data('work-order-id') || ''),
                resource_id: resourceId,
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString(),
              });
            } else {
              await api.putJson(`/api/service/schedule-board/appointments/${encodeURIComponent(String($source.data('appointment-id') || ''))}`, {
                work_order_id: String($source.data('work-order-id') || ''),
                resource_id: resourceId,
                start_at: startAt.toISOString(),
                end_at: endAt.toISOString(),
              });
            }
            await loadBoard();
          } catch (error) {
            window.swal?.('Agendamento', error?.message || 'Não foi possível agendar nesse horário.', 'error');
          }
        },
      });

    $('.btn-board-suggest')
      .off('click')
      .on('click', async function () {
        const workOrderId = String($(this).data('work-order-id') || '');
        await openSuggestions(workOrderId);
      });
  }

  async function openSuggestions(workOrderId) {
    $('#scheduleSuggestionsBody').html('<div class="schedule-empty">Carregando sugestões...</div>');
    $('#scheduleSuggestionsModal').modal('show');
    try {
      const query = new URLSearchParams({ date: state.date });
      const payload = await api.getJson(`/api/service/schedule-board/work-orders/${encodeURIComponent(workOrderId)}/suggestions?${query.toString()}`);
      const suggestions = payload.suggestions || [];
      if (!suggestions.length) {
        $('#scheduleSuggestionsBody').html('<div class="schedule-empty">Nenhum slot compatível encontrado para os próximos dias.</div>');
        return;
      }

      const html = suggestions
        .map((item) => {
          const resource = item.resource || {};
          const slots = (item.slots || [])
            .map((slot) => {
              return `
                <div class="schedule-suggestion-card">
                  <div>
                    <strong>${esc(resource.name || 'Recurso')}</strong><br>
                    <span class="text-muted">${esc(fmtDateTime(slot.start_at))} até ${esc(fmtDateTime(slot.end_at))}</span>
                  </div>
                  <button
                    class="btn btn-primary btn-sm js-book-suggestion"
                    data-work-order-id="${esc(workOrderId)}"
                    data-resource-id="${esc(resource.id)}"
                    data-start-at="${esc(new Date(slot.start_at).toISOString())}"
                    data-end-at="${esc(new Date(slot.end_at).toISOString())}"
                  >
                    Agendar
                  </button>
                </div>
              `;
            })
            .join('');

          return `<div>${slots}</div>`;
        })
        .join('');

      $('#scheduleSuggestionsBody').html(html);
      $('.js-book-suggestion')
        .off('click')
        .on('click', async function () {
          const payload = {
            work_order_id: String($(this).data('work-order-id') || ''),
            resource_id: String($(this).data('resource-id') || ''),
            start_at: String($(this).data('start-at') || ''),
            end_at: String($(this).data('end-at') || ''),
          };
          try {
            await api.postJson('/api/service/schedule-board/book', payload);
            $('#scheduleSuggestionsModal').modal('hide');
            await loadBoard();
          } catch (error) {
            window.swal?.('Agendamento', error?.message || 'Não foi possível agendar.', 'error');
          }
        });
    } catch (error) {
      $('#scheduleSuggestionsBody').html(`<div class="schedule-empty">${esc(error?.message || 'Não foi possível carregar sugestões.')}</div>`);
    }
  }

  function resolveDurationMinutes(item) {
    if (item?.planned_start && item?.planned_end) {
      const diff = new Date(item.planned_end).getTime() - new Date(item.planned_start).getTime();
      if (diff > 0) return Math.max(30, Math.round(diff / 60000));
    }
    const estimatedHours = Number(item?.estimated_hours || 0);
    if (Number.isFinite(estimatedHours) && estimatedHours > 0) return Math.max(30, Math.round(estimatedHours * 60));
    return 60;
  }

  function bindToolbar() {
    $('#scheduleBoardDate').val(state.date).on('change', function () {
      state.date = String($(this).val() || state.date);
      loadBoard();
    });

    $('#btnScheduleBoardRefresh').on('click', function () {
      loadBoard();
    });
  }

  async function init() {
    bindToolbar();
    try {
      await loadBoard();
    } catch (error) {
      $('#scheduleBacklog').html(`<div class="schedule-empty">${esc(error?.message || 'Não foi possível carregar o board.')}</div>`);
    }
  }

  $(document).ready(init);
})();
