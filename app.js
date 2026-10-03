(function () {
  'use strict';

  var input = document.getElementById('text');
  var qrBox = document.getElementById('qr');
  var errorBox = document.getElementById('error');
  var downloadBtn = document.getElementById('download');
  var svgLink = document.getElementById('svg-link');
  var form = document.getElementById('form');

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
    svgLink.href = 'svg/?' + QR.query(QR.parse(new URLSearchParams({ t: text })));
    scheduleUrlUpdate(text);
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
  render();

  // Install the service worker so ./svg?t=... URLs return real SVG images.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
