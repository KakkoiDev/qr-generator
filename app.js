(function () {
  'use strict';

  var COPIED_MS = 1600;
  var PLACEHOLDER = 'https://qr.kakkoi.dev';
  var MSG_EMPTY = 'Type something to make a code';
  var MSG_TOO_LONG = 'Too long for a QR code — shorten the text.';

  var $ = function (id) { return document.getElementById(id); };
  var textarea = $('qr-text');
  var charCount = $('char-count');
  var sizesBox = $('sizes');
  var inksBox = $('inks');
  var customSwatch = $('custom-swatch');
  var customInput = $('custom-ink');
  var inkHex = $('ink-hex');
  var inkWarning = $('ink-warning');
  var preview = $('preview');
  var overlay = $('preview-overlay');
  var overlayMsg = $('preview-message');
  var linkCode = $('link-code');
  var embedCode = $('embed-code');
  var openLink = $('open-link');
  var live = $('live');
  var mobile = window.matchMedia('(max-width: 767px)');

  // ---------- State ----------

  var initial = QR.parse(new URLSearchParams(location.search));
  var state = {
    text: initial.text,
    size: QR.SIZES.indexOf(initial.size) === -1 ? QR.DEFAULTS.size : initial.size,
    ink: initial.ink, // "RRGGBB"
    copied: '', // "" | "link" | "embed"
    valid: false,
  };
  var copiedTimer = null;
  var urlTimer = null;
  var lastGood = null; // last successfully encoded { count, path }

  // ---------- Derived values ----------

  function link() {
    var base = new URL('svg/', location.href).href;
    return base + '?' + QR.query({
      text: state.text,
      size: state.size,
      ink: state.ink,
      bg: QR.DEFAULTS.bg,
      ecc: QR.DEFAULTS.ecc,
      margin: QR.DEFAULTS.margin,
    });
  }

  function iframe() {
    // link() is percent-encoded, so it never contains a quote.
    return '<iframe src="' + link() + '" width="' + state.size +
      '" height="' + state.size + '" style="border:0" title="QR code"></iframe>';
  }

  function isPreset(ink) {
    return QR.INKS.some(function (k) { return k.hex === ink; });
  }

  function rgb(ink) {
    return [0, 2, 4].map(function (i) { return parseInt(ink.slice(i, i + 2), 16); });
  }

  // WCAG contrast ratio of the ink against white.
  function contrastOnWhite(ink) {
    var l = rgb(ink).map(function (v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    var lum = 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
    return 1.05 / (lum + 0.05);
  }

  function slug(text) {
    var s = text.slice(0, 32).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return s ? 'qr-' + s + '.svg' : 'qr.svg';
  }

  // ---------- Building the controls ----------

  QR.SIZES.forEach(function (n) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = String(n);
    b.dataset.size = String(n);
    b.addEventListener('click', function () { state.size = n; update(); });
    sizesBox.appendChild(b);
  });

  QR.INKS.forEach(function (k) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.ink = k.hex;
    b.setAttribute('aria-label', k.name);
    var fill = document.createElement('span');
    fill.className = 'swatch-fill';
    fill.style.background = '#' + k.hex;
    b.appendChild(fill);
    b.addEventListener('click', function () { state.ink = k.hex; update(); });
    inksBox.insertBefore(b, customSwatch);
  });

  // ---------- Rendering ----------

  function renderPreview() {
    var text = state.text;
    var empty = text.trim() === '';
    var code = null;

    try {
      code = QR.encode(empty ? PLACEHOLDER : text);
    } catch (e) {
      code = null;
    }

    state.valid = !empty && !!code;
    if (code && !empty) lastGood = code;
    // Empty: faint placeholder. Too long: faint last valid code.
    var shown = code || lastGood || QR.encode(PLACEHOLDER);

    preview.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + shown.count + ' ' + shown.count +
      '" shape-rendering="crispEdges" role="img" aria-label="QR code preview"><path fill="#' + state.ink +
      '" d="' + shown.path(0) + '"/></svg>';
    preview.classList.toggle('is-faded', !state.valid);
    overlay.hidden = state.valid;
    overlayMsg.textContent = empty ? MSG_EMPTY : MSG_TOO_LONG;

    document.querySelectorAll('.modules').forEach(function (el) { el.textContent = String(shown.count); });
  }

  function renderControls() {
    charCount.textContent = String(state.text.length);
    document.querySelectorAll('.px').forEach(function (el) { el.textContent = String(state.size); });

    sizesBox.querySelectorAll('button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(Number(b.dataset.size) === state.size));
    });
    inksBox.querySelectorAll('button[data-ink]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.ink === state.ink));
    });

    var custom = !isPreset(state.ink);
    var fill = customSwatch.querySelector('.swatch-fill');
    customSwatch.classList.toggle('is-active', custom);
    if (custom) {
      var c = rgb(state.ink);
      var light = 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] > 150;
      fill.style.background = '#' + state.ink;
      fill.style.color = light ? 'var(--ink)' : 'var(--paper)';
    } else {
      fill.style.background = '';
      fill.style.color = '';
    }
    if (document.activeElement !== customInput) customInput.value = '#' + state.ink.toLowerCase();
    inkHex.textContent = '#' + state.ink;
    inkWarning.hidden = contrastOnWhite(state.ink) >= 3;

    linkCode.textContent = link();
    embedCode.textContent = iframe();
    openLink.href = link();

    document.querySelectorAll('[data-copy], [data-action]').forEach(function (b) {
      b.disabled = !state.valid;
    });
    renderLabels();
  }

  function renderLabels() {
    document.querySelectorAll('[data-copy]').forEach(function (b) {
      var span = b.querySelector('[data-label]');
      var base = (mobile.matches && span.dataset.labelMobile) || span.dataset.label;
      span.textContent = state.copied === b.dataset.copy ? 'Copied' : base;
    });
  }

  function update() {
    renderPreview();
    renderControls();
    scheduleUrlUpdate();
  }

  // Mirror state into /?t=…&s=…&c=… so a reload or shared page keeps it.
  // Debounced because some browsers rate-limit history.replaceState.
  function scheduleUrlUpdate() {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      var url = new URL(location.href);
      var p = url.searchParams;
      ['t', 's', 'c', 'fg'].forEach(function (k) { p.delete(k); });
      if (state.text) p.set('t', state.text);
      if (state.size !== QR.DEFAULTS.size) p.set('s', String(state.size));
      if (state.ink !== QR.DEFAULTS.ink) p.set('c', state.ink);
      history.replaceState(null, '', url);
    }, 150);
  }

  // ---------- Actions ----------

  function announce(msg) {
    live.textContent = '';
    setTimeout(function () { live.textContent = msg; }, 30);
  }

  function selectText(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function copy(which) {
    var value = which === 'embed' ? iframe() : link();
    var box = which === 'embed' ? embedCode : linkCode;
    var done = function () {
      state.copied = which;
      renderLabels();
      announce(which === 'embed' ? 'Embed code copied' : 'Link copied');
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(function () { state.copied = ''; renderLabels(); }, COPIED_MS);
    };
    var fallback = function () {
      selectText(box);
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      if (ok) done();
      else announce('Press Ctrl+C or Cmd+C to copy the selected text');
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(value).then(done, fallback);
    } else {
      fallback();
    }
  }

  function download() {
    if (!state.valid) return;
    var svg = QR.svg({ text: state.text, size: state.size, ink: state.ink });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    a.download = slug(state.text);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  function share() {
    if (!state.valid) return;
    if (navigator.share) {
      navigator.share({ url: link() }).catch(function (err) {
        if (err && err.name !== 'AbortError') copy('link');
      });
    } else {
      copy('link');
    }
  }

  // ---------- Wiring ----------

  textarea.value = state.text;
  textarea.addEventListener('input', function () { state.text = textarea.value; update(); });
  customInput.addEventListener('input', function () {
    state.ink = QR.hex(customInput.value) || state.ink;
    update();
  });
  document.querySelectorAll('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () { copy(b.dataset.copy); });
  });
  document.querySelectorAll('[data-action="download"]').forEach(function (b) {
    b.addEventListener('click', download);
  });
  document.querySelectorAll('[data-action="share"]').forEach(function (b) {
    b.addEventListener('click', share);
  });
  if (mobile.addEventListener) mobile.addEventListener('change', renderLabels);

  update();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
