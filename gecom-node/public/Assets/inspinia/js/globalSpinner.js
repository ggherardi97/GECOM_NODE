(function () {
  "use strict";

  const overlay = document.getElementById("globalSpinner");
  const textEl = document.getElementById("globalSpinnerText");

  if (!overlay) return;

  let pendingCount = 0;
  let hideTimer = null;

  function render() {
    if (pendingCount > 0) {
      if (hideTimer) clearTimeout(hideTimer);
      overlay.classList.add("is-visible");
      overlay.setAttribute("aria-hidden", "false");
      return;
    }

    // Small delay avoids flicker on very fast requests
    hideTimer = setTimeout(() => {
      overlay.classList.remove("is-visible");
      overlay.setAttribute("aria-hidden", "true");
      if (textEl) {
        textEl.style.display = "none";
        textEl.textContent = "";
      }
    }, 150);
  }

  function show(message) {
    pendingCount++;
    if (textEl && message) {
      textEl.textContent = String(message);
      textEl.style.display = "block";
    }
    render();
  }

  function hide() {
    pendingCount = Math.max(0, pendingCount - 1);
    render();
  }

  function reset() {
    pendingCount = 0;
    render();
  }

  async function wrap(promiseOrFn, message) {
    show(message);
    try {
      const p = typeof promiseOrFn === "function" ? promiseOrFn() : promiseOrFn;
      return await p;
    } finally {
      hide();
    }
  }

  // Expose global API
  window.GECOM = window.GECOM || {};
  window.GECOM.spinner = { show, hide, reset, wrap };

  // -------- Optional: auto-hook jQuery AJAX (if you use $.ajax) --------
  if (window.jQuery) {
    jQuery(document).ajaxStart(() => show());
    jQuery(document).ajaxStop(() => reset());
  }

  // -------- Optional: auto-hook fetch (if you want global for fetch calls) --------
  // If you already override fetch in layout (you do), prefer to integrate there instead (see next section).
})();
