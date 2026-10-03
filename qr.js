// Shared QR logic. Used by the generator page, the /svg page and the service
// worker (via importScripts), so it must only rely on globals available in
// both window and worker scopes.
(function (root) {
  'use strict';

  var qrcode = root.qrcode;
  // Encode text as UTF-8 so emoji, accents, CJK, etc. survive.
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  var ECC_LEVELS = ['L', 'M', 'Q', 'H'];
  var SIZES = [256, 512, 1024];
  var INKS = [
    { name: 'Black', hex: '0B0B0C' },
    { name: 'Blue', hex: '1E3BC8' },
    { name: 'Red', hex: 'B8301B' },
    { name: 'Green', hex: '0D6444' },
  ];

  var DEFAULTS = {
    text: '',
    size: 512,
    ink: '0B0B0C',
    bg: 'FFFFFF',
    ecc: 'M',
    margin: 4,
  };

  // Accepts "rgb" or "rrggbb", with or without "#". Returns "RRGGBB" or null.
  function hex(value) {
    if (value == null) return null;
    var v = String(value).replace(/^#/, '');
    if (/^[0-9a-f]{3}$/i.test(v)) v = v.replace(/./g, '$&$&');
    return /^[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
  }

  function int(value, fallback, min, max) {
    var n = parseInt(value, 10);
    if (isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  // Normalized options from URLSearchParams.
  //   t    text to encode
  //   s    width/height in px
  //   c    ink hex without '#' ("fg" is accepted as an older alias)
  //   bg   background hex, or "transparent"
  //   ecc  error correction level: L, M, Q, H
  //   m    quiet zone, in modules
  function parse(params) {
    var ecc = String(params.get('ecc') || DEFAULTS.ecc).toUpperCase();
    var bg = params.get('bg');
    return {
      text: params.get('t') || DEFAULTS.text,
      size: int(params.get('s'), DEFAULTS.size, 16, 8192),
      ink: hex(params.get('c')) || hex(params.get('fg')) || DEFAULTS.ink,
      bg: bg === 'transparent' || bg === 'none' ? 'none' : hex(bg) || DEFAULTS.bg,
      ecc: ECC_LEVELS.indexOf(ecc) === -1 ? DEFAULTS.ecc : ecc,
      margin: int(params.get('m'), DEFAULTS.margin, 0, 64),
    };
  }

  // Canonical query string; only non-default values beyond s and t are kept,
  // so equivalent URLs share a cache entry.
  function query(opts) {
    var q = 's=' + opts.size + '&t=' + encodeURIComponent(opts.text);
    if (opts.ink !== DEFAULTS.ink) q += '&c=' + opts.ink;
    if (opts.bg !== DEFAULTS.bg) q += '&bg=' + (opts.bg === 'none' ? 'transparent' : opts.bg);
    if (opts.ecc !== DEFAULTS.ecc) q += '&ecc=' + opts.ecc;
    if (opts.margin !== DEFAULTS.margin) q += '&m=' + opts.margin;
    return q;
  }

  // Encode text. Throws if it is too long to fit in a QR code.
  // Returns { count, path(margin) } where path is one SVG path of all dark
  // modules, offset by `margin` modules.
  function encode(text, ecc) {
    var qr = qrcode(0, ecc || DEFAULTS.ecc);
    qr.addData(text, 'Byte');
    qr.make();
    var count = qr.getModuleCount();

    return {
      count: count,
      path: function (margin) {
        var d = '';
        for (var r = 0; r < count; r++) {
          for (var c = 0; c < count; c++) {
            if (!qr.isDark(r, c)) continue;
            var start = c;
            while (c + 1 < count && qr.isDark(r, c + 1)) c++;
            var len = c - start + 1;
            d += 'M' + (start + margin) + ' ' + (r + margin) + 'h' + len + 'v1h-' + len + 'z';
          }
        }
        return d;
      },
    };
  }

  // Standalone SVG file: explicit size, background rect, one ink path.
  function svg(opts) {
    opts = Object.assign({}, DEFAULTS, opts);
    var code = encode(opts.text, opts.ecc);
    var dim = code.count + opts.margin * 2;
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + opts.size + '" height="' + opts.size + '"' +
      ' viewBox="0 0 ' + dim + ' ' + dim + '" shape-rendering="crispEdges">' +
      (opts.bg === 'none' ? '' : '<rect width="100%" height="100%" fill="#' + opts.bg + '"/>') +
      '<path d="' + code.path(opts.margin) + '" fill="#' + opts.ink + '"/>' +
      '</svg>'
    );
  }

  root.QR = {
    DEFAULTS: DEFAULTS,
    SIZES: SIZES,
    INKS: INKS,
    hex: hex,
    parse: parse,
    query: query,
    encode: encode,
    svg: svg,
  };
})(typeof self !== 'undefined' ? self : this);
