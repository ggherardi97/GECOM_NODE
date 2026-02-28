(function () {
  const FIXED_AREA_IDS = new Set(['service', 'sales', 'finance', 'hr', 'po', 'settings']);
  const RESERVED_AREA_ALIASES = new Set([
    'service',
    'services',
    'servico',
    'servicos',
    'sales',
    'vendas',
    'comercial',
    'finance',
    'financeiro',
    'financial',
    'hr',
    'rh',
    'po',
    'projectoperations',
    'project_operations',
    'settings',
    'configuracoes',
    'configuracao',
    'config',
  ]);

  const state = {
    entities: [],
    menuConfig: { areas: [] },
    selectedAreaId: null,
    theme: null,
    optionSets: [],
    selectedOptionSetId: null,
    emailIntegrations: [],
  };

  function esc(value) {
    if (value == null) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function toInt(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.trunc(n);
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function slugify(value, fallback) {
    const normalized = String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    return normalized || (fallback || 'area');
  }

  function isReservedAreaId(value) {
    const id = slugify(value);
    return FIXED_AREA_IDS.has(id) || RESERVED_AREA_ALIASES.has(id);
  }

  function tt(key, defaultValue, options) {
    if (typeof window.t === 'function') {
      return window.t(key, Object.assign({ defaultValue }, options || {}));
    }
    return defaultValue || key;
  }

  function setButtonLoading(selector, loading) {
    const $btn = $(selector);
    if (!$btn.length) return;
    if (loading) {
      if (!$btn.data('original-html')) $btn.data('original-html', $btn.html());
      $btn.prop('disabled', true).html(`<i class="fa fa-spinner fa-spin"></i> ${tt('page.settings.common.loading', 'Carregando...')}`);
      return;
    }
    $btn.prop('disabled', false);
    const original = $btn.data('original-html');
    if (original) $btn.html(original);
  }

  function showToast(message, type) {
    const $toast = $('#cfgToast');
    if (!$toast.length) return;
    const css = type === 'danger' ? 'alert-danger' : type === 'success' ? 'alert-success' : 'alert-info';
    $toast.removeClass('alert-danger alert-success alert-info').addClass(`alert ${css}`).text(message || '').show();
    if (message) {
      setTimeout(() => $toast.fadeOut(180), 3500);
    }
  }

  async function readJsonSafe(resp) {
    const text = await resp.text().catch(() => '');
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  }

  async function api(url, options) {
    const resp = await fetch(url, Object.assign({ credentials: 'include' }, options || {}));
    const data = await readJsonSafe(resp);
    if (!resp.ok) {
      const msg = Array.isArray(data?.message) ? String(data.message[0] || 'Falha') : String(data?.message || `HTTP ${resp.status}`);
      const err = new Error(msg);
      err.status = resp.status;
      throw err;
    }
    return data;
  }

  function getEntityByName(entityName) {
    return (state.entities || []).find((item) => String(item.entity || '') === String(entityName || '')) || null;
  }

  function normalizeMenuConfig(config) {
    const source = config && typeof config === 'object' ? config : { areas: [] };
    const areas = Array.isArray(source.areas) ? source.areas : [];

    const seenIds = new Set();
    const normalizedAreas = areas
      .map((area, areaIndex) => {
        const rawAreaLabel = normalizeText(area?.label) || `Area ${areaIndex + 1}`;
        const areaId = slugify(area?.id || rawAreaLabel, `area_${areaIndex + 1}`);
        const isHome = areaId === 'home';
        if (!isHome && isReservedAreaId(areaId)) return null;
        if (seenIds.has(areaId)) return null;
        seenIds.add(areaId);
        const areaLabel = isHome ? 'Home' : rawAreaLabel;
        const areaOrder = toInt(area?.order, (areaIndex + 1) * 10);

        const items = (Array.isArray(area?.items) ? area.items : [])
          .map((item, itemIndex) => {
            const meta = getEntityByName(item?.entity);
            if (!meta) return null;
            return {
              entity: meta.entity,
              label: normalizeText(item?.label) || meta.label,
              icon: normalizeText(item?.icon) || meta.icon,
              route: normalizeText(item?.route) || meta.route,
              order: toInt(item?.order, (itemIndex + 1) * 10),
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.order - b.order)
          .map((item, idx) => ({ ...item, order: (idx + 1) * 10 }));

        return {
          id: areaId,
          label: areaLabel,
          order: areaOrder,
          items,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.order - b.order)
      .map((area, idx) => ({ ...area, order: (idx + 1) * 10 }));

    return { areas: normalizedAreas.length ? normalizedAreas : [{ id: 'home', label: 'Home', order: 10, items: [] }] };
  }

  function getSelectedArea() {
    const areas = state.menuConfig?.areas || [];
    const selected = areas.find((area) => String(area.id) === String(state.selectedAreaId || ''));
    return selected || null;
  }

  function renderAreaList() {
    const $list = $('#cfgAreaList');
    if (!$list.length) return;
    const areas = state.menuConfig?.areas || [];

    if (!areas.length) {
      $list.html(`<li class="cfg-muted" style="cursor:default;">${esc(tt('page.settings.menu.noAreas', 'Nenhuma area.'))}</li>`);
      $('#cfgAreaEditor').html(`<p class="cfg-muted">${esc(tt('page.settings.menu.selectAreaHelp', 'Selecione uma area para editar.'))}</p>`);
      return;
    }

    const html = areas
      .map((area) => {
        const active = String(area.id) === String(state.selectedAreaId || '') ? 'active' : '';
        const homeBadge = String(area.id) === 'home' ? ` <span class="cfg-badge">${esc(tt('page.settings.menu.home', 'Home'))}</span>` : '';
        return `<li class="${active}" data-area-id="${esc(area.id)}"><strong>${esc(area.label)}</strong>${homeBadge}<br/><span class="cfg-muted">id: ${esc(area.id)}</span></li>`;
      })
      .join('');

    $list.html(html);

    const listEl = document.getElementById('cfgAreaList');
    if (listEl && window.Sortable) {
      if (listEl.__sortableInstance) listEl.__sortableInstance.destroy();
      listEl.__sortableInstance = Sortable.create(listEl, {
        animation: 150,
        onEnd: function () {
          const ids = Array.from(listEl.querySelectorAll('li[data-area-id]')).map((el) => String(el.getAttribute('data-area-id') || ''));
          const map = new Map((state.menuConfig.areas || []).map((area) => [String(area.id), area]));
          state.menuConfig.areas = ids.map((id, idx) => ({ ...map.get(id), order: (idx + 1) * 10 })).filter(Boolean);
          renderAreaList();
          renderAreaEditor();
        },
      });
    }

    $list.find('li[data-area-id]').off('click').on('click', function () {
      state.selectedAreaId = String($(this).data('area-id') || '');
      renderAreaList();
      renderAreaEditor();
    });

    renderAreaEditor();
  }

  function renderAreaEditor() {
    const $editor = $('#cfgAreaEditor');
    if (!$editor.length) return;

    const area = getSelectedArea();
    if (!area) {
      $editor.html(`<p class="cfg-muted">${esc(tt('page.settings.menu.selectAreaHelp', 'Selecione uma area para editar.'))}</p>`);
      return;
    }

    const entityOptions = state.entities
      .map((meta) => `<option value="${esc(meta.entity)}">${esc(meta.label)} (${esc(meta.entity)})</option>`)
      .join('');
    const isHome = String(area.id) === 'home';

    const items = Array.isArray(area.items) ? area.items : [];
    const itemsHtml = items.length
      ? items
          .map(
            (item) => `
      <li data-entity="${esc(item.entity)}">
        <div>
          <div><strong>${esc(item.label)}</strong> <span class="cfg-badge">${esc(item.entity)}</span></div>
          <div class="cfg-muted">${esc(item.route)} | <i class="fa ${esc(item.icon)}"></i> ${esc(item.icon)}</div>
        </div>
        <div>
          <button type="button" class="btn btn-xs btn-danger js-cfg-remove-item" data-entity="${esc(item.entity)}"><i class="fa fa-trash"></i></button>
        </div>
      </li>`,
          )
          .join('')
      : `<li class="cfg-muted" style="cursor:default;">${esc(tt('page.settings.menu.noItemsInArea', 'Sem itens na area.'))}</li>`;

    $editor.html(`
      <div class="row">
        <div class="col-md-5 form-group">
          <label>${esc(tt('page.settings.menu.areaId', 'Area ID'))}</label>
          <input type="text" class="form-control" id="cfgAreaId" value="${esc(area.id)}" ${isHome ? 'readonly' : ''} />
        </div>
        <div class="col-md-5 form-group">
          <label>${esc(tt('page.settings.common.label', 'Label'))}</label>
          <input type="text" class="form-control" id="cfgAreaLabel" value="${esc(area.label)}" ${isHome ? 'readonly' : ''} />
        </div>
        <div class="col-md-2 form-group" style="padding-top:24px;">
          <button type="button" class="btn btn-danger btn-sm" id="btnCfgDeleteArea" ${isHome ? 'disabled' : ''}><i class="fa fa-trash"></i></button>
        </div>
      </div>

      <div class="row" style="margin-bottom:10px;">
        <div class="col-md-4 form-group">
          <label>${esc(tt('page.settings.options.entity', 'Entidade'))}</label>
          <select class="form-control" id="cfgAreaNewEntity">${entityOptions}</select>
        </div>
        <div class="col-md-3 form-group" style="padding-top:24px;">
          <button type="button" class="btn btn-success btn-sm" id="btnCfgAddAreaItem"><i class="fa fa-plus"></i> ${esc(tt('page.settings.menu.item', 'Item'))}</button>
        </div>
      </div>

      <ul id="cfgAreaItemList" class="cfg-item-list">${itemsHtml}</ul>
    `);

    $('#cfgAreaId').off('input').on('input', function () {
      if (isHome) return;
      const nextId = slugify(this.value, area.id);
      if (isReservedAreaId(nextId) && nextId !== 'home') {
        showToast(tt('page.settings.menu.reservedArea', 'Esse ID de area e reservado para modulos fixos.'), 'danger');
        this.value = area.id;
        return;
      }
      const duplicated = (state.menuConfig.areas || []).some(
        (item) => String(item.id || '') !== String(area.id || '') && String(item.id || '') === String(nextId),
      );
      if (duplicated) {
        showToast(tt('page.settings.menu.duplicateArea', 'Ja existe outra area com esse ID.'), 'danger');
        this.value = area.id;
        return;
      }
      area.id = nextId || area.id;
      state.selectedAreaId = area.id;
      renderAreaList();
    });

    $('#cfgAreaLabel').off('input').on('input', function () {
      if (isHome) return;
      area.label = normalizeText(this.value) || area.label;
      renderAreaList();
    });

    $('#btnCfgDeleteArea').off('click').on('click', async function () {
      if (isHome) return;
      const ok = await Promise.resolve(window.confirm(tt('page.settings.menu.confirmDeleteArea', 'Deseja remover esta area?')));
      if (!ok) return;
      state.menuConfig.areas = (state.menuConfig.areas || []).filter((item) => String(item.id) !== String(area.id));
      state.selectedAreaId = state.menuConfig.areas?.[0]?.id || null;
      renderAreaList();
    });

    $('#btnCfgAddAreaItem').off('click').on('click', function () {
      const entityName = String($('#cfgAreaNewEntity').val() || '');
      const meta = getEntityByName(entityName);
      if (!meta) return;

      const exists = (area.items || []).some((item) => String(item.entity) === meta.entity);
      if (exists) {
        showToast(tt('page.settings.menu.entityAlreadyInArea', 'Esta entidade ja esta na area.'), 'info');
        return;
      }

      area.items = Array.isArray(area.items) ? area.items : [];
      area.items.push({
        entity: meta.entity,
        label: meta.label,
        icon: meta.icon,
        route: meta.route,
        order: (area.items.length + 1) * 10,
      });

      renderAreaEditor();
    });

    $('#cfgAreaItemList .js-cfg-remove-item').off('click').on('click', function () {
      const entity = String($(this).data('entity') || '');
      area.items = (area.items || []).filter((item) => String(item.entity) !== entity);
      renderAreaEditor();
    });

    const itemListEl = document.getElementById('cfgAreaItemList');
    if (itemListEl && window.Sortable) {
      if (itemListEl.__sortableInstance) itemListEl.__sortableInstance.destroy();
      itemListEl.__sortableInstance = Sortable.create(itemListEl, {
        animation: 150,
        onEnd: function () {
          const orderedEntities = Array.from(itemListEl.querySelectorAll('li[data-entity]')).map((el) =>
            String(el.getAttribute('data-entity') || ''),
          );
          const map = new Map((area.items || []).map((item) => [String(item.entity), item]));
          area.items = orderedEntities.map((key, idx) => ({ ...map.get(key), order: (idx + 1) * 10 })).filter(Boolean);
          renderAreaEditor();
        },
      });
    }
  }

  async function loadMenu() {
    const data = await api('/api/admin/menu');
    state.menuConfig = normalizeMenuConfig(data?.config_json || {});
    const home = (state.menuConfig?.areas || []).find((area) => String(area.id || '') === 'home');
    state.selectedAreaId = home?.id || state.menuConfig?.areas?.[0]?.id || null;
    renderAreaList();
  }

  async function saveMenu() {
    const payload = { config_json: normalizeMenuConfig(state.menuConfig || {}) };
    setButtonLoading('#btnCfgSaveMenu', true);
    try {
      await api('/api/admin/menu', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      showToast(tt('page.settings.messages.menuSaved', 'Menu salvo com sucesso.'), 'success');
      await loadMenu();
    } finally {
      setButtonLoading('#btnCfgSaveMenu', false);
    }
  }

  function themeInputValue(id) {
    return String($(id).val() || '').trim();
  }

  function applyThemePreview() {
    const root = document.getElementById('cfgThemePreview');
    if (!root) return;
    root.style.setProperty('--cfg-primary', themeInputValue('#cfgThemePrimaryColor') || '#1ab394');
    root.style.setProperty('--cfg-nav-bg', themeInputValue('#cfgThemeNavBgColor') || '#2f4050');
    root.style.setProperty('--cfg-nav-text', themeInputValue('#cfgThemeNavTextColor') || '#a7b1c2');
    root.style.setProperty('--cfg-topbar', themeInputValue('#cfgThemeTopbarBgColor') || '#ffffff');
  }

  function fillThemeForm(theme) {
    const t = theme || {};
    $('#cfgThemePrimaryColor').val(t.primary_color || '#1ab394');
    $('#cfgThemeNavBgColor').val(t.nav_bg_color || '#2f4050');
    $('#cfgThemeNavTextColor').val(t.nav_text_color || '#a7b1c2');
    $('#cfgThemeTopbarBgColor').val(t.topbar_bg_color || '#ffffff');
    $('#cfgThemeLayoutMode').val(String(t.layout_mode || 'LIGHT').toUpperCase() === 'DARK' ? 'DARK' : 'LIGHT');
    $('#cfgThemeLogoUrl').val(t.logo_url || '');
    $('#cfgThemeFaviconUrl').val(t.favicon_url || '');
    applyThemePreview();
  }

  async function loadTheme() {
    state.theme = await api('/api/admin/theme');
    fillThemeForm(state.theme);
  }

  async function saveTheme() {
    setButtonLoading('#btnCfgSaveTheme', true);
    try {
      const payload = {
        primary_color: themeInputValue('#cfgThemePrimaryColor'),
        nav_bg_color: themeInputValue('#cfgThemeNavBgColor'),
        nav_text_color: themeInputValue('#cfgThemeNavTextColor'),
        topbar_bg_color: themeInputValue('#cfgThemeTopbarBgColor'),
        layout_mode: themeInputValue('#cfgThemeLayoutMode'),
        logo_url: themeInputValue('#cfgThemeLogoUrl'),
        favicon_url: themeInputValue('#cfgThemeFaviconUrl'),
      };

      state.theme = await api('/api/admin/theme', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      fillThemeForm(state.theme);
      showToast(tt('page.settings.messages.themeSaved', 'Tema salvo com sucesso.'), 'success');
    } finally {
      setButtonLoading('#btnCfgSaveTheme', false);
    }
  }

  function renderOptionEntitySelect() {
    const editable = (state.entities || []).filter((item) => !!item.allowOptionSetEditing);
    const html = editable.map((item) => `<option value="${esc(item.entity)}">${esc(item.label)}</option>`).join('');
    $('#cfgOptionEntity').html(html || '<option value="">Sem entidades</option>');
    renderOptionFieldSelect();
  }

  function renderOptionFieldSelect() {
    const entity = String($('#cfgOptionEntity').val() || '');
    const meta = getEntityByName(entity);
    const fields = Array.isArray(meta?.optionSetFields) ? meta.optionSetFields : [];
    const html = fields.map((field) => `<option value="${esc(field.field)}">${esc(field.label)} (${esc(field.field)})</option>`).join('');
    $('#cfgOptionField').html(html || '<option value="">Sem campos</option>');
  }

  async function loadOptionSets() {
    const entity = String($('#cfgOptionEntity').val() || '');
    const data = await api(`/api/admin/option-sets?entity=${encodeURIComponent(entity)}`);
    state.optionSets = Array.isArray(data?.items) ? data.items : [];
    state.selectedOptionSetId = state.optionSets?.[0]?.id || null;
    renderOptionSetsTable();
    renderOptionValuesTable();
  }

  function getSelectedOptionSet() {
    return (state.optionSets || []).find((item) => String(item.id) === String(state.selectedOptionSetId || '')) || null;
  }

  function renderOptionSetsTable() {
    const $tbody = $('#cfgOptionSetTable tbody');
    const rows = (state.optionSets || []).map((item) => {
      const active = String(item.id) === String(state.selectedOptionSetId || '') ? ' style="background:#f3fbfa;"' : '';
      return `<tr data-option-set-id="${esc(item.id)}"${active}><td>${esc(item.entity)}</td><td>${esc(item.field)}</td></tr>`;
    });

    if (!rows.length) {
      $tbody.html(`<tr><td colspan="2">${esc(tt('page.settings.options.noSets', 'Nenhum option set.'))}</td></tr>`);
      return;
    }

    $tbody.html(rows.join(''));
    $tbody.find('tr[data-option-set-id]').off('click').on('click', function () {
      state.selectedOptionSetId = String($(this).data('option-set-id') || '');
      renderOptionSetsTable();
      renderOptionValuesTable();
    });
  }

  function renderOptionValuesTable() {
    const selected = getSelectedOptionSet();
    const $tbody = $('#cfgOptionTable tbody');
    if (!selected) {
      $tbody.html(`<tr><td colspan="6">${esc(tt('page.settings.options.selectSet', 'Selecione um option set.'))}</td></tr>`);
      return;
    }

    const options = Array.isArray(selected.options) ? selected.options : [];
    if (!options.length) {
      $tbody.html(`<tr><td colspan="6">${esc(tt('page.settings.options.noOptions', 'Sem opcoes.'))}</td></tr>`);
      return;
    }

    $tbody.html(
      options
        .map(
          (opt) => `
      <tr data-option-id="${esc(opt.id)}">
        <td>${esc(opt.value)}</td>
        <td>${esc(opt.label)}</td>
        <td><span class="cfg-badge">${esc(opt.color || '-')}</span></td>
        <td>${esc(String(opt.sort_order ?? 0))}</td>
        <td>${opt.is_active ? 'Sim' : 'Nao'}</td>
        <td>
          <button type="button" class="btn btn-xs btn-primary js-cfg-edit-option" data-option-id="${esc(opt.id)}"><i class="fa fa-pencil"></i></button>
          <button type="button" class="btn btn-xs btn-warning js-cfg-toggle-option" data-option-id="${esc(opt.id)}"><i class="fa fa-power-off"></i></button>
        </td>
      </tr>`,
        )
        .join(''),
    );

    $tbody.find('.js-cfg-edit-option').off('click').on('click', async function () {
      const optionId = String($(this).data('option-id') || '');
      const option = (selected.options || []).find((item) => String(item.id) === optionId);
      if (!option) return;

      const nextLabel = window.prompt(tt('page.settings.options.promptLabel', 'Label da opcao:'), String(option.label || ''));
      if (nextLabel == null) return;
      const nextColor = window.prompt(tt('page.settings.options.promptColor', 'Cor (#RRGGBB):'), String(option.color || '#64748B'));
      if (nextColor == null) return;
      const nextSort = window.prompt(tt('page.settings.options.promptSortOrder', 'Sort order:'), String(option.sort_order || 0));
      if (nextSort == null) return;

      await api(`/api/admin/options/${encodeURIComponent(optionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          label: nextLabel,
          color: nextColor,
          sort_order: toInt(nextSort, 0),
        }),
      });

      showToast(tt('page.settings.messages.optionUpdated', 'Opcao atualizada.'), 'success');
      await loadOptionSets();
      state.selectedOptionSetId = selected.id;
      renderOptionSetsTable();
      renderOptionValuesTable();
    });

    $tbody.find('.js-cfg-toggle-option').off('click').on('click', async function () {
      const optionId = String($(this).data('option-id') || '');
      await api(`/api/admin/options/${encodeURIComponent(optionId)}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({}),
      });
      showToast(tt('page.settings.messages.optionStatusUpdated', 'Status da opcao atualizado.'), 'success');
      await loadOptionSets();
      state.selectedOptionSetId = selected.id;
      renderOptionSetsTable();
      renderOptionValuesTable();
    });
  }

  async function createOptionSet() {
    const entity = String($('#cfgOptionEntity').val() || '');
    const field = String($('#cfgOptionField').val() || '');
    if (!entity || !field) {
      showToast(tt('page.settings.options.selectEntityAndField', 'Selecione entidade e campo.'), 'danger');
      return;
    }

    await api('/api/admin/option-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ entity, field }),
    });

    showToast(tt('page.settings.messages.optionSetCreated', 'Option set criado com sucesso.'), 'success');
    await loadOptionSets();
  }

  async function addOptionValue() {
    const selected = getSelectedOptionSet();
    if (!selected) {
      showToast(tt('page.settings.options.selectSet', 'Selecione um option set.'), 'danger');
      return;
    }

    const value = normalizeText($('#cfgOptionValue').val());
    const label = normalizeText($('#cfgOptionLabel').val());
    const color = normalizeText($('#cfgOptionColor').val()) || '#64748B';
    const sortOrder = toInt($('#cfgOptionSortOrder').val(), 0);

    if (!value || !label) {
      showToast(tt('page.settings.options.valueLabelRequired', 'Value e label sao obrigatorios.'), 'danger');
      return;
    }

    await api(`/api/admin/option-sets/${encodeURIComponent(selected.id)}/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ value, label, color, sort_order: sortOrder, is_active: true }),
    });

    $('#cfgOptionValue').val('');
    $('#cfgOptionLabel').val('');
    $('#cfgOptionSortOrder').val(0);

    showToast(tt('page.settings.messages.optionCreated', 'Opcao criada.'), 'success');
    await loadOptionSets();
    state.selectedOptionSetId = selected.id;
    renderOptionSetsTable();
    renderOptionValuesTable();
  }

  function readEmailForm() {
    const payload = {
      provider: normalizeText($('#cfgEmailProvider').val()).toUpperCase(),
      display_name: normalizeText($('#cfgEmailDisplayName').val()),
      sender_email: normalizeText($('#cfgEmailSenderEmail').val()),
      smtp_host: normalizeText($('#cfgEmailSmtpHost').val()),
      smtp_port: toInt($('#cfgEmailSmtpPort').val(), 587),
      smtp_user: normalizeText($('#cfgEmailSmtpUser').val()),
      smtp_password: normalizeText($('#cfgEmailSmtpPassword').val()),
      client_id: normalizeText($('#cfgEmailClientId').val()),
      client_secret: normalizeText($('#cfgEmailClientSecret').val()),
      tenant_domain: normalizeText($('#cfgEmailTenantDomain').val()),
      is_active: !!$('#cfgEmailIsActive').prop('checked'),
    };

    if (!payload.smtp_password) delete payload.smtp_password;
    if (!payload.client_secret) delete payload.client_secret;

    return payload;
  }

  function fillEmailForm(row) {
    const item = row || {};
    $('#cfgEmailId').val(item.id || '');
    $('#cfgEmailProvider').val(item.provider || 'SMTP');
    $('#cfgEmailDisplayName').val(item.display_name || '');
    $('#cfgEmailSenderEmail').val(item.sender_email || '');
    $('#cfgEmailSmtpHost').val(item.smtp_host || '');
    $('#cfgEmailSmtpPort').val(item.smtp_port || 587);
    $('#cfgEmailSmtpUser').val(item.smtp_user || '');
    $('#cfgEmailSmtpPassword').val('');
    $('#cfgEmailClientId').val(item.client_id || '');
    $('#cfgEmailClientSecret').val('');
    $('#cfgEmailTenantDomain').val(item.tenant_domain || '');
    $('#cfgEmailIsActive').prop('checked', !!item.is_active);
  }

  async function loadEmailIntegrations() {
    const data = await api('/api/admin/email-integrations');
    state.emailIntegrations = Array.isArray(data?.items) ? data.items : [];
    renderEmailTable();
  }

  function renderEmailTable() {
    const $tbody = $('#cfgEmailTable tbody');
    const rows = state.emailIntegrations || [];

    if (!rows.length) {
      $tbody.html(`<tr><td colspan="6">${esc(tt('page.settings.email.noIntegrations', 'Nenhuma integracao cadastrada.'))}</td></tr>`);
      return;
    }

    $tbody.html(
      rows
        .map(
          (row) => `
      <tr>
        <td>${esc(row.provider)}</td>
        <td>${esc(row.display_name)}</td>
        <td>${esc(row.sender_email)}</td>
        <td>${esc([row.smtp_host || '-', row.smtp_port || '-'].join(':'))}</td>
        <td>${row.is_active ? 'Sim' : 'Nao'}</td>
        <td>
          <button type="button" class="btn btn-xs btn-primary js-cfg-email-edit" data-id="${esc(row.id)}"><i class="fa fa-pencil"></i></button>
          <button type="button" class="btn btn-xs btn-warning js-cfg-email-toggle" data-id="${esc(row.id)}"><i class="fa fa-power-off"></i></button>
        </td>
      </tr>`,
        )
        .join(''),
    );

    $tbody.find('.js-cfg-email-edit').off('click').on('click', function () {
      const id = String($(this).data('id') || '');
      const row = (state.emailIntegrations || []).find((item) => String(item.id) === id);
      if (!row) return;
      fillEmailForm(row);
      $('#cfgEmailModalTitle').text(tt('page.settings.email.edit', 'Editar integracao'));
      $('#cfgEmailModal').modal('show');
    });

    $tbody.find('.js-cfg-email-toggle').off('click').on('click', async function () {
      const id = String($(this).data('id') || '');
      await api(`/api/admin/email-integrations/${encodeURIComponent(id)}/toggle-active`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({}),
      });
      showToast(tt('page.settings.messages.emailIntegrationUpdated', 'Integracao atualizada.'), 'success');
      await loadEmailIntegrations();
    });
  }

  async function saveEmailIntegration() {
    const id = normalizeText($('#cfgEmailId').val());
    const payload = readEmailForm();

    if (!payload.display_name || !payload.sender_email) {
      showToast(tt('page.settings.email.nameAndSenderRequired', 'Nome e email remetente sao obrigatorios.'), 'danger');
      return;
    }

    if (id) {
      await api(`/api/admin/email-integrations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await api('/api/admin/email-integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    $('#cfgEmailModal').modal('hide');
    showToast(tt('page.settings.messages.emailIntegrationSaved', 'Integracao salva com sucesso.'), 'success');
    await loadEmailIntegrations();
  }

  async function testEmailIntegration() {
    const id = normalizeText($('#cfgEmailId').val());
    const payload = id
      ? { integration_id: id }
      : {
          smtp_host: normalizeText($('#cfgEmailSmtpHost').val()),
          smtp_port: toInt($('#cfgEmailSmtpPort').val(), 587),
          smtp_user: normalizeText($('#cfgEmailSmtpUser').val()),
          smtp_password: normalizeText($('#cfgEmailSmtpPassword').val()),
        };

    const resp = await api('/api/admin/email-integrations/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    showToast(resp?.message || tt('page.settings.email.smtpTestSuccess', 'Teste SMTP executado com sucesso.'), 'success');
  }

  function bindEvents() {
    $('#btnCfgReloadMenu').on('click', () => loadMenu().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgSaveMenu').on('click', () => saveMenu().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgNewArea').on('click', function () {
      state.menuConfig.areas = state.menuConfig.areas || [];
      let idx = state.menuConfig.areas.length + 1;
      let nextId = `area_${idx}`;
      const existingIds = new Set((state.menuConfig.areas || []).map((item) => String(item.id || '')));
      while (existingIds.has(nextId) || isReservedAreaId(nextId)) {
        idx += 1;
        nextId = `area_${idx}`;
      }
      const area = {
        id: nextId,
        label: `Area ${idx}`,
        order: idx * 10,
        items: [],
      };
      state.menuConfig.areas.push(area);
      state.selectedAreaId = area.id;
      renderAreaList();
    });

    $('#cfgThemePrimaryColor,#cfgThemeNavBgColor,#cfgThemeNavTextColor,#cfgThemeTopbarBgColor,#cfgThemeLayoutMode,#cfgThemeLogoUrl,#cfgThemeFaviconUrl').on('input change', applyThemePreview);
    $('#btnCfgSaveTheme').on('click', () => saveTheme().catch((e) => showToast(e.message, 'danger')));

    $('#cfgOptionEntity').on('change', renderOptionFieldSelect);
    $('#btnCfgLoadOptionSets').on('click', () => loadOptionSets().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgCreateOptionSet').on('click', () => createOptionSet().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgAddOption').on('click', () => addOptionValue().catch((e) => showToast(e.message, 'danger')));

    $('#btnCfgReloadEmailIntegration').on('click', () => loadEmailIntegrations().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgNewEmailIntegration').on('click', function () {
      fillEmailForm(null);
      $('#cfgEmailModalTitle').text(tt('page.settings.email.new', 'Nova integracao'));
      $('#cfgEmailModal').modal('show');
    });
    $('#btnCfgEmailSave').on('click', () => saveEmailIntegration().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgEmailTest').on('click', () => testEmailIntegration().catch((e) => showToast(e.message, 'danger')));
  }

  async function bootstrap() {
    $('#pageName').text(tt('page.settings.title', 'Configuracoes'));
    $('#subpageName').text(tt('page.settings.title', 'Configuracoes'));
    $('#path').hide();

    const metadata = await api('/api/admin/metadata/entities');
    state.entities = Array.isArray(metadata) ? metadata : [];

    renderOptionEntitySelect();
    await Promise.all([loadMenu(), loadTheme(), loadEmailIntegrations()]);

    if (String($('#cfgOptionEntity').val() || '').trim()) {
      await loadOptionSets();
    }

    bindEvents();
  }

  $(function () {
    bootstrap().catch((error) => {
      showToast(error?.message || tt('page.settings.messages.loadFailed', 'Falha ao carregar configuracoes.'), 'danger');
    });
  });
})();
