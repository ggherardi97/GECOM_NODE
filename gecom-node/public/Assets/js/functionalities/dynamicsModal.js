// /Assets/js/functionalities/dynamicsModal.js
// Global object to control the side modal (layout modal)

(function (global, $) {
  "use strict";

  let currentOptions = null;

  // Cached DOM elements (will be set on init)
  let $overlay;
  let $modal;
  let $title;
  let $body;
  let $btnOk;
  let $btnCancel;
  let $btnClose;

  function cacheElements() {
    $overlay = $("#dynamicModalOverlay");
    $modal = $("#dynamicModal");
    $title = $("#dynamicModalTitle");
    $body = $("#dynamicModalBody");
    $btnOk = $("#dynamicModalOkBtn");
    $btnCancel = $("#dynamicModalCancelBtn");
    $btnClose = $("#dynamicModalCloseBtn");
  }

  function ensureReady() {
    if (!$modal || !$modal.length) cacheElements();
    return !!($modal && $modal.length);
  }

  async function safeCall(fn, ctx) {
    if (typeof fn !== "function") return undefined;
    return await fn(ctx);
  }

  function buildCtx() {
    return {
      overlay: $overlay,
      modal: $modal,
      root: $body, // IMPORTANT: scope for selectors
    };
  }

  function close() {
    if (!ensureReady()) return;

    $overlay.hide();
    $modal.hide();
    $body.empty();
    $title.empty();

    currentOptions = null;

    // Restore default labels (optional)
    $btnOk.text("OK");
    $btnCancel.text("Cancelar");
    $btnCancel.show();
    $btnOk.prop("disabled", false);
  }

  function wireEvents() {
    cacheElements();

    if (!$modal.length) {
      console.warn("SideModal: modal elements not found in DOM.");
      return;
    }

    // OK button (supports async + keepOpen)
    $btnOk.off("click.__sideModal").on("click.__sideModal", async function (ev) {
      if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
      if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();

      if (!currentOptions) {
        close();
        return;
      }

      const ctx = buildCtx();

      try {
        $btnOk.prop("disabled", true);

        // If onOk returns true => keep open
        const keepOpen = await safeCall(currentOptions.onOk, ctx);

        if (!keepOpen) close();
      } catch (err) {
        // Do not close on error
        console.error(err);
        global.alert(err?.message || "Erro ao executar ação do modal.");
      } finally {
        $btnOk.prop("disabled", false);
      }
    });

    // Cancel button
    $btnCancel.off("click.__sideModal").on("click.__sideModal", async function (ev) {
      if (ev && typeof ev.preventDefault === "function") ev.preventDefault();
      if (ev && typeof ev.stopPropagation === "function") ev.stopPropagation();

      const opts = currentOptions;
      const ctx = buildCtx();

      try {
        await safeCall(opts?.onCancel, ctx);
      } finally {
        close();
      }
    });

    // Close (X) button
    $btnClose.off("click.__sideModal").on("click.__sideModal", async function () {
      const opts = currentOptions;
      const ctx = buildCtx();

      try {
        await safeCall(opts?.onCancel, ctx);
      } finally {
        close();
      }
    });

    // Click overlay closes as cancel
    $overlay.off("click.__sideModal").on("click.__sideModal", async function () {
      const opts = currentOptions;
      const ctx = buildCtx();

      try {
        await safeCall(opts?.onCancel, ctx);
      } finally {
        close();
      }
    });

    // Prevent scroll propagation
    $modal.off("click.__sideModal").on("click.__sideModal", function (event) {
      event.stopPropagation();
    });
  }

  // Initialize once DOM is ready
  $(function () {
    wireEvents();
  });

  /**
   * Open side modal
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.html
   * @param {Function} [options.onOk]      - can be async. return true => keep open
   * @param {Function} [options.onCancel]  - can be async
   * @param {Function} [options.onOpen]    - can be async (runs after html is set + modal shown)
   * @param {string}   [options.okText]
   * @param {string}   [options.cancelText]
   * @param {boolean}  [options.showCancel=true]
   */
  async function open(options) {
    if (!ensureReady()) {
      global.alert("Modal global não encontrado no layout.");
      return;
    }

    const opts = options || {};
    currentOptions = opts;

    $title.text(opts.title || "");
    $body.html(opts.html || "");

    if (opts.okText) $btnOk.text(String(opts.okText));
    if (opts.cancelText) $btnCancel.text(String(opts.cancelText));

    if (opts.showCancel === false) $btnCancel.hide();
    else $btnCancel.show();

    $overlay.show();
    $modal.show();

    // Run onOpen after DOM is updated and visible
    const ctx = buildCtx();
    try {
      await safeCall(opts.onOpen, ctx);
    } catch (err) {
      console.error(err);
      global.alert(err?.message || "Erro ao abrir modal.");
    }
  }

  // Expose global API
  global.SideModal = {
    open,
    close,
  };
})(window, window.jQuery);
