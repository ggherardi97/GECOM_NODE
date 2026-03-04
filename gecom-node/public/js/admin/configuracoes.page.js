(function () {
  const BLOCKED_AREA_IDS = new Set([
    'cadastro',
    'cadastros',
    'operacao',
    'operacoes',
    'operation',
    'operations',
  ]);
  const CORE_AREA_IDS = new Set([
    'service',
    'services',
    'servico',
    'servicos',
    'sales',
    'sale',
    'finance',
    'financeiro',
    'financial',
    'hr',
    'rh',
    'po',
    'project',
    'projects',
    'project_operation',
    'project_operations',
    'operation',
    'operations',
  ]);
  const MAIN_TAB_STORAGE_KEY = 'cfg_settings_active_tab';

  const state = {
    entities: [],
    menuConfig: { default_area: 'home', areas: [] },
    selectedAreaId: null,
    theme: null,
    optionSets: [],
    selectedOptionSetId: null,
    emailIntegrations: [],
    landingPage: null,
    landingAiDraft: null,
    landingAiSelectedVersionIndex: 0,
    accessEntities: [],
    accessRoles: [],
    selectedAccessRoleId: null,
    selectedAccessRoleDetails: null,
    accessUsers: [],
    selectedAccessUserId: null,
    selectedAccessUserDetails: null,
    accessPermSearch: '',
  };
  let landingEditor = null;
  let landingEditorReadyPromise = null;

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

  function formatDateTime(value) {
    if (!value) return '-';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return '-';
    return date.toLocaleString('pt-BR');
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

  function isBlockedAreaId(value) {
    const id = slugify(value);
    return BLOCKED_AREA_IDS.has(id);
  }

  function isCoreAreaId(value) {
    const id = slugify(value);
    return CORE_AREA_IDS.has(id);
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

  function syncMainTabs(target) {
    const safeTarget = String(target || '#cfg-tab-menu');
    const $links = $('#cfgTabs > li > a.cfg-main-tab-link');
    $links.removeClass('active').parent('li').removeClass('active');
    const $activeLink = $links.filter(`[href="${safeTarget}"]`).first();
    if ($activeLink.length) {
      $activeLink.addClass('active').parent('li').addClass('active');
    }

    const $mainContent = $('#cfgMainTabContent');
    $mainContent.children('.tab-pane').removeClass('active in');
    const $targetPane = $mainContent.children(safeTarget);
    if ($targetPane.length) {
      $targetPane.addClass('active in');
    }
  }

  function bindMainTabs() {
    const $links = $('#cfgTabs > li > a.cfg-main-tab-link');
    if (!$links.length) return;

    $links.off('click.cfgmain').on('click.cfgmain', function (ev) {
      ev.preventDefault();
      $(this).tab('show');
    });

    $links.off('shown.bs.tab.cfgmain').on('shown.bs.tab.cfgmain', function (ev) {
      const target = String($(ev.target).attr('href') || '#cfg-tab-menu');
      syncMainTabs(target);
      try {
        window.localStorage.setItem(MAIN_TAB_STORAGE_KEY, target);
      } catch {
        // ignore storage issues
      }
    });
  }

  function restoreMainTab() {
    let target = '#cfg-tab-menu';
    try {
      const saved = String(window.localStorage.getItem(MAIN_TAB_STORAGE_KEY) || '').trim();
      if (saved) target = saved;
    } catch {
      // ignore storage issues
    }

    const $link = $(`#cfgTabs > li > a.cfg-main-tab-link[href="${target}"]`);
    if ($link.length) {
      $link.tab('show');
      syncMainTabs(target);
      return;
    }

    syncMainTabs('#cfg-tab-menu');
  }

  function openConfirmModal(message, options) {
    const opts = options && typeof options === 'object' ? options : {};
    const $modal = $('#cfgConfirmModal');
    const $ok = $('#btnCfgConfirmModalOk');
    const $title = $('#cfgConfirmModalTitle');
    const $message = $('#cfgConfirmModalMessage');

    if (!$modal.length || !$ok.length) {
      return Promise.resolve(window.confirm(String(message || 'Confirmar?')));
    }

    const defaultOkClass = 'btn-danger';
    const okClass = String(opts.okClass || defaultOkClass);
    const okText = String(opts.okText || tt('page.settings.common.confirm', 'Confirmar'));
    const title = String(opts.title || tt('page.settings.common.confirm', 'Confirmar'));
    const text = String(message || tt('page.settings.common.confirmAction', 'Deseja continuar?'));

    $title.text(title);
    $message.text(text);
    $ok.text(okText).removeClass('btn-danger btn-primary btn-success btn-warning').addClass(okClass);

    return new Promise((resolve) => {
      let done = false;
      const finish = (result) => {
        if (done) return;
        done = true;
        $ok.off('click.cfgconfirm');
        $modal.off('hidden.bs.modal.cfgconfirm');
        resolve(Boolean(result));
      };

      $ok.on('click.cfgconfirm', function () {
        finish(true);
        $modal.modal('hide');
      });

      $modal.on('hidden.bs.modal.cfgconfirm', function () {
        finish(false);
      });

      $modal.modal('show');
    });
  }

  function openCreateRoleModal() {
    const $modal = $('#cfgAccessRoleModal');
    const $save = $('#btnCfgAccessRoleModalSave');
    const $name = $('#cfgAccessRoleModalName');
    const $code = $('#cfgAccessRoleModalCode');

    if (!$modal.length || !$save.length || !$name.length || !$code.length) {
      return Promise.resolve(null);
    }

    $name.val('');
    $code.val('');

    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        $save.off('click.cfgcreaterole');
        $modal.off('hidden.bs.modal.cfgcreaterole');
        resolve(value);
      };

      $save.on('click.cfgcreaterole', function () {
        const name = normalizeText($name.val());
        if (!name) {
          showToast(tt('page.settings.access.roleNameRequired', 'Nome da role é obrigatório.'), 'danger');
          $name.focus();
          return;
        }

        const code = normalizeText($code.val());
        finish({
          name,
          code,
        });
        $modal.modal('hide');
      });

      $modal.on('hidden.bs.modal.cfgcreaterole', function () {
        finish(null);
      });

      $modal.modal('show');
      setTimeout(() => $name.focus(), 50);
    });
  }

  function openEditOptionModal(option) {
    const item = option && typeof option === 'object' ? option : null;
    const $modal = $('#cfgOptionEditModal');
    const $save = $('#btnCfgOptionEditSave');
    const $id = $('#cfgOptionEditId');
    const $label = $('#cfgOptionEditLabel');
    const $color = $('#cfgOptionEditColor');
    const $sort = $('#cfgOptionEditSortOrder');

    if (!$modal.length || !$save.length || !$id.length || !$label.length || !$color.length || !$sort.length || !item) {
      return Promise.resolve(null);
    }

    $id.val(item.id || '');
    $label.val(item.label || '');
    $color.val(item.color || '#64748B');
    $sort.val(toInt(item.sort_order, 0));

    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        $save.off('click.cfgeditoption');
        $modal.off('hidden.bs.modal.cfgeditoption');
        resolve(value);
      };

      $save.on('click.cfgeditoption', function () {
        const nextLabel = normalizeText($label.val());
        if (!nextLabel) {
          showToast(tt('page.settings.options.valueLabelRequired', 'Value e label sao obrigatorios.'), 'danger');
          $label.focus();
          return;
        }
        finish({
          id: normalizeText($id.val()),
          label: nextLabel,
          color: normalizeText($color.val()) || '#64748B',
          sort_order: toInt($sort.val(), 0),
        });
        $modal.modal('hide');
      });

      $modal.on('hidden.bs.modal.cfgeditoption', function () {
        finish(null);
      });

      $modal.modal('show');
      setTimeout(() => $label.focus(), 50);
    });
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

  function normalizeAreaItems(rawItems, existingEntities) {
    const seenEntities = existingEntities instanceof Set ? existingEntities : new Set();
    return (Array.isArray(rawItems) ? rawItems : [])
      .map((item, itemIndex) => {
        const meta = getEntityByName(item?.entity);
        if (!meta) return null;
        if (seenEntities.has(meta.entity)) return null;
        seenEntities.add(meta.entity);
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
  }

  function normalizeMenuConfig(config) {
    const source = config && typeof config === 'object' ? config : { areas: [] };
    const areas = Array.isArray(source.areas) ? source.areas : [];
    const seenAreaIds = new Set();
    const migrateToHomeRawItems = [];

    const normalizedAreas = areas
      .map((area, areaIndex) => {
        const areaLabel = normalizeText(area?.label) || `Area ${areaIndex + 1}`;
        const areaId = slugify(area?.id || areaLabel, `area_${areaIndex + 1}`);
        const areaOrder = toInt(area?.order, (areaIndex + 1) * 10);
        const isHome = areaId === 'home';
        const rawItems = Array.isArray(area?.items) ? area.items : [];

        if (!isHome && (isBlockedAreaId(areaId))) {
          migrateToHomeRawItems.push(...rawItems);
          return null;
        }
        if (seenAreaIds.has(areaId)) return null;
        seenAreaIds.add(areaId);

        const items = normalizeAreaItems(rawItems);

        return {
          id: areaId,
          label: isHome ? 'Home' : areaLabel,
          order: areaOrder,
          items,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.order - b.order)
      .map((area, idx) => ({ ...area, order: (idx + 1) * 10 }));

    if (!normalizedAreas.length) {
      return { default_area: 'home', areas: [{ id: 'home', label: 'Home', order: 10, items: [] }] };
    }

    if (!normalizedAreas.some((area) => String(area.id) === 'home')) {
      normalizedAreas.unshift({ id: 'home', label: 'Home', order: 0, items: [] });
    }

    const homeArea = normalizedAreas.find((area) => String(area.id) === 'home');
    if (homeArea) {
      const homeSeenEntities = new Set((homeArea.items || []).map((item) => String(item?.entity || '')));
      const migratedItems = normalizeAreaItems(migrateToHomeRawItems, homeSeenEntities);
      if (migratedItems.length) {
        homeArea.items = [...(homeArea.items || []), ...migratedItems]
          .sort((a, b) => a.order - b.order)
          .map((item, idx) => ({ ...item, order: (idx + 1) * 10 }));
      }

      if (!Array.isArray(homeArea.items) || !homeArea.items.length) {
        homeArea.items = (state.entities || [])
          .filter((meta) => String(meta?.entity || '') !== 'users')
          .map((meta, idx) => ({
            entity: meta.entity,
            label: meta.label,
            icon: meta.icon,
            route: meta.route,
            order: (idx + 1) * 10,
          }));
      }
    }

    const normalized = normalizedAreas.map((area, idx) => ({ ...area, order: (idx + 1) * 10 }));
    const allowed = new Set(normalized.map((area) => String(area.id || '').trim().toLowerCase()));
    const sourceDefaultArea = slugify(source?.default_area || 'home', 'home');
    const defaultArea = allowed.has(sourceDefaultArea) ? sourceDefaultArea : 'home';

    return { default_area: defaultArea, areas: normalized };
  }

  function getSelectedArea() {
    const areas = state.menuConfig?.areas || [];
    const selected = areas.find((area) => String(area.id) === String(state.selectedAreaId || ''));
    return selected || null;
  }

  function renderDefaultAreaSelect() {
    const $select = $('#cfgDefaultAreaSelect');
    if (!$select.length) return;
    const areas = Array.isArray(state.menuConfig?.areas) ? state.menuConfig.areas : [];
    if (!areas.length) {
      $select.html('<option value="home">Home</option>').val('home');
      state.menuConfig.default_area = 'home';
      return;
    }

    const options = areas
      .map((area) => `<option value="${esc(area.id)}">${esc(area.label)} (${esc(area.id)})</option>`)
      .join('');
    $select.html(options);

    const allowed = new Set(areas.map((area) => String(area.id || '').trim().toLowerCase()));
    const current = slugify(state.menuConfig?.default_area || 'home', 'home');
    const selected = allowed.has(current) ? current : 'home';
    state.menuConfig.default_area = selected;
    $select.val(selected);
  }

  function renderAreaList() {
    const $list = $('#cfgAreaList');
    if (!$list.length) return;
    const areas = state.menuConfig?.areas || [];

    if (!areas.length) {
      $list.html(`<li class="cfg-muted" style="cursor:default;">${esc(tt('page.settings.menu.noAreas', 'Nenhuma area.'))}</li>`);
      $('#cfgAreaEditor').html(`<p class="cfg-muted">${esc(tt('page.settings.menu.selectAreaHelp', 'Selecione uma area para editar.'))}</p>`);
      renderDefaultAreaSelect();
      return;
    }

    const html = areas
      .map((area) => {
        const active = String(area.id) === String(state.selectedAreaId || '') ? 'active' : '';
        const isCore = String(area.id || '') !== 'home' && isCoreAreaId(area.id);
        const classes = [active, isCore ? 'cfg-area-core' : ''].filter(Boolean).join(' ');
        const homeBadge = String(area.id) === 'home' ? ` <span class="cfg-badge">${esc(tt('page.settings.menu.home', 'Home'))}</span>` : '';
        const coreBadge = isCore ? ` <span class="cfg-badge">${esc(tt('page.settings.menu.coreArea', 'Core'))}</span>` : '';
        return `<li class="${classes}" data-area-id="${esc(area.id)}"><strong>${esc(area.label)}</strong>${homeBadge}${coreBadge}<br/><span class="cfg-muted">id: ${esc(area.id)}</span></li>`;
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

    renderDefaultAreaSelect();
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
    const isCore = !isHome && isCoreAreaId(area.id);
    const isLocked = isCore;

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
          <button type="button" class="btn btn-xs btn-danger js-cfg-remove-item" data-entity="${esc(item.entity)}" ${isLocked ? 'disabled' : ''}><i class="fa fa-trash"></i></button>
        </div>
      </li>`,
          )
          .join('')
      : `<li class="cfg-muted" style="cursor:default;">${esc(tt('page.settings.menu.noItemsInArea', 'Sem itens na area.'))}</li>`;

    $editor.html(`
      ${isLocked ? `<div class="alert alert-info" style="margin-bottom:10px;">${esc(tt('page.settings.menu.coreAreaLocked', 'Esta área é core do sistema e não pode ser editada nesta tela.'))}</div>` : ''}
      <div class="row">
        <div class="col-md-5 form-group">
          <label>${esc(tt('page.settings.menu.areaId', 'Area ID'))}</label>
          <input type="text" class="form-control" id="cfgAreaId" value="${esc(area.id)}" ${(isHome || isLocked) ? 'readonly' : ''} />
        </div>
        <div class="col-md-5 form-group">
          <label>${esc(tt('page.settings.common.label', 'Label'))}</label>
          <input type="text" class="form-control" id="cfgAreaLabel" value="${esc(area.label)}" ${(isHome || isLocked) ? 'readonly' : ''} />
        </div>
        <div class="col-md-2 form-group" style="padding-top:24px;">
          <button type="button" class="btn btn-danger btn-sm" id="btnCfgDeleteArea" ${(isHome || isLocked) ? 'disabled' : ''}><i class="fa fa-trash"></i></button>
        </div>
      </div>

      <div class="row" style="margin-bottom:10px;">
        <div class="col-md-4 form-group">
          <label>${esc(tt('page.settings.options.entity', 'Entidade'))}</label>
          <select class="form-control" id="cfgAreaNewEntity" ${isLocked ? 'disabled' : ''}>${entityOptions}</select>
        </div>
        <div class="col-md-3 form-group" style="padding-top:24px;">
          <button type="button" class="btn btn-success btn-sm" id="btnCfgAddAreaItem" ${isLocked ? 'disabled' : ''}><i class="fa fa-plus"></i> ${esc(tt('page.settings.menu.item', 'Item'))}</button>
        </div>
      </div>

      <ul id="cfgAreaItemList" class="cfg-item-list">${itemsHtml}</ul>
    `);

    if ($.fn.select2 && !isLocked) {
      const $entitySelect = $('#cfgAreaNewEntity');
      $entitySelect.select2({
        width: '100%',
        placeholder: tt('page.settings.options.entity', 'Entidade'),
        allowClear: false,
      });
    }

    $('#cfgAreaId').off('input').on('input', function () {
      if (isHome || isLocked) return;
      const nextId = slugify(this.value, area.id);
      if (isBlockedAreaId(nextId) && nextId !== 'home') {
        showToast(tt('page.settings.menu.reservedArea', 'Esse ID de area nao e permitido.'), 'danger');
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
      if (isHome || isLocked) return;
      area.label = normalizeText(this.value) || area.label;
      renderAreaList();
    });

    $('#btnCfgDeleteArea').off('click').on('click', async function () {
      if (isHome || isLocked) return;
      const ok = await openConfirmModal(tt('page.settings.menu.confirmDeleteArea', 'Deseja remover esta area?'), {
        title: tt('page.settings.common.confirm', 'Confirmar'),
        okClass: 'btn-danger',
      });
      if (!ok) return;
      state.menuConfig.areas = (state.menuConfig.areas || []).filter((item) => String(item.id) !== String(area.id));
      state.selectedAreaId = state.menuConfig.areas?.[0]?.id || null;
      renderAreaList();
    });

    $('#btnCfgAddAreaItem').off('click').on('click', function () {
      if (isLocked) return;
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
      if (isLocked) return;
      const entity = String($(this).data('entity') || '');
      area.items = (area.items || []).filter((item) => String(item.entity) !== entity);
      renderAreaEditor();
    });

    const itemListEl = document.getElementById('cfgAreaItemList');
    if (itemListEl && window.Sortable && !isLocked) {
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

  function fillLandingPageForm(payload) {
    const row = payload && typeof payload === 'object' ? payload : {};
    $('#cfgLandingPageUrl').val(row.landing_page_url || '');
    $('#cfgLandingUpdatedAt').text(formatDateTime(row.updated_at));
    $('#cfgLandingPublishedAt').text(formatDateTime(row.published_at));
  }

  async function loadLandingPage() {
    const data = await api('/api/admin/landing-page');
    state.landingPage = data && typeof data === 'object' ? data : {};
    state.landingAiDraft = null;
    state.landingAiSelectedVersionIndex = 0;
    fillLandingPageForm(state.landingPage);
    syncLandingAiDraftUi();
  }

  async function saveLandingPageUrl() {
    setButtonLoading('#btnCfgLandingSaveUrl', true);
    try {
      const payload = { landing_page_url: normalizeText($('#cfgLandingPageUrl').val()) || null };
      state.landingPage = await api('/api/admin/landing-page/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      fillLandingPageForm(state.landingPage);
      showToast(tt('page.settings.landing.urlSaved', 'URL da landing page salva com sucesso.'), 'success');
    } finally {
      setButtonLoading('#btnCfgLandingSaveUrl', false);
    }
  }

  function getLandingAiVersions() {
    if (!state.landingAiDraft || typeof state.landingAiDraft !== 'object') return [];
    const versions = Array.isArray(state.landingAiDraft.versions) ? state.landingAiDraft.versions : [];
    const normalized = versions
      .map((item, idx) => {
        const html = normalizeText(item?.html);
        if (!html) return null;
        return {
          title: normalizeText(item?.title) || `Versao ${idx + 1}`,
          html,
          css: String(item?.css || ''),
        };
      })
      .filter(Boolean);
    if (normalized.length) return normalized;

    const fallbackHtml = normalizeText(state.landingAiDraft.html);
    if (!fallbackHtml) return [];
    return [
      {
        title: normalizeText(state.landingAiDraft.title) || 'Versao 1',
        html: fallbackHtml,
        css: String(state.landingAiDraft.css || ''),
      },
    ];
  }

  function getSelectedLandingAiVersion() {
    const versions = getLandingAiVersions();
    if (!versions.length) return null;
    const safeIndex = Math.max(0, Math.min(toInt(state.landingAiSelectedVersionIndex, 0), versions.length - 1));
    state.landingAiSelectedVersionIndex = safeIndex;
    return versions[safeIndex];
  }

  function renderLandingAiVersionButtons() {
    const $root = $('#cfgLandingAiVersions');
    if (!$root.length) return;
    const versions = getLandingAiVersions();
    if (!versions.length) {
      $root
        .addClass('cfg-muted')
        .html(
          esc(
            tt(
              'page.settings.landing.aiVersionsHint',
              'Gere com IA para receber 3 versões de layout.',
            ),
          ),
        );
      return;
    }

    const safeIndex = Math.max(0, Math.min(toInt(state.landingAiSelectedVersionIndex, 0), versions.length - 1));
    state.landingAiSelectedVersionIndex = safeIndex;

    const html = versions
      .map((version, idx) => {
        const active = idx === safeIndex ? 'active' : '';
        const title = normalizeText(version?.title) || `Versao ${idx + 1}`;
        return `<button type="button" class="btn btn-white btn-sm ${active}" data-version-index="${idx}" title="${esc(title)}">Versao ${idx + 1}: ${esc(title)}</button>`;
      })
      .join('');
    $root.removeClass('cfg-muted').html(html);
  }

  function syncLandingAiDraftUi() {
    const hasDraft = !!getSelectedLandingAiVersion();
    $('#btnCfgLandingAiPreview').prop('disabled', !hasDraft);
    $('#btnCfgLandingAiUseInEditor').prop('disabled', !hasDraft);
    $('#cfgLandingAiGeneratedAt').text(hasDraft ? formatDateTime(state.landingAiDraft.generated_at) : '-');
    renderLandingAiVersionButtons();
  }

  function buildLandingPreviewDocument(html, css) {
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Preview Landing IA</title>
  <link href="/Assets/inspinia/css/bootstrap.min.css" rel="stylesheet" />
  <link href="/Assets/inspinia/css/animate.css" rel="stylesheet" />
  <link href="/Assets/inspinia/font-awesome/css/font-awesome.min.css" rel="stylesheet" />
  <link href="/Assets/inspinia/css/style.css" rel="stylesheet" />
  <style>${String(css || '')}</style>
</head>
<body id="page-top" class="landing-page no-skin-config">
${String(html || '')}
</body>
</html>`;
  }

  async function generateLandingPageWithAi() {
    const prompt = normalizeText($('#cfgLandingAiPrompt').val());
    if (!prompt) {
      showToast(tt('page.settings.landing.aiPromptRequired', 'Informe um prompt para gerar a landing page com IA.'), 'danger');
      $('#cfgLandingAiPrompt').focus();
      return;
    }

    setButtonLoading('#btnCfgLandingAiGenerate', true);
    try {
      const generated = await api('/api/admin/landing-page/generate-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ prompt }),
      });

      state.landingAiDraft = generated && typeof generated === 'object' ? generated : null;
      state.landingAiSelectedVersionIndex = toInt(generated?.selected_version_index, 0);
      syncLandingAiDraftUi();
      const versionsCount = getLandingAiVersions().length;
      showToast(
        versionsCount > 1
          ? tt('page.settings.landing.aiGeneratedVersions', 'Landing page gerada com IA em multiplas versoes. Escolha uma para preview.')
          : tt('page.settings.landing.aiGenerated', 'Landing page gerada com IA. Voce ja pode visualizar no preview.'),
        'success',
      );
    } finally {
      setButtonLoading('#btnCfgLandingAiGenerate', false);
    }
  }

  function openLandingAiPreview() {
    const selectedVersion = getSelectedLandingAiVersion();
    if (!selectedVersion) {
      showToast(tt('page.settings.landing.aiNoDraft', 'Gere uma landing page com IA antes de abrir o preview.'), 'info');
      return;
    }
    const srcdoc = buildLandingPreviewDocument(selectedVersion.html, selectedVersion.css || '');
    const frame = document.getElementById('cfgLandingAiPreviewFrame');
    if (frame) frame.srcdoc = srcdoc;
    $('#cfgLandingAiPreviewModal').modal('show');
  }

  async function applyLandingAiDraftInEditor() {
    const selectedVersion = getSelectedLandingAiVersion();
    if (!selectedVersion) {
      showToast(tt('page.settings.landing.aiNoDraft', 'Gere uma landing page com IA antes de aplicar no editor.'), 'info');
      return;
    }
    const proceed = window.confirm(tt('page.settings.landing.aiApplyConfirm', 'Aplicar o resultado da IA no editor? Isso pode sobrescrever mudancas nao salvas.'));
    if (!proceed) return;

    await openLandingPageEditor();
    if (!landingEditor) return;
    landingEditor.setComponents(String(selectedVersion.html || ''));
    landingEditor.setStyle(String(selectedVersion.css || ''));
    if (typeof landingEditor.refresh === 'function') {
      setTimeout(() => landingEditor.refresh(), 50);
    }
    showToast(tt('page.settings.landing.aiApplied', 'Resultado da IA aplicado no editor.'), 'success');
  }

  function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Falha ao carregar arquivo.'));
      reader.readAsDataURL(file);
    });
  }

  async function fetchDefaultLandingTemplateHtml() {
    const resp = await fetch('/LandingPage?template=1', { credentials: 'include' });
    if (!resp.ok) throw new Error(`Falha ao carregar template base da landing page (HTTP ${resp.status}).`);
    return resp.text();
  }

  function extractBodyFromHtmlDocument(html) {
    const raw = String(html || '');
    if (!raw) return '';
    try {
      const parser = new window.DOMParser();
      const doc = parser.parseFromString(raw, 'text/html');
      const scripts = doc.querySelectorAll('script');
      scripts.forEach((item) => item.remove());
      return String(doc?.body?.innerHTML || raw);
    } catch {
      return raw;
    }
  }

  async function ensureLandingEditor() {
    if (landingEditor) return landingEditor;
    if (landingEditorReadyPromise) return landingEditorReadyPromise;

    landingEditorReadyPromise = (async () => {
      const $root = $('#cfgLandingEditorRoot');
      $root.html(`<div style="padding:16px;"><i class="fa fa-spinner fa-spin"></i> ${esc(tt('page.settings.common.loading', 'Carregando...'))}</div>`);

      if (!window.grapesjs) {
        throw new Error('Editor visual indisponível. Verifique o carregamento do GrapesJS.');
      }

      const defaultTemplateHtml = await fetchDefaultLandingTemplateHtml();
      const fallbackHtml = extractBodyFromHtmlDocument(defaultTemplateHtml);
      const initialHtml = normalizeText(state.landingPage?.draft_html) || normalizeText(state.landingPage?.published_html) || fallbackHtml;
      const initialCss = String(state.landingPage?.draft_css || state.landingPage?.published_css || '');
      const initialProject =
        state.landingPage?.draft_project_json && typeof state.landingPage.draft_project_json === 'object'
          ? state.landingPage.draft_project_json
          : state.landingPage?.published_project_json && typeof state.landingPage.published_project_json === 'object'
            ? state.landingPage.published_project_json
            : null;

      landingEditor = window.grapesjs.init({
        container: '#cfgLandingEditorRoot',
        fromElement: false,
        height: '100%',
        width: 'auto',
        storageManager: false,
        selectorManager: { componentFirst: true },
        allowScripts: true,
        plugins: window.grapesjsPresetWebpage ? ['gjs-preset-webpage'] : [],
        pluginsOpts: window.grapesjsPresetWebpage
          ? {
              'gjs-preset-webpage': {
                blocksBasicOpts: { flexGrid: true },
              },
            }
          : {},
        assetManager: {
          upload: false,
          uploadFile: async (event) => {
            const files = event?.dataTransfer?.files || event?.target?.files;
            if (!files || !files.length) return;
            const assets = [];
            for (const file of Array.from(files)) {
              const dataUrl = await fileToDataUrl(file);
              if (!dataUrl) continue;
              assets.push({ src: dataUrl, name: file.name, type: 'image' });
            }
            if (assets.length) landingEditor.AssetManager.add(assets);
          },
        },
        canvas: {
          styles: [
            '/Assets/inspinia/css/bootstrap.min.css',
            '/Assets/inspinia/css/animate.css',
            '/Assets/inspinia/font-awesome/css/font-awesome.min.css',
            '/Assets/inspinia/css/style.css',
          ],
          scripts: [
            '/Assets/inspinia/js/jquery-3.1.1.min.js',
            '/Assets/inspinia/js/popper.min.js',
            '/Assets/inspinia/js/bootstrap.js',
          ],
        },
      });

      if (initialProject && typeof landingEditor.loadProjectData === 'function') {
        landingEditor.loadProjectData(initialProject);
      } else {
        landingEditor.setComponents(initialHtml || '<section class="container"><h1>Nova Landing Page</h1></section>');
        landingEditor.setStyle(initialCss || '');
      }

      if (!window.grapesjsPresetWebpage) {
        landingEditor.BlockManager.add('cfg-basic-section', {
          label: 'Nova Seção',
          category: 'Layout',
          content:
            '<section class="container" style="padding:30px 0;"><div class="row"><div class="col-md-12"><h2>Novo título</h2><p>Edite este texto, mova elementos e personalize sua seção.</p><a class="btn btn-primary" href="#">Novo botão</a></div></div></section>',
        });
      }

      return landingEditor;
    })();

    try {
      return await landingEditorReadyPromise;
    } catch (error) {
      landingEditor = null;
      throw error;
    } finally {
      landingEditorReadyPromise = null;
    }
  }

  async function openLandingPageEditor() {
    $('#cfgLandingEditorModal').modal('show');
    const editor = await ensureLandingEditor();
    if (editor && typeof editor.refresh === 'function') {
      setTimeout(() => editor.refresh(), 60);
    }
  }

  function collectLandingEditorPayload() {
    if (!landingEditor) {
      throw new Error('Editor da landing page ainda não foi iniciado.');
    }
    return {
      html: String(landingEditor.getHtml() || ''),
      css: String(landingEditor.getCss() || ''),
      project_json: landingEditor.getProjectData(),
    };
  }

  async function persistLandingPageContent(mode) {
    const normalizedMode = String(mode || '').toLowerCase() === 'publish' ? 'publish' : 'save';
    const endpoint = normalizedMode === 'publish' ? '/api/admin/landing-page/publish' : '/api/admin/landing-page/content';
    const method = normalizedMode === 'publish' ? 'POST' : 'PUT';
    const buttonSelector = normalizedMode === 'publish' ? '#btnCfgLandingEditorPublish' : '#btnCfgLandingEditorSave';

    setButtonLoading(buttonSelector, true);
    try {
      const payload = collectLandingEditorPayload();
      state.landingPage = await api(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      fillLandingPageForm(state.landingPage);
      showToast(
        normalizedMode === 'publish'
          ? tt('page.settings.landing.published', 'Landing page publicada com sucesso.')
          : tt('page.settings.landing.saved', 'Landing page salva com sucesso.'),
        'success',
      );
    } finally {
      setButtonLoading(buttonSelector, false);
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
    const field = String($('#cfgOptionField').val() || '');
    const query = [`entity=${encodeURIComponent(entity)}`];
    if (field) query.push(`field=${encodeURIComponent(field)}`);
    const data = await api(`/api/admin/option-sets?${query.join('&')}`);
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

      const edited = await openEditOptionModal(option);
      if (!edited) return;

      await api(`/api/admin/options/${encodeURIComponent(optionId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          label: edited.label,
          color: edited.color,
          sort_order: toInt(edited.sort_order, 0),
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

  function getSelectedAccessRoleMeta() {
    return (state.accessRoles || []).find((item) => String(item.id) === String(state.selectedAccessRoleId || '')) || null;
  }

  function fillAccessRoleMetaForm(role) {
    const item = role || null;
    $('#cfgAccessRoleName').val(item?.name || '');
    $('#cfgAccessRoleCode').val(item?.code || '');
    $('#cfgAccessRoleDescription').val(item?.description || '');
    $('#cfgAccessRoleActive').val(item?.is_active ? '1' : '0');

    const locked = !!item?.lock_permissions;
    $('#cfgAccessRoleCode').prop('readonly', !!item?.is_system);
    $('#cfgAccessRoleActive').prop('disabled', !!(item?.is_system && String(item?.code || '').toUpperCase() === 'ADMIN'));
    $('#btnCfgAccessDeleteRole').prop('disabled', !item || !!item.is_system);
    $('#btnCfgAccessSaveRolePerms').prop('disabled', !item || locked);
  }

  function renderAccessRoleList() {
    const $list = $('#cfgAccessRoleList');
    const items = state.accessRoles || [];
    if (!items.length) {
      $list.html(`<li class="cfg-muted" style="cursor:default;">${esc(tt('page.settings.access.noRoles', 'Nenhuma role cadastrada.'))}</li>`);
      fillAccessRoleMetaForm(null);
      $('#cfgAccessPermTable tbody').html(`<tr><td colspan="5">${esc(tt('page.settings.access.selectRoleHelp', 'Selecione uma role para editar permissões.'))}</td></tr>`);
      return;
    }

    $list.html(
      items
        .map((role) => {
          const active = String(role.id) === String(state.selectedAccessRoleId || '') ? 'active cfg-access-role-item' : 'cfg-access-role-item';
          const systemBadge = role.is_system ? `<span class="cfg-badge">${esc(tt('page.settings.access.systemRole', 'Sistema'))}</span>` : '';
          const lockedBadge = role.lock_permissions ? ` <span class="cfg-badge">LOCK</span>` : '';
          const statusBadge = role.is_active
            ? `<span class="cfg-badge">${esc(tt('page.settings.access.active', 'Ativa'))}</span>`
            : `<span class="cfg-badge">${esc(tt('page.settings.access.inactive', 'Inativa'))}</span>`;
          return `
            <li class="${active}" data-role-id="${esc(role.id)}">
              <div style="display:flex; justify-content:space-between; gap:8px;">
                <strong>${esc(role.name || role.code)}</strong>
                <span>${systemBadge}${lockedBadge} ${statusBadge}</span>
              </div>
              <div class="cfg-muted">${esc(role.code)} | ${esc(String(role.user_count || 0))} user(s)</div>
            </li>
          `;
        })
        .join('')
    );

    $list.find('li[data-role-id]').off('click').on('click', function () {
      const roleId = String($(this).data('role-id') || '');
      selectAccessRole(roleId).catch((e) => showToast(e.message, 'danger'));
    });
  }

  function renderAccessPermissionTable() {
    const $tbody = $('#cfgAccessPermTable tbody');
    const details = state.selectedAccessRoleDetails;
    if (!details || !Array.isArray(details.items) || !details.items.length) {
      $tbody.html(`<tr><td colspan="5">${esc(tt('page.settings.access.selectRoleHelp', 'Selecione uma role para editar permissoes.'))}</td></tr>`);
      return;
    }

    const search = normalizeText($('#cfgAccessPermSearch').val()).toLowerCase();
    state.accessPermSearch = search;
    const filteredItems = (details.items || []).filter((item) => {
      if (!search) return true;
      const entity = String(item.entity || '').toLowerCase();
      const label = String(item.label || '').toLowerCase();
      return entity.includes(search) || label.includes(search);
    });
    if (!filteredItems.length) {
      $tbody.html(`<tr><td colspan="5">${esc(tt('page.settings.access.noTablesFound', 'Nenhuma tabela encontrada para o filtro informado.'))}</td></tr>`);
      return;
    }

    const locked = !!details.role?.lock_permissions;
    $tbody.html(
      filteredItems
        .map((item) => `
          <tr data-entity="${esc(item.entity)}">
            <td>
              <strong>${esc(item.label || item.entity)}</strong><br/>
              <span class="cfg-muted">${esc(item.entity)}</span>
            </td>
            <td><input type="checkbox" class="js-cfg-access-perm" data-action="can_read" ${item.can_read ? 'checked' : ''} ${locked ? 'disabled' : ''} /></td>
            <td><input type="checkbox" class="js-cfg-access-perm" data-action="can_create" ${item.can_create ? 'checked' : ''} ${locked ? 'disabled' : ''} /></td>
            <td><input type="checkbox" class="js-cfg-access-perm" data-action="can_update" ${item.can_update ? 'checked' : ''} ${locked ? 'disabled' : ''} /></td>
            <td><input type="checkbox" class="js-cfg-access-perm" data-action="can_delete" ${item.can_delete ? 'checked' : ''} ${locked ? 'disabled' : ''} /></td>
          </tr>
        `)
        .join('')
    );
  }

  function collectAccessPermissionPayload() {
    const rows = [];
    $('#cfgAccessPermTable tbody tr[data-entity]').each(function () {
      const $tr = $(this);
      const entity = String($tr.data('entity') || '').trim().toLowerCase();
      if (!entity) return;
      rows.push({
        entity,
        can_read: !!$tr.find('input[data-action="can_read"]').prop('checked'),
        can_create: !!$tr.find('input[data-action="can_create"]').prop('checked'),
        can_update: !!$tr.find('input[data-action="can_update"]').prop('checked'),
        can_delete: !!$tr.find('input[data-action="can_delete"]').prop('checked'),
      });
    });
    return rows;
  }

  async function loadAccessRoles() {
    const data = await api('/api/admin/access/roles');
    state.accessRoles = Array.isArray(data?.items) ? data.items : [];
    if (!state.selectedAccessRoleId && state.accessRoles.length > 0) {
      state.selectedAccessRoleId = state.accessRoles[0].id;
    }
    if (state.selectedAccessRoleId && !state.accessRoles.some((item) => String(item.id) === String(state.selectedAccessRoleId))) {
      state.selectedAccessRoleId = state.accessRoles?.[0]?.id || null;
    }
    renderAccessRoleList();
    if (state.selectedAccessRoleId) {
      await selectAccessRole(state.selectedAccessRoleId);
    }
  }

  async function selectAccessRole(roleId) {
    if (!roleId) {
      state.selectedAccessRoleId = null;
      state.selectedAccessRoleDetails = null;
      renderAccessRoleList();
      renderAccessPermissionTable();
      fillAccessRoleMetaForm(null);
      return;
    }

    state.selectedAccessRoleId = roleId;
    renderAccessRoleList();
    const details = await api(`/api/admin/access/roles/${encodeURIComponent(roleId)}/permissions`);
    state.selectedAccessRoleDetails = details;

    const roleMeta = getSelectedAccessRoleMeta();
    fillAccessRoleMetaForm(roleMeta || details?.role || null);
    renderAccessPermissionTable();
  }

  async function createAccessRole() {
    const modalData = await openCreateRoleModal();
    if (!modalData) return;

    const payload = { name: modalData.name };
    if (normalizeText(modalData.code)) payload.code = normalizeText(modalData.code);

    const created = await api('/api/admin/access/roles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    showToast(tt('page.settings.access.roleCreated', 'Role criada com sucesso.'), 'success');
    state.selectedAccessRoleId = created?.id || null;
    await loadAccessRoles();
  }
  async function saveAccessRoleMeta() {
    const role = getSelectedAccessRoleMeta();
    if (!role) {
      showToast(tt('page.settings.access.selectRoleHelp', 'Selecione uma role.'), 'danger');
      return;
    }

    const payload = {
      name: normalizeText($('#cfgAccessRoleName').val()),
      description: normalizeText($('#cfgAccessRoleDescription').val()),
      is_active: String($('#cfgAccessRoleActive').val()) === '1',
    };

    if (!role.is_system) {
      const roleCode = normalizeText($('#cfgAccessRoleCode').val());
      if (roleCode) payload.code = roleCode;
    }

    await api(`/api/admin/access/roles/${encodeURIComponent(role.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });

    showToast(tt('page.settings.access.roleUpdated', 'Role atualizada com sucesso.'), 'success');
    await loadAccessRoles();
  }

  async function deleteAccessRole() {
    const role = getSelectedAccessRoleMeta();
    if (!role) return;
    if (role.is_system) {
      showToast(tt('page.settings.access.systemRoleDeleteBlocked', 'Roles de sistema não podem ser removidas.'), 'danger');
      return;
    }

    const ok = await openConfirmModal(tt('page.settings.access.confirmDeleteRole', 'Deseja excluir a role selecionada?'), {
      title: tt('page.settings.common.confirm', 'Confirmar'),
      okClass: 'btn-danger',
    });
    if (!ok) return;

    await api(`/api/admin/access/roles/${encodeURIComponent(role.id)}`, { method: 'DELETE' });
    showToast(tt('page.settings.access.roleDeleted', 'Role removida com sucesso.'), 'success');
    state.selectedAccessRoleId = null;
    state.selectedAccessRoleDetails = null;
    await loadAccessRoles();
  }

  async function saveAccessRolePermissions() {
    const role = getSelectedAccessRoleMeta();
    if (!role) {
      showToast(tt('page.settings.access.selectRoleHelp', 'Selecione uma role.'), 'danger');
      return;
    }
    if (role.lock_permissions) {
      showToast(tt('page.settings.access.lockedRolePermissions', 'Permissões desta role são bloqueadas.'), 'danger');
      return;
    }

    const permissions = collectAccessPermissionPayload();
    await api(`/api/admin/access/roles/${encodeURIComponent(role.id)}/permissions`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ permissions }),
    });

    showToast(tt('page.settings.access.permissionsSaved', 'Permissões da role salvas com sucesso.'), 'success');
    await selectAccessRole(role.id);
  }

  async function loadAccessUsers(searchTerm) {
    const q = normalizeText(searchTerm);
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    const data = await api(`/api/admin/access/users${qs}`);
    state.accessUsers = Array.isArray(data?.items) ? data.items : [];
    if (state.selectedAccessUserId && !state.accessUsers.some((item) => String(item.id) === String(state.selectedAccessUserId))) {
      state.selectedAccessUserId = null;
      state.selectedAccessUserDetails = null;
    }
    renderAccessUsersTable();
  }

  function renderAccessUsersTable() {
    const $tbody = $('#cfgAccessUsersTable tbody');
    const rows = state.accessUsers || [];
    if (!rows.length) {
      $tbody.html(`<tr><td colspan="2">${esc(tt('page.settings.access.noUsers', 'Nenhum usuário encontrado.'))}</td></tr>`);
      return;
    }

    $tbody.html(
      rows
        .map((row) => {
          const active = String(row.id) === String(state.selectedAccessUserId || '') ? ' style="background:#f3fbfa;"' : '';
          return `
            <tr data-user-id="${esc(row.id)}"${active}>
              <td>
                <strong>${esc(row.full_name || row.email)}</strong><br/>
                <span class="cfg-muted">${esc(row.email || '-')}</span>
              </td>
              <td>${esc(String(row.legacy_role || 'USER'))}</td>
            </tr>
          `;
        })
        .join('')
    );

    $tbody.find('tr[data-user-id]').off('click').on('click', function () {
      const userId = String($(this).data('user-id') || '');
      selectAccessUser(userId).catch((e) => showToast(e.message, 'danger'));
    });
  }

  async function selectAccessUser(userId) {
    if (!userId) {
      state.selectedAccessUserId = null;
      state.selectedAccessUserDetails = null;
      $('#cfgAccessUserRolesEditor').html(`<span class="cfg-muted">${esc(tt('page.settings.access.selectUserHelp', 'Selecione um usuário para editar roles.'))}</span>`);
      return;
    }

    state.selectedAccessUserId = userId;
    renderAccessUsersTable();
    const details = await api(`/api/admin/access/users/${encodeURIComponent(userId)}/roles`);
    state.selectedAccessUserDetails = details;
    renderAccessUserRolesEditor();
  }

  function renderAccessUserRolesEditor() {
    const details = state.selectedAccessUserDetails;
    const $container = $('#cfgAccessUserRolesEditor');
    if (!details || !details.user) {
      $container.html(`<span class="cfg-muted">${esc(tt('page.settings.access.selectUserHelp', 'Selecione um usuário para editar roles.'))}</span>`);
      return;
    }

    const roles = Array.isArray(details.roles) ? details.roles : [];
    if (!roles.length) {
      $container.html(`<span class="cfg-muted">${esc(tt('page.settings.access.noRoles', 'Nenhuma role cadastrada.'))}</span>`);
      return;
    }

    $container.html(`
      <div style="margin-bottom:8px;">
        <strong>${esc(details.user.full_name || details.user.email)}</strong><br/>
        <span class="cfg-muted">${esc(details.user.email || '')} | ${esc(String(details.user.legacy_role || 'USER'))}</span>
      </div>
      <div id="cfgAccessUserRoleChecks">
        ${roles
          .map((role) => `
            <div class="checkbox" style="margin:4px 0;">
              <label>
                <input type="checkbox" class="js-cfg-access-user-role" value="${esc(role.id)}" ${role.selected ? 'checked' : ''} />
                <strong>${esc(role.name || role.code)}</strong> <span class="cfg-badge">${esc(role.code || '')}</span>
              </label>
            </div>
          `)
          .join('')}
      </div>
    `);
  }

  async function saveAccessUserRoles() {
    const userId = String(state.selectedAccessUserId || '').trim();
    if (!userId) {
      showToast(tt('page.settings.access.selectUserHelp', 'Selecione um usuário para editar roles.'), 'danger');
      return;
    }

    const roleIds = [];
    $('#cfgAccessUserRoleChecks .js-cfg-access-user-role:checked').each(function () {
      const roleId = String($(this).val() || '').trim();
      if (roleId) roleIds.push(roleId);
    });

    if (!roleIds.length) {
      showToast(tt('page.settings.access.selectAtLeastOneRole', 'Selecione ao menos uma role para o usuário.'), 'danger');
      return;
    }

    await api(`/api/admin/access/users/${encodeURIComponent(userId)}/roles`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ role_ids: roleIds }),
    });

    showToast(tt('page.settings.access.userRolesSaved', 'Roles do usuário atualizadas com sucesso.'), 'success');
    await Promise.all([loadAccessUsers($('#cfgAccessUserSearch').val()), selectAccessUser(userId)]);
  }

  async function loadAccessTabData() {
    const entities = await api('/api/admin/access/entities');
    state.accessEntities = Array.isArray(entities) ? entities : [];
    await loadAccessRoles();
    await loadAccessUsers($('#cfgAccessUserSearch').val());
  }

  function createNewArea() {
    state.menuConfig = normalizeMenuConfig(state.menuConfig || {});
    const areas = Array.isArray(state.menuConfig.areas) ? state.menuConfig.areas : [];
    const existingIds = new Set(areas.map((area) => String(area?.id || '').trim().toLowerCase()).filter(Boolean));
    const newAreaLabelBase = tt('page.settings.menu.newArea', 'Nova area');
    let labelSeq = Math.max(1, areas.filter((area) => String(area?.id || '').toLowerCase() !== 'home').length + 1);
    let seq = Math.max(areas.length + 1, 2);
    let areaId = `area_${seq}`;

    while (existingIds.has(areaId) || isBlockedAreaId(areaId)) {
      seq += 1;
      labelSeq += 1;
      areaId = `area_${seq}`;
    }

    const areaLabel = `${newAreaLabelBase} ${labelSeq}`;
    areas.push({
      id: areaId,
      label: areaLabel,
      order: (areas.length + 1) * 10,
      items: [],
    });

    state.menuConfig.areas = areas.map((area, idx) => ({ ...area, order: (idx + 1) * 10 }));
    state.selectedAreaId = areaId;
    renderAreaList();
  }

  function bindEvents() {
    bindMainTabs();

    $('#btnCfgReloadMenu').on('click', () => loadMenu().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgSaveMenu').on('click', () => saveMenu().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgNewArea').on('click', createNewArea);
    $('#cfgDefaultAreaSelect').on('change', function () {
      const value = slugify(String($(this).val() || ''), 'home');
      state.menuConfig.default_area = value || 'home';
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

    $('#btnCfgLandingSaveUrl').on('click', () => saveLandingPageUrl().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgLandingOpenEditor').on('click', () => openLandingPageEditor().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgLandingAiGenerate').on('click', () => generateLandingPageWithAi().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgLandingAiPreview').on('click', openLandingAiPreview);
    $('#btnCfgLandingAiUseInEditor').on('click', () => applyLandingAiDraftInEditor().catch((e) => showToast(e.message, 'danger')));
    $('#cfgLandingAiVersions').on('click', 'button[data-version-index]', function () {
      state.landingAiSelectedVersionIndex = toInt($(this).data('version-index'), 0);
      syncLandingAiDraftUi();
    });
    $('#btnCfgLandingEditorSave').on('click', () => persistLandingPageContent('save').catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgLandingEditorPublish').on('click', () => persistLandingPageContent('publish').catch((e) => showToast(e.message, 'danger')));
    $('#cfgLandingEditorModal').on('shown.bs.modal', function () {
      if (!landingEditor || typeof landingEditor.refresh !== 'function') return;
      setTimeout(() => landingEditor.refresh(), 60);
    });
    $('#cfgLandingAiPreviewModal').on('hidden.bs.modal', function () {
      const frame = document.getElementById('cfgLandingAiPreviewFrame');
      if (frame) frame.srcdoc = '';
    });

    $('#btnCfgAccessReload').on('click', () => loadAccessTabData().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgAccessNewRole').on('click', () => createAccessRole().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgAccessDeleteRole').on('click', () => deleteAccessRole().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgAccessSaveRoleMeta').on('click', () => saveAccessRoleMeta().catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgAccessSaveRolePerms').on('click', () => saveAccessRolePermissions().catch((e) => showToast(e.message, 'danger')));
    $('#cfgAccessPermSearch').on('input', renderAccessPermissionTable);
    $('#btnCfgAccessSearchUsers').on('click', () => loadAccessUsers($('#cfgAccessUserSearch').val()).catch((e) => showToast(e.message, 'danger')));
    $('#btnCfgAccessSaveUserRoles').on('click', () => saveAccessUserRoles().catch((e) => showToast(e.message, 'danger')));
    $('#cfgAccessUserSearch').on('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      loadAccessUsers($('#cfgAccessUserSearch').val()).catch((e) => showToast(e.message, 'danger'));
    });
  }

  async function bootstrap() {
    $('#pageName').text(tt('page.settings.title', 'Configuracoes'));
    $('#subpageName').text(tt('page.settings.title', 'Configuracoes'));
    $('#path').hide();

    const metadata = await api('/api/admin/metadata/entities');
    state.entities = Array.isArray(metadata) ? metadata : [];

    renderOptionEntitySelect();
    await Promise.all([loadMenu(), loadTheme(), loadEmailIntegrations(), loadLandingPage(), loadAccessTabData()]);

    if (String($('#cfgOptionEntity').val() || '').trim()) {
      await loadOptionSets();
    }

    bindEvents();
    restoreMainTab();
  }

  $(function () {
    bootstrap().catch((error) => {
      showToast(error?.message || tt('page.settings.messages.loadFailed', 'Falha ao carregar configuracoes.'), 'danger');
    });
  });
})();




