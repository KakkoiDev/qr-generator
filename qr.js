// Shared QR -> SVG logic. Used by the main page, the /svg fallback page and
// the service worker (via importScripts), so it must only rely on globals
// available in both window and worker scopes.
(function (root) {
  'use strict';

  var qrcode = root.qrcode;
  // Encode text as UTF-8 so emoji, accents, CJK, etc. survive.
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  var ECC_LEVELS = ['L', 'M', 'Q', 'H'];
  var COLOR_RE = /^(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

  var DEFAULTS = {
    text: '',
    ecc: 'M',
    fg: '000000',
    bg: 'ffffff',
    margin: 4,
    size: 512,
  };

  function color(value, fallback) {
    if (value == null || value === '') return fallback;
    value = String(value).replace(/^#/, '');
    if (value === 'transparent' || value === 'none') return 'none';
    return COLOR_RE.test(value) ? value : fallback;
  }

  function int(value, fallback, min, max) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  // Build normalized options from URLSearchParams.
  //   t      text to encode
  //   ecc    error correction level: L, M, Q, H
  //   fg/bg  hex colors without '#' (bg may also be "transparent")
  //   m      quiet zone margin, in modules
  //   s      width/height of the SVG in px
  function parse(params) {
    var ecc = String(params.get('ecc') || DEFAULTS.ecc).toUpperCase();
    return {
      text: params.get('t') || DEFAULTS.text,
      ecc: ECC_LEVELS.indexOf(ecc) === -1 ? DEFAULTS.ecc : ecc,
      fg: color(params.get('fg'), DEFAULTS.fg),
      bg: color(params.get('bg'), DEFAULTS.bg),
      margin: int(params.get('m'), DEFAULTS.margin, 0, 64),
      size: int(params.get('s'), DEFAULTS.size, 16, 8192),
    };
  }

  // Canonical query string for a set of options; only non-default values are
  // kept, so equivalent URLs share a cache entry.
  function query(opts) {
    var params = new URLSearchParams();
    params.set('t', opts.text);
    if (opts.ecc !== DEFAULTS.ecc) params.set('ecc', opts.ecc);
    if (opts.fg !== DEFAULTS.fg) params.set('fg', opts.fg);
    if (opts.bg !== DEFAULTS.bg) params.set('bg', opts.bg === 'none' ? 'transparent' : opts.bg);
    if (opts.margin !== DEFAULTS.margin) params.set('m', String(opts.margin));
    if (opts.size !== DEFAULTS.size) params.set('s', String(opts.size));
    return params.toString();
  }

  function fill(c) {
    return c === 'none' ? 'none' : '#' + c;
  }

  // Throws if the text is too long to fit in a QR code.
  function svg(opts) {
    opts = Object.assign({}, DEFAULTS, opts);
    var qr = qrcode(0, opts.ecc);
    qr.addData(opts.text, 'Byte');
    qr.make();

    var count = qr.getModuleCount();
    var m = opts.margin;
    var dim = count + m * 2;
    var path = '';

    // One path, merging horizontal runs of dark modules.
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (!qr.isDark(r, c)) continue;
        var start = c;
        while (c + 1 < count && qr.isDark(r, c + 1)) c++;
        var len = c - start + 1;
        path += 'M' + (start + m) + ' ' + (r + m) + 'h' + len + 'v1h-' + len + 'z';
      }
    }

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + opts.size + '" height="' + opts.size + '"' +
      ' viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">' +
      (opts.bg === 'none' ? '' : '<rect width="100%" height="100%" fill="' + fill(opts.bg) + '"/>') +
      '<path d="' + path + '" fill="' + fill(opts.fg) + '"/>' +
      '</svg>'
    );
  }

  root.QR = { DEFAULTS: DEFAULTS, parse: parse, query: query, svg: svg };
})(typeof self !== 'undefined' ? self : this);
