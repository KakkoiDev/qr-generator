// Service worker.
// - Requests for ./svg/?… that are NOT page loads (e.g. <img src>, fetch())
//   get a real image/svg+xml response generated here, cached per URL.
// - Page loads (including iframes) of ./svg/ get the HTML page as usual.
// - App files are served network-first with a cache fallback, so the site
//   keeps working offline.
importScripts('vendor/qrcode.js', 'qr.js');

var VERSION = 'v2';
var SVG_CACHE = 'qr-svg-' + VERSION;
var SHELL_CACHE = 'qr-shell-' + VERSION;
var MAX_SVGS = 300;
var SHELL = [
  './',
  'style.css',
  'tokens.css',
  'app.js',
  'qr.js',
  'vendor/qrcode.js',
  'svg/',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return Promise.all(SHELL.map(function (path) {
        return cache.add(path).catch(function () {});
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) {
          return /^qr-(svg|shell)-/.test(k) && k !== SVG_CACHE && k !== SHELL_CACHE;
        }).map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  var svgPath = new URL('svg', self.registration.scope).pathname;
  var isSvgRoute = url.pathname === svgPath || url.pathname === svgPath + '/';

  if (isSvgRoute && req.mode !== 'navigate' && url.searchParams.get('t')) {
    event.respondWith(svgResponse(url, svgPath));
  } else {
    event.respondWith(networkFirst(req));
  }
});

function svgResponse(url, svgPath) {
  var opts = QR.parse(url.searchParams);
  var key = new URL(svgPath + '/?' + QR.query(opts), self.location.origin).href;

  return caches.open(SVG_CACHE).then(function (cache) {
    return cache.match(key).then(function (hit) {
      if (hit) return hit;

      var body;
      try {
        body = QR.svg(opts);
      } catch (err) {
        return new Response('Too long for a QR code — shorten the text.', {
          status: 400,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }

      var res = new Response(body, {
        headers: {
          'Content-Type': 'image/svg+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
      return cache.put(key, res.clone())
        .then(function () { return trim(cache); })
        .then(function () { return res; });
    });
  });
}

// Drop the oldest entries once the cache grows past MAX_SVGS.
function trim(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - MAX_SVGS;
    if (extra <= 0) return;
    return Promise.all(keys.slice(0, extra).map(function (k) { return cache.delete(k); }));
  });
}

// Network first; on failure, the cached copy. Query strings are ignored for
// the cache lookup so /?t=… and /svg/?t=… work offline.
function networkFirst(req) {
  return fetch(req).then(function (res) {
    if (res.ok && res.type === 'basic') {
      var copy = res.clone();
      var url = new URL(req.url);
      url.search = '';
      caches.open(SHELL_CACHE).then(function (cache) { cache.put(url.href, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(req, { ignoreSearch: true }).then(function (hit) {
      return hit || Response.error();
    });
  });
}
