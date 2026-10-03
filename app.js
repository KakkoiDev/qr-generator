(function () {
  'use strict';

  var input = document.getElementById('text');
  var qrBox = document.getElementById('qr');
  var errorBox = document.getElementById('error');
  var downloadBtn = document.getElementById('download');
  var svgLink = document.getElementById('svg-link');
  var form = document.getElementById('form');
  var svgUrl = document.getElementById('svg-url');
  var iframeCode = document.getElementById('iframe-code');

  var IFRAME_SIZE = 256;

  var currentSvg = '';
  var urlTimer = null;

  function render() {
    var text = input.value;
    try {
      currentSvg = QR.svg({ text: text });
      qrBox.innerHTML = currentSvg;
      errorBox.hidden = true;
      downloadBtn.disabled = false;
    } catch (err) {
      currentSvg = '';
      qrBox.innerHTML = '';
      errorBox.textContent = 'Text is too long to fit in a QR code.';
      errorBox.hidden = false;
      downloadBtn.disabled = true;
    }
    updateEmbed(text);
    scheduleUrlUpdate(text);
  }

  function updateEmbed(text) {
    var opts = QR.parse(new URLSearchParams({ t: text }));
    var url = new URL('svg/?' + QR.query(opts), location.href).href;
    svgLink.href = url;
    svgUrl.value = url;

    opts.size = IFRAME_SIZE;
    var iframeSrc = new URL('svg/?' + QR.query(opts), location.href).href;
    iframeCode.value =
      '<iframe src="' + escapeAttr(iframeSrc) + '" width="' + IFRAME_SIZE + '" height="' + IFRAME_SIZE +
      '" style="border:0" title="QR code"></iframe>';
  }

  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  function copy(button) {
    var field = document.getElementById(button.getAttribute('data-copy'));
    var done = function () {
      button.textContent = 'Copied';
      setTimeout(function () { button.textContent = 'Copy'; }, 1200);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(field.value).then(done, function () { legacyCopy(field); done(); });
    } else {
      legacyCopy(field);
      done();
    }
  }

  function legacyCopy(field) {
    field.select();
    try { document.execCommand('copy'); } catch (e) {}
  }

  // Keep ?t= in the address bar in sync so the page can be shared.
  // Debounced because some browsers rate-limit history.replaceState.
  function scheduleUrlUpdate(text) {
    clearTimeout(urlTimer);
    urlTimer = setTimeout(function () {
      var url = new URL(location.href);
      if (text) url.searchParams.set('t', text);
      else url.searchParams.delete('t');
      history.replaceState(null, '', url);
    }, 150);
  }

  function download() {
    if (!currentSvg) return;
    var blob = new Blob([currentSvg], { type: 'image/svg+xml' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'qr-code.svg';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  input.value = new URLSearchParams(location.search).get('t') || '';
  input.addEventListener('input', render);
  form.addEventListener('submit', function (e) { e.preventDefault(); });
  downloadBtn.addEventListener('click', download);
  Array.prototype.forEach.call(document.querySelectorAll('[data-copy]'), function (btn) {
    btn.addEventListener('click', function () { copy(btn); });
  });
  [svgUrl, iframeCode].forEach(function (el) {
    el.addEventListener('focus', function () { el.select(); });
  });
  render();

  // Install the service worker so ./svg?t=... URLs return real SVG images.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
