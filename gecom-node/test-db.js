if (typeof (CMF) == 'undefined') { CMF = {}; }
if (typeof (CMF.WebResources) == 'undefined') { CMF.WebResources = {}; }

CMF.WebResources.incident = {
    Forms: {
        Global: 'Global Inicial Form',
        Claims: 'Claims Form',
        Feedback: 'Feedback form',
        InternalAnomalies: 'Internal anomalies form',
        Generic: 'Case'
    },

    OptionSet: {
        Sim: 214650000,
        Nao: 214650001
    },

    StagesBpf: [
        {
            Subject: 'Claims',
            StageName: 'Opening',
            Subtype: null,
            Requiredfields: ['sym_claimdate_date', 'myp_primarycauseid', 'sym_casesubtype_id', 'description'],
            Sequency: 0
        },
        {
            Subject: 'Claims',
            StageName: 'Opening - Flow 1',
            Subtype: ['Aroma/sabor a mofo', 'Outros aromas/sabores desagradáveis', 'Depósito/Turvação/Alteração na cor', 'Corpos estranhos'],
            Requiredfields: ['productid', 'sym_productyear', 'sym_lotnumber', 'sym_sampleforanalysis_code', 'sym_commercialaction_code'],
            Sequency: 1
        },
        {
            Subject: 'Claims',
            StageName: 'Opening - Flow 2',
            Subtype: ['Vedante', 'Garrafa', 'Rótulo/selo', 'Cápsula', 'Embalagem individual', 'Caixa exterior', 'POS', 'Outros materiais'],
            Requiredfields: ['productid', 'sym_productyear', 'sym_lotnumber', 'sym_commercialaction_code'],
            Sequency: 1
        },
        {
            Subject: 'Claims',
            StageName: 'Opening - Flow 3',
            Subtype: ['Excesso, falta ou troca de produto/material', 'Problema com documentação de expedição', 'Problema EDI', 'Atraso na entrega da encomenda', 'Erro na faturação'],
            Requiredfields: ['sym_ordernumber', 'sym_commercialaction_code'],
            Sequency: 1
        },
        {
            Subject: 'Claims',
            StageName: 'Opening - Flow 4',
            Subtype: ['Produto/material danificado/não conforme'],
            Requiredfields: ['productid', 'sym_productyear', 'sym_ordernumber', 'sym_lotnumber', 'sym_commercialaction_code'],
            Sequency: 1
        },
        {
            Subject: 'Claims',
            StageName: 'Analysis 1',
            Subtype: ['Aroma/sabor a mofo', 'Outros aromas/sabores desagradáveis', 'Depósito/Turvação/Alteração na cor', 'Corpos estranhos'],
            Requiredfields: ['sym_cause', 'sym_subcause', 'sym_riskmitigation', 'sym_claimeligibility_code'],
            Sequency: 2
        },
        {
            Subject: 'Claims',
            StageName: 'Analysis 2',
            Subtype: ['Vedante', 'Garrafa', 'Rótulo/selo', 'Cápsula', 'Embalagem individual', 'Caixa exterior', 'POS', 'Outros materiais'],
            Requiredfields: ['sym_cause', 'sym_subcause', 'sym_riskmitigation'],
            Sequency: 2
        },
        {
            Subject: 'Claims',
            StageName: 'Analysis 3',
            Subtype: ['Excesso, falta ou troca de produto/material', 'Problema com documentação de expedição', 'Problema EDI', 'Atraso na entrega da encomenda', 'Erro na faturação'],
            Requiredfields: ['sym_cause', 'sym_subcause', 'sym_riskmitigation'],
            Sequency: 2
        },
        {
            Subject: 'Claims',
            StageName: 'Analysis 4',
            Subtype: ['Produto/material danificado/não conforme'],
            Requiredfields: ['sym_cause', 'sym_subcause', 'sym_riskmitigation'],
            Sequency: 2
        },
        {
            Subject: 'Claims',
            StageName: 'Closure',
            Subtype: null,
            Requiredfields: ['sym_correctiveactionwaseffective_code', 'sym_probability', 'sym_gravity'],
            Sequency: 3
        },
        {
            Subject: 'Internal anomalies',
            StageName: 'Opening',
            Subtype: null,
            Requiredfields: ['myp_primarycauseid', 'sym_casesubtype_id', 'sym_anomalydetector', 'description'],
            Sequency: 0
        },
        {
            Subject: 'Internal anomalies',
            StageName: 'Opening - Flow 1',
            Subtype: ['Aroma/sabor a mofo', 'Outros aromas/sabores desagradáveis', 'Depósito/Turvação/Alteração na cor', 'Corpos estranhos'],
            Requiredfields: ['productid', 'sym_productyear', 'sym_lotnumber', 'sym_sampleforanalysis_code'],
            Sequency: 1
        },
        {
            Subject: 'Internal anomalies',
            StageName: 'Opening - Flow 2',
            Subtype: ['Vedante', 'Garrafa', 'Rótulo/selo', 'Cápsula', 'Embalagem individual', 'Caixa exterior', 'POS', 'Outros materiais'],
            Requiredfields: ['productid', 'sym_productyear', 'sym_lotnumber'],
            Sequency: 1
        },
        {
            Subject: 'Internal anomalies',
            StageName: 'Opening - Flow 3',
            Subtype: ['Excesso, falta ou troca de produto/material', 'Problema com documentação de expedição', 'Problema EDI', 'Atraso na entrega da encomenda', 'Erro na faturação'],
            Requiredfields: ['sym_ordernumber'],
            Sequency: 1
        },
        {
            Subject: 'Internal anomalies',
            StageName: 'Opening - Flow 4',
            Subtype: ['Produto/material danificado/não conforme'],
            Requiredfields: ['productid', 'sym_productyear', 'sym_lotnumber', 'sym_ordernumber'],
            Sequency: 1
        },
        {
            Subject: 'Internal anomalies',
            StageName: 'Analysis',
            Subtype: null,
            Requiredfields: ['sym_cause', 'sym_subcause', 'sym_riskmitigation'],
            Sequency: 2
        },
        {
            Subject: 'Internal anomalies',
            StageName: 'Closure',
            Subtype: null,
            Requiredfields: ['sym_probability', 'sym_gravity', 'sym_correctiveactionwaseffective_code', 'sym_probability', 'sym_gravity'],
            Sequency: 3
        }
    ],

    OnLoad: function (executionContext) {
        CMF.WebResources.incident.ManageForms(executionContext);
        CMF.WebResources.incident.AddLookupsPreSearch(executionContext);

    },

normalizeId: function(id) {
    return (id || "").replace(/[{}]/g, "").toUpperCase();
},

ManageForms: async function (executionContext) {
    var formContext = executionContext.getFormContext();
    var isFormTypeCreate = formContext.ui.getFormType() == 1;

    var caseId = normalizeId(formContext.data.entity.getId());
    if (isFormTypeCreate || !caseId) {
        return;
    }

    var currentForm = (formContext.ui.formSelector.getCurrentItem() ? formContext.ui.formSelector.getCurrentItem().getLabel() : "");
    currentForm = (currentForm || "").trim();

    var subject = formContext.getAttribute("subjectid") != null ? formContext.getAttribute("subjectid").getValue() : null;
    var subjectId = subject != null ? normalizeId(subject[0].id) : null;

    var newFormName = null;
    var bpfId = null;

    Xrm.Page.ui.process.setVisible(false);

    if (!subjectId) {
        newFormName = CMF.WebResources.incident.Forms.Global;
    } else {
        let formSelectionDefinitions = await Xrm.WebApi.retrieveMultipleRecords(
            "sym_formselectiondefinitions",
            "?$select=_sym_subject_id_value,sym_formlabel,sym_bpfid"
        );

        formSelectionDefinitions.entities.forEach((item) => {
            if (normalizeId(item._sym_subject_id_value) === subjectId) {
                newFormName = (item.sym_formlabel || "").trim();
                bpfId = item.sym_bpfid;
            }
        });

        if (!newFormName) {
            newFormName = CMF.WebResources.incident.Forms.Generic;
        }
    }

    newFormName = (newFormName || "").trim();

    // Per-record navigation key (so it persists across reload, but only for THIS case)
    var navKey = `CMF_NAVIGATE_${caseId}`;
    var navTarget = (sessionStorage.getItem(navKey) || "").trim();

    // If we already navigated for this record, do not navigate again
    if (navTarget) {
        // If we are already on the target form, clear the flag and continue
        if (currentForm.localeCompare(navTarget, undefined, { sensitivity: "accent" }) === 0) {
            sessionStorage.removeItem(navKey);
        } else {
            return;
        }
    }

    // Navigate only when different
    if (currentForm.localeCompare(newFormName, undefined, { sensitivity: "accent" }) !== 0) {
        let items = formContext.ui.formSelector.items.get();
        let found = false;

        for (let i = 0; i < items.length; i++) {
            const label = (items[i].getLabel() || "").trim();
            if (label.localeCompare(newFormName, undefined, { sensitivity: "accent" }) === 0) {
                found = true;
                sessionStorage.setItem(navKey, newFormName); // set BEFORE navigating
                items[i].navigate();
                break;
            }
        }

        // If it didn't find the form, DO NOT loop forever
        if (!found) {
            console.warn(`CMF: target form not found. current='${currentForm}', target='${newFormName}'`);
        }

        return;
    }

    // Apply rules only on the right form
    CMF.WebResources.incident.ApplyFormRules(
        formContext,
        newFormName == CMF.WebResources.incident.Forms.Generic,
        bpfId,
        subjectId
    );

    CMF.WebResources.incident.CaseTypeFilterLookup(formContext, subjectId);
},

    ApplyFormRules: function (formContext, isGenericForm, bpfId, subjectId) {
        if (isGenericForm)
            CMF.WebResources.incident.OnChangeSubject(formContext);
        else if (formContext.ui.formSelector.getCurrentItem().getLabel() == CMF.WebResources.incident.Forms.Feedback)
            CMF.WebResources.incident.RequiredFieldsFeedback(null, formContext);
        else if (formContext.ui.formSelector.getCurrentItem().getLabel() == CMF.WebResources.incident.Forms.Claims) // Check if the current form is the Claims form
            CMF.WebResources.incident.RequiredFieldsClaims(null, formContext); // Call the RequiredFieldsClaims function if it is
        else if (formContext.ui.formSelector.getCurrentItem().getLabel() == CMF.WebResources.incident.Forms.InternalAnomalies) // Check if the current form is the Internal Anomalies form
            CMF.WebResources.incident.RequiredFieldsInternalAnomalies(null, formContext); // Call the RequiredFieldsInternalAnomalies function if it is

        if (bpfId != null) {
            Xrm.Page.data.process.setActiveProcess(bpfId);
            Xrm.Page.ui.process.setVisible(true);
            Xrm.Page.data.process.addOnStageChange(CMF.WebResources.incident.RequireFieldsByBpfStage);
            CMF.WebResources.incident.RequireFieldsByBpfStage(formContext);
        }

        if (formContext.getAttribute("sym_sampleforanalysis_code") != null)
            CMF.WebResources.incident.ApplySampleForAnalysisRules(formContext);


        //if (formContext.getAttribute("sym_commercialactionalreadyplaced_code") != null) {
        //    formContext.getAttribute('sym_commercialactionalreadyplaced_code').addOnChange(CMF.WebResources.incident.CommercialActionAlreadyPlacedOnChange);
        //    formContext.getAttribute('sym_commercialactionalreadyplaced_code').fireOnChange();
        //}

        if (formContext.getAttribute("myp_primarycauseid") != null) {
            formContext.getAttribute('myp_primarycauseid').addOnChange(CMF.WebResources.incident.CaseTypeFilterLookup);
            formContext.getAttribute('myp_primarycauseid').fireOnChange();
        }

        if (formContext.getAttribute("header_process_myp_primarycauseid") != null) {
            formContext.getAttribute('header_process_myp_primarycauseid').addOnChange(CMF.WebResources.incident.CaseTypeFilterLookup);
            formContext.getAttribute('header_process_myp_primarycauseid').fireOnChange();
        }
    },

    RequireFieldsByBpfStage: function (executionContext) {
        var formContext = null;

        try {
            formContext = executionContext.getFormContext();
        } catch (e) {
            formContext = executionContext;
        }

        var activeStage = Xrm.Page.data.process.getActiveStage();
        var stageName = activeStage != null ? activeStage.getName() : null;
        var subject = formContext.getAttribute("subjectid") != null && formContext.getAttribute("subjectid").getValue() != null ? formContext.getAttribute("subjectid").getValue()[0].name : null;
        var subtype = formContext.getAttribute("sym_casesubtype_id") != null && formContext.getAttribute("sym_casesubtype_id").getValue() != null ? formContext.getAttribute("sym_casesubtype_id").getValue()[0].name : null;

        if (stageName == null || subject == null || (subject != 'Claims' && subject != 'Internal anomalies')) return;

        if (subject == 'Claims' && formContext.ui.formSelector.getCurrentItem().getLabel() != CMF.WebResources.incident.Forms.Claims) {
            console.log("CLAIMS");
            CMF.WebResources.incident.SetRequiredLevel("descriptio", "none", formContext);
            CMF.WebResources.incident.SetRequiredLevel("myp_primarycauseid", "none", formContext);
        }

        else if (subject == 'Internal anomalies' && formContext.ui.formSelector.getCurrentItem().getLabel() != CMF.WebResources.incident.Forms.InternalAnomalies) {
            console.log("INTERNAL ANOMALIES");
            CMF.WebResources.incident.SetRequiredLevel("description", "none", formContext);
            CMF.WebResources.incident.SetRequiredLevel("myp_primarycauseid", "none", formContext);
        } else {

            var stageObj = CMF.WebResources.incident.StagesBpf.find(x => x.StageName == stageName && x.Subject == subject && (x.Subtype == null || x.Subtype.indexOf(subtype) != -1));
            if (stageObj == undefined) return;

            stageObj.Requiredfields.forEach(x => CMF.WebResources.incident.SetRequiredLevel(x, "required", formContext));

            for (var i = stageObj.Sequency - 1; i >= 0; i--) {
                CMF.WebResources.incident.StagesBpf.find(x => x.Subject == subject && (x.Subtype == null || x.Subtype.indexOf(subtype) != -1) && x.Sequency == i).Requiredfields.forEach(
                    x => CMF.WebResources.incident.SetRequiredLevel(x, "required", formContext)
                );
            }
        }
    },

    OnChangeSubject: function (formContext) {
        if (formContext.getAttribute("subjectid") != null && formContext.getAttribute("subjectid").getValue() != null) {
            var subjectName = formContext.getAttribute("subjectid").getValue()[0].name;

            if (subjectName == "Sales - Markets - Rebate Agreements" || subjectName == "Price Support" || subjectName == "A & P" || subjectName == "Analysis & Others" || subjectName == "Commissions" || subjectName == "A&P Brand Budget" || subjectName == "Price Support Credit Note") {
                CMF.WebResources.incident.SetRequiredLevel("sym_aggregators", "required", formContext);
                CMF.WebResources.incident.SetRequiredLevel("sym_pricelist", "required", formContext);
                CMF.WebResources.incident.SetRequiredLevel("sym_account", "required", formContext);
                CMF.WebResources.incident.SetVisible("sym_account", true, formContext);
            }
            else {
                CMF.WebResources.incident.SetRequiredLevel("sym_aggregators", "none", formContext);
                CMF.WebResources.incident.SetRequiredLevel("sym_pricelist", "none", formContext);
                CMF.WebResources.incident.SetRequiredLevel("sym_account", "none", formContext);
                CMF.WebResources.incident.SetVisible("sym_account", false, formContext);
            }
        }
    },

    onChangeCustomerImpact: function (executionContext) {

        //The above code is getting the values of the fields on the form.
        var formContext = executionContext.getFormContext();
        var customerImpact = formContext.getAttribute("sym_customerimpact_code").getValue();
        var commercialActionStatus = formContext.getAttribute("sym_commercialaction_code").getValue();
        var commercialActionType = formContext.getAttribute("sym_commercialactiontype_code").getValue();
        var replyDate = formContext.getAttribute("sym_customerresponse_date").getValue();

        //The above code is checking if the customerImpact is equal to 214650000, then it is setting the required level of the commercialActionStatus to required. 

        if (customerImpact == 214650000) {
            formContext.getAttribute("sym_commercialaction_code").setRequiredLevel("required");
            //If the commercialActionStatus is equal to 214650006, then it is setting the required level of the commercialActionType and customerResponseDate to required.
            if (commercialActionStatus == 214650006) {
                formContext.getAttribute("sym_commercialactiontype_code").setRequiredLevel("required");
                formContext.getAttribute("sym_customerresponse_date").setRequiredLevel("required");
            }
        }

        else {
            formContext.getAttribute("sym_commercialaction_code").setRequiredLevel("none");
            formContext.getAttribute("sym_commercialactiontype_code").setRequiredLevel("none");
            formContext.getAttribute("sym_customerresponse_date").setRequiredLevel("none");
        }

    },

    //onChangeCustomerImpact: function (executionContext) {
    //    //if sym_customerimpact_code = 214650000 then sym_action_code, sym_comercialactionobservation and sym_customerresponse_date are mandatory
    //    var formContext = executionContext.getFormContext();
    //    var customerImpact = formContext.getAttribute("sym_customerimpact_code").getValue();
    //    if (customerImpact == 214650000) {
    //        formContext.getAttribute("sym_commercialaction_code").setRequiredLevel("required");
    //        //formContext.getAttribute("sym_comercialactionobservation").setRequiredLevel("required");
    //        formContext.getAttribute("sym_customerresponse_date").setRequiredLevel("required");
    //    }
    //    else {
    //        //formContext.getAttribute("sym_commercialaction_code").setRequiredLevel("none");
    //        formContext.getAttribute("sym_comercialactionobservation").setRequiredLevel("none");
    //        formContext.getAttribute("sym_customerresponse_date").setRequiredLevel("none");
    //    }
    //},

    onChangeComercialActionStatus: function (executionContext) {
        //if sym_commercialaction_code equals 214,650,006 then Reply Date (sym_customerresponse_date)´and Commercial Action Type (sym_commercialaction_code) are mandatory
        //alterar o sym_commercialaction_code por sym_commercialactiontype_code
        var formContext = executionContext.getFormContext();
        var comercialActionStatus = formContext.getAttribute("sym_commercialaction_code").getValue();
        if (comercialActionStatus == 214650006) {
            formContext.getAttribute("sym_customerresponse_date").setRequiredLevel("required");
            formContext.getAttribute("sym_commercialactiontype_code").setRequiredLevel("required");
        }
        else {
            formContext.getAttribute("sym_customerresponse_date").setRequiredLevel("none");
            formContext.getAttribute("sym_commercialactiontype_code").setRequiredLevel("none");
        }
    },

    RequiredFieldsClaims: function (executionContext, _formContext) {
        var formContext = null;

        if (executionContext !== null)
            formContext = executionContext.getFormContext();
        else
            formContext = _formContext;
        var fieldsToRequired = ['descriptio'];


        fieldsToRequired.forEach(field => CMF.WebResources.incident.SetRequiredLevel(field, "required", formContext));
    },

    RequiredFieldsInternalAnomalies: function (executionContext, _formContext) {
        var formContext = null;

        if (executionContext !== null)
            formContext = executionContext.getFormContext();
        else
            formContext = _formContext;
        var fieldsToRequired = ['description']; // Add 'description' to the list of fields to require

        fieldsToRequired.forEach(field => CMF.WebResources.incident.SetRequiredLevel(field, "required", formContext));
    },

    RequiredFieldsFeedback: function (executionContext, _formContext) {
        var formContext = null;

        if (executionContext !== null)
            formContext = executionContext.getFormContext();
        else
            formContext = _formContext;

        var fieldsToUnrequire = ["productid", "sym_productyear", "sym_lotnumber", "new_brand", "sym_communicationchannel_code"];
        fieldsToUnrequire.forEach(field => CMF.WebResources.incident.SetRequiredLevel(field, "none", formContext));

        var fieldsToRequire = ["myp_primarycauseid", "sym_casesubtype_id", "sym_customerreceivedanoffer_code", "sym_commercialaction_code", "sym_customerresponse_date", "sym_commercialactiontype_code"];
        fieldsToRequire.forEach(field => CMF.WebResources.incident.SetRequiredLevel(field, "required", formContext));

        if (formContext.getAttribute("myp_primarycauseid") == null || formContext.getAttribute("myp_primarycauseid").getValue() == null)
            return;

        if (formContext.getAttribute("sym_casesubtype_id") == null || formContext.getAttribute("sym_casesubtype_id").getValue() == null)
            return;

        var subtype = formContext.getAttribute("sym_casesubtype_id").getValue()[0].name.toUpperCase();

        switch (subtype) {
            case "PRODUTO - IMAGEM":
            case "PRODUTO - SUSTENTABILIDADE":
            case "PRODUTO - OUTROS":
                CMF.WebResources.incident.SetRequiredLevel("productid", "required", formContext);
                CMF.WebResources.incident.SetRequiredLevel("sym_productyear", "required", formContext);

                break;
            case "PRODUTO - QUALIDADE":
                CMF.WebResources.incident.SetRequiredLevel("productid", "required", formContext);
                CMF.WebResources.incident.SetRequiredLevel("sym_productyear", "required", formContext);
                CMF.WebResources.incident.SetRequiredLevel("sym_lotnumber", "required", formContext);

                break;
            case "MARCA - IMAGEM":
            case "MARCA - QUALIDADE":
            case "MARCA - SUSTENTABILIDADE":
            case "MARCA - OUTROS":
                CMF.WebResources.incident.SetRequiredLevel("new_brand", "required", formContext);

                break;
            case "COMUNICAÇÕES":
                CMF.WebResources.incident.SetRequiredLevel("sym_communicationchannel_code", "required", formContext);

                break;
        }

    },

    AddLookupsPreSearch: function (executionContext) {
        var formContext = executionContext.getFormContext();
        if (formContext.getControl("header_process_sym_casesubtype_id") != null) {
            formContext.getControl("header_process_sym_casesubtype_id").addPreSearch(CMF.WebResources.incident.FilterBpfSubtypeLookup);
        }
    },

    FilterBpfSubtypeLookup: function (executionContext) {
        try {
            var formContext = executionContext.getFormContext();
            var typeId = null;

            if (formContext.getAttribute('myp_primarycauseid').getValue() != null)
                typeId = formContext.getAttribute('myp_primarycauseid').getValue()[0].id;

            if (typeId != null) {
                formContext.getControl('header_process_sym_casesubtype_id').addCustomFilter(`<filter><condition attribute='sym_casetype_id' operator='eq' value='${typeId}' /></filter>`, 'sym_casesubtype');
            }
            else {
                formContext.getControl('header_process_sym_casesubtype_id').addCustomFilter(`<filter><condition attribute='sym_casetype_id' operator='eq' value='0000000000' /></filter>`, 'sym_casesubtype');
            }
        }
        catch (e) {
            console.log('Erro (FilterBpfSubtypeLookup): ' + e.message);
        }
    },

    //CommercialActionAlreadyPlacedOnChange: function (executionContext) {
    //    var formContext = executionContext.getFormContext();
    //    var comercialAction = formContext.getAttribute("sym_commercialactionalreadyplaced_code");
    //    var customerImpact = formContext.getAttribute("sym_customerimpact_code");

    //    if ((comercialAction != null && comercialAction.getValue() === CMF.WebResources.incident.OptionSet.Sim) ||
    //        (customerImpact != null && customerImpact.getValue() === CMF.WebResources.incident.OptionSet.Sim)) {
    //        CMF.WebResources.incident.SetRequiredLevel("sym_customerresponse_date", "required", formContext);
    //        CMF.WebResources.incident.SetRequiredLevel("sym_commercialaction_code", "required", formContext);
    //        CMF.WebResources.incident.SetRequiredLevel("sym_comercialactionobservation", "required", formContext);
    //        return;
    //    }

    //    if (formContext.ui.formSelector.getCurrentItem().getLabel() != CMF.WebResources.incident.Forms.Feedback) {
    //        CMF.WebResources.incident.SetRequiredLevel("sym_customerresponse_date", "none", formContext);
    //        CMF.WebResources.incident.SetRequiredLevel("sym_commercialaction_code", "none", formContext);
    //        CMF.WebResources.incident.SetRequiredLevel("sym_comercialactionobservation", "none", formContext);
    //    }
    //},

    ApplySampleForAnalysisRules: function (formContext) {
        var sampleForAnalysis = formContext.getAttribute("sym_sampleforanalysis_code").getValue();
        var activeStage = Xrm.Page.data.process.getActiveStage();
        var stageName = activeStage != null ? activeStage.getName() : null;
        var subject = formContext.getAttribute("subjectid") != null && formContext.getAttribute("subjectid").getValue() != null ? formContext.getAttribute("subjectid").getValue()[0].name : null;
        var subtype = formContext.getAttribute("sym_casesubtype_id") != null && formContext.getAttribute("sym_casesubtype_id").getValue() != null ? formContext.getAttribute("sym_casesubtype_id").getValue()[0].name : null;
        var stageObj = CMF.WebResources.incident.StagesBpf.find(x => x.StageName == stageName && x.Subject == subject && (x.Subtype == null || x.Subtype.indexOf(subtype) != -1));

        if (stageObj == null)
            return;
    },

    SetRequiredLevel: function (field, value, formContext) {
        if (formContext.getAttribute(field) != null)
            formContext.getAttribute(field).setRequiredLevel(value);
    },

    SetVisible: function (field, value, formContext) {
        if (formContext.getControl(field) != null)
            formContext.getControl(field).setVisible(value);
    },

    CaseTypeFilterLookup: function (formContext, subjectId) {
        try {
            var viewId = "90000000-9000-9000-9000-900000000000";
            var entity = "myp_primarycause";
            var ViewDisplayName = "CaseType x Subject";
            var fetchXML = "<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='true'>" +
                "<entity name='myp_primarycause'>" +
                "<attribute name='myp_name' />" +
                "<link-entity name='sym_casetype_x_subject' from='sym_casetype_id' to='myp_primarycauseid'>" +
                "<filter type='and'>" +
                "<condition attribute='sym_subject_id' operator='eq' value='{" + subjectId + "}' />" +
                "</filter>" +
                "</link-entity>" +
                "</entity>" +
                "</fetch>";
            var layout = "<grid name='resultset' jump='myp_primarycauseid' select='1' icon='1' preview='1'>" +
                "<row name = 'result' id = 'sym_casetype_id' >" +
                "<cell name='myp_name' width='300' />" +
                "</row></grid>";
            var layoutBPF = "<grid name='resultset' jump='header_process_myp_primarycauseid' select='1' icon='1' preview='1'>" +
                "<row name = 'result' id = 'header_process_sym_casetype_id' >" +
                "<cell name='myp_name' width='300' />" +
                "</row></grid>";

            formContext.getControl("myp_primarycauseid").addCustomView(viewId, entity, ViewDisplayName, fetchXML, layout, true);
            formContext.getControl("header_process_myp_primarycauseid").addCustomView(viewId, entity, ViewDisplayName, fetchXML, layoutBPF, true);

        }
        catch (e) {
            console.log('Erro (CaseTypeFilterLookup): ' + e.message);
        }
    }

}