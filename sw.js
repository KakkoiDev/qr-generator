// Service worker: answers requests to ./svg and ./svg/ with a real
// image/svg+xml response generated in the browser, and caches it so the same
// URL is served instantly (and offline) next time.
importScripts('vendor/qrcode.js', 'qr.js');

var CACHE = 'qr-svg-v1';
var MAX_ENTRIES = 300;

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.indexOf('qr-svg-') === 0 && k !== CACHE; })
          .map(function (k) { return caches.delete(k); })
      );
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  var svgPath = new URL('svg', self.registration.scope).pathname;
  if (url.origin !== self.location.origin) return;
  if (url.pathname !== svgPath && url.pathname !== svgPath + '/') return;
  event.respondWith(respond(url, svgPath));
});

function respond(url, svgPath) {
  var opts = QR.parse(url.searchParams);
  var key = new URL(svgPath + '/?' + QR.query(opts), self.location.origin).href;

  return caches.open(CACHE).then(function (cache) {
    return cache.match(key).then(function (hit) {
      if (hit) return hit;

      var body;
      try {
        body = QR.svg(opts);
      } catch (err) {
        return new Response('Cannot encode: ' + (err && err.message || err), {
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

// Drop the oldest entries once the cache grows past MAX_ENTRIES.
function trim(cache) {
  return cache.keys().then(function (keys) {
    var extra = keys.length - MAX_ENTRIES;
    if (extra <= 0) return;
    return Promise.all(keys.slice(0, extra).map(function (k) { return cache.delete(k); }));
  });
}
