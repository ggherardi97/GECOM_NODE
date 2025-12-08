// /Assets/js/functionalities/dynamicsModal.js
// Global object to control the side modal

(function (global, $) {
    'use strict';

    let onOkCallback = null;
    let onCancelCallback = null;

    // Cached DOM elements (will be set on init)
    let $overlay;
    let $modal;
    let $title;
    let $body;
    let $btnOk;
    let $btnCancel;
    let $btnClose;

    function cacheElements() {
        // Cache elements once DOM is ready
        $overlay = $('#dynamicModalOverlay');
        $modal = $('#dynamicModal');
        $title = $('#dynamicModalTitle');
        $body = $('#dynamicModalBody');
        $btnOk = $('#dynamicModalOkBtn');
        $btnCancel = $('#dynamicModalCancelBtn');
        $btnClose = $('#dynamicModalCloseBtn');
    }

    function wireEvents() {
        cacheElements();

        if (!$modal.length) {
            // Modal not present in DOM
            console.warn('SideModal: modal elements not found in DOM.');
            return;
        }

        // OK button
        $btnOk.on('click', function () {
            if (typeof onOkCallback === 'function') {
                onOkCallback();
            }
            close();
        });

        // Cancel button
        $btnCancel.on('click', function () {
            if (typeof onCancelCallback === 'function') {
                onCancelCallback();
            }
            close();
        });

        // Close (X) button
        $btnClose.on('click', function () {
            if (typeof onCancelCallback === 'function') {
                onCancelCallback();
            }
            close();
        });

        // Click on overlay closes as cancel
        $overlay.on('click', function () {
            if (typeof onCancelCallback === 'function') {
                onCancelCallback();
            }
            close();
        });

        // Prevent scroll propagation
        $modal.on('click', function (event) {
            event.stopPropagation();
        });
    }

    // Initialize once DOM is ready
    $(function () {
        wireEvents();
        console.log('SideModal initialized');
    });

    /**
     * Open side modal
     * @param {Object} options
     * @param {string} options.title - Modal title
     * @param {string} options.html - Inner HTML for the body
     * @param {Function} [options.onOk] - Callback for OK
     * @param {Function} [options.onCancel] - Callback for Cancel/Close
     * @param {boolean} [options.showCancel=true] - Show or hide cancel button
     */
    function open(options) {
        const opts = options || {};
        onOkCallback = opts.onOk || null;
        onCancelCallback = opts.onCancel || null;

        if (!$modal || !$modal.length) {
            cacheElements();
        }

        $title.text(opts.title || '');
        $body.html(opts.html || '');

        // Show / hide cancel button
        if (opts.showCancel === false) {
            $btnCancel.hide();
        } else {
            $btnCancel.show();
        }

        $overlay.show();
        $modal.show();
    }

    /**
     * Close side modal
     */
    function close() {
        if (!$modal || !$modal.length) {
            return;
        }

        $overlay.hide();
        $modal.hide();
        $body.empty();
        $title.empty();
        onOkCallback = null;
        onCancelCallback = null;
    }

    // Expose global API
    global.SideModal = {
        open: open,
        close: close
    };

})(window, window.jQuery);
