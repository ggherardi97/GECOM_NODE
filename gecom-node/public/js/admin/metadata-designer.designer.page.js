(function () {
  const FIELD_TYPES = [
    "STRING",
    "TEXT",
    "INT",
    "DECIMAL",
    "BOOLEAN",
    "DATE",
    "DATETIME",
    "UUID",
    "JSONB",
    "LOOKUP",
  ];
  const FORM_TYPES = ["MAIN", "QUICK_CREATE", "SIDE_PANEL_CREATE"];
  const MASK_MODES = ["NONE", "STARS", "HIDDEN_TEXT"];

  const state = {
    entityId: String(window.__metadataEntityId || "").trim(),
    entity: null,
    entitiesCatalog: [],
    fields: [],
    forms: [],
    publishLog: [],
    selectedFormId: null,
    sidePanel: null,
    roles: [],
    users: [],
    profiles: [],
  };

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function normalizeArray(value) {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.items)) return value.items;
    if (Array.isArray(value?.data)) return value.data;
    return [];
  }

  async function api(url, options) {
    const response = await fetch(url, Object.assign({ credentials: "include" }, options || {}));
    const text = await response.text().catch(() => "");
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { message: text };
    }
    if (!response.ok) {
      throw new Error(data?.message || ("HTTP " + response.status));
    }
    return data;
  }

  function findFieldById(fieldId) {
    return state.fields.find((field) => String(field.id) === String(fieldId)) || null;
  }

  function normalizeName(value) {
    return String(value == null ? "" : value).trim().toLowerCase();
  }

  function lookupEntityLabel(entityId) {
    const entity = state.entitiesCatalog.find((item) => String(item.id) === String(entityId));
    return entity ? String(entity.display_name || entity.name || entity.id) : "-";
  }

  function candidateEntityNames(baseName) {
    const base = normalizeName(baseName);
    if (!base) return [];

    const candidates = new Set([base]);
    candidates.add(`${base}s`);
    candidates.add(`${base}es`);
    if (base.endsWith("y")) {
      candidates.add(`${base.slice(0, -1)}ies`);
    }
    return Array.from(candidates);
  }

  function inferLookupEntityByField(field) {
    if (!field) return null;
    if (field.lookup_entity_id) {
      const direct = state.entitiesCatalog.find((row) => String(row.id) === String(field.lookup_entity_id));
      if (direct) return direct;
    }

    const normalizedType = String(field.data_type || "").toUpperCase();
    const sourceName = normalizeName(field.column_name || field.name);
    if (!sourceName || (normalizedType !== "UUID" && normalizedType !== "LOOKUP")) return null;
    if (!sourceName.endsWith("_id")) return null;

    const base = sourceName.replace(/_id$/, "");
    const candidates = candidateEntityNames(base);
    return (
      state.entitiesCatalog.find((row) => candidates.includes(normalizeName(row.name))) || null
    );
  }

  function openSidePanel(title, html, onSave) {
    $("#mdSideTitle").text(title || "Editor");
    $("#mdSideBody").html(html || "");
    state.sidePanel = { onSave };
    $("#mdSideOverlay").addClass("is-open");
    $("#mdSidePanel").addClass("is-open");
  }

  function closeSidePanel() {
    state.sidePanel = null;
    $("#mdSideOverlay").removeClass("is-open");
    $("#mdSidePanel").removeClass("is-open");
    $("#mdSideBody").html("");
  }

  function fieldTypeOptions(selected) {
    const current = String(selected || "").toUpperCase();
    return FIELD_TYPES.map((type) => `<option value="${esc(type)}" ${type === current ? "selected" : ""}>${esc(type)}</option>`).join("");
  }

  function formTypeOptions(selected) {
    const current = String(selected || "").toUpperCase();
    return FORM_TYPES.map((type) => `<option value="${esc(type)}" ${type === current ? "selected" : ""}>${esc(type)}</option>`).join("");
  }

  function lookupEntityOptions(selected) {
    const current = String(selected || "").trim();
    return state.entitiesCatalog
      .map((row) => {
        const id = String(row.id || "");
        const label = String(row.display_name || row.name || id);
        return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${esc(label)}</option>`;
      })
      .join("");
  }

  function maskModeOptions(selected) {
    const current = String(selected || "HIDDEN_TEXT").toUpperCase();
    return MASK_MODES.map((mode) => `<option value="${esc(mode)}" ${mode === current ? "selected" : ""}>${esc(mode)}</option>`).join("");
  }

  function principalTypeOptions(selected) {
    const current = String(selected || "ROLE").toUpperCase();
    return ["ROLE", "USER"].map((type) => `<option value="${esc(type)}" ${type === current ? "selected" : ""}>${esc(type)}</option>`).join("");
  }

  function principalOptions(principalType, selected) {
    const current = String(selected || "");
    if (String(principalType || "ROLE").toUpperCase() === "USER") {
      return state.users
        .map((row) => {
          const id = String(row.id || "");
          const label = String(row.full_name || row.email || id);
          return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${esc(label)}</option>`;
        })
        .join("");
    }

    return state.roles
      .map((row) => {
        const id = String(row.id || "");
        const label = String(row.name || row.code || id);
        return `<option value="${esc(id)}" ${id === current ? "selected" : ""}>${esc(label)}</option>`;
      })
      .join("");
  }

  async function loadEntity() {
    state.entity = await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}`);
    $("#mdDesignerTitle").text(
      `Metadata Designer: ${String(state.entity?.display_name || state.entity?.name || state.entityId)}`,
    );
  }

  async function loadCatalog() {
    const firstPage = await api("/api/metadata/entities?sync_core=false&page=1&page_size=200");
    const firstItems = normalizeArray(firstPage);
    const total = Number(firstPage?.total || firstItems.length || 0);
    const pageSize = Number(firstPage?.page_size || 200);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const merged = [...firstItems];
    for (let page = 2; page <= totalPages; page += 1) {
      const payload = await api(`/api/metadata/entities?sync_core=false&page=${page}&page_size=${pageSize}`);
      merged.push(...normalizeArray(payload));
    }

    state.entitiesCatalog = merged;
  }

  async function loadFields() {
    state.fields = normalizeArray(await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/fields`));
    renderFields();
    renderRelationships();
    renderSecuritySummary();
  }

  async function loadForms() {
    state.forms = normalizeArray(await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/forms`));
    if (!state.forms.length && state.entity?.is_form_editable) {
      try {
        await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/forms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: "main",
            display_name: "Principal",
            form_type: "MAIN",
            is_default: true,
            definition_json: {
              tabs: [
                {
                  id: "principal",
                  label: "Principal",
                  sections: [
                    {
                      id: "geral",
                      label: "Geral",
                      fields: state.fields.map((field) => field.name).filter(Boolean),
                    },
                  ],
                },
              ],
            },
          }),
        });
      } catch (error) {
        const message = String(error?.message || "").toLowerCase();
        const isExpectedConflict = message.includes("already exists") || message.includes("duplicate");
        if (!isExpectedConflict) throw error;
      }

      state.forms = normalizeArray(await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/forms`));
    }

    renderForms();
    if (state.selectedFormId) {
      const selected = state.forms.find((row) => String(row.id) === String(state.selectedFormId));
      if (selected) renderFormPreview(selected);
    }
  }

  async function loadPublishLog() {
    state.publishLog = normalizeArray(await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/publish-log`));
    renderHistory();
  }

  async function loadSecurityPrincipals() {
    const [rolesData, usersData, profilesData] = await Promise.all([
      api("/api/admin/access/roles"),
      api("/api/admin/access/users?limit=200"),
      api("/api/metadata/security/profiles"),
    ]);
    state.roles = normalizeArray(rolesData);
    state.users = normalizeArray(usersData);
    state.profiles = normalizeArray(profilesData);
  }

  function renderFields() {
    const body = $("#mdFieldsBody");
    if (!state.fields.length) {
      body.html('<tr><td colspan="7" class="text-center">Nenhum campo configurado.</td></tr>');
      return;
    }

    const html = state.fields
      .map((field) => `
        <tr data-id="${esc(field.id)}">
          <td>${esc(field.display_name || "-")}</td>
          <td>${esc(field.name || "-")}</td>
          <td>${esc(field.data_type || "-")}</td>
          <td>${esc(field.is_required ? "Sim" : "Não")}</td>
          <td>${esc(field.is_unique ? "Sim" : "Não")}</td>
          <td>${esc(field.source || "-")}</td>
          <td>
            <button type="button" class="btn btn-xs btn-white js-md-edit-field" data-id="${esc(field.id)}">Editar</button>
            <button type="button" class="btn btn-xs btn-info js-md-field-security" data-id="${esc(field.id)}">Segurança</button>
            <button type="button" class="btn btn-xs btn-danger js-md-delete-field" data-id="${esc(field.id)}">Excluir</button>
          </td>
        </tr>
      `)
      .join("");
    body.html(html);
  }

  function renderRelationships() {
    const body = $("#mdRelationshipsBody");
    const relations = state.fields
      .map((field) => {
        const directLookup = String(field.data_type || "").toUpperCase() === "LOOKUP";
        const inferredEntity = inferLookupEntityByField(field);
        if (!directLookup && !inferredEntity) return null;
        return {
          field,
          targetEntity: directLookup ? lookupEntityLabel(field.lookup_entity_id) : String(inferredEntity.display_name || inferredEntity.name || "-"),
          onDelete: directLookup ? String(field.lookup_on_delete || "RESTRICT") : "INFERRED",
          sourceLabel: directLookup ? "LOOKUP" : "UUID *_id",
        };
      })
      .filter(Boolean);

    if (!relations.length) {
      body.html('<tr><td colspan="3" class="text-center">Nenhum relacionamento configurado.</td></tr>');
      return;
    }

    body.html(
      relations
        .map((relation) => `
          <tr>
            <td>${esc(relation.field.display_name || relation.field.name || "-")} <span class="label label-default" style="margin-left:6px;">${esc(relation.sourceLabel)}</span></td>
            <td>${esc(relation.targetEntity)}</td>
            <td>${esc(relation.onDelete)}</td>
          </tr>
        `)
        .join(""),
    );
  }

  function renderForms() {
    const body = $("#mdFormsBody");
    if (!state.forms.length) {
      body.html('<tr><td colspan="7" class="text-center">Nenhum formulário configurado.</td></tr>');
      return;
    }

    body.html(
      state.forms
        .map((form) => `
          <tr data-id="${esc(form.id)}">
            <td>${esc(form.name || "-")}</td>
            <td>${esc(form.display_name || "-")}</td>
            <td>${esc(form.form_type || "-")}</td>
            <td>${esc(form.is_default ? "Sim" : "Não")}</td>
            <td>${esc(form.draft_version || "-")}</td>
            <td>${esc(form.published_version == null ? "-" : form.published_version)}</td>
            <td>
              <button type="button" class="btn btn-xs btn-white js-md-edit-form" data-id="${esc(form.id)}">Editar</button>
              <button type="button" class="btn btn-xs btn-info js-md-preview-form" data-id="${esc(form.id)}">Preview</button>
              <button type="button" class="btn btn-xs btn-success js-md-publish-form" data-id="${esc(form.id)}">Publicar</button>
            </td>
          </tr>
        `)
        .join(""),
    );
  }

  function renderFormPreview(form) {
    state.selectedFormId = form?.id || null;
    const safeJson = JSON.stringify(form?.definition_json || {}, null, 2);
    $("#mdFormPreview").html(`<pre style="white-space:pre-wrap;">${esc(safeJson)}</pre>`);
  }

  async function renderSecuritySummary() {
    const body = $("#mdSecuritySummaryBody");
    if (!state.fields.length) {
      body.html('<tr><td colspan="3" class="text-center">Nenhum campo disponível.</td></tr>');
      return;
    }

    body.html(
      state.fields
        .map((field) => `
          <tr>
            <td>${esc(field.display_name || field.name || "-")}</td>
            <td id="mdRuleCount_${esc(field.id)}">Carregando...</td>
            <td>
              <button type="button" class="btn btn-xs btn-info js-md-field-security" data-id="${esc(field.id)}">Editar Segurança</button>
            </td>
          </tr>
        `)
        .join(""),
    );

    for (const field of state.fields) {
      try {
        const payload = await api(`/api/metadata/fields/${encodeURIComponent(field.id)}/security`);
        const rules = normalizeArray(payload?.rules || []);
        $(`#mdRuleCount_${field.id}`).text(String(rules.length));
      } catch {
        $(`#mdRuleCount_${field.id}`).text("-");
      }
    }
  }

  function renderHistory() {
    const body = $("#mdHistoryBody");
    if (!state.publishLog.length) {
      body.html('<tr><td colspan="5" class="text-center">Nenhuma publicação registrada.</td></tr>');
      return;
    }

    body.html(
      state.publishLog
        .map((row) => {
          const status = String(row.status || "").toUpperCase();
          const statusLabel = status === "SUCCESS"
            ? '<span class="label label-primary">SUCCESS</span>'
            : '<span class="label label-danger">FAILED</span>';
          const publishedAt = row.published_at ? new Date(row.published_at).toLocaleString("pt-BR") : "-";
          return `
            <tr>
              <td>${esc(row.version || "-")}</td>
              <td>${esc(publishedAt)}</td>
              <td>${statusLabel}</td>
              <td>${esc(row.migration_name || "-")}</td>
              <td>${esc(row.error_message || "-")}</td>
            </tr>
          `;
        })
        .join(""),
    );
  }

  function openFieldEditor(field) {
    const isEdit = !!field;
    const html = `
      <div class="form-group">
        <label>Display Name (PT-BR)</label>
        <input type="text" class="form-control" id="mdFieldDisplayName" value="${esc(field?.display_name || "")}" />
      </div>
      <div class="form-group">
        <label>Nome interno</label>
        <input type="text" class="form-control" id="mdFieldName" value="${esc(field?.name || "")}" ${isEdit ? "readonly" : ""} />
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="form-control" id="mdFieldType">${fieldTypeOptions(field?.data_type || "STRING")}</select>
      </div>
      <div class="row">
        <div class="col-md-4">
          <label><input type="checkbox" id="mdFieldRequired" ${field?.is_required ? "checked" : ""} /> Required</label>
        </div>
        <div class="col-md-4">
          <label><input type="checkbox" id="mdFieldUnique" ${field?.is_unique ? "checked" : ""} /> Unique</label>
        </div>
      </div>
      <div class="form-group" style="margin-top:10px;">
        <label>Default</label>
        <input type="text" class="form-control" id="mdFieldDefault" value="${esc(field?.default_value || "")}" />
      </div>
      <div class="form-group">
        <label>Formatação (JSON)</label>
        <textarea class="form-control" id="mdFieldFormatJson" rows="4">${esc(JSON.stringify(field?.format_json || {}, null, 2))}</textarea>
      </div>
      <div id="mdLookupSection" style="display:${String(field?.data_type || "").toUpperCase() === "LOOKUP" ? "block" : "none"};">
        <div class="form-group">
          <label>Tabela destino (LOOKUP)</label>
          <select class="form-control" id="mdFieldLookupEntityId">
            <option value="">Selecione</option>
            ${lookupEntityOptions(field?.lookup_entity_id || "")}
          </select>
        </div>
        <div class="form-group">
          <label>On Delete</label>
          <select class="form-control" id="mdFieldLookupOnDelete">
            <option value="RESTRICT" ${String(field?.lookup_on_delete || "").toUpperCase() === "RESTRICT" ? "selected" : ""}>RESTRICT</option>
            <option value="CASCADE" ${String(field?.lookup_on_delete || "").toUpperCase() === "CASCADE" ? "selected" : ""}>CASCADE</option>
            <option value="SET_NULL" ${String(field?.lookup_on_delete || "").toUpperCase() === "SET_NULL" ? "selected" : ""}>SET_NULL</option>
          </select>
        </div>
      </div>
    `;

    openSidePanel(isEdit ? "Editar Campo" : "Novo Campo", html, async function () {
      let formatJson = {};
      const formatRaw = String($("#mdFieldFormatJson").val() || "").trim();
      if (formatRaw) {
        try {
          formatJson = JSON.parse(formatRaw);
        } catch {
          throw new Error("Formatação JSON inválida.");
        }
      }

      const payload = {
        display_name: String($("#mdFieldDisplayName").val() || "").trim(),
        name: String($("#mdFieldName").val() || "").trim(),
        data_type: String($("#mdFieldType").val() || "STRING").trim(),
        is_required: $("#mdFieldRequired").is(":checked"),
        is_unique: $("#mdFieldUnique").is(":checked"),
        default_value: String($("#mdFieldDefault").val() || "").trim() || null,
        format_json: formatJson,
        lookup_entity_id: String($("#mdFieldLookupEntityId").val() || "").trim() || null,
        lookup_on_delete: String($("#mdFieldLookupOnDelete").val() || "").trim() || null,
      };

      if (!payload.display_name || !payload.name) {
        throw new Error("Display Name e Nome interno são obrigatórios.");
      }

      if (isEdit) {
        await api(`/api/metadata/fields/${encodeURIComponent(field.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/fields`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      await loadFields();
      closeSidePanel();
    });

    $("#mdFieldType").on("change", function () {
      const isLookup = String($(this).val() || "").toUpperCase() === "LOOKUP";
      $("#mdLookupSection").toggle(isLookup);
    });
  }

  function openFormEditor(form) {
    const isEdit = !!form;
    const html = `
      <div class="form-group">
        <label>Nome interno</label>
        <input type="text" class="form-control" id="mdFormName" value="${esc(form?.name || "")}" ${isEdit ? "readonly" : ""} />
      </div>
      <div class="form-group">
        <label>Display Name (PT-BR)</label>
        <input type="text" class="form-control" id="mdFormDisplayName" value="${esc(form?.display_name || "")}" />
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="form-control" id="mdFormType">${formTypeOptions(form?.form_type || "MAIN")}</select>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="mdFormDefault" ${form?.is_default ? "checked" : ""} /> Definir como padrão</label>
      </div>
      <div class="form-group">
        <label>Layout (JSON)</label>
        <textarea class="form-control" id="mdFormDefinitionJson" rows="12">${esc(JSON.stringify(form?.definition_json || { tabs: [] }, null, 2))}</textarea>
      </div>
    `;

    openSidePanel(isEdit ? "Editar Formulário" : "Novo Formulário", html, async function () {
      let definition = {};
      const definitionRaw = String($("#mdFormDefinitionJson").val() || "").trim();
      if (definitionRaw) {
        try {
          definition = JSON.parse(definitionRaw);
        } catch {
          throw new Error("JSON de layout inválido.");
        }
      }

      const payload = {
        name: String($("#mdFormName").val() || "").trim(),
        display_name: String($("#mdFormDisplayName").val() || "").trim(),
        form_type: String($("#mdFormType").val() || "MAIN").trim(),
        is_default: $("#mdFormDefault").is(":checked"),
        definition_json: definition,
      };
      if (!payload.name || !payload.display_name) {
        throw new Error("Nome interno e Display Name são obrigatórios.");
      }

      if (isEdit) {
        await api(`/api/metadata/forms/${encodeURIComponent(form.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/forms`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      await loadForms();
      closeSidePanel();
    });
  }

  async function openFieldSecurityEditor(field) {
    const payload = await api(`/api/metadata/fields/${encodeURIComponent(field.id)}/security`);
    const rules = normalizeArray(payload?.rules || []);
    const defaultsEntity = payload?.defaults?.entity || null;

    const rowsHtml = (rules.length ? rules : [{ principal_type: "ROLE", principal_id: "", can_view: true, can_read: true, can_edit: false, mask_mode: "HIDDEN_TEXT", priority: 100 }])
      .map((rule, idx) => `
        <tr class="js-md-security-row">
          <td>
            <select class="form-control input-sm js-md-principal-type">${principalTypeOptions(rule.principal_type || "ROLE")}</select>
          </td>
          <td>
            <select class="form-control input-sm js-md-principal-id">${principalOptions(rule.principal_type || "ROLE", rule.principal_id || "")}</select>
          </td>
          <td><input type="checkbox" class="js-md-can-view" ${rule.can_view !== false ? "checked" : ""} /></td>
          <td><input type="checkbox" class="js-md-can-read" ${rule.can_read !== false ? "checked" : ""} /></td>
          <td><input type="checkbox" class="js-md-can-edit" ${rule.can_edit ? "checked" : ""} /></td>
          <td>
            <select class="form-control input-sm js-md-mask-mode">${maskModeOptions(rule.mask_mode || "HIDDEN_TEXT")}</select>
          </td>
          <td><input type="number" class="form-control input-sm js-md-priority" value="${esc(rule.priority == null ? 100 : rule.priority)}" /></td>
          <td><button type="button" class="btn btn-xs btn-danger js-md-remove-security-row">Remover</button></td>
        </tr>
      `)
      .join("");

    const html = `
      <div class="alert alert-info">
        Campo: <strong>${esc(field.display_name || field.name)}</strong>
      </div>
      <div class="table-responsive">
        <table class="table table-bordered table-striped">
          <thead>
            <tr>
              <th>Tipo</th>
              <th>Principal</th>
              <th>Ver</th>
              <th>Ler</th>
              <th>Editar</th>
              <th>Mask</th>
              <th>Priority</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="mdSecurityRulesBody">${rowsHtml}</tbody>
        </table>
      </div>
      <button type="button" class="btn btn-white btn-sm" id="btnMdAddSecurityRule"><i class="fa fa-plus"></i> Adicionar regra</button>
      <hr/>
      <h5>Default da entidade</h5>
      <div class="row">
        <div class="col-md-3"><label><input type="checkbox" id="mdDefaultCanView" ${defaultsEntity?.default_can_view !== false ? "checked" : ""} /> Ver</label></div>
        <div class="col-md-3"><label><input type="checkbox" id="mdDefaultCanRead" ${defaultsEntity?.default_can_read !== false ? "checked" : ""} /> Ler</label></div>
        <div class="col-md-3"><label><input type="checkbox" id="mdDefaultCanEdit" ${defaultsEntity?.default_can_edit ? "checked" : ""} /> Editar</label></div>
        <div class="col-md-3">
          <select class="form-control input-sm" id="mdDefaultMaskMode">
            ${maskModeOptions(defaultsEntity?.default_mask_mode || "HIDDEN_TEXT")}
          </select>
        </div>
      </div>
    `;

    openSidePanel("Segurança de Campo", html, async function () {
      const rulesPayload = $("#mdSecurityRulesBody .js-md-security-row")
        .map(function () {
          const principalType = String($(this).find(".js-md-principal-type").val() || "ROLE").toUpperCase();
          const principalId = String($(this).find(".js-md-principal-id").val() || "").trim();
          if (!principalId) return null;
          return {
            principal_type: principalType,
            principal_id: principalId,
            can_view: $(this).find(".js-md-can-view").is(":checked"),
            can_read: $(this).find(".js-md-can-read").is(":checked"),
            can_edit: $(this).find(".js-md-can-edit").is(":checked"),
            mask_mode: String($(this).find(".js-md-mask-mode").val() || "HIDDEN_TEXT"),
            priority: Number($(this).find(".js-md-priority").val() || 100),
          };
        })
        .get()
        .filter(Boolean);

      const body = {
        rules: rulesPayload,
        defaults: {
          entity_id: state.entityId,
          default_can_view: $("#mdDefaultCanView").is(":checked"),
          default_can_read: $("#mdDefaultCanRead").is(":checked"),
          default_can_edit: $("#mdDefaultCanEdit").is(":checked"),
          default_mask_mode: String($("#mdDefaultMaskMode").val() || "HIDDEN_TEXT"),
        },
      };

      await api(`/api/metadata/fields/${encodeURIComponent(field.id)}/security`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      await renderSecuritySummary();
      closeSidePanel();
    });

    function bindPrincipalChange($row) {
      $row.find(".js-md-principal-type").off("change").on("change", function () {
        const type = String($(this).val() || "ROLE").toUpperCase();
        const options = principalOptions(type, "");
        $row.find(".js-md-principal-id").html(options);
      });
    }

    $("#mdSecurityRulesBody .js-md-security-row").each(function () {
      bindPrincipalChange($(this));
    });

    $("#btnMdAddSecurityRule").on("click", function () {
      const row = $(`
        <tr class="js-md-security-row">
          <td><select class="form-control input-sm js-md-principal-type">${principalTypeOptions("ROLE")}</select></td>
          <td><select class="form-control input-sm js-md-principal-id">${principalOptions("ROLE", "")}</select></td>
          <td><input type="checkbox" class="js-md-can-view" checked /></td>
          <td><input type="checkbox" class="js-md-can-read" checked /></td>
          <td><input type="checkbox" class="js-md-can-edit" /></td>
          <td><select class="form-control input-sm js-md-mask-mode">${maskModeOptions("HIDDEN_TEXT")}</select></td>
          <td><input type="number" class="form-control input-sm js-md-priority" value="100" /></td>
          <td><button type="button" class="btn btn-xs btn-danger js-md-remove-security-row">Remover</button></td>
        </tr>
      `);
      $("#mdSecurityRulesBody").append(row);
      bindPrincipalChange(row);
    });

    $(document).off("click.mdsecurityremove").on("click.mdsecurityremove", ".js-md-remove-security-row", function () {
      $(this).closest("tr").remove();
    });
  }

  async function deleteField(fieldId) {
    const ok = await window.confirm("Excluir (soft delete) este campo?");
    if (!ok) return;
    await api(`/api/metadata/fields/${encodeURIComponent(fieldId)}`, { method: "DELETE" });
    await loadFields();
  }

  async function publishEntity() {
    const response = await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/publish`, {
      method: "POST",
    });
    window.alert(`Publicação concluída (versão ${response?.version || "-"})`);
    await Promise.all([loadEntity(), loadFields(), loadForms(), loadPublishLog()]);
  }

  async function publishForm(formId) {
    await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}/forms/${encodeURIComponent(formId)}/publish`, {
      method: "POST",
    });
    await loadForms();
    window.alert("Formulário publicado com sucesso.");
  }

  async function saveDraftTouchEntity() {
    if (!state.entity) return;
    await api(`/api/metadata/entities/${encodeURIComponent(state.entityId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        display_name: state.entity.display_name,
      }),
    });
    await loadEntity();
    window.alert("Rascunho salvo.");
  }

  function bindEvents() {
    $("#btnMdBack").on("click", function () {
      window.location.href = "/configuracoes/metadata-designer";
    });

    $("#btnMdCloseSidePanel, #mdSideOverlay").on("click", closeSidePanel);
    $("#btnMdSaveSidePanel").on("click", function () {
      if (!state.sidePanel || typeof state.sidePanel.onSave !== "function") return;
      Promise.resolve(state.sidePanel.onSave()).catch((error) => {
        window.alert(error?.message || "Falha ao salvar.");
      });
    });

    $("#btnMdNewField").on("click", function () {
      openFieldEditor(null);
    });
    $("#btnMdNewForm").on("click", function () {
      openFormEditor(null);
    });
    $("#btnMdPublishEntity").on("click", function () {
      publishEntity().catch((error) => window.alert(error.message || "Falha ao publicar entidade."));
    });
    $("#btnMdSaveDraft").on("click", function () {
      saveDraftTouchEntity().catch((error) => window.alert(error.message || "Falha ao salvar rascunho."));
    });

    $(document).on("click", ".js-md-edit-field", function () {
      const field = findFieldById($(this).data("id"));
      if (!field) return;
      openFieldEditor(field);
    });
    $(document).on("click", ".js-md-delete-field", function () {
      const fieldId = String($(this).data("id") || "");
      if (!fieldId) return;
      deleteField(fieldId).catch((error) => window.alert(error.message || "Falha ao excluir campo."));
    });
    $(document).on("click", ".js-md-field-security", function () {
      const field = findFieldById($(this).data("id"));
      if (!field) return;
      openFieldSecurityEditor(field).catch((error) => window.alert(error.message || "Falha ao carregar segurança."));
    });
    $(document).on("click", ".js-md-edit-form", function () {
      const form = state.forms.find((row) => String(row.id) === String($(this).data("id")));
      if (!form) return;
      openFormEditor(form);
    });
    $(document).on("click", ".js-md-preview-form", function () {
      const form = state.forms.find((row) => String(row.id) === String($(this).data("id")));
      if (!form) return;
      renderFormPreview(form);
    });
    $(document).on("click", ".js-md-publish-form", function () {
      const formId = String($(this).data("id") || "");
      if (!formId) return;
      publishForm(formId).catch((error) => window.alert(error.message || "Falha ao publicar formulário."));
    });
  }

  async function bootstrap() {
    if (!state.entityId) {
      throw new Error("Entity id não informado para o designer.");
    }

    await Promise.all([loadCatalog(), loadSecurityPrincipals()]);
    await loadEntity();
    await loadFields();
    await loadForms();
    await loadPublishLog();
  }

  $(function () {
    $("#masterHeader").hide();
    $("#pageName").text("Designer de Tabelas e Formulários");
    $("#subpageName").text("Metadata Designer").attr("href", "/configuracoes/metadata-designer");
    $("#path").show();
    $("#subSecoundPageName").text("Designer").attr("href", window.location.pathname);

    bindEvents();
    bootstrap().catch((error) => {
      window.alert(error?.message || "Falha ao carregar o Metadata Designer.");
    });
  });
})();
